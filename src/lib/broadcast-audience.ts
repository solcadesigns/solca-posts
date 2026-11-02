/**
 * Audiencia única de KV EMAILS para envíos masivos por el stream `broadcast` · 2 nov 2026.
 *
 * Extraído de src/pages/api/blog-broadcast.ts sin cambiar su comportamiento (mismo orden de lecturas,
 * mismos conteos). Lo usan blog-broadcast (newsletter, aplica después el filtro de consentimiento) y
 * aviso-privacidad-2026-11 (correo único de aviso, sin filtro de consentimiento).
 *
 * Qué arma `collectLeadBase`:
 * 1. Suscriptores `email:` / `quiz:` / `sim:` (paginado), dedup por correo con el opt-in más reciente, señales
 *    de consentimiento de la metadata y llaves legado `email:`/`quiz:` por si hay que leer el país.
 * 2. Correos con `attempt:` sin registro de suscriptor (solo se cuentan).
 * 3. Bajas `unsub:<email>:<scope>` por correo.
 * 4. Supresiones de Postmark (stream broadcast completo; outbound solo HardBounce y SpamComplaint).
 */

import { sendEmail } from './postmark';
import { isSpain, readConsentKvMeta, type ConsentSignal } from './consent';

export const SUBSCRIBER_PREFIXES = ['email:', 'quiz:', 'sim:'] as const;
export const NEWSLETTER_UNSUB_SCOPES = new Set(['newsletter', 'comercial', 'all']);
export const LEAD_KEY_RE = /^(email|quiz|sim):(\d{4}-\d{2}-\d{2}T[0-9:.]+Z):(.+)$/;
export const UNSUB_KEY_RE = /^unsub:(.+):([a-z_-]+)$/;
const POSTMARK_BASE = 'https://api.postmarkapp.com';
// Workers KV: 1,000 operaciones por invocación (https://developers.cloudflare.com/kv/platform/limits/).
// Las lecturas de registros legado paran antes, con margen para el candado y el reporte.
export const KV_OP_BUDGET = 980;
export const MAX_AGE_DAYS = 730; // 2 años · alineado con política Brevo aprendida
const MAX_LIST_PAGES = 100; // 100k llaves por prefijo; tope de seguridad
export const SUPPRESSION_DUMP_SUSPECT = 500; // si el dump regresa justo eso o más, podría venir cortado

export interface Lead {
  email: string;
  ts: string; // ISO de opt-in (del nombre de la llave)
}

export interface KvCounter {
  calls: number; // kv.list
  gets: number; // kv.get
  truncated: boolean;
}

interface KeyInfo {
  name: string;
  metadata?: unknown;
}

/**
 * Auth: header X-Broadcast-Secret igual al secret BROADCAST_SECRET. Impide que el endpoint se llame desde fuera.
 */
export function isBroadcastAuthorized(request: Request, env: Record<string, unknown>): boolean {
  const provided = request.headers.get('x-broadcast-secret');
  const expected = env.BROADCAST_SECRET as string | undefined;
  if (!expected) return false;
  return provided === expected;
}

/** Lista todas las llaves de un prefijo (con su metadata), paginando con cursor. */
export async function listAllKeys(kv: KVNamespace, prefix: string, counter: KvCounter): Promise<KeyInfo[]> {
  const names: KeyInfo[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const res = await kv.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    counter.calls++;
    for (const k of res.keys) names.push({ name: k.name, metadata: k.metadata });
    if (res.list_complete) return names;
    cursor = (res as { cursor?: string }).cursor;
    if (!cursor) return names;
  }
  counter.truncated = true;
  console.error(`broadcast:list-truncated prefix=${prefix} pages=${MAX_LIST_PAGES}`);
  return names;
}

/** Correo + ts del nombre de la llave; si el formato no cuadra, lee el registro. */
async function leadFromKey(kv: KVNamespace, name: string, counter: KvCounter): Promise<Lead | null> {
  const m = LEAD_KEY_RE.exec(name);
  if (m) return { email: m[3].toLowerCase().trim(), ts: m[2] };
  try {
    counter.gets++;
    const raw = await kv.get(name);
    if (!raw) return null;
    const rec = JSON.parse(raw) as { email?: string; ts?: string; optedInAt?: string };
    const email = rec.email?.toLowerCase().trim();
    const ts = rec.optedInAt ?? rec.ts;
    return email && ts ? { email, ts } : null;
  } catch {
    return null;
  }
}

