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

export const CLASIFICACION_VERSION = 'r6';

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
  { id: 'calidad_manufactura', label: 'Calidad y manufactura' },
  { id: 'comercial_marketing', label: 'Marketing y comercial' },
  { id: 'datos_ti', label: 'Datos, estadística y TI' },
  { id: 'corporativo', label: 'Finanzas, RH, legal y administración' },
  { id: 'otro', label: 'Otras áreas' },
];

// El orden importa: gana la primera regla que coincide.
const ROL_REGLAS: Array<[string, RegExp]> = [
  ['msl', /\b(MSL|medical science liai?son|medical scientific liaison|enlace cient[ií]fico|liaison m[eé]dic)/i],
  ['laboratorio_rd', /(non[- ]?clinical|toxicolog|qu[ií]mico analista|microbiolog|technologist|discovery|scientific portfolio|principal investigator)/i],
  ['farmacovigilancia', /(medical safety|safety program|clinical trial safety|pharmacovigilance|farmacovigil[aâ]ncia|farmacovigilancia|drug safety|patient safety|safety (specialist|scientist|physician|associate|case|data|project|lead|manager|reporting)|\bPV\b|\bICSR)/i],
  ['regulatorio', /(reg\.? affairs|regulatory|regulat[oó]ri|asuntos regulatorios|assuntos regulat|registro sanitario|registros sanitarios|\bRA (specialist|associate|manager|lead))/i],
  ['heor_analytics', /(strategic access|access (strategy|field|manager)|field access|acceso y valor|health technology assessment|\bHTA\b|epidemiolog|licitaci|licita[cç]|tender|inteligencia de mercado|intelig[eê]ncia de mercado|market research|primary research|HEOR|health economic|econom[ií]a de la salud|market access|acceso al mercado|acesso ao mercado|\bRWE\b|real[- ]world|outcomes research|pricing|reimbursement|value (and|&) access)/i],
  ['datos_ti', /(\bAI\b|artificial intelligence|digital|architect|tech(nical)? lead|\bERP\b|\bMES\b|scrum|agile|website|IIoT|clinical coding|product owner|information security|\bDDIT\b|\bRDT\b|\bIT\b|workday|informatics|system designer|data scien|data engineer|software|developer|desarrollador|programmer|programador|\bSAS\b|medical coding|statistic|estad[ií]stic|cloud|cyber)/i],
  ['clinical_pm', /(clinical project|local trial manager|global trial manager|trial delivery manager|clinical team lead|team lead - project manager|clinical project manager|clinical trial manager|\bCTM\b|study manager|global study (lead|associate director|director)|trial clinical delivery|gerente de proyectos? cl[ií]nic|project manager.*(clinical|study|trial)|(clinical|study|trial|biosampling).*project manager|gestor de projetos? cl[ií]nic)/i],
  ['investigacion_clinica', /(study process|\bCRA ?\d?\b|start[- ]?up (specialist|associate)|startup associate|set[- ]?up specialist|site navigator|site enrollment|clin\. operations|centralized monitoring|clinical monitoring|adjudication|(psych|independent) rater|clinical trial finance|contracts? (and budget|negotiat|spec|analyst)|remote monitoring|clinical outcome|\bDCT\b|estudios cl[ií]nicos|global study associate|clinical rese?a?r?ch|investigaci[oó]n cl[ií]nica|pesquisa cl[ií]nica|investiga[cç][aã]o cl[ií]nica|monitor (cl[ií]nico|de ensayos|de estudos)|central monitor|\bsite (manager|management|monitor|activation|contracts?|payments?|specialist|engagement|identification)|feasibility|informed consent|investigator payments?|grants (specialist|analyst)|study (start[- ]up|coordinator|support|team)|patient recruitment|\bTMF\b|\bRBQM\b|\bCRC\b|clinical trial (assistant|associate|coordinator)|\bCTA\b|clinical operations|operaciones cl[ií]nicas|opera[cç][oõ]es cl[ií]nicas|in-house clinical|trial vendor)/i],
  ['medical_affairs', /(clinical (science|development)|medical (strategy|contact|ecosystem|education|representative)|healthcare ecosystem|opera[cç][oõ]es m[eé]dicas|eventos m[eé]dicos|medical (advisor|affairs|manager|lead|director|information|writer|writing|scientist|excellence|doctor|spain|mexico|m[eé]xico)|director medical|scientific affairs|physician|asesor m[eé]dico|gerente m[eé]dico|director m[eé]dico|assessor m[eé]dico|redactor m[eé]dico|clinical scientist)/i],
  // "Consultor de ventas" es un puesto comercial, no consultoría.
  ['ventas', /consultor[a]? (de ventas|comercial|de vendas)/i],
  ['consulting', /(consultant|consultor|consultoria|consultoría|consulting|advisory)/i],
  ['laboratorio_rd', /(scientist|cient[ií]fico|research (associate|scientist)|R&D|I\+D|P&D|laborator|bioanal|formulat|analista de laborat)/i],
  ['ventas', /(delegad|delega@|agente de propaganda|promoci[oó]n m[eé]dica|visita m[eé]dica|\bAPM\b|\bKAE\b|ejecutivo de cuenta|account manager|gerente (distrital|de distrito|de cuentas|de area|de área)|area manager|business unit (director|manager)|biopharmaceutical rep|therapeutic area specialist|disease area specialist|professional relations|assessor t[eé]cnico|field application|mapping specialist|market development|product specialist|clinical selling|especialista cl[ií]nico|promotor|sell out|nutriasesor|\brep\b|sales|ventas|vendas|representante (m[eé]dico|de ventas|comercial|de salud|en salud)|heal?th representative|visitador|propagandista|key account|\bKAM\b|territory)/i],
  ['calidad_manufactura', /(\bGCP\b|operador|operator|maintenance|mantenimiento|\bMTTO\b|manuten[cç][aã]o|embalagem|packaging|procurement|buyer|compras|deviation writer|reliability|\bEHS\b|\bHSE\b|quality|calidad|qualidade|\bQA\b|\bQC\b|\bGMP\b|validation|validaci[oó]n|valida[cç][aã]o|manufactur|producci[oó]n|produ[cç][aã]o|production|supply|cadena de suministro|log[ií]stic|warehouse|almac[eé]n)/i],
  ['comercial_marketing', /(gerente de producto|business development|launch excellence|new product planning|forecasting|jornada do paciente|programa de soporte|soluciones pacientes|\bPSP\b|marketing|brand|product manager|commercial|comercial|customer (engagement|experience)|\bCRM\b|omnichannel|market insights|franchise)/i],
  ['datos_ti', /(data|datos|dados|analytics|engineer|ingenier)/i],
  ['corporativo', /(financ|accountant|accounting|contab|contralor|controlling|\btax\b|treasury|credit and collection|audit|legal|counsel|compliance|\bHR\b|human resources|recursos humanos|departamento pessoal|talent|recruit|people|payroll|folha de pagamento|compensation|rewards|administrativ|executive assistant|facilities|public affairs|corporate (affairs|communications)|relações governamentais|relaciones gubernamentales|customer (care|service)|call center)/i],
];

