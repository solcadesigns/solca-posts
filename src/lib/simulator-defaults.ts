/**
 * Defaults inteligentes para el Simulador de Entrevistas.
 * Fase 1.1 · v0.5 del system prompt · 16 jun 2026.
 *
 * Quita carga cognitiva al usuario entry-level que no tiene contexto para calibrar.
 * Tablas documentadas en SIMULADOR_PROMPT_V0.md sección "DEFAULTS INTELIGENTES POR PERFIL".
 */

import type {
  CandidateProfile,
  DifficultyLevel,
  InterviewStage,
  Language,
  Role,
  ExperienceYears,
} from './simulator-types';

// ──────────────────────────────────────────────────────────────────
// Multinacionales pharma reconocidas → dispara default "exigente"
// ──────────────────────────────────────────────────────────────────

const MULTINATIONAL_PHARMA = [
  'IQVIA',
  'Pfizer',
  'Sanofi',
  'BMS',
  'Bristol Myers Squibb',
  'Bristol-Myers Squibb',
  'Roche',
  'Genentech',
  'Novartis',
  'AstraZeneca',
  'MSD',
  'Merck',
  'Abbott',
  'AbbVie',
  'Johnson & Johnson',
  'J&J',
  'Janssen',
  'Lilly',
  'Eli Lilly',
  'Bayer',
  'Boehringer',
  'Boehringer Ingelheim',
  'Takeda',
  'ICON',
  'Parexel',
  'Syneos',
  'Fortrea',
  'PPD',
  'Thermo Fisher',
  'Labcorp',
  'Covance',
  'Medpace',
];

// ──────────────────────────────────────────────────────────────────
// Mapeo de roleTitle (texto libre) → Role enum
// ──────────────────────────────────────────────────────────────────

const ROLE_KEYWORDS: Array<{ keywords: string[]; role: Role }> = [
  {
    keywords: ['cra', 'clinical research associate', 'site monitor', 'monitor cl'],
    role: 'CRA',
  },
  {
    keywords: ['msl', 'medical science liaison', 'enlace cient'],
    role: 'MSL',
  },
  {
    keywords: ['clinical project manager', 'cpm', 'clinical pm', 'project lead clin'],
    role: 'Clinical_PM',
  },
  {
    keywords: ['healthcare analyst', 'analista de datos', 'data analyst pharma'],
    role: 'Healthcare_Analyst',
  },
  {
    keywords: ['strategy consult', 'consultor strateg', 'consultant strateg'],
    role: 'Strategy_Consulting',
  },
  {
    keywords: ['regulatory', 'asuntos regulatorios', 'registros'],
    role: 'Regulatory',
  },
  {
    keywords: ['pharmacovigilance', 'farmacovigilancia', 'safety scientist'],
    role: 'Pharmacovigilance',
  },
  {
    keywords: ['heor', 'health economic', 'outcomes research'],
    role: 'HEOR',
  },
  {
    keywords: ['associate clinical scientist', 'clinical scientist', 'cient'],
    role: 'Associate_Clinical_Scientist',
  },
  {
    keywords: ['medical affairs', 'asuntos médicos'],
    role: 'Medical_Affairs',
  },
];

// ──────────────────────────────────────────────────────────────────
// Vocabulario que dispara default Inglés en vez de Bilingüe
// ──────────────────────────────────────────────────────────────────

const ENGLISH_REQUIRED_VOCAB = [
  'C1 minimum',
  'C1 english',
  'fluent english',
  'fluent in english',
  'fluency in english',
  'advanced english',
  'advanced proficiency in english',
  'native english',
  'business english required',
];

// ──────────────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────────────

/**
 * Detecta si la vacante o empresa corresponde a una multinacional pharma reconocida.
 */
export function isMultinationalPharma(
  company?: string,
  vacancyText?: string,
): boolean {
  const haystack = `${company ?? ''} ${vacancyText ?? ''}`.toLowerCase();
  return MULTINATIONAL_PHARMA.some((name) => haystack.includes(name.toLowerCase()));
}

/**
 * Detecta si la vacante exige inglés explícito (C1, fluent, advanced).
 */
