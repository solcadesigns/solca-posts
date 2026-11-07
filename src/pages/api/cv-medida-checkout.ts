/**
 * /api/cv-medida-checkout · CV a la medida (6 nov 2026): guarda el pedido y crea la Stripe Checkout Session.
 *
 * POST body: { cv, vacante, texto_libre?, email, consent: true, marketing?, origen?, paginas?, aid?, ft?, lt?, interno? }
 * Respuesta: { ok: true, url } → la página redirige al checkout de Stripe (tarjeta u OXXO).
 *
 * Orden: valida → guarda el pedido en KV CV_LIMITS (`cvmd:<id>`, caducidad absoluta de 4 días, estado
 * esperando_pago) → crea la sesión con metadata { producto: 'cv-medida', cvmd_job: <id> } → el webhook
 * (/api/simulator-stripe-webhook) encola la generación al confirmar el pago. Nada se genera antes de pagar.
 *
 * Si falta STRIPE_SECRET_KEY o STRIPE_PRICE_ID_CV_MEDIDA no se guarda nada ni se cobra: error claro.
 * Mismo checkout que el simulador (pago único). Cupones apagados por default ("nada gratis antes de pagar"); se
 * prenden solo con la variable CVM_PERMITIR_CUPONES = '1' (p. ej., para la prueba con cupón al 100%). Una venta
 * con total 0 se marca como interna en `ventas` y no cuenta en el reporte. El vale OXXO vence al día siguiente
 * para que el pago llegue dentro de los 4 días del pedido.
 */

