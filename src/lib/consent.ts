/**
 * Consentimiento de privacidad y de correos comerciales · 2 nov 2026.
 *
 * Fuente única de los textos de las casillas (Simulador, Quiz, Revisor de CV) y de las reglas que deciden
 * quién recibe correos comerciales (newsletter Solca Insight, drips de bienvenida, welcome-cv, CTA del
 * welcome-quiz). Propuesta aprobada por Oscar el 2 nov 2026:
 *   ../consultoria/2026-10-30/entregables/ventas/casilla-correos-comerciales.md (§1, §2.6)
 *
 * Reglas:
 * - La casilla de privacidad es obligatoria; la comercial (`marketing`) es opcional y nunca condiciona el servicio.
 * - Ninguna viene premarcada. `marketing` solo cuenta si el cliente manda exactamente `true`.
 * - Un registro con `consent_version` es del formulario nuevo. Uno sin `consent_version` es "legado" (casilla
 *   combinada anterior al 2 nov 2026) y se resuelve con MARKETING_LEGACY_POLICY (wrangler.jsonc).
 * - Dejar la opcional sin marcar en un formulario nuevo NO borra un opt-in anterior de otro formulario.
 * - Las bajas (`unsub:<email>:newsletter|comercial|all`, supresiones de Postmark) se revisan aparte y ganan siempre.
 *
 * Si cambias un texto de casilla, sube CONSENT_VERSION: lo que se guarda tiene que corresponder a lo que se vio.
 */

import { guardarEventoD1 } from './eventos-d1';
import { emailHashFull, type Attribution } from './attribution';

// Historial: v2-2026-11 (2 nov 2026, casillas separadas). v3-2026-11 (6 nov 2026): cambia solo la casilla de
// privacidad del revisor de CV (análisis por correo, aviso de falla y reintento con el CV guardado hasta 48 h);
// los textos de Simulador y Quiz quedan igual. La versión es única para todos los formularios.
// v4-2026-11 (6 nov 2026): se agrega la casilla de CV a la medida (`cv-medida`); las demás quedan igual.
export const CONSENT_VERSION = 'v4-2026-11';

// 'reconfirmacion-es': opt-in desde /api/confirmar-correos (correo único aviso-privacidad-2026-11, legado España).
// 'cv-medida' (6 nov 2026): CV a la medida; el consentimiento se registra al confirmar el pago (webhook).
export type ConsentForm = 'simulador' | 'simulador-pago' | 'quiz' | 'cv' | 'cv-medida' | 'reconfirmacion-es';
export type FormKey = 'simulador' | 'quiz' | 'cv' | 'cv-medida';

export const CONSENT_TEXT: Record<FormKey, { privacidad: string; marketing: string; nota: string }> = {
  simulador: {
    privacidad:
      'He leído el aviso de privacidad y acepto que Solca Ciencia use mi nombre y correo para enviarme mi código de acceso, el reporte de mi sesión y avisos sobre mi cuenta.',
    marketing:
      'Quiero recibir el newsletter semanal Solca Insight y correos con recursos y ofertas de Solca Ciencia (libros, curso y planes del Simulador). Me doy de baja cuando quiera.',
    nota: 'Opcional. Tu sesión funciona igual sin marcarla.',
  },
  quiz: {
    privacidad:
      'He leído el aviso de privacidad y acepto que Solca Ciencia use mi nombre y correo para darme el resultado del quiz y enviármelo por correo.',
    marketing:
      'Quiero recibir 4 correos de bienvenida en las próximas 3 semanas y el newsletter semanal Solca Insight, con recursos y ofertas de libros de Solca Ciencia. Me doy de baja cuando quiera.',
    nota: 'Opcional. El quiz funciona igual sin marcarla.',
  },
  cv: {
    privacidad:
      'He leído el aviso de privacidad y acepto que el texto de mi CV se procese con IA para generar mi análisis. El CV no se guarda; solo si el análisis falla, se conserva hasta 48 horas para reintentarlo y después se borra. Mi correo se usa para enviarme el análisis, avisarme si falla y limitar el número de análisis.',
    marketing:
      'Quiero recibir 4 correos de bienvenida en las próximas 3 semanas y el newsletter semanal Solca Insight, con recursos y ofertas de Solca Ciencia (libros, curso y Simulador). Me doy de baja cuando quiera.',
    nota: 'Opcional. Tu análisis funciona igual sin marcarla.',
  },
  'cv-medida': {
    privacidad:
      'He leído el aviso de privacidad y acepto que el texto de mi CV, la vacante y lo que escriba en el texto libre se procesen con IA para redactar mi CV a la medida. Se guardan hasta 4 días, solo para generar y entregar el documento, y se borran en cuanto el documento está listo. El documento se guarda 7 días para que pueda descargarlo. Mi correo se usa para enviarme el documento y avisos sobre mi compra.',
    marketing:
      'Quiero recibir el newsletter semanal Solca Insight y correos con recursos y ofertas de Solca Ciencia (libros, curso y Simulador). Me doy de baja cuando quiera.',
    nota: 'Opcional. Tu compra funciona igual sin marcarla.',
  },
};

