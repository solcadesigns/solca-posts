/**
 * CV a la medida · servidor (6 nov 2026): generación con Sonnet 5.5, correos, aviso a Oscar, eventos D1 y el paso del
 * webhook al confirmar el pago. La lógica de estados vive en cv-medida-queue.ts (puro, probado offline).
 * Todo con await: ctx.waitUntil no ejecuta el callback en Astro sobre Workers.
 */

import { chatCompletionStream, extractText, AnthropicError, AnthropicRefusalError, type AnthropicResponse } from './anthropic';
import { registrarModeloD1, guardarEventoD1 } from './eventos-d1';
import { sendEmail } from './postmark';
import { emailHashFull, type Attribution } from './attribution';
import { registrarConsentimiento, consentFields, consentKvMeta } from './consent';
import {
  CVM_SYSTEM_PROMPT,
  CVM_PROMPT_VERSION,
  CVM_PRODUCTO,
  mensajeUsuario,
  parsearJson,
  validarCvMedida,
  conteoCoincidencia,
} from './cv-medida';
import { construirDocx as docxBytes, nombreArchivo, aBase64 } from './cv-medida-docx';
import { CVM_EMAIL_FROM, CVM_EMAIL_VERSION, renderEntrega, renderDisculpa, enlaceDescarga } from './cv-medida-email';
import {
  CVM_MOTIVO_TEXTO,
  marcarPagado,
  cancelarPorReembolso,
  leerTrabajo,
  borrarTodo,
  type CvmJob,
  type Generacion,
  type KvLike,
  type ProcesadorDeps,
} from './cv-medida-queue';
import { CVM_DOCX_TTL_S } from './cv-medida';

type Env = Record<string, unknown>;

/** Modelo de redacción (mismo id que el simulador). Respaldo temporal a Sonnet 4.5 si 5.5 responde 400/404. */
export const CVM_MODEL = 'claude-sonnet-5-5';
const CVM_MODEL_RESPALDO = 'claude-sonnet-4-5';
/**
 * Tiempos (revisión 6 nov 2026). Un CV largo puede pedir ~12k tokens de salida; a 50-80 tokens/s son 150-240 s.
 * Con streaming, Anthropic manda bytes desde el inicio y nada corta la conexión por inactividad; el tope propio
 * es CVM_TIMEOUT_MS (300 s). La corrida del cron: cv-process-pending antes (~85 s) + generación (≤ 300 s) + DOCX
 * y correo (~15 s) ≈ 400 s, debajo del reclamo de 10 min (CVM_LEASE_MS en cv-medida-queue.ts) y del límite de
 * 15 min de un Cron Trigger. Si el respaldo entra, usa solo el tiempo que sobra de los 300 s.
 */
const CVM_TIMEOUT_MS = 300_000;
const CVM_MAX_TOKENS = 16_000;
const ALERT_FROM = 'hello@solcaciencia.com';
const ALERT_TO = 'hello@solcaciencia.com';

// ── Generación ──────────────────────────────────────────────────────────────────────────────────