/** Descarga la lista de supresiones de un stream de Postmark. Lanza si falla. */
async function fetchSuppressions(
  token: string,
  stream: string,
  reasons?: Set<string>,
): Promise<{ emails: Set<string>; raw: number }> {
  const res = await fetch(`${POSTMARK_BASE}/message-streams/${stream}/suppressions/dump`, {
    headers: { Accept: 'application/json', 'X-Postmark-Server-Token': token },
  });
  if (!res.ok) throw new Error(`suppressions ${stream} → ${res.status}`);
  const data = (await res.json()) as {
    Suppressions?: Array<{ EmailAddress?: string; SuppressionReason?: string }>;
  };
  if (!Array.isArray(data.Suppressions)) throw new Error(`suppressions ${stream} → sin arreglo`);
  const emails = new Set<string>();
  for (const s of data.Suppressions) {
    const e = s.EmailAddress?.toLowerCase().trim();
    if (!e) continue;
    if (reasons && !reasons.has(s.SuppressionReason ?? '')) continue;
    emails.add(e);
  }
  return { emails, raw: data.Suppressions.length };
}

export async function alertOscar(token: string, subject: string, text: string, tag = 'broadcast-alert'): Promise<void> {
  try {
    await sendEmail(token, {
      from: 'hello@solcaciencia.com',
      to: 'hello@solcaciencia.com',
      subject,
      textBody: text,
      tag,
    });
  } catch (err) {
    console.error('broadcast:alert-failed', err);
  }
}

export interface LeadBase {
  byEmail: Map<string, Lead>;
  signalsByEmail: Map<string, ConsentSignal[]>;
  legacyKeysByEmail: Map<string, string[]>; // solo email:/quiz: (sim: no trae país)
  candidates: number;
  candidatesByPrefix: Record<string, number>;
  duplicate: number;
  unparsableKey: number;
  attemptOnly: number;
  unsubScopesByEmail: Map<string, Set<string>>; // todas las bajas unsub:<email>:<scope>
  broadcastSupp: Set<string>;
  outboundSupp: Set<string>;
  suppressionErrors: string[];
  suppressionMaybeTruncated: boolean;
  counter: KvCounter;
}

