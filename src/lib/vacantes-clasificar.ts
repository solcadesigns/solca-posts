/**
 * Clasificación de vacantes por rol y nivel a partir del título (22 oct 2026).
 *
 * Reglas, sin IA: no gasta tokens y es reproducible. Los roles comparten ids con
 * el catálogo de la encuesta de mercado (src/lib/market-catalog.ts) para cruzar
 * "qué buscan las personas" con "qué ofrece el mercado". Se agregan cuatro áreas
 * que solo existen del lado de las vacantes (calidad, comercial, datos, otro).
 *
 * El nivel es una estimación por palabras del título; cuando el título no lo dice
 * queda como 'no_especificado'. Al cambiar reglas, sube CLASIFICACION_VERSION.
 */

export const CLASIFICACION_VERSION = 'r9';

export interface RolVacante {
  id: string;
  label: string;
}

export const ROLES_VACANTE: RolVacante[] = [
  { id: 'investigacion_clinica', label: 'Investigación clínica (CRA, CRC, operaciones)' },
  { id: 'clinical_pm', label: 'Project Manager clínico' },
  { id: 'msl', label: 'Medical Science Liaison' },
  { id: 'medical_affairs', label: 'Medical Affairs' },
  { id: 'farmacovigilancia', label: 'Farmacovigilancia' },
  { id: 'regulatorio', label: 'Asuntos regulatorios' },
  { id: 'heor_analytics', label: 'HEOR, acceso y evidencia' },
  { id: 'consulting', label: 'Consultoría' },
  { id: 'laboratorio_rd', label: 'Laboratorio / R&D' },
  { id: 'ventas', label: 'Ventas / visita médica' },
  // r9 (24 nov 2026): se conserva el id para no romper la serie ni los enlaces guardados, pero ya solo es calidad.
  // Producción, mantenimiento, logística y compras pasan a 'operaciones'.
  { id: 'calidad_manufactura', label: 'Calidad y validación' },
  { id: 'operaciones', label: 'Producción, mantenimiento y cadena de suministro' },
  { id: 'comercial_marketing', label: 'Marketing y comercial' },
  // r9: gestión de datos clínicos, bioestadística, programación estadística y codificación médica salen de 'datos_ti'.
  { id: 'datos_clinicos', label: 'Datos clínicos y bioestadística' },
  { id: 'datos_ti', label: 'TI, datos y analítica' },
  { id: 'corporativo', label: 'Finanzas, RH, legal y administración' },
  { id: 'otro', label: 'Otras áreas' },
];

