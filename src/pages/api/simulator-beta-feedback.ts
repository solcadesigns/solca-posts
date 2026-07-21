/**
 * Endpoint para la encuesta post-reporte de betas (Fase 1.5.H · 19 jun 2026).
 *
 * Recibe POST con respuestas a las 7 secciones de la encuesta (todas opcionales):
 *   - realismo (1-5)
 *   - utilidad (1-5)
 *   - facilidad (1-5)
 *   - sorpresa (texto, max 280 chars)
 *   - mejora (texto, max 280 chars)
 *   - pago_disposicion (enum)
 *   - demograficos: edad_rango, genero  (van a tabla sessions, ya backend ready)
 *
 * Escribe a tabla beta_feedback (Migration 0002) con UPSERT por session_id.
 * Demográficos se escriben a sessions vía updateDemographicsInD1.
 *
 * No usa STATS_KEY · el control de acceso es que la session_id debe existir
 * en sessions (FK enforces). Si llega una session_id desconocida, falla con 404.
 */

import type { APIRoute } from 'astro';
import { updateDemographicsInD1 } from '../../lib/simulator-metrics-writer';

export const prerender = false;

type PagoDisposicion =
  | 'basico_149'
  | 'intensivo_349'
  | 'menos_de_99'
  | 'solo_gratis'
  | 'no_pagaria';

const PAGO_VALUES: ReadonlyArray<PagoDisposicion> = [
  'basico_149',
  'intensivo_349',
  'menos_de_99',
  'solo_gratis',
  'no_pagaria',
];

interface BetaFeedbackRequest {
  sessionId: string;
  realismo?: number | null;
  utilidad?: number | null;
  facilidad?: number | null;
  sorpresa?: string | null;
  mejora?: string | null;
  pagoDisposicion?: PagoDisposicion | null;
  // Demográficos · van a sessions, no a beta_feedback
  edadRango?: string | null;
  genero?: string | null;
}

interface BetaFeedbackResponse {
  ok: boolean;
  error?: string;
}

function jsonResponse(data: BetaFeedbackResponse, status = 200) {
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

function validatePagoDisposicion(value: unknown): PagoDisposicion | null {
  if (typeof value !== 'string') return null;
  return PAGO_VALUES.includes(value as PagoDisposicion) ? (value as PagoDisposicion) : null;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (!db) {
    return jsonResponse({ ok: false, error: 'SIMULATOR_METRICS_DB binding no configurado' }, 503);
  }

  let body: BetaFeedbackRequest;
  try {
    body = (await request.json()) as BetaFeedbackRequest;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.sessionId || typeof body.sessionId !== 'string') {
    return jsonResponse({ ok: false, error: 'Missing or invalid sessionId' }, 400);
  }

  // Verificar que la sesión existe (FK lo haría igual pero damos 404 explícito)
  const sessionExists = await db
    .prepare('SELECT 1 AS ok FROM sessions WHERE session_id = ?')
    .bind(body.sessionId)
    .first<{ ok: number }>();
  if (!sessionExists) {
    return jsonResponse({ ok: false, error: 'Session not found' }, 404);
  }

  // Normalizar y validar campos
  const realismo = clampInt(body.realismo, 1, 5);
  const utilidad = clampInt(body.utilidad, 1, 5);
  const facilidad = clampInt(body.facilidad, 1, 5);
  const sorpresa = truncateText(body.sorpresa, 280);
  const mejora = truncateText(body.mejora, 280);
  const pago = validatePagoDisposicion(body.pagoDisposicion);
  const edadRango = body.edadRango && typeof body.edadRango === 'string' ? body.edadRango : null;
  const genero = body.genero && typeof body.genero === 'string' ? body.genero : null;

  // UPSERT en beta_feedback (PK por session_id · si ya hay, la última submission gana)
  try {
    await db
      .prepare(
        `INSERT INTO beta_feedback (session_id, submitted_at, realismo, utilidad, facilidad, sorpresa, mejora, pago_disposicion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           submitted_at = excluded.submitted_at,
           realismo = COALESCE(excluded.realismo, realismo),
           utilidad = COALESCE(excluded.utilidad, utilidad),
           facilidad = COALESCE(excluded.facilidad, facilidad),
           sorpresa = COALESCE(excluded.sorpresa, sorpresa),
           mejora = COALESCE(excluded.mejora, mejora),
           pago_disposicion = COALESCE(excluded.pago_disposicion, pago_disposicion)`,
      )
      .bind(
        body.sessionId,
        Date.now(),
        realismo,
        utilidad,
        facilidad,
        sorpresa,
        mejora,
        pago,
      )
      .run();
  } catch (err) {
    console.error('beta-feedback write failed:', err);
    return jsonResponse({ ok: false, error: 'D1 write failed' }, 500);
  }

  // Si vinieron demográficos, escribirlos a sessions (reuse del writer existente)
  if (edadRango || genero) {
    try {
      await updateDemographicsInD1(db, body.sessionId, edadRango, genero);
    } catch (err) {
      console.error('beta-feedback demographics write failed (non-blocking):', err);
      // No fallar la respuesta · el feedback ya quedó. Demográficos best-effort.
    }
  }

  return jsonResponse({ ok: true });
};