export async function generarCvMedida(apiKey: string, job: CvmJob, db: D1Database | undefined): Promise<Generacion> {
  const t0 = Date.now();
  let resp: AnthropicResponse;
  const opciones = {
    apiKey,
    model: CVM_MODEL,
    system: CVM_SYSTEM_PROMPT,
    messages: [{ role: 'user' as const, content: mensajeUsuario({ cv: job.cv, vacante: job.vacante, textoLibre: job.textoLibre, idioma: job.idioma }) }],
    maxTokens: CVM_MAX_TOKENS,
    timeoutMs: CVM_TIMEOUT_MS,
  };
  try {
    // Un solo intento por corrida: los reintentos los cuenta la cola (máximo 3).
    try {
      resp = await chatCompletionStream(opciones);
    } catch (err) {
      const restante = CVM_TIMEOUT_MS - (Date.now() - t0);
      if (!(err instanceof AnthropicError) || err instanceof AnthropicRefusalError || ![400, 404].includes(err.status) || restante < 30_000) throw err;
      console.warn(`[anthropic-fallback] cv_medida: ${CVM_MODEL} respondió ${err.status}; reintento con ${CVM_MODEL_RESPALDO}`);
      resp = await chatCompletionStream({ ...opciones, model: CVM_MODEL_RESPALDO, timeoutMs: restante });
      resp.respaldo = true;
      resp.statusRespaldo = err.status;
    }
  } catch (err) {
    const refusal = err instanceof AnthropicRefusalError;
    await registrarModeloD1(db, {
      ruta: 'cv_medida',
      ok: false,
      modeloPedido: CVM_MODEL,
      error: refusal ? 'refusal' : err instanceof AnthropicError ? err.status : 'desconocido',
      sessionId: job.id,
      esPrueba: job.interno,
    });
    if (!refusal) console.error('cv-medida: Anthropic falló', err instanceof AnthropicError ? err.status : String(err).slice(0, 200));
    return { ok: false, status: refusal ? 'refusal' : 'llm_error', ms: Date.now() - t0, modelo: CVM_MODEL };
  }
  if (resp.stop_reason === 'max_tokens') console.warn('cv-medida: la respuesta llegó al tope de tokens', resp.usage?.output_tokens);
  const ms = Date.now() - t0;
  const outputTokens = resp.usage?.output_tokens;
  await registrarModeloD1(db, {
    ruta: 'cv_medida',
    ok: true,
    modeloPedido: CVM_MODEL,
    modelo: resp.model,
    respaldo: Boolean(resp.respaldo),
    statusRespaldo: resp.statusRespaldo,
    outputTokens,
    ms,
    sessionId: job.id,
    esPrueba: job.interno,
  });
  const parsed = parsearJson(extractText(resp));
  if (!parsed) return { ok: false, status: 'parse_error', ms, outputTokens, modelo: resp.model };
  const v = validarCvMedida(parsed, { cv: job.cv, textoLibre: job.textoLibre, idioma: job.idioma, vacante: job.vacante });
  if (!v.ok) {
    console.warn('cv-medida: validación falló', v.motivo);
    return { ok: false, status: `invalido_${v.motivo}`.slice(0, 40), ms, outputTokens, modelo: resp.model };
  }
  return { ok: true, cv: v.cv, reporte: v.reporte, ms, outputTokens, modelo: resp.model };
}

// ── Correos ─────────────────────────────────────────────────────────────────────────────────────

function fechaVence(now = Date.now()): string {
  return new Date(now + CVM_DOCX_TTL_S * 1000).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });
}

