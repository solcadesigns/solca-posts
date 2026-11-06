/**
 * Correos de servicio del revisor de CV · 6 nov 2026 (bloque B del plan, ../consultoria/investigacion/2026-11-plan-revisor-cv.md).
 *
 * El HTML y el texto se arman aquí (versionados en el repo y probados con `node scripts/test-cv-review.mjs`) y se
 * envían con la API simple de Postmark (HtmlBody/TextBody, stream `outbound`). No hay plantilla en Postmark: un
 * cambio de texto pasa por revisión de código y no depende de editar el panel de Postmark a mano.
 *
 * Archivo puro (sin runtime de Workers) para que lo use el script de prueba.
 *
 * Reglas:
 * - Corto: resumen, conteo por estado, "Qué cambiar primero", antes/después y un enlace al sitio. El detalle
 *   completo vive en pantalla y en el PDF. Excepción: si el análisis salió en un reintento, la persona nunca vio la
 *   pantalla, así que el correo agrega el detalle de los criterios prioritarios y mejorables.
 * - Sin "gratis" ni "gratuito" (OSCAR_PROFILE, regla de emails). Sin cifras que no vengan del análisis.
 * - Enlaces con utm_source=email&utm_medium=cv-report; Hotmart con `src`.
 * - El curso (oferta de pago) solo aparece si la persona marcó la casilla de correos comerciales en este formulario.
 */

import {
  countByEstado,
  cursoLead,
  pickNextStep,
  rolLabel,
  type CvReviewResult,
  type Estado,
  type NextStep,
} from './cv-review-rubric.ts';

export const CV_EMAIL_VERSION = 'e1-2026-11';

/** Lo que ve la persona cuando el análisis queda pendiente de reintento (texto pedido por Oscar, 6 nov 2026). */
export const CV_PENDING_MSG =
  'Hubo un problema al generar tu análisis. Lo intentaremos de nuevo y te escribiremos por correo con el resultado.';
export const CV_EMAIL_FROM = 'Oscar Solís <hola@solcaciencia.com>';

const SITE = 'https://solcaciencia.com';
const CURSO_URL = 'https://go.hotmart.com/B104495115T';
const UTM_BASE = 'utm_source=email&utm_medium=cv-report';

