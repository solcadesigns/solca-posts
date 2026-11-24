/**
 * Encuestas del curso "De la ciencia a la industria: CV, LinkedIn y entrevistas en farma y CRO" (curso V2.0) · 24 nov 2026.
 *
 * Fuente de verdad de los textos: ../consultoria/curso-cv-v2/textos-finales/06-encuestas-y-correos.md (versión final
 * del 23 nov 2026). Las preguntas y opciones van tal cual: están pensadas para compararse entre encuestas. Si cambia
 * el texto allá, se cambia aquí y se sube ENCUESTA_CURSO_VERSION.
 *
 * Cuatro encuestas (tipo): inicio (lección 0.5), cierre (C.1), 30-dias y 90-dias. Identificador: el correo de compra.
 * Las respuestas se guardan en D1 `curso_encuestas` (migrations/0015) con la etiqueta CURSO = 'curso_cv_v2'.
 *
 * Correos de 30 y 90 días: al recibir la encuesta de cierre se programan dos envíos en KV (CV_LIMITS), contados desde
 * la fecha de cierre (el correo dice "Hace un mes terminaste el curso"). El cron diario los envía con Postmark
 * (/api/encuesta-curso-tick). El correo se borra de KV en cuanto sale el envío. Mismo patrón que
 * src/lib/encuesta-resultado.ts.
 */

export const CURSO = 'curso_cv_v2';
export const ENCUESTA_CURSO_VERSION = 'v1-2026-11-23';
export const TIPOS = ['inicio', 'cierre', '30-dias', '90-dias'] as const;
export type TipoEncuesta = (typeof TIPOS)[number];

export function esTipo(v: unknown): v is TipoEncuesta {
  return typeof v === 'string' && (TIPOS as readonly string[]).includes(v);
}

export interface Opcion {
  v: string;
  t: string;
  /** La opción pide un dato adicional: texto libre ("Otro: [texto]") o año. */
  extra?: 'texto' | 'anio';
}

export type TipoPregunta = 'email' | 'una' | 'varias' | 'numero' | 'escala' | 'texto' | 'leccion';

export interface Pregunta {
  id: string;
  texto: string;
  /** Indicación entre paréntesis del documento fuente (p. ej. "una opción"). */
  ayuda?: string;
  tipo: TipoPregunta;
  opciones?: Opcion[];
  min?: number;
  max?: number;
  /** Etiquetas de los extremos de la escala. */
  extremos?: [string, string];
  opcional?: boolean;
}

export interface Encuesta {
  tipo: TipoEncuesta;
  titulo: string;
  leccion: string;
  intro?: string;
  preguntas: Pregunta[];
}

// ── Opciones compartidas ─────────────────────────────────────────────────────────────────────────────────────
// Rol objetivo (pregunta 5 de inicio). Se reutiliza en cierre (ruta) y en 30/90 días (rol del nuevo empleo).
export const ROLES: Opcion[] = [
  { v: 'investigacion_clinica', t: 'Investigación clínica' },
  { v: 'msl', t: 'MSL' },
  { v: 'pm_clinico', t: 'Project Manager clínico' },
  { v: 'farmacovigilancia', t: 'Farmacovigilancia' },
  { v: 'consultoria_estrategica', t: 'Consultoría estratégica en ciencias de la vida' },
  { v: 'asuntos_medicos_otro', t: 'Otro puesto de asuntos médicos' },
  { v: 'calidad', t: 'Calidad' },
  { v: 'regulatorio', t: 'Regulatorio' },
  { v: 'laboratorio_id', t: 'Laboratorio e I+D' },
  { v: 'acceso_mercado', t: 'Acceso al mercado, economía de la salud y datos' },
  { v: 'datos_clinicos', t: 'Gestión de datos clínicos' },
  { v: 'marketing', t: 'Marketing' },
  { v: 'otro', t: 'Otro', extra: 'texto' },
  { v: 'no_decido', t: 'Aún no lo decido' },
];

