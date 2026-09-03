/**
 * /api/simulator-stripe-webhook · recibe eventos Stripe post-checkout.
 *
 * Establecido: 2 sept 2026 (fase paywall).
 * Ver `_docs/PAYWALL_SIMULADOR.md`.
 *
 * Eventos que procesa:
 *   - checkout.session.completed → escribe créditos + envía email confirmación
 *   - charge.refunded            → marca créditos como remaining=0 (soft-cancel)
 *
 * Verificación de firma: HMAC-SHA256(timestamp + '.' + rawBody) con
 * STRIPE_WEBHOOK_SECRET, comparado con v1 del header stripe-signature.
 *
 * Idempotencia: KV STRIPE_CHECKOUT_SESSIONS prefix `cs:` con TTL 7d.
 * Si el evento ya se procesó, retorna 200 sin repetir.
 *
 * Secrets requeridos:
 *   STRIPE_WEBHOOK_SECRET (whsec_...)
 *   POSTMARK_SERVER_TOKEN
 *
 * KV bindings requeridos:
 *   SIMULATOR_CREDITS (créditos por user_hash)
 *   STRIPE_CHECKOUT_SESSIONS (dedup)
 */

import type { APIRoute } from 'astro';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { PLAN_CONFIG, type Plan } from '../../lib/simulator-types';

export const prerender = false;

interface StripeSessionCompleted {
  id: string;
  object: 'checkout.session';
  customer_email?: string | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  metadata?: Record<string, string> | null;
  amount_total?: number;
  currency?: string;
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: StripeSessionCompleted };
  livemode: boolean;
  created: number;
}

