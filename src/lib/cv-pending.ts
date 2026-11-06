/**
 * Trabajos pendientes del revisor de CV y su procesador · 6 nov 2026 (bloque B, con correcciones de la revisión
 * independiente del mismo día).
 *
 * Archivo puro: no importa nada de runtime. El endpoint /api/cv-process-pending le inyecta KV, modelo, correos y
 * eventos; el script `node scripts/test-cv-review.mjs` le inyecta dobles en memoria para probar carreras y fallas.
 *
 * Llave única por correo: `cvjob:<hash24>` en KV CV_LIMITS. Estados:
 *   - pending: lleva el texto del CV; espera reintento del análisis (máximo CV_MAX_ATTEMPTS en total, contando el
 *     intento original en la página). Caduca 48 h después de creado (tope de la casilla de privacidad).
 *   - send: el análisis ya salió; el texto del CV se borró y solo queda el resultado (caducidad corta) hasta que el
 *     correo con el análisis salga. El análisis solo se cuenta (lead, consentimiento, contador) después del correo.
 *   - closing: sin CV ni resultado; falta mandar la disculpa y el aviso a Oscar. Si la invocación muere a medias,
 *     la siguiente corrida termina el cierre sin repetir lo que ya salió.
 * Marca `cvdone:<hash24>` (unos minutos): la escribe /api/cv-review cuando el análisis le sale bien a la persona en
 * la página. Si es posterior a la creación del trabajo, el trabajo quedó obsoleto: el cron no manda otro correo, no
 * registra otro lead, no cuenta dos veces y no vuelve a escribir el texto viejo del CV.
 * Reclamo (`claimId`): antes de cada paso que gasta o escribe, el cron relee el trabajo y aborta si el reclamo
 * cambió (otra corrida, o la persona creó un trabajo nuevo) o si el trabajo ya no existe.
 */

import type { CvReviewResult } from './cv-review-rubric.ts';
import type { UtmRecord } from './utm.ts';
import type { Attribution } from './attribution.ts';

export const CV_JOB_PREFIX = 'cvjob:';
export const CV_DONE_PREFIX = 'cvdone:';
/** Intentos de análisis en total, contando el original que falló en la página. */
export const CV_MAX_ATTEMPTS = 3;
/** Intentos de enviar el correo con un análisis ya hecho. */
export const CV_MAX_SEND_ATTEMPTS = 3;
/** Intentos de terminar un cierre (disculpa + aviso) antes de soltar el registro. */
export const CV_MAX_CLOSE_ATTEMPTS = 3;
/** 48 h: tope prometido en la casilla de privacidad para el texto del CV. */
export const CV_JOB_TTL_S = 60 * 60 * 48;
/** Caducidad de los estados sin CV (send, closing). */
export const CV_SHORT_TTL_S = 60 * 60 * 6;
/** Duración de la marca cvdone. */
export const CV_DONE_TTL_S = 60 * 10;
/** Espera mínima antes de cada reintento del análisis (índice = intentos ya hechos). El cron corre cada 5 min. */
const BACKOFF_MS = [0, 4 * 60_000, 10 * 60_000];
/** Espera entre intentos de envío del correo. */
const SEND_BACKOFF_MS = 4 * 60_000;
/** Un paso reclamado no se toma de nuevo antes de esto (dos corridas que se encimen). */
export const LEASE_MS = 3 * 60_000;
/** Si el kill switch dura casi todo el TTL, se cierra el trabajo antes de que KV lo borre sin avisar. */
const MAX_AGE_MS = 46 * 60 * 60_000;

export type CvJobState = 'pending' | 'send' | 'closing';