/** Línea común debajo de las dos casillas (corrige B6 del checklist legal). */
export const CONSENT_COMMON =
  'No vendemos ni compartimos tu correo con fines comerciales. Lo procesa nuestro proveedor de envío de correos.';

export const CONSENT_MSG = {
  privacidad_requerida: 'Debes aceptar el aviso de privacidad para continuar.',
  quiz_privacidad_requerida: 'Para ver tu resultado, acepta el aviso de privacidad.',
  simulador_ok: 'Listo. En un momento recibes tu código por correo.',
  quiz_gate_ok: 'Listo. Continúa con el quiz.',
} as const;

/** Texto de la casilla obligatoria con "aviso de privacidad" enlazado. Los textos son constantes de este archivo. */
export function privacidadHtml(form: FormKey): string {
  return CONSENT_TEXT[form].privacidad.replace(
    'aviso de privacidad',
    '<a href="/privacidad" target="_blank" rel="noopener">aviso de privacidad</a>',
  );
}

/** `true` solo si el body trae `marketing: true` (booleano). Cualquier otra cosa es `false`. */
export function readMarketing(body: unknown): boolean {
  return !!body && typeof body === 'object' && (body as Record<string, unknown>).marketing === true;
}

export interface ConsentFields {
  consent_version: string;
  consent_form: ConsentForm;
  privacidad_at: string;
  marketing_optin: boolean;
  marketing_optin_at: string | null;
}

/** Campos que se agregan al registro del lead en KV EMAILS. */
export function consentFields(ts: string, marketing: boolean, form: ConsentForm): ConsentFields {
  return {
    consent_version: CONSENT_VERSION,
    consent_form: form,
    privacidad_at: ts,
    marketing_optin: marketing,
    marketing_optin_at: marketing ? ts : null,
  };
}

/**
 * Metadata de la llave KV (`kv.put(..., { metadata })`). `kv.list` la devuelve sin `get`, así el newsletter
 * decide el consentimiento sin gastar una operación por registro (tope de 1,000 operaciones KV por invocación).
 */
export interface ConsentKvMeta {
  cv: string; // consent_version
  mk: 0 | 1; // marketing_optin
}

export function consentKvMeta(fields: ConsentFields): ConsentKvMeta {
  return { cv: fields.consent_version, mk: fields.marketing_optin ? 1 : 0 };
}

export function readConsentKvMeta(meta: unknown): ConsentKvMeta | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  if (typeof m.cv !== 'string' || !m.cv) return null;
  return { cv: m.cv, mk: m.mk === 1 ? 1 : 0 };
}

// ── Decisión: ¿se le puede mandar un correo comercial a este correo? ──────────────────────────────

export type LegacyPolicy = 'permitir_sin_es' | 'reconfirmar' | 'bloquear';

/**
 * Política para registros legado (sin consent_version). Default `permitir_sin_es` (aprobada el 2 nov 2026).
 * `reconfirmar` todavía no tiene correo de reconfirmación: mientras no exista, se comporta como `bloquear`.
 */
export function legacyPolicy(env: Record<string, unknown> | undefined): LegacyPolicy {
  const v = String(env?.MARKETING_LEGACY_POLICY ?? '').trim();
  return v === 'reconfirmar' || v === 'bloquear' ? v : 'permitir_sin_es';
}

/** Una señal por registro del correo (cualquier formulario). */
export interface ConsentSignal {
  consent_version?: string;
  marketing_optin?: boolean;
  country?: string;
}

