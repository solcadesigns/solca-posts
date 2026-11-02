import type { APIRoute } from 'astro';
import { sendEmail, sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { getCollection } from 'astro:content';
import {
  decideMarketing,
  isSpain,
  legacyPolicy,
  readConsentKvMeta,
  type ConsentSignal,
  type LegacyPolicy,
} from '../../lib/consent';

export const prerender = false;

/**
 * Broadcast semanal del blog más reciente a los suscriptores KV EMAILS.
 * Triggered por cron Vie 8am CDMX (14:00 UTC · `0 14 * * 5`).
 *
 * Audiencia (2 nov 2026):
 * - Suscriptores = llaves con prefijo `email:` (CV entregado), `quiz:` (quiz-rol) y
 *   `sim:` (registro freemium del Simulador). Las tres piden consentimiento de correo.
 *   NO entran `attempt:` (intentos de CV, incluso fallidos), `drip:`, `unsub:`,
 *   `broadcast-report:` ni nada más del namespace. `contact.ts` escribe en CONTACTS, no aquí.
 * - El correo y la fecha de opt-in salen del nombre de la llave
 *   (`<prefijo>:<ISO ts>:<email>`), sin `get` por registro. Se deduplica por correo.
 * - Listado paginado con cursor hasta `list_complete` (antes cortaba en 1,000 llaves).
 *
 * Bajas (qué cubre cada vía):
 * - Postmark, stream `broadcast`: el `{{{ pm:unsubscribe }}}` del template, rebotes duros y
 *   quejas de spam quedan en su lista de supresiones. Se descarga antes de enviar
 *   (`/message-streams/broadcast/suppressions/dump`) y se excluye. Postmark además
 *   rechaza el envío a esas direcciones (ErrorCode 406), así que si la descarga falla
 *   el envío sigue: se marca en el reporte y se avisa a hello@.
 * - Postmark, stream `outbound`: rebotes duros y quejas del transaccional también se
 *   excluyen (Postmark no los comparte entre streams).
 * - KV `unsub:<email>:newsletter` | `:comercial` | `:all`: baja desde la página de
 *   `drip-unsubscribe` ("salir también del newsletter") o puesta a mano cuando alguien
 *   contesta "unsub". `unsub:<email>:drip` NO saca del newsletter (la página lo promete).
 *
 * Consentimiento comercial (2 nov 2026, src/lib/consent.ts): el newsletter solo va a correos con la casilla
 * comercial marcada en algún formulario (metadata `{cv, mk}` de la llave, sin `get`), o a correos que solo
 * tienen registros legado (sin versión de consentimiento) si MARKETING_LEGACY_POLICY lo permite
 * (`permitir_sin_es`: pasan salvo país España; para eso se lee el registro `email:`/`quiz:` legado con `get`,
 * dentro de un tope de operaciones KV; lo que no alcanza a leerse sale como `legacy_unread`, no se envía).
 * Motivos nuevos en `excluded`: no_marketing_optin, legacy_es, legacy_bloqueado, legacy_unread. Se evalúan
 * al final, después de los motivos anteriores, para que esas cuentas sigan siendo comparables.
 *
 * Idempotencia: `broadcast-lock:<slug>` se escribe antes del primer envío; una segunda
 * corrida del mismo post se salta salvo `?force=1`. `?dry_run=1` calcula la audiencia y
 * las exclusiones sin enviar ni escribir nada.
 *
 * NO importa listas externas. Solo usa KV EMAILS que crece por opt-in nativo.
 */

const SUBSCRIBER_PREFIXES = ['email:', 'quiz:', 'sim:'] as const;
const NEWSLETTER_UNSUB_SCOPES = new Set(['newsletter', 'comercial', 'all']);
const LEAD_KEY_RE = /^(email|quiz|sim):(\d{4}-\d{2}-\d{2}T[0-9:.]+Z):(.+)$/;
const UNSUB_KEY_RE = /^unsub:(.+):([a-z_-]+)$/;
const POSTMARK_BASE = 'https://api.postmarkapp.com';
// Workers KV: 1,000 operaciones por invocación (https://developers.cloudflare.com/kv/platform/limits/).
// Las lecturas de registros legado paran antes, con margen para el candado y el reporte.
const KV_OP_BUDGET = 980;

interface Lead {
  email: string;
  ts: string; // ISO de opt-in (del nombre de la llave)
}

interface Exclusions {
  attempt_only: number; // correos con `attempt:` y sin registro de suscriptor (antes sí recibían)
  duplicate: number; // registros extra del mismo correo
  too_old: number; // opt-in > MAX_AGE_DAYS
  unsub_kv: number; // unsub:<email>:newsletter|comercial|all
  suppressed_broadcast: number; // lista de supresiones Postmark, stream broadcast
  suppressed_outbound: number; // rebote duro / queja en el stream transaccional
  over_cap: number; // no enviados por tope de la corrida
  unparsable_key: number; // llave de suscriptor con formato inesperado y sin registro legible
  // 2 nov 2026 · consentimiento comercial (src/lib/consent.ts)
  no_marketing_optin: number; // solo registros nuevos y ninguno con la casilla comercial marcada
  legacy_es: number; // solo legado y país España (política permitir_sin_es)
  legacy_bloqueado: number; // solo legado y la política es bloquear o reconfirmar
  legacy_unread: number; // legado sin leer por el tope de operaciones KV (no se envía sin verificar)
}

interface ConsentStats {
  policy: LegacyPolicy;
  optin: number; // elegibles por casilla comercial marcada
  legacy_allowed: number; // elegibles por regla legado
  legacy_reads: number; // `get` de registros legado para el filtro España
}

interface BroadcastReport {
  blog_slug: string;
  blog_title: string;
  candidates: number; // registros de suscriptor (email:/quiz:/sim:) leídos
  candidates_by_prefix: Record<string, number>;
  unique_emails: number;
  eligible: number;
  sent: number;
  failed: number;
  failed_inactive: number; // Postmark 406: destinatario suprimido que no venía en el dump
  skipped: number; // candidates - eligible (compatibilidad con el reporte anterior)
  excluded: Exclusions;
  consent: ConsentStats;
  drip_unsub_still_sent: number; // solo dejaron el drip; siguen en el newsletter
  suppression_check: 'ok' | 'failed';
  suppression_errors: string[];
  suppression_maybe_truncated: boolean;
  kv_list_calls: number;
  kv_list_truncated: boolean;
  forced: boolean;
  duration_ms: number;
  started_at: string;
  finished_at: string;
}

const THROTTLE_MS = 100; // ~10 emails/segundo — bajo el límite Postmark
const MAX_AGE_DAYS = 730; // 2 años · alineado con política Brevo aprendida
// Envío secuencial ~0.3 s por correo: 2,500 caben en el límite de 15 min del cron y
// quedan muy debajo de 10,000 subrequests. Si se rebasa, se avisa (no se corta en silencio).
const MAX_SENDS_PER_RUN = 2500;
const MAX_LIST_PAGES = 100; // 100k llaves por prefijo; tope de seguridad
const SUPPRESSION_DUMP_SUSPECT = 500; // si el dump regresa justo eso o más, podría venir cortado

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * Auth: verifica que el request tiene el header X-Broadcast-Secret que coincide con
 * el secret BROADCAST_SECRET. Impide que endpoint sea llamado desde fuera del cron.
 */
function isAuthorized(request: Request, env: Record<string, unknown>): boolean {
  const provided = request.headers.get('x-broadcast-secret');
  const expected = env.BROADCAST_SECRET as string | undefined;
  if (!expected) return false;
  return provided === expected;
}

interface KvCounter {
  calls: number; // kv.list
  gets: number; // kv.get
  truncated: boolean;
}

interface KeyInfo {
  name: string;
  metadata?: unknown;
}

/** Lista todas las llaves de un prefijo (con su metadata), paginando con cursor. */
async function listAllKeys(kv: KVNamespace, prefix: string, counter: KvCounter): Promise<KeyInfo[]> {
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

async function alertOscar(token: string, subject: string, text: string): Promise<void> {
  try {
    await sendEmail(token, {
      from: 'hello@solcaciencia.com',
      to: 'hello@solcaciencia.com',
      subject,
      textBody: text,
      tag: 'broadcast-alert',
    });
  } catch (err) {
    console.error('broadcast:alert-failed', err);
  }
}

interface Audience {
  eligible: Lead[];
  candidates: number;
  candidatesByPrefix: Record<string, number>;
  uniqueEmails: number;
  excluded: Exclusions;
  consent: ConsentStats;
  dripUnsubStillSent: number;
  suppressionCheck: 'ok' | 'failed';
  suppressionErrors: string[];
  suppressionMaybeTruncated: boolean;
  kvListCalls: number;
  kvListTruncated: boolean;
}

async function buildAudience(
  kv: KVNamespace,
  token: string,
  nowMs: number,
  policy: LegacyPolicy,
): Promise<Audience> {
  const counter: KvCounter = { calls: 0, gets: 0, truncated: false };
  const excluded: Exclusions = {
    attempt_only: 0,
    duplicate: 0,
    too_old: 0,
    unsub_kv: 0,
    suppressed_broadcast: 0,
    suppressed_outbound: 0,
    over_cap: 0,
    unparsable_key: 0,
    no_marketing_optin: 0,
    legacy_es: 0,
    legacy_bloqueado: 0,
    legacy_unread: 0,
  };
  const consent: ConsentStats = { policy, optin: 0, legacy_allowed: 0, legacy_reads: 0 };
  // Consentimiento por correo: señales de la metadata (registros nuevos) y llaves legado por leer.
  const signalsByEmail = new Map<string, ConsentSignal[]>();
  const legacyKeysByEmail = new Map<string, string[]>(); // solo email:/quiz: (sim: no trae país)

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
        excluded.unparsable_key++;
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
        excluded.duplicate++;
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
  for (const e of attemptEmails) if (!byEmail.has(e)) excluded.attempt_only++;

  // 3. Bajas guardadas en KV.
  const unsubNewsletter = new Set<string>();
  const unsubDrip = new Set<string>();
  for (const { name } of await listAllKeys(kv, 'unsub:', counter)) {
    const m = UNSUB_KEY_RE.exec(name);
    if (!m) continue;
    const e = m[1].toLowerCase().trim();
    if (NEWSLETTER_UNSUB_SCOPES.has(m[2])) unsubNewsletter.add(e);
    else if (m[2] === 'drip') unsubDrip.add(e);
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

  // 5. Filtro final. Cada correo cuenta en un solo motivo, en este orden.
  const eligible: Lead[] = [];
  let dripUnsubStillSent = 0;
  for (const lead of byEmail.values()) {
    const optInMs = new Date(lead.ts).getTime();
    if (isNaN(optInMs) || (nowMs - optInMs) / 86_400_000 > MAX_AGE_DAYS) {
      excluded.too_old++;
      continue;
    }
    if (unsubNewsletter.has(lead.email)) {
      excluded.unsub_kv++;
      continue;
    }
    if (broadcastSupp.has(lead.email)) {
      excluded.suppressed_broadcast++;
      continue;
    }
    if (outboundSupp.has(lead.email)) {
      excluded.suppressed_outbound++;
      continue;
    }
    // 2 nov 2026: consentimiento comercial.
    const sigs = signalsByEmail.get(lead.email) ?? [{}];
    let decision = decideMarketing(sigs, policy);
    if (decision === 'legacy') {
      // permitir_sin_es: falta saber si algún registro legado es de España. Se lee con `get` (con tope).
      let unread = false;
      for (const key of legacyKeysByEmail.get(lead.email) ?? []) {
        if (counter.calls + counter.gets >= KV_OP_BUDGET) {
          unread = true;
          break;
        }
        counter.gets++;
        consent.legacy_reads++;
        try {
          const raw = await kv.get(key);
          const country = raw ? (JSON.parse(raw) as { country?: string }).country : undefined;
          if (isSpain(country)) {
            decision = 'legacy_es';
            break;
          }
        } catch {
          // registro ilegible: no aporta país
        }
      }
      if (unread && decision === 'legacy') {
        excluded.legacy_unread++;
        continue;
      }
    }
    if (decision === 'no_marketing_optin') {
      excluded.no_marketing_optin++;
      continue;
    }
    if (decision === 'legacy_es') {
      excluded.legacy_es++;
      continue;
    }
    if (decision === 'legacy_bloqueado') {
      excluded.legacy_bloqueado++;
      continue;
    }
    if (decision === 'optin') consent.optin++;
    else consent.legacy_allowed++;
    if (unsubDrip.has(lead.email)) dripUnsubStillSent++;
    eligible.push(lead);
  }
  if (eligible.length > MAX_SENDS_PER_RUN) {
    excluded.over_cap = eligible.length - MAX_SENDS_PER_RUN;
    eligible.length = MAX_SENDS_PER_RUN;
  }

  return {
    eligible,
    candidates,
    candidatesByPrefix,
    uniqueEmails: byEmail.size,
    excluded,
    consent,
    dripUnsubStillSent,
    suppressionCheck: suppressionErrors.length ? 'failed' : 'ok',
    suppressionErrors,
    suppressionMaybeTruncated,
    kvListCalls: counter.calls,
    kvListTruncated: counter.truncated,
  };
}

/**
 * Obtiene el blog más reciente publicado en los últimos 7 días.
 * Si no hay ninguno reciente, retorna null y el broadcast se salta.
 */
async function getLatestBlog() {
  const posts = await getCollection('blog');
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recent = posts
    .filter((p) => p.data.pubDate.getTime() >= sevenDaysAgo && p.data.pubDate.getTime() <= now)
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  return recent[0] ?? null;
}

/**
 * Envía UN email vía Postmark template blog-broadcast-weekly.
 * TemplateModel: { first_name, blog_title, blog_hook, blog_url, blog_image_url }
 */
async function sendOne(
  token: string,
  to: string,
  firstName: string | undefined,
  blogTitle: string,
  blogHook: string,
  blogUrl: string,
  blogImageUrl: string,
): Promise<'ok' | 'inactive' | 'failed'> {
  try {
    await sendEmailWithTemplate(token, {
      from: 'Oscar Solís <hola@solcaciencia.com>',
      to,
      templateAlias: 'blog-broadcast-weekly',
      templateModel: {
        first_name: firstName ?? '',
        blog_title: blogTitle,
        blog_hook: blogHook,
        blog_url: blogUrl,
        blog_image_url: blogImageUrl,
      },
      tag: 'blog-broadcast',
      messageStream: 'broadcast', // stream separado del transactional
      metadata: { source: 'blog-broadcast-weekly' },
    });
    return 'ok';
  } catch (err) {
    if (err instanceof PostmarkError) {
      // 406 = destinatario inactivo (suprimido en Postmark): no es falla del envío.
      if ((err.body as { ErrorCode?: number } | undefined)?.ErrorCode === 406) return 'inactive';
      console.error(`broadcast:send-failed to=${to} status=${err.status}`, JSON.stringify(err.body));
    } else {
      console.error(`broadcast:send-failed to=${to}`, err);
    }
    return 'failed';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const POST: APIRoute = async ({ request, locals, url }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};

  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!token) {
    return jsonResponse({ error: 'no_postmark_token' }, 503);
  }

  const emailsKv = env.EMAILS as KVNamespace | undefined;
  if (!emailsKv) {
    return jsonResponse({ error: 'no_emails_kv' }, 503);
  }

  const dryRun = url.searchParams.get('dry_run') === '1';
  const force = url.searchParams.get('force') === '1';
  const started = Date.now();
  const startedIso = new Date(started).toISOString();

  // 1. Buscar blog más reciente (últimos 7 días)
  const post = await getLatestBlog();

  // dry_run: audiencia y exclusiones sin enviar ni escribir (solo conteos, sin correos).
  if (dryRun) {
    const aud = await buildAudience(emailsKv, token, Date.now(), legacyPolicy(env));
    return jsonResponse({
      dry_run: true,
      blog_slug: post?.id ?? null,
      already_sent: post ? (await emailsKv.get(`broadcast-lock:${post.id}`)) !== null : null,
      candidates: aud.candidates,
      candidates_by_prefix: aud.candidatesByPrefix,
      unique_emails: aud.uniqueEmails,
      eligible: aud.eligible.length,
      excluded: aud.excluded,
      consent: aud.consent,
      drip_unsub_still_sent: aud.dripUnsubStillSent,
      suppression_check: aud.suppressionCheck,
      suppression_errors: aud.suppressionErrors,
      suppression_maybe_truncated: aud.suppressionMaybeTruncated,
      kv_list_calls: aud.kvListCalls,
      kv_list_truncated: aud.kvListTruncated,
    });
  }

  if (!post) {
    console.log('broadcast:skipped no-recent-blog');
    return jsonResponse({ skipped: true, reason: 'no_recent_blog', started_at: startedIso });
  }

  // Idempotencia: un post se envía una vez. Re-correr el cron o el POST manual no duplica.
  const lockKey = `broadcast-lock:${post.id}`;
  const existingLock = await emailsKv.get(lockKey);
  if (existingLock && !force) {
    console.log(`broadcast:skipped already-sent slug=${post.id}`);
    return jsonResponse({ skipped: true, reason: 'already_sent', blog_slug: post.id, lock: existingLock });
  }

  // UTM para atribuir las visitas de cada envío (26 oct 2026); sin ellas llegaban como tráfico directo.
  const blogUrl = `https://solcaciencia.com/blog/${post.id}/?utm_source=email&utm_medium=broadcast&utm_campaign=blog-${post.id}`;
  const blogTitle = post.data.title;
  // Hook: primeras ~150 palabras del cuerpo (Postmark decide el rendering final vía template)
  // Sin sintaxis markdown: el correo mostraba "> **Respuesta corta.**" literal.
  const bodyText = (post.body ?? '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(>|#{1,6})\s*/gm, '')
    .replace(/[*_`]/g, '')
    .trim();
  const blogHook = bodyText.split(/\s+/).slice(0, 30).join(' ') + '…';
  // Hero image: heroImage del frontmatter viene como "/blog/slug.png"; agregamos el host absoluto
  // para que Postmark/clientes de correo puedan cargarla desde cualquier lado.
  const heroPath = (post.data as { heroImage?: string }).heroImage ?? `/blog/${post.id}.png`;
  const blogImageUrl = heroPath.startsWith('http')
    ? heroPath
    : `https://solcaciencia.com${heroPath}`;

  // 2-3. Audiencia: suscriptores paginados, dedup, bajas KV y supresiones Postmark.
  const aud = await buildAudience(emailsKv, token, Date.now(), legacyPolicy(env));
  const eligible = aud.eligible;

  // Lock antes del primer envío: si la corrida muere a medias, NO se reintenta sola
  // (un duplicado cuesta más que un faltante); se re-lanza a mano con ?force=1.
  let lockFailed = false;
  try {
    await emailsKv.put(lockKey, JSON.stringify({ started_at: startedIso, eligible: eligible.length, forced: force }));
  } catch (err) {
    lockFailed = true;
    console.error('broadcast:lock-put-failed', err);
  }

  let sent = 0;
  let failed = 0;
  let failedInactive = 0;

  // 4. Envío secuencial con throttling
  for (const rec of eligible) {
    const r = await sendOne(token, rec.email, undefined, blogTitle, blogHook, blogUrl, blogImageUrl);
    if (r === 'ok') sent++;
    else if (r === 'inactive') failedInactive++;
    else failed++;
    await sleep(THROTTLE_MS);
  }

  const finished = Date.now();
  const report: BroadcastReport = {
    blog_slug: post.id,
    blog_title: blogTitle,
    candidates: aud.candidates,
    candidates_by_prefix: aud.candidatesByPrefix,
    unique_emails: aud.uniqueEmails,
    eligible: eligible.length,
    sent,
    failed,
    failed_inactive: failedInactive,
    skipped: aud.candidates - eligible.length,
    excluded: aud.excluded,
    consent: aud.consent,
    drip_unsub_still_sent: aud.dripUnsubStillSent,
    suppression_check: aud.suppressionCheck,
    suppression_errors: aud.suppressionErrors,
    suppression_maybe_truncated: aud.suppressionMaybeTruncated,
    kv_list_calls: aud.kvListCalls,
    kv_list_truncated: aud.kvListTruncated,
    forced: force,
    duration_ms: finished - started,
    started_at: startedIso,
    finished_at: new Date(finished).toISOString(),
  };

  // 5. Registrar reporte para métricas semanales
  try {
    // Sin TTL desde el 30 oct 2026 (antes 90 días): conteos del envío, sin correos. Se conserva la historia.
    await emailsKv.put(`broadcast-report:${startedIso}`, JSON.stringify(report));
  } catch (err) {
    console.error('broadcast:report-persist-failed', err);
  }

  // Aviso a hello@ si algo quedó fuera de lo normal (no frena el envío).
  const problems: string[] = [];
  if (aud.suppressionCheck === 'failed') {
    problems.push(`No se pudo leer la lista de supresiones de Postmark (${aud.suppressionErrors.join('; ')}). Se envió igual; Postmark rechaza a los suprimidos (failed_inactive=${failedInactive}).`);
  }
  if (aud.suppressionMaybeTruncated) problems.push('La lista de supresiones del stream broadcast trajo 500 o más registros: podría venir incompleta.');
  if (lockFailed) problems.push('No se pudo escribir el candado del envío: una segunda corrida manual de este post podría duplicarlo.');
  if (aud.kvListTruncated) problems.push('El listado de KV EMAILS llegó al tope de páginas: parte de la lista no se leyó.');
  if (aud.excluded.legacy_unread > 0) problems.push(`${aud.excluded.legacy_unread} correos legado no se enviaron porque se agotó el tope de ${KV_OP_BUDGET} operaciones KV antes de verificar su país. Toca guardar el país en la metadata de esas llaves (backfill) o cambiar la política.`);
  if (aud.excluded.over_cap > 0) problems.push(`${aud.excluded.over_cap} suscriptores quedaron fuera por el tope de ${MAX_SENDS_PER_RUN} envíos por corrida. Toca pasar a envío por lotes.`);
  if (failed > 0) problems.push(`${failed} envíos fallaron (ver logs broadcast:send-failed).`);
  if (problems.length) {
    await alertOscar(token, `[broadcast] Avisos del envío de ${post.id}`, problems.join('\n\n') + `\n\nReporte: broadcast-report:${startedIso}`);
  }

  console.log('broadcast:done', JSON.stringify(report));
  return jsonResponse(report);
};
