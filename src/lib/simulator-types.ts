/**
 * Types compartidos del Simulador de Entrevistas.
 * Fase 1.1 · 16 jun 2026.
 *
 * Estos types los usan: lib/simulator-prompt.ts, lib/simulator-defaults.ts,
 * pages/api/simulator-session.ts, pages/api/simulator-cv-parse.ts (Fase 1.3),
 * pages/api/simulator-metrics.ts (Fase 1.4), y los componentes del frontend.
 */

// ──────────────────────────────────────────────────────────────────
// Perfil del candidato (lo que recoge el cuestionario inicial)
// ──────────────────────────────────────────────────────────────────

export type ExperienceYears = 'sin_experiencia' | '1-3' | '4-10' | '+10';
export type DifficultyLevel = 'moderado' | 'exigente' | 'muy_exigente';
export type Focus = 'tecnico' | 'conductual' | 'mezcla';
export type Language = 'ingles' | 'bilingue' | 'espanol';
export type Plan = 'gratis' | 'basico' | 'intensivo' | 'pro';
export type Mode = 'A' | 'B';

/**
 * Etapa de la entrevista que el usuario quiere simular (v0.6).
 * El número de preguntas se infiere de la etapa, no se pregunta directamente.
 *
 * Fuentes:
 *   - Indeed · Phone Screen Best Practices (15-30 min, 5-7 preguntas)
 *   - Goldbeck Recruiting · Job Interview Process Structure
 *   - Frontline Source Group · 30-Minute Phone Interview Questions
 */
export type InterviewStage =
  | 'phone_screen' // 5 preguntas · 15-30 min reales · reclutador
  | 'technical_round' // 10 preguntas · 45-60 min reales · hiring manager
  | 'panel_round' // 15 preguntas · 60-90 min reales · final round
  | 'general_practice'; // default 10 · práctica sin fecha específica

export type FormationArea =
  | 'QFB'
  | 'Biologo'
  | 'Biotecnologo'
  | 'Medico'
  | 'Enfermero'
  | 'QFI'
  | 'Nutriologo'
  | 'Veterinario'
  | 'Farmaceutico_clinico'
  | 'PhD_biomedicina'
  | 'Postdoc'
  | 'Otro';

export type Role =
  | 'CRA'
  | 'MSL'
  | 'Clinical_PM'
  | 'Healthcare_Analyst'
  | 'Strategy_Consulting'
  | 'Regulatory'
  | 'Pharmacovigilance'
  | 'HEOR'
  | 'Associate_Clinical_Scientist'
  | 'Medical_Affairs'
  | 'Other';

export interface CandidateProfile {
  // Modo de entrada
  mode: Mode;

  // Modo A · campos de vacante (opcionales en Modo B)
  roleTitle?: string; // "Associate Clinical Scientist"
  company?: string; // "IQVIA"
  vacancyText?: string; // pegado opcional

  // Generales (siempre)
  formationArea: FormationArea;
  experienceYears: ExperienceYears;
  specialty?: string; // libre

  // Calibración (con defaults inteligentes)
  focus: Focus;
  language: Language;
  difficulty: DifficultyLevel;
  // v0.6: el usuario elige etapa. questionCount se deriva de la etapa.
  interviewStage: InterviewStage;
  questionCount: 5 | 10 | 15;

  // Inferido del backend
  role?: Role; // si se puede mapear de roleTitle
  countryInferred?: string; // de la vacante o del idioma
}

// ──────────────────────────────────────────────────────────────────
// Resumen del CV (extraído por simulator-cv-parse en Fase 1.3)
// ──────────────────────────────────────────────────────────────────

export interface CvSummary {
  formacion: string;
  experiencia: string[];
  tecnicas: string[];
  areasTematicas: string[];
  publicacionesCount: number | null;
  idiomasDeclarados: string[];
  gapsVisibles: string[];
  fortalezasPharmaEvidentes: string[];
}

// ──────────────────────────────────────────────────────────────────
// Sesión (turn-by-turn)
// ──────────────────────────────────────────────────────────────────

export type QuestionType = 'conductual' | 'tecnica' | 'situacional' | 'general';
export type PedagogicalAngle = 'A' | 'C' | 'D' | 'E'; // v0.4: B eliminado

export interface QuestionTurn {
  questionNumber: number;
  type: QuestionType;
  language: 'es' | 'en';
  questionText: string;
  suggestedPrepSeconds: number;
  suggestedAnswerSeconds: number;
  // Llenado cuando el candidato responde
  userAnswer?: string;
  userAnswerSeconds?: number; // tiempo que tomó
  feedback?: {
    scores: {
      tecnico: number; // 1-5
      estructura: number;
      especificidad: number;
      alertas: string[];
    };
    angle: PedagogicalAngle;
    text: string; // "Lo que funcionó / Lo que mejoraría / Frase modelo"
    modelPhrase: string;
  };
}

export interface SessionState {
  sessionId: string;
  startedAt: string;
  profile: CandidateProfile;
  plan: Plan;
  sessionNumberInPackage: number; // 1, 2, 3...
  cvSummary?: CvSummary; // solo planes pagos
  turns: QuestionTurn[];
  finished: boolean;
  finalReport?: FinalReport;
  metricsAnonymous?: MetricsAnonymous;
  // Fase 1.5.J · 19 jun 2026 · si la generación del reporte final falló
  // (timeout, error de Anthropic, parser), se setea aquí para que el
  // frontend pueda ofrecer "Reintentar generación" sin re-hacer preguntas.
  finalReportError?: string;
  betaCode?: string; // persistido para soportar retry_report sin perder beta context
}

