/**
 * CV a la medida · cola de trabajos (6 nov 2026). Mismo patrón que src/lib/cv-pending.ts (reclamo con claimId,
 * estado de cierre, tope de intentos, caducidad absoluta), procesado desde el Cron Trigger `*\/5 * * * *` que ya
 * existe (scripts/patch-cron-handler.mjs llama a /api/cv-process-pending y después a /api/cv-medida-process).
 *
 * Archivo puro: el endpoint inyecta KV, modelo, DOCX, correos y eventos; `node scripts/test-cv-medida.mjs` inyecta
 * dobles en memoria.
 *
 * Llaves en KV CV_LIMITS:
 *   cvmd:<jobId>       el trabajo. Caducidad absoluta: 4 días desde que se envió el formulario.
 *   cvmdq:<jobId>      marca de cola (sin datos personales): la escribe el webhook al confirmar el pago. El cron
 *                      lista solo este prefijo, así los checkouts abandonados no tapan a los pagados.
 *   cvmd_docx:<id>     el DOCX (base64) para el enlace de descarga, 7 días. Solo los bytes, el nombre del archivo
 *                      y el idioma y rol para el evento de descarga.
 *   cvmd_pi:<pi>       payment_intent → id del trabajo (sin datos personales), para cancelar la entrega si Stripe
 *                      avisa un reembolso antes de generar (charge.refunded).
 *
 * Estados del trabajo:
 *   esperando_pago  lleva CV, vacante y texto libre. El cron no lo toca.
 *   pagado          igual, más los datos del pago. Espera la generación (máximo CVM_MAX_ATTEMPTS).
 *   enviar          el DOCX ya existe; el CV, la vacante y el texto libre se borraron. Guarda correo, CV redactado
 *                   y resumen de coincidencia para el correo: caducidad absoluta de 6 h desde la generación.
 *   cerrando        sin textos ni resultado (solo correo, datos del pago e id de descarga); reintenta con espera
 *                   creciente la disculpa a la persona y el aviso a Oscar. No se borra mientras el aviso no salga,
 *                   salvo a las 24 h (error en logs y evento cvmedida_falla con alerta 'no_enviada').
 * Al entregar o al terminar el cierre se borra primero la marca de cola y después el trabajo: si la invocación muere
 * entre los dos, queda un trabajo sin marca (caduca solo) y nunca una marca sin trabajo (falso aviso de "caducado").
 */

import type { Attribution } from './attribution.ts';
import type { CvMedida, CvmReporte, Idioma, CvmRol } from './cv-medida.ts';
import { CVM_JOB_TTL_S, CVM_DOCX_TTL_S } from './cv-medida.ts';

export const CVM_JOB_PREFIX = 'cvmd:';
export const CVM_QUEUE_PREFIX = 'cvmdq:';
export const CVM_DOCX_PREFIX = 'cvmd_docx:';
/** Intentos de generación (modelo + validación + DOCX). */
export const CVM_MAX_ATTEMPTS = 3;
export const CVM_MAX_SEND_ATTEMPTS = 3;
/** `enviar`: caducidad absoluta de 6 h desde la generación (lo que dice el aviso de privacidad). */
export const CVM_ENVIAR_TTL_S = 60 * 60 * 6;
/** `cerrando`: se reintenta hasta 24 h; el registro caduca 1 h después como red de seguridad. */
export const CVM_CIERRE_TOPE_MS = 24 * 60 * 60_000;
const CVM_CIERRE_TTL_S = 25 * 60 * 60;
/** Espera entre intentos del cierre: 5, 10, 20, 40 y luego 60 min. */
const CIERRE_BACKOFF_MS = [5, 10, 20, 40, 60].map((m) => m * 60_000);
/** Avisos de "caducado" fallidos antes de soltar la marca (con error en logs). */
export const CVM_MAX_AVISOS_CADUCADO = 5;
/**
 * Un paso reclamado no se toma de nuevo antes de esto. Peor caso de una corrida del cron (cv-medida-run.ts):
 * cv-process-pending antes (~85 s) + generación en streaming con tope de 300 s + DOCX y correo (~15 s) ≈ 400 s.
 * 10 min deja margen; el cron programado puede durar hasta 15 min.
 */
export const CVM_LEASE_MS = 10 * 60_000;
/** Espera antes de cada reintento de generación (índice = intentos ya hechos). El cron corre cada 5 min. */
const BACKOFF_MS = [0, 4 * 60_000, 10 * 60_000];
const SEND_BACKOFF_MS = 4 * 60_000;
/** Con el kill switch puesto, el trabajo se cierra si le quedan menos de 6 h antes de caducar. */
const MARGEN_PAUSA_MS = 6 * 60 * 60_000;

