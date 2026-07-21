/**
 * Banco semilla del Simulador de Entrevistas.
 * Fase 1.1 · v0.4 del banco · 16 jun 2026.
 *
 * 32 preguntas Junior + 12 templates CV-anclados.
 * El system prompt usa el banco semilla en proporción ~30% banco / ~70% generación libre.
 * Documentación completa en SIMULADOR_BANCO_SEMILLA.md.
 *
 * IMPORTANTE: cada pregunta lleva "tipBuenaRespuesta" como SEMILLA de contenido para Claude,
 * no como texto literal a devolver. La rúbrica determina el SCORE 1-5; la rúbrica NO determina
 * el texto del feedback (que se construye con los 4 mecanismos de variabilidad v0.4).
 */

import type { QuestionType, Role } from './simulator-types';

export type BankCategory =
  | 'general'
  | 'CRA'
  | 'MSL'
  | 'Clinical_PM'
  | 'Healthcare_Analyst_Consulting';

export interface BankQuestion {
  id: string;
  category: BankCategory;
  type: QuestionType;
  text: string;
  framework: string;
  evaluar: string[]; // qué elementos buscar en la respuesta
  banderaRoja: string;
  tipBuenaRespuesta: string;
}

// ──────────────────────────────────────────────────────────────────
// A · GENERALES PHARMA (8 preguntas)
// ──────────────────────────────────────────────────────────────────

export const GENERAL_QUESTIONS: BankQuestion[] = [
  {
    id: 'G1',
    category: 'general',
    type: 'conductual',
    text: 'Cuéntame cómo decidiste salir de la academia y por qué pharma específicamente.',
    framework: 'Narrativa STAR adaptada (Situación → motivación → Acción → Resultado esperado)',
    evaluar: [
      'Claridad de motivación (no solo "no había trabajo en academia")',
      'Conocimiento básico del por qué pharma vs otras industrias',
      'Honestidad sin amargura hacia academia',
    ],
    banderaRoja: '"Salí porque no me daban plaza" sin reformular hacia algo positivo. Lenguaje de víctima.',
    tipBuenaRespuesta:
      'Una frase concreta del momento que detonó la decisión + una razón específica de por qué pharma (impacto en pacientes, escalabilidad de la ciencia).',
  },
  {
    id: 'G2',
    category: 'general',
    type: 'general',
    text: '¿Qué sabes sobre nuestra compañía y por qué te interesa este puesto en particular?',
    framework: 'Preparación / conocimiento de mercado',
    evaluar: [
      'Mencionó al menos un dato verificable de la empresa',
      'Conectó algo de su perfil con la posición',
    ],
    banderaRoja: '"He escuchado que es buena empresa" sin nada concreto.',
    tipBuenaRespuesta: 'Mencionar área terapéutica del pipeline público + match con tu perfil.',
  },
  {
    id: 'G3',
    category: 'general',
    type: 'tecnica',
    text: '¿Cuál crees que es la diferencia entre este rol y trabajar en investigación académica?',
    framework: 'Comprensión del oficio pharma',
    evaluar: [
      'Menciona regulación (ICH-GCP, SOPs) como diferencia clave',
      'Menciona timelines y accountability comercial',
      'Menciona trabajo en equipo multidisciplinario',
    ],
    banderaRoja: '"Es lo mismo pero pagan más." Subestimación del oficio.',
    tipBuenaRespuesta: 'Tres diferencias estructurales: regulación, equipos multidisciplinarios, timelines de negocio.',
  },
  {
    id: 'G4',
    category: 'general',
    type: 'tecnica',
    text: '¿Qué entiendes por ICH-GCP y por qué importa para este rol?',
    framework: 'Vocabulario pharma básico',
    evaluar: [
      'Define ICH y GCP',
      'Conecta con protección de sujetos + integridad de datos',
    ],
    banderaRoja: 'No sabe qué significa el acrónimo o lo confunde con algo más.',
    tipBuenaRespuesta:
      'ICH-GCP es el estándar internacional de buena práctica clínica que protege a los participantes y asegura calidad de datos en ensayos clínicos.',
  },
  {
    id: 'G5',
    category: 'general',
    type: 'conductual',
    text: '¿Cuál crees que es tu principal fortaleza para este rol y cuál es la que más necesitas desarrollar?',
    framework: 'STAR + autoconciencia',
    evaluar: [
      'Fortaleza ligada a habilidades reales',
      'Debilidad real, no disfrazada de fortaleza',
      'Plan de desarrollo de la debilidad',
    ],
    banderaRoja: '"Mi debilidad es que soy perfeccionista." Cliché.',
    tipBuenaRespuesta:
      'Fortaleza con ejemplo de tesis + debilidad operativa real con curso o plan específico para cerrarla.',
  },
  {
    id: 'G6',
    category: 'general',
    type: 'conductual',
    text: 'Cuéntame de una situación en la que tuviste que entregar un resultado en menos tiempo del que necesitabas. ¿Qué hiciste?',
    framework: 'STAR',
    evaluar: [
      'Situación específica',
      'Acciones concretas (priorización, delegación, comunicación)',
      'Resultado medible',
      'Aprendizaje',
    ],
    banderaRoja: '"Trabajé toda la noche y lo logré." Glorifica burnout.',
    tipBuenaRespuesta:
      'Caso real con comunicación temprana con stakeholders + priorización clara.',
  },
  {
    id: 'G7',
    category: 'general',
    type: 'conductual',
    text: 'Pharma trabaja en equipos multidisciplinarios. Cuéntame una experiencia donde colaboraste con alguien de un perfil muy diferente al tuyo.',
    framework: 'STAR',
    evaluar: [
      'Ejemplo concreto',
      'Reconoce diferencia de perfil sin desvalorizar',
      'Acciones para crear puente',
    ],
    banderaRoja: 'Implícitamente desvaloriza al otro perfil.',
    tipBuenaRespuesta: 'Caso real con biostadístico, médico clínico, o ingeniero + acción explícita de adaptar tu vocabulario.',
  },
  {
    id: 'G8',
    category: 'general',
    type: 'conductual',
    text: 'Cuéntame de una vez que tu jefe o asesor te corrigió fuerte. ¿Cómo lo manejaste?',
    framework: 'STAR + madurez profesional',
    evaluar: [
      'Acepta que recibió crítica',
      'Reflexionó antes de reaccionar',
      'Acción concreta de cambio',
    ],
    banderaRoja: 'Justifica que el feedback estaba mal o se defiende.',
    tipBuenaRespuesta:
      'Caso real de feedback duro + 24h de procesamiento + cambio operativo.',
  },
];

