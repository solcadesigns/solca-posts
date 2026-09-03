/**
 * /api/simulator-subscribe · Landing pública del Simulador de Entrevistas.
 *
 * Registra un lead, genera un código de acceso único (SIM-XXXXXXXX), lo escribe
 * al KV SIMULATOR_BETA_CODES con prefix `beta:` (reutiliza la validación existente
 * en /api/simulator-session), guarda el lead en KV EMAILS con prefix `sim:` y
 * dispara Postmark con el template `welcome-simulator-code`.
 *
 * Regla de asignación (Fase pre-paywall · hasta 7 sept 2026):
 *   - cohort = 'pre-paywall'
 *   - max_sessions = 1
 *   - expires_at = 2026-09-07T23:59-06:00 (cierre de la fase libre)
 *
 * Regla de conteo (importante, definida el 19 ago 2026):
 *   El contador `sessions_used` se incrementa SOLO cuando el usuario completa
 *   la sesión y recibe el reporte final. Si abre y abandona, o si el reporte
 *   falla, la sesión queda intacta y el código sigue vivo para reintentar.
 *   Esto lo hace /api/simulator-session al final de handleNext/handleRetryReport.
 *
 * Fase post-paywall (desde 8 sept 2026):
 *   Este endpoint queda vivo pero solo debería consumirse desde la landing
 *   pública mientras la ventana libre esté abierta. A partir del 8 sept, la
 *   emisión de códigos se traslada al webhook de Stripe (endpoint separado)
 *   con max_sessions y expires_at según el plan pagado.
 *
 * Compatibilidad con códigos beta legados:
 *   Los códigos existentes en /simulador-entrevistas-beta ya viven en el mismo KV
 *   con prefix `beta:`. Este endpoint escribe también con prefix `beta:` para
 *   reutilizar toda la validación existente en /api/simulator-session.
 */

import type { APIRoute } from 'astro';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { extractUtms } from '../../lib/utm';

export const prerender = false;