export type CvmEstado = 'esperando_pago' | 'pagado' | 'enviar' | 'cerrando';

export interface CvmResultado {
  rol: CvmRol;
  puesto: string;
  cv: CvMedida; // solo para el correo (resumen de coincidencia); se borra al entregar
  reporte: CvmReporte;
  downloadId: string;
  nombreArchivo: string;
  docxBytes: number;
}

export interface CvmJob {
  v: 1;
  id: string;
  estado: CvmEstado;
  createdAt: string;
  /** Epoch en segundos: caducidad absoluta (createdAt + 4 días). */
  expiresAt: number;
  claimId?: string;
  attempts: number;
  nextAt: string;
  lastStatus: string;
  // Lo que mandó la persona (vacío desde `enviar`)
  email: string;
  cv: string;
  vacante: string;
  textoLibre: string;
  cvLength: number;
  vacanteLength: number;
  textoLibreLength: number;
  origen: 'pdf' | 'pegado';
  paginas: number | null;
  idioma: Idioma;
  // Consentimiento y atribución
  privacidad: true;
  marketing: boolean;
  consentVersion: string;
  consentTs: string;
  attr: Attribution;
  interno: boolean;
  /** 11 nov 2026: lista clasificada de la comparación (si la persona pasó por ella) y de dónde llegó. */
  requisitos?: Array<{ requisito: string; prioridad: 'indispensable' | 'deseable' }>;
  ref?: string;
  // Pago
  stripeSessionId?: string;
  paymentIntent?: string;
  paidAt?: string;
  livemode?: boolean;
  /** Monto 0 (cupón al 100%): se trata como prueba interna en ventas y eventos. */
  montoCero?: boolean;
  // Generación
  generadoAt?: string;
  /** Se conservan en el cierre (sin el CV redactado) para el aviso a Oscar y los eventos. */
  descargaId?: string;
  rol?: CvmRol;
  resultado?: CvmResultado;
  modelo?: string;
  outputTokens?: number;
  ms?: number;
  sendAttempts?: number;
  emailSent?: boolean;
  // Cierre
  motivo?: string;
  closeStartedAt?: string;
  closeAttempts?: number;
  apologySent?: boolean;
  alertSent?: boolean;
}

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expiration?: number; expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; limit?: number }): Promise<{ keys: Array<{ name: string }> }>;
}

export function jobKey(id: string): string {
  return CVM_JOB_PREFIX + id;
}
export function queueKey(id: string): string {
  return CVM_QUEUE_PREFIX + id;
}
export function docxKey(id: string): string {
  return CVM_DOCX_PREFIX + id;
}
export const CVM_PI_PREFIX = 'cvmd_pi:';
export function piKey(pi: string): string {
  return CVM_PI_PREFIX + pi;
}

export function nuevoTrabajo(
  base: Omit<CvmJob, 'v' | 'estado' | 'createdAt' | 'expiresAt' | 'attempts' | 'nextAt' | 'lastStatus' | 'privacidad' | 'cvLength' | 'vacanteLength' | 'textoLibreLength'>,
  now = Date.now(),
): CvmJob {
  return {
    v: 1,
    estado: 'esperando_pago',
    createdAt: new Date(now).toISOString(),
    expiresAt: Math.floor(now / 1000) + CVM_JOB_TTL_S,
    attempts: 0,
    nextAt: new Date(now).toISOString(),
    lastStatus: 'creado',
    privacidad: true,
    cvLength: base.cv.length,
    vacanteLength: base.vacante.length,
    textoLibreLength: base.textoLibre.length,
    ...base,
  };
}

/** Caducidad absoluta del registro según su estado (epoch en segundos). Nunca se extiende al reescribir. */
export function caducidadTrabajo(job: CvmJob, now = Date.now()): number {
  const seg = (iso: string | undefined) => Math.floor((Date.parse(iso ?? '') || now) / 1000);
  if (job.estado === 'enviar') return Math.min(job.expiresAt + CVM_ENVIAR_TTL_S, seg(job.generadoAt) + CVM_ENVIAR_TTL_S);
  if (job.estado === 'cerrando') return seg(job.closeStartedAt) + CVM_CIERRE_TTL_S;
  return job.expiresAt; // esperando_pago y pagado: 4 días desde el formulario
}