// El orden importa: gana la primera regla que coincide.
const ROL_REGLAS: Array<[string, RegExp]> = [
  // "(MSL) Excellence Director" y similares son gestión de Medical Affairs, no MSL de campo.
  ['medical_affairs', /(\(MSL\)|MSL) (excellence|operations|capabilit)/i],
  ['msl', /\b(MSL|medical science liai?son|medical scientific liaison|enlace cient[ií]fico|liaison m[eé]dic)/i],
  ['laboratorio_rd', /(non[- ]?clinical|toxicolog|qu[ií]mico analista|microbiolog|technologist|discovery|scientific portfolio|principal investigator)/i],
  ['farmacovigilancia', /(medical safety|safety program|clinical trial safety|pharmacovigilance|farmacovigil[aâ]ncia|farmacovigilancia|drug safety|patient safety|safety (specialist|scientist|physician|associate|case|data|project|lead|manager|reporting)|\bPV\b|\bICSR)/i],
  ['regulatorio', /(reg\.? affairs|regulatory|regulat[oó]ri|asuntos regulatorios|assuntos regulat|registro sanitario|registros sanitarios|\bRA (specialist|associate|manager|lead))/i],
  ['clinical_pm', /investigator (pricing|payments?|grants?)/i],
  ['heor_analytics', /(strategic access|access (strategy|field|manager)|field access|acceso y valor|health technology assessment|\bHTA\b|epidemiolog|licitaci|licita[cç]|tender|inteligencia de mercado|intelig[eê]ncia de mercado|market research|primary research|HEOR|health economic|econom[ií]a de la salud|market access|acceso al mercado|acesso ao mercado|\bRWE\b|real[- ]world|outcomes research|pricing|reimbursement|value (and|&) access)/i],
  // r9: "Business Developer" y "Proposal Developer" son puestos comerciales, no de software.
  ['comercial_marketing', /(business develop|proposals? develop|digital marketing|marketing digital)/i],
  // r9: datos de estudios clínicos (gestión, revisión, codificación, bioestadística y programación estadística).
  ['datos_clinicos', /(clinical data|clin\.? data|\bCDM\b|data manager\b|data review|patient data|study data|datos .*cl[ií]nicos|dados cl[ií]nicos|biostatistic|bioestad|statistic|estad[ií]stic|\bSAS\b|clinical programm|\bEDC\b|clinical systems? (designer|lead|support|optimization)|medical coding|clinical coding|coding (specialist|analyst)|pharmacometric|\bPK\/PD\b|data standards)/i],
  ['datos_ti', /(application security|information security|\bAI\b|artificial intelligence|digital|architect|tech(nical)? lead|\bERP\b|\bMES\b|scrum|agile|website|IIoT|clinical coding|product owner|information security|\bDDIT\b|\bRDT\b|\bIT\b|workday|informatics|system designer|data scien|data engineer|software|developer|desarrollador|programmer|programador|\bSAS\b|medical coding|statistic|estad[ií]stic|cloud|cyber)/i],
  ['clinical_pm', /(clinical project|local trial manager|global trial manager|trial delivery manager|clinical team lead|team lead - project manager|clinical project manager|clinical trial manager|\bCTM\b|study manager|global study (lead|associate director|director)|trial clinical delivery|gerente de proyectos? cl[ií]nic|project manager.*(clinical|study|trial)|(clinical|study|trial|biosampling).*project manager|gestor de projetos? cl[ií]nic)/i],
  ['investigacion_clinica', /(vendor program|outsourcing|study process|(\b|Sr)CRA ?\d?\b|\bSMA\b|site mana?g[ae]ment associate|\bCTC\b|country approval|start[- ]?up (maintenance )?(specialist|associate)|startup associate|set[- ]?up specialist|site navigator|site enrollment|clin\. operations|centralized monitoring|clinical monitoring|adjudication|(psych|independent) rater|clinical trial finance|contracts? (and budget|negotiat|spec|analyst)|remote monitoring|clinical outcome|\bDCT\b|estudios cl[ií]nicos|global study associate|clinic?al rese?a?r?ch|investigaci[oó]n cl[ií]nica|pesquisa cl[ií]nica|investiga[cç][aã]o cl[ií]nica|monitor (cl[ií]nico|de ensayos|de estudos)|central monitor|\bsite (manager|management|monitor|activation|contracts?|payments?|specialist|engagement|identification)|feasibility|informed consent|investigator payments?|grants (specialist|analyst)|study (start[- ]up|coordinator|support|team)|patient recruitment|\bTMF\b|\bRBQM\b|\bCRC\b|clinical trial (assistant|associate|coordinator)|\bCTA\b|clinical operations|operaciones cl[ií]nicas|opera[cç][oõ]es cl[ií]nicas|in-house clinical|trial vendor)/i],
  ['medical_affairs', /(clinical (science|development)|medical (strategy|contact|ecosystem|education|representative)|healthcare ecosystem|opera[cç][oõ]es m[eé]dicas|eventos m[eé]dicos|medical (advisor|affairs|manager|lead|director|information|writer|writing|scientist|excellence|doctor|spain|mexico|m[eé]xico)|director medical|scientific affairs|physician|asesor m[eé]dico|gerente m[eé]dico|director m[eé]dico|assessor m[eé]dico|redactor m[eé]dico|clinical scientist)/i],
  // "Consultor de ventas" es un puesto comercial, no consultoría.
  ['ventas', /(consultor[a]? (de ventas|comercial|de vendas|t[eé]cnic|demanda)|televend)/i],
  ['corporativo', /client service rep/i],
  ['consulting', /(consultant|consultor|consultoria|consultoría|consulting|advisory)/i],
  ['laboratorio_rd', /(scientist|cient[ií]fico|research (associate|scientist)|R&D|I\+D|P&D|laborator|bioanal|formulat|analista de laborat)/i],
  ['ventas', /(delegad|delega@|agente de propaganda|promoci[oó]n m[eé]dica|visita m[eé]dica|\bAPM\b|\bKAE\b|ejecutivo de cuenta|account manager|gerente (distrital|de distrito|de cuentas|de area|de área)|area manager|business unit (director|manager)|biopharmaceutical rep|therapeutic area specialist|disease area specialist|professional relations|assessor t[eé]cnico|field application|mapping specialist|market development|product specialist|clinical selling|especialista cl[ií]nico|promotor|sell out|nutriasesor|\brep\b|sales|ventas|vendas|representante (m[eé]dico|de ventas|comercial|de salud|en salud)|heal?th representative|visitador|propagandista|key account|\bKAM\b|territory)/i],
  // r9: un puesto legal no es de calidad aunque mencione compras ("Legal Manager, … Public Procurement").
  ['corporativo', /(\blegal\b|counsel|abogad|jur[ií]dic)/i],
  ['calidad_manufactura', /(\bGCP\b|deviation writer|quality|calidad|qualidade|\bQA\b|\bQC\b|\bGMP\b|validation|validaci[oó]n|valida[cç][aã]o)/i],
  ['operaciones', /(environmental|medio ambiente|\bEHS\b|\bHSE\b|global trade|engineering graduate|operador|(?<!database )operator|operari[oa]|maintenance|mantenimiento|\bMTTO\b|manuten[cç][aã]o|embalagem|envasado|empaquetado|acondicionamiento|packaging|material handler|procurement|buyer|compras|sourcing(?! recruit)|reliability|manufactur|manufatur|producci[oó]n|produ[cç][aã]o|production|supply|cadena de suministro|log[ií]stic|warehouse|almac[eé]n|importa[cç]|exporta[cç]|importaci|exportaci)/i],
  ['comercial_marketing', /(gerente de producto|business develop|launch excellence|new product planning|forecasting|jornada do paciente|programa de soporte|soluciones pacientes|\bPSP\b|marketing|brand|product manager|commercial|comercial|customer (engagement|experience)|\bCRM\b|omnichannel|market insights|franchise)/i],
  ['datos_ti', /(data|datos|dados|analytics|engineer|ingenier)/i],
  ['corporativo', /(financ|accountant|accounting|contab|contralor|controlling|\btax\b|treasury|credit and collection|audit|legal|counsel|compliance|\bHR\b|human resources|recursos humanos|departamento pessoal|talent|recruit|people|payroll|folha de pagamento|compensation|rewards|administrativ|executive assistant|facilities|public affairs|corporate (affairs|communications)|relações governamentais|relaciones gubernamentales|customer (care|service)|call center)/i],
];