// ──────────────────────────────────────────────────────────────────
// B · CRA (8 preguntas)
// ──────────────────────────────────────────────────────────────────

export const CRA_QUESTIONS: BankQuestion[] = [
  {
    id: 'C1',
    category: 'CRA',
    type: 'situacional',
    text: 'En una visita de monitoreo encuentras que el sitio investigador no actualizó el consentimiento informado a la versión más reciente del protocolo. ¿Qué haces?',
    framework: 'ICH-GCP compliance',
    evaluar: [
      'Reconoce como hallazgo crítico (afecta protección del sujeto)',
      'Documenta en monitoring visit report',
      'Escala al sponsor / al investigador principal',
      'Plan de acción correctivo',
    ],
    banderaRoja: '"Le digo al doctor que lo arregle." Falta de proceso formal.',
    tipBuenaRespuesta:
      'Documento el hallazgo, lo discuto con el PI, notifico al sponsor y aseguro CAPA. Mientras tanto, no se enrola más sujetos.',
  },
  {
    id: 'C2',
    category: 'CRA',
    type: 'tecnica',
    text: '¿Qué es SDV y por qué es importante para tu rol?',
    framework: 'ICH-GCP',
    evaluar: [
      'Define SDV (Source Document Verification)',
      'Explica que asegura coincidencia entre eCRF y fuente',
      'Menciona evolución a Risk-Based Monitoring',
    ],
    banderaRoja: 'Confunde SDV con auditoría o con análisis estadístico.',
    tipBuenaRespuesta:
      'SDV es Source Document Verification. Hoy con RBM se aplica selectivamente, no a todos los datos.',
  },
  {
    id: 'C3',
    category: 'CRA',
    type: 'tecnica',
    text: '¿Qué entiendes por Risk-Based Monitoring y cómo cambia el rol del CRA?',
    framework: 'ICH E6(R3)',
    evaluar: [
      'Define RBM',
      'Menciona ICH E6(R3)',
      'Entiende cambio de "verificar todo" a "priorizar por riesgo"',
    ],
    banderaRoja: 'No conoce el término o lo describe genéricamente.',
    tipBuenaRespuesta:
      'RBM identifica los datos críticos y los procesos de mayor riesgo y enfoca el monitoreo ahí.',
  },
  {
    id: 'C4',
    category: 'CRA',
    type: 'situacional',
    text: 'Estás en una visita y el investigador te reporta un evento adverso serio que ocurrió hace cinco días pero no fue notificado al sponsor. ¿Qué haces?',
    framework: 'ICH-GCP + farmacovigilancia',
    evaluar: [
      'Reconoce timeline de reporte SAE 24 horas',
      'Plan de acción inmediato',
      'Capacitación al sitio',
    ],
    banderaRoja: '"Le pido al investigador que lo reporte." Subestima gravedad.',
    tipBuenaRespuesta:
      'Reporte inmediato al sponsor con desviación documentada + plan de refuerzo en próximo site initiation visit.',
  },
  {
    id: 'C5',
    category: 'CRA',
    type: 'conductual',
    text: '¿Cómo manejas a un investigador principal que es muy ocupado y no te da tiempo durante las visitas de monitoreo?',
    framework: 'Gestión de stakeholders',
    evaluar: [
      'Empatía con la realidad del médico',
      'Estrategia concreta (agenda anticipada, sub-investigator)',
      'No escalamiento prematuro',
    ],
    banderaRoja: '"Lo escalo al sponsor." Falta de negociación.',
    tipBuenaRespuesta: 'Agenda preparada, tiempos cortos, delegar a sub-investigator, escalar solo si afecta compliance.',
  },
  {
    id: 'C6',
    category: 'CRA',
    type: 'tecnica',
    text: '¿Qué es el TMF y cuál es tu rol como CRA en mantenerlo en estado de inspección?',
    framework: 'ICH-GCP / documentación regulatoria',
    evaluar: [
      'Define TMF y eTMF',
      'Entiende "inspection-ready"',
      'Conoce documentos clave',
    ],
    banderaRoja: 'Lo confunde con archivo de paciente o con CRF.',
    tipBuenaRespuesta: 'TMF es Trial Master File, demuestra que el estudio se condujo según protocolo y regulación.',
  },
  {
    id: 'C7',
    category: 'CRA',
    type: 'situacional',
    text: 'Detectas que el sitio está enrolando más lento de lo esperado. ¿A quién y cómo se lo comunicas?',
    framework: 'Comunicación regulatoria',
    evaluar: [
      'Identifica al Clinical Trial Manager o Lead CRA',
      'Documenta en monitoring report',
      'Propone plan, no solo el problema',
    ],
    banderaRoja: '"Le aviso al sponsor." Vago.',
    tipBuenaRespuesta:
      'Documento en monitoring visit report con root cause + propuesta de plan + comunicación al CTM.',
  },
  {
    id: 'C8',
    category: 'CRA',
    type: 'general',
    text: 'Si tienes un PhD pero nunca has trabajado en industria, ¿cómo le explicas al hiring manager que puedes hacer este rol sin esa experiencia previa?',
    framework: 'Auto-narrativa',
    evaluar: [
      'Traduce experiencia académica a competencias CRA',
      'No minimiza curva de aprendizaje',
      'Demuestra conocimiento del rol con vocabulario correcto',
    ],
    banderaRoja: '"Aprendo rápido." Genérico.',
    tipBuenaRespuesta:
      'Conecta tesis con protocolo + cuadernos de lab con source documentation + comité de ética con IRB/IEC.',
  },
];