const CORREO: Pregunta = { id: 'correo', texto: 'Tu correo', tipo: 'email' };

const CLARIDAD_EXTREMOS: [string, string] = ['1 = nada claro', '5 = muy claro'];

const SEGUIMIENTO: Pregunta[] = [
  CORREO,
  {
    id: 'punto',
    texto: '¿En qué punto estás?',
    ayuda: 'una opción',
    tipo: 'una',
    opciones: [
      { v: 'sigo_buscando', t: 'Sigo buscando' },
      { v: 'pause', t: 'Pausé la búsqueda' },
      { v: 'cambie_objetivo', t: 'Cambié de objetivo' },
      { v: 'tengo_oferta', t: 'Tengo una oferta' },
      { v: 'empece_empleo', t: 'Ya empecé un nuevo empleo' },
    ],
  },
  { id: 'postulaciones', texto: 'Desde que terminaste el curso, ¿cuántas postulaciones enviaste?', ayuda: 'número', tipo: 'numero', min: 0, max: 2000 },
  { id: 'entrevistas', texto: '¿Cuántas entrevistas tuviste?', ayuda: 'número', tipo: 'numero', min: 0, max: 500 },
  { id: 'ofertas', texto: '¿Cuántas ofertas recibiste?', ayuda: 'número', tipo: 'numero', min: 0, max: 100 },
  // "Las mismas opciones de rol de la encuesta del curso, más 'Otro'": la lista de roles ya trae "Otro".
  // Opcional porque solo aplica si empezaste un nuevo empleo.
  { id: 'rol_nuevo', texto: 'Si empezaste un nuevo empleo, ¿en qué rol?', ayuda: 'una opción', tipo: 'una', opciones: ROLES, opcional: true },
  { id: 'sigues_usando', texto: '¿Qué parte del curso sigues usando?', ayuda: 'opcional', tipo: 'texto', max: 1000, opcional: true },
];

