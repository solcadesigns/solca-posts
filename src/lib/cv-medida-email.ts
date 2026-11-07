/**
 * CV a la medida · correos de servicio (6 nov 2026). HtmlBody/TextBody armados aquí, como src/lib/cv-review-email.ts;
 * el DOCX va adjunto (Postmark Attachments). Archivo puro, probado con `node scripts/test-cv-medida.mjs`.
 *
 * Reglas: sin "gratis"; sin promesas de entrevista; aviso de que lo redactó una IA y hay que revisarlo; los
 * marcadores `[...]` se listan para que la persona los complete o borre; la regla de reembolso exacta de términos.
 */

import type { CvMedida, CvmReporte, EstadoRequisito } from './cv-medida.ts';

export const CVM_EMAIL_FROM = 'Oscar Solís <hola@solcaciencia.com>';
export const CVM_EMAIL_VERSION = 'cvm-e1-2026-11';
const SITE = 'https://solcaciencia.com';

const ESTADO: Record<EstadoRequisito, { sym: string; label: string; color: string }> = {
  cumple: { sym: '●', label: 'Cumple', color: '#2F7D4F' },
  parcial: { sym: '■', label: 'Parcial', color: '#B7791F' },
  no_cumple: { sym: '▲', label: 'No cumple', color: '#B23A2A' },
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function enlaceDescarga(downloadId: string): string {
  return `${SITE}/api/cv-medida-descarga?id=${encodeURIComponent(downloadId)}`;
}

/** Avisos del filtro contra invención, en palabras. */
export function avisosFiltro(rep: CvmReporte): string[] {
  const out: string[] = [];
  const quitadas = rep.vinetas_quitadas_cita + rep.vinetas_quitadas_cifra + rep.vinetas_quitadas_sigla;
  if (quitadas > 0)
    out.push(
      `Quitamos ${quitadas} ${quitadas === 1 ? 'viñeta' : 'viñetas'} porque no pudimos confirmar en tu CV o en tu texto todo lo que decía${rep.vinetas_quitadas_cifra ? ' (por ejemplo, una cifra que no aparece en lo que enviaste)' : ''}.`,
    );
  if (rep.entradas_quitadas + rep.items_quitados > 0)
    out.push('Dejamos fuera algunos puestos, estudios o elementos de lista que no encontramos tal cual en lo que enviaste.');
  if (rep.frases_resumen_quitadas > 0) out.push('Recortamos el resumen para que no lleve cifras ni siglas que no estén en tu CV.');
  if (rep.contacto_quitado > 0) out.push('Algún dato de contacto no coincidía con tu CV y lo dejamos vacío; agrégalo tú si hace falta.');
  if (rep.requisitos_sin_evidencia > 0)
    out.push('Algunos requisitos quedaron como "No cumple" porque no encontramos evidencia literal; si sí los tienes, agrégalos al CV con tus palabras.');
  return out;
}

export interface EntregaRender {
  subject: string;
  html: string;
  text: string;
}

export function renderEntrega(cv: CvMedida, rep: CvmReporte, opts: { downloadId: string; venceEl: string }): EntregaRender {
  const puesto = cv.puesto_vacante || 'la vacante que enviaste';
  const subject = `Tu CV a la medida para ${cv.puesto_vacante || 'la vacante'}`.slice(0, 120);
  const url = enlaceDescarga(opts.downloadId);
  const avisos = avisosFiltro(rep);
  const conteo = { cumple: 0, parcial: 0, no_cumple: 0 } as Record<EstadoRequisito, number>;
  for (const q of cv.coincidencia) conteo[q.estado]++;
  const idiomaTxt = cv.idioma === 'en' ? 'inglés, como la vacante' : 'español, como la vacante';

  const filas = cv.coincidencia
    .map((q) => {
      const e = ESTADO[q.estado];
      const ev = q.evidencia ? `<div style="color:#5A6480;font-size:13px;margin-top:2px">Evidencia: "${esc(q.evidencia)}"</div>` : '';
      const com = q.comentario ? `<div style="font-size:13px;margin-top:2px">${esc(q.comentario)}</div>` : '';
      return `<li style="margin:0 0 10px"><span style="color:${e.color};font-weight:700">${e.sym} ${e.label}</span> · ${esc(q.requisito)}${ev}${com}</li>`;
    })
    .join('');
  const marcadoresHtml = rep.marcadores.length
    ? `<p style="margin:16px 0 6px"><strong>Datos por completar.</strong> Donde faltaba una cifra o un dato dejamos un marcador resaltado en amarillo. Complétalo con el dato real o bórralo antes de enviar:</p><ul style="margin:0 0 12px;padding-left:20px">${rep.marcadores.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`
    : '';
  const avisosHtml = avisos.length
    ? `<p style="margin:16px 0 6px"><strong>Lo que el filtro quitó.</strong></p><ul style="margin:0 0 12px;padding-left:20px">${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
    : '';

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1E2433;max-width:620px">
<p>Hola:</p>
<p>Adjunto va tu CV redactado para <strong>${esc(puesto)}</strong>, en Word y en ${idiomaTxt}. También puedes descargarlo desde <a href="${url}">este enlace</a> hasta el ${esc(opts.venceEl)}.</p>
<p><strong>Revísalo completo antes de enviarlo.</strong> Lo redactó una inteligencia artificial solo con tu CV y lo que escribiste: reordenamos y reformulamos, pero no agregamos empresas, fechas, cifras ni logros que no nos diste. Tú conoces tu trayectoria; corrige lo que no suene a ti.</p>
${marcadoresHtml}${avisosHtml}
<p style="margin:20px 0 6px"><strong>Resumen de coincidencia con la vacante</strong> (${conteo.cumple} cumple, ${conteo.parcial} parcial, ${conteo.no_cumple} no cumple):</p>
<ul style="margin:0 0 12px;padding-left:20px;list-style:none">${filas}</ul>
<p style="font-size:13px;color:#5A6480">Lo que no cumples no va en el CV: es información para decidir si aplicas y qué preparar para la entrevista. Este documento no garantiza que te llamen.</p>
<p style="font-size:13px;color:#5A6480">Si el documento no corresponde al CV y a la vacante que enviaste, escribe a <a href="mailto:hello@solcaciencia.com?subject=Reembolso">hello@solcaciencia.com</a> con el asunto "Reembolso" y te devolvemos el pago.</p>
<p>Oscar Solís<br>Solca · Ciencia y Consultoría</p>
</div>`;

  const text = [
    'Hola:',
    '',
    `Adjunto va tu CV redactado para ${puesto}, en Word y en ${idiomaTxt}. También puedes descargarlo hasta el ${opts.venceEl}: ${url}`,
    '',
    'Revísalo completo antes de enviarlo. Lo redactó una inteligencia artificial solo con tu CV y lo que escribiste: reordenamos y reformulamos, pero no agregamos empresas, fechas, cifras ni logros que no nos diste. Tú conoces tu trayectoria; corrige lo que no suene a ti.',
    ...(rep.marcadores.length
      ? ['', 'Datos por completar (resaltados en amarillo en el documento; complétalos o bórralos):', ...rep.marcadores.map((m) => `- ${m}`)]
      : []),
    ...(avisos.length ? ['', 'Lo que el filtro quitó:', ...avisos.map((a) => `- ${a}`)] : []),
    '',
    `Resumen de coincidencia con la vacante (${conteo.cumple} cumple, ${conteo.parcial} parcial, ${conteo.no_cumple} no cumple):`,
    ...cv.coincidencia.map(
      (q) => `- ${ESTADO[q.estado].label}: ${q.requisito}${q.evidencia ? ` · Evidencia: "${q.evidencia}"` : ''}${q.comentario ? ` · ${q.comentario}` : ''}`,
    ),
    '',
    'Lo que no cumples no va en el CV: es información para decidir si aplicas y qué preparar para la entrevista. Este documento no garantiza que te llamen.',
    'Si el documento no corresponde al CV y a la vacante que enviaste, escribe a hello@solcaciencia.com con el asunto "Reembolso" y te devolvemos el pago.',
    '',
    'Oscar Solís',
    'Solca · Ciencia y Consultoría',
  ].join('\n');
  return { subject, html, text };
}

export function renderDisculpa(): EntregaRender {
  const subject = 'No pudimos generar tu CV a la medida';
  const parrafos = [
    'Hola:',
    'No pudimos generar tu CV a la medida. Lo sentimos.',
    'Vamos a procesar el reembolso completo de tu pago, al mismo medio con el que pagaste. No tienes que hacer nada; te escribimos cuando quede hecho.',
    'Tu CV, la vacante y tu texto ya se borraron de nuestros sistemas. Si tienes dudas, responde a este correo.',
    'Oscar Solís\nSolca · Ciencia y Consultoría',
  ];
  return {
    subject,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1E2433;max-width:620px">${parrafos
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('')}</div>`,
    text: parrafos.join('\n\n'),
  };
}