export async function enviarEntregaCvMedida(token: string | undefined, job: CvmJob, docxBase64: string): Promise<boolean> {
  const res = job.resultado;
  if (!token || !res) return false;
  try {
    const r = renderEntrega(res.cv, res.reporte, { downloadId: res.downloadId, venceEl: fechaVence() });
    await sendEmail(token, {
      from: CVM_EMAIL_FROM,
      to: job.email,
      subject: r.subject,
      htmlBody: r.html,
      textBody: r.text,
      tag: 'cv-medida-entrega',
      metadata: { version: CVM_EMAIL_VERSION, job: job.id.slice(0, 12) },
      messageStream: 'outbound',
      attachments: [
        {
          Name: res.nombreArchivo,
          Content: docxBase64,
          ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ],
    });
    return true;
  } catch (err) {
    console.error('cv-medida: correo de entrega falló', String(err).slice(0, 200));
    return false;
  }
}

export async function enviarDisculpaCvMedida(token: string | undefined, email: string): Promise<boolean> {
  if (!token || !email) return false;
  try {
    const r = renderDisculpa();
    await sendEmail(token, {
      from: CVM_EMAIL_FROM,
      to: email,
      subject: r.subject,
      htmlBody: r.html,
      textBody: r.text,
      tag: 'cv-medida-fallo',
      metadata: { version: CVM_EMAIL_VERSION },
      messageStream: 'outbound',
    });
    return true;
  } catch (err) {
    console.error('cv-medida: disculpa falló', String(err).slice(0, 200));
    return false;
  }
}

/** Aviso a Oscar para reembolsar a mano (mismo patrón que alertCvFailure). Sin CV, vacante ni texto libre. */
export async function alertarCvMedida(
  token: string | undefined,
  job: CvmJob | null,
  motivo: string,
  apologySent: boolean,
  extra: Record<string, string> = {},
): Promise<boolean> {
  if (!token) return false;
  const lineas = [
    CVM_MOTIVO_TEXTO[motivo] ?? `Motivo: ${motivo}`,
    '',
    'ACCIÓN: reembolsar a mano en Stripe (Payments → buscar la sesión o el correo → Refund). No hay reembolso automático.',
    '',
    `correo: ${job?.email ?? 'no disponible (buscar en Stripe con la sesión)'}`,
    `sesión de Stripe: ${job?.stripeSessionId ?? extra.stripe_session ?? 'n/a'}`,
    `payment_intent: ${job?.paymentIntent ?? 'n/a'}`,
    `trabajo: ${job?.id ?? extra.job ?? 'n/a'}`,
    `creado: ${job?.createdAt ?? 'n/a'} · pagado: ${job?.paidAt ?? 'n/a'}`,
    `intentos de generación: ${job?.attempts ?? 0} · intentos de correo: ${job?.sendAttempts ?? 0}`,
    `último estado: ${job?.lastStatus ?? 'n/a'} · modelo: ${job?.modelo ?? 'n/a'}`,
    `idioma: ${job?.idioma ?? 'n/a'} · origen: ${job?.origen ?? 'n/a'} · interno: ${job?.interno ? 'sí' : 'no'}`,
    `disculpa enviada a la persona: ${apologySent ? 'sí' : 'no'}`,
    ...((job?.descargaId ?? job?.resultado?.downloadId) ? [`enlace de descarga (7 días): ${enlaceDescarga((job?.descargaId ?? job?.resultado?.downloadId) as string)}`] : []),
    '',
    'El CV, la vacante y el texto libre ya se borraron.',
  ];
  try {
    await sendEmail(token, {
      from: ALERT_FROM,
      to: ALERT_TO,
      subject: `[CV a la medida] Reembolsar · ${motivo}`,
      textBody: lineas.join('\n'),
      tag: 'cv-medida-alerta',
      metadata: { motivo, job: (job?.id ?? extra.job ?? '').slice(0, 12) },
    });
    return true;
  } catch {
    return false;
  }
}

// ── Eventos D1 (sin correo ni texto) ────────────────────────────────────────────────────────────

export async function registrarEventoCvm(
  db: D1Database | undefined,
  evento: string,
  base: { jobId: string; idioma?: string; rol?: string; modelo?: string; attr?: Attribution; interno?: boolean; country?: string | null },
  extra: Record<string, string | number | boolean | undefined> = {},
): Promise<void> {
  const ts = new Date().toISOString();
  await guardarEventoD1(db, `cvmd:${base.jobId.slice(0, 16)}:${evento}:${ts}`, {
    ts,
    event: evento,
    product: CVM_PRODUCTO,
    country: base.country ?? undefined,
    aid: base.attr?.aid,
    ft: base.attr?.ft,
    lt: base.attr?.lt,
    interno: base.interno === true || base.attr?.interno === true,
    extra: {
      job: base.jobId.slice(0, 16),
      idioma: base.idioma,
      rol: base.rol,
      modelo: base.modelo ? base.modelo.slice(0, 40) : undefined,
      prompt: CVM_PROMPT_VERSION,
      ...extra,
    },
  });
}

/** Rol en la fila de `ventas` (columna de la migración 0014). Best-effort: sin migración no pasa nada. */
async function rolEnVenta(db: D1Database | undefined, job: CvmJob): Promise<void> {
  const rol = job.rol ?? job.resultado?.rol;
  if (!db || !job.stripeSessionId || !rol) return;
  try {
    await db.prepare('UPDATE ventas SET rol = ?, actualizado = ? WHERE id = ?').bind(rol, new Date().toISOString(), job.stripeSessionId).run();
  } catch (err) {
    console.warn('cv-medida: rol en ventas no guardado (¿falta migración 0014?)', String(err).slice(0, 160));
  }
}

// ── Dependencias del procesador (las usa /api/cv-medida-process) ─────────────────────────────────

export function depsProcesador(env: Env, kv: KvLike, paused: boolean): ProcesadorDeps {
  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  const apiKey = env.ANTHROPIC_API_KEY as string | undefined;
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  return {
    kv,
    paused,
    now: () => Date.now(),
    newId: () => crypto.randomUUID(),
    generar: async (job) => (apiKey ? generarCvMedida(apiKey, job, db) : { ok: false, status: 'sin_api_key', ms: 0 }),
    construirDocx: async (cv) => {
      const bytes = await docxBytes(cv);
      return { base64: aBase64(bytes), bytes: bytes.length, nombre: nombreArchivo(cv) };
    },
    enviarEntrega: (job, b64) => enviarEntregaCvMedida(token, job, b64),
    enviarDisculpa: (job) => enviarDisculpaCvMedida(token, job.email),
    alertar: (job, motivo, apologySent, extra) => alertarCvMedida(token, job, motivo, apologySent, extra),
    registrar: async (evento, job, extra = {}) => {
      const res = job.resultado;
      const conteo = res ? conteoCoincidencia(res.cv) : undefined;
      await registrarEventoCvm(
        db,
        evento,
        { jobId: job.id, idioma: job.idioma, rol: job.rol ?? res?.rol, modelo: job.modelo, attr: job.attr, interno: job.interno },
        {
          ...extra,
          intentos: job.attempts,
          output_tokens: job.outputTokens,
          ms: job.ms,
          n_cumple: conteo?.cumple,
          n_parcial: conteo?.parcial,
          n_no_cumple: conteo?.no_cumple,
        },
      );
      if (evento === 'cvmedida_generado') await rolEnVenta(db, job);
    },
  };
}

// ── Webhook: pago confirmado ────────────────────────────────────────────────────────────────────

export interface SesionPagada {
  id: string;
  metadata?: Record<string, string> | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null; address?: { country?: string | null } | null } | null;
  payment_intent?: string | null;
  amount_total?: number;
}

