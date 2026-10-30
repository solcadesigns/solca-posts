/**
 * /api/simulator-stripe-webhook · recibe eventos Stripe post-checkout.
 *
 * Establecido: 2 sept 2026 (fase paywall).
 * Ver `_docs/PAYWALL_SIMULADOR.md`.
 *
 * Eventos que procesa:
 *   - checkout.session.completed (pagado)    → escribe créditos + envía email confirmación
 *   - checkout.session.async_payment_succeeded → igual, para OXXO (pago diferido, 30 oct 2026)
 *   - completed con payment_status 'unpaid' (ficha OXXO) y async_payment_failed → solo log
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
 *
 * Libro de ventas (30 oct 2026, P1 consultoría): después de entregar, escribe una fila en D1 `ventas`
 * (migrations/0009_ventas_stripe.sql) con monto, plan, email_hash (sha256 completo, sin correo en claro)
 * y la fuente que mandó el checkout en metadata (aid, ft_*, lt_*). Es best-effort: si D1 falla, la entrega
 * sigue igual. `charge.refunded` marca la fila como reembolsada (agregar ese evento en el endpoint de Stripe).
 * Opcional: STRIPE_SECRET_KEY para leer comisión y neto de la balance transaction.
 */

import type { APIRoute } from 'astro';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { PLAN_CONFIG, type Plan } from '../../lib/simulator-types';
import { emailHashFull } from '../../lib/attribution';

export const prerender = false;

interface StripeSessionCompleted {
  id: string;
  object: 'checkout.session';
  customer_email?: string | null;
  customer_details?: {
    email?: string | null;
    name?: string | null;
    address?: { country?: string | null } | null; // 30 oct 2026: país para el libro de ventas
  } | null;
  metadata?: Record<string, string> | null;
  amount_total?: number;
  currency?: string;
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required';
  // 30 oct 2026 (libro de ventas)
  payment_intent?: string | null;
  payment_method_types?: string[];
}

