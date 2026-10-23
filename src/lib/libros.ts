/**
 * Libros de la colección Solca · fuente de las landings /libros/<slug> (23 oct 2026).
 *
 * Todo el texto sale de los manuscritos: contraportada (contraportada.md de libro, libro2 y libro3;
 * libro4/make_contraportada.py para FV) e índice de cada libro (_combined.md;
 * Solca_FV.docx para FV). No agregues cifras ni promesas que no estén en el libro.
 * URLs de Hotmart: las mismas de index.astro y quiz-rol.astro.
 */

export interface ModuloLibro {
  titulo: string;
  temas: string[];
}

export interface Libro {
  slug: string;
  rol: string; // id de rol en vacantes-clasificar.ts
  modulo: string; // módulo del Simulador de Entrevistas
  titulo: string;
  tituloSeo: string;
  subtitulo: string;
  portada: string;
  hotmart: string;
  intro: string;
  resultados: string[];
  modulos: ModuloLibro[];
  extras: string[];
}

export const LIBROS: Libro[] = [
  {
    slug: 'project-manager',
    rol: 'clinical_pm',
    modulo: 'pm',
    titulo: 'Project Manager en pharma',
    tituloSeo: 'Libro Project Manager en industria farmacéutica',
    subtitulo: 'Guía práctica para científicos de la salud · LATAM y España',
    portada: '/covers/portada_pm.png',
    hotmart: 'https://go.hotmart.com/R105710415P',
    intro:
      'Si tu formación es científica y quieres entrar a industria como Project Manager en pharma, biotech o dispositivos médicos, este libro traduce lo que ya sabes hacer al vocabulario que la industria contrata.',
    resultados: [
      'El vocabulario y la lógica operativa del Project Management aplicados a industria pharma.',
      'Un mapa de metodologías (Waterfall, Agile, Kanban, Lean Six Sigma, híbridos) con criterio para elegir dónde encajas.',
      'Un filtro claro para leer ofertas: tamaño de empresa, cultura, modalidad, viajes, compensación.',
      'Un plan concreto para los primeros noventa días en tu primer rol.',
      'Cuatro plantillas de prompt adaptables para incorporar IA al oficio del PM sin perder criterio.',
    ],
    modulos: [
      { titulo: 'Fundamentos del Project Management', temas: ['Por qué un científico de la salud es un buen Project Manager', 'Qué es un proyecto y qué hace un PM', 'Las doce habilidades clave del PM', 'Métricas de éxito y errores comunes'] },
      { titulo: 'Gestionando proyectos en la industria', temas: ['El ciclo de vida del proyecto', 'Riesgo, cambio y terminología clave', 'Waterfall, Agile, Scrum, Kanban e híbridas', 'Herramientas y software', 'Diferencias operativas España vs LATAM'] },
      { titulo: 'Reverse-engineering tu rol ideal', temas: ['Los factores que decides tú antes de aplicar', 'Industrias, salarios y estilos de vida en Latinoamérica', 'Presencia, resume y entrevista', 'Mercado laboral España: empresas Iberia y bandas salariales'] },
      { titulo: 'Tus primeros 90 días', temas: ['Cómo aterrizar bien en una nueva organización', 'Por qué fallan los proyectos', 'Crecimiento profesional vertical', 'Movimientos laterales: ocho caminos posibles'] },
      { titulo: 'IA y productividad para Project Managers', temas: ['Herramientas por etapa del proyecto', 'Prompts útiles para PMs', 'Riesgos éticos y operativos', 'Una nota sobre las certificaciones de IA'] },
    ],
    extras: ['Cuaderno de trabajo al final de cada módulo', 'Referencias verificables por módulo', 'Glosario inglés-español de términos clave'],
  },
  {
    slug: 'msl',
    rol: 'msl',
    modulo: 'msl',
    titulo: 'Medical Science Liaison',
    tituloSeo: 'Libro Medical Science Liaison (MSL)',
    subtitulo: 'Guía práctica para científicos de la salud · LATAM y España',
    portada: '/covers/portada_msl.png',
    hotmart: 'https://go.hotmart.com/Y105718405Y',
    intro:
      'El Medical Science Liaison es el rol que muchos científicos de la salud descubren tarde. Es el puente entre la ciencia y los KOLs, y la puerta más natural de industria para un profesional clínico o de investigación con vocación de intercambio científico. Este libro te enseña a cruzarla.',
    resultados: [
      'Una lectura honesta de si el rol MSL encaja con tu perfil científico o clínico.',
      'El vocabulario regulatorio del oficio: intercambio científico, KOLs, advisory boards y la línea que separa al MSL del visitador médico.',
      'Un mapa concreto del mercado MSL en LATAM y España, con rangos salariales por país y sus fuentes.',
      'Un plan para los primeros noventa días y criterio para pensar tu trayectoria a cinco años.',
      'Diez plantillas de prompt adaptables a herramientas empresariales aprobadas, sin comprometer compliance.',
    ],
    modulos: [
      { titulo: 'Fundamentos del rol MSL', temas: ['Por qué un perfil científico es un MSL natural', 'Qué es y qué NO es un MSL: seis roles adyacentes', 'El ecosistema Medical Affairs', 'Las diez habilidades clave', 'Cinco errores comunes en el primer año'] },
      { titulo: 'El día a día · operación y compliance', temas: ['KOL mapping y planning', 'Anatomía de una visita científica', 'Insights médicos, advisory boards y congresos', 'Scientific exchange vs. promoción', 'Marco regulatorio LATAM y España por país', 'ICH E6(R3): qué cambia para el MSL'] },
      { titulo: 'Reverse-engineering tu rol ideal', temas: ['Seis factores que decides tú', 'Empresas activas en LATAM', 'Salarios MSL por país y estructura de compensación', 'El MSL Resume vs. el CV académico', 'La entrevista MSL en cuatro fases', 'Mercado laboral España'] },
      { titulo: 'Primeros 90 días y carrera', temas: ['Onboarding técnico y KOL mapping inicial', 'Tu primera visita', 'Cuatro patrones de fracaso', 'Movimientos laterales: siete caminos', 'MAPS, MSL Society, ACMA y BCMAS'] },
      { titulo: 'IA y productividad para MSLs', temas: ['Casos de uso reales hoy en MSL', 'Diez prompts plantilla con caveat de compliance', 'Riesgos éticos y operativos', 'El MSL del futuro: tres tendencias'] },
    ],
    extras: ['Cuaderno de trabajo al final de cada módulo', 'Referencias verificables por módulo', 'Glosario inglés-español de Medical Affairs'],
  },
  {
    slug: 'clinical-research',
    rol: 'investigacion_clinica',
    modulo: 'cr',
    titulo: 'Clinical Research',
    tituloSeo: 'Libro Clinical Research: CRA y CRS',
    subtitulo: 'Guía práctica para científicos de la salud · LATAM y España',
    portada: '/covers/portada_cr.png',
    hotmart: 'https://go.hotmart.com/U105724060O',
    intro:
      'Si tu formación es científica y quieres entrar a la operación de ensayos clínicos como CRA o CRS, este libro es el mapa completo desde la definición del rol hasta los primeros noventa días, con el marco regulatorio LATAM, España y FDA actualizado a agosto de 2026.',
    resultados: [
      'El vocabulario y la lógica operativa del CRA y del CRS en industria pharma, biotech, dispositivos médicos y CROs.',
      'Los marcos regulatorios vigentes de ICH E6(R3), FDA, EMA/CTIS, AEMPS, COFEPRIS, ANMAT, INVIMA, ISP y ANVISA, con estado actualizado y las fechas clave.',
      'Un mapa concreto del mercado en LATAM y España, con rangos salariales por país y sus fuentes.',
      'Un plan para los primeros noventa días y criterio para pensar certificaciones ACRP y SOCRA como aceleradores, no como requisito.',
      'Diez plantillas de prompt adaptables a herramientas empresariales aprobadas, respetando GCP y datos sensibles.',
    ],
    modulos: [
      { titulo: 'Fundamentos de la investigación clínica', temas: ['Qué es un ensayo clínico: pre-clínica y fases I-IV', 'GCP y por qué importan', 'El ecosistema: sponsors, CROs, sitios, comités, reguladores', 'Roles principales: CRS y CRA', 'Diez habilidades transferibles'] },
      { titulo: 'Operación y compliance', temas: ['Un día en la vida de un CRS y de un CRA', 'Diseño de ensayos y protocolo', 'ICH E6(R3): qué cambia con la versión 2025', 'Marco regulatorio LATAM por país', 'AEMPS, EMA y CTIS', 'FDA: por qué importa aunque trabajes en LATAM o España'] },
      { titulo: 'Reverse-engineering tu rol ideal', temas: ['Quién contrata: pharma, biotech y CROs', 'Salarios LATAM por país y mercado España', 'El CV académico vs. el CRA/CRS Resume', 'Networking y el mercado oculto', 'La entrevista: cinco fases y método STAR'] },
      { titulo: 'Primeros 90 días y carrera', temas: ['Plan 30/60/90 días', 'Cuatro patrones de fracaso', 'De CRA a Director Clinical Operations', 'Movimientos laterales: siete caminos', 'ACRP, SOCRA, DIA y SCT'] },
      { titulo: 'IA en investigación clínica', temas: ['Casos de uso reales hoy, con clasificación honesta', 'Diez prompts plantilla para CRS y CRA', 'Riesgos: GCP, datos sensibles, alucinación, sesgo', 'FDA, EMA e ICH ante la IA'] },
    ],
    extras: ['Cuaderno de trabajo al final de cada módulo', 'Referencias verificables por módulo', 'Glosario inglés-español de investigación clínica'],
  },
  {
    slug: 'farmacovigilancia',
    rol: 'farmacovigilancia',
    modulo: 'fv',
    titulo: 'Farmacovigilancia LATAM',
    tituloSeo: 'Libro Farmacovigilancia: Drug Safety Associate',
    subtitulo: 'Guía de entrada al rol de Drug Safety Associate (DSA) · LATAM y España',
    portada: '/covers/portada_fv.png',
    hotmart: 'https://pay.hotmart.com/E107847432I',
    intro:
      'La farmacovigilancia es la puerta de entrada más honesta a industria pharma para un científico o clínico sin experiencia previa: alta demanda en CROs y BPOs, ciclo de aprendizaje corto y una trayectoria clara de cinco años hacia Manager o Principal. Este libro te enseña a cruzar esa puerta.',
    resultados: [
      'El vocabulario y la lógica operativa del Drug Safety Associate en CRO, BPO y sponsor local.',
      'El marco regulatorio de trabajo diario: ICH E2, EMA GVP, FDA 21 CFR y las agencias LATAM al nivel que un DSA I necesita el primer año.',
      'Las herramientas del oficio sin humo: MedDRA, causalidad WHO-UMC y Naranjo, ICSRs, PSUR, PBRER, RMP y los cuatro sistemas propietarios del mercado.',
      'Un mapa del mercado LATAM y España con rangos salariales por país y sus fuentes, más una referencia oficial DataMéxico como piso conservador.',
      'Un plan para los primeros noventa días y una trayectoria de cinco años con moves entre empleadores calibrada por datos, no por promesas.',
      'Quince preguntas técnicas de entrevista con respuestas modelo y cinco conductuales típicas con marco STAR.',
      'Un módulo completo sobre IA y productividad para farmacovigilancia: casos de uso reales, prompts plantilla con caveats de compliance, y el marco regulatorio FDA/EMA 2026.',
    ],
    modulos: [
      { titulo: 'Fundamentos del rol', temas: ['Qué es y qué NO es farmacovigilancia', 'El ecosistema: CRO, BPO, sponsor, agencias, pacientes', 'Roles principales: de DSA I a Manager', 'Diez habilidades transferibles'] },
      { titulo: 'Operación y compliance', temas: ['Un día en la vida de un DSA I', 'El ICSR y los cuatro criterios mínimos', 'MedDRA y causalidad WHO-UMC vs Naranjo', 'ICH E2, EMA GVP, FDA 21 CFR y agencias LATAM', 'Signal detection, PBRER, DSUR y RMP'] },
      { titulo: 'Reverse-engineering tu rol ideal', temas: ['Los tres mundos: CRO, BPO y sponsor', 'Salarios en México, Argentina, Colombia, Chile y Perú; España como referencia', 'Bonos, beneficios y negociación', 'CV, ATS y proceso por tipo de empleador', 'Quince preguntas técnicas con respuestas modelo'] },
      { titulo: 'Primeros 90 días y carrera', temas: ['Plan 30/60/90 días', 'De DSA I a Manager y cuándo cambiar de empleador', 'Patrones de fracaso en el primer año', 'Movimientos laterales: siete caminos', 'Certificaciones y comunidades'] },
      { titulo: 'IA y productividad para farmacovigilancia', temas: ['Casos de uso reales hoy', 'Diez prompts plantilla con caveat de compliance', 'Riesgos éticos y operativos', 'FDA, EMA e ICH ante la IA'] },
    ],
    extras: ['Cuaderno de trabajo al final de cada módulo', 'Referencias verificables por módulo', 'Glosario inglés-español de farmacovigilancia', 'Apéndice con las agencias regulatorias por país'],
  },
];

export const LIBRO_POR_ROL: Record<string, Libro> = Object.fromEntries(LIBROS.map((l) => [l.rol, l]));
