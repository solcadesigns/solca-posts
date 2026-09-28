#!/usr/bin/env node
/**
 * scripts/send-oneoff-email.mjs
 *
 * Envía un email individual vía Postmark. Útil para one-offs (feedback requests,
 * respuestas manuales, disculpas) sin depender de Gmail SMTP.
 *
 * Uso:
 *   POSTMARK_SERVER_TOKEN='...' \
 *     node scripts/send-oneoff-email.mjs \
 *     "destino@example.com" \
 *     "Nombre del destinatario" \
 *     "Asunto del email" \
 *     mensaje.txt
 *
 * Args:
 *   1. Email destino
 *   2. Nombre destinatario (se usa como "Hola [Nombre]" en el greeting)
 *   3. Asunto
 *   4. Path a archivo .txt con el cuerpo del mensaje (soporta multi-línea)
 *
 * From fijo: "Oscar Solís <hola@solcaciencia.com>"
 * MessageStream: outbound
 * Tag: oneoff
 */

import { readFileSync } from 'node:fs';

const TOKEN = process.env.POSTMARK_SERVER_TOKEN;
if (!TOKEN) {
  console.error('ERROR: Falta POSTMARK_SERVER_TOKEN en env.');
  process.exit(1);
}

const [email, name, subject, bodyPath] = process.argv.slice(2);
if (!email || !name || !subject || !bodyPath) {
  console.error('Uso: node scripts/send-oneoff-email.mjs email name subject body.txt');
  process.exit(1);
}

let bodyText;
try {
  bodyText = readFileSync(bodyPath, 'utf-8');
} catch (err) {
  console.error(`ERROR leyendo ${bodyPath}: ${err.message}`);
  process.exit(1);
}

// Sustituir [Nombre] en el cuerpo si aparece
const finalBody = bodyText.replaceAll('[Nombre]', name).replaceAll('{{name}}', name);

const htmlBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111827;max-width:600px;">${finalBody
  .split('\n\n')
  .map((p) => `<p style="margin:0 0 14px;">${p.replaceAll('\n', '<br>')}</p>`)
  .join('')}</div>`;

console.error(`[oneoff] enviando a ${email} · "${subject}"...`);
const res = await fetch('https://api.postmarkapp.com/email', {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Postmark-Server-Token': TOKEN,
  },
  body: JSON.stringify({
    From: 'Oscar Solís <hola@solcaciencia.com>',
    To: email,
    Subject: subject,
    TextBody: finalBody,
    HtmlBody: htmlBody,
    MessageStream: 'outbound',
    Tag: 'oneoff',
    Metadata: { source: 'send-oneoff-email.mjs' },
  }),
});

const json = await res.json();
if (!res.ok) {
  console.error(`[oneoff] FALLÓ ${res.status}:`, JSON.stringify(json));
  process.exit(1);
}
console.error(`[oneoff] OK · MessageID ${json.MessageID}`);
