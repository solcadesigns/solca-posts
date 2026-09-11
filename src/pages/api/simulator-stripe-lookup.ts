/**
 * /api/simulator-stripe-lookup · devuelve el beta code SIM-XXX creado por
 * el webhook de Stripe para una checkout session dada.
 *
 * Establecido: 11 sept 2026 (v3 · fix de UX post-checkout).
 *
 * Flujo:
 *   1. Usuario paga en Stripe Checkout.
 *   2. Stripe redirige a /simulador-entrevistas/gracias?session_id=cs_XXX.
 *   3. La página gracias hace polling a este endpoint hasta que el webhook
 *      termine de procesar y devuelva el código.
 *
 * KV: SIMULATOR_BETA_CODES con índice inverso `stripe_session:{sessionId}`
 * → `SIM-XXXXXXXX` escrito por simulator-stripe-webhook.ts.
 *
 * Seguridad: session_id de Stripe es efímero y se comparte por redirect al
 * navegador del comprador. Riesgo similar a interceptar el email de Postmark.
 * TTL corto (7d) en el índice para minimizar exposición.
 *
 * Respuesta OK:
 *   { ok: true, code: "SIM-XXXXXXXX", plan: "basico" | "premium" }
 *
 * Respuesta pending (webhook aún no procesa):
 *   status 202 · { ok: false, error: 'pending' }
 *
 * Respuesta error:
 *   status 400 · { ok: false, error: 'invalid_session_id' }
 *   status 404 · { ok: false, error: 'not_found' }
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
  const sessionId = (url.searchParams.get('session_id') ?? '').trim();

  // Stripe checkout session IDs empiezan con cs_test_ o cs_live_
  if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return jsonResponse({ ok: false, error: 'invalid_session_id' }, 400);
  }

  const dedupKv = env.STRIPE_CHECKOUT_SESSIONS as KVNamespace | undefined;
  const betaKv = env.SIMULATOR_BETA_CODES as KVNamespace | undefined;
  if (!dedupKv || !betaKv) {
    return jsonResponse({ ok: false, error: 'kv_missing' }, 500);
  }

  // Índice inverso `stripe_session:{sessionId}` → `SIM-XXXXXXXX`
  const code = await dedupKv.get(`stripe_session:${sessionId}`);
  if (!code) {
    // Webhook aún no ha procesado esta session — el frontend hace polling.
    return jsonResponse({ ok: false, error: 'pending' }, 202);
  }

  // Verificar que el código realmente existe en el KV de beta codes
  const rawBeta = await betaKv.get(`beta:${code}`);
  if (!rawBeta) {
    // El índice existe pero el beta code no · caso raro (borrado manual)
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }

  let betaRecord: BetaCodeRecord;
  try {
    betaRecord = JSON.parse(rawBeta) as BetaCodeRecord;
  } catch {
    return jsonResponse({ ok: false, error: 'parse_error' }, 500);
  }

  return jsonResponse({
    ok: true,
    code,
    plan: betaRecord.plan ?? 'basico',
    nombre_pila: betaRecord.nombre_pila ?? null,
  });
};