export async function collectLeadBase(kv: KVNamespace, token: string): Promise<LeadBase> {
  const counter: KvCounter = { calls: 0, gets: 0, truncated: false };
  const signalsByEmail = new Map<string, ConsentSignal[]>();
  const legacyKeysByEmail = new Map<string, string[]>();
  let duplicate = 0;
  let unparsableKey = 0;

  // 1. Suscriptores por prefijo; dedup por correo conservando el opt-in más reciente.
  const byEmail = new Map<string, Lead>();
  const candidatesByPrefix: Record<string, number> = {};
  let candidates = 0;
  for (const prefix of SUBSCRIBER_PREFIXES) {
    const names = await listAllKeys(kv, prefix, counter);
    candidatesByPrefix[prefix.slice(0, -1)] = names.length;
    candidates += names.length;
    for (const { name, metadata } of names) {
      const lead = await leadFromKey(kv, name, counter);
      if (!lead) {
        unparsableKey++;
        continue;
      }
      const meta = readConsentKvMeta(metadata);
      const sigs = signalsByEmail.get(lead.email) ?? [];
      if (meta) {
        sigs.push({ consent_version: meta.cv, marketing_optin: meta.mk === 1 });
      } else {
        sigs.push({}); // legado: el país, si hace falta, se lee después
        if (prefix !== 'sim:') {
          const arr = legacyKeysByEmail.get(lead.email) ?? [];
          arr.push(name);
          legacyKeysByEmail.set(lead.email, arr);
        }
      }
      signalsByEmail.set(lead.email, sigs);
      const prev = byEmail.get(lead.email);
      if (prev) {
        duplicate++;
        if (new Date(lead.ts).getTime() > new Date(prev.ts).getTime()) byEmail.set(lead.email, lead);
      } else {
        byEmail.set(lead.email, lead);
      }
    }
  }

  // 2. Solo para medir: correos con intento de CV y sin registro de suscriptor.
  const attemptEmails = new Set<string>();
  for (const { name } of await listAllKeys(kv, 'attempt:', counter)) {
    const m = /^attempt:\d{4}-\d{2}-\d{2}T[0-9:.]+Z:(.+)$/.exec(name);
    if (m) attemptEmails.add(m[1].toLowerCase().trim());
  }
  let attemptOnly = 0;
  for (const e of attemptEmails) if (!byEmail.has(e)) attemptOnly++;

  // 3. Bajas guardadas en KV (todas las scopes; cada envío decide cuáles cuentan).
  const unsubScopesByEmail = new Map<string, Set<string>>();
  for (const { name } of await listAllKeys(kv, 'unsub:', counter)) {
    const m = UNSUB_KEY_RE.exec(name);
    if (!m) continue;
    const e = m[1].toLowerCase().trim();
    const set = unsubScopesByEmail.get(e) ?? new Set<string>();
    set.add(m[2]);
    unsubScopesByEmail.set(e, set);
  }

  // 4. Supresiones de Postmark. Un fallo no bloquea: Postmark igual rechaza esos envíos.
  const suppressionErrors: string[] = [];
  let suppressionMaybeTruncated = false;
  let broadcastSupp = new Set<string>();
  let outboundSupp = new Set<string>();
  try {
    const r = await fetchSuppressions(token, 'broadcast');
    broadcastSupp = r.emails;
    if (r.raw >= SUPPRESSION_DUMP_SUSPECT) suppressionMaybeTruncated = true;
  } catch (err) {
    suppressionErrors.push((err as Error).message);
  }
  try {
    const r = await fetchSuppressions(token, 'outbound', new Set(['HardBounce', 'SpamComplaint']));
    outboundSupp = r.emails;
  } catch (err) {
    suppressionErrors.push((err as Error).message);
  }

  return {
    byEmail,
    signalsByEmail,
    legacyKeysByEmail,
    candidates,
    candidatesByPrefix,
    duplicate,
    unparsableKey,
    attemptOnly,
    unsubScopesByEmail,
    broadcastSupp,
    outboundSupp,
    suppressionErrors,
    suppressionMaybeTruncated,
    counter,
  };
}

/** Baja que saca del newsletter y de todo lo comercial (`newsletter`, `comercial`, `all`). */
export function hasNewsletterUnsub(base: LeadBase, email: string): boolean {
  const s = base.unsubScopesByEmail.get(email);
  if (!s) return false;
  for (const scope of s) if (NEWSLETTER_UNSUB_SCOPES.has(scope)) return true;
  return false;
}

/** Opt-in más viejo que MAX_AGE_DAYS (o ts ilegible). */
export function isTooOld(lead: Lead, nowMs: number): boolean {
  const optInMs = new Date(lead.ts).getTime();
  return isNaN(optInMs) || (nowMs - optInMs) / 86_400_000 > MAX_AGE_DAYS;
}

/**
 * Lee los registros legado `email:`/`quiz:` de un correo hasta encontrar país España.
 * `unread` si el tope de operaciones KV se acabó antes de leerlos todos (y ninguno leído era España).
 */
export async function legacySpainCheck(
  kv: KVNamespace,
  keys: string[],
  counter: KvCounter,
  budget: number,
  onRead?: () => void,
): Promise<'es' | 'no' | 'unread'> {
  for (const key of keys) {
    if (counter.calls + counter.gets >= budget) return 'unread';
    counter.gets++;
    onRead?.();
    try {
      const raw = await kv.get(key);
      const country = raw ? (JSON.parse(raw) as { country?: string }).country : undefined;
      if (isSpain(country)) return 'es';
    } catch {
      // registro ilegible: no aporta país
    }
  }
  return 'no';
}