export function vacancyRequiresFluentEnglish(vacancyText?: string): boolean {
  if (!vacancyText) return false;
  const text = vacancyText.toLowerCase();
  return ENGLISH_REQUIRED_VOCAB.some((v) => text.includes(v.toLowerCase()));
}

/**
 * Detecta si el rol o vacante implica seniority alto (Senior, Manager, Director, Lead, Principal).
 */
// ──────────────────────────────────────────────────────────────────
// CTA whitelist por rol (9 sept 2026 · post-mortem PDF con URL inventada)
// ──────────────────────────────────────────────────────────────────
//
// Antes: el modelo generaba título/descripción/URL del CTA libremente y
// terminaba INVENTANDO títulos ("Oncology MSL Playbook") con URLs falsas.
// Ahora: catálogo hardcoded por rol con URLs verificadas de Hotmart.
// El modelo solo elige TIPO (libro | recurso_gratuito) internamente en el
// chunk summary, pero el CTA final se sustituye por este catálogo en merge.

interface RoleCta {
  type: 'libro' | 'recurso_gratuito';
  title: string;
  description: string;
  url: string;
}

const CV_COURSE_CTA: RoleCta = {
  type: 'libro',
  title: 'Curso Solca · CV y entrevistas pharma',
  description:
    'Curso completo para armar tu CV pharma, aplicar de forma efectiva y preparar entrevistas del sector. Incluye módulo de simulación de entrevistas. Ideal para reforzar la base antes de tu próxima ronda.',
  url: 'https://go.hotmart.com/B104495115T?dp=1',
};

const ROLE_CTA_CATALOG: Partial<Record<string, RoleCta>> = {
  MSL: {
    type: 'libro',
    title: 'Medical Science Liaison · Guía práctica para científicos de la salud · LATAM y España',
    description:
      'Guía para posiciones MSL en pharma LATAM y España: Scientific Engagement, insight capture, MLR compliance, manejo de KOLs, casos reales por área terapéutica. El siguiente paso para consolidar tu perfil antes de la próxima entrevista.',
    url: 'https://go.hotmart.com/Y105718405Y',
  },
  Clinical_PM: {
    type: 'libro',
    title: 'Project Management · Guía práctica para científicos de la salud · LATAM y España',
    description:
      'Guía completa para Project Manager en pharma LATAM y España: stakeholder management, critical path, RACI, presupuestos y timelines. Cinco módulos con cuaderno de trabajo aplicable.',
    url: 'https://go.hotmart.com/R105710415P',
  },
  CRA: {
    type: 'libro',
    title: 'Clinical Research · Guía práctica para científicos de la salud · LATAM y España',
    description:
      'Guía para roles de investigación clínica (CRA, coordinación de estudios): ICH-GCP, monitoreo basado en riesgo, manejo de SAEs, SDV, relación con sitios investigadores. Casos y preguntas típicas del sector.',
    url: 'https://go.hotmart.com/U105724060O?dp=1',
  },
  Associate_Clinical_Scientist: {
    type: 'libro',
    title: 'Clinical Research · Guía práctica para científicos de la salud · LATAM y España',
    description:
      'Guía para roles clínicos y de investigación: protocolos, ICH-GCP, monitoreo, manejo de SAEs, relación con sitios. Preguntas típicas por área terapéutica.',
    url: 'https://go.hotmart.com/U105724060O?dp=1',
  },
};

/**
 * Devuelve el CTA correcto según el rol del candidato.
 * Roles con libro específico (MSL, Clinical_PM, CRA, Associate_Clinical_Scientist)
 * → CTA del libro correspondiente.
 * Roles sin libro específico (HEOR, Regulatory, Market Access, Medical Affairs, etc.)
 * → CTA del curso CV/entrevistas (fallback con módulo de preparación).
 */
export function getRoleCta(role: string | undefined): RoleCta {
  if (!role) return CV_COURSE_CTA;
  return ROLE_CTA_CATALOG[role] ?? CV_COURSE_CTA;
}

