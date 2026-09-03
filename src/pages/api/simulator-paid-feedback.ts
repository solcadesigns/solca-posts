/**
 * /api/simulator-paid-feedback · endpoint de feedback para usuarios pagados.
 *
 * Establecido: 3 sept 2026 (post-paywall).
 *
 * Dos tipos de feedback:
 *   - `micro` · post cada sesión pagada. 1 rating (utilidad 1-5) + textarea opcional.
 *   - `package_final` · al terminar la última sesión del paquete (remaining=0).
 *     NPS + precio percibido + utilidad paquete + que faltó + testimonial opcional.
 *     Premium agrega pregunta extra sobre historial etiquetado.
 *
 * Storage: tabla D1 `paid_feedback` (creada con CREATE TABLE IF NOT EXISTS al
 * primer request, sin migration file). Un row por submit.
 *
 * No requiere STATS_KEY · valida solo que sessionId sea string y feedbackType válido.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

type FeedbackType = 'micro' | 'package_final';
type PrecioPercibido = 'muy_caro' | 'caro' | 'justo' | 'barato';
type HistorialUtil = 'si' | 'no' | 'no_use';

interface PaidFeedbackRequest {
  sessionId: string;
  feedbackType: FeedbackType;
  plan?: string;
  sessionNumber?: number;
  remaining?: number;
  emailHash?: string;
  // Micro
  utilidad?: number | null;
  comentarioLibre?: string | null;
  // Package final
  nps?: number | null;
  precioPercibido?: PrecioPercibido | null;
  utilidadPaquete?: number | null;
  queFalto?: string | null;
  testimonialOk?: boolean | null;
  testimonialTexto?: string | null;
  testimonialFirma?: string | null;
  historialUtil?: HistorialUtil | null;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < min || n > max) return null;
  return n;
}
function truncateText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxChars);
}
function validateEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

const PRECIO_VALUES: readonly PrecioPercibido[] = ['muy_caro', 'caro', 'justo', 'barato'];
const HISTORIAL_VALUES: readonly HistorialUtil[] = ['si', 'no', 'no_use'];

async function ensureTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS paid_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      submitted_at INTEGER NOT NULL,
      feedback_type TEXT NOT NULL,
      plan TEXT,
      session_number INTEGER,
      remaining INTEGER,
      email_hash TEXT,
      utilidad INTEGER,
      comentario_libre TEXT,
      nps INTEGER,
      precio_percibido TEXT,
      utilidad_paquete INTEGER,
      que_falto TEXT,
      testimonial_ok INTEGER,
      testimonial_texto TEXT,
      testimonial_firma TEXT,
      historial_util TEXT
    )`,
    )
    .run();
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_paid_feedback_type ON paid_feedback(feedback_type)`)
    .run();
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_paid_feedback_email ON paid_feedback(email_hash)`)
    .run();
}

export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (!db) return jsonResponse({ ok: false, error: 'D1 not configured' }, 503);

  let body: PaidFeedbackRequest;
  try {
    body = (await request.json()) as PaidFeedbackRequest;
  } catch {
    return jsonResponse({ ok: false, error: 'invalid json' }, 400);
  }

  if (!body.sessionId || typeof body.sessionId !== 'string') {
    return jsonResponse({ ok: false, error: 'missing sessionId' }, 400);
  }
  const feedbackType = validateEnum<FeedbackType>(body.feedbackType, ['micro', 'package_final']);
  if (!feedbackType) return jsonResponse({ ok: false, error: 'invalid feedbackType' }, 400);

  await ensureTable(db);

  const row = {
    session_id: body.sessionId,
    submitted_at: Date.now(),
    feedback_type: feedbackType,
    plan: typeof body.plan === 'string' ? body.plan : null,
    session_number: clampInt(body.sessionNumber, 1, 100),
    remaining: clampInt(body.remaining, 0, 100),
    email_hash: typeof body.emailHash === 'string' ? body.emailHash.slice(0, 32) : null,
    // Micro
    utilidad: clampInt(body.utilidad, 1, 5),
    comentario_libre: truncateText(body.comentarioLibre, 500),
    // Package final
    nps: clampInt(body.nps, 0, 10),
    precio_percibido: validateEnum(body.precioPercibido, PRECIO_VALUES),
    utilidad_paquete: clampInt(body.utilidadPaquete, 1, 5),
    que_falto: truncateText(body.queFalto, 500),
    testimonial_ok:
      typeof body.testimonialOk === 'boolean' ? (body.testimonialOk ? 1 : 0) : null,
    testimonial_texto: truncateText(body.testimonialTexto, 500),
    testimonial_firma: truncateText(body.testimonialFirma, 200),
    historial_util: validateEnum(body.historialUtil, HISTORIAL_VALUES),
  };

  try {
    await db
      .prepare(
        `INSERT INTO paid_feedback (
        session_id, submitted_at, feedback_type, plan, session_number, remaining, email_hash,
        utilidad, comentario_libre,
        nps, precio_percibido, utilidad_paquete, que_falto,
        testimonial_ok, testimonial_texto, testimonial_firma, historial_util
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.session_id,
        row.submitted_at,
        row.feedback_type,
        row.plan,
        row.session_number,
        row.remaining,
        row.email_hash,
        row.utilidad,
        row.comentario_libre,
        row.nps,
        row.precio_percibido,
        row.utilidad_paquete,
        row.que_falto,
        row.testimonial_ok,
        row.testimonial_texto,
        row.testimonial_firma,
        row.historial_util,
      )
      .run();
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[simulator-paid-feedback] insert failed:', err);
    return jsonResponse({ ok: false, error: 'insert failed' }, 500);
  }
};
