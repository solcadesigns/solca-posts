/**
 * Catálogo único de la encuesta de mercado · v1 (20 oct 2026).
 *
 * Fuente de verdad de preguntas, valores y equivalencias. Lo usan:
 *   - src/components/MarketSurvey.astro (pinta las preguntas)
 *   - src/pages/api/market-survey.ts (valida y guarda)
 *   - scripts/backfill-mercado.mjs (carga histórica)
 * Documento de diseño: _docs/CATALOGO_ENCUESTA_MERCADO.md.
 *
 * Solo TypeScript borrable (sin enums ni namespaces) para que Node lo importe
 * directo en los scripts.
 */

export const CATALOGO_VERSION = 'v1';

export type Origen = 'simulador' | 'quiz' | 'cv';
export const ORIGENES: readonly Origen[] = ['simulador', 'quiz', 'cv'];

export interface MarketOption {
  value: string;
  label: string;
}

export interface MarketQuestion {
  id: string;
  text: string;
  options: MarketOption[];
}

export const QUESTIONS: Record<string, MarketQuestion> = {
  pais: {
    id: 'pais',
    text: '¿En qué país vives?',
    options: [
      { value: 'mx', label: 'México' },
      { value: 'br', label: 'Brasil' },
      { value: 'ar', label: 'Argentina' },
      { value: 'co', label: 'Colombia' },
      { value: 'cl', label: 'Chile' },
      { value: 'es', label: 'España' },
      { value: 'pe', label: 'Perú' },
      { value: 'ec', label: 'Ecuador' },
      { value: 'otro_latam', label: 'Otro país de América Latina' },
      { value: 'otro', label: 'Otro' },
    ],
  },
  etapa: {
    id: 'etapa',
    text: '¿En qué etapa de tu trayectoria estás?',
    options: [
      { value: 'lic_maestria_cursando', label: 'Estudio licenciatura o maestría' },
      { value: 'lic_maestria_egresado', label: 'Terminé licenciatura o maestría, en transición' },
      { value: 'phd_en_curso', label: 'PhD en curso' },
      { value: 'phd_terminado', label: 'PhD terminado, en transición' },
      { value: 'postdoc', label: 'Postdoc' },
      { value: 'industria', label: 'Ya trabajo en industria y busco moverme de rol' },
    ],
  },
  formacion: {
    id: 'formacion',
    text: '¿Cuál es tu formación principal?',
    options: [
      { value: 'biomedicas', label: 'Ciencias biomédicas y biológicas' },
      { value: 'quimico_farma', label: 'Ciencias químico-farmacéuticas' },
      { value: 'clinicas_salud', label: 'Ciencias clínicas y de la salud' },
      { value: 'datos', label: 'Matemáticas, estadística y datos' },
      { value: 'negocios_salud_publica', label: 'Administración, economía y salud pública' },
      { value: 'otra', label: 'Otra' },
    ],
  },
  rol_interes: {
    id: 'rol_interes',
    text: '¿Qué rol te interesa más?',
    options: [
      { value: 'ventas', label: 'Ventas / visitador médico' },
      { value: 'investigacion_clinica', label: 'Investigación clínica (CRA, CRC)' },
      { value: 'msl', label: 'Medical Science Liaison' },
      { value: 'clinical_pm', label: 'Project Manager clínico' },
      { value: 'consulting', label: 'Consultoría' },
      { value: 'laboratorio_rd', label: 'Laboratorio / R&D' },
      { value: 'regulatorio', label: 'Asuntos regulatorios' },
      { value: 'farmacovigilancia', label: 'Farmacovigilancia' },
      { value: 'heor_analytics', label: 'HEOR / Analytics' },
      { value: 'medical_affairs', label: 'Medical Affairs' },
      { value: 'otro', label: 'Otro' },
      { value: 'sin_decidir', label: 'Aún no decido' },
    ],
  },
  obstaculo: {
    id: 'obstaculo',
    text: '¿Qué te está frenando más para entrar o moverte en la industria?',
    options: [
      { value: 'no_se_que_rol', label: 'No sé qué rol específico me queda' },
      { value: 'no_me_llaman', label: 'Aplico pero no me llaman' },
      { value: 'entrevistas', label: 'Llego a entrevistas pero no paso' },
      { value: 'ingles', label: 'Mi inglés profesional' },
      { value: 'networking', label: 'Me falta red de contactos en industria' },
      { value: 'tiempo', label: 'No tengo tiempo para prepararme' },
      { value: 'otro', label: 'Otro' },
    ],
  },
  urgencia: {
    id: 'urgencia',
    text: '¿Para cuándo quieres hacer el cambio?',
    options: [
      { value: '0_3m', label: 'Lo antes posible (0-3 meses)' },
      { value: '3_6m', label: '3-6 meses' },
      { value: '6_12m', label: '6-12 meses' },
      { value: 'mas_12m', label: 'Más de un año' },
      { value: 'explorando', label: 'Solo estoy explorando' },
    ],
  },
  // Propias del analizador de CV: aparecen solo cuando el núcleo ya está completo.
  ingles: {
    id: 'ingles',
    text: '¿Cómo describirías tu inglés profesional?',
    options: [
      { value: 'nativo', label: 'Nativo' },
      { value: 'avanzado', label: 'Avanzado (entrevistas y reuniones técnicas sin problema)' },
      { value: 'intermedio', label: 'Intermedio (me defiendo, pero me cuesta)' },
      { value: 'basico', label: 'Básico (leo, pero hablar es difícil)' },
    ],
  },
  movilidad: {
    id: 'movilidad',
    text: '¿Te moverías de país por la oferta correcta?',
    options: [
      { value: 'cualquier_pais', label: 'Sí, a cualquier país' },
      { value: 'hispanos', label: 'Sí, solo a países de habla hispana' },
      { value: 'mismo_pais', label: 'Sí, pero solo dentro de mi país' },
      { value: 'no', label: 'No, no me muevo' },
    ],
  },
};