export const ENCUESTAS: Record<TipoEncuesta, Encuesta> = {
  inicio: {
    tipo: 'inicio',
    titulo: 'Encuesta del curso',
    leccion: '0.5',
    intro: 'Con esta encuesta sabremos qué ejemplos y rutas preparar mejor. Toma unos tres minutos.',
    preguntas: [
      { ...CORREO, ayuda: 'el que usaste para inscribirte' },
      {
        id: 'situacion',
        texto: '¿Cuál es tu situación?',
        ayuda: 'una opción',
        tipo: 'una',
        opciones: [
          { v: 'posgrado', t: 'Vengo de un posgrado (maestría, doctorado o posdoctorado) y quiero pasar a la industria.' },
          { v: 'primer_empleo', t: 'Busco mi primer empleo después de la licenciatura.' },
          { v: 'cambio_rol', t: 'Ya trabajo en la industria y quiero cambiar de rol.' },
          { v: 'otro_sector', t: 'Ya trabajo en otro sector y quiero pasar a la industria.' },
          { v: 'licenciatura_en_curso', t: 'Estudio la licenciatura. Año en que la termino:', extra: 'anio' },
          { v: 'otra', t: 'Otra', extra: 'texto' },
        ],
      },
      {
        id: 'formacion',
        texto: 'Tu formación principal',
        ayuda: 'una opción',
        tipo: 'una',
        opciones: [
          { v: 'qfb', t: 'Química farmacéutica bióloga / QFB' },
          { v: 'quimica', t: 'Química' },
          { v: 'biologia', t: 'Biología' },
          { v: 'biotecnologia', t: 'Biotecnología' },
          { v: 'medicina', t: 'Medicina' },
          { v: 'farmacia', t: 'Farmacia' },
          { v: 'biomedicas', t: 'Ciencias biomédicas' },
          { v: 'otra', t: 'Otra', extra: 'texto' },
        ],
      },
      {
        id: 'grado',
        texto: 'Tu grado más alto',
        ayuda: 'una opción',
        tipo: 'una',
        opciones: [
          { v: 'lic_en_curso', t: 'Licenciatura en curso' },
          { v: 'lic_titulo_tramite', t: 'Licenciatura (título en trámite)' },
          { v: 'lic', t: 'Licenciatura' },
          { v: 'maestria_en_curso', t: 'Maestría en curso' },
          { v: 'maestria', t: 'Maestría' },
          { v: 'doctorado_en_curso', t: 'Doctorado en curso' },
          { v: 'doctorado', t: 'Doctorado' },
          { v: 'posdoctorado', t: 'Posdoctorado' },
        ],
      },
      { id: 'rol_objetivo', texto: 'Tu rol objetivo', ayuda: 'una opción; si tienes dos, marca el que trabajarás primero', tipo: 'una', opciones: ROLES },
      { id: 'por_que_rol', texto: '¿Por qué elegiste ese rol?', ayuda: 'una frase', tipo: 'texto', max: 500 },
      {
        id: 'pais',
        texto: 'País donde buscas empleo',
        ayuda: 'una opción',
        tipo: 'una',
        opciones: [
          { v: 'mx', t: 'México' },
          { v: 'pe', t: 'Perú' },
          { v: 'co', t: 'Colombia' },
          { v: 'cl', t: 'Chile' },
          { v: 'ar', t: 'Argentina' },
          { v: 'br', t: 'Brasil' },
          { v: 'es', t: 'España' },
          { v: 'us', t: 'Estados Unidos' },
          { v: 'otro', t: 'Otro', extra: 'texto' },
        ],
      },
      {
        id: 'tiempo_buscando',
        texto: '¿Cuánto tiempo llevas buscando?',
        ayuda: 'una opción',
        tipo: 'una',
        opciones: [
          { v: 'no_empiezo', t: 'Todavía no empiezo' },
          { v: 'menos_3m', t: 'Menos de 3 meses' },
          { v: '3_6m', t: 'De 3 a 6 meses' },
          { v: '6_12m', t: 'De 6 a 12 meses' },
          { v: 'mas_12m', t: 'Más de 12 meses' },
        ],
      },
      { id: 'postulaciones_4sem', texto: 'En las últimas cuatro semanas, ¿cuántas postulaciones enviaste?', ayuda: 'número', tipo: 'numero', min: 0, max: 2000 },
      { id: 'entrevistas_4sem', texto: 'En las últimas cuatro semanas, ¿cuántas entrevistas tuviste?', ayuda: 'número', tipo: 'numero', min: 0, max: 500 },
      { id: 'claridad', texto: 'Del 1 al 5, ¿qué tan claro tienes cómo presentar tu experiencia para tu rol objetivo?', tipo: 'escala', min: 1, max: 5, extremos: CLARIDAD_EXTREMOS },
      {
        id: 'canal',
        texto: '¿Cómo conociste el curso?',
        ayuda: 'una opción',
        tipo: 'una',
        opciones: [
          { v: 'linkedin', t: 'LinkedIn' },
          { v: 'newsletter', t: 'Newsletter Solca Insight' },
          { v: 'sitio', t: 'Sitio de Solca' },
          { v: 'herramienta', t: 'Una herramienta de Solca (revisor, quiz, simulador)' },
          { v: 'recomendacion', t: 'Recomendación' },
          { v: 'otro', t: 'Otro', extra: 'texto' },
        ],
      },
    ],
  },
  cierre: {
    tipo: 'cierre',
    titulo: 'Encuesta de cierre',
    leccion: 'C.1',
    intro: 'Toma unos cinco minutos. Tus respuestas sirven tanto si avanzaste como si sigues buscando o cambiaste de objetivo.',
    preguntas: [
      CORREO,
      { id: 'ruta', texto: '¿Qué ruta seguiste?', ayuda: 'una opción', tipo: 'una', opciones: [...ROLES, { v: 'guia_una_pagina', t: 'Guía de una página' }] },
      {
        id: 'entregables',
        texto: '¿Qué entregables completaste?',
        ayuda: 'varias opciones',
        tipo: 'varias',
        opciones: [
          { v: 'punto_partida', t: 'Mi punto de partida' },
          { v: 'rol_tres_vacantes', t: 'Mi rol y mis tres vacantes' },
          { v: 'mapa_plan', t: 'Mi mapa y mi plan' },
          { v: 'cv_industria', t: 'Mi CV para industria' },
          { v: 'perfil_mensajes', t: 'Mi perfil y mis cinco mensajes' },
          { v: 'kit_entrevista', t: 'Mi kit de entrevista' },
          { v: 'plan_tablero', t: 'Mi plan y mi tablero' },
          { v: 'paquete_rol', t: 'Mi paquete para el rol' },
        ],
        opcional: true, // marcar ninguna es una respuesta válida (no completó entregables)
      },
      { id: 'claridad', texto: 'Del 1 al 5, ¿qué tan claro tienes ahora cómo presentar tu experiencia para tu rol objetivo?', tipo: 'escala', min: 1, max: 5, extremos: CLARIDAD_EXTREMOS },
      { id: 'leccion_util', texto: '¿Cuál lección te sirvió más?', ayuda: 'número de lección y una frase', tipo: 'leccion', max: 500 },
      { id: 'atoro', texto: '¿Dónde te atoraste o qué dejaste sin terminar?', tipo: 'texto', max: 1000 },
      {
        id: 'duracion',
        texto: '¿Cuánto tiempo te tomó el curso?',
        ayuda: 'una opción',
        tipo: 'una',
        opciones: [
          { v: 'menos_1sem', t: 'Menos de una semana' },
          { v: '1_2sem', t: 'De una a dos semanas' },
          { v: '3_4sem', t: 'De tres a cuatro semanas' },
          { v: 'mas_1mes', t: 'Más de un mes' },
        ],
      },
      { id: 'recomendacion', texto: '¿Qué tan probable es que recomiendes el curso a un colega?', tipo: 'escala', min: 0, max: 10, extremos: ['0', '10'] },
      { id: 'cambiarias', texto: '¿Qué cambiarías del curso?', tipo: 'texto', max: 1000 },
      {
        id: 'testimonio',
        texto: '¿Podemos citar tu respuesta a la pregunta 5 o 9 como testimonio, con tu nombre de pila y tu rol?',
        tipo: 'una',
        opciones: [
          { v: 'si_nombre_rol', t: 'Sí, con nombre de pila y rol' },
          { v: 'si_anonimo', t: 'Sí, de forma anónima' },
          { v: 'no', t: 'No' },
        ],
      },
      {
        id: 'freno',
        texto: '¿Qué te frenó más?',
        tipo: 'una',
        opciones: [
          { v: 'idioma', t: 'Idioma' },
          { v: 'pocas_vacantes', t: 'Pocas vacantes' },
          { v: 'experiencia', t: 'Experiencia que piden' },
          { v: 'otro', t: 'Otro', extra: 'texto' },
        ],
      },
      { id: 'minutos_1_2_1_4', texto: '¿Cuántos minutos te tomaron las lecciones 1.2 y 1.4?', ayuda: 'número', tipo: 'numero', min: 0, max: 3000 },
    ],
  },
  '30-dias': { tipo: '30-dias', titulo: 'Encuesta a los 30 días', leccion: '30 días', preguntas: SEGUIMIENTO },
  '90-dias': { tipo: '90-dias', titulo: 'Encuesta a los 90 días', leccion: '90 días', preguntas: SEGUIMIENTO },
};