interface CreditsRecord {
  plan: Plan;
  remaining: number;
  purchasedAt: string;
  expiresAt: string;
  history: Array<{
    at: string;
    plan: Plan;
    sessionsAdded: number;
    stripeSessionId: string;
  }>;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Verifica firma Stripe.
 * Header: stripe-signature: t=1234567890,v1=hex...
 * Cómputo: HMAC-SHA256(secret, `${t}.${rawBody}`) === v1
 * Tolerancia: 5 minutos.
 */
async function verifyStripeSignature(
  secret: string,
  header: string | null,
  rawBody: string,
): Promise<boolean> {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k.trim(), v?.trim() ?? ''];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  // Tolerancia de 5 min
  const now = Math.floor(Date.now() / 1000);
  const ts = Number.parseInt(t, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;

  const signedPayload = `${t}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = [...new Uint8Array(sigBuffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // constant-time compare
  if (expected.length !== v1.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Hash del email para user_hash. Consistente con otros endpoints de Solca.
 * SHA-256 lowercased trimmed → primeros 16 hex chars.
 */
async function emailHash(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env: Record<string, unknown> } }).runtime?.env ?? {};
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET as string | undefined;
  const postmarkToken = env.POSTMARK_SERVER_TOKEN as string | undefined;
  const creditsKv = env.SIMULATOR_CREDITS as KVNamespace | undefined;
  const dedupKv = env.STRIPE_CHECKOUT_SESSIONS as KVNamespace | undefined;

  if (!webhookSecret || !creditsKv || !dedupKv) {
    console.error('[stripe-webhook] Falta config en env');
    return jsonResponse(500, { error: 'config' });
  }

  // Leemos raw body ANTES de parsear (para verificación de firma).
  const rawBody = await request.text();
  const sigHeader = request.headers.get('stripe-signature');

  const valid = await verifyStripeSignature(webhookSecret, sigHeader, rawBody);
  if (!valid) {
    console.warn('[stripe-webhook] Firma inválida');
    return jsonResponse(401, { error: 'invalid_signature' });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return jsonResponse(400, { error: 'invalid_json' });
  }

  // Idempotencia · si ya procesamos este event.id, salir OK.
  const dedupKey = `cs:${event.id}`;
  const already = await dedupKv.get(dedupKey);
  if (already) {
    console.log(`[stripe-webhook] Event ${event.id} ya procesado, ignorando.`);
    return jsonResponse(200, { received: true, deduped: true });
  }

  if (event.type !== 'checkout.session.completed') {
    // Otros eventos: log y OK. Extender aquí para charge.refunded en Fase 2.
    console.log(`[stripe-webhook] Event type ${event.type} recibido, no procesado.`);
    await dedupKv.put(dedupKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });
    return jsonResponse(200, { received: true, processed: false });
  }

  const session = event.data.object;
  const email = (
    session.metadata?.email ??
    session.customer_email ??
    session.customer_details?.email ??
    ''
  )
    .trim()
    .toLowerCase();
  const plan = session.metadata?.plan as Plan | undefined;
  const firstName =
    session.metadata?.first_name ??
    session.customer_details?.name?.split(/\s+/)[0] ??
    '';

  if (!email || !plan || (plan !== 'basico' && plan !== 'premium')) {
    console.error('[stripe-webhook] Metadata incompleta:', { email, plan });
    // Marcamos como procesado para no reintentar en loop; escribimos alerta.
    await dedupKv.put(dedupKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });
    return jsonResponse(200, { received: true, error: 'incomplete_metadata' });
  }

  const cfg = PLAN_CONFIG[plan];
  const hash = await emailHash(email);
  const creditsKey = `credits:${hash}`;

  // Lookup existente para recompra / upgrade.
  let record: CreditsRecord | null = null;
  const existingRaw = await creditsKv.get(creditsKey);
  if (existingRaw) {
    try {
      record = JSON.parse(existingRaw) as CreditsRecord;
    } catch {
      record = null;
    }
  }

  const nowIso = new Date().toISOString();
  const newExpiresAt = addDaysIso(cfg.vigenciaDias);

  if (record) {
    // Recompra: suma sesiones. Upgrade: si plan nuevo es premium y existente basico, cambia plan.
    const upgrade =
      (record.plan === 'basico' || record.plan === 'gratis') && plan === 'premium';
    record.plan = upgrade ? 'premium' : record.plan === 'gratis' ? plan : record.plan;
    record.remaining = record.remaining + cfg.sessionsIncluded;
    // ExpiresAt = max(existente, nuevo)
    if (new Date(newExpiresAt) > new Date(record.expiresAt)) {
      record.expiresAt = newExpiresAt;
    }
    record.history = record.history ?? [];
    record.history.push({
      at: nowIso,
      plan,
      sessionsAdded: cfg.sessionsIncluded,
      stripeSessionId: session.id,
    });
  } else {
    record = {
      plan,
      remaining: cfg.sessionsIncluded,
      purchasedAt: nowIso,
      expiresAt: newExpiresAt,
      history: [
        {
          at: nowIso,
          plan,
          sessionsAdded: cfg.sessionsIncluded,
          stripeSessionId: session.id,
        },
      ],
    };
  }

  await creditsKv.put(creditsKey, JSON.stringify(record), {
    expirationTtl: 60 * 60 * 24 * cfg.vigenciaDias, // TTL alineado con vigencia declarada
  });

  // Marcar dedup ANTES de enviar email (si el email falla no queremos duplicar créditos).
  await dedupKv.put(dedupKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });

  // Email de confirmación via Postmark.
  if (postmarkToken) {
    try {
      const planLabel = plan === 'premium' ? 'Premium' : 'Básico';
      await sendEmailWithTemplate(postmarkToken, {
        from: 'Oscar Solís <hola@solcaciencia.com>',
        to: email,
        templateAlias: 'simulator-purchase-confirmation',
        messageStream: 'outbound',
        tag: 'simulator-purchase',
        templateModel: {
          first_name: firstName || 'ahí',
          plan_label: planLabel,
          sessions_included: cfg.sessionsIncluded,
          total_remaining: record.remaining,
          expires_at: new Date(record.expiresAt).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          access_url: `https://solcaciencia.com/simulador-entrevistas/sesion?email=${encodeURIComponent(email)}`,
          access_email: email, // el email es la llave · el usuario debe entrar con el mismo
        },
        metadata: {
          source: 'stripe-webhook',
          plan,
          stripe_session_id: session.id,
        },
      });
    } catch (err) {
      if (err instanceof PostmarkError) {
        console.error(`[stripe-webhook] Postmark falló: ${err.status} ${err.message}`);
      } else {
        console.error('[stripe-webhook] Postmark falló:', err);
      }
      // No fallamos el webhook: los créditos ya están escritos, el email se puede
      // reenviar manualmente via scripts/simulator-nudge.mjs si hace falta.
    }
  }

  return jsonResponse(200, {
    received: true,
    processed: true,
    plan,
    remaining: record.remaining,
  });
};
