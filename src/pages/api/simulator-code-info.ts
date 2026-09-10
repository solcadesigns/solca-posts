/**
 * /api/simulator-code-info · devuelve info pública de un código SIM-XXX.
 *
 * Establecido: 9 sept 2026.
 *
 * Uso: el intake muestra al usuario cuántas sesiones le quedan antes de
 * arrancar la nueva. Info que devuelve:
 *   - plan: 'gratis' | 'basico' | 'premium'
 *   - sessions_used: número
 *   - max_sessions: número
 *   - remaining: max_sessions - sessions_used
 *   - nombre_pila: para saludo personalizado
 *   - expires_at: para mostrar vigencia
 *
 * NO auth. El código en sí es la credencial (32 caracteres random no
 * adivinables). Cualquiera con el código puede ver sus créditos.
 *
 * GET /api/simulator-code-info?codigo=SIM-XXXXXXXX
 */

import type { APIRoute } from 'astro';
import type { BetaCodeRecord } from '../../lib/simulator-types';

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

  const kv = env.SIMULATOR_BETA_CODES as KVNamespace | undefined;
  if (!kv) return jsonResponse({ ok: false, error: 'kv_missing' }, 500);

  const raw = await kv.get(`beta:${code}`);
  if (!raw) return jsonResponse({ ok: false, error: 'not_found' }, 404);

  let record: BetaCodeRecord;
  try {
    record = JSON.parse(raw) as BetaCodeRecord;
  } catch {
    return jsonResponse({ ok: false, error: 'parse_error' }, 500);
  }

  const remaining = Math.max(0, record.max_sessions - record.sessions_used);
  const expired = new Date(record.expires_at).getTime() < Date.now();

  return jsonResponse({
    ok: true,
    plan: record.plan ?? 'gratis',
    sessionsUsed: record.sessions_used,
    maxSessions: record.max_sessions,
    remaining,
    expired,
    expiresAt: record.expires_at,
    nombrePila: record.nombre_pila ?? null,
  });
};