interface SubscribeRequest {
  email: string;
  name: string;
  consent?: boolean;
  country?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

interface BetaCodeRecord {
  nombre_pila?: string;
  email_hash?: string;
  max_sessions: number;
  sessions_used: number;
  granted_at: string;
  expires_at: string;
  cohort?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fase pre-paywall: los códigos vencen el 7 sept 2026 a las 23:59 CDMX.
// Post-paywall (8 sept 2026+): este endpoint sigue emitiendo códigos para
// el plan gratis (freemium) con vigencia 240 días desde alta.
const PREPAYWALL_EXPIRES_ISO = '2026-09-08T05:59:59.000Z'; // 23:59 CDMX del 7 sept
const PREPAYWALL_MAX_SESSIONS = 1;
const PREPAYWALL_COHORT = 'pre-paywall';
const FREEMIUM_VIGENCIA_DIAS = 240;
const FREEMIUM_MAX_SESSIONS = 1;
const FREEMIUM_COHORT = 'freemium';

/** Corte que separa pre-paywall (cohort='pre-paywall') de freemium (cohort='freemium'). */
function isPostPaywall(): boolean {
  return Date.now() >= new Date(PREPAYWALL_EXPIRES_ISO).getTime();
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * Genera un código único legible: SIM-XXXXXXXX (8 chars alfanum, sin ambigüedades).
 * Excluye O/0/I/1 para que se lea bien copiado de un email.
 */
function generateAccessCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O, 0, I, 1
  let code = 'SIM-';
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/**
 * Hash SHA-256 del email en hex, prefijo 16 chars. Usado para deduplicar/auditar
 * sin exponer el email en KV keys.
 */
async function hashEmail(email: string): Promise<string> {
  const enc = new TextEncoder().encode(email.toLowerCase().trim());
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * Escribe el registro del lead a KV EMAILS con prefix `sim:` para segmentación
 * futura (drip de seguimiento 24h/72h, remarketing, etc.).
 */
async function storeSimLead(
  env: Record<string, unknown>,
  record: Record<string, unknown>,
): Promise<void> {
  const kv = env.EMAILS as KVNamespace | undefined;
  if (!kv || typeof kv.put !== 'function') {
    console.log('simulator-subscribe:lead-skipped (no EMAILS KV)', JSON.stringify(record));
    return;
  }
  const key = `sim:${record.ts}:${(record.email as string).toLowerCase()}`;
  try {
    await kv.put(key, JSON.stringify(record));
  } catch (err) {
    console.error('simulator-subscribe:KV EMAILS put failed:', err);
  }
}

/**
 * Escribe el código de acceso al KV SIMULATOR_BETA_CODES con prefix `beta:`
 * para reutilizar la validación existente en /api/simulator-session.
 */
async function storeAccessCode(
  env: Record<string, unknown>,
  code: string,
  nombrePila: string,
  emailHash: string,
): Promise<void> {
  const kv = env.SIMULATOR_BETA_CODES as KVNamespace | undefined;
  if (!kv || typeof kv.put !== 'function') {
    console.warn('simulator-subscribe:SIMULATOR_BETA_CODES KV no enlazado');
    return;
  }

  // Post-paywall: freemium con vigencia 240d. Pre-paywall: cohorte legacy.
  const postPaywall = isPostPaywall();
  const expiresAt = postPaywall
    ? new Date(Date.now() + FREEMIUM_VIGENCIA_DIAS * 24 * 60 * 60 * 1000).toISOString()
    : PREPAYWALL_EXPIRES_ISO;
  const cohort = postPaywall ? FREEMIUM_COHORT : PREPAYWALL_COHORT;
  const maxSessions = postPaywall ? FREEMIUM_MAX_SESSIONS : PREPAYWALL_MAX_SESSIONS;

  const record: BetaCodeRecord = {
    nombre_pila: nombrePila,
    email_hash: emailHash,
    max_sessions: maxSessions,
    sessions_used: 0,
    granted_at: new Date().toISOString(),
    expires_at: expiresAt,
    cohort,
  };

  try {
    await kv.put(`beta:${code}`, JSON.stringify(record));
  } catch (err) {
    console.error('simulator-subscribe:code write failed:', err);
    throw err;
  }
}

/**
 * Envía el email de bienvenida con el código de acceso.
 * Template Postmark alias: welcome-simulator-code
 * Modelo (fase pre-paywall):
 *   { first_name, access_code, access_url, expires_at_human }
 */
async function sendWelcomeCode(
  env: Record<string, unknown>,
  email: string,
  firstName: string,
  code: string,
): Promise<void> {
  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!token) {
    console.log('simulator-subscribe:postmark-skipped (no POSTMARK_SERVER_TOKEN)');
    return;
  }

  const accessUrl = `https://solcaciencia.com/simulador-entrevistas/sesion?codigo=${code}`;
  const postPaywall = isPostPaywall();
  const expiresAtHuman = postPaywall
    ? new Date(Date.now() + FREEMIUM_VIGENCIA_DIAS * 24 * 60 * 60 * 1000).toLocaleDateString(
        'es-MX',
        { year: 'numeric', month: 'long', day: 'numeric' },
      )
    : '7 de septiembre de 2026';

  try {
    const result = await sendEmailWithTemplate(token, {
      from: 'Oscar Solís <hola@solcaciencia.com>',
      to: email,
      templateAlias: 'welcome-simulator-code',
      templateModel: {
        first_name: firstName,
        access_code: code,
        access_url: accessUrl,
        expires_at_human: expiresAtHuman,
      },
      tag: 'welcome-simulator-code',
      metadata: { source: 'simulator-subscribe', cohort: PREPAYWALL_COHORT },
    });
    console.log('simulator-subscribe:postmark-sent', result.messageId, result.to);
  } catch (err) {
    if (err instanceof PostmarkError) {
      console.error('Postmark send failed:', err.status, JSON.stringify(err.body));
    } else {
      console.error('Postmark unexpected error:', err);
    }
    // No rethrow: el código ya se generó y se guardó; el envío es best-effort.
    // Si Postmark falla, Oscar recupera el código desde /api/simulator-beta-codes.
  }
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let body: SubscribeRequest;
  try {
    body = (await request.json()) as SubscribeRequest;
  } catch {
    return jsonResponse({ error: 'invalid_json', message: 'Body inválido.' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const name = (body.name ?? '').trim();
  const consent = body.consent === true;
  const country = body.country?.trim();

  if (!consent) {
    return jsonResponse(
      { error: 'consent_required', message: 'Debes aceptar la política de datos.' },
      400,
    );
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse(
      { error: 'invalid_email', message: 'Email inválido.' },
      400,
    );
  }
  if (name.length < 2 || name.length > 80) {
    return jsonResponse(
      { error: 'invalid_name', message: 'Nombre inválido (2 a 80 caracteres).' },
      400,
    );
  }

  const runtime = (locals as {
    runtime?: {
      env?: Record<string, unknown>;
      ctx?: { waitUntil?: (p: Promise<unknown>) => void };
    };
  }).runtime;
  const env = runtime?.env ?? {};
  const ctx = runtime?.ctx;
  const waitUntil = ctx?.waitUntil?.bind(ctx) ?? ((p: Promise<unknown>) => p);
  const ip = clientAddress ?? request.headers.get('cf-connecting-ip') ?? undefined;

  const code = generateAccessCode();
  const firstName = name.split(/\s+/)[0];
  const emailHash = await hashEmail(email);

  // Escritura del código al KV (bloqueante: si falla, no seguimos).
  try {
    await storeAccessCode(env, code, firstName, emailHash);
  } catch (err) {
    console.error('simulator-subscribe:code write critical failure:', err);
    return jsonResponse(
      { error: 'internal', message: 'No se pudo generar el código. Intenta de nuevo en un minuto.' },
      500,
    );
  }

  // UTMs sanitizadas (server-side allow-list + trim).
  const utms = extractUtms(body as unknown as Record<string, unknown>);

  const leadRecord: Record<string, unknown> = {
    source: 'simulator',
    email,
    name,
    country: country?.toLowerCase(),
    ip,
    ts: new Date().toISOString(),
    code,
    cohort: PREPAYWALL_COHORT,
    expires_at: PREPAYWALL_EXPIRES_ISO,
    max_sessions: PREPAYWALL_MAX_SESSIONS,
    ...utms,
  };

  // Escritura del lead + envío de Postmark en background (waitUntil).
  waitUntil(
    storeSimLead(env, leadRecord).catch((err) =>
      console.error('storeSimLead failed', err),
    ),
  );
  waitUntil(
    sendWelcomeCode(env, email, firstName, code).catch((err) =>
      console.error('sendWelcomeCode failed', err),
    ),
  );

  return jsonResponse(
    {
      ok: true,
      message: 'Suscrito. En un momento recibes tu código por email para hacer tu sesión.',
      // No devolvemos el código en la respuesta HTTP: obliga al usuario a
      // abrir el email (verifica que la dirección es válida y llega bien).
    },
    200,
  );
};