/**
 * En una CRO, "Project Manager" a secas es casi siempre gestión de estudios clínicos.
 * Fuera de las CRO se deja como 'otro' porque puede ser de cualquier área.
 */
/**
 * Tipo de empresa de la vacante (r9, 24 nov 2026). Casi siempre es el de la fuente, pero el portal de
 * Thermo Fisher publica PPD (CRO) junto con reactivos, equipos y manufactura. En esas fuentes
 * (`tipoNoClinico` en vacantes-fuentes.ts) la vacante es de la CRO solo si el rol es clínico o la
 * descripción nombra a PPD o la investigación clínica; si no, toma el tipo no clínico.
 */
const ROLES_CLINICOS = new Set(['investigacion_clinica', 'clinical_pm', 'farmacovigilancia', 'regulatorio', 'medical_affairs', 'msl', 'datos_clinicos', 'heor_analytics']);
// Señal en título o descripción: PPD, FSP (proveedor de servicios funcionales de la CRO), GCP, lo clínico.
const RX_SENAL_CRO = /(\bPPD\b|\bFSP\b|\bGCP\b|clinical|cl[ií]nic|drug development)/i;
// Solo en el título: la descripción de reactivos y equipos también menciona pacientes.
const RX_SENAL_CRO_TITULO = /(med(ical)? info|patient|medical)/i;
export function tipoEmpresaVacante(
  fuente: { tipo: string; tipoNoClinico?: string },
  titulo: string,
  descripcion: string | null | undefined,
): string {
  if (!fuente.tipoNoClinico) return fuente.tipo;
  if (ROLES_CLINICOS.has(clasificarRol(titulo)) || RX_SENAL_CRO_TITULO.test(titulo) || RX_SENAL_CRO.test(`${titulo} ${descripcion ?? ''}`)) return fuente.tipo;
  return fuente.tipoNoClinico;
}