export async function guardarTrabajo(kv: KvLike, job: CvmJob, now = Date.now()): Promise<void> {
  const ahora = Math.floor(now / 1000);
  await kv.put(jobKey(job.id), JSON.stringify(job), { expiration: Math.max(caducidadTrabajo(job, now), ahora + 60) });
}

export async function leerTrabajo(kv: KvLike, id: string): Promise<CvmJob | null> {
  const raw = await kv.get(jobKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CvmJob;
  } catch {
    return null;
  }
}

/** Primero la marca de cola, después el trabajo (ver el encabezado). */
export async function borrarTodo(kv: KvLike, id: string): Promise<void> {
  await kv.delete(queueKey(id));
  await kv.delete(jobKey(id));
}

// ── Pago (lo llama el webhook) ──────────────────────────────────────────────────────────────────

export interface DatosPago {
  stripeSessionId: string;
  paymentIntent?: string;
  livemode: boolean;
  /** amount_total === 0 (cupón al 100%). */
  montoCero?: boolean;
}

export type ResultadoPago =
  | { estado: 'encolado'; job: CvmJob }
  | { estado: 'ya_pagado'; job: CvmJob }
  | { estado: 'sin_datos' };

/**
 * Marca el trabajo como pagado y lo encola. Idempotente: un segundo aviso del mismo pago no reinicia los intentos.
 * `sin_datos`: el trabajo caducó o no existe; quien llama manda la disculpa y el aviso de reembolso.
 */
export async function marcarPagado(kv: KvLike, id: string, pago: DatosPago, now = Date.now()): Promise<ResultadoPago> {
  if (!id) return { estado: 'sin_datos' };
  const job = await leerTrabajo(kv, id);
  if (!job) return { estado: 'sin_datos' };
  if (job.estado !== 'esperando_pago') return { estado: 'ya_pagado', job };
  const pagado: CvmJob = {
    ...job,
    estado: 'pagado',
    stripeSessionId: pago.stripeSessionId,
    paymentIntent: pago.paymentIntent,
    livemode: pago.livemode,
    montoCero: pago.montoCero === true,
    interno: job.interno || pago.montoCero === true,
    paidAt: new Date(now).toISOString(),
    nextAt: new Date(now).toISOString(),
    lastStatus: 'pagado',
  };
  await guardarTrabajo(kv, pagado, now);
  // La marca dura hasta 2 días después de la caducidad del trabajo: si el trabajo desaparece, el cron lo detecta.
  const ahora = Math.floor(now / 1000);
  await kv.put(queueKey(id), JSON.stringify({ s: pago.stripeSessionId, at: pagado.paidAt }), {
    expiration: Math.max(job.expiresAt + 2 * 86400, ahora + 60),
  });
  if (pago.paymentIntent) {
    await kv.put(piKey(pago.paymentIntent), id, { expiration: Math.max(job.expiresAt + 2 * 86400, ahora + 60) });
  }
  return { estado: 'encolado', job: pagado };
}

export type ResultadoReembolso =
  | { estado: 'cancelado'; job: CvmJob }
  | { estado: 'ya_generado'; job: CvmJob }
  | { estado: 'sin_pedido' };

/**
 * charge.refunded: si el pedido aún no se generó (pagado), se borran el trabajo y su marca para que no se entregue.
 * Si ya se generó o entregó, no se toca (el reembolso solo queda en `ventas`).
 */
export async function cancelarPorReembolso(kv: KvLike, paymentIntent: string): Promise<ResultadoReembolso> {
  if (!paymentIntent) return { estado: 'sin_pedido' };
  const id = await kv.get(piKey(paymentIntent));
  if (!id) return { estado: 'sin_pedido' };
  const job = await leerTrabajo(kv, id);
  if (!job) {
    await kv.delete(piKey(paymentIntent));
    return { estado: 'sin_pedido' };
  }
  if (job.estado !== 'pagado') return { estado: 'ya_generado', job };
  await borrarTodo(kv, id);
  await kv.delete(piKey(paymentIntent));
  return { estado: 'cancelado', job };
}

// ── Procesador ──────────────────────────────────────────────────────────────────────────────────

export type Generacion =
  | { ok: true; cv: CvMedida; reporte: CvmReporte; modelo?: string; outputTokens?: number; ms: number }
  | { ok: false; status: string; modelo?: string; outputTokens?: number; ms: number };