// ──────────────────────────────────────────────────────────────────
// Reporte final expandido (v0.7)
// ──────────────────────────────────────────────────────────────────

/**
 * Feedback detallado por pregunta · parte del reporte final expandido.
 * En la UI se muestra en una sección expandible debajo del summary.
 */
export interface QuestionBreakdown {
  questionNumber: number;
  questionText: string;
  userAnswer: string; // cita textual, max 200 palabras (truncado con "..." si necesario)
  scores: {
    tecnico: number; // 1-5
    estructura: number;
    especificidad: number;
    alertas: string; // "sin alertas" o descripción específica
  };
  angleUsed: PedagogicalAngle; // A | C | D | E
  whatWorked: string;
  whatToImprove: string;
  modelPhrase: string;
}

/**
 * Resumen ejecutivo · primera vista que ve el usuario al cerrar la sesión.
 */
export interface FinalReportSummary {
  scores: {
    tecnico: number; // promedio 1-5
    estructura: number;
    especificidad: number;
    alertasCount: number;
  };
  fortalezas: string[]; // 3 frases sintetizadas de los breakdowns
  areasDeMejora: string[]; // 3 frases con acción concreta
  vocabularioAIncorporar: string[];
  recomendacionFinal: string;
}

/**
 * CTA contextual al cierre (lógica v0.3 según plan + sesión).
 */
export interface FinalReportCTA {
  type: 'libro' | 'recurso_gratuito';
  title: string;
  description: string;
  url: string;
}

/**
 * Reporte final expandido v0.7.
 * Incluye summary (visible inmediato) + questions_breakdown (expandible en UI) + cta.
 * El PDF descargable se genera del mismo objeto.
 */
export interface FinalReport {
  sessionId: string;
  rol: string;
  nQuestions: number;
  summary: FinalReportSummary;
  questionsBreakdown: QuestionBreakdown[];
  cta: FinalReportCTA;
}

// ──────────────────────────────────────────────────────────────────
// Métricas anónimas (para SIMULATOR_METRICS KV)
// ──────────────────────────────────────────────────────────────────

/**
 * Métricas anónimas guardadas en SIMULATOR_METRICS al cerrar la sesión.
 * Total: 17 campos. Documentación completa en SIMULADOR_ENTREVISTAS_ADDENDUM.md sección 7.15.
 *
 * Protecciones: sin identificadores personales, sin nombres de instituciones,
 * demográficos siempre opcionales con "prefer_not_to_say".
 */
export interface MetricsAnonymous {
  // Identidad de la sesión
  ts: string;

  // Perfil profesional anónimo
  areaFormacion: string;
  aniosExperiencia: string;
  paisInferido: string | null;
  rolApuntado: string;

  // Configuración elegida por el usuario
  idioma: 'espanol' | 'bilingue' | 'ingles';
  etapa: 'phone_screen' | 'technical_round' | 'panel_round' | 'general_practice';
  numeroPreguntas: 5 | 10 | 15;
  focus: 'tecnico' | 'conductual' | 'mezcla';

  // Tiempos
  sesionDuracionTotalSeg: number;
  respuestaPromedioSeg: number;

  // Vocabulario y desempeño
  tecnicasAcademicasMencionadas: string[];
  vocabularioPharmaQueUsoBien: string[];
  vocabularioPharmaAusente: string[];
  gapsDetectados: string[];

  // Scores y match
  scorePromedioPorDimension: {
    tecnico: number;
    estructura: number;
    especificidad: number;
  };
  alertasCount: number;
  rolYMatch: 'alto' | 'medio' | 'bajo';
  preguntasQueReprobaron: string[];

  // Demográficos opcionales (capturados post-sesión)
  edadRango?: '18-24' | '25-34' | '35-44' | '45-54' | '55+' | 'prefer_not_to_say' | null;
  genero?: 'mujer' | 'hombre' | 'no_binario_otro' | 'prefer_not_to_say' | null;
}

// ──────────────────────────────────────────────────────────────────
// Request/response del endpoint principal
// ──────────────────────────────────────────────────────────────────

export type SessionEndpointAction =
  | 'init' // inicia sesión nueva con profile (+ cvSummary opcional)
  | 'next' // procesa respuesta del candidato y devuelve siguiente pregunta o reporte
  | 'finish' // fuerza cierre anticipado
  | 'resume' // Fase 1.5.J · recupera sessionState persistido en KV por sessionId
  | 'retry_report'; // Fase 1.5.J · re-genera el reporte final usando estado persistido

export interface SessionEndpointRequest {
  action: SessionEndpointAction;
  sessionState?: SessionState; // requerido para 'next' y 'finish'
  profile?: CandidateProfile; // requerido para 'init'
  cvSummary?: CvSummary; // opcional, solo en 'init' para planes pagos
  plan?: Plan; // requerido para 'init'
  sessionNumberInPackage?: number; // requerido para 'init'
  userAnswer?: string; // requerido para 'next'
  userAnswerSeconds?: number; // opcional pero recomendado en 'next'
  betaCode?: string; // opcional · valida acceso si está presente
  sessionId?: string; // requerido para 'resume' y 'retry_report'
}

export interface SessionEndpointResponse {
  ok: boolean;
  sessionState?: SessionState;
  nextQuestion?: QuestionTurn;
  finished?: boolean;
  finalReport?: FinalReport;
  error?: string;
  errorCode?:
    | 'invalid_action'
    | 'invalid_profile'
    | 'beta_code_invalid'
    | 'beta_code_exhausted'
    | 'rate_limit'
    | 'anthropic_error'
    | 'internal';
}