// ──────────────────────────────────────────────────────────────────
// C · MSL (6 preguntas)
// ──────────────────────────────────────────────────────────────────

export const MSL_QUESTIONS: BankQuestion[] = [
  {
    id: 'M1',
    category: 'MSL',
    type: 'tecnica',
    text: 'Para alguien que no es del sector, ¿cuál es la diferencia entre un MSL y un visitador médico?',
    framework: 'Scientific engagement vs promoción',
    evaluar: [
      'Distinción: MSL hace scientific exchange, visitador promoción',
      'Reconoce que la regulación distingue ambas actividades',
    ],
    banderaRoja: '"Son casi lo mismo, solo cambia el título." Falla compliance básica.',
    tipBuenaRespuesta:
      'MSL hace intercambio científico con KOLs y captura insights. No promueve productos. Visitador sí.',
  },
  {
    id: 'M2',
    category: 'MSL',
    type: 'situacional',
    text: 'Estás en una reunión científica y un KOL te cuestiona fuertemente la evidencia de un producto de tu compañía. ¿Cómo manejas la conversación?',
    framework: 'Scientific Engagement (Engage → Inquire → Inform → Insight)',
    evaluar: [
      'Mantiene postura de exchange científico, no defensa comercial',
      'Pregunta para entender',
      'Comparte evidencia con balance',
      'Captura insight',
    ],
    banderaRoja: '"Le presento nuestro mejor estudio para convencerlo." Lenguaje de visitador.',
    tipBuenaRespuesta:
      'Escucho, pregunto para entender, comparto evidencia con limitaciones, capturo insight para Medical Affairs.',
  },
  {
    id: 'M3',
    category: 'MSL',
    type: 'tecnica',
    text: '¿Qué es un insight en el contexto de MSL y qué haces con uno?',
    framework: 'Scientific Engagement',
    evaluar: [
      'Define insight como información estructurada y accionable',
      'Distingue de feedback simple',
      'Conoce flujo: captura → CRM → Medical Affairs',
    ],
    banderaRoja: '"Es lo que te dicen los doctores." Subestima la naturaleza estructurada.',
    tipBuenaRespuesta:
      'Insight es información estructurada del campo que se documenta y alimenta decisiones de evidence generation.',
  },
  {
    id: 'M4',
    category: 'MSL',
    type: 'tecnica',
    text: '¿Qué entiendes por MLR y cómo afecta tu trabajo cotidiano?',
    framework: 'Compliance interno',
    evaluar: [
      'Define MLR (Medical-Legal-Regulatory)',
      'Entiende que es el comité que aprueba materiales',
      'Conoce timelines y consecuencias',
    ],
    banderaRoja: 'No conoce el acrónimo.',
    tipBuenaRespuesta:
      'MLR es Medical-Legal-Regulatory, el filtro interno que aprueba materiales antes de usarse externamente.',
  },
  {
    id: 'M5',
    category: 'MSL',
    type: 'situacional',
    text: 'Imagina que vas a entrar como MSL en oncología y nunca trabajaste el área. ¿Cómo prepararías los primeros 90 días?',
    framework: 'Onboarding pharma',
    evaluar: [
      'Estructura de aprendizaje',
      'Identificación de KOLs principales',
      'Plan de shadowing',
    ],
    banderaRoja: '"Voy a estudiar oncología." Vago.',
    tipBuenaRespuesta:
      '30 días lectura guidelines NCCN/ESMO + landmark papers. 60 días mapeo KOLs + shadowing. 90 días primeras visitas.',
  },
  {
    id: 'M6',
    category: 'MSL',
    type: 'general',
    text: 'Si tu PhD fue en biología molecular básica, ¿cómo argumentas que estás listo para ser MSL si nunca trabajaste con KOLs?',
    framework: 'Auto-narrativa',
    evaluar: [
      'Traduce habilidades de PhD al rol',
      'No minimiza la curva',
      'Demuestra que sabe qué es scientific exchange',
    ],
    banderaRoja: '"Soy muy bueno presentando." Genérico.',
    tipBuenaRespuesta:
      'Defensa de tesis ↔ manejo de cuestionamientos científicos; journal club ↔ scientific exchange.',
  },
];