export type MarketingDecision =
  | 'optin' // algún registro nuevo con la casilla comercial marcada
  | 'legacy' // solo registros legado y la política los deja pasar
  | 'no_marketing_optin' // registros nuevos sin casilla comercial y ningún legado
  | 'legacy_es' // legado con país España (H4: consentimiento previo y expreso)
  | 'legacy_bloqueado'; // legado y la política es bloquear o reconfirmar

const ES_RE = /^(españa|espana|spain|es)$/i;

export function isSpain(country: unknown): boolean {
  return typeof country === 'string' && ES_RE.test(country.trim());
}

export function decideMarketing(signals: ConsentSignal[], policy: LegacyPolicy): MarketingDecision {
  if (signals.some((s) => !!s.consent_version && s.marketing_optin === true)) return 'optin';
  // Si ya respondió algún formulario nuevo sin marcar la opcional, manda esa respuesta sobre el legado
  // (lo que dice el aviso de privacidad §3: solo si marcaste la casilla).
  if (signals.some((s) => !!s.consent_version)) return 'no_marketing_optin';
  const hasLegacy = signals.some((s) => !s.consent_version);
  if (!hasLegacy) return 'no_marketing_optin';
  if (policy !== 'permitir_sin_es') return 'legacy_bloqueado';
  // Cualquier registro del correo con país España lo saca (los del Simulador no traen país).
  if (signals.some((s) => isSpain(s.country))) return 'legacy_es';
  return 'legacy';
}

export function isMarketingAllowed(d: MarketingDecision): boolean {
  return d === 'optin' || d === 'legacy';
}

/** Bajas en KV que cortan todo lo comercial (las mismas que respeta blog-broadcast). */
export const COMMERCIAL_UNSUB_SCOPES = ['newsletter', 'comercial', 'all'] as const;

// ── Decisión por correo dentro de correos de servicio (ofertas) ────────────────────────────────────

/**
 * Tope de operaciones KV que una ConsentLookup gasta por invocación (índice + lecturas legado).
 * Workers KV permite 1,000 por invocación; el resto queda para el endpoint que la usa.
 */
const LOOKUP_MAX_KV_OPS = 400;
const LOOKUP_MAX_LIST_PAGES = 50; // por prefijo (50k llaves)
const LOOKUP_MAX_LEGACY_GETS_PER_EMAIL = 5;
const ONE_LEAD_KEY_RE = /^(email|quiz|sim):\d{4}-\d{2}-\d{2}T[0-9:.]+Z:(.+)$/;
const ONE_UNSUB_KEY_RE = /^unsub:(.+):([a-z_-]+)$/;

export type OneEmailDecision = MarketingDecision | 'unsub' | 'over_budget' | 'error' | 'sin_kv';
export interface OneEmailResult {
  allowed: boolean;
  decision: OneEmailDecision;
}

interface IndexEntry {
  signals: ConsentSignal[];
  legacyKeys: string[]; // email:/quiz: sin metadata (sim: legado no trae país)
}

/**
 * ¿Se le puede incluir una oferta comercial a un correo? Misma regla que blog-broadcast, pensada para
 * varios destinatarios en una misma invocación (cron):
 * - El índice de KV EMAILS (`email:`/`quiz:`/`sim:` con su metadata `{cv, mk}` y las bajas `unsub:`) se arma
 *   UNA vez por instancia, con `list` paginado (sin `get`): ~4 operaciones por cada 1,000 llaves por prefijo.
 *   Las llaves llevan el correo al final, así que no se puede listar por correo: por eso el mapa en memoria.
 * - Por correo: bajas `unsub:<email>:newsletter|comercial|all` ganan siempre; señales de D1 `consentimientos`
 *   por `email_hash` (marketing = 0 siempre; marketing = 1 si no fue revocado), que cubren al comprador que
 *   dejó la casilla sin marcar en el checkout (Stripe no escribe en KV); `decideMarketing` con la política
 *   legado; y, solo si queda en 'legacy', `get` de sus registros legado para el país (tope por correo).
 * - Tolerante a fallos: si algo falla o se agota el tope de operaciones, `allowed: false` (sin oferta).
 * Crear una instancia por invocación (no a nivel de módulo: el isolate se reutiliza entre requests).
 */
export class ConsentLookup {
  private index: Map<string, IndexEntry> | null = null;
  private unsub: Map<string, Set<string>> | null = null;
  private buildState: 'pending' | 'ok' | 'over_budget' | 'error' = 'pending';
  private building: Promise<void> | null = null;
  ops = 0;