// ── Validación ──────────────────────────────────────────────────────────────────────────────────────────────
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ValorRespuesta = string | number | string[];
export type Respuestas = Record<string, ValorRespuesta>;

export type Validacion =
  | { ok: true; email: string; respuestas: Respuestas }
  | { ok: false; pregunta: string; error: string };

function limpiarTexto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim().slice(0, max) : '';
}

/**
 * Valida un envío contra el catálogo. Ignora llaves desconocidas. Formato de entrada:
 *   email/texto: string · una: código · varias: string[] · numero/escala: número o cadena numérica
 *   extra de una opción: `<id>_otro` (texto, 200) o `<id>_anio` (año entre 2020 y 2040)
 *   leccion: `<id>_num` (p. ej. "3.11", 20) y `<id>_frase` (texto)
 */
export function validarRespuestas(tipo: TipoEncuesta, entrada: unknown): Validacion {
  const e = (entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? entrada : {}) as Record<string, unknown>;
  const out: Respuestas = {};
  let email = '';
  for (const p of ENCUESTAS[tipo].preguntas) {
    const bruto = e[p.id];
    const vacio = bruto === undefined || bruto === null || bruto === '' || (Array.isArray(bruto) && bruto.length === 0);
    if (p.tipo === 'leccion') {
      const num = limpiarTexto(e[`${p.id}_num`], 20);
      const frase = limpiarTexto(e[`${p.id}_frase`], p.max ?? 500);
      if (!num && !frase) {
        if (p.opcional) continue;
        return { ok: false, pregunta: p.id, error: 'requerida' };
      }
      if (num && !/^[0-9A-Za-z.\- ]{1,20}$/.test(num)) return { ok: false, pregunta: p.id, error: 'leccion_invalida' };
      if (num) out[`${p.id}_num`] = num;
      if (frase) out[`${p.id}_frase`] = frase;
      continue;
    }
    if (vacio) {
      if (p.opcional) continue;
      return { ok: false, pregunta: p.id, error: 'requerida' };
    }
    switch (p.tipo) {
      case 'email': {
        const v = limpiarTexto(bruto, 254).toLowerCase();
        if (!EMAIL_RE.test(v)) return { ok: false, pregunta: p.id, error: 'correo_invalido' };
        email = v;
        break;
      }
      case 'texto': {
        const v = limpiarTexto(bruto, p.max ?? 1000);
        if (!v) {
          if (p.opcional) break;
          return { ok: false, pregunta: p.id, error: 'requerida' };
        }
        out[p.id] = v;
        break;
      }
      case 'numero':
      case 'escala': {
        const n = typeof bruto === 'number' ? bruto : typeof bruto === 'string' && /^\s*\d+\s*$/.test(bruto) ? Number(bruto) : NaN;
        if (!Number.isInteger(n) || n < (p.min ?? 0) || n > (p.max ?? 100000)) return { ok: false, pregunta: p.id, error: 'numero_invalido' };
        out[p.id] = n;
        break;
      }
      case 'una': {
        const op = p.opciones?.find((o) => o.v === bruto);
        if (!op) return { ok: false, pregunta: p.id, error: 'opcion_invalida' };
        out[p.id] = op.v;
        if (op.extra === 'texto') {
          const t = limpiarTexto(e[`${p.id}_otro`], 200);
          if (!t) return { ok: false, pregunta: p.id, error: 'falta_texto' };
          out[`${p.id}_otro`] = t;
        } else if (op.extra === 'anio') {
          const a = Number(e[`${p.id}_anio`]);
          if (!Number.isInteger(a) || a < 2020 || a > 2040) return { ok: false, pregunta: p.id, error: 'anio_invalido' };
          out[`${p.id}_anio`] = a;
        }
        break;
      }
      case 'varias': {
        if (!Array.isArray(bruto)) return { ok: false, pregunta: p.id, error: 'opcion_invalida' };
        const validos = new Set((p.opciones ?? []).map((o) => o.v));
        const sel = [...new Set(bruto.filter((x): x is string => typeof x === 'string'))];
        if (sel.some((x) => !validos.has(x))) return { ok: false, pregunta: p.id, error: 'opcion_invalida' };
        if (sel.length > 0) out[p.id] = (p.opciones ?? []).map((o) => o.v).filter((v) => sel.includes(v)); // orden del catálogo
        break;
      }
    }
  }
  if (!email) return { ok: false, pregunta: 'correo', error: 'requerida' };
  return { ok: true, email, respuestas: out };
}