// ──────────────────────────────────────────────────────────────────
// D · Clinical Project Manager (5 preguntas)
// ──────────────────────────────────────────────────────────────────

export const CPM_QUESTIONS: BankQuestion[] = [
  {
    id: 'P1',
    category: 'Clinical_PM',
    type: 'situacional',
    text: 'En un estudio multicéntrico tienes al sponsor presionando timelines, al PI quejándose de carga operativa y al CRA reportando atrasos en data entry. ¿Cómo priorizas?',
    framework: 'RACI + risk-based thinking',
    evaluar: [
      'Identifica al sponsor como Accountable',
      'Identifica al PI y al CRA como Responsible',
      'Plan de comunicación clara con cada uno',
      'Risk-based: critical path',
    ],
    banderaRoja: '"Hablo con todos al mismo tiempo." Sin priorización.',
    tipBuenaRespuesta:
      'Critical path analysis + alineación con sponsor + soporte al sitio + escalamiento estructurado.',
  },
  {
    id: 'P2',
    category: 'Clinical_PM',
    type: 'tecnica',
    text: '¿Qué es critical path en un proyecto clínico y cómo lo identificas?',
    framework: 'Project management',
    evaluar: [
      'Define critical path',
      'Identifica tareas que pueden retrasar todo',
      'Conoce herramientas (Gantt, MS Project)',
    ],
    banderaRoja: 'No conoce el concepto o lo confunde con timeline general.',
    tipBuenaRespuesta:
      'Critical path es la secuencia de tareas dependientes más larga. En clinical trials: IRB, regulatory submission, first patient first visit.',
  },
  {
    id: 'P3',
    category: 'Clinical_PM',
    type: 'situacional',
    text: 'Si descubres a mitad del estudio que vas a exceder el presupuesto en 15%, ¿qué pasos tomas?',
    framework: 'Financial PM',
    evaluar: [
      'Análisis de root cause',
      'Comunicación temprana al sponsor',
      'Plan de mitigación con opciones',
    ],
    banderaRoja: 'Lo oculta para resolverlo después. Falla ética.',
    tipBuenaRespuesta: 'Root cause + escalamiento inmediato con opciones presentadas con costo proyectado.',
  },
  {
    id: 'P4',
    category: 'Clinical_PM',
    type: 'conductual',
    text: 'Tienes un CRA en tu equipo que entrega reportes técnicamente buenos pero siempre tarde. ¿Cómo lo manejas?',
    framework: 'People management',
    evaluar: [
      'Conversación 1:1 para entender causas',
      'Plan claro con expectativas',
      'Escalamiento si no mejora',
    ],
    banderaRoja: '"Le aviso a HR." Salto al control sin gestión previa.',
    tipBuenaRespuesta:
      '1:1 enfocado en root cause + expectativas SMART + seguimiento semanal + escalamiento solo si no mejora.',
  },
  {
    id: 'P5',
    category: 'Clinical_PM',
    type: 'conductual',
    text: 'Si tuvieras que dar un status update de 5 minutos a un director sobre un estudio en curso, ¿qué incluirías y qué dejarías fuera?',
    framework: 'Executive communication',
    evaluar: [
      'Incluye: progreso vs plan, key risks, asks',
      'Excluye: detalles sin impacto en decisiones',
      'Formato claro',
    ],
    banderaRoja: 'Listar todo lo que está pasando sin priorizar.',
    tipBuenaRespuesta: 'Status semáforo + 1 KPI + top 2 riesgos con mitigación + ask específico.',
  },
];

