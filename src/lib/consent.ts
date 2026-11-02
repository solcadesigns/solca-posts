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
import type { Attribution } from './attribution';

export const CONSENT_VERSION = 'v2-2026-11';

export type ConsentForm = 'simulador' | 'simulador-pago' | 'quiz' | 'cv';
export type FormKey = 'simulador' | 'quiz' | 'cv';

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
      'He leído el aviso de privacidad y acepto que el texto de mi CV se procese con IA para generar mi análisis. El CV no se guarda: se procesa y se descarta. Mi correo se usa para limitar el número de análisis y para avisarme si el mío falla.',
    marketing:
      'Quiero recibir 4 correos de bienvenida en las próximas 3 semanas y el newsletter semanal Solca Insight, con recursos y ofertas de Solca Ciencia (libros, curso y Simulador). Me doy de baja cuando quiera.',
    nota: 'Opcional. Tu análisis funciona igual sin marcarla.',
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