export const MENSAJES_ERROR: Record<string, string> = {
  requerida: 'Falta responder esta pregunta.',
  correo_invalido: 'Revisa el correo.',
  numero_invalido: 'Escribe un número entero.',
  opcion_invalida: 'Elige una opción de la lista.',
  falta_texto: 'Escribe cuál.',
  anio_invalido: 'Escribe el año con cuatro cifras.',
  leccion_invalida: 'Escribe el número de lección, por ejemplo 3.11.',
};

// ── Enlaces con UTM ─────────────────────────────────────────────────────────────────────────────────────────
// Convención del curso (recursos/enlaces-curso-revisor.md): utm_source=hotmart&utm_medium=curso&utm_campaign=curso-cv-v2
// y utm_content=<leccion>-alumno. Los correos usan utm_source=email (convención de los correos del sitio).
export const SITIO = 'https://solcaciencia.com';

export function urlEncuesta(tipo: TipoEncuesta, origen: 'hotmart' | 'email'): string {
  const content = { inicio: '0-5', cierre: 'c-1', '30-dias': '30-dias', '90-dias': '90-dias' }[tipo];
  const q = new URLSearchParams({
    utm_source: origen,
    utm_medium: 'curso',
    utm_campaign: 'curso-cv-v2',
    utm_content: `${content}-alumno`,
  });
  return `${SITIO}/encuesta-curso/${tipo}/?${q.toString()}`;
}