// ──────────────────────────────────────────────────────────────────
// E · Healthcare Analyst / Strategy Consulting (5 preguntas)
// ──────────────────────────────────────────────────────────────────

export const ANALYST_QUESTIONS: BankQuestion[] = [
  {
    id: 'A1',
    category: 'Healthcare_Analyst_Consulting',
    type: 'tecnica',
    text: '¿Qué es el framework PICO y cómo lo aplicarías a una pregunta de mercado farmacéutico?',
    framework: 'PICO (Population, Intervention, Comparator, Outcome)',
    evaluar: [
      'Define los 4 elementos',
      'Aplica a pregunta concreta',
      'Conecta con evidence-based decision making',
    ],
    banderaRoja: 'No conoce el framework.',
    tipBuenaRespuesta:
      'PICO aplicado a market access: P = pacientes elegibles, I = producto, C = comparador, O = outcome triple (clínico + económico + acceso).',
  },
  {
    id: 'A2',
    category: 'Healthcare_Analyst_Consulting',
    type: 'tecnica',
    text: '¿Qué es Real World Evidence y por qué pharma lo valora cada vez más?',
    framework: 'HEOR / regulatorio',
    evaluar: [
      'Define RWE',
      'Conoce fuentes (registros, claims, EHR)',
      'Entiende valor regulatorio + acceso',
    ],
    banderaRoja: 'Lo confunde con ensayo clínico fase IV.',
    tipBuenaRespuesta:
      'RWE es evidencia de uso real, fuera del RCT. FDA 21st Century Cures Act lo formalizó.',
  },
  {
    id: 'A3',
    category: 'Healthcare_Analyst_Consulting',
    type: 'situacional',
    text: 'Una empresa pharma quiere lanzar un producto nuevo en México. ¿Qué 3 preguntas analíticas plantearías para evaluar la oportunidad?',
    framework: 'Razonamiento estructurado',
    evaluar: [
      'Estructura clara (mercado, competencia, acceso)',
      'Preguntas operacionalizables',
      'Conoce contexto LATAM (COFEPRIS, IMSS, ISSSTE)',
    ],
    banderaRoja: 'Preguntas tan amplias que son inútiles.',
    tipBuenaRespuesta:
      'Tamaño y crecimiento de mercado + posicionamiento competitivo + ruta de acceso pública y privada.',
  },
  {
    id: 'A4',
    category: 'Healthcare_Analyst_Consulting',
    type: 'conductual',
    text: 'Tienes un análisis que muestra que un producto tiene mejor outcome clínico pero costo 20% mayor que el comparador. ¿Cómo se lo presentas a un director comercial?',
    framework: 'Executive communication',
    evaluar: [
      'Traduce número a impacto comercial',
      'Presenta tradeoff con claridad',
      'Sugiere segmentos defensibles',
    ],
    banderaRoja: 'Listar tablas estadísticas sin traducción.',
    tipBuenaRespuesta:
      'Slide con 2 columnas (outcome vs costo) + costo-efectividad incremental + segmentos donde se justifica.',
  },
  {
    id: 'A5',
    category: 'Healthcare_Analyst_Consulting',
    type: 'general',
    text: 'Si vienes de una tesis con análisis estadístico fuerte, ¿cómo argumentas que puedes hacer analytics pharma sin haber tocado el sector?',
    framework: 'Auto-narrativa',
    evaluar: [
      'Traduce skills académicos a pharma analytics',
      'Conoce vocabulario básico de HEOR / market access',
      'Reconoce curva de aprendizaje del contexto regulatorio',
    ],
    banderaRoja: '"Sé R y Python." No conecta con valor pharma.',
    tipBuenaRespuesta:
      'Tesis manejó N grande con datos longitudinales y métodos causales. En pharma analytics eso es core de RWE.',
  },
];

