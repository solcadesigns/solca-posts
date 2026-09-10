/**
 * /api/simulator-my-sessions · lista las sesiones del usuario por código.
 *
 * Establecido: 9 sept 2026.
 *
 * Uso: la pantalla `/simulador-entrevistas/mis-reportes` muestra los PDFs
 * disponibles del usuario. Este endpoint devuelve la lista mínima necesaria
 * (sin info personal ni contenido del reporte).
 *
 * GET /api/simulator-my-sessions?codigo=SIM-XXXXXXXX
 *
 * Response:
 *   {
 *     ok: true,
 *     plan: 'basico' | 'premium' | 'gratis',
 *     nombrePila: string | null,
 *     sessions: [
 *       {
 *         sessionId: string,
 *         startedAt: string (ISO),
 *         rol: string,
 *         questionCount: number,
 *         status: 'ready' | 'processing' | 'failed',
 *       }
 *     ]
 *   }
 *
 * NO auth. El código es la credencial (32 chars random no adivinables).
 */

import type { APIRoute } from 'astro';
import type { BetaCodeRecord, SessionState } from '../../lib/simulator-types';

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
  const code = (url.searchParams.get('codigo') ?? '').trim();

  if (!code || code.length < 6) {
    return jsonResponse({ ok: false, error: 'invalid_code' }, 400);
  }

  const betaKv = env.SIMULATOR_BETA_CODES as KVNamespace | undefined;
  const sessionsKv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (!betaKv || !sessionsKv) {
    return jsonResponse({ ok: false, error: 'kv_missing' }, 500);
  }

  // Validar código
  const rawBeta = await betaKv.get(`beta:${code}`);
  if (!rawBeta) return jsonResponse({ ok: false, error: 'code_not_found' }, 404);

  let betaRecord: BetaCodeRecord;
  try {
    betaRecord = JSON.parse(rawBeta) as BetaCodeRecord;
  } catch {
    return jsonResponse({ ok: false, error: 'parse_error' }, 500);
  }

  const emailHash = betaRecord.email_hash;
  if (!emailHash) {
    return jsonResponse({ ok: true, plan: betaRecord.plan ?? 'gratis', nombrePila: null, sessions: [] });
  }

  // Leer índice de sesiones del usuario. Formato: array de sessionIds.
  // Escrito por handleInit cada vez que se crea sesión (Paso B).
  const rawIndex = await sessionsKv.get(`user_sessions:${emailHash}`);
  let sessionIds: string[] = [];
  if (rawIndex) {
    try {
      sessionIds = JSON.parse(rawIndex) as string[];
    } catch {
      sessionIds = [];
    }
  }

  // Limitar a las últimas 50 sesiones para no exceder el subrequest limit de
  // Cloudflare Workers (50 en Free plan). Si el user tiene más, tomamos las
  // más recientes (final del array porque handleInit hace push).
  const MAX_LIST = 50;
  const sessionIdsSubset = sessionIds.slice(-MAX_LIST);

  // Cargar cada sesión (paralelo) · devolver solo metadata mínima
  const sessionsData = await Promise.all(
    sessionIdsSubset.map(async (sessionId) => {
      try {
        const raw = await sessionsKv.get(`session:${sessionId}`);
        if (!raw) return null;
        const state = JSON.parse(raw) as SessionState;
        const status = state.finalReport
          ? 'ready'
          : state.finalReportStatus === 'failed'
            ? 'failed'
            : state.finished
              ? 'processing'
              : 'in_session';
        return {
          sessionId: state.sessionId,
          startedAt: state.startedAt,
          rol: state.profile.roleTitle ?? state.profile.role ?? 'No especificado',
          questionCount: state.profile.questionCount,
          status,
        };
      } catch {
        return null;
      }
    }),
  );

  // Filtrar nulls y ordenar por startedAt descendente (más reciente arriba)
  const sessions = sessionsData
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  return jsonResponse({
    ok: true,
    plan: betaRecord.plan ?? 'gratis',
    nombrePila: betaRecord.nombre_pila ?? null,
    sessions,
  });
};