export interface ProcesadorDeps {
  kv: KvLike;
  paused: boolean;
  now: () => number;
  newId: () => string;
  generar: (job: CvmJob) => Promise<Generacion>;
  construirDocx: (cv: CvMedida) => Promise<{ base64: string; bytes: number; nombre: string }>;
  /** Correo con el DOCX adjunto y el resumen de coincidencia. true si Postmark lo aceptó. Nunca lanza. */
  enviarEntrega: (job: CvmJob, docxBase64: string) => Promise<boolean>;
  enviarDisculpa: (job: CvmJob) => Promise<boolean>;
  /** Aviso a Oscar para reembolsar a mano. Nunca lanza. */
  alertar: (job: CvmJob | null, motivo: string, apologySent: boolean, extra?: Record<string, string>) => Promise<boolean>;
  /** Evento cvmedida_* en D1 (sin texto ni correo). Nunca lanza. */
  registrar: (evento: string, job: CvmJob, extra?: Record<string, string | number | boolean | undefined>) => Promise<void>;
  /** 11 nov 2026: programa la encuesta de resultado a 14 días (src/lib/encuesta-resultado.ts). Nunca lanza. */
  programarEncuesta?: (job: CvmJob) => Promise<void>;
}

export interface ResultadoCorrida {
  processed: number;
  status: string;
  job?: string;
}

export const CVM_MOTIVO_TEXTO: Record<string, string> = {
  generacion: 'El CV no se pudo generar en ninguno de los intentos.',
  correo: 'El CV sí se generó, pero el correo con el documento no salió después de varios intentos. El enlace de descarga sigue vivo 7 días.',
  pausa: 'El kill switch anthropic_paused estuvo puesto hasta casi la caducidad del trabajo (4 días) y se cerró sin generar.',
  caducado: 'El pago llegó, pero los datos del pedido ya no estaban (caducaron a los 4 días o el pedido no existe).',
};

async function stillOurs(kv: KvLike, id: string, claimId: string): Promise<boolean> {
  const fresh = await leerTrabajo(kv, id);
  return !!fresh && fresh.claimId === claimId;
}

async function iniciarCierre(d: ProcesadorDeps, job: CvmJob, motivo: string): Promise<ResultadoCorrida> {
  const cierre: CvmJob = {
    ...job,
    estado: 'cerrando',
    cv: '',
    vacante: '',
    textoLibre: '',
    // Sin CV redactado ni resumen: solo el id de descarga (para el aviso a Oscar) y el rol (para el evento).
    resultado: undefined,
    descargaId: job.descargaId ?? job.resultado?.downloadId,
    rol: job.rol ?? job.resultado?.rol,
    motivo,
    closeStartedAt: new Date(d.now()).toISOString(),
    closeAttempts: 0,
    apologySent: false,
    alertSent: false,
    nextAt: new Date(d.now()).toISOString(),
  };
  await guardarTrabajo(d.kv, cierre, d.now());
  return terminarCierre(d, cierre);
}

async function terminarCierre(d: ProcesadorDeps, job: CvmJob): Promise<ResultadoCorrida> {
  job.closeAttempts = (job.closeAttempts ?? 0) + 1;
  await guardarTrabajo(d.kv, job, d.now());
  if (!job.apologySent) {
    job.apologySent = await d.enviarDisculpa(job);
    await guardarTrabajo(d.kv, job, d.now());
  }
  if (!job.alertSent) {
    job.alertSent = await d.alertar(job, job.motivo ?? 'generacion', !!job.apologySent);
    await guardarTrabajo(d.kv, job, d.now());
  }
  if (job.apologySent && job.alertSent) {
    await d.registrar('cvmedida_falla', job, { motivo: job.motivo, correo: true, alerta: 'enviada' });
    await borrarTodo(d.kv, job.id);
    return { processed: 1, status: `falla · ${job.motivo}`, job: job.id };
  }
  const inicio = Date.parse(job.closeStartedAt ?? '') || d.now();
  if (d.now() - inicio >= CVM_CIERRE_TOPE_MS) {
    // Tope de 24 h: se suelta el registro, pero queda el rastro para reembolsar a mano.
    console.error(
      `cv-medida: cierre abandonado tras 24 h · sesión de Stripe ${job.stripeSessionId ?? 'n/a'} · aviso a Oscar ${job.alertSent ? 'sí' : 'NO'} · disculpa ${job.apologySent ? 'sí' : 'no'}`,
    );
    await d.registrar('cvmedida_falla', job, {
      motivo: job.motivo,
      correo: !!job.apologySent,
      alerta: job.alertSent ? 'enviada' : 'no_enviada',
      stripe_session: job.stripeSessionId,
    });
    await borrarTodo(d.kv, job.id);
    return { processed: 1, status: `falla_sin_aviso · ${job.motivo}`, job: job.id };
  }
  const espera = CIERRE_BACKOFF_MS[Math.min((job.closeAttempts ?? 1) - 1, CIERRE_BACKOFF_MS.length - 1)];
  job.nextAt = new Date(d.now() + espera).toISOString();
  await guardarTrabajo(d.kv, job, d.now());
  return { processed: 1, status: 'cierre_incompleto', job: job.id };
}

