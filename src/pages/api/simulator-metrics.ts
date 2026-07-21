/**
 * Endpoint para guardar métricas anónimas en D1.
 * Fase 1.4.1 · 16 jun 2026.
 *
 * Recibe: MetricsAnonymous + opcionalmente datos derivados (sesion_duracion, has_cv_summary)
 * Escribe a la tabla `sessions` y a `session_tags` para arrays multivaluados.
 *
 * Privacidad:
 *  - No guarda nombre, email, IP, ni nombres de instituciones.
 *  - Solo categorías agregables documentadas en SIMULADOR_ENTREVISTAS_ADDENDUM.md sección 7.15.
 */

import type { APIRoute } from 'astro';
import type { MetricsAnonymous } from '../../lib/simulator-types';
import { writeMetricsToD1, updateDemographicsInD1 } from '../../lib/simulator-metrics-writer';

export const prerender = false;

type MetricsAction = 'submit' | 'update_demographics';

interface MetricsRequest {
  action?: MetricsAction;
  sessionId: string;
  metrics?: MetricsAnonymous;
  hasCvSummary?: boolean;
  // Demográficos opcionales · llegan en una segunda llamada después del feedback
  edadRango?: string | null;
  genero?: string | null;
}

interface MetricsResponse {
  ok: boolean;
  error?: string;
}

function jsonResponse(data: MetricsResponse, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;

  if (!db) {
    return jsonResponse(
      { ok: false, error: 'SIMULATOR_METRICS_DB binding no configurado' },
      503,
    );
  }

  let body: MetricsRequest;
  try {
    body = (await request.json()) as MetricsRequest;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.sessionId) {
    return jsonResponse({ ok: false, error: 'Missing sessionId' }, 400);
  }

  const action: MetricsAction = body.action ?? 'submit';

  try {
    if (action === 'update_demographics') {
      await updateDemographicsInD1(
        db,
        body.sessionId,
        body.edadRango ?? null,
        body.genero ?? null,
      );
      return jsonResponse({ ok: true });
    }

    // Default: submit completo
    if (!body.metrics) {
      return jsonResponse({ ok: false, error: 'Missing metrics for submit' }, 400);
    }
    await writeMetricsToD1(db, {
      sessionId: body.sessionId,
      metrics: body.metrics,
      hasCvSummary: body.hasCvSummary,
      edadRango: body.edadRango ?? null,
      genero: body.genero ?? null,
    });
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('simulator-metrics write error:', err);
    return jsonResponse({ ok: false, error: 'D1 write failed' }, 500);
  }
};