export interface CvJob {
  v: 1;
  state?: CvJobState; // sin estado = pending (trabajos creados antes de esta versión)
  claimId?: string;
  createdAt: string;
  attempts: number;
  nextAt: string;
  lastStatus: string;
  /** Llave KV `attempt:` (EMAILS, 180 días) del intento original, para actualizar su estado. */
  attemptKey: string;
  attemptTs: string;
  /** Prefijo de 12 caracteres del hash del correo: une los cv_attempt del mismo intento. */
  intento: string;
  // Datos del análisis. `cv` queda vacío fuera de pending.
  cv: string;
  cvLength: number;
  rolObjetivo?: string;
  origen: 'pdf' | 'pegado';
  paginas: number | null;
  // Resultado (solo en send)
  result?: CvReviewResult;
  parcial?: boolean;
  outputTokens?: number;
  ms?: number;
  /** Modelo que hizo el análisis (6 nov 2026: Haiku 5.5 o el respaldo Haiku 4.5). */
  modelo?: string;
  sendAttempts?: number;
  emailSent?: boolean;
  // Cierre
  motivo?: string;
  closeAttempts?: number;
  apologySent?: boolean;
  alertSent?: boolean;
  // Persona y consentimiento (lo que aceptó en el formulario)
  email: string;
  country?: string;
  privacidad: true;
  marketing: boolean;
  consentVersion: string;
  consentTs: string;
  // Atribución para el registro del lead
  ip: string | null;
  ipCountry?: string | null;
  utms: UtmRecord;
  referrer?: string;
  attr: Attribution;
}

/** Subconjunto de KVNamespace que usa el procesador (los dobles de prueba lo implementan con un Map). */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expiration?: number; expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; limit?: number }): Promise<{ keys: Array<{ name: string }> }>;
}

export function nextAttemptAt(attemptsDone: number, now = Date.now()): string {
  return new Date(now + (BACKOFF_MS[Math.min(attemptsDone, BACKOFF_MS.length - 1)] ?? 0)).toISOString();
}

export function jobState(job: CvJob): CvJobState {
  return job.state ?? 'pending';
}

/**
 * Guarda el trabajo. Con CV (pending): caducidad absoluta de 48 h desde que se creó, aunque se reescriba.
 * Sin CV (send, closing): la menor entre esas 48 h y CV_SHORT_TTL_S desde ahora.
 */
export async function saveCvJob(kv: KvLike, key: string, job: CvJob, now = Date.now()): Promise<void> {
  const created = Date.parse(job.createdAt);
  let exp = Math.floor((Number.isFinite(created) ? created : now) / 1000) + CV_JOB_TTL_S;
  if (jobState(job) !== 'pending') exp = Math.min(exp, Math.floor(now / 1000) + CV_SHORT_TTL_S);
  // KV pide al menos 60 s hacia adelante.
  const expiration = Math.max(exp, Math.floor(now / 1000) + 60);
  await kv.put(key, JSON.stringify(job), { expiration });
}

export function doneKeyFor(jobKey: string): string {
  return CV_DONE_PREFIX + jobKey.slice(CV_JOB_PREFIX.length);
}

/** Marca que el análisis de este correo salió bien en la página (lo llama /api/cv-review). */
export async function markCvDone(kv: KvLike, jobKey: string, now = Date.now()): Promise<void> {
  await kv.put(doneKeyFor(jobKey), new Date(now).toISOString(), { expirationTtl: CV_DONE_TTL_S });
}

async function isObsolete(kv: KvLike, key: string, job: CvJob): Promise<boolean> {
  const done = await kv.get(doneKeyFor(key));
  return !!done && Date.parse(done) >= Date.parse(job.createdAt);
}

async function readJob(kv: KvLike, key: string): Promise<CvJob | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CvJob;
  } catch {
    return null;
  }
}

/** Relee y confirma que el trabajo sigue siendo nuestro (mismo reclamo) y no quedó obsoleto. */
async function stillOurs(kv: KvLike, key: string, claimId: string): Promise<boolean> {
  const fresh = await readJob(kv, key);
  if (!fresh || fresh.claimId !== claimId) return false;
  return !(await isObsolete(kv, key, fresh));
}

export type AnalysisOutcome =
  | { ok: true; result: CvReviewResult; parcial: boolean; outputTokens?: number; ms: number; modelo?: string; extra?: Record<string, unknown> }
  | { ok: false; status: string; outputTokens?: number; ms: number; modelo?: string };

