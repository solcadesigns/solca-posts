/**
 * Servidor del revisor de CV: análisis, cierre de un análisis exitoso, correos y trabajos pendientes · 6 nov 2026.
 *
 * Lo usan /api/cv-review (en el momento) y /api/cv-process-pending (reintentos desde el Cron Trigger de
 * Cloudflare cada 5 minutos, scripts/patch-cron-handler.mjs). Todo va con await: ctx.waitUntil no ejecuta el callback en Astro sobre Workers (oscar-context).
 *
 * Trabajo pendiente (`cvjob:<hash24>` en KV CV_LIMITS): estados, caducidades, reclamo y marca `cvdone:` están
 * documentados en cv-pending.ts. Se crea solo si falla la llamada al modelo o el resultado no sirve.
 */

import { CV_REVIEW_SYSTEM_PROMPT, buildCvReviewUserMessage } from './cv-review-prompt';
import {
  RUBRIC_VERSION,
  ROL_NO_SEGURO,
  rolLabel,
  lineBreakCount,
  parseJsonLenient,
  validateCvReview,
  countByEstado,
  CV_REVIEW_JSON_SCHEMA,
  type CvReviewResult,
  type Estado,
} from './cv-review-rubric';
import { chatCompletion, extractText, AnthropicError, AnthropicRefusalError, HAIKU } from './anthropic';
import { incrementCvSubmitCount } from './rate-limit';
import { sendEmail, sendEmailWithTemplate, PostmarkError } from './postmark';
import type { UtmRecord } from './utm';
import { emailHashFull, type Attribution } from './attribution';
import { guardarEventoD1 } from './eventos-d1';
import { consentFields, consentKvMeta, registrarConsentimiento, CONSENT_VERSION } from './consent';
import { CV_EMAIL_FROM, CV_EMAIL_VERSION, renderCvAnalysisEmail, renderCvApologyEmail } from './cv-review-email';
import { CV_JOB_PREFIX, MOTIVO_TEXTO, nextAttemptAt, type CvJob } from './cv-pending';

type Env = Record<string, unknown>;

// ── Análisis ─────────────────────────────────────────────────────────────────────────────────────

export interface CvAnalysisInput {
  cv: string;
  country?: string;
  rolObjetivo?: string;
  origen: 'pdf' | 'pegado';
  paginas: number | null;
}

export type CvAnalysisOutcome =
  | {
      ok: true;
      result: CvReviewResult;
      parcial: boolean;
      conteos: Record<Estado, number>;
      nAjustes: number;
      outputTokens?: number;
      ms: number;
      usage: unknown;
      /** Modelo que respondió (6 nov 2026: Haiku 5.5, o Haiku 4.5 si entró el respaldo). */
      modelo?: string;
    }
  | {
      ok: false;
      /** 'refusal' (6 nov 2026): rechazo de seguridad del modelo. No se reintenta. */
      status: 'llm_error' | 'parse_error' | 'incomplete_result' | 'refusal';
      httpStatus?: number;
      outputTokens?: number;
      ms: number;
      modelo?: string;
    };