const ESTADO_LABEL: Record<Estado, string> = {
  prioritario: 'Prioritario',
  mejorable: 'Mejorable',
  solido: 'Sólido',
  no_evaluable: 'No evaluable',
};
// Forma + palabra: el color nunca va solo (igual que en pantalla).
const ESTADO_SYM: Record<Estado, string> = { prioritario: '▲', mejorable: '■', solido: '●', no_evaluable: '○' };
const ESTADO_COLOR: Record<Estado, string> = {
  prioritario: '#B23A2A',
  mejorable: '#B7791F',
  solido: '#2F7D4F',
  no_evaluable: '#5A6480',
};
const ORDEN: Estado[] = ['prioritario', 'mejorable', 'solido', 'no_evaluable'];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Agrega los UTM del correo (y `utm_campaign`/`utm_content`) a una URL del sitio. */
export function cvEmailLink(path: string, campaign: string, content: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${SITE}${path}${sep}${UTM_BASE}&utm_campaign=${encodeURIComponent(campaign)}&utm_content=${encodeURIComponent(content)}`;
}

function cursoLink(): string {
  return `${CURSO_URL}?src=email-cv-report`;
}

interface NextStepEmail {
  step: NextStep;
  title: string;
  body: string;
  cta: string;
  href: string;
}

/** Mismo criterio que la pantalla (pickNextStep). Devuelve null si toca el curso y no hay consentimiento comercial. */
export function nextStepEmail(
  res: CvReviewResult,
  rolFormulario: string | undefined,
  marketing: boolean,
): NextStepEmail | null {
  const step = pickNextStep(res, rolFormulario);
  if (step === 'quiz') {
    return {
      step,
      title: 'Define a qué rol apuntas',
      // Mismo texto que la pantalla (revisar-cv.astro, nextStepCopy). Aquí no hay rol elegido en el formulario.
      body: res.perfil.rol_objetivo
        ? 'Lo más urgente en tu CV es el posicionamiento: que se entienda pronto a qué rol apuntas y por qué encajas. Si todavía dudas entre roles, el quiz te ayuda a elegir entre 5 roles de la industria.'
        : 'En esta lectura tu CV todavía no deja claro a qué puesto apunta, y varios criterios de este análisis dependen de eso. El quiz de rol te ayuda a elegir entre 5 roles de la industria.',
      cta: 'Hacer el quiz de rol',
      href: cvEmailLink('/quiz-rol', 'revisar-cv', 'siguiente-quiz'),
    };
  }
  if (step === 'simulador') {
    return {
      step,
      title: 'Ensaya la primera llamada',
      body: 'En esta lectura tu CV no tiene puntos prioritarios. El siguiente paso es la entrevista: el simulador te ayuda a ensayar la llamada inicial con un reclutador.',
      cta: 'Ensayar mi primera llamada',
      href: cvEmailLink('/simulador-entrevistas/', 'revisar-cv', 'siguiente-simulador'),
    };
  }
  if (!marketing) return null;
  return {
    step,
    title: 'Trabaja la redacción de tu CV',
    body: `${cursoLead(res, rolFormulario)} El curso explica cómo redactar un CV, optimizar LinkedIn y aplicar de forma estratégica. Los ejemplos son de ciencias biológicas y de la salud.`,
    cta: 'Ver el curso en Hotmart',
    href: cursoLink(),
  };
}

export interface CvEmailOptions {
  /** Valor del formulario (código de rol o 'no_seguro'). */
  rolFormulario?: string;
  /** Casilla comercial marcada en este formulario. */
  marketing: boolean;
  /** El análisis salió en un reintento (la persona no lo vio en pantalla). */
  reintento?: boolean;
  /** Fecha legible del análisis (es-MX). */
  fecha?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const P = 'margin:0 0 14px;font-size:15px;line-height:1.55;color:#1F2A44;';
const H2 = 'margin:26px 0 10px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#1B3A6B;font-family:Arial,Helvetica,sans-serif;';

/** Pie del correo. Con la casilla comercial marcada no se puede decir que "no te suscribe a nada". */
export function cvEmailFooter(marketing: boolean): string {
  return marketing
    ? 'Recibes este correo porque pediste un análisis de CV en solcaciencia.com. Es un correo de servicio. Aparte, como marcaste la casilla de correos comerciales, recibirás el newsletter y los correos de bienvenida de Solca Ciencia; puedes darte de baja cuando quieras. Tu CV no queda guardado.'
    : 'Recibes este correo porque pediste un análisis de CV en solcaciencia.com. Es un correo de servicio: no te suscribe a nada. Tu CV no queda guardado.';
}

function wrapHtml(inner: string, marketing: boolean): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Solca Ciencia</title></head>
<body style="margin:0;padding:0;background:#FAF9F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F4;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E3E6EE;border-radius:8px;">
<tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 18px;font-size:13px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;color:#E8743A;">Solca Ciencia</p>
${inner}
</td></tr>
<tr><td style="padding:16px 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5A6480;border-top:1px solid #E3E6EE;">
${esc(cvEmailFooter(marketing))}
</td></tr>
</table></td></tr></table>
</body></html>`;
}

