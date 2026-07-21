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
        label: 'Llamada inicial con reclutador',
        description:
          'Phone screen típica con HR o talent acquisition. Foco en motivación, fit cultural y contexto del CV.',
        expectedRealDurationMin: 15,
        expectedRealDurationMax: 30,
        expectedSimulatorDuration: 20,
      };
    case 'technical_round':
      return {
        questionCount: 10,
        label: 'Ronda técnica con hiring manager',
        description:
          'Entrevista con el manager que te contrata. Foco en vocabulario pharma, frameworks y casos básicos del rol.',
        expectedRealDurationMin: 45,
        expectedRealDurationMax: 60,
        expectedSimulatorDuration: 40,
      };
    case 'panel_round':
      return {
        questionCount: 15,
        label: 'Final round o panel completo',
        description:
          'Panel final con varios entrevistadores. Profundidad técnica + comportamiento + casos complejos.',
        expectedRealDurationMin: 60,
        expectedRealDurationMax: 90,
        expectedSimulatorDuration: 60,
      };
    case 'general_practice':
      return {
        questionCount: 10,
        label: 'Práctica general',
        description:
          'No tienes una fecha o etapa específica todavía. Sesión balanceada equivalente a una ronda técnica.',
        expectedRealDurationMin: 45,
        expectedRealDurationMax: 60,
        expectedSimulatorDuration: 40,
      };
  }
}
