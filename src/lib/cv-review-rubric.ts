/**
 * Rúbrica v2 del revisor de CV y validación de la salida del modelo · 6 nov 2026.
 *
 * Fuentes (carpeta ../consultoria/investigacion/):
 *   - 2026-11-plan-revisor-cv.md (decisiones de Oscar)
 *   - 2026-11-auditoria-revisor-cv.md §2.3-2.6 y §3.1-3.3 (reporte, campos, huecos)
 *   - 2026-11-cv-mejores-practicas.md §2 y §5 (prácticas de consenso; C1..C19 abajo)
 *
 * Este archivo es puro (sin imports de runtime) para que lo usen el endpoint, la página y el script de
 * prueba (`node scripts/test-cv-review.mjs`) sin llamar al modelo. Si cambias un criterio, sube
 * RUBRIC_VERSION: los estados guardados en D1 se comparan por versión.
 */

import type { Role } from './simulator-types';

export const RUBRIC_VERSION = 'v2-2026-11';

export type Estado = 'prioritario' | 'mejorable' | 'solido' | 'no_evaluable';
export const ESTADOS: Estado[] = ['prioritario', 'mejorable', 'solido', 'no_evaluable'];

export type GrupoId =
  | 'posicionamiento'
  | 'logros'
  | 'palabras_clave'
  | 'estructura'
  | 'formato_ats'
  | 'datos_riesgos';

/** Los 6 grupos del reporte (auditoría §2.3). El orden es el de la pantalla y el PDF. */
export const GRUPOS: Array<{ id: GrupoId; label: string }> = [
  { id: 'posicionamiento', label: 'Posicionamiento' },
  { id: 'logros', label: 'Logros y evidencia' },
  { id: 'palabras_clave', label: 'Palabras clave' },
  { id: 'estructura', label: 'Estructura y lectura' },
  { id: 'formato_ats', label: 'Formato y lectura automática' },
  { id: 'datos_riesgos', label: 'Datos y riesgos' },
];

export interface Criterio {
  id: number;
  nombre: string;
  grupo: GrupoId;
  /** Qué revisa y cómo decidir el estado. Va tal cual al prompt. */
  guia: string;
  /** Depende de una señal de formato que puede faltar (páginas, saltos de línea, PDF). */
  formato?: 'paginas' | 'saltos' | 'pdf';
}

/**
 * 20 criterios con id estable. El grupo lo asigna este mapa, nunca el modelo.
 * Entre paréntesis, la práctica de consenso (C#) de 2026-11-cv-mejores-practicas.md.
 */