  constructor(
    private kv: KVNamespace | undefined,
    private policy: LegacyPolicy,
    private db?: D1Database,
    private maxOps = LOOKUP_MAX_KV_OPS,
  ) {}

  private async listPrefix(prefix: string, onKey: (name: string, meta: unknown) => void): Promise<boolean> {
    let cursor: string | undefined;
    for (let page = 0; page < LOOKUP_MAX_LIST_PAGES; page++) {
      if (this.ops >= this.maxOps) return false;
      const res = await this.kv!.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
      this.ops++;
      for (const k of res.keys) onKey(k.name, k.metadata);
      if (res.list_complete) return true;
      cursor = (res as { cursor?: string }).cursor;
      if (!cursor) return true;
    }
    return false;
  }

  private async build(): Promise<void> {
    const index = new Map<string, IndexEntry>();
    const unsub = new Map<string, Set<string>>();
    try {
      for (const prefix of ['email:', 'quiz:', 'sim:'] as const) {
        const ok = await this.listPrefix(prefix, (name, metadata) => {
          const m = ONE_LEAD_KEY_RE.exec(name);
          if (!m) return;
          const email = m[2].toLowerCase().trim();
          const e = index.get(email) ?? { signals: [], legacyKeys: [] };
          const meta = readConsentKvMeta(metadata);
          if (meta) e.signals.push({ consent_version: meta.cv, marketing_optin: meta.mk === 1 });
          else {
            e.signals.push({});
            if (prefix !== 'sim:') e.legacyKeys.push(name);
          }
          index.set(email, e);
        });
        if (!ok) {
          this.buildState = 'over_budget';
          return;
        }
      }
      const ok = await this.listPrefix('unsub:', (name) => {
        const m = ONE_UNSUB_KEY_RE.exec(name);
        if (!m) return;
        const email = m[1].toLowerCase().trim();
        const s = unsub.get(email) ?? new Set<string>();
        s.add(m[2]);
        unsub.set(email, s);
      });
      if (!ok) {
        this.buildState = 'over_budget';
        return;
      }
      this.index = index;
      this.unsub = unsub;
      this.buildState = 'ok';
    } catch (err) {
      console.warn('consent: ConsentLookup build failed', String((err as Error)?.message ?? err).slice(0, 200));
      this.buildState = 'error';
    }
  }

  async decide(email: string): Promise<OneEmailResult> {
    const target = (email ?? '').trim().toLowerCase();
    if (!this.kv || !target) return { allowed: false, decision: 'sin_kv' };
    if (this.buildState === 'pending') {
      this.building ??= this.build();
      await this.building;
    }
    if (this.buildState !== 'ok' || !this.index || !this.unsub) {
      return { allowed: false, decision: this.buildState === 'over_budget' ? 'over_budget' : 'error' };
    }
    try {
      const scopes = this.unsub.get(target);
      if (scopes && [...scopes].some((s) => (COMMERCIAL_UNSUB_SCOPES as readonly string[]).includes(s))) {
        return { allowed: false, decision: 'unsub' };
      }
      const entry = this.index.get(target);
      const signals: ConsentSignal[] = [...(entry?.signals ?? [])];
      if (this.db) {
        try {
          const rows = await this.db
            .prepare('SELECT consent_version, marketing, revocado_at FROM consentimientos WHERE email_hash = ? LIMIT 50')
            .bind(await emailHashFull(target))
            .all<{ consent_version: string; marketing: number; revocado_at: string | null }>();
          for (const r of rows.results ?? []) {
            if (!r.consent_version) continue;
            if (Number(r.marketing) === 1) {
              if (!r.revocado_at) signals.push({ consent_version: r.consent_version, marketing_optin: true });
            } else {
              signals.push({ consent_version: r.consent_version, marketing_optin: false });
            }
          }
        } catch {
          // sin D1 o sin migración 0013: se decide solo con KV
        }
      }
      let decision: MarketingDecision = decideMarketing(signals, this.policy);
      if (decision === 'legacy') {
        const keys = entry?.legacyKeys ?? [];
        for (let i = 0; i < keys.length; i++) {
          if (i >= LOOKUP_MAX_LEGACY_GETS_PER_EMAIL || this.ops >= this.maxOps) {
            return { allowed: false, decision: 'over_budget' };
          }
          this.ops++;
          const raw = await this.kv.get(keys[i]);
          let country: string | undefined;
          try {
            country = raw ? (JSON.parse(raw) as { country?: string }).country : undefined;
          } catch {
            country = undefined;
          }
          if (isSpain(country)) {
            decision = 'legacy_es';
            break;
          }
        }
      }
      return { allowed: isMarketingAllowed(decision), decision };
    } catch (err) {
      console.warn('consent: ConsentLookup decide failed', String((err as Error)?.message ?? err).slice(0, 200));
      return { allowed: false, decision: 'error' };
    }
  }
}

