/**
 * Endpoint · Reconfirmación de correos comerciales (legado España) · 2 nov 2026.
 *
 * Enlace del correo único aviso-privacidad-2026-11: `/api/confirmar-correos?email=<e>&sig=<s>`, con
 * `sig = base64url(HMAC-SHA256(DRIP_UNSUB_SECRET, "reconfirmacion-es:" + email))` (src/lib/reconfirmacion.ts;
 * mismo esquema que drip-unsubscribe, con prefijo para que la firma de baja no sirva de alta).
 *
 * Dos pasos a propósito:
 * - GET valida la firma y muestra la casilla de texto y un botón. NO registra nada: los escáneres de enlaces de
 *   los proveedores de correo abren los links y un GET que registrara crearía consentimientos que nadie dio.
 * - POST (el botón) valida la firma otra vez y registra el opt-in:
 *   - KV EMAILS `sim:<ts>:<email>` con `source: 'reconfirmacion-es'`, consentFields(...,'reconfirmacion-es') y
 *     metadata consentKvMeta → blog-broadcast y drip-tick lo leen como opt-in sin cambios (mismo patrón que
 *     simulator-stripe-webhook con `simulador-pago`).
 *   - D1 `consentimientos` + evento `lead_captured` (registrarConsentimiento, form 'reconfirmacion-es').
 *   - Marca `reconfirm:<sha256 del correo>` para idempotencia (más el chequeo en D1, que no es eventual como KV).
 * - Idempotente, pero no para siempre: si la reconfirmación se revocó después (D1 `revocado_at`, o una baja
 *   `unsub:<email>:newsletter|comercial|all` en KV), se puede volver a confirmar. Una nueva confirmación borra las
 *   bajas `newsletter` y `comercial` de KV (es un alta nueva y expresa); NO borra `all`, `drip` ni las supresiones
 *   de Postmark, que solo se levantan a mano.
 * - Correos de prueba (esCorreoDePrueba) quedan con `interno: true` en KV y D1, fuera de las cuentas.
 */