/**
 * En una CRO, "Project Manager" a secas es casi siempre gestión de estudios clínicos.
 * Fuera de las CRO se deja como 'otro' porque puede ser de cualquier área.
 */
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
  { id: 'senior', label: 'Senior / especialista' },
  { id: 'gerencia', label: 'Gerencia y dirección' },
  { id: 'no_especificado', label: 'Sin nivel en el título' },
];

export function clasificarNivel(titulo: string): string {
  // "Clinical Research Associate" es el nombre del puesto, no un nivel.
  const t = titulo.replace(/clinical rese?a?r?ch associate/ig, 'CRA');
  if (/(intern\b|internship|trainee|becari|est[aá]gi|practicante|pr[aá]cticas?\b|estudiante|pasant|graduate program|jovem aprendiz|aprendiz)/i.test(t)) return 'practicas';
  if (/(director|directora|head of|\bhead\b|\bVP\b|vice president|gerente|manager|chief|jefe|jefa|coordinador general)/i.test(t)) return 'gerencia';
  if (/(senior|\bsr\.?\b|s[eê]nior|\blead\b|principal|\bIII\b|\bII\b|experto|especialista s)/i.test(t)) return 'senior';
  if (/(junior|\bjr\.?\b|j[uú]nior|assistant|asistente|assistente|\bI\b|entry|associate(?! director)|auxiliar|analista)/i.test(t)) return 'entrada';
  return 'no_especificado';
}

export function clasificarModalidad(texto: string | null | undefined): string | null {
  if (!texto) return null;
  if (/remote|remoto|home office|teletrabajo/i.test(texto)) return 'remoto';
  if (/hybrid|h[ií]brido/i.test(texto)) return 'hibrido';
  if (/on[- ]?site|office|presencial/i.test(texto)) return 'presencial';
  return null;
}