export function isSeniorRole(roleTitle?: string, vacancyText?: string): boolean {
  const haystack = `${roleTitle ?? ''} ${vacancyText ?? ''}`.toLowerCase();
  return /(senior|sr\.|manager|director|lead\b|principal|head of)/i.test(haystack);
}

/**
 * Mapea el roleTitle libre al enum Role.
 * Devuelve 'Other' si no encuentra match.
 */
export function inferRole(roleTitle?: string): Role {
  if (!roleTitle) return 'Other';
  const t = roleTitle.toLowerCase();
  for (const { keywords, role } of ROLE_KEYWORDS) {
    if (keywords.some((k) => t.includes(k))) return role;
  }
  return 'Other';
}

// ──────────────────────────────────────────────────────────────────
// Defaults inteligentes según contexto
// ──────────────────────────────────────────────────────────────────

export interface DefaultsResult {
  difficulty: DifficultyLevel;
  language: Language;
  reason: string; // explicación legible para tooltip de UI
}

/**
 * Calcula el default sugerido de exigencia + idioma según el perfil del candidato.
 * Tabla de mapeo en SIMULADOR_PROMPT_V0.md sección "DEFAULTS INTELIGENTES POR PERFIL".
 */
export function computeIntelligentDefaults(
  profile: Pick<
    CandidateProfile,
    'mode' | 'experienceYears' | 'company' | 'vacancyText' | 'roleTitle'
  >,
): DefaultsResult {
  const { mode, experienceYears, company, vacancyText, roleTitle } = profile;

  // Senior por título → muy_exigente
  if (isSeniorRole(roleTitle, vacancyText) || experienceYears === '+10') {
    return {
      difficulty: 'muy_exigente',
      language: vacancyRequiresFluentEnglish(vacancyText) ? 'ingles' : 'bilingue',
      reason:
        'Rol senior (mencionado en el título o por +10 años de experiencia). La evaluación es estricta y mezcla técnico + juicio.',
    };
  }

  // Multinacional reconocida → exigente
  if (mode === 'A' && isMultinationalPharma(company, vacancyText)) {
    return {
      difficulty: 'exigente',
      language: vacancyRequiresFluentEnglish(vacancyText) ? 'ingles' : 'bilingue',
      reason:
        'Empresa multinacional pharma. Estas compañías filtran fuerte incluso a entry-level, por eso recomendamos Exigente desde el inicio.',
    };
  }

  // Mid-level (4-10 años) → exigente
  if (experienceYears === '4-10') {
    return {
      difficulty: 'exigente',
      language: 'bilingue',
      reason: '4-10 años de experiencia. Match a expectativas mid-level del oficio.',
    };
  }

  // Entry-level + Modo B sin vacante → moderado
  if (
    mode === 'B' &&
    (experienceYears === 'sin_experiencia' || experienceYears === '1-3')
  ) {
    return {
      difficulty: 'moderado',
      language: 'bilingue',
      reason:
        'Perfil entry-level sin vacante específica. Recomendamos Moderado para construir confianza y exposure a vocabulario sin estrés.',
    };
  }

  // Entry-level + Modo A pero sin multinacional reconocida → moderado con tooltip
  if (
    mode === 'A' &&
    (experienceYears === 'sin_experiencia' || experienceYears === '1-3')
  ) {
    return {
      difficulty: 'moderado',
      language: 'bilingue',
      reason:
        'Entry-level con vacante. Si tu entrevista real es con multinacional, considera subir a Exigente.',
    };
  }

  // Catch-all
  return {
    difficulty: 'moderado',
    language: 'bilingue',
    reason: 'Default conservador. Puedes cambiar según el contexto real de tu entrevista.',
  };
}

// ──────────────────────────────────────────────────────────────────
// Tiempos sugeridos por tipo de pregunta (v0.5)
// ──────────────────────────────────────────────────────────────────

export interface TimingHint {
  prepSeconds: number;
  answerSecondsMin: number;
  answerSecondsMax: number;
  evidence: string;
}