// ──────────────────────────────────────────────────────────────────
// API pública del banco
// ──────────────────────────────────────────────────────────────────

export const ALL_QUESTIONS: BankQuestion[] = [
  ...GENERAL_QUESTIONS,
  ...CRA_QUESTIONS,
  ...MSL_QUESTIONS,
  ...CPM_QUESTIONS,
  ...ANALYST_QUESTIONS,
];

/**
 * Devuelve preguntas del banco filtradas por rol y tipo.
 * Las preguntas Generales aplican a todos los roles.
 */
export function getBankQuestions(options: {
  role: Role;
  types?: QuestionType[];
}): BankQuestion[] {
  const { role, types } = options;

  // Mapear Role enum a category del banco
  const roleCategory = mapRoleToCategory(role);

  const filtered = ALL_QUESTIONS.filter((q) => {
    const matchesRole = q.category === 'general' || q.category === roleCategory;
    const matchesType = !types || types.includes(q.type);
    return matchesRole && matchesType;
  });

  return filtered;
}

function mapRoleToCategory(role: Role): BankCategory | null {
  switch (role) {
    case 'CRA':
    case 'Associate_Clinical_Scientist':
      return 'CRA'; // ACS comparte gran parte del bank de CRA
    case 'MSL':
    case 'Medical_Affairs':
      return 'MSL';
    case 'Clinical_PM':
      return 'Clinical_PM';
    case 'Healthcare_Analyst':
    case 'Strategy_Consulting':
    case 'HEOR':
      return 'Healthcare_Analyst_Consulting';
    case 'Regulatory':
    case 'Pharmacovigilance':
    case 'Other':
    default:
      return null; // solo generales aplicables hasta que ampliemos el banco
  }
}

