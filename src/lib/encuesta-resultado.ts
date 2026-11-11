/**
 * Encuesta de resultado a 14 días del CV a la medida (11 nov 2026; especificación en
 * ../consultoria/investigacion/2026-12-spec-recorrido-revisor-cv-medida.md §5).
 *
 * Al entregar el CV se programa un solo correo para 14 días después con una pregunta: qué pasó con la postulación.
 * La respuesta se guarda en D1 (evento `encuesta_resultado`) SIN nombre ni correo: solo la respuesta, el rol, el idioma
 * y el encaje (indispensables cumplidos / total) que tuvo el CV. Es la métrica de impacto real del producto.
 *
 * Datos en KV (CV_LIMITS):
 *   encuesta:cvm:<vence ISO>:<token>  → { email, puesto, rol, idioma, ind_cumple, ind_total, entregado, interno, intentos }
 *       (la llave ordena por fecha de envío; caduca 7 días después de la fecha de envío)
 *   encuesta:tok:<token>              → { rol, idioma, ind_cumple, ind_total, entregado, interno }  (sin correo; caduca a los 45 días)
 * El correo se borra en cuanto sale la encuesta (o a los 21 días como máximo, si nunca sale).
 *
 * Los enlaces del correo no registran nada por sí solos (los antivirus de correo abren enlaces): la página pide
 * confirmar con un botón (POST).
 */

export const ENCUESTA_DIAS = 14;
const DIA_MS = 24 * 60 * 60 * 1000;
export const ENCUESTA_MAX_INTENTOS = 3;
export const ENCUESTA_MAX_POR_CORRIDA = 50;

export const OPCIONES = [
  { code: 'sin_llamada', texto: 'No me han llamado.' },
  { code: 'llamada_sin_avance', texto: 'Me llamaron, pero no avancé.' },
  { code: 'siguiente_ronda', texto: 'Pasé a la siguiente ronda.' },
  { code: 'final_sin_contratacion', texto: 'Llegué a la entrevista final, pero no me contrataron.' },
  { code: 'contratado', texto: 'Me contrataron.' },
  { code: 'no_postule', texto: 'Todavía no me he postulado.' },
] as const;
export type CodigoRespuesta = (typeof OPCIONES)[number]['code'];

export function opcion(code: string | null | undefined): (typeof OPCIONES)[number] | null {
  return OPCIONES.find((o) => o.code === code) ?? null;
}

export interface EncuestaPendiente {
  email: string;
  puesto: string;
  rol?: string;
  idioma?: string;
  ind_cumple?: number;
  ind_total?: number;
  entregado: string;
  interno: boolean;
  intentos: number;
}

export interface EncuestaToken {
  rol?: string;
  idioma?: string;
  ind_cumple?: number;
  ind_total?: number;
  entregado: string;
  interno: boolean;
}

export interface KvEncuesta {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expiration?: number; expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string; limit?: number }): Promise<{ keys: Array<{ name: string }>; list_complete: boolean; cursor?: string }>;
}

export const PREFIJO_PENDIENTE = 'encuesta:cvm:';
export const PREFIJO_TOKEN = 'encuesta:tok:';

/** Programa la encuesta al entregar el CV. Nunca lanza. */
export async function programarEncuesta(
  kv: KvEncuesta,
  datos: Omit<EncuestaPendiente, 'intentos' | 'entregado'>,
  now = Date.now(),
  token = crypto.randomUUID(),
): Promise<string | null> {
  if (!datos.email) return null;
  try {
    const vence = new Date(now + ENCUESTA_DIAS * DIA_MS).toISOString();
    const entregado = new Date(now).toISOString();
    const pendiente: EncuestaPendiente = { ...datos, entregado, intentos: 0 };
    const t: EncuestaToken = {
      rol: datos.rol,
      idioma: datos.idioma,
      ind_cumple: datos.ind_cumple,
      ind_total: datos.ind_total,
      entregado,
      interno: datos.interno,
    };
    await kv.put(PREFIJO_TOKEN + token, JSON.stringify(t), { expiration: Math.floor((now + 45 * DIA_MS) / 1000) });
    await kv.put(`${PREFIJO_PENDIENTE}${vence}:${token}`, JSON.stringify(pendiente), { expiration: Math.floor((now + 21 * DIA_MS) / 1000) });
    return token;
  } catch (err) {
    console.warn('encuesta: no se pudo programar', String(err).slice(0, 160));
    return null;
  }
}

/** Llaves pendientes cuya fecha de envío ya pasó (la llave empieza con la fecha ISO, así que el orden es por fecha). */
export async function pendientesVencidas(kv: KvEncuesta, now = Date.now(), max = ENCUESTA_MAX_POR_CORRIDA): Promise<string[]> {
  const ahora = new Date(now).toISOString();
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const r = await kv.list({ prefix: PREFIJO_PENDIENTE, cursor, limit: 1000 });
    for (const k of r.keys) {
      const fecha = k.name.slice(PREFIJO_PENDIENTE.length, PREFIJO_PENDIENTE.length + 24);
      if (fecha > ahora) return out; // ordenadas: las demás también vencen después
      out.push(k.name);
      if (out.length >= max) return out;
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return out;
}

export function tokenDeLlave(llave: string): string {
  return llave.slice(llave.lastIndexOf(':') + 1);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function enlaceRespuesta(token: string, code: string): string {
  return `https://solcaciencia.com/encuesta-resultado/?t=${encodeURIComponent(token)}&r=${encodeURIComponent(code)}`;
}

/** Correo de la encuesta. Pura (para pruebas). */
export function renderEncuesta(p: { puesto: string }, token: string): { subject: string; html: string; text: string } {
  const puesto = (p.puesto || '').trim() || 'la vacante';
  const subject = `¿Qué pasó con tu postulación a ${puesto}?`.slice(0, 120);
  const intro = `Hace dos semanas recibiste tu CV adaptado para ${puesto}. Queremos saber cómo te fue.`;
  const pregunta = '¿En qué etapa estás?';
  const cierre = 'Es el único correo de seguimiento que recibirás. Tu respuesta se registrará de forma anónima, sin asociarla a tu nombre ni correo.';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
<p>Hola:</p>
<p>${esc(intro)}</p>
<p><strong>${esc(pregunta)}</strong></p>
<ul style="padding-left:0;list-style:none">
${OPCIONES.map((o) => `<li style="margin:8px 0"><a href="${enlaceRespuesta(token, o.code)}" style="display:inline-block;padding:10px 14px;border:1px solid #0F2748;border-radius:6px;color:#0F2748;text-decoration:none">${esc(o.texto)}</a></li>`).join('\n')}
</ul>
<p style="color:#555;font-size:13px">${esc(cierre)}</p>
<p>Solca Ciencia</p>
</div>`;
  const text = [
    'Hola:',
    '',
    intro,
    '',
    pregunta,
    '',
    ...OPCIONES.map((o) => `- ${o.texto}: ${enlaceRespuesta(token, o.code)}`),
    '',
    cierre,
    '',
    'Solca Ciencia',
  ].join('\n');
  return { subject, html, text };
}
