/**
 * /api/simulator-session-status
 *
 * v0.8 (3 sept 2026): polling endpoint para saber si el reporte async ya
 * está listo. El frontend consulta cada 15s mientras espera.
 *
 * Auth implícita: usa sessionId como token (uuid random no adivinable).
 * Sin STATS_KEY para que el frontend pueda consultarlo directamente.
 *
 * GET /api/simulator-session-status?sessionId=xxx
 *
 * Response:
 * - { status: 'queued', progress: 'aún no arrancó' }
 * - { status: 'processing', progress: 'summary + 2 de 3 breakdowns' }
 * - { status: 'ready', finalReport: {...}, sessionState: {...} }
 * - { status: 'failed', error: '...' }
 * - { status: 'not_found' }
 */

import type { APIRoute } from 'astro';
import type { SessionState } from '../../lib/simulator-types';

export const prerender = false;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env: Record<string, unknown> } }).runtime?.env ?? {};
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId || sessionId.length < 20) {
    return jsonResponse({ ok: false, status: 'invalid_session_id' }, 400);
  }

  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (!kv) return jsonResponse({ ok: false, status: 'kv_missing' }, 500);

  const raw = await kv.get(`session:${sessionId}`);
  if (!raw) {
    return jsonResponse({ ok: false, status: 'not_found' }, 404);
  }

  let state: SessionState;
  try {
    state = JSON.parse(raw) as SessionState;
  } catch {
    return jsonResponse({ ok: false, status: 'parse_error' }, 500);
  }

  const reportStatus = state.finalReportStatus ?? (state.finalReport ? 'ready' : 'queued');

  if (reportStatus === 'ready' && state.finalReport) {
    return jsonResponse({
      ok: true,
      status: 'ready',
      finalReport: state.finalReport,
      sessionState: state,
    });
  }

  if (reportStatus === 'failed') {
    return jsonResponse({
      ok: true,
      status: 'failed',
      error: state.finalReportError ?? 'Unknown error',
    });
  }

  // queued o processing · reportar progreso
  const chunks = state.finalReportChunks ?? {};
  const summaryDone = !!chunks.summary;
  const breakdownsDone = chunks.breakdowns?.length ?? 0;
  const totalBreakdowns = Math.ceil(state.profile.questionCount / 5);
  const progress = `${summaryDone ? 'summary ✓' : 'summary ⏳'} · breakdowns ${breakdownsDone}/${totalBreakdowns}`;

  return jsonResponse({
    ok: true,
    status: reportStatus,
    progress,
    summaryDone,
    breakdownsDone,
    totalBreakdowns,
  });
};