import type { APIRoute } from 'astro';
import { extractAttribution } from '../../lib/attribution';
import { readMarketing, CONSENT_VERSION, CONSENT_MSG } from '../../lib/consent';
import { esCorreoDePrueba } from '../../lib/simulator-test-sessions';
import { leerEntrada, detectarIdioma, CVM_OXXO_DIAS, CVM_CHECKOUT_EXPIRA_S } from '../../lib/cv-medida';
import { nuevoTrabajo, guardarTrabajo, jobKey, type KvLike } from '../../lib/cv-medida-queue';
import { registrarEventoCvm } from '../../lib/cv-medida-run';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Pedidos por IP al día: evita llenar KV con pedidos falsos. */
const MAX_POR_IP_DIA = 10;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function flattenForStripe(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flattenForStripe(v as Record<string, unknown>, key));
    else if (Array.isArray(v))
      v.forEach((item, i) => {
        if (item && typeof item === 'object') Object.assign(out, flattenForStripe(item as Record<string, unknown>, `${key}[${i}]`));
        else out[`${key}[${i}]`] = String(item);
      });
    else if (v !== undefined) out[key] = String(v);
  }
  return out;
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = (locals as { runtime?: { env: Record<string, unknown> } }).runtime?.env ?? {};
  const stripeKey = env.STRIPE_SECRET_KEY as string | undefined;
  const priceId = env.STRIPE_PRICE_ID_CV_MEDIDA as string | undefined;
  const kv = env.CV_LIMITS as KVNamespace | undefined;
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;

  if (!stripeKey || !priceId || !kv) {
    console.error('[cv-medida-checkout] Falta STRIPE_SECRET_KEY, STRIPE_PRICE_ID_CV_MEDIDA o CV_LIMITS');
    return json(503, {
      ok: false,
      error: 'config',
      message: 'El pago de CV a la medida todavía no está disponible. No se hizo ningún cargo. Escríbenos a hello@solcaciencia.com.',
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'invalid_json', message: 'Solicitud inválida.' });
  }

  const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
  if (body.consent !== true) return json(400, { ok: false, error: 'consent_required', message: CONSENT_MSG.privacidad_requerida });
  if (!EMAIL_RE.test(email) || email.length > 200) return json(400, { ok: false, error: 'invalid_email', message: 'Correo inválido.' });
  const entrada = leerEntrada(body);
  if (!entrada.ok) return json(400, { ok: false, error: entrada.error, message: entrada.mensaje });

  // Kill switch compartido: si la IA está en pausa no se vende.
  const simKV = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (simKV && (await simKV.get('anthropic_paused'))) {
    return json(503, { ok: false, error: 'paused', message: 'El servicio está en pausa por mantenimiento. No se hizo ningún cargo. Intenta más tarde.' });
  }

  // Tope por IP y día.
  const ipKey = `cvmd_ip:${new Date().toISOString().slice(0, 10)}:${clientAddress ?? 'sin-ip'}`;
  const nIp = Number.parseInt((await kv.get(ipKey)) ?? '0', 10) || 0;
  if (nIp >= MAX_POR_IP_DIA) return json(429, { ok: false, error: 'rate_limited', message: 'Demasiados pedidos desde esta conexión hoy. Intenta mañana.' });
  await kv.put(ipKey, String(nIp + 1), { expirationTtl: 60 * 60 * 26 });

  const attr = extractAttribution(body);
  const interno = attr.interno === true || esCorreoDePrueba(email);
  const idioma = detectarIdioma(entrada.v.vacante);
  const marketing = readMarketing(body);
  const now = Date.now();
  const job = nuevoTrabajo(
    {
      id: crypto.randomUUID(),
      email,
      cv: entrada.v.cv,
      vacante: entrada.v.vacante,
      textoLibre: entrada.v.textoLibre,
      origen: entrada.v.origen,
      paginas: entrada.v.paginas,
      idioma,
      marketing,
      consentVersion: CONSENT_VERSION,
      consentTs: new Date(now).toISOString(),
      attr,
      interno,
    },
    now,
  );
  await guardarTrabajo(kv as unknown as KvLike, job, now);

  const ev = { jobId: job.id, idioma, attr, interno, country: request.headers.get('cf-ipcountry') };
  await registrarEventoCvm(db, 'cvmedida_inicio', ev, {
    origen: job.origen,
    paginas: job.paginas ?? undefined,
    cv_length: job.cvLength,
    vacante_length: job.vacanteLength,
    texto_libre: job.textoLibreLength > 0,
    marketing,
  });

  // Fuente de la venta en metadata (mismo formato que el simulador; Stripe: 500 caracteres por valor).
  const fuente: Record<string, string> = {};
  const put = (k: string, v: string | undefined) => {
    if (v) fuente[k] = v.slice(0, 200);
  };
  put('aid', attr.aid);
  put('ft_source', attr.ft?.utm_source);
  put('ft_medium', attr.ft?.utm_medium);
  put('ft_campaign', attr.ft?.utm_campaign);
  put('ft_content', attr.ft?.utm_content);
  put('ft_ref_host', attr.ft?.ref_host);
  put('ft_landing', attr.ft?.landing_path);
  put('ft_ts', attr.ft?.ts);
  put('lt_source', attr.lt?.utm_source);
  put('lt_medium', attr.lt?.utm_medium);
  put('lt_campaign', attr.lt?.utm_campaign);
  put('lt_content', attr.lt?.utm_content);
  put('lt_ref_host', attr.lt?.ref_host);
  if (interno) fuente.interno = '1';

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(
        flattenForStripe({
          mode: 'payment',
          customer_email: email,
          line_items: [{ price: priceId, quantity: 1 }],
          metadata: {
            producto: 'cv-medida',
            cvmd_job: job.id,
            email,
            idioma,
            source: 'cv_a_la_medida',
            consent_version: CONSENT_VERSION,
            marketing: marketing ? '1' : '0',
            ...fuente,
          },
          payment_method_options: { oxxo: { expires_after_days: CVM_OXXO_DIAS } },
          expires_at: Math.floor(now / 1000) + CVM_CHECKOUT_EXPIRA_S,
          success_url: 'https://solcaciencia.com/cv-a-la-medida?pago=ok&session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'https://solcaciencia.com/cv-a-la-medida?pago=cancelado',
          ...(env.CVM_PERMITIR_CUPONES === '1' ? { allow_promotion_codes: 'true' } : {}),
          billing_address_collection: 'auto',
        }),
      ).toString(),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: { type?: string; code?: string } };
    if (!res.ok || !data.url) {
      // Solo tipo, código y status: el mensaje de Stripe puede repetir datos de la solicitud.
      console.error('[cv-medida-checkout] Stripe rechazó la sesión', JSON.stringify({ status: res.status, type: data.error?.type, code: data.error?.code }));
      throw new Error('stripe_rechazo');
    }
    await registrarEventoCvm(db, 'cvmedida_checkout', ev);
    return json(200, { ok: true, url: data.url });
  } catch (err) {
    if (!(err instanceof Error && err.message === 'stripe_rechazo')) console.error('[cv-medida-checkout] Stripe no respondió', err instanceof Error ? err.name : 'desconocido');
    // Sin sesión de pago no hay pedido: se borra lo que se guardó.
    await kv.delete(jobKey(job.id)).catch(() => {});
    return json(502, { ok: false, error: 'stripe', message: 'No pudimos abrir el pago. No se hizo ningún cargo. Reintenta en un momento.' });
  }
};