/** Preguntas que solo se derivan (no se muestran en la encuesta). */
export const DERIVED_ONLY: Record<string, Set<string>> = {
  rol_resultado_quiz: new Set(['investigacion_clinica', 'msl', 'clinical_pm', 'consulting', 'farmacovigilancia']),
  edad: new Set(['18-24', '25-34', '35-44', '45-54', '55+', 'prefer_not_to_say']),
  genero: new Set(['mujer', 'hombre', 'no_binario_otro', 'prefer_not_to_say']),
};

export const CORE: readonly string[] = ['pais', 'etapa', 'formacion', 'rol_interes', 'obstaculo', 'urgencia'];

/** Orden de preferencia de lo que pregunta cada herramienta (máximo 3). */
export const ASK_ORDER: Record<Origen, string[]> = {
  simulador: ['pais', 'obstaculo', 'urgencia', 'etapa', 'formacion'],
  quiz: ['etapa', 'formacion', 'obstaculo', 'urgencia'],
  // La 3ª del analizador rota entre formación y urgencia (ver pickQuestions).
  cv: ['etapa', 'obstaculo', 'formacion', 'urgencia', 'ingles', 'movilidad'],
};
export const MAX_ASK = 3;

export function isQuestion(question: string): boolean {
  return Object.hasOwn(QUESTIONS, question);
}

export function isValidValue(question: string, value: string): boolean {
  if (Object.hasOwn(QUESTIONS, question)) return QUESTIONS[question].options.some((o) => o.value === value);
  if (Object.hasOwn(DERIVED_ONLY, question)) return DERIVED_ONLY[question].has(value);
  return false;
}

/**
 * Elige hasta MAX_ASK preguntas para esta persona y este uso.
 * `known`: preguntas ya contestadas o derivadas (este uso o los últimos 90 días del aid).
 * `rotateSeed`: número para rotar la 3ª pregunta del analizador.
 */
export function pickQuestions(origen: Origen, known: Set<string>, rotateSeed: number): string[] {
  let order = [...ASK_ORDER[origen]];
  if (origen === 'cv' && rotateSeed % 2 === 1) {
    // Alterna formación y urgencia como 3ª pregunta.
    order = ['etapa', 'obstaculo', 'urgencia', 'formacion', 'ingles', 'movilidad'];
  }
  // Primero el núcleo pendiente (en el orden de la herramienta y luego el resto);
  // las preguntas propias (inglés, movilidad) solo cuando el núcleo ya está completo.
  const corePending = CORE.filter((q) => q !== 'rol_interes' && !known.has(q));
  const coreOrdered = [...order.filter((q) => corePending.includes(q)), ...corePending.filter((q) => !order.includes(q))];
  if (coreOrdered.length > 0) return coreOrdered.slice(0, MAX_ASK);
  return order.filter((q) => !CORE.includes(q) && !known.has(q)).slice(0, MAX_ASK);
}