/** Correo con el análisis (en el momento o después de un reintento). */
export function renderCvAnalysisEmail(res: CvReviewResult, opts: CvEmailOptions): RenderedEmail {
  const counts = countByEstado(res.observaciones);
  const ns = nextStepEmail(res, opts.rolFormulario, opts.marketing);
  const rol = rolLabel(opts.rolFormulario);
  const campaign = opts.reintento ? 'revisar-cv-reintento' : 'revisar-cv';
  const volver = cvEmailLink('/revisar-cv', campaign, 'volver');
  const subject = opts.reintento ? 'Ya está listo el análisis de tu CV' : 'El análisis de tu CV';
  const intro = opts.reintento
    ? 'Ya está listo el análisis que no pudimos mostrarte en pantalla. Va aquí con más detalle, porque no hay una versión en el sitio que puedas abrir.'
    : 'Aquí tienes lo principal del análisis que acabas de ver en pantalla. El detalle por criterio está en la página y en el PDF que puedes descargar ahí.';

  const t: string[] = [];
  const h: string[] = [];

  t.push(`Hola,`, '', intro, '');
  h.push(`<p style="${P}">Hola,</p>`, `<p style="${P}">${esc(intro)}</p>`);
  if (rol) {
    t.push(`Rol que elegiste: ${rol}`, '');
    h.push(`<p style="${P}"><strong>Rol que elegiste:</strong> ${esc(rol)}</p>`);
  }

  // Resumen y conteo por estado
  t.push('RESUMEN');
  h.push(`<h2 style="${H2}">Resumen</h2>`);
  if (res.resumen.una_linea) {
    t.push(res.resumen.una_linea);
    h.push(`<p style="${P}">${esc(res.resumen.una_linea)}</p>`);
  }
  t.push(ORDEN.map((e) => `${ESTADO_LABEL[e]}: ${counts[e]}`).join(' · '), '');
  h.push(
    `<p style="${P}">${ORDEN.map(
      (e) => `<span style="white-space:nowrap;margin-right:14px;"><span style="color:${ESTADO_COLOR[e]};">${ESTADO_SYM[e]}</span> <strong>${counts[e]}</strong> ${ESTADO_LABEL[e]}</span>`,
    ).join(' ')}</p>`,
  );

  // Qué cambiar primero
  if (res.prioridades.length) {
    t.push('QUÉ CAMBIAR PRIMERO');
    h.push(`<h2 style="${H2}">Qué cambiar primero</h2><ol style="margin:0 0 14px;padding-left:20px;">`);
    res.prioridades.forEach((p, i) => {
      t.push(`${i + 1}. ${p.accion}${p.por_que ? `\n   Por qué: ${p.por_que}` : ''}`);
      h.push(
        `<li style="margin:0 0 10px;font-size:15px;line-height:1.5;color:#1F2A44;">${esc(p.accion)}${
          p.por_que ? `<br><span style="font-size:13px;color:#5A6480;">Por qué: ${esc(p.por_que)}</span>` : ''
        }</li>`,
      );
    });
    t.push('');
    h.push('</ol>');
  }

  // Antes y después
  if (res.reescrituras.length) {
    t.push('ASÍ SE VERÍA');
    h.push(`<h2 style="${H2}">Así se vería</h2>`);
    for (const r of res.reescrituras) {
      t.push(`Antes: "${r.antes}"`, `Después: "${r.despues}"`);
      if (r.principio) t.push(`Por qué: ${r.principio}`);
      t.push('');
      h.push(
        `<div style="margin:0 0 14px;padding:12px 14px;background:#F4F6FA;border-left:3px solid #E8743A;font-size:14px;line-height:1.5;color:#1F2A44;">` +
          `<p style="margin:0 0 6px;"><strong>Antes:</strong> “${esc(r.antes)}”</p>` +
          `<p style="margin:0 0 6px;"><strong>Después:</strong> “${esc(r.despues)}”</p>` +
          (r.principio ? `<p style="margin:0;font-size:13px;color:#5A6480;">Por qué: ${esc(r.principio)}</p>` : '') +
          `</div>`,
      );
    }
    if (res.reescrituras.some((r) => /\[[^\]]+\]/.test(r.despues))) {
      const nota = 'Lo que va entre corchetes es un dato que solo tú conoces; no inventamos cifras.';
      t.push(nota, '');
      h.push(`<p style="font-size:13px;line-height:1.5;color:#5A6480;margin:0 0 14px;">${esc(nota)}</p>`);
    }
  }

  // Detalle (solo en reintento: no hubo pantalla ni PDF)
  if (opts.reintento) {
    const det = res.observaciones.filter((o) => (o.estado === 'prioritario' || o.estado === 'mejorable') && o.recomendacion);
    if (det.length) {
      t.push('DETALLE: LO QUE CONVIENE AJUSTAR');
      h.push(`<h2 style="${H2}">Detalle: lo que conviene ajustar</h2>`);
      for (const o of det) {
        t.push(`${ESTADO_LABEL[o.estado]} · ${o.categoria}: ${o.recomendacion}`);
        h.push(
          `<p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#1F2A44;"><span style="color:${ESTADO_COLOR[o.estado]};">${ESTADO_SYM[o.estado]}</span> <strong>${esc(o.categoria)}</strong> (${ESTADO_LABEL[o.estado]}): ${esc(o.recomendacion)}</p>`,
        );
      }
      t.push('');
    }
  }

  // Siguiente paso (uno solo) y enlace al sitio
  if (ns) {
    t.push(ns.title.toUpperCase(), ns.body, `${ns.cta}: ${ns.href}`, '');
    h.push(
      `<h2 style="${H2}">${esc(ns.title)}</h2><p style="${P}">${esc(ns.body)}</p>` +
        `<p style="margin:0 0 18px;"><a href="${esc(ns.href)}" style="display:inline-block;background:#E8743A;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 20px;border-radius:6px;">${esc(ns.cta)}</a></p>`,
    );
  }
  const cierre = 'Este análisis es general: no compara tu CV con una vacante ni predice si te van a llamar.';
  t.push(cierre, '', `Revisar otro CV: ${volver}`, '', '— Oscar Solís · Solca Ciencia');
  h.push(
    `<p style="font-size:13px;line-height:1.5;color:#5A6480;margin:0 0 14px;">${esc(cierre)}</p>`,
    `<p style="${P}"><a href="${esc(volver)}" style="color:#1B3A6B;">Revisar otro CV en solcaciencia.com</a></p>`,
    `<p style="${P}">— Oscar Solís · Solca Ciencia</p>`,
  );

  t.push('', '---', cvEmailFooter(opts.marketing));
  return { subject, html: wrapHtml(h.join('\n'), opts.marketing), text: t.join('\n') };
}