// ── Correos de 30 y 90 días ─────────────────────────────────────────────────────────────────────────────────
export type TipoSeguimiento = '30-dias' | '90-dias';
export const SEGUIMIENTO_DIAS: Record<TipoSeguimiento, number> = { '30-dias': 30, '90-dias': 90 };
const DIA_MS = 24 * 60 * 60 * 1000;
export const SEGUIMIENTO_MAX_INTENTOS = 3;
export const SEGUIMIENTO_MAX_POR_CORRIDA = 40;
export const PREFIJO_SEGUIMIENTO = 'curso-enc:';
export const PREFIJO_PROGRAMADO = 'curso-enc-prog:';
export const CORREO_REMITENTE = 'Solca Ciencia <hola@solcaciencia.com>';

export interface SeguimientoPendiente {
  email: string;
  tipo: TipoSeguimiento;
  cierre: string; // ISO de la encuesta de cierre
  interno: boolean;
  intentos: number;
}

export interface KvSeguimiento {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expiration?: number; expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string; limit?: number }): Promise<{ keys: Array<{ name: string }>; list_complete: boolean; cursor?: string }>;
}

/**
 * Programa los correos de 30 y 90 días al recibir la encuesta de cierre. Una sola vez por correo (marca
 * `curso-enc-prog:<hash>` durante 100 días): responder el cierre dos veces no duplica los envíos. Nunca lanza.
 * Devuelve cuántos envíos programó (0 o 2).
 */