/** Una sola llamada al modelo (sin reintentos internos) + parseo tolerante + validación v2. */
export async function runCvAnalysis(apiKey: string, input: CvAnalysisInput): Promise<CvAnalysisOutcome> {
  const userMessage = buildCvReviewUserMessage({
    cv: input.cv,
    country: input.country,
    rolLabel: rolLabel(input.rolObjetivo),
    rolNoSeguro: input.rolObjetivo === ROL_NO_SEGURO,
    origen: input.origen,
    paginas: input.paginas,
    saltos: lineBreakCount(input.cv),
  });
  const t0 = Date.now();
  let completion;
  try {
    // 6 nov 2026: Haiku 4.5 → Haiku 5.5. Sin temperature ni prefill (400 en 5.5); el JSON lo fija el esquema
    // (salidas estructuradas). Pensamiento adaptive con effort low: es un juicio sobre 20 criterios con citas
    // literales, así que se deja pensar un poco donde lo necesite; low cuida la latencia de la página (85 s).
    // max_tokens 7000 → 12000: ~30% más tokens por el tokenizer nuevo (≈9100) + margen para el pensamiento,
    // que cuenta contra el tope. Si 5.5 falla con 4xx/5xx, el respaldo (lib/anthropic.ts) repite con
    // Haiku 4.5, temperature 0.3, prefill "{" y el tope de antes.
    completion = await chatCompletion({
      apiKey,
      model: HAIKU,
      system: CV_REVIEW_SYSTEM_PROMPT,
      effort: 'low',
      thinking: 'adaptive',
      jsonSchema: CV_REVIEW_JSON_SCHEMA,
      maxTokens: 12000,
      // Solo para el respaldo a Haiku 4.5:
      temperature: 0.3,
      prefill: '{',
      maxTokensRespaldo: 7000,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (err) {
    if (err instanceof AnthropicRefusalError) {
      // 6 nov 2026: el rechazo llega como HTTP 200. Status propio para no encolar un reintento que se volvería
      // a rechazar; quien llama muestra el mensaje genérico y lo registra en cv_attempt.
      console.error('Anthropic refusal', err.body);
      return { ok: false, status: 'refusal', ms: Date.now() - t0, modelo: HAIKU };
    }
    if (err instanceof AnthropicError) console.error('Anthropic error', err.status, err.body);
    else console.error('Unexpected error calling Anthropic', err);
    return {
      ok: false,
      status: 'llm_error',
      httpStatus: err instanceof AnthropicError ? err.status : undefined,
      ms: Date.now() - t0,
    };
  }
  const ms = Date.now() - t0;
  const outputTokens = completion.usage?.output_tokens;
  const modelo = completion.model;
  // Con el esquema, el texto ya es el JSON completo. Solo en el respaldo (prefill "{") hay que anteponerlo;
  // extractText lee los bloques de tipo text, nunca por posición (5.5 puede empezar con bloques de pensamiento).
  const jsonString = (completion.prefill ?? '') + extractText(completion).trim();
  const parsedLenient = parseJsonLenient(jsonString);
  if (!parsedLenient) {
    console.error('LLM returned non-JSON:', jsonString.slice(0, 300));
    return { ok: false, status: 'parse_error', outputTokens, ms, modelo };
  }
  const validated = validateCvReview(parsedLenient.value, {
    cv: input.cv,
    origen: input.origen,
    paginas: input.paginas,
    rolObjetivo: input.rolObjetivo,
  });
  if (!validated) {
    console.error('LLM returned malformed structure');
    return { ok: false, status: 'incomplete_result', outputTokens, ms, modelo };
  }
  if (Object.keys(validated.report.issues).length) {
    console.log('cv-review:ajustes', JSON.stringify({ ...validated.report.issues, reparado: parsedLenient.repaired }));
  }
  return {
    ok: true,
    result: validated.result,
    parcial: validated.report.parcial || parsedLenient.repaired,
    conteos: countByEstado(validated.result.observaciones),
    nAjustes: Object.values(validated.report.issues).reduce((a, b) => a + b, 0),
    outputTokens,
    ms,
    usage: completion.usage,
    modelo,
  };
}

// ── Cierre de un análisis exitoso (en el momento o en el reintento) ─────────────────────────────

export interface CvLeadContext {
  email: string;
  country?: string;
  ip: string | null;
  utms: UtmRecord;
  referrer?: string;
  attr: Attribution;
  marketing: boolean;
  /** País de la IP (cf-ipcountry) al momento del formulario. */
  ipCountry?: string | null;
  /** Versión del texto que la persona aceptó (la del formulario, aunque el cierre sea en un reintento). */
  consentVersion?: string;
  /** Fecha en que aceptó (la del formulario). */
  consentTs?: string;
}

async function storeCvLead(kv: KVNamespace | undefined, c: CvLeadContext, ts: string): Promise<void> {
  const consent = consentFields(c.consentTs ?? ts, c.marketing, 'cv');
  if (c.consentVersion) consent.consent_version = c.consentVersion;
  const record = {
    email: c.email.toLowerCase().trim(),
    country: c.country?.toLowerCase().trim(),
    ip: c.ip,
    ts,
    ...(c.referrer ? { referrer: c.referrer } : {}),
    ...c.utms,
    // 30 oct 2026 (P2): llave de unión con ventas (sha256 completo) + aid/ft/lt/interno.
    email_hash: await emailHashFull(c.email),
    ...c.attr,
    // 2 nov 2026: versión del texto aceptado, fecha y casilla comercial (src/lib/consent.ts).
    ...consent,
  };
  if (kv && typeof kv.put === 'function') {
    try {
      // Metadata con el consentimiento para que blog-broadcast lo lea con `list`, sin `get`.
      await kv.put(`email:${record.ts}:${record.email}`, JSON.stringify(record), { metadata: consentKvMeta(consent) });
    } catch (err) {
      console.error('KV put failed:', err);
    }
  } else {
    console.log('cv-review:email-captured', JSON.stringify(record));
  }
}

/** welcome-solca-insight rama is_cv (comercial): solo con la casilla opcional marcada. */
async function sendWelcomeCv(token: string | undefined, email: string, firstName: string | undefined): Promise<void> {
  if (!token) {
    console.log('cv-review:postmark-skipped (no POSTMARK_SERVER_TOKEN)');
    return;
  }
  try {
    const result = await sendEmailWithTemplate(token, {
      from: CV_EMAIL_FROM,
      to: email,
      templateAlias: 'welcome-solca-insight',
      templateModel: { first_name: firstName ?? '', is_cv: true, is_quiz: false, role_label: '' },
      tag: 'welcome-cv',
      metadata: { source: 'cv-review' },
    });
    console.log('cv-review:postmark-sent', result.messageId, result.to);
  } catch (err) {
    if (err instanceof PostmarkError) console.error('Postmark send failed:', err.status, JSON.stringify(err.body));
    else console.error('Postmark unexpected error:', err);
  }
}

/**
 * Correo de servicio con el análisis (stream outbound). Nunca lanza: una falla de correo no tumba el análisis.
 * Devuelve true si Postmark lo aceptó.
 */
export async function sendCvAnalysisEmail(
  token: string | undefined,
  email: string,
  result: CvReviewResult,
  opts: { rolFormulario?: string; marketing: boolean; reintento: boolean },
): Promise<boolean> {
  if (!token) {
    console.log('cv-review:analysis-email-skipped (no POSTMARK_SERVER_TOKEN)');
    return false;
  }
  try {
    const r = renderCvAnalysisEmail(result, opts);
    await sendEmail(token, {
      from: CV_EMAIL_FROM,
      to: email,
      subject: r.subject,
      htmlBody: r.html,
      textBody: r.text,
      tag: opts.reintento ? 'cv-analisis-reintento' : 'cv-analisis',
      metadata: { version: CV_EMAIL_VERSION, rubric: result.rubric_version, marketing: opts.marketing ? '1' : '0' },
      messageStream: 'outbound',
    });
    return true;
  } catch (err) {
    if (err instanceof PostmarkError) console.error('cv analysis email failed:', err.status, JSON.stringify(err.body));
    else console.error('cv analysis email unexpected error:', err);
    return false;
  }
}

/**
 * Todo lo que pasa después de un análisis válido, en orden y con await: lead + consentimiento, welcome comercial
 * (solo con casilla), contador del límite por correo y correo con el análisis. Nada de esto cambia la respuesta.
 */
export async function finalizeCvSuccess(
  env: Env,
  c: CvLeadContext,
  result: CvReviewResult,
  opts: { rolFormulario?: string; reintento: boolean; sendAnalysisEmail?: boolean },
): Promise<{ emailSent: boolean }> {
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  const leadTs = new Date().toISOString();
  await storeCvLead(env.EMAILS as KVNamespace | undefined, c, leadTs).catch((err) => console.error('storeCvLead failed', err));
  // 2 nov 2026: prueba del consentimiento + evento lead_captured en D1 (permanente, sin correo).
  await registrarConsentimiento(db, {
    ts: leadTs,
    emailHash: await emailHashFull(c.email),
    form: 'cv',
    marketing: c.marketing,
    attr: c.attr,
    utms: c.utms,
    country: c.ipCountry ?? null,
    consentVersion: c.consentVersion,
  });
  if (c.marketing) {
    // Postmark solo usa el primer nombre; candidateName puede venir completo.
    await sendWelcomeCv(token, c.email, result.candidateName?.trim().split(/\s+/)[0]).catch((err) =>
      console.error('sendWelcomeCv failed', err),
    );
  }
  // El contador también sirve de prueba para /api/cv-waitlist (este correo hizo un análisis en 30 días).
  await incrementCvSubmitCount(env.CV_LIMITS as KVNamespace | undefined, c.email).catch((err) =>
    console.error('incrementCvSubmitCount failed', err),
  );
  // En el reintento el correo sale ANTES (cv-pending.ts) y aquí no se repite.
  if (opts.sendAnalysisEmail === false) return { emailSent: false };
  const emailSent = await sendCvAnalysisEmail(token, c.email, result, {
    rolFormulario: opts.rolFormulario,
    marketing: c.marketing,
    reintento: opts.reintento,
  });
  return { emailSent };
}

// ── Trabajos pendientes ─────────────────────────────────────────────────────────────────────────

// Tipos, estados, caducidades y el procesador del cron viven en cv-pending.ts (puro, probado offline).
export { CV_JOB_PREFIX, CV_MAX_ATTEMPTS, saveCvJob, markCvDone, type CvJob } from './cv-pending';

export async function cvJobKey(email: string): Promise<string> {
  return `${CV_JOB_PREFIX}${(await emailHashFull(email)).slice(0, 24)}`;
}

export function newCvJob(
  base: Omit<CvJob, 'v' | 'state' | 'createdAt' | 'attempts' | 'nextAt' | 'privacidad' | 'consentVersion' | 'cvLength'>,
  now = Date.now(),
): CvJob {
  return {
    v: 1,
    state: 'pending',
    cvLength: base.cv.length,
    createdAt: new Date(now).toISOString(),
    attempts: 1, // el intento original que falló
    nextAt: nextAttemptAt(1, now),
    privacidad: true,
    consentVersion: CONSENT_VERSION,
    ...base,
  };
}

export function jobLeadContext(job: CvJob): CvLeadContext {
  return {
    email: job.email,
    country: job.country,
    ip: job.ip,
    utms: job.utms,
    referrer: job.referrer,
    attr: job.attr,
    marketing: job.marketing,
    ipCountry: job.ipCountry,
    consentVersion: job.consentVersion,
    consentTs: job.consentTs,
  };
}

/** Disculpa a la persona después del último intento. Nunca lanza. */
export async function sendCvApology(token: string | undefined, email: string): Promise<boolean> {
  if (!token) return false;
  try {
    const r = renderCvApologyEmail();
    await sendEmail(token, {
      from: CV_EMAIL_FROM,
      to: email,
      subject: r.subject,
      htmlBody: r.html,
      textBody: r.text,
      tag: 'cv-analisis-fallo',
      metadata: { version: CV_EMAIL_VERSION },
      messageStream: 'outbound',
    });
    return true;
  } catch (err) {
    console.error('cv apology email failed', err);
    return false;
  }
}

/** Aviso a Oscar, como las alertas del simulador (hello@ → hello@). Nunca lanza. Sin texto del CV ni resultado. */
export async function alertCvFailure(
  token: string | undefined,
  job: CvJob,
  motivo: string,
  apologySent: boolean,
): Promise<boolean> {
  if (!token) return false;
  const titulo: Record<string, string> = {
    analisis: `Análisis fallido tras ${job.attempts} intentos`,
    correo: 'Análisis generado pero el correo no salió',
    pausa: 'Trabajo cerrado por kill switch',
  };
  try {
    await sendEmail(token, {
      from: 'hello@solcaciencia.com',
      to: 'hello@solcaciencia.com',
      subject: `[CV checker] ${titulo[motivo] ?? 'Trabajo pendiente cerrado'}`,
      textBody: [
        MOTIVO_TEXTO[motivo] ?? `Motivo: ${motivo}`,
        ``,
        `correo: ${job.email}`,
        `intento (cv_attempt.extra.intento): ${job.intento}`,
        `creado: ${job.createdAt}`,
        `intentos de análisis (incluido el original): ${job.attempts}`,
        `intentos de envío del correo con el análisis: ${job.sendAttempts ?? 0}`,
        `último estado: ${job.lastStatus}`,
        `rol: ${job.rolObjetivo ?? 'sin rol'} · origen: ${job.origen} · largo del CV: ${job.cvLength}`,
        `disculpa enviada a la persona: ${apologySent ? 'sí' : 'no'}`,
        ``,
        `El texto del CV ya se borró. Si varios fallan el mismo día, revisa el modelo, el prompt, Postmark o el kill switch antes de responder caso por caso.`,
      ].join('\n'),
      tag: 'cv-retry-failed',
      metadata: { intento: job.intento, motivo, attempts: String(job.attempts) },
    });
    return true;
  } catch {
    return false;
  }
}

// ── Evento cv_attempt en D1 (sin texto del CV ni correo) ────────────────────────────────────────

export interface CvAttemptCtx {
  attemptTs: string;
  intento: string;
  referrer?: string;
  ipCountry?: string | null;
  attr: Attribution;
  utms: UtmRecord;
  country?: string;
  cvLength: number;
  rolObjetivo?: string;
  origen: 'pdf' | 'pegado';
  paginas: number | null;
}

export interface CvAttemptRec {
  status: string;
  outputTokens?: number;
  ms?: number;
  parcial?: boolean;
  conteos?: Record<Estado, number>;
  nAjustes?: number;
  /** Número de intento de análisis (1 = el original en la página). Solo en estados del reintento. */
  intentoN?: number;
  /** El correo (análisis o disculpa) salió. Solo en estados finales. */
  correo?: boolean;
  /** Modelo que respondió (6 nov 2026, migración a Haiku 5.5 con respaldo a 4.5). */
  modelo?: string;
}

export async function recordCvAttemptD1(db: D1Database | undefined, ctx: CvAttemptCtx, rec: CvAttemptRec): Promise<void> {
  const status = String(rec.status || 'desconocido').slice(0, 30);
  await guardarEventoD1(db, `cvat:${ctx.attemptTs}:${ctx.intento}:${status}`, {
    ts: new Date().toISOString(),
    event: 'cv_attempt',
    utm_source: ctx.utms.utm_source,
    utm_medium: ctx.utms.utm_medium,
    utm_campaign: ctx.utms.utm_campaign,
    utm_content: ctx.utms.utm_content,
    utm_term: ctx.utms.utm_term,
    referrer: ctx.referrer,
    country: ctx.ipCountry ?? undefined, // país de la IP (Cloudflare), como en eventos
    ...ctx.attr,
    extra: {
      status,
      pais_form: ctx.country ? ctx.country.slice(0, 40) : undefined, // país elegido en el formulario
      cv_length: ctx.cvLength,
      output_tokens: rec.outputTokens,
      intento: ctx.intento, // une started con su resultado; prefijo de 12 caracteres del hash, no el correo
      // 6 nov 2026 (rúbrica v2): rol del formulario, origen del texto y conteos por estado. Sin texto del CV.
      rubric_version: RUBRIC_VERSION,
      rol_objetivo: ctx.rolObjetivo,
      origen: ctx.origen,
      paginas: ctx.paginas ?? undefined,
      ms: rec.ms,
      parcial: rec.parcial,
      n_prioritario: rec.conteos?.prioritario,
      n_mejorable: rec.conteos?.mejorable,
      n_solido: rec.conteos?.solido,
      n_no_evaluable: rec.conteos?.no_evaluable,
      n_ajustes: rec.nAjustes,
      intento_n: rec.intentoN,
      correo: rec.correo === undefined ? undefined : rec.correo ? 1 : 0,
      modelo: rec.modelo ? rec.modelo.slice(0, 40) : undefined,
    },
  });
}

export function jobAttemptCtx(job: CvJob): CvAttemptCtx {
  return {
    attemptTs: job.attemptTs,
    intento: job.intento,
    referrer: job.referrer,
    ipCountry: job.ipCountry,
    attr: job.attr,
    utms: job.utms,
    country: job.country,
    cvLength: job.cvLength ?? job.cv.length,
    rolObjetivo: job.rolObjetivo,
    origen: job.origen,
    paginas: job.paginas,
  };
}

/** Registro `attempt:` en KV EMAILS (lleva correo; 180 días, ver aviso de privacidad §5). */
export async function putAttemptKv(kv: KVNamespace | undefined, key: string, record: Record<string, unknown>): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 180 });
  } catch (err) {
    console.error('attempt put failed', err);
  }
}