export function getTimingHint(
  type: 'conductual' | 'tecnica' | 'situacional' | 'general',
): TimingHint {
  switch (type) {
    case 'conductual':
      return {
        prepSeconds: 30,
        answerSecondsMin: 90,
        answerSecondsMax: 120,
        evidence:
          'STAR óptimo 60-90 seg; reclutadores pierden foco después de 90 seg (The Interview Guys, Indeed).',
      };
    case 'tecnica':
      return {
        prepSeconds: 45,
        answerSecondsMin: 120,
        answerSecondsMax: 180,
        evidence: 'Plataformas AI mock estándar: 1.5-3 min para técnicas (Teal).',
      };
    case 'situacional':
      return {
        prepSeconds: 60,
        answerSecondsMin: 150,
        answerSecondsMax: 180,
        evidence: 'Análisis de hipótesis competentes requiere estructura adicional.',
      };
    case 'general':
      return {
        prepSeconds: 30,
        answerSecondsMin: 60,
        answerSecondsMax: 90,
        evidence: 'Tell me about yourself: 60-90 seg óptimo (Indeed, OphyAI).',
      };
  }
}

/**
 * Determina si la respuesta excedió significativamente el rango (>50% del máximo).
 * Usado por el feedback educativo sin cortar la respuesta.
 */
export function answerExceededRange(
  type: 'conductual' | 'tecnica' | 'situacional' | 'general',
  actualSeconds: number,
): boolean {
  const { answerSecondsMax } = getTimingHint(type);
  return actualSeconds > answerSecondsMax * 1.5;
}

// ──────────────────────────────────────────────────────────────────
// Etapa de la entrevista → número de preguntas + descripción para UI (v0.6)
// ──────────────────────────────────────────────────────────────────

export interface InterviewStageInfo {
  questionCount: 5 | 10 | 15;
  label: string;
  description: string;
  expectedRealDurationMin: number;
  expectedRealDurationMax: number;
  expectedSimulatorDuration: number;
}

/**
 * Devuelve metadata para mostrar en la UI del cuestionario inicial.
 * Fuentes externas que sustentan los rangos (documentadas en
 * SIMULADOR_ENTREVISTAS_ADDENDUM.md):
 *   - Indeed · Phone Screen Interview Best Practices
 *   - Goldbeck Recruiting · Job Interview Process Structure
 *   - Frontline Source Group · 30-Minute Phone Interview Questions
 */
export function getStageInfo(stage: InterviewStage): InterviewStageInfo {
  switch (stage) {
    case 'phone_screen':
      return {
        questionCount: 5,
        label: 'Screening inicial con reclutador',
        description:
          'Contacto inicial con HR o talent acquisition. Foco en motivación, fit cultural y contexto del CV. Ritmo rápido, poca profundidad técnica.',
        expectedRealDurationMin: 15,
        expectedRealDurationMax: 30,
        expectedSimulatorDuration: 20,
      };
    case 'technical_round':
      return {
        questionCount: 10,
        label: 'Entrevista con hiring manager',
        description:
          'Entrevista con el manager que te contrata. Mezcla de motivación, experiencia relevante, vocabulario pharma y casos básicos del rol.',
        expectedRealDurationMin: 45,
        expectedRealDurationMax: 60,
        expectedSimulatorDuration: 40,
      };
    case 'panel_round':
      // Deshabilitada en UI desde sept 2026 (never worked reliably a 15q).
      // El schema se conserva para no romper sesiones legacy en KV.
      return {
        questionCount: 15,
        label: 'Panel completo (deshabilitado)',
        description:
          'Panel final con varios entrevistadores. Deshabilitado en la UI actual — mantener aquí para compatibilidad de sesiones antiguas.',
        expectedRealDurationMin: 60,
        expectedRealDurationMax: 90,
        expectedSimulatorDuration: 60,
      };
    case 'general_practice':
      return {
        questionCount: 10,
        label: 'Práctica general (mix de preguntas)',
        description:
          'No tienes una fecha o etapa específica todavía. Sesión balanceada equivalente a una ronda con hiring manager.',
        expectedRealDurationMin: 45,
        expectedRealDurationMax: 60,
        expectedSimulatorDuration: 40,
      };
  }
}
