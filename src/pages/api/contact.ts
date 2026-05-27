import type { APIRoute } from 'astro';

export const prerender = false;

interface ContactRequest {
  name: string;
  email: string;
  topic: string;
  message: string;
  consent?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE = 20;
const MAX_MESSAGE = 3000;
const MAX_NAME = 100;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function storeContact(
  runtime: { env?: Record<string, unknown> } | undefined,
  record: Record<string, unknown>,
): Promise<void> {
  const kv = runtime?.env?.CONTACTS as KVNamespace | undefined;
  if (kv && typeof kv.put === 'function') {
    const key = `contact:${record.ts}:${(record.email as string).toLowerCase()}`;
    try {
      await kv.put(key, JSON.stringify(record));
    } catch (err) {
      console.error('KV put (contact) failed:', err);
    }
  } else {
    // MVP: log a console (visible via `wrangler tail`)
    console.log('contact:received', JSON.stringify(record));
  }
}

/**
 * Optional: si hay RESEND_API_KEY configurada, manda email via Resend.
 * Si no, solo log a console + KV.
 */
async function forwardEmail(
  runtime: { env?: Record<string, unknown> } | undefined,
  record: Record<string, unknown>,
): Promise<void> {
  const apiKey = runtime?.env?.RESEND_API_KEY as string | undefined;
  const toAddress = (runtime?.env?.CONTACT_FORWARD_TO as string | undefined) ?? 'solcadesigns@gmail.com';
  const fromAddress = (runtime?.env?.CONTACT_FROM as string | undefined) ?? 'onboarding@resend.dev';
  if (!apiKey) return;

  const subject = `[Solca contacto · ${record.topic}] ${record.name}`;
  const text = [
    `Nombre: ${record.name}`,
    `Email: ${record.email}`,
    `Tema: ${record.topic}`,
    `Recibido: ${record.ts}`,
    `IP: ${record.ip ?? 'n/d'}`,
    '',
    '— Mensaje —',
    record.message,
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toAddress],
        reply_to: record.email,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend forwarding failed:', res.status, errText);
    }
  } catch (err) {
    console.error('Resend fetch error:', err);
  }
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let body: ContactRequest;
  try {
    body = (await request.json()) as ContactRequest;
  } catch {
    return jsonResponse({ error: 'invalid_json', message: 'Body inválido' }, 400);
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const topic = (body.topic ?? '').trim();
  const message = (body.message ?? '').trim();
  const consent = body.consent === true;

  if (!consent) {
    return jsonResponse(
      { error: 'consent_required', message: 'Debes aceptar la política de datos.' },
      400,
    );
  }
  if (name.length < 2 || name.length > MAX_NAME) {
    return jsonResponse(
      { error: 'invalid_name', message: 'Nombre inválido.' },
      400,
    );
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse(
      { error: 'invalid_email', message: 'Email inválido.' },
      400,
    );
  }
  if (!topic) {
    return jsonResponse(
      { error: 'invalid_topic', message: 'Selecciona un tema.' },
      400,
    );
  }
  if (message.length < MIN_MESSAGE) {
    return jsonResponse(
      { error: 'message_too_short', message: `Mensaje muy corto (mínimo ${MIN_MESSAGE} caracteres).` },
      400,
    );
  }
  if (message.length > MAX_MESSAGE) {
    return jsonResponse(
      { error: 'message_too_long', message: `Mensaje excede ${MAX_MESSAGE} caracteres.` },
      400,
    );
  }

  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const ip = clientAddress ?? request.headers.get('cf-connecting-ip');
  const record = {
    name,
    email,
    topic,
    message,
    ip,
    ts: new Date().toISOString(),
    userAgent: request.headers.get('user-agent'),
  };

  // Fire-and-forget storage + forwarding
  storeContact(runtime as { env?: Record<string, unknown> }, record).catch((err) =>
    console.error('storeContact failed', err),
  );
  forwardEmail(runtime as { env?: Record<string, unknown> }, record).catch((err) =>
    console.error('forwardEmail failed', err),
  );

  return jsonResponse({ ok: true, message: 'Mensaje recibido' }, 200);
};