// ──────────────────────────────────────────────────────────────────
// Equivalencias desde los datos operativos de cada herramienta
// ──────────────────────────────────────────────────────────────────

export interface MappedAnswer {
  pregunta: string;
  valor: string;
  valor_detalle?: string;
}

const PAIS_BY_LABEL: Record<string, string> = {
  'méxico': 'mx', mexico: 'mx', brasil: 'br', brazil: 'br', argentina: 'ar', colombia: 'co',
  chile: 'cl', 'españa': 'es', espana: 'es', spain: 'es', 'perú': 'pe', peru: 'pe', ecuador: 'ec',
  'otro latam': 'otro_latam', otro: 'otro',
};

export function mapPais(label: string | null | undefined): MappedAnswer | null {
  if (!label) return null;
  const key = label.trim().toLowerCase();
  const v = Object.hasOwn(PAIS_BY_LABEL, key) ? PAIS_BY_LABEL[key] : undefined;
  return v ? { pregunta: 'pais', valor: v } : null;
}

const FORMACION_BY_SIM: Record<string, string> = {
  PhD_biomedicina: 'biomedicas', Biologo: 'biomedicas', Biotecnologo: 'biomedicas',
  QFB: 'quimico_farma', QFI: 'quimico_farma', Farmaceutico_clinico: 'quimico_farma',
  Medico: 'clinicas_salud', Enfermero: 'clinicas_salud', Nutriologo: 'clinicas_salud', Veterinario: 'clinicas_salud',
  Estadistica_bioestadistica: 'datos', Matematicas_aplicadas: 'datos', Ciencias_computacion_data: 'datos', Actuaria: 'datos',
  Administracion_MBA: 'negocios_salud_publica', Economia: 'negocios_salud_publica',
  Mercadotecnia: 'negocios_salud_publica', Salud_publica_health_mgmt: 'negocios_salud_publica',
  Otro: 'otra',
};

/** Formación del simulador. `Postdoc` no es formación: se ignora aquí (va a etapa). */
export function mapFormacionSimulador(area: string | null | undefined): MappedAnswer | null {
  if (!area || area === 'Postdoc') return null;
  // valor_detalle solo con valores de la lista blanca: nunca texto libre.
  const v = Object.hasOwn(FORMACION_BY_SIM, area) ? FORMACION_BY_SIM[area] : undefined;
  return v ? { pregunta: 'formacion', valor: v, valor_detalle: area } : { pregunta: 'formacion', valor: 'otra' };
}

const ACADEMIC_LEVELS = new Set(['licenciatura', 'maestria', 'doctorado', 'postdoc']);
const EXPERIENCE_YEARS = new Set(['sin_experiencia', '1-3', '4-10', '+10']);

/** Etapa aproximada desde nivel académico + años de experiencia del simulador. */
export function mapEtapaSimulador(
  academicLevel: string | null | undefined,
  experienceYears: string | null | undefined,
  formationArea?: string | null,
): MappedAnswer | null {
  const level = academicLevel && ACADEMIC_LEVELS.has(academicLevel) ? academicLevel : undefined;
  const years = experienceYears && EXPERIENCE_YEARS.has(experienceYears) ? experienceYears : undefined;
  academicLevel = level;
  const detalle = [level, years].filter(Boolean).join('|') || undefined;
  experienceYears = years;
  if (academicLevel === 'postdoc' || formationArea === 'Postdoc') return { pregunta: 'etapa', valor: 'postdoc', valor_detalle: detalle };
  if (academicLevel === 'doctorado') return { pregunta: 'etapa', valor: 'phd_terminado', valor_detalle: detalle };
  if (academicLevel === 'licenciatura' || academicLevel === 'maestria') {
    const senior = experienceYears === '4-10' || experienceYears === '+10';
    return { pregunta: 'etapa', valor: senior ? 'industria' : 'lic_maestria_egresado', valor_detalle: detalle };
  }
  return null;
}

const ROL_BY_SIM: Record<string, string> = {
  'Visitador medico · Pharma Sales Representative': 'ventas',
  'Clinical Research Associate': 'investigacion_clinica',
  'Medical Science Liaison': 'msl',
  'Clinical Project Manager': 'clinical_pm',
  'Healthcare Consultant · Strategy Consulting': 'consulting',
  'Laboratory Scientist · R&D': 'laboratorio_rd',
  'Regulatory Affairs Specialist': 'regulatorio',
  'Pharmacovigilance Associate': 'farmacovigilancia',
  'Healthcare Analyst · HEOR': 'heor_analytics',
  'Medical Affairs': 'medical_affairs',
  Otro: 'otro',
};