async function procesarEnvio(d: ProcesadorDeps, job: CvmJob, claimId: string): Promise<ResultadoCorrida> {
  const res = job.resultado;
  const b64 = res ? await d.kv.get(docxKey(res.downloadId)) : null;
  if (!res || !b64) return iniciarCierre(d, job, 'correo');
  let docxBase64 = b64;
  try {
    docxBase64 = (JSON.parse(b64) as { b64: string }).b64;
  } catch {
    /* valor viejo: base64 directo */
  }
  job.sendAttempts = (job.sendAttempts ?? 0) + 1;
  job.nextAt = new Date(d.now() + CVM_LEASE_MS).toISOString();
  await guardarTrabajo(d.kv, job, d.now());
  const sent = await d.enviarEntrega(job, docxBase64);
  if (!(await stillOurs(d.kv, job.id, claimId))) return { processed: 1, status: 'abortado_reclamo', job: job.id };
  if (!sent) {
    if ((job.sendAttempts ?? 0) >= CVM_MAX_SEND_ATTEMPTS) return iniciarCierre(d, job, 'correo');
    job.nextAt = new Date(d.now() + SEND_BACKOFF_MS).toISOString();
    await guardarTrabajo(d.kv, job, d.now());
    return { processed: 1, status: `correo_reprogramado · ${job.sendAttempts}`, job: job.id };
  }
  job.emailSent = true;
  // 11 nov 2026: antes de borrar el pedido se programa la encuesta de 14 días (guarda solo correo, puesto y encaje).
  if (d.programarEncuesta) await d.programarEncuesta(job);
  // Entregado: se borra el pedido (correo y resumen de coincidencia). Queda solo el DOCX, 7 días.
  await borrarTodo(d.kv, job.id);
  await d.registrar('cvmedida_entregado', job, { envios: job.sendAttempts });
  return { processed: 1, status: 'entregado', job: job.id };
}