export const CRITERIOS: Criterio[] = [
  // Posicionamiento
  {
    id: 1,
    nombre: 'Rol objetivo visible',
    grupo: 'posicionamiento',
    guia: 'En el primer tercio de la primera página se entiende a qué puesto apunta la persona (titular bajo el nombre o primera línea del resumen) (C18, C11). Prioritario si no se distingue ningún rol.',
  },
  {
    id: 2,
    nombre: 'Resumen o perfil',
    grupo: 'posicionamiento',
    guia: 'Hay un resumen al inicio de 2 a 5 frases que dice quién es, qué sabe hacer y por qué encaja en el rol objetivo (C4). Prioritario si no existe; mejorable si es genérico, larguísimo o no se conecta con el rol.',
  },
  {
    id: 3,
    nombre: 'Adaptación al tipo de rol',
    grupo: 'posicionamiento',
    guia: 'Lo que se incluye y el orden en que aparece están elegidos para el rol objetivo; si no hay rol declarado, evalúa si el contenido apunta a una dirección clara (C11). No compares contra una vacante: este análisis es general.',
  },
  {
    id: 4,
    nombre: 'Trayectoria coherente',
    grupo: 'posicionamiento',
    guia: 'Las experiencias cuentan una progresión entendible hacia el rol objetivo; las que no se relacionan están resumidas en vez de ocupar espacio.',
  },
  // Logros y evidencia
  {
    id: 5,
    nombre: 'Logros en vez de funciones',
    grupo: 'logros',
    guia: 'Las viñetas dicen qué logró la persona con la fórmula verbo + qué + cómo + resultado, no la lista de responsabilidades del puesto ni texto copiado de una vacante (C9, C10).',
  },
  {
    id: 6,
    nombre: 'Resultados con escala o cifra',
    grupo: 'logros',
    guia: 'Los logros incluyen escala, cantidad, tiempo o resultado (muestras, estudios, sitios, pacientes, financiamiento, personas supervisadas) (C9). Si faltan cifras, recomienda dónde agregarlas con un hueco visible como [n de muestras]; nunca propongas una cifra.',
  },
  {
    id: 7,
    nombre: 'Verbos de acción y autoría propia',
    grupo: 'logros',
    guia: 'Verbos que muestran lo que hizo la persona ("diseñé", "coordiné", "validé") en vez de "participé en" o "apoyé"; deja claro su papel cuando el logro fue de un equipo y no se atribuye resultados colectivos (C17).',
  },
  {
    id: 8,
    nombre: 'Competencias transferibles con evidencia',
    grupo: 'logros',
    guia: 'Se ven competencias que la industria valora (gestión de proyectos, colaboración entre áreas, comunicación a no especialistas, manejo de datos, cumplimiento de normas) respaldadas por un ejemplo, no listadas sueltas (C6).',
  },
  {
    id: 9,
    nombre: 'Lenguaje llano',
    grupo: 'logros',
    guia: 'Un lector de recursos humanos sin formación científica entiende qué hizo la persona; la jerga de laboratorio va con contexto o se traduce (C5).',
  },
  // Palabras clave
  {
    id: 10,
    nombre: 'Términos del rol con naturalidad',
    grupo: 'palabras_clave',
    guia: 'Los términos propios del rol objetivo aparecen dentro del resumen, la experiencia y las habilidades, no solo en una lista al final (C12). Sin rol declarado, evalúa contra el rol que se infiere y dilo.',
  },
  {
    id: 11,
    nombre: 'Sin relleno de palabras clave',
    grupo: 'palabras_clave',
    guia: 'No hay listas largas de palabras sin contexto ni repeticiones forzadas; todo lo que se nombra se puede sostener en una entrevista (C13).',
  },
  {
    id: 12,
    nombre: 'Títulos de puesto claros',
    grupo: 'palabras_clave',
    guia: 'Los puestos académicos ("posdoc", "asistente de investigación") llevan una descripción del rol real, sin inflarlos ni ocultar que fueron académicos (C8).',
  },
  // Estructura y lectura
  {
    id: 13,
    nombre: 'No es un CV académico',
    grupo: 'estructura',
    guia: 'No es el CV académico completo: no lista todos los congresos, cursos, docencia o comités; prioriza lo que importa para el rol (C14, C17).',
  },
  {
    id: 14,
    nombre: 'Extensión',
    grupo: 'estructura',
    formato: 'paginas',
    guia: 'Usa el número de páginas que llega en los datos del formulario. Máximo 2 páginas para LATAM y España (C14): 3 o más es prioritario. Si el número de páginas es desconocido, el estado es no_evaluable.',
  },
  {
    id: 15,
    nombre: 'Secciones y orden cronológico',
    grupo: 'estructura',
    guia: 'Secciones reconocibles (resumen, experiencia, educación, habilidades) y experiencia en orden cronológico inverso con fechas en cada puesto (C3).',
  },
  {
    id: 16,
    nombre: 'Publicaciones resumidas',
    grupo: 'estructura',
    guia: 'Si hay publicaciones, están seleccionadas o resumidas (número, primer autor, relevancia) con enlace a la lista completa, en vez de la bibliografía entera (C7). Para roles de I+D, MSL o medical writing pesan más. Si el CV no tiene publicaciones, el estado es no_evaluable.',
  },
  {
    id: 17,
    nombre: 'Viñetas fáciles de escanear',
    grupo: 'estructura',
    formato: 'saltos',
    guia: 'Viñetas de una o dos líneas en lugar de párrafos densos (C2). Depende de que el texto conserve los saltos de línea; si llega aplanado, el estado es no_evaluable.',
  },
  // Formato y lectura automática
  {
    id: 18,
    nombre: 'Una columna, sin tablas ni gráficos',
    grupo: 'formato_ats',
    formato: 'pdf',
    guia: 'Solo con texto extraído de un PDF: si el orden salió revuelto (frases cortadas, columnas mezcladas, fechas separadas de su puesto), sugiere una sola columna sin tablas, cuadros de texto ni gráficos con información clave (C1). Con texto pegado, el estado es no_evaluable. No afirmes cómo funciona un sistema de reclutamiento concreto.',
  },
  // Datos y riesgos
  {
    id: 19,
    nombre: 'Contacto y LinkedIn',
    grupo: 'datos_riesgos',
    guia: 'Correo, teléfono y enlace a LinkedIn (C19). Sin datos sensibles innecesarios (estado civil, religión, CURP o DNI completo, dirección completa). La foto no se ve en el texto: no la evalúes.',
  },
  {
    id: 20,
    nombre: 'Consistencia y señales de alerta',
    grupo: 'datos_riesgos',
    guia: 'Fechas consistentes, huecos sin explicar, ortografía, tiempos verbales y afirmaciones exageradas o difíciles de sostener (C17).',
  },
];