// Claves del catálogo de roles del simulador (src/lib/simulator-defaults.ts) que llegan a D1.
const ROL_BY_SIM_KEY: Record<string, string> = {
  CRA: 'investigacion_clinica', MSL: 'msl', Clinical_PM: 'clinical_pm', Healthcare_Analyst: 'heor_analytics',
  Strategy_Consulting: 'consulting', Regulatory: 'regulatorio', Pharmacovigilance: 'farmacovigilancia',
  HEOR: 'heor_analytics', Associate_Clinical_Scientist: 'investigacion_clinica', Medical_Affairs: 'medical_affairs',
  Laboratory_Scientist_RD: 'laboratorio_rd',
  Other: 'otro',
};

/** Rol del simulador: acepta la opción del selector, la clave de D1 o vacío (= sin decidir). */
export function mapRolSimulador(raw: string | null | undefined, modoVacante = false): MappedAnswer | null {
  if (raw === undefined) return null;
  if (!raw) return modoVacante ? null : { pregunta: 'rol_interes', valor: 'sin_decidir' };
  const v = Object.hasOwn(ROL_BY_SIM, raw) ? ROL_BY_SIM[raw] : Object.hasOwn(ROL_BY_SIM_KEY, raw) ? ROL_BY_SIM_KEY[raw] : undefined;
  // Fuera de la lista blanca no se guarda el texto: solo 'otro'.
  return v ? { pregunta: 'rol_interes', valor: v, valor_detalle: raw } : { pregunta: 'rol_interes', valor: 'otro' };
}

const ROL_BY_QUIZ: Record<string, string> = {
  PM: 'clinical_pm', MSL: 'msl', CR: 'investigacion_clinica', FV: 'farmacovigilancia', Consulting: 'consulting',
};

export function mapRolQuiz(key: string | null | undefined, pregunta: 'rol_interes' | 'rol_resultado_quiz'): MappedAnswer | null {
  if (!key) return null;
  const v = Object.hasOwn(ROL_BY_QUIZ, key) ? ROL_BY_QUIZ[key] : undefined;
  return v ? { pregunta, valor: v, valor_detalle: key } : null;
}

/** Encuesta anterior del analizador de CV (KV CV_METRICS, catálogo cv_v0). */
const CV_V0: Record<string, Record<string, string>> = {
  stage: {
    phd_1_2: 'phd_en_curso', phd_3_5: 'phd_en_curso', phd_writing: 'phd_en_curso',
    post_phd: 'phd_terminado', postdoc: 'postdoc', in_industry: 'industria',
  },
  obstacle: {
    no_role_clarity: 'no_se_que_rol', no_callbacks: 'no_me_llaman', english: 'ingles',
    networking: 'networking', time: 'tiempo', other: 'otro',
  },
  urgency: { '0_3m': '0_3m', '3_6m': '3_6m', '6_12m': '6_12m', '1_2y': 'mas_12m', exploring: 'explorando' },
  english: { native: 'nativo', advanced: 'avanzado', intermediate: 'intermedio', basic: 'basico' },
  mobility: { any_country: 'cualquier_pais', hispanic: 'hispanos', same_country: 'mismo_pais', no_move: 'no' },
};
const CV_V0_QUESTION: Record<string, string> = {
  stage: 'etapa', obstacle: 'obstaculo', urgency: 'urgencia', english: 'ingles', mobility: 'movilidad',
};

/**
 * Traduce una respuesta de la encuesta anterior del analizador.
 * Las preguntas retiradas (motivación, confianza, intentos, fuentes, área) vuelven con
 * `legacy: true` para guardarse con catalogo_version 'cv_v0' sin entrar al núcleo.
 */
export function mapCvV0(question: string, value: string): (MappedAnswer & { legacy?: boolean }) | null {
  const q = Object.hasOwn(CV_V0_QUESTION, question) ? CV_V0_QUESTION[question] : undefined;
  if (q) {
    const v = Object.hasOwn(CV_V0[question], value) ? CV_V0[question][value] : undefined;
    return v ? { pregunta: q, valor: v, valor_detalle: value } : null;
  }
  return { pregunta: `cv_v0_${question}`, valor: value.slice(0, 40), legacy: true };
}