import type { APIRoute } from 'astro';
import { emailHashFull } from '../../lib/attribution';
import { CONSENT_TEXT, consentFields, consentKvMeta, registrarConsentimiento } from '../../lib/consent';
import { RECONFIRM_FORM, RECONFIRM_MARKER_PREFIX, verifyReconfirm } from '../../lib/reconfirmacion';
import { esCorreoDePrueba } from '../../lib/simulator-test-sessions';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Texto que se ve y se acepta: el mismo de la casilla comercial del Simulador (CONSENT_VERSION vigente).
const TEXTO_CONSENTIMIENTO = CONSENT_TEXT.simulador.marketing;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function htmlResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function page(title: string, message: string, extra = ''): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title} · Solca Ciencia</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 3rem 1.5rem; }
  main { max-width: 560px; margin: 0 auto; background: white; padding: 2.5rem 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(15,23,42,.06); }
  h1 { font-size: 1.5rem; margin: 0 0 1rem; }
  p { line-height: 1.6; margin: 0 0 1rem; color: #334155; }
  a { color: #0ea5e9; }
  button { font: inherit; background: #0f172a; color: white; border: 0; border-radius: 8px; padding: .75rem 1.25rem; cursor: pointer; }
  small { color: #64748b; font-size: 0.85rem; }
</style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    ${extra}
    <small>Solca Ciencia · <a href="/privacidad">Aviso de privacidad</a></small>
  </main>
</body>
</html>`;
}

const AYUDA = 'Si el problema persiste, escribe a <a href="mailto:hello@solcaciencia.com">hello@solcaciencia.com</a>.';

interface Ctx {
  env: Record<string, unknown>;
  email: string;
  sig: string;
}

async function validar(c: Ctx): Promise<Response | null> {
  if (!c.email || !EMAIL_RE.test(c.email)) return htmlResponse(400, page('Enlace inválido', `El enlace no incluye un correo válido. ${AYUDA}`));
  const secret = (c.env.DRIP_UNSUB_SECRET as string | undefined) ?? '';
  if (!c.sig || !secret) return htmlResponse(400, page('Enlace inválido', `El enlace no incluye una firma válida. ${AYUDA}`));
  if (!(await verifyReconfirm(secret, c.email, c.sig))) {
    return htmlResponse(403, page('Firma inválida', `La firma del enlace no coincide; puede que se haya alterado al copiarlo. ${AYUDA}`));
  }
  if (!c.env.EMAILS) return htmlResponse(500, page('Error de configuración', `No pudimos procesar tu confirmación en este momento. ${AYUDA}`));
  return null;
}

/** Bajas comerciales vigentes en KV para el correo (las mismas que respeta blog-broadcast). */
async function bajasComerciales(kv: KVNamespace, email: string): Promise<string[]> {
  try {
    const res = await kv.list({ prefix: `unsub:${email}:`, limit: 100 });
    return res.keys
      .map((k: { name: string }) => k.name.slice(`unsub:${email}:`.length))
      .filter((scope: string) => scope === 'newsletter' || scope === 'comercial' || scope === 'all');
  } catch {
    return [];
  }
}

/**
 * ¿Ya hay una reconfirmación vigente? D1 manda si responde (la última fila `reconfirmacion-es` sin `revocado_at`);
 * si D1 no está o falla, decide la marca KV, salvo que haya una baja comercial en KV (entonces se puede reconfirmar).
 */
async function yaConfirmo(env: Record<string, unknown>, email: string, emailHash: string): Promise<boolean> {
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (db) {
    try {
      const row = await db
        .prepare('SELECT revocado_at FROM consentimientos WHERE email_hash = ? AND form = ? ORDER BY ts DESC LIMIT 1')
        .bind(emailHash, RECONFIRM_FORM)
        .first<{ revocado_at: string | null }>();
      if (row) return !row.revocado_at;
      // Sin filas en D1: puede ser una confirmación cuya escritura en D1 falló; se revisa KV.
    } catch {
      // sigue con KV
    }
  }
  const kv = env.EMAILS as KVNamespace;
  try {
    if (!(await kv.get(`${RECONFIRM_MARKER_PREFIX}${emailHash}`))) return false;
  } catch {
    return false;
  }
  // `all` no se levanta con la confirmación, así que no cuenta para reabrirla (si no, cada POST registraría otra vez).
  return (await bajasComerciales(kv, email)).filter((x) => x !== 'all').length === 0;
}

const YA = page('Ya estaba confirmado', 'Tu confirmación ya estaba registrada. No tienes que hacer nada más. Puedes darte de baja cuando quieras desde el enlace al pie de cada correo.');

export const GET: APIRoute = async ({ url, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
  const sig = url.searchParams.get('sig') ?? '';
  const err = await validar({ env, email, sig });
  if (err) return err;
  if (await yaConfirmo(env, email, await emailHashFull(email))) return htmlResponse(200, YA);
  const form = `<form method="post" action="/api/confirmar-correos">
      <input type="hidden" name="email" value="${esc(email)}">
      <input type="hidden" name="sig" value="${esc(sig)}">
      <p><strong>${esc(TEXTO_CONSENTIMIENTO)}</strong></p>
      <p><button type="submit">Sí, quiero recibirlos</button></p>
    </form>
    <p>Si no quieres recibirlos, no hagas nada: no te enviaremos correos comerciales.</p>`;
  return htmlResponse(200, page('Confirma tus correos', `Correo: ${esc(email)}`, form));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  let email = '';
  let sig = '';
  try {
    const fd = await request.formData();
    email = String(fd.get('email') ?? '').trim().toLowerCase();
    sig = String(fd.get('sig') ?? '');
  } catch {
    // cuerpo ilegible: validar() responde 400
  }
  const err = await validar({ env, email, sig });
  if (err) return err;

  const emailHash = await emailHashFull(email);
  if (await yaConfirmo(env, email, emailHash)) return htmlResponse(200, YA);

  const kv = env.EMAILS as KVNamespace;
  const ts = new Date().toISOString();
  const fields = consentFields(ts, true, RECONFIRM_FORM);
  const interno = esCorreoDePrueba(email) || email === 'hello@solcaciencia.com';
  try {
    await kv.put(`sim:${ts}:${email}`, JSON.stringify({ ts, email, source: RECONFIRM_FORM, ...fields, ...(interno ? { interno: true } : {}) }), {
      metadata: consentKvMeta(fields),
    });
  } catch (e) {
    console.error('confirmar-correos: KV put failed', String(e).slice(0, 200));
    return htmlResponse(500, page('Error al guardar', `Tu confirmación no se pudo guardar. ${AYUDA}`));
  }
  try {
    await kv.put(`${RECONFIRM_MARKER_PREFIX}${emailHash}`, JSON.stringify({ ts }));
  } catch (e) {
    console.warn('confirmar-correos: marker put failed', String(e).slice(0, 200));
  }
  // Alta nueva y expresa: quita las bajas `newsletter` y `comercial` de KV para que blog-broadcast y drip-tick la
  // respeten. `all` (puesta a mano) y las supresiones de Postmark no se tocan.
  for (const scope of await bajasComerciales(kv, email)) {
    if (scope === 'all') continue;
    try {
      await kv.delete(`unsub:${email}:${scope}`);
    } catch (e) {
      console.warn('confirmar-correos: unsub delete failed', scope, String(e).slice(0, 200));
    }
  }
  await registrarConsentimiento(env.SIMULATOR_METRICS_DB as D1Database | undefined, {
    ts,
    emailHash,
    form: RECONFIRM_FORM,
    marketing: true,
    stage: 'reconfirmacion',
    utms: { utm_source: 'email', utm_medium: 'broadcast', utm_campaign: 'aviso-privacidad-2026-11' },
    country: request.headers.get('cf-ipcountry'),
    ...(interno ? { attr: { interno: true as const } } : {}),
  });
  return htmlResponse(
    200,
    page('Listo, quedó confirmado', 'Gracias. Vas a recibir el newsletter Solca Insight y correos con recursos y ofertas de Solca Ciencia. Puedes darte de baja cuando quieras desde el enlace al pie de cada correo.'),
  );
};