export const CRITERIO_POR_ID: Map<number, Criterio> = new Map(CRITERIOS.map((c) => [c.id, c]));

export const NIVELES = [
  'Estudiante o recién egresado',
  'Posgrado o investigación académica',
  'Experiencia en industria (menos de 5 años)',
  'Experiencia en industria (5 años o más)',
  'No se distingue',
] as const;

/**
 * Rol objetivo opcional del formulario: los 10 roles del catálogo del simulador
 * (ROLE_KEYWORDS en simulator-defaults.ts). El tipo Record obliga a tener los 10.
 */
export const ROLE_LABELS: Record<Exclude<Role, 'Other'>, string> = {
  CRA: 'Monitor clínico (CRA)',
  MSL: 'Medical Science Liaison (MSL)',
  Clinical_PM: 'Project Manager clínico',
  Healthcare_Analyst: 'Analista de datos en salud',
  Strategy_Consulting: 'Consultoría estratégica en ciencias de la vida',
  Regulatory: 'Asuntos regulatorios',
  Pharmacovigilance: 'Farmacovigilancia',
  HEOR: 'HEOR (economía de la salud)',
  Associate_Clinical_Scientist: 'Associate Clinical Scientist',
  Medical_Affairs: 'Asuntos médicos (Medical Affairs)',
};
export const ROL_NO_SEGURO = 'no_seguro';
export const ROL_NO_SEGURO_LABEL = 'Aún no lo decido';

/** Valor válido del formulario o undefined. */
export function readRolObjetivo(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  if (v === ROL_NO_SEGURO) return v;
  return Object.prototype.hasOwnProperty.call(ROLE_LABELS, v) ? v : undefined;
}

export function rolLabel(value: string | undefined): string | undefined {
  if (!value || value === ROL_NO_SEGURO) return undefined;
  return (ROLE_LABELS as Record<string, string>)[value];
}

/**
 * "Avísame cuando esté disponible" (CV adaptado a una vacante). La página muestra estos textos tal cual y
 * /api/cv-waitlist guarda la versión aceptada. Si cambias un texto, sube WAITLIST_TEXT_VERSION.
 */
export const WAITLIST_TEXT_VERSION = 'w1-2026-11';
export const WAITLIST_BOTON = 'Avísame cuando esté disponible';
export const WAITLIST_NOTA =
  'Te escribimos una sola vez, al correo que usaste para este análisis, cuando la versión adaptada a una vacante esté lista.';
export const WAITLIST_TEXT = `${WAITLIST_BOTON}. ${WAITLIST_NOTA}`;

// ── Tipos de la salida validada ─────────────────────────────────────────────────────────────────

export interface Observacion {
  id: number;
  categoria: string;
  grupo: GrupoId;
  estado: Estado;
  evaluacion: string;
  recomendacion: string;
  evidencia: string | null;
}
export interface Prioridad {
  id_observacion: number;
  accion: string;
  por_que: string;
  esfuerzo: string;
}
export interface Reescritura {
  antes: string;
  despues: string;
  principio: string;
}
export interface CvReviewResult {
  candidateName: string;
  resumen: { una_linea: string | null };
  perfil: { nivel: string; rol_objetivo: string | null };
  prioridades: Prioridad[];
  reescrituras: Reescritura[];
  observaciones: Observacion[];
  retroalimentacion: string;
  rubric_version: string;
}