export interface ProcessorDeps {
  kv: KvLike;
  paused: boolean;
  now: () => number;
  newId: () => string;
  analyze: (job: CvJob) => Promise<AnalysisOutcome>;
  /** Correo con el análisis. true si Postmark lo aceptó. Nunca lanza. */
  sendAnalysis: (job: CvJob, result: CvReviewResult) => Promise<boolean>;
  /** Lead, consentimiento, welcome (con casilla) y contador. Solo después de que el correo salió. */
  finalize: (job: CvJob, result: CvReviewResult) => Promise<void>;
  sendApology: (job: CvJob) => Promise<boolean>;
  /** Aviso a Oscar con el motivo real. Nunca lanza. */
  alert: (job: CvJob, motivo: string, apologySent: boolean) => Promise<boolean>;
  /** Evento cv_attempt (sin texto del CV ni correo) + registro `attempt:` en KV. */
  record: (job: CvJob, status: string, extra?: Record<string, unknown>) => Promise<void>;
}

export interface ProcessResult {
  processed: number;
  status: string;
  job?: string;
}

/** Motivos del cierre, en palabras para el aviso a Oscar. */
export const MOTIVO_TEXTO: Record<string, string> = {
  analisis: 'El análisis no se pudo generar en ninguno de los intentos.',
  correo: 'El análisis sí se generó, pero el correo con el análisis no salió después de varios intentos. El análisis no se contó para el límite de la persona y el resultado ya se borró.',
  pausa: 'El kill switch anthropic_paused estuvo puesto casi 48 h y el trabajo se cerró sin reintentar.',
};

async function startClosing(d: ProcessorDeps, key: string, job: CvJob, motivo: string): Promise<ProcessResult> {
  const closing: CvJob = {
    ...job,
    state: 'closing',
    cv: '', // el texto del CV se borra antes de avisar
    result: undefined,
    motivo,
    closeAttempts: 0,
    apologySent: false,
    alertSent: false,
    nextAt: new Date(d.now()).toISOString(),
  };
  await saveCvJob(d.kv, key, closing, d.now());
  return finishClosing(d, key, closing);
}

async function finishClosing(d: ProcessorDeps, key: string, job: CvJob): Promise<ProcessResult> {
  job.closeAttempts = (job.closeAttempts ?? 0) + 1;
  await saveCvJob(d.kv, key, job, d.now());
  if (!job.apologySent) {
    job.apologySent = await d.sendApology(job);
    await saveCvJob(d.kv, key, job, d.now());
  }
  if (!job.alertSent) {
    job.alertSent = await d.alert(job, job.motivo ?? 'analisis', !!job.apologySent);
    await saveCvJob(d.kv, key, job, d.now());
  }
  if ((job.apologySent && job.alertSent) || (job.closeAttempts ?? 0) >= CV_MAX_CLOSE_ATTEMPTS) {
    await d.record(job, 'retry_failed', { motivo: job.motivo, correo: !!job.apologySent });
    await d.kv.delete(key);
    return { processed: 1, status: `retry_failed · ${job.motivo}`, job: key };
  }
  return { processed: 1, status: 'closing_incompleto', job: key };
}

async function processSend(d: ProcessorDeps, key: string, job: CvJob, claimId: string): Promise<ProcessResult> {
  const result = job.result;
  if (!result) return startClosing(d, key, job, 'correo');
  if (!job.emailSent) {
    job.sendAttempts = (job.sendAttempts ?? 0) + 1;
    job.nextAt = new Date(d.now() + LEASE_MS).toISOString();
    await saveCvJob(d.kv, key, job, d.now());
    const sent = await d.sendAnalysis(job, result);
    if (!(await stillOurs(d.kv, key, claimId))) return { processed: 1, status: 'abortado_reclamo', job: key };
    if (!sent) {
      if ((job.sendAttempts ?? 0) >= CV_MAX_SEND_ATTEMPTS) return startClosing(d, key, job, 'correo');
      job.nextAt = new Date(d.now() + SEND_BACKOFF_MS).toISOString();
      await saveCvJob(d.kv, key, job, d.now());
      return { processed: 1, status: `correo_reprogramado · ${job.sendAttempts}`, job: key };
    }
    job.emailSent = true;
    await saveCvJob(d.kv, key, job, d.now());
  }
  // Solo con el correo enviado se cuenta el análisis. El trabajo se borra antes de contar: el correo ya
  // salió y no queda CV, así que una corrida cortada o encimada no vuelve a registrar el lead ni a sumar.
  await d.kv.delete(key);
  await d.finalize(job, result);
  await d.record(job, 'retry_ok', { correo: true, envios: job.sendAttempts });
  return { processed: 1, status: 'retry_ok', job: key };
}