export function clasificarRolEmpresa(titulo: string, tipoEmpresa: string): string {
  const rol = clasificarRol(titulo);
  if (rol === 'otro' && tipoEmpresa === 'cro' && /project (manager|lead)|associate project manager/i.test(titulo)) return 'clinical_pm';
  return rol;
}

export function clasificarRol(titulo: string): string {
  for (const [rol, rx] of ROL_REGLAS) if (rx.test(titulo)) return rol;
  return 'otro';
}

export const NIVELES = [
  { id: 'practicas', label: 'Prácticas y programas de egresados' },
  { id: 'entrada', label: 'Entrada / junior' },
  { id: 'intermedio', label: 'Intermedio (II)' },
  { id: 'senior', label: 'Senior / especialista' },
  { id: 'gerencia', label: 'Gerencia y dirección' },
  { id: 'no_especificado', label: 'Sin nivel en el título' },
];

/**
 * Nivel por el título. Con `aniosMin` (años mínimos que pide la descripción, de vacantes-descriptores.ts),
 * una vacante que el título marca como de entrada pero pide 5 años o más queda sin nivel (r9, 24 nov 2026):
 * "Associate Architect" o "Executive Assistant" con 5 a 8 años no son puestos de entrada.
 */
export const ANIOS_MAX_ENTRADA = 4;
export function clasificarNivel(titulo: string, aniosMin?: number | null): string {
  const nivel = nivelPorTitulo(titulo);
  if (nivel === 'entrada' && aniosMin != null && aniosMin > ANIOS_MAX_ENTRADA) return 'no_especificado';
  return nivel;
}

function nivelPorTitulo(titulo: string): string {
  // "Clinical Research Associate" es el nombre del puesto, no un nivel (también con la errata "Clinial").
  const t = titulo.replace(/clinic?al rese?a?r?ch associate/ig, 'CRA');
  // "All levels": la misma oferta recluta varios niveles.
  if (/(all levels|todos los niveles|todos os n[ií]veis)/i.test(t)) return 'no_especificado';
  if (/(intern\b|internship|trainee|becari|\bbeca\b|est[aá]gi|practicante|pr[aá]cticas?\b|estudiante|pasant|graduate program|jovem aprendiz|aprendiz|programa talento)/i.test(t)) return 'practicas';
  if (/(director|directora|head of|\bhead\b|\bVP\b|vice president|gerente|manager|chief|jefe|jefa|coordinador general)/i.test(t)) return 'gerencia';
  if (/(senior|\bsr\.?\b|s[eê]nior|\blead\b|principal|\bIII\b|\b3\b|experto|especialista s)/i.test(t)) return 'senior';
  // Numeración de escalera: I/1 = entrada, II/2 = intermedio ("CRA II" y "CRA 2" son el mismo nivel).
  if (/(\bII\b|(?:CRA|associate|analyst|specialist|coordinator|ii)\s?2\b|\bCRA2\b)/i.test(t)) return 'intermedio';
  if (/(junior|\bjr\.?\b|j[uú]nior|assistant|asistente|assistente|\bI\b|\bCRA ?1\b|\b1\b|entry|inicial|associate(?! director)|auxiliar|analista)/i.test(t)) return 'entrada';
  return 'no_especificado';
}

export function clasificarModalidad(texto: string | null | undefined): string | null {
  if (!texto) return null;
  if (/remote|remoto|home office|teletrabajo|telecommute/i.test(texto)) return 'remoto';
  if (/hybrid|h[ií]brido/i.test(texto)) return 'hibrido';
  if (/on[- ]?site|office|presencial/i.test(texto)) return 'presencial';
  return null;
}
