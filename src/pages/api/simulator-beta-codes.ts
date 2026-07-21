/**
 * Endpoint admin de códigos beta del Simulador (Fase 1.5.G · 19 jun 2026).
 *
 * GET ?key=<STATS_KEY>: lista todos los códigos del KV SIMULATOR_BETA_CODES
 * con su metadata y estado computado (activo / agotado / expirado).
 *
 * Auth con STATS_KEY (mismo secret que cv-stats, quiz-stats, simulator-stats).
 *
 * Usado por /admin/beta-codes.astro y por consulta directa via curl.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

interface BetaCodeRecord {
  nombre_pila?: string;
  email_hash?: string;
  max_sessions: number;
  sessions_used: number;
  granted_at: string;
  expires_at: string;
  cohort?: string;
}

interface BetaCodeView extends BetaCodeRecord {
  codigo: string;
  estado: 'activo' | 'agotado' | 'expirado';
  url: string;
  sessions_remaining: number;
}

interface BetaCodesResponse {
  generated_at: string;
  total: number;
  by_estado: { activo: number; agotado: number; expirado: number };
  by_cohort: Record<string, number>;
  codes: BetaCodeView[];
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function computeEstado(record: BetaCodeRecord): 'activo' | 'agotado' | 'expirado' {
  if (record.sessions_used >= record.max_sessions) return 'agotado';
  if (new Date(record.expires_at).getTime() < Date.now()) return 'expirado';
  return 'activo';
}

async function listAllBetaCodes(kv: KVNamespace): Promise<BetaCodeView[]> {
  const out: BetaCodeView[] = [];
  let cursor: string | undefined;
  do {
    const result = await kv.list({ prefix: 'beta:', cursor, limit: 1000 });
    for (const key of result.keys) {
      try {
        const raw = await kv.get(key.name);
        if (!raw) continue;
        const record = JSON.parse(raw) as BetaCodeRecord;
        const codigo = key.name.replace(/^beta:/, '');
        const estado = computeEstado(record);
        out.push({
          ...record,
          codigo,
          estado,
          url: `https://solcaciencia.com/simulador-entrevistas-beta?codigo=${codigo}`,
          sessions_remaining: Math.max(0, record.max_sessions - record.sessions_used),
        });
      } catch (err) {
        console.error('Failed to parse beta code:', key.name, err);
      }
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return out;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};

  const expectedKey = env.STATS_KEY as string | undefined;
  if (!expectedKey) return jsonResponse({ error: 'stats_disabled' }, 503);
  const providedKey = url.searchParams.get('key');
  if (providedKey !== expectedKey) return jsonResponse({ error: 'unauthorized' }, 401);

  const kv = env.SIMULATOR_BETA_CODES as KVNamespace | undefined;
  if (!kv) return jsonResponse({ error: 'kv_missing', message: 'SIMULATOR_BETA_CODES binding no enlazado.' }, 503);

  try {
    const codes = await listAllBetaCodes(kv);

    // Orden: agotado primero (más interesante para ver quién aprovechó), luego activos, luego expirados.
    // Dentro de cada grupo: por granted_at descendente (más recientes primero).
    const estadoOrder: Record<string, number> = { agotado: 0, activo: 1, expirado: 2 };
    codes.sort((a, b) => {
      const eo = estadoOrder[a.estado] - estadoOrder[b.estado];
      if (eo !== 0) return eo;
      return new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime();
    });

    const byEstado = { activo: 0, agotado: 0, expirado: 0 };
    const byCohort: Record<string, number> = {};
    for (const c of codes) {
      byEstado[c.estado] += 1;
      const cohortKey = c.cohort || '(sin cohort)';
      byCohort[cohortKey] = (byCohort[cohortKey] || 0) + 1;
    }

    const response: BetaCodesResponse = {
      generated_at: new Date().toISOString(),
      total: codes.length,
      by_estado: byEstado,
      by_cohort: byCohort,
      codes,
    };

    return jsonResponse(response);
  } catch (err) {
    console.error('beta-codes list failed:', err);
    return jsonResponse({ error: 'internal', message: (err as Error)?.message }, 500);
  }
};
