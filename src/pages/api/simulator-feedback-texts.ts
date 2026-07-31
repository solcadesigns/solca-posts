/**
 * Endpoint · listar textos libres de la encuesta beta_feedback del Simulador.
 * 30 jul 2026 · complementa /api/simulator-stats (que solo devuelve agregados).
 *
 * Devuelve las respuestas individuales de la encuesta post-reporte, ordenadas
 * por submitted_at DESC (más reciente primero). El propósito es leer los textos
 * libres "sorpresa" y "mejora" que son la fuente cualitativa más rica para
 * iterar el producto — los agregados numéricos ya viven en simulator-stats.
 *
 * Auth: query param ?key= debe coincidir con env.STATS_KEY (mismo patrón
 * que simulator-stats, quiz-stats, quiz-export).
 *
 * No incluye session_id sensible por default en la respuesta; solo el prefijo
 * de 8 chars para poder cross-referenciar con simulator-stats sin exponer el
 * UUID completo en pantalla.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

interface FeedbackRow {
  session_prefix: string;      // primeros 8 chars del session_id, para cross-ref
  submitted_at: string;        // ISO timestamp
  realismo: number | null;     // 1-5
  utilidad: number | null;     // 1-5
  facilidad: number | null;    // 1-5
  pago_disposicion: string | null;
  sorpresa: string | null;     // texto libre max 280 chars
  mejora: string | null;       // texto libre max 280 chars
}

interface FeedbackResponse {
  generated_at: string;
  total: number;
  with_sorpresa: number;       // cuántos escribieron algo en sorpresa
  with_mejora: number;         // cuántos escribieron algo en mejora
  rows: FeedbackRow[];
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ url, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env;

  const expectedKey = env?.STATS_KEY as string | undefined;
  if (!expectedKey) {
    return jsonResponse({ error: 'stats_disabled' }, 503);
  }
  const providedKey = url.searchParams.get('key');
  if (providedKey !== expectedKey) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const db = env?.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (!db) {
    return jsonResponse(
      { error: 'd1_missing', message: 'SIMULATOR_METRICS_DB binding no enlazado.' },
      503,
    );
  }

  try {
    const result = await db
      .prepare(
        `SELECT session_id, submitted_at, realismo, utilidad, facilidad,
                pago_disposicion, sorpresa, mejora
         FROM beta_feedback
         ORDER BY submitted_at DESC`
      )
      .all();

    const raws = (result.results ?? []) as Array<Record<string, unknown>>;

    const rows: FeedbackRow[] = raws.map((r) => ({
      session_prefix: typeof r.session_id === 'string' ? r.session_id.slice(0, 8) : '',
      submitted_at: String(r.submitted_at ?? ''),
      realismo: r.realismo == null ? null : Number(r.realismo),
      utilidad: r.utilidad == null ? null : Number(r.utilidad),
      facilidad: r.facilidad == null ? null : Number(r.facilidad),
      pago_disposicion: r.pago_disposicion == null ? null : String(r.pago_disposicion),
      sorpresa: r.sorpresa == null ? null : String(r.sorpresa),
      mejora: r.mejora == null ? null : String(r.mejora),
    }));

    const response: FeedbackResponse = {
      generated_at: new Date().toISOString(),
      total: rows.length,
      with_sorpresa: rows.filter((r) => r.sorpresa && r.sorpresa.trim().length > 0).length,
      with_mejora: rows.filter((r) => r.mejora && r.mejora.trim().length > 0).length,
      rows,
    };

    return jsonResponse(response, 200);
  } catch (err) {
    console.error('simulator-feedback-texts failed:', err);
    return jsonResponse({ error: 'internal', message: (err as Error)?.message }, 500);
  }
};
