/**
 * Endpoint · Eventos del funnel del simulador · 28 sept 2026
 *
 * Registra eventos client-side del funnel simulator (paywall_viewed,
 * checkout_started, checkout_abandoned) para diagnosticar la caída
 * entre "vio la landing" y "sesión iniciada".
 *
 * Contexto: el reporte semanal 2026-09-28 documentó por segunda semana
 * consecutiva 51 page views a /simulador-entrevistas/ y 0 sesiones
 * iniciadas. Sin instrumentación entre "vio muro de precio" y
 * "abandonó checkout" no se puede diagnosticar si el bloqueo es
 * precio, fricción del form o tráfico no humano.
 *
 * Storage: SIMULATOR_METRICS KV, prefix `evt:` para separar de las
 * métricas de sesión existentes (que usan otros prefijos). Key format:
 *   evt:{iso_ts}:{event_name}:{rand}
 *
 * PII: cero. Se guarda event, plan (si aplica), utm_*, country
 * (Cloudflare header), y timestamp. Ni email ni IP.
 *
 * Auth: público (POST, client-side). El endpoint tiene throttle simple
 * por IP para evitar flood (max 60 eventos/min por IP).
 */

import type { APIRoute } from 'astro';

export const prerender = false;

interface EventBody {
  event: 'paywall_viewed' | 'checkout_started' | 'checkout_abandoned' | 'code_submitted';
  plan?: 'gratis' | 'basico' | 'premium';
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
}

const ALLOWED_EVENTS = new Set([
  'paywall_viewed',
  'checkout_started',
  'checkout_abandoned',
  'code_submitted',
]);

const MAX_STRING = 200; // recorta strings largas para no ensuciar KV
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function truncate(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_STRING);
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let body: EventBody;
  try {
    body = (await request.json()) as EventBody;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const event = body.event;
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return jsonResponse({ error: 'invalid_event' }, 400);
  }

  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};
  const kv = env.SIMULATOR_METRICS as KVNamespace | undefined;
  if (!kv || typeof kv.put !== 'function') {
    // Sin KV, log y respondemos ok para no romper cliente
    console.log('simulator-events:no-kv', event);
    return jsonResponse({ ok: true, stored: false });
  }

  // Rate limit muy simple por IP (contador con TTL en la misma KV)
  const ip = clientAddress ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
  const rlKey = `evt-rl:${ip}`;
  try {
    const rlRaw = await kv.get(rlKey);
    const count = rlRaw ? parseInt(rlRaw, 10) || 0 : 0;
    if (count >= RATE_LIMIT_MAX) {
      return jsonResponse({ error: 'rate_limited' }, 429);
    }
    await kv.put(rlKey, String(count + 1), {
      expirationTtl: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  } catch {
    // rate limit soft-fail; seguimos
  }

  const country = request.headers.get('cf-ipcountry') ?? undefined;
  const ts = new Date().toISOString();
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `evt:${ts}:${event}:${rand}`;

  const record = {
    event,
    ts,
    plan: body.plan && ['gratis', 'basico', 'premium'].includes(body.plan) ? body.plan : undefined,
    utm_source: truncate(body.utm_source),
    utm_medium: truncate(body.utm_medium),
    utm_campaign: truncate(body.utm_campaign),
    utm_content: truncate(body.utm_content),
    utm_term: truncate(body.utm_term),
    referrer: truncate(body.referrer),
    country,
  };

  try {
    // TTL 90 días para que weekly-report tenga historia suficiente sin bloat.
    await kv.put(key, JSON.stringify(record), { expirationTtl: 90 * 24 * 60 * 60 });
  } catch (err) {
    console.error('simulator-events:kv-put-failed', err);
    return jsonResponse({ error: 'store_failed' }, 500);
  }

  return jsonResponse({ ok: true, stored: true });
};
