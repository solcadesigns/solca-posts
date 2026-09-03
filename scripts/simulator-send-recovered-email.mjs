#!/usr/bin/env node
/**
 * scripts/simulator-send-recovered-email.mjs
 *
 * Envía un email al usuario cuya sesión fue recuperada manualmente tras
 * fallo 524 del Worker. Renderiza el reporte como HTML inline (Postmark) —
 * el usuario puede leerlo directamente o imprimirlo a PDF desde su cliente.
 *
 * Uso (desde website/):
 *   POSTMARK_SERVER_TOKEN='...' \
 *     node scripts/simulator-send-recovered-email.mjs report.json user.json
 *
 * O con --dry-run para preview sin enviar:
 *   node scripts/simulator-send-recovered-email.mjs report.json user.json --dry-run > preview.html
 *
 * Sin dependencias npm.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const DRY_RUN = process.argv.includes('--dry-run');
const TOKEN = process.env.POSTMARK_SERVER_TOKEN;

if (!DRY_RUN && !TOKEN) {
  console.error('ERROR: Falta POSTMARK_SERVER_TOKEN o usa --dry-run.');
  process.exit(1);
}

const reportPath = process.argv[2];
const userPath = process.argv[3];
if (!reportPath || !userPath) {
  console.error('Uso: node scripts/simulator-send-recovered-email.mjs report.json user.json [--dry-run]');
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
const user = JSON.parse(readFileSync(userPath, 'utf-8'));

if (!user.email) {
  console.error('ERROR: user.json sin campo email');
  process.exit(1);
}

const firstName = (user.name ?? '').trim().split(/\s+/)[0] || 'ahí';

// ── Helpers de render ──────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function fmt(n) {
  return typeof n === 'number' ? n.toFixed(1) : '—';
}

const s = report.summary ?? {};
const scores = s.scores ?? {};

// ── HTML del reporte ────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tu reporte del Simulador · Solca Ciencia</title>
</head>
<body style="margin:0;padding:0;background:#FAF9F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827;line-height:1.55;">
<div style="max-width:640px;margin:0 auto;padding:32px 24px;">

  <div style="border-left:4px solid #E77C3C;padding:14px 18px;background:#FFF7EE;border-radius:4px;margin-bottom:28px;">
    <p style="margin:0 0 6px;font-weight:600;color:#111827;">Hola ${esc(firstName)},</p>
    <p style="margin:0;font-size:14px;color:#4B5563;">
      Tu sesión del simulador se completó, pero la generación automática del reporte falló por
      un timeout en nuestra infraestructura. Regeneramos el reporte manualmente y aquí lo tienes
      completo. Pedimos disculpas por el rebote.
    </p>
  </div>

  <div style="border-bottom:2px solid #1F3A5F;padding-bottom:12px;margin-bottom:24px;">
    <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#4B5563;font-weight:600;">Simulador de Entrevistas · Reporte</p>
    <h1 style="margin:8px 0 0;font-size:24px;color:#1F3A5F;font-weight:700;">Tu sesión · ${esc(report.rol ?? 'práctica general')}</h1>
    <p style="margin:6px 0 0;font-size:13px;color:#4B5563;">${report.n_questions ?? 0} preguntas</p>
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin-bottom:20px;">
    <tr>
      ${['Técnico', 'Estructura', 'Especificidad', 'Alertas']
        .map((label, i) => {
          const val = i === 0 ? fmt(scores.tecnico)
            : i === 1 ? fmt(scores.estructura)
            : i === 2 ? fmt(scores.especificidad)
            : String(scores.alertas_count ?? 0);
          return `<td style="width:25%;padding:12px;background:#fff;border:1px solid #E5E1D8;border-radius:4px;text-align:left;vertical-align:top;">
            <div style="font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#4B5563;font-weight:600;">${label}</div>
            <div style="font-size:22px;color:#1F3A5F;font-weight:700;margin-top:4px;">${esc(val)}</div>
          </td>${i < 3 ? '<td style="width:6px;"></td>' : ''}`;
        })
        .join('')}
    </tr>
  </table>

  <div style="background:#F5F0E6;padding:12px 16px;border-radius:4px;margin-bottom:28px;font-size:13px;color:#4B5563;line-height:1.5;">
    <strong style="color:#111827;">Rango 0-5.</strong>
    <strong>Técnico</strong>: precisión pharma ·
    <strong>Estructura</strong>: método STAR (Situación-Tarea-Acción-Resultado) ·
    <strong>Especificidad</strong>: concreción vs. generalidades ·
    <strong>Alertas</strong>: señales de riesgo (fabricación, evasión). Diagnósticos, no calificaciones.
  </div>

  <h2 style="font-size:18px;color:#1F3A5F;margin:24px 0 12px;border-bottom:1px solid #E5E1D8;padding-bottom:6px;">Tus fortalezas</h2>
  <ol style="padding-left:20px;margin:0 0 20px;font-size:15px;color:#111827;">
    ${(s.fortalezas ?? []).map((x) => `<li style="margin-bottom:8px;">${esc(x)}</li>`).join('')}
  </ol>

  <h2 style="font-size:18px;color:#1F3A5F;margin:24px 0 12px;border-bottom:1px solid #E5E1D8;padding-bottom:6px;">Áreas de mejora</h2>
  <ol style="padding-left:20px;margin:0 0 20px;font-size:15px;color:#111827;">
    ${(s.areas_de_mejora ?? []).map((x) => `<li style="margin-bottom:8px;">${esc(x)}</li>`).join('')}
  </ol>

  <h2 style="font-size:18px;color:#1F3A5F;margin:24px 0 12px;border-bottom:1px solid #E5E1D8;padding-bottom:6px;">Vocabulario a incorporar</h2>
  <p style="margin:0 0 20px;font-size:14px;color:#111827;">
    ${
      (s.vocabulario_a_incorporar ?? []).length
        ? (s.vocabulario_a_incorporar ?? [])
            .map(
              (v) =>
                `<span style="display:inline-block;background:#fff;border:1px solid #E5E1D8;padding:4px 10px;margin:2px;border-radius:3px;font-size:13px;">${esc(v)}</span>`,
            )
            .join('')
        : '<em style="color:#4B5563;">Nada crítico ausente.</em>'
    }
  </p>

  <h2 style="font-size:18px;color:#1F3A5F;margin:24px 0 12px;border-bottom:1px solid #E5E1D8;padding-bottom:6px;">Recomendación final</h2>
  <p style="margin:0 0 24px;font-size:15px;color:#111827;">${esc(s.recomendacion_final ?? '—')}</p>

  ${
    report.cta && report.cta.title
      ? `<div style="background:#1F3A5F;color:#fff;padding:20px 22px;border-radius:6px;margin:28px 0;">
    <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#fff;">${esc(report.cta.title)}</h3>
    <p style="margin:0 0 14px;font-size:14px;color:#F5F0E6;line-height:1.5;">${esc(report.cta.description ?? '')}</p>
    ${report.cta.url ? `<a href="${esc(report.cta.url)}" style="display:inline-block;background:#E77C3C;color:#fff;font-weight:600;text-decoration:none;padding:10px 20px;border-radius:4px;font-size:14px;">Abrir recurso</a>` : ''}
  </div>`
      : ''
  }

  <h2 style="font-size:18px;color:#1F3A5F;margin:32px 0 12px;border-bottom:1px solid #E5E1D8;padding-bottom:6px;">Desglose por pregunta</h2>
  ${(report.questions_breakdown ?? [])
    .map((q) => {
      const sc = q.scores ?? {};
      return `<div style="background:#fff;border:1px solid #E5E1D8;border-radius:4px;padding:14px 18px;margin-bottom:12px;">
      <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#E77C3C;font-weight:700;">Pregunta ${esc(q.question_number)}</div>
      <p style="margin:6px 0 10px;font-size:14px;color:#111827;font-weight:600;line-height:1.4;">${esc(q.question_text)}</p>
      <p style="margin:0 0 10px;font-size:13px;color:#4B5563;font-style:italic;line-height:1.5;">"${esc(q.user_answer)}"</p>
      <p style="margin:0 0 6px;font-size:12px;color:#4B5563;">
        T ${fmt(sc.tecnico)} · E ${fmt(sc.estructura)} · Esp ${fmt(sc.especificidad)} · Alertas: ${esc(sc.alertas ?? '—')}
      </p>
      <p style="margin:8px 0 4px;font-size:13px;color:#111827;"><strong style="color:#1F3A5F;">Qué funcionó:</strong> ${esc(q.what_worked ?? '—')}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#111827;"><strong style="color:#1F3A5F;">Qué mejorar:</strong> ${esc(q.what_to_improve ?? '—')}</p>
      ${q.model_phrase ? `<p style="margin:8px 0 0;font-size:12px;color:#4B5563;background:#F5F0E6;padding:8px 10px;border-radius:3px;"><strong>Frase modelo:</strong> ${esc(q.model_phrase)}</p>` : ''}
    </div>`;
    })
    .join('')}

  <div style="border-top:1px solid #E5E1D8;margin-top:32px;padding-top:16px;font-size:12px;color:#4B5563;line-height:1.5;">
    <p style="margin:0 0 8px;">
      Este reporte se generó manualmente tras un fallo del sistema el 2 de septiembre. Ya
      aplicamos los ajustes para que no vuelva a pasar. Si tienes cualquier duda sobre la
      evaluación o quieres practicar otra sesión, escríbenos a
      <a href="mailto:hola@solcaciencia.com" style="color:#E77C3C;">hola@solcaciencia.com</a>.
    </p>
    <p style="margin:0;">— Oscar Solís · Solca Ciencia</p>
  </div>

</div>
</body>
</html>`;

// ── Text body para clientes de correo sin HTML ─────────────────────
const textBody = [
  `Hola ${firstName},`,
  ``,
  `Tu sesión del simulador se completó, pero la generación automática del reporte`,
  `falló por un timeout en nuestra infraestructura. Regeneramos el reporte manualmente`,
  `y aquí está el resumen. Pedimos disculpas por el rebote.`,
  ``,
  `SIMULADOR DE ENTREVISTAS · Reporte`,
  `Rol: ${report.rol ?? '(no especificado)'} · ${report.n_questions ?? 0} preguntas`,
  ``,
  `Scores (0-5):`,
  `  Técnico:       ${fmt(scores.tecnico)}`,
  `  Estructura:    ${fmt(scores.estructura)}`,
  `  Especificidad: ${fmt(scores.especificidad)}`,
  `  Alertas:       ${scores.alertas_count ?? 0}`,
  ``,
  `Fortalezas:`,
  ...(s.fortalezas ?? []).map((x, i) => `  ${i + 1}. ${x}`),
  ``,
  `Áreas de mejora:`,
  ...(s.areas_de_mejora ?? []).map((x, i) => `  ${i + 1}. ${x}`),
  ``,
  `Recomendación final:`,
  `  ${s.recomendacion_final ?? '—'}`,
  ``,
  report.cta && report.cta.title
    ? `${report.cta.title}\n  ${report.cta.description ?? ''}\n  ${report.cta.url ?? ''}`
    : '',
  ``,
  `Ver la versión HTML de este email para el desglose completo por pregunta.`,
  ``,
  `— Oscar Solís · Solca Ciencia`,
  `hola@solcaciencia.com`,
].join('\n');

if (DRY_RUN) {
  process.stdout.write(html);
  console.error(`[send] DRY-RUN · destinatario habría sido: ${user.email}`);
  console.error(`[send] HTML escrito a stdout · guárdalo con > preview.html y abre en navegador`);
  process.exit(0);
}

// ── Envío Postmark ─────────────────────────────────────────────────
console.error(`[send] enviando a ${user.email}...`);
const res = await fetch('https://api.postmarkapp.com/email', {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Postmark-Server-Token': TOKEN,
  },
  body: JSON.stringify({
    From: 'Oscar Solís <hola@solcaciencia.com>',
    To: user.email,
    Subject: `Tu reporte del Simulador (recuperado manualmente) · ${report.rol ?? 'práctica general'}`,
    HtmlBody: html,
    TextBody: textBody,
    MessageStream: 'outbound',
    Tag: 'simulator-recovered-report',
    Metadata: {
      source: 'simulator-recover-report',
      session_id: report.session_id ?? '',
      code: user.code ?? '',
    },
  }),
});

const json = await res.json();
if (!res.ok) {
  console.error(`[send] FALLÓ ${res.status}: ${JSON.stringify(json)}`);
  process.exit(1);
}
console.error(`[send] OK · MessageID ${json.MessageID}`);