/** Un solo correo (arma su propio índice). Para varios en la misma invocación, reutiliza una ConsentLookup. */
export async function marketingDecisionForEmail(
  kv: KVNamespace | undefined,
  email: string,
  policy: LegacyPolicy,
  db?: D1Database,
  lookup?: ConsentLookup,
): Promise<OneEmailResult> {
  return (lookup ?? new ConsentLookup(kv, policy, db)).decide(email);
}

/** Atajo booleano de marketingDecisionForEmail. */
export async function marketingAllowedForEmail(
  kv: KVNamespace | undefined,
  email: string,
  policy: LegacyPolicy,
  db?: D1Database,
  lookup?: ConsentLookup,
): Promise<boolean> {
  return (await marketingDecisionForEmail(kv, email, policy, db, lookup)).allowed;
}

// ── Registro permanente en D1 (migrations/0013_consentimientos.sql) ────────────────────────────────

/**
 * Prueba del consentimiento (qué versión aceptó quién y cuándo) y evento `lead_captured` en `eventos`.
 * Best-effort: nunca lanza. Sin correo: solo el sha256 completo (el mismo de emailHashFull).
 */
export async function registrarConsentimiento(
  db: D1Database | undefined,
  r: {
    ts: string;
    emailHash: string;
    form: ConsentForm;
    marketing: boolean;
    stage?: string;
    attr?: Attribution;
    utms?: Record<string, string | undefined>;
    country?: string | null; // país de la IP (cf-ipcountry), no el del formulario
    consentVersion?: string;
  },
): Promise<void> {
  if (!db) return;
  const tag = r.emailHash.slice(0, 12);
  const version = r.consentVersion ?? CONSENT_VERSION;
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO consentimientos
          (id, ts, dia, email_hash, form, consent_version, privacidad, marketing, interno)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        `${r.form}:${r.ts}:${tag}`,
        r.ts,
        r.ts.slice(0, 10),
        r.emailHash,
        r.form,
        version,
        r.marketing ? 1 : 0,
        r.attr?.interno === true ? 1 : 0,
      )
      .run();
  } catch (err) {
    console.warn('consent: insert consentimientos failed (¿falta migración 0013?)', String((err as Error)?.message ?? err).slice(0, 200));
  }
  await guardarEventoD1(db, `lead:${r.ts}:${tag}:${r.form}`, {
    ts: r.ts,
    event: 'lead_captured',
    product: r.form,
    utm_source: r.utms?.utm_source,
    utm_medium: r.utms?.utm_medium,
    utm_campaign: r.utms?.utm_campaign,
    utm_content: r.utms?.utm_content,
    utm_term: r.utms?.utm_term,
    country: r.country ?? undefined,
    aid: r.attr?.aid,
    ft: r.attr?.ft,
    lt: r.attr?.lt,
    interno: r.attr?.interno === true,
    extra: { form: r.form, marketing: r.marketing ? 1 : 0, consent_version: version, stage: r.stage },
  });
}

/** Marca la revocación comercial en D1 y deja el evento `marketing_revoked`. Best-effort. */
export async function registrarRevocacion(
  db: D1Database | undefined,
  emailHash: string,
  via: string,
  scope: string,
): Promise<void> {
  if (!db) return;
  const ts = new Date().toISOString();
  if (scope !== 'drip') {
    try {
      await db
        .prepare('UPDATE consentimientos SET revocado_at = ? WHERE email_hash = ? AND revocado_at IS NULL')
        .bind(ts, emailHash)
        .run();
    } catch (err) {
      console.warn('consent: update revocado_at failed', String((err as Error)?.message ?? err).slice(0, 200));
    }
  }
  await guardarEventoD1(db, `revoke:${ts}:${emailHash.slice(0, 12)}:${scope}`, {
    ts,
    event: 'marketing_revoked',
    extra: { via, scope },
  });
}
