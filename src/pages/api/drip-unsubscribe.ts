/**
 * Endpoint · Kill switch específico del drip de bienvenida.
 *
 * URL en el footer de cada email drip: `/api/drip-unsubscribe?email=<e>&sig=<s>`
 * donde `sig = base64url(HMAC-SHA256(DRIP_UNSUB_SECRET, email))`.
 *
 * Efecto: setea `unsub:<email>:drip` en KV EMAILS. El próximo tick del drip
 * skipea a este lead. NO afecta welcomes ni broadcasts del blog — el lector
 * puede pedir salirse del drip sin perder Solca Insight.
 *
 * Auth: solo por HMAC firmado. Sin sesión, sin form. Un enlace de un clic.
 *
 * Responde HTML de confirmación (o error) porque el usuario aterriza aquí
 * desde el email.
 */

import type { APIRoute } from 'astro';
import { hmacVerifyEmail } from '../../lib/drip';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function htmlResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
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
  h1 { font-size: 1.5rem; margin: 0 0 1rem; color: #0f172a; }
  p { line-height: 1.6; margin: 0 0 1rem; color: #334155; }
  a { color: #0ea5e9; }
  small { color: #64748b; font-size: 0.85rem; }
</style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    ${extra}
    <small>Solca Ciencia · <a href="/">solcaciencia.com</a></small>
  </main>
</body>
</html>`;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};
  const kv = env.EMAILS as KVNamespace | undefined;
  const secret = (env.DRIP_UNSUB_SECRET as string | undefined) ?? '';

  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
  const sig = url.searchParams.get('sig') ?? '';

  if (!email || !EMAIL_RE.test(email)) {
    return htmlResponse(
      400,
      page('Link inválido', 'El enlace no incluye un email válido. Si el problema persiste, escribe a <a href="mailto:hello@solcaciencia.com">hello@solcaciencia.com</a>.'),
    );
  }
  if (!sig || !secret) {
    return htmlResponse(
      400,
      page('Link inválido', 'El enlace no incluye una firma válida. Si el problema persiste, escribe a <a href="mailto:hello@solcaciencia.com">hello@solcaciencia.com</a>.'),
    );
  }

  const ok = await hmacVerifyEmail(secret, email, sig);
  if (!ok) {
    return htmlResponse(
      403,
      page('Firma inválida', 'La firma del enlace no coincide. Es posible que el link se haya alterado al copiarlo. Si tu intención era darte de baja de esta secuencia, escribe a <a href="mailto:hello@solcaciencia.com">hello@solcaciencia.com</a> y lo hacemos manualmente.'),
    );
  }

  if (!kv) {
    return htmlResponse(
      500,
      page('Error de configuración', 'No pudimos completar la baja en este momento. Escribe a <a href="mailto:hello@solcaciencia.com">hello@solcaciencia.com</a> y lo hacemos manualmente.'),
    );
  }

  try {
    await kv.put(
      `unsub:${email}:drip`,
      JSON.stringify({ ts: new Date().toISOString(), via: 'drip-unsubscribe' }),
    );
  } catch (err) {
    console.error('drip-unsubscribe KV put failed', err);
    return htmlResponse(
      500,
      page('Error al procesar', 'La baja no se pudo guardar. Escribe a <a href="mailto:hello@solcaciencia.com">hello@solcaciencia.com</a> y lo hacemos manualmente.'),
    );
  }

  return htmlResponse(
    200,
    page(
      'Baja registrada',
      `Listo. Ya no vas a recibir más emails de la secuencia de bienvenida.`,
      `<p>Sigues suscrito al newsletter Solca Insight (los emails semanales del blog). Si también quieres salir de esa lista, contesta a cualquier newsletter con "unsub".</p>`,
    ),
  );
};

// Aceptamos POST también por si algún cliente convierte el link en form-submit.
export const POST = GET;