export async function programarSeguimiento(
  kv: KvSeguimiento,
  datos: { email: string; emailHash: string; interno: boolean },
  now = Date.now(),
): Promise<number> {
  if (!datos.email || !datos.emailHash) return 0;
  try {
    const marca = PREFIJO_PROGRAMADO + datos.emailHash;
    if (await kv.get(marca)) return 0;
    const cierre = new Date(now).toISOString();
    for (const tipo of ['30-dias', '90-dias'] as const) {
      const venceMs = now + SEGUIMIENTO_DIAS[tipo] * DIA_MS;
      const p: SeguimientoPendiente = { email: datos.email, tipo, cierre, interno: datos.interno, intentos: 0 };
      // La llave empieza con la fecha de envío: el listado sale ordenado por fecha. Caduca 7 días después.
      await kv.put(`${PREFIJO_SEGUIMIENTO}${new Date(venceMs).toISOString()}:${tipo}:${crypto.randomUUID()}`, JSON.stringify(p), {
        expiration: Math.floor((venceMs + 7 * DIA_MS) / 1000),
      });
    }
    await kv.put(marca, cierre, { expiration: Math.floor((now + 100 * DIA_MS) / 1000) });
    return 2;
  } catch (err) {
    console.warn('encuesta-curso: no se pudo programar el seguimiento', String(err).slice(0, 160));
    return 0;
  }
}

/** Llaves cuya fecha de envío ya pasó, en orden de fecha y con tope. */
export async function seguimientosVencidos(kv: KvSeguimiento, now = Date.now(), max = SEGUIMIENTO_MAX_POR_CORRIDA): Promise<string[]> {
  const ahora = new Date(now).toISOString();
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const r = await kv.list({ prefix: PREFIJO_SEGUIMIENTO, cursor, limit: 1000 });
    for (const k of r.keys) {
      const fecha = k.name.slice(PREFIJO_SEGUIMIENTO.length, PREFIJO_SEGUIMIENTO.length + 24);
      if (fecha > ahora) return out;
      out.push(k.name);
      if (out.length >= max) return out;
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return out;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Correo de 30 o 90 días con el texto de 06-encuestas-y-correos.md. Puro (para pruebas).
 * El saludo del documento es "Hola, [nombre]:". Hoy no hay nombre: ninguna encuesta lo pide y el webhook de
 * Hotmart no lo guarda. Sin nombre, el saludo queda "Hola:".
 */
export function renderSeguimiento(tipo: TipoSeguimiento, nombre?: string): { subject: string; html: string; text: string } {
  const url = urlEncuesta(tipo, 'email');
  const n = (nombre ?? '').trim().slice(0, 60);
  const saludo = n ? `Hola, ${n}:` : 'Hola:';
  const c =
    tipo === '30-dias'
      ? {
          subject: '¿Cómo va tu búsqueda? Tres minutos',
          parrafos: [
            'Hace un mes terminaste el curso De la ciencia a la industria. Queremos saber cómo va tu búsqueda, avances o no. Son seis preguntas y toman unos tres minutos.',
          ],
          despues: 'Si cambiaste de objetivo o pausaste la búsqueda, también nos sirve saberlo.',
        }
      : {
          subject: 'Tres meses después: ¿qué pasó con tu búsqueda?',
          parrafos: [
            'Han pasado tres meses desde que terminaste el curso. Nos ayudaría saber qué pasó con tu búsqueda, sea cual sea el resultado. Son las mismas preguntas del mes pasado y toman unos tres minutos.',
          ],
          despues: 'Tus respuestas nos ayudan a mejorar el curso para quienes vienen detrás.',
        };
  const boton = 'Responder la encuesta';
  const firma = 'Equipo de Solca Ciencia';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
<p>${esc(saludo)}</p>
${c.parrafos.map((p) => `<p>${esc(p)}</p>`).join('\n')}
<p><a href="${esc(url)}" style="display:inline-block;padding:12px 18px;background:#0F2748;border-radius:6px;color:#ffffff;text-decoration:none;font-weight:bold">${esc(boton)}</a></p>
<p>${esc(c.despues)}</p>
<p>${esc(firma)}</p>
</div>`;
  const text = [saludo, '', ...c.parrafos, '', `${boton}: ${url}`, '', c.despues, '', firma].join('\n');
  return { subject: c.subject, html, text };
}