/**
 * Disculpa después del último intento fallido (no salió el análisis o no salió su correo). El CV ya se borró, el
 * intento no cuenta para el límite y no se registró el lead, así que el pie es siempre el de "no te suscribe".
 */
export function renderCvApologyEmail(): RenderedEmail {
  const marketing = false;
  const volver = cvEmailLink('/revisar-cv', 'revisar-cv-fallo', 'volver');
  const parrafos = [
    'Hola,',
    'No pudimos entregarte el análisis de tu CV después de varios intentos. Lo sentimos.',
    'Ya borramos el texto de tu CV y este intento no cuenta para tu límite de análisis, así que puedes volver a intentarlo cuando quieras.',
    'Si vuelve a fallar, responde a este correo y lo revisamos.',
  ];
  const text = [...parrafos.flatMap((p) => [p, '']), `Volver a intentarlo: ${volver}`, '', '— Oscar Solís · Solca Ciencia', '', '---', cvEmailFooter(marketing)].join('\n');
  const html = wrapHtml(
    parrafos.map((p) => `<p style="${P}">${esc(p)}</p>`).join('\n') +
      `\n<p style="${P}"><a href="${esc(volver)}" style="color:#1B3A6B;">Volver a intentarlo en solcaciencia.com</a></p>` +
      `\n<p style="${P}">— Oscar Solís · Solca Ciencia</p>`,
    marketing,
  );
  return { subject: 'No pudimos entregarte el análisis de tu CV', html, text };
}