// charge.refunded (30 oct 2026): data.object es un Charge, no una Checkout Session.
interface StripeCharge {
  id: string;
  object: 'charge';
  payment_intent?: string | null;
  amount?: number;
  amount_refunded?: number;
  refunded?: boolean;
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

/**
 * Genera código único legible SIM-XXXXXXXX (8 chars alfanum sin ambigüedades).
 * Mismo formato que simulator-subscribe.ts para consistencia con la fase beta.
 * Excluye O/0/I/1 para leerse bien copiado del email.
 */
function generateAccessCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SIM-';
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

// ── Libro de ventas (30 oct 2026, P1) ───────────────────────────────
// Todo aquí es best-effort: nunca lanza ni cambia la respuesta del webhook, para no tocar la entrega.
const meta = (m: Record<string, string> | null | undefined, k: string, max = 200): string | null => {
  const v = m?.[k];
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
};

async function registrarVenta(
  db: D1Database | undefined,
  session: StripeSessionCompleted,
  plan: Plan,
  email: string,
  livemode: boolean,
  eventType: string,
): Promise<void> {
  if (!db) return;
  try {
    const m = session.metadata;
    await db
      .prepare(
        `INSERT OR IGNORE INTO ventas
          (id, pasarela, creado, producto, plan, monto, moneda, payment_intent, metodo, email_hash, aid,
           ft_source, ft_medium, ft_campaign, ft_content, ft_ref_host, ft_landing, ft_ts,
           lt_source, lt_medium, lt_campaign, lt_content, lt_ref_host, pais, interno, livemode, estado)
         VALUES (?, 'stripe', ?, 'simulador', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pagada')`,
      )
      .bind(
        session.id,
        new Date().toISOString(),
        plan,
        typeof session.amount_total === 'number' ? session.amount_total / 100 : null,
        session.currency ? session.currency.toUpperCase().slice(0, 3) : null,
        typeof session.payment_intent === 'string' ? session.payment_intent.slice(0, 100) : null,
        // payment_method_types es lo que ofrecía el checkout; OXXO solo entrega por async_payment_succeeded.
        (eventType === 'checkout.session.async_payment_succeeded' ? 'oxxo' : session.payment_method_types?.includes('card') ? 'card' : session.payment_method_types?.[0])?.slice(0, 30) ?? null,
        await emailHashFull(email),
        meta(m, 'aid', 36),
        meta(m, 'ft_source'), meta(m, 'ft_medium'), meta(m, 'ft_campaign'), meta(m, 'ft_content'),
        meta(m, 'ft_ref_host'), meta(m, 'ft_landing'), meta(m, 'ft_ts', 30),
        meta(m, 'lt_source'), meta(m, 'lt_medium'), meta(m, 'lt_campaign'), meta(m, 'lt_content'), meta(m, 'lt_ref_host'),
        session.customer_details?.address?.country?.slice(0, 2) ?? null,
        meta(m, 'interno') === '1' ? 1 : 0,
        livemode ? 1 : 0,
      )
      .run();
  } catch (err) {
    console.error('[stripe-webhook] ventas insert failed (la entrega no se afecta):', err);
  }
}

// Comisión y neto desde la balance transaction del cargo. Una llamada GET a Stripe con tope de 4 s.
async function completarComision(
  db: D1Database | undefined,
  stripeKey: string | undefined,
  session: StripeSessionCompleted,
): Promise<void> {
  if (!db || !stripeKey || typeof session.payment_intent !== 'string') return;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(session.payment_intent)}?expand[]=latest_charge.balance_transaction`,
      { headers: { Authorization: `Bearer ${stripeKey}` }, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return;
    const pi = (await res.json()) as {
      latest_charge?: { balance_transaction?: { fee?: number; net?: number; currency?: string } | string | null } | string | null;
    };
    const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    const bt = charge && typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null;
    if (!bt || typeof bt.fee !== 'number' || typeof bt.net !== 'number') return; // aún no liquidado; queda null
    await db
      .prepare(`UPDATE ventas SET comision = ?, neto = ?, moneda_neto = ?, actualizado = ? WHERE id = ? AND comision IS NULL`)
      .bind(bt.fee / 100, bt.net / 100, bt.currency ? bt.currency.toUpperCase().slice(0, 3) : null, new Date().toISOString(), session.id)
      .run();
  } catch (err) {
    console.warn('[stripe-webhook] comisión no disponible:', err);
  }
}

async function registrarReembolso(db: D1Database | undefined, charge: StripeCharge): Promise<void> {
  if (!db || typeof charge.payment_intent !== 'string') return;
  try {
    const total = charge.refunded === true || ((charge.amount ?? 0) > 0 && (charge.amount_refunded ?? 0) >= (charge.amount ?? 0));
    await db
      .prepare(`UPDATE ventas SET estado = ?, monto_reembolsado = ?, actualizado = ? WHERE payment_intent = ? AND (monto_reembolsado IS NULL OR monto_reembolsado <= ?)`)
      .bind(
        total ? 'reembolsada' : 'reembolso_parcial',
        typeof charge.amount_refunded === 'number' ? charge.amount_refunded / 100 : null,
        new Date().toISOString(),
        charge.payment_intent,
        typeof charge.amount_refunded === 'number' ? charge.amount_refunded / 100 : 0,
      )
      .run();
  } catch (err) {
    console.error('[stripe-webhook] reembolso no registrado:', err);
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env: Record<string, unknown> } }).runtime?.env ?? {};
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET as string | undefined;
  const postmarkToken = env.POSTMARK_SERVER_TOKEN as string | undefined;
  const creditsKv = env.SIMULATOR_CREDITS as KVNamespace | undefined;
  const dedupKv = env.STRIPE_CHECKOUT_SESSIONS as KVNamespace | undefined;
  const ventasDb = env.SIMULATOR_METRICS_DB as D1Database | undefined; // libro de ventas (opcional)

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

  // 30 oct 2026: OXXO es un pago diferido. checkout.session.completed llega con
  // payment_status 'unpaid' al generar la ficha; las sesiones se entregan hasta
  // checkout.session.async_payment_succeeded (pago confirmado en tienda).
  // 30 oct 2026: reembolso → marca la fila del libro de ventas. No toca créditos ni entrega.
  if (event.type === 'charge.refunded') {
    await registrarReembolso(ventasDb, event.data.object as unknown as StripeCharge);
    await dedupKv.put(dedupKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });
    return jsonResponse(200, { received: true, processed: 'refund' });
  }

  const session = event.data.object;
  const entrega =
    (event.type === 'checkout.session.completed' && session.payment_status !== 'unpaid') ||
    (event.type === 'checkout.session.async_payment_succeeded' && session.payment_status === 'paid');
  if (!entrega) {
    // Otros eventos (incluye ficha OXXO sin pagar y async_payment_failed): log y OK.
    console.log(
      `[stripe-webhook] Event type ${event.type} recibido, no procesado (payment_status=${session.payment_status ?? 'n/a'}, session=${session.id}).`,
    );
    await dedupKv.put(dedupKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });
    return jsonResponse(200, { received: true, processed: false });
  }

  // Una sola entrega por Checkout Session (Stripe puede mandar el mismo evento más de una vez).
  if (await dedupKv.get(`stripe_session:${session.id}`)) {
    await dedupKv.put(dedupKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });
    return jsonResponse(200, { received: true, deduped: 'session' });
  }

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

  // ── Auth por código SIM-XXXXXXXX (3 sept 2026) ─────────────────
  // Reusa el mecanismo beta: escribe record en SIMULATOR_BETA_CODES con
  // cohort='paywall' y plan. `validateBetaCode` en simulator-session ya
  // maneja este KV — solo agregamos que si cohort='paywall' se propague el plan.
  const accessCode = generateAccessCode();
  const betaCodesKv = env.SIMULATOR_BETA_CODES as KVNamespace | undefined;
  if (betaCodesKv) {
    const betaRecord = {
      nombre_pila: firstName || undefined,
      email, // 9 sept 2026: guardamos email plano para que el cron async pueda
             // enviar el reporte por Postmark cuando el sync path falla y cae
             // a chunks. Antes solo teníamos email_hash (irreversible).
      email_hash: hash,
      max_sessions: cfg.sessionsIncluded,
      sessions_used: 0,
      granted_at: nowIso,
      expires_at: newExpiresAt,
      cohort: 'paywall' as const,
      plan, // 'basico' | 'premium' — lo lee handleInit para override del plan por default
    };
    try {
      await betaCodesKv.put(`beta:${accessCode}`, JSON.stringify(betaRecord), {
        expirationTtl: 60 * 60 * 24 * cfg.vigenciaDias,
      });
    } catch (err) {
      console.error('[stripe-webhook] beta code write failed:', err);
    }
  }

  // v3 (11 sept 2026): índice inverso `stripe_session:{sessionId}` → SIM-XXX
  // para que la página /gracias pueda hacer polling con el session_id del URL
  // y mostrar el código en pantalla inmediatamente después del pago.
  // TTL 7 días: suficiente para que el user recupere el código; expira solo
  // porque el session_id ya no debe usarse para nada tras el pago.
  try {
    await dedupKv.put(`stripe_session:${session.id}`, accessCode, {
      expirationTtl: 60 * 60 * 24 * 7,
    });
  } catch (err) {
    console.error('[stripe-webhook] stripe_session index write failed:', err);
  }

  // Libro de ventas (30 oct 2026): después de entregar y antes de marcar el dedup, para que un fallo
  // de créditos (que hace reintentar a Stripe) no deje una venta sin sesiones. INSERT OR IGNORE por session.id.
  await registrarVenta(ventasDb, session, plan, email, event.livemode !== false, event.type);

  // Marcar dedup ANTES de enviar email (si el email falla no queremos duplicar créditos).
  // Si falla la escritura de créditos, el evento queda sin marcar y Stripe reintenta.
  await dedupKv.put(dedupKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });

  // Email de confirmación via Postmark.
  if (postmarkToken) {
    try {
      const planLabel = plan === 'premium' ? 'Premium' : 'Básico';
      // Cupón Premium: 10 sept 2026 · 40% off Curso Solca CV+ATS+LinkedIn.
      // Se entrega solo a Premium al comprar. Override con env HOTMART_COUPON_PREMIUM.
      // El template Postmark simulator-purchase-confirmation usa condicionales
      // Mustache: {{#coupon_code}}...{{/coupon_code}} para mostrar la sección
      // solo cuando existe el cupón. Básico recibe strings vacíos.
      const premiumCoupon =
        plan === 'premium'
          ? (env.HOTMART_COUPON_PREMIUM as string | undefined) ?? 'SIMULADOR40'
          : '';
      const courseUrl =
        plan === 'premium'
          ? 'https://solcadesigns.hotmart.host/cv-en-ciencias-biologicas-y-de-de-la-salud-ats-linkedin-e78259bd-c882-4b61-b496-9d3da84d06b2'
          : '';
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
          access_code: accessCode,
          access_url: `https://solcaciencia.com/simulador-entrevistas/?codigo=${accessCode}`,
          coupon_code: premiumCoupon,
          course_url: courseUrl,
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

  // Comisión y neto (best-effort, al final para no retrasar la entrega ni el correo).
  await completarComision(ventasDb, env.STRIPE_SECRET_KEY as string | undefined, session);

  return jsonResponse(200, {
    received: true,
    processed: true,
    plan,
    remaining: record.remaining,
  });
};