export interface ReviewContext {
  cv: string;
  origen: 'pdf' | 'pegado';
  paginas: number | null;
  rolObjetivo?: string; // valor del formulario (código de rol o 'no_seguro')
}

export interface ValidationReport {
  /** Hubo que descartar o rellenar algo. El análisis se muestra igual. */
  parcial: boolean;
  /** Conteos de lo que se corrigió, para D1 (sin texto). */
  issues: Record<string, number>;
}

// ── Normalización y búsqueda de citas ───────────────────────────────────────────────────────────

/** Normaliza para comparar citas: NFKC (ligaduras de PDF), comillas y rayas, espacios colapsados. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quita viñetas y comillas que el modelo suele poner alrededor de una cita. */
function stripQuoteWrapping(s: string): string {
  return s
    .trim()
    .replace(/^["'«»“”]+|["'«»“”]+$/g, '')
    .replace(/^[•●▪■\-*–—·]\s*/, '')
    .replace(/(\.\.\.|…)$/, '')
    .trim();
}

/** true si `quote` aparece literal en el CV (con espacios normalizados). */
export function isLiteralQuote(quote: string, normalizedCv: string): boolean {
  const q = normalizeForMatch(stripQuoteWrapping(quote));
  if (q.length < 8) return false;
  return normalizedCv.includes(q);
}

// ── Frases prohibidas (auditoría §2.6 y prompt) ─────────────────────────────────────────────────

const BANNED: Array<{ key: string; re: RegExp }> = [
  { key: 'segundos', re: /\b(?:\d+(?:[.,]\d+)?|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta)\s*(?:a|-|–)?\s*\d*\s*segundos\b/i },
  { key: 'comparativo', re: /\b(?:top\s*\d+\s*%|m[aá]s que la mayor[ií]a|arriba del promedio|pocas personas|la mayor[ií]a de (?:los |las )?(?:candidat|reclutador|perfiles|cv)|el promedio de|otros candidat\w*)/i },
  { key: 'promesa', re: /\b(?:garantiz\w*|conseguir[aá]s|te (?:van a )?llamar[aá]n|pasar[aá]s (?:el|los) (?:filtro|ats)|te llamen|conseguir (?:m[aá]s )?entrevistas)/i },
  { key: 'ats_concreto', re: /\b(?:workday|taleo|greenhouse|successfactors|icims|lever ats)\b/i },
  { key: 'anecdota', re: /\b(?:en mi experiencia|yo como reclutador|cuando yo (?:era|trabajaba|reclutaba)|he visto (?:muchos|cientos|miles)|en mi caso|he revisado)/i },
];

export function bannedHits(text: string): string[] {
  return BANNED.filter((b) => b.re.test(text)).map((b) => b.key);
}

/** Quita las oraciones que contienen una frase prohibida. */
export function scrubBanned(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.filter((s) => bannedHits(s).length === 0).join(' ').trim();
}

/** Cifras de `despues` (fuera de huecos [..]) que no aparecen en el CV. */
export function inventedNumbers(despues: string, normalizedCv: string): string[] {
  const sinHuecos = despues.replace(/\[[^\]]*\]/g, ' ');
  const nums = sinHuecos.match(/\d+(?:[.,]\d+)?/g) ?? [];
  // Con límites de dígito: un "3" inventado no se esconde dentro de un "2023" del CV.
  return nums.filter((n) => !new RegExp(`(^|\\D)${n.replace(/[.]/g, '\\.')}(\\D|$)`).test(normalizedCv));
}

// ── Validación ───────────────────────────────────────────────────────────────────────────────────

function str(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  const t = v.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function readEstado(v: unknown): Estado | null {
  if (typeof v !== 'string') return null;
  const t = v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  if (t === 'prioritario') return 'prioritario';
  if (t === 'mejorable') return 'mejorable';
  if (t === 'solido') return 'solido';
  if (t === 'no_evaluable' || t === 'no_aplica') return 'no_evaluable';
  return null;
}

function normName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Cuántos saltos de línea reales trae el texto (para decidir si la viñeta se puede evaluar). */
export function lineBreakCount(cv: string): number {
  return (cv.match(/\n/g) ?? []).length;
}
const MIN_SALTOS = 8;

/** Señales de formato que el código fuerza, aunque el modelo diga otra cosa. */
function formatOverride(c: Criterio, ctx: ReviewContext): string | null {
  if (c.formato === 'paginas' && !ctx.paginas)
    return 'No sabemos cuántas páginas tiene tu CV porque el texto se pegó. Revísalo tú: para LATAM y España, máximo 2 páginas.';
  if (c.formato === 'saltos' && lineBreakCount(ctx.cv) < MIN_SALTOS)
    return 'El texto llegó sin saltos de línea, así que no se puede juzgar cómo se ven tus viñetas.';
  if (c.formato === 'pdf' && ctx.origen !== 'pdf')
    return 'Con texto pegado no se ve el diseño (columnas, tablas, gráficos). Si subes el PDF, esta parte se puede revisar.';
  return null;
}

/**
 * Convierte la salida cruda del modelo en un resultado seguro de mostrar.
 * Acepta parciales: lo que no pasa la validación se descarta o se rellena desde las observaciones.
 * Devuelve null solo si no queda nada útil (sin observaciones ni prioridades).
 */
export function validateCvReview(
  raw: unknown,
  ctx: ReviewContext,
): { result: CvReviewResult; report: ValidationReport } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const issues: Record<string, number> = {};
  const bump = (k: string, n = 1) => {
    issues[k] = (issues[k] ?? 0) + n;
  };
  const normCv = normalizeForMatch(ctx.cv);

  // Observaciones: id estable; categoría y grupo del mapa; evidencia verificada.
  const byId = new Map<number, Observacion>();
  const rawObs = Array.isArray(r.observaciones) ? r.observaciones : [];
  rawObs.forEach((o, idx) => {
    if (!o || typeof o !== 'object') return bump('obs_invalida');
    const ob = o as Record<string, unknown>;
    let id = typeof ob.id === 'number' ? ob.id : Number.parseInt(String(ob.id ?? ''), 10);
    if (!CRITERIO_POR_ID.has(id)) {
      const byName = CRITERIOS.find((c) => normName(c.nombre) === normName(String(ob.categoria ?? '')));
      id = byName ? byName.id : rawObs.length === CRITERIOS.length ? idx + 1 : NaN;
    }
    const crit = CRITERIO_POR_ID.get(id);
    if (!crit || byId.has(id)) return bump('obs_invalida');
    let estado = readEstado(ob.estado);
    if (!estado) {
      bump('estado_invalido');
      estado = 'mejorable';
    }
    let evaluacion = str(ob.evaluacion, 400);
    let recomendacion = str(ob.recomendacion, 400);
    if (!evaluacion) return bump('obs_sin_texto');
    let evidencia: string | null = str(ob.evidencia, 220) || null;
    if (evidencia && !isLiteralQuote(evidencia, normCv)) {
      evidencia = null;
      bump('evidencia_descartada');
    }
    const override = formatOverride(crit, ctx);
    if (override) {
      if (estado !== 'no_evaluable') bump('formato_forzado');
      estado = 'no_evaluable';
      evaluacion = override;
      recomendacion = '';
      evidencia = null;
    }
    for (const t of [evaluacion, recomendacion]) for (const h of bannedHits(t)) bump(`prohibido_${h}`);
    byId.set(id, { id, categoria: crit.nombre, grupo: crit.grupo, estado, evaluacion, recomendacion, evidencia });
  });
  const observaciones = CRITERIOS.map((c) => byId.get(c.id)).filter((o): o is Observacion => !!o);
  if (observaciones.length < CRITERIOS.length) bump('obs_faltantes', CRITERIOS.length - observaciones.length);

  // Prioridades: deben apuntar a una observación accionable.
  const prioridades: Prioridad[] = [];
  const usadas = new Set<number>();
  for (const p of Array.isArray(r.prioridades) ? r.prioridades : []) {
    if (prioridades.length >= 3) break;
    if (!p || typeof p !== 'object') continue;
    const pr = p as Record<string, unknown>;
    const idObs = typeof pr.id_observacion === 'number' ? pr.id_observacion : Number.parseInt(String(pr.id_observacion ?? ''), 10);
    const obs = byId.get(idObs);
    const accion = str(pr.accion, 300);
    if (!obs || !accion || usadas.has(idObs) || obs.estado === 'no_evaluable' || obs.estado === 'solido') {
      bump('prioridad_descartada');
      continue;
    }
    usadas.add(idObs);
    prioridades.push({ id_observacion: idObs, accion, por_que: str(pr.por_que, 300), esfuerzo: str(pr.esfuerzo, 30) });
  }
  // Relleno desde las observaciones (prioritario primero) si el modelo dio menos de 3.
  if (prioridades.length < 3) {
    for (const estado of ['prioritario', 'mejorable'] as Estado[]) {
      for (const o of observaciones) {
        if (prioridades.length >= 3) break;
        if (o.estado !== estado || usadas.has(o.id) || !o.recomendacion) continue;
        usadas.add(o.id);
        prioridades.push({ id_observacion: o.id, accion: o.recomendacion, por_que: o.evaluacion, esfuerzo: '' });
        bump('prioridad_rellenada');
      }
    }
  }

  // Reescrituras: "antes" literal del CV; "después" sin cifras que no estén en el CV.
  const reescrituras: Reescritura[] = [];
  for (const w of Array.isArray(r.reescrituras) ? r.reescrituras : []) {
    if (reescrituras.length >= 2) break;
    if (!w || typeof w !== 'object') continue;
    const rw = w as Record<string, unknown>;
    const antes = str(rw.antes, 400);
    const despues = str(rw.despues, 500);
    if (!antes || !despues) {
      bump('reescritura_vacia');
      continue;
    }
    if (!isLiteralQuote(antes, normCv)) {
      bump('reescritura_no_literal');
      continue;
    }
    if (inventedNumbers(despues, normCv).length > 0) {
      bump('reescritura_cifra_inventada');
      continue;
    }
    reescrituras.push({ antes: stripQuoteWrapping(antes), despues, principio: str(rw.principio, 200) });
  }

  // Resumen, perfil y retroalimentación.
  const resumenRaw = r.resumen && typeof r.resumen === 'object' ? (r.resumen as Record<string, unknown>) : {};
  let unaLinea = str(resumenRaw.una_linea, 300);
  if (bannedHits(unaLinea).length) {
    bump('prohibido_resumen');
    unaLinea = scrubBanned(unaLinea);
  }
  let retro = str(r.retroalimentacion, 1200);
  const retroHits = bannedHits(retro);
  if (retroHits.length) {
    bump('prohibido_retro', retroHits.length);
    retro = scrubBanned(retro);
  }
  const perfilRaw = r.perfil && typeof r.perfil === 'object' ? (r.perfil as Record<string, unknown>) : {};
  const nivelRaw = str(perfilRaw.nivel, 80);
  const nivel = (NIVELES as readonly string[]).includes(nivelRaw) ? nivelRaw : 'No se distingue';
  const rolForm = rolLabel(ctx.rolObjetivo);
  const rolModelo = str(perfilRaw.rol_objetivo, 80);
  const rolObjetivo = rolForm ?? (rolModelo && !/^(null|ninguno|no se distingue)$/i.test(rolModelo) ? rolModelo : null);

  if (observaciones.length === 0 && prioridades.length === 0) return null;
  if (!unaLinea) bump('sin_resumen');
  if (!retro) bump('sin_retro');
  if (reescrituras.length < 2) bump('reescrituras_faltantes', 2 - reescrituras.length);

  const candidateName = str(r.candidateName, 80) || 'Candidato';
  const parcial = Object.keys(issues).some((k) =>
    ['obs_faltantes', 'sin_resumen', 'sin_retro', 'obs_invalida', 'obs_sin_texto'].includes(k),
  );
  return {
    result: {
      candidateName,
      resumen: { una_linea: unaLinea || null },
      perfil: { nivel, rol_objetivo: rolObjetivo },
      prioridades,
      reescrituras,
      observaciones,
      retroalimentacion: retro,
      rubric_version: RUBRIC_VERSION,
    },
    report: { parcial, issues },
  };
}

// ── JSON truncado ────────────────────────────────────────────────────────────────────────────────

/**
 * Si el modelo se cortó por max_tokens, recorta hasta el último objeto completo y cierra las llaves
 * abiertas. Devuelve null si no se puede reparar. El orden de campos del prompt (observaciones casi al
 * final) hace que lo que se pierde sea lo menos importante.
 */
export function parseJsonLenient(text: string): { value: unknown; repaired: boolean } | null {
  try {
    return { value: JSON.parse(text), repaired: false };
  } catch {
    /* intenta reparar */
  }
  const cuts: number[] = [];
  for (let i = text.length - 1; i > 0 && cuts.length < 80; i--) if (text[i] === '}' || text[i] === ']') cuts.push(i + 1);
  for (const cut of cuts) {
    const prefix = text.slice(0, cut);
    const stack: string[] = [];
    let inStr = false;
    let esc = false;
    for (const ch of prefix) {
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') stack.pop();
    }
    if (inStr) continue;
    const closers = stack
      .reverse()
      .map((c) => (c === '{' ? '}' : ']'))
      .join('');
    try {
      return { value: JSON.parse(prefix.replace(/,\s*$/, '') + closers), repaired: true };
    } catch {
      /* sigue probando con un corte anterior */
    }
  }
  return null;
}

// ── Lógica del reporte (pantalla y PDF) ──────────────────────────────────────────────────────────

export function countByEstado(obs: Observacion[]): Record<Estado, number> {
  const c: Record<Estado, number> = { prioritario: 0, mejorable: 0, solido: 0, no_evaluable: 0 };
  for (const o of obs) c[o.estado]++;
  return c;
}

export function groupObservaciones(obs: Observacion[]): Array<{ id: GrupoId; label: string; items: Observacion[]; counts: Record<Estado, number> }> {
  return GRUPOS.map((g) => {
    const items = obs.filter((o) => o.grupo === g.id);
    return { ...g, items, counts: countByEstado(items) };
  });
}

/** Grupo con más ▲ (empate: el primero en el orden del reporte). null si no hay ningún prioritario. */
export function topGrupo(obs: Observacion[]): GrupoId | null {
  let best: GrupoId | null = null;
  let max = 0;
  for (const g of groupObservaciones(obs)) {
    if (g.counts.prioritario > max) {
      max = g.counts.prioritario;
      best = g.id;
    }
  }
  return best;
}

export type NextStep = 'quiz' | 'curso' | 'simulador';

/** Grupo del hallazgo principal: la primera prioridad o, si no hay, el grupo con más ▲. */
export function topFindingGrupo(res: Pick<CvReviewResult, 'observaciones' | 'prioridades'>): GrupoId | null {
  return res.prioridades[0] ? CRITERIO_POR_ID.get(res.prioridades[0].id_observacion)?.grupo ?? null : topGrupo(res.observaciones);
}

/**
 * Un solo siguiente paso, elegido en código por el hallazgo principal (auditoría §3.7):
 *   - ningún prioritario → simulador ("el CV ya cumple; ensaya la llamada")
 *   - con rol elegido en el formulario (`rolFormulario`, uno de los 10 del catálogo): nunca quiz; en otro caso
 *     → curso (también si lo más débil es el posicionamiento: el rol ya está decidido, falta que el CV lo diga).
 *     Corrige el 6 nov 2026 el "si todavía dudas entre roles" a quien ya eligió rol.
 *   - sin rol elegido: rol que no se distingue o posicionamiento como lo más débil → quiz; si no → curso
 */
export function pickNextStep(
  res: Pick<CvReviewResult, 'observaciones' | 'prioridades' | 'perfil'>,
  rolFormulario?: string,
): NextStep {
  const top = topFindingGrupo(res);
  const rolElegido = !!rolLabel(rolFormulario);
  if (rolElegido) return countByEstado(res.observaciones).prioritario === 0 ? 'simulador' : 'curso';
  if (!res.perfil.rol_objetivo || top === 'posicionamiento') return 'quiz';
  if (countByEstado(res.observaciones).prioritario === 0) return 'simulador';
  return 'curso';
}

/**
 * Primera frase del bloque del curso (pantalla, PDF y correo). Con rol elegido y el posicionamiento como lo más
 * débil, nombra el rol en vez de mandar al quiz (6 nov 2026).
 */
export function cursoLead(res: Pick<CvReviewResult, 'observaciones' | 'prioridades'>, rolFormulario?: string): string {
  const rol = rolLabel(rolFormulario);
  if (rol && topFindingGrupo(res) === 'posicionamiento') {
    return `Lo prioritario en tu CV es el posicionamiento: que se entienda pronto que apuntas a ${rol} y por qué encajas.`;
  }
  return 'Lo prioritario en tu CV está en la redacción y la estructura.';
}