/** Una corrida del cron: como máximo una generación (o un envío o un cierre). */
export async function procesarCvMedidaUnaVez(d: ProcesadorDeps, listLimit = 50): Promise<ResultadoCorrida> {
  const list = await d.kv.list({ prefix: CVM_QUEUE_PREFIX, limit: listLimit });
  for (const k of list.keys) {
    const id = k.name.slice(CVM_QUEUE_PREFIX.length);
    const job = await leerTrabajo(d.kv, id);
    const now = d.now();
    if (!job) {
      // Pago confirmado sin datos (caducaron): aviso a Oscar con el id de la sesión de Stripe y se suelta la marca.
      // Si el aviso falla, se cuenta en la marca y se sigue con la cola: una marca rota nunca la bloquea.
      const rawMarca = await d.kv.get(k.name);
      if (rawMarca === null) continue; // la marca ya se borró (lista desfasada)
      let marca: { s?: string; at?: string; n?: number } = {};
      try {
        marca = JSON.parse(rawMarca);
      } catch {
        /* marca ilegible */
      }
      const ok = await d.alertar(null, 'caducado', false, { job: id, stripe_session: marca.s ?? '' });
      if (ok) {
        await d.kv.delete(k.name);
        return { processed: 1, status: 'caducado', job: id };
      }
      const n = (marca.n ?? 0) + 1;
      if (n >= CVM_MAX_AVISOS_CADUCADO) {
        console.error(`cv-medida: aviso de pedido caducado no salió tras ${n} intentos · sesión de Stripe ${marca.s ?? 'n/a'} · trabajo ${id}`);
        await d.kv.delete(k.name);
      } else {
        await d.kv.put(k.name, JSON.stringify({ ...marca, n }), { expiration: Math.floor(now / 1000) + 2 * 86400 });
      }
      continue;
    }
    if (job.estado === 'esperando_pago') continue; // marca escrita antes de tiempo: no debería pasar
    if (Date.parse(job.nextAt) > now) continue;
    if (job.estado === 'cerrando') return terminarCierre(d, job);

    if (job.estado === 'enviar') {
      const claimId = d.newId();
      job.claimId = claimId;
      await guardarTrabajo(d.kv, job, now);
      return procesarEnvio(d, job, claimId);
    }

    // pagado
    if (job.attempts >= CVM_MAX_ATTEMPTS) return iniciarCierre(d, job, 'generacion');
    if (d.paused) {
      if (job.expiresAt * 1000 - now < MARGEN_PAUSA_MS) return iniciarCierre(d, job, 'pausa');
      continue;
    }
    // Reclamo e intento sumado ANTES de gastar tokens (cuenta aunque la invocación muera).
    const claimId = d.newId();
    job.claimId = claimId;
    job.attempts += 1;
    job.nextAt = new Date(now + CVM_LEASE_MS).toISOString();
    await guardarTrabajo(d.kv, job, now);

    const g = await d.generar(job);
    if (!(await stillOurs(d.kv, job.id, claimId))) return { processed: 1, status: 'abortado_reclamo', job: job.id };
    job.modelo = g.modelo;
    job.outputTokens = g.outputTokens;
    job.ms = g.ms;

    let fallo = g.ok ? '' : g.status;
    let docx: { base64: string; bytes: number; nombre: string } | null = null;
    if (g.ok) {
      try {
        docx = await d.construirDocx(g.cv);
      } catch (err) {
        console.error('cv-medida: DOCX falló', String(err).slice(0, 200));
        fallo = 'docx_error';
      }
    }
    if (!g.ok || !docx) {
      job.lastStatus = fallo;
      if (job.attempts >= CVM_MAX_ATTEMPTS || fallo === 'refusal') return iniciarCierre(d, job, 'generacion');
      job.nextAt = new Date(d.now() + (BACKOFF_MS[Math.min(job.attempts, BACKOFF_MS.length - 1)] ?? 0)).toISOString();
      await guardarTrabajo(d.kv, job, d.now());
      return { processed: 1, status: `reintento · intento ${job.attempts} · ${fallo}`, job: job.id };
    }

    const cv = (g as Extract<Generacion, { ok: true }>).cv;
    const reporte = (g as Extract<Generacion, { ok: true }>).reporte;
    const downloadId = d.newId().replace(/-/g, '') + d.newId().replace(/-/g, '').slice(0, 8);
    await d.kv.put(
      docxKey(downloadId),
      JSON.stringify({ b64: docx.base64, nombre: docx.nombre, job: job.id, idioma: job.idioma, rol: cv.rol, interno: job.interno ? 1 : 0 }),
      { expirationTtl: CVM_DOCX_TTL_S },
    );
    // El CV, la vacante y el texto libre se borran en cuanto el documento existe.
    const enviar: CvmJob = {
      ...job,
      estado: 'enviar',
      cv: '',
      vacante: '',
      textoLibre: '',
      lastStatus: 'generado',
      generadoAt: new Date(d.now()).toISOString(),
      descargaId: downloadId,
      rol: cv.rol,
      sendAttempts: 0,
      emailSent: false,
      resultado: { rol: cv.rol, puesto: cv.puesto_vacante, cv, reporte, downloadId, nombreArchivo: docx.nombre, docxBytes: docx.bytes },
    };
    await guardarTrabajo(d.kv, enviar, d.now());
    await d.registrar('cvmedida_generado', enviar, {
      intento_n: job.attempts,
      docx_bytes: docx.bytes,
      vinetas: reporte.vinetas_total,
      quitadas: reporte.vinetas_quitadas_cita + reporte.vinetas_quitadas_cifra + reporte.vinetas_quitadas_sigla,
      relleno: reporte.vinetas_quitadas_relleno,
      tercera_persona: reporte.frases_tercera_persona,
      titular_quitado: reporte.titular_quitado,
      resumen_vacio_tercera: reporte.resumen_vacio_tercera,
      busqueda: reporte.frases_busqueda,
      adjetivos: reporte.adjetivos_quitados,
      marcadores_quitados: reporte.marcadores_quitados,
      marcadores: reporte.marcadores.length,
      sin_evidencia: reporte.requisitos_sin_evidencia,
    });
    return procesarEnvio(d, enviar, claimId);
  }
  return { processed: 0, status: d.paused ? 'pausado' : 'sin_trabajos_listos' };
}
