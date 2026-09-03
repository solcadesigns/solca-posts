/**
 * /api/simulator-checkout · crea Stripe Checkout Session para el Simulador.
 *
 * Establecido: 2 sept 2026 (fase paywall · post-cierre pre-paywall del 7 sept).
 * Ver `_docs/PAYWALL_SIMULADOR.md` para el schema completo.
 *
 * POST body: { plan: 'basico' | 'premium', email: string, name?: string }
 * Respuesta: { ok: true, url: string } → frontend redirige a Stripe hosted checkout.
 *
 * Metadata inyectada al Stripe Session (la lee el webhook):
 *   - email (lowercased)
 *   - plan
 *   - source: 'simulator_landing'
 *
 * Idempotencia: NO se guarda estado local. Es responsabilidad del webhook.
 * Si el usuario abre el checkout múltiples veces y no completa, cada intento
 * es una Session distinta en Stripe (cost 0). Solo cuenta la que complete.
 *
 * Secrets requeridos:
 *   STRIPE_SECRET_KEY (sk_test_ o sk_live_)
 *   STRIPE_PRICE_ID_BASICO
 *   STRIPE_PRICE_ID_PREMIUM
 */

import type { APIRoute } from 'astro';

export const prerender = false;

type PaidPlan = 'basico' | 'premium';

interface CheckoutRequest {
  plan: PaidPlan;
  email: string;
  name?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_PLANS: PaidPlan[] = ['basico', 'premium'];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Stripe fetch helper · usa form-encoded como pide su API.
async function stripe(
  key: string,
  path: string,
  method: 'GET' | 'POST',
  bodyObj?: Record<string, unknown>,
): Promise<unknown> {
  const url = `https://api.stripe.com/v1/${path}`;
  const body = bodyObj ? new URLSearchParams(flattenForStripe(bodyObj)).toString() : undefined;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = (json as { error?: { message?: string } })?.error?.message ?? JSON.stringify(json);
    throw new Error(`Stripe ${method} /${path} → ${res.status}: ${err}`);
  }
  return json;
}

function flattenForStripe(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenForStripe(v as Record<string, unknown>, key));
    } else if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          Object.assign(out, flattenForStripe(item as Record<string, unknown>, `${key}[${idx}]`));
        } else {
          out[`${key}[${idx}]`] = String(item);
        }
      });
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env: Record<string, unknown> } }).runtime?.env ?? {};
  const stripeKey = env.STRIPE_SECRET_KEY as string | undefined;
  const priceBasico = env.STRIPE_PRICE_ID_BASICO as string | undefined;
  const pricePremium = env.STRIPE_PRICE_ID_PREMIUM as string | undefined;

  if (!stripeKey || !priceBasico || !pricePremium) {
    console.error('[simulator-checkout] Falta config Stripe en env');
    return jsonResponse(500, {
      ok: false,
      error: 'Servicio de pago temporalmente no disponible. Escribenos a hola@solcaciencia.com',
    });
  }

  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return jsonResponse(400, { ok: false, error: 'Body invalido' });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return jsonResponse(400, { ok: false, error: 'Email invalido' });
  }
  if (!VALID_PLANS.includes(body.plan)) {
    return jsonResponse(400, { ok: false, error: 'Plan invalido. Opciones: basico, premium.' });
  }

  const priceId = body.plan === 'basico' ? priceBasico : pricePremium;
  const firstName = (body.name ?? '').trim().split(/\s+/)[0] || '';

  try {
    const session = (await stripe(stripeKey, 'checkout/sessions', 'POST', {
      mode: 'payment', // one-shot, no subscription
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        email,
        plan: body.plan,
        source: 'simulator_landing',
        first_name: firstName,
      },
      // Success page pasa session_id vía query; la página `/gracias` puede pintarlo.
      success_url:
        'https://solcaciencia.com/simulador-entrevistas/gracias?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://solcaciencia.com/simulador-entrevistas/',
      allow_promotion_codes: 'true',
      // Guardamos también customer con email para futuros lookups
      billing_address_collection: 'auto',
    })) as { id: string; url: string };

    return jsonResponse(200, { ok: true, url: session.url, sessionId: session.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[simulator-checkout] Stripe error:', msg);
    return jsonResponse(502, {
      ok: false,
      error: 'No pudimos crear el checkout. Reintenta en un momento.',
    });
  }
};