/**
 * Lo llama el webhook cuando Stripe confirma el pago de un CV a la medida. Encola el trabajo, registra el
 * consentimiento (al pagar, no al abrir el checkout) y el evento. Si el pedido ya no existe, manda la disculpa y el
 * aviso de reembolso. Lanza solo si KV falla, para que Stripe reintente.
 */
export async function procesarPagoCvMedida(
  env: Env,
  kv: KVNamespace,
  session: SesionPagada,
  jobId: string,
  livemode: boolean,
  consentTs: string,
): Promise<'encolado' | 'ya_pagado' | 'sin_datos'> {
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  const r = await marcarPagado(kv as unknown as KvLike, jobId, {
    stripeSessionId: session.id,
    paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
    livemode,
    montoCero: session.amount_total === 0,
  });
  const email = (session.metadata?.email ?? session.customer_email ?? session.customer_details?.email ?? '').trim().toLowerCase();
  if (r.estado === 'sin_datos') {
    const disculpa = await enviarDisculpaCvMedida(token, email);
    await alertarCvMedida(token, null, 'caducado', disculpa, { job: jobId, stripe_session: session.id });
    await registrarEventoCvm(
      db,
      'cvmedida_falla',
      { jobId: jobId || session.id, idioma: session.metadata?.idioma, interno: session.metadata?.interno === '1' || session.amount_total === 0 },
      { motivo: 'caducado', correo: disculpa },
    );
    return 'sin_datos';
  }
  if (r.estado === 'ya_pagado') return 'ya_pagado';
  const job = r.job;
  await registrarEventoCvm(db, 'cvmedida_pagado', {
    jobId: job.id,
    idioma: job.idioma,
    attr: job.attr,
    interno: job.interno, // marcarPagado ya lo pone en true si el monto fue 0
    country: session.customer_details?.address?.country?.slice(0, 2) ?? null,
  });
  if (job.marketing) {
    const emailsKv = env.EMAILS as KVNamespace | undefined;
    if (emailsKv) {
      try {
        const fields = consentFields(consentTs, true, 'cv-medida');
        await emailsKv.put(
          `sim:${consentTs}:${job.email}`,
          JSON.stringify({ ts: consentTs, email: job.email, source: 'cv-medida-pago', ...fields }),
          { metadata: consentKvMeta(fields) },
        );
      } catch (err) {
        console.warn('cv-medida: lead con opt-in no guardado en EMAILS', String(err).slice(0, 200));
      }
    }
  }
  await registrarConsentimiento(db, {
    ts: consentTs,
    emailHash: await emailHashFull(job.email),
    form: 'cv-medida',
    marketing: job.marketing,
    consentVersion: job.consentVersion,
    attr: job.interno ? { ...job.attr, interno: true } : job.attr,
    country: session.customer_details?.address?.country?.slice(0, 2) ?? null,
  });
  return 'encolado';
}

/** charge.refunded: cancela la entrega si aún no se generó y registra cvmedida_reembolso. Nunca lanza. */
export async function reembolsoCvMedida(env: Env, kv: KVNamespace, paymentIntent: string): Promise<string> {
  try {
    const r = await cancelarPorReembolso(kv as unknown as KvLike, paymentIntent);
    if (r.estado === 'sin_pedido') return r.estado;
    await registrarEventoCvm(
      env.SIMULATOR_METRICS_DB as D1Database | undefined,
      'cvmedida_reembolso',
      { jobId: r.job.id, idioma: r.job.idioma, rol: r.job.rol, attr: r.job.attr, interno: r.job.interno },
      { antes_de_generar: r.estado === 'cancelado', estado: r.job.estado },
    );
    return r.estado;
  } catch (err) {
    console.error('cv-medida: reembolso no procesado en la cola', String(err).slice(0, 200));
    return 'error';
  }
}

/** Vale OXXO vencido o pago fallido: se borran los datos del pedido sin esperar la caducidad. */
export async function borrarPedidoNoPagado(kv: KVNamespace, jobId: string): Promise<void> {
  if (!jobId) return;
  const job = await leerTrabajo(kv as unknown as KvLike, jobId);
  if (job && job.estado === 'esperando_pago') await borrarTodo(kv as unknown as KvLike, jobId);
}