/** Una corrida del cron: procesa como máximo un trabajo. */
export async function processCvPendingOnce(d: ProcessorDeps, listLimit = 20): Promise<ProcessResult> {
  const list = await d.kv.list({ prefix: CV_JOB_PREFIX, limit: listLimit });
  for (const k of list.keys) {
    const key = k.name;
    const job = await readJob(d.kv, key);
    if (!job) continue;
    const now = d.now();
    const state = jobState(job);

    if (await isObsolete(d.kv, key, job)) {
      // La persona lo resolvió en la página: nada de correo, lead ni conteo; el texto viejo se borra.
      await d.kv.delete(key);
      await d.record(job, 'retry_superseded');
      return { processed: 1, status: 'superseded', job: key };
    }
    if (state === 'closing') return finishClosing(d, key, job);
    if (Date.parse(job.nextAt) > now) continue;

    if (state === 'send') {
      const claimId = d.newId();
      job.claimId = claimId;
      await saveCvJob(d.kv, key, job, now);
      return processSend(d, key, job, claimId);
    }

    // pending
    if (job.attempts >= CV_MAX_ATTEMPTS) return startClosing(d, key, job, 'analisis');
    if (d.paused) {
      if (now - Date.parse(job.createdAt) > MAX_AGE_MS) return startClosing(d, key, job, 'pausa');
      continue;
    }
    // Reclamo + intento sumado ANTES de gastar tokens (cuenta aunque la invocación muera).
    const claimId = d.newId();
    job.claimId = claimId;
    job.attempts += 1;
    job.nextAt = new Date(now + LEASE_MS).toISOString();
    await saveCvJob(d.kv, key, job, now);

    const outcome = await d.analyze(job);
    if (!(await stillOurs(d.kv, key, claimId))) {
      // Otra corrida lo tomó, la persona creó un trabajo nuevo o ya le salió en la página: no se escribe nada.
      return { processed: 1, status: 'abortado_reclamo', job: key };
    }
    if (outcome.ok) {
      // El texto del CV se borra en cuanto hay análisis; queda solo el resultado hasta que salga el correo.
      const sendJob: CvJob = {
        ...job,
        state: 'send',
        cv: '',
        result: outcome.result,
        parcial: outcome.parcial,
        outputTokens: outcome.outputTokens,
        ms: outcome.ms,
        modelo: outcome.modelo,
        sendAttempts: 0,
        emailSent: false,
        lastStatus: 'analisis_ok',
      };
      await saveCvJob(d.kv, key, sendJob, d.now());
      return processSend(d, key, sendJob, claimId);
    }
    job.lastStatus = outcome.status;
    // 6 nov 2026: un rechazo de seguridad no se reintenta (se volvería a rechazar): se cierra con la disculpa.
    if (job.attempts >= CV_MAX_ATTEMPTS || outcome.status === 'refusal') return startClosing(d, key, job, 'analisis');
    job.nextAt = nextAttemptAt(job.attempts, d.now());
    await saveCvJob(d.kv, key, job, d.now());
    return { processed: 1, status: `reintento_programado · intento ${job.attempts} · ${outcome.status}`, job: key };
  }
  return { processed: 0, status: d.paused ? 'pausado' : 'sin_trabajos_listos' };
}