// ──────────────────────────────────────────────────────────────────
// Templates CV-anclados (v0.1)
// ──────────────────────────────────────────────────────────────────

export interface CvAnchoredTemplate {
  id: string;
  pattern: string; // con placeholders {tecnica_especifica}, {rol}, etc.
  activator: string; // qué campo del cvResumen lo activa
  evaluar: string[];
  banderaRoja: string;
  tipBuenaRespuesta: string;
}

export const CV_ANCHORED_TEMPLATES: CvAnchoredTemplate[] = [
  {
    id: 'CV1',
    pattern:
      'En tu CV mencionas {tecnica_especifica} durante {formacion}. ¿Cómo conectarías esa técnica con las responsabilidades de un {rol}?',
    activator: 'tecnicas[] no vacío + rol definido',
    evaluar: ['Conexión real no forzada', 'Vocabulario de traducción', 'Honestidad sobre lo que NO aplica'],
    banderaRoja: 'Forzar conexiones falsas.',
    tipBuenaRespuesta: 'Conectar el principio detrás de la técnica con el principio del rol.',
  },
  {
    id: 'CV2',
    pattern:
      'Tu CV muestra experiencia en {area_X} pero estás aplicando a un rol en {area_Y}. ¿Cómo justificas el cambio?',
    activator: 'areas_tematicas[] que NO coincide con rol_apuntado',
    evaluar: ['Reconoce el cambio sin minimizarlo', 'Articula el por qué', 'Identifica skills transferibles'],
    banderaRoja: '"Es lo mismo." Falta de honestidad.',
    tipBuenaRespuesta: '"Mi experiencia en X me dio Y skill que se transfiere a Z aspecto del rol."',
  },
  {
    id: 'CV3',
    pattern:
      'Tu CV indica {N} publicaciones como {primer/coautor}. En una entrevista para {rol}, ¿cómo presentarías eso sin sonar académico?',
    activator: 'publicaciones_count > 0',
    evaluar: ['Traduce métrica académica a pharma', 'Evita jerga innecesaria', 'Conecta con responsabilidades del rol'],
    banderaRoja: 'Mencionar impact factor sin contexto.',
    tipBuenaRespuesta: 'Publicaciones demuestran rigor escrito, manejo de revisión por pares (analogous to MLR), y persistencia.',
  },
  {
    id: 'CV4',
    pattern:
      'No noté en tu CV una declaración explícita de tu nivel de inglés. ¿Cuál es tu nivel real, especialmente verbal?',
    activator: 'idiomas_declarados[] vacío o sin inglés',
    evaluar: ['Honestidad sobre el nivel', 'Reconoce que pharma LATAM lo requiere', 'Plan si no es C1'],
    banderaRoja: '"Mi inglés es excelente" sin sustento.',
    tipBuenaRespuesta: 'Nivel honesto + plan concreto + evidencia (papers leídos, conferencias).',
  },
  {
    id: 'CV5',
    pattern:
      'Veo un periodo de {duracion} entre {evento_anterior} y {evento_posterior}. ¿Qué pasó en ese tiempo?',
    activator: 'gaps_visibles[] no vacío',
    evaluar: ['Reconoce el gap sin defensividad', 'Explica con calma', 'Reconvierte el tiempo'],
    banderaRoja: 'Excusa larga y nerviosa.',
    tipBuenaRespuesta: '"Tomé X tiempo para Y razón. Durante eso hice Z. Estoy listo para volver."',
  },
  {
    id: 'CV6',
    pattern:
      'En tu CV aparece como tu rol más reciente {experiencia[0]}. ¿Por qué decidiste buscar un cambio?',
    activator: 'experiencia[0] definido',
    evaluar: ['Razón clara del cambio', 'Conecta con lo que busca', 'Tono profesional'],
    banderaRoja: 'Hablar mal del jefe o empresa actual.',
    tipBuenaRespuesta:
      'Razón profesional honesta + conexión con lo que el siguiente rol ofrece.',
  },
  {
    id: 'CV7',
    pattern:
      'Tu CV menciona {fortaleza_pharma_evidente}. Cuéntame más en detalle de esa experiencia.',
    activator: 'fortalezas_pharma_evidentes[] no vacío',
    evaluar: ['Profundidad real', 'Vocabulario pharma correcto', 'Ejemplos concretos'],
    banderaRoja: 'No poder elaborar lo que el CV declara.',
    tipBuenaRespuesta: 'Tres niveles de detalle: qué hiciste, cómo, qué aprendiste.',
  },
  {
    id: 'CV8',
    pattern:
      'Tu CV no muestra experiencia previa en industria farmacéutica. ¿Por qué crees que el hiring manager debería arriesgarse contigo en este rol?',
    activator: 'gaps_visibles[] incluye "sin_experiencia_industria"',
    evaluar: ['Reconoce curva de aprendizaje', 'Articula valor diferencial', 'Plan de 90 días'],
    banderaRoja: '"Aprendo rápido." Cliché.',
    tipBuenaRespuesta:
      'Reconozco curva + lo que traigo de distinto + plan 30/60/90 concreto.',
  },
  {
    id: 'CV9',
    pattern:
      'Vi que tienes experiencia en {pais_o_institucion_extranjera}. ¿Cómo crees que esa experiencia internacional te diferencia para este rol en {pais_actual}?',
    activator: 'experiencia extranjera detectada',
    evaluar: [
      'Conexión real con el rol',
      'Exposure a frameworks regulatorios distintos',
      'Capacidad de adaptación',
    ],
    banderaRoja: 'Solo enfatizar "inglés mejorado".',
    tipBuenaRespuesta:
      'Exposición a frameworks distintos + adaptabilidad + perspectiva multicultural para roles regionales.',
  },
  {
    id: 'CV10',
    pattern:
      'Veo en tu CV {duracion_posdoc} en posdoc. ¿Qué te hace decidir salir ahora y no haberlo hecho antes?',
    activator: 'posdoc > 2 años',
    evaluar: ['Honestidad sobre el momento', 'Madurez sobre academia', 'Claridad del futuro'],
    banderaRoja: '"No conseguí plaza" sin reformular.',
    tipBuenaRespuesta:
      'Posdoc dio X aprendizaje. Llegué al punto donde Y motivación pesa más. Pharma ofrece Z específico.',
  },
  {
    id: 'CV11',
    pattern:
      'Tu CV menciona experiencia en {area_no_relacionada}. ¿Por qué incluiste eso si no aplica directamente?',
    activator: 'elementos no mapeables al rol_apuntado',
    evaluar: ['Razón consciente', 'Conexión transferible', 'Capacidad de editar CV'],
    banderaRoja: '"No sé, lo dejé porque sí." Falta de awareness.',
    tipBuenaRespuesta: 'Razón clara + reconocimiento de que el CV se adapta al rol.',
  },
  {
    id: 'CV12',
    pattern:
      'Para el rol de {rol}, una habilidad esperada es {habilidad_clave_ausente}. ¿Cuál es tu nivel actual ahí?',
    activator: 'gap entre rol_apuntado y skills críticos faltantes',
    evaluar: ['Honestidad sobre el gap', 'Plan concreto para cerrarlo', 'Reconocimiento del por qué importa'],
    banderaRoja: 'Inventar experiencia que no está en el CV.',
    tipBuenaRespuesta:
      'Nivel actual + plan concreto (curso, mentoría) + cómo compensa mientras tanto.',
  },
];
