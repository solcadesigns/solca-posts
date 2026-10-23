/**
 * Descriptores de cada vacante extraídos del texto de la descripción (22 oct 2026).
 *
 * Reglas, sin IA: cero tokens y reproducible. Como la descripción completa se
 * guarda en D1, se puede volver a extraer todo cuando cambien las reglas
 * (sube DESCRIPTORES_VERSION y corre el worker con modo=reprocesar).
 *
 * Sirve para el análisis de contenido (mensual, trimestral, anual): qué piden las
 * vacantes de cada rol y país, y cómo cambia con el tiempo. Ver _docs/VACANTES_BUSCADOR.md.
 */

export const DESCRIPTORES_VERSION = 'd3';

export interface Descriptores {
  idioma_anuncio: 'es' | 'en' | 'pt' | null;
  ingles: 'no_mencionado' | 'mencionado' | 'basico' | 'intermedio' | 'avanzado' | 'nativo';
  grado_min: 'licenciatura' | 'maestria' | 'doctorado' | null; // el más bajo que la vacante acepta
  anios_min: number | null;
  contrato: 'temporal' | 'freelance' | 'practicas' | null; // null = no lo dice (casi siempre indefinido)
  sponsor_dedicado: boolean;
  inclusion: boolean;
  etiquetas: Array<{ tipo: 'idioma' | 'grado' | 'grado_deseable' | 'area_terapeutica' | 'herramienta'; valor: string }>;
}

function cuenta(texto: string, palabras: string[]): number {
  let n = 0;
  for (const p of palabras) {
    const m = texto.match(new RegExp(`\\b${p}\\b`, 'gi'));
    if (m) n += m.length;
  }
  return n;
}

function idiomaAnuncio(textoCompleto: string): Descriptores['idioma_anuncio'] {
  // Solo el primer 60 %: el texto institucional de la empresa suele ir al final y casi siempre en inglés.
  const t = textoCompleto.slice(0, Math.max(400, Math.floor(textoCompleto.length * 0.6)));
  const es = cuenta(t, ['el', 'los', 'las', 'para', 'con', 'una', 'experiencia', 'del', 'que']);
  const pt = cuenta(t, ['não', 'para', 'com', 'uma', 'experiência', 'você', 'dos', 'das', 'em']);
  const en = cuenta(t, ['the', 'and', 'with', 'you', 'experience', 'of', 'to', 'for']);
  const max = Math.max(es, pt, en);
  if (max < 5) return null;
  if (max === en) return 'en';
  // "para" está en ambas listas; desempata con marcas propias del portugués.
  if (/\b(você|não|experiência|conhecimento|vaga)\b/i.test(t) && pt >= es * 0.8) return 'pt';
  return max === pt ? 'pt' : 'es';
}

const RX_INGLES = /(english|ingl[eé]s|ingl[eê]s)/i;

const OTRO_IDIOMA = /(spanish|espa[nñ]ol|espanhol|castellano|portugu[eéê]s|portuguese|french|franc[eéê]s|german|alem[aã]n|alem[aá]o|italian|italiano|mandarin|korean|japanese|estonian|local (office )?language|idioma local)/gi;
const N_NATIVO = /(native|nativo|bilingual|biling[uü]e|mother tongue)/i;
const N_AVANZADO = /(\bC1\b|\bC2\b|fluent|fluency|fluid|fluido|fluente|advanced?|avanzado|avan[cç]ado|proficien|excellent|excelente|full professional|professional|strong|dominio|dom[ií]nio|high level|\balto\b|alto nivel|n[ií]vel alto|business english|excellent command|command of)/i;
const N_INTERMEDIO = /(\bB2\b|\bB1\b|intermedi|good command|good level|buen nivel|bom n[ií]vel|conversational|conversacional|working knowledge)/i;
const N_BASICO = /(\bA2\b|\bA1\b|b[aá]sico|basic)/i;

function nivelEn(texto: string): Descriptores['ingles'] | null {
  if (N_NATIVO.test(texto)) return 'nativo';
  if (N_AVANZADO.test(texto)) return 'avanzado';
  if (N_INTERMEDIO.test(texto)) return 'intermedio';
  if (N_BASICO.test(texto)) return 'basico';
  return null;
}

/**
 * Nivel de inglés. Primero busca el nivel pegado a la palabra (desde el idioma anterior, si lo hay,
 * hasta el fin de la frase): "native Spanish and fluent English" → avanzado. Si ahí no hay nivel,
 * acepta un nivel compartido antes de la lista de idiomas: "Fluency in Spanish and English" → avanzado.
 */
function nivelIngles(t: string): Descriptores['ingles'] {
  if (!RX_INGLES.test(t)) return 'no_mencionado';
  const rx = /(english|ingl[eé]s|ingl[eê]s)/gi;
  let mejor: Descriptores['ingles'] | null = null;
  const rango = { nativo: 4, avanzado: 3, intermedio: 2, basico: 1 } as Record<string, number>;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(t))) {
    const antesFull = t.slice(Math.max(0, m.index - 60), m.index).split(/[.•\n;]/).pop() ?? '';
    const despues = t.slice(m.index, m.index + m[0].length + 70).split(/[.•\n]/)[0];
    // Tramo inmediato: después del último idioma distinto que aparezca antes.
    let corte = -1;
    for (const o of antesFull.matchAll(OTRO_IDIOMA)) corte = (o.index ?? 0) + o[0].length;
    const inmediato = (corte >= 0 ? antesFull.slice(corte) : antesFull) + despues;
    // "CVs must be submitted in English" no es requisito de idioma.
    if (/(submit|submitted|enviar|send your (cv|resume)|cv in|resume in)/i.test(inmediato) && !nivelEn(inmediato)) continue;
    // Si el tramo distingue obligatorio y deseable ("Basic (mandatory) / Fluent (desirable)"), cuenta el obligatorio.
    const sinDeseable = inmediato.replace(/[^/;]*\b(desirable|deseable|desej[aá]vel|preferred|preferible|plus|nice to have|diferencial)\b[^/;]*/gi, ' ');
    let nivel = nivelEn(sinDeseable) ?? nivelEn(inmediato);
    if (!nivel && corte >= 0) {
      // Nivel compartido antes de la lista ("Excellent command of Spanish and English").
      const previo = antesFull.slice(0, antesFull.search(OTRO_IDIOMA));
      nivel = nivelEn(previo);
    }
    if (nivel && (!mejor || rango[nivel] > rango[mejor])) mejor = nivel;
  }
  if (!mejor) {
    // Todas las menciones eran "envía tu CV en inglés": no hay requisito.
    const soloEnvio = [...t.matchAll(/(english|ingl[eé]s|ingl[eê]s)/gi)].every((x) =>
      /(submit|submitted|enviar|send your|cv in|resume in)/i.test(t.slice(Math.max(0, (x.index ?? 0) - 40), (x.index ?? 0) + 10)),
    );
    return soloEnvio ? 'no_mencionado' : 'mencionado';
  }
  return mejor;
}

const IDIOMAS: Array<[string, RegExp]> = [
  ['portugues', /(portuguese|portugu[eé]s|portugu[eê]s)/i],
  ['espanol', /(spanish|espa[nñ]ol|espanhol|castellano)/i],
  ['aleman', /(german\b|alem[aá]n|alem[aã]o)/i],
  ['frances', /(french\b|franc[eé]s|franc[eê]s)/i],
  ['italiano', /(italian\b|italiano)/i],
];

const GRADOS: Array<[string, RegExp]> = [
  ['licenciatura', /(bachelor|\bBSc?\b|\bB\.S\.|licenciatura|gradua[cç][aã]o|graduado|grado universitario|t[ií]tulo universitario|t[ií]tulo profesional|profesional en|college degree|(?<!(master'?s?|doctoral|advanced|graduate) )degree in|university degree|ensino superior|carrera (profesional|universitaria)|ingenier[ií]a en|qu[ií]mico farmac)/i],
  // Sin "MS" suelto (MS Office) ni "master" suelto (Scrum Master, master data).
  ['maestria', /(master'?s|master of|masters? degree|\bM\.?Sc\b|\bM\.S\.|maestr[ií]a|mestrado|m[aá]ster (en|in|universitario)|\bMBA\b|posgrado|p[oó]s-gradua|postgraduate)/i],
  ['doctorado', /(\bPh\.?\s?D\b|doctorate|doctoral degree|doctorado|doutorado|\bPharmD\b)/i],
  // Medicina (MD, médico cirujano) es licenciatura en LATAM: etiqueta aparte, no cuenta como doctorado.
  ['medicina', /(\bMD\b|\bM\.D\.|medical degree|m[eé]dico cirujano|t[ií]tulo de m[eé]dico|degree in medicine|m[eé]dico titulado|licenciatura en medicina)/i],
];

const AREAS: Array<[string, RegExp]> = [
  ['oncologia', /(oncolog|cancer|c[aá]ncer|c[aâ]ncer|tumor|hemato-?onc)/i],
  ['hematologia', /(hematolog|hemophilia|hemofilia)/i],
  ['inmunologia', /(immunolog|inmunolog|imunolog|autoimmune|autoinmun|rheumat|reumat|\bIMM\b|inflammat|inflamat)/i],
  ['cardiovascular', /(cardio|vascular|heart failure|hipertensi|atherosclero)/i],
  ['metabolismo', /(diabet|obesit|obesidad|metabol|endocrin)/i],
  ['neurociencias', /(\bCNS\b|neuro|psychiatr|psiquiatr|alzheimer|parkinson|multiple sclerosis|esclerosis m|epilep)/i],
  ['infecciosas_vacunas', /(vaccin|vacuna|vacina|infectious|infecciosa|infecciosa|\bHIV\b|\bVIH\b|antibiot|antiviral)/i],
  ['respiratorio', /(respirat|pulmon|\bCOPD\b|\bEPOC\b|asthma|asma)/i],
  ['enfermedades_raras', /(rare disease|enfermedades raras|doen[cç]as raras|orphan|hu[eé]rfan)/i],
  ['dermatologia', /(dermatolog|psoriasis|psor[ií]ase|atopic)/i],
  ['nefrologia', /(nephrolog|nefrolog|renal|kidney|ri[nñ][oó]n)/i],
  ['oftalmologia', /(ophthalm|oftalmolog|retina)/i],
  ['salud_mujer', /(women'?s health|salud de la mujer|sa[uú]de da mulher|ginecolog|gynecolog|fertil)/i],
  ['terapia_celular_genica', /(cell (and|&) gene|cell therapy|gene therapy|terapia (celular|g[eé]nica)|\bCAR-?T\b)/i],
];

const HERRAMIENTAS: Array<[string, RegExp]> = [
  ['gcp_ich', /(\bGCP\b|good clinical practice|buenas pr[aá]cticas cl[ií]nicas|\bICH\b|\bBPC\b)/i],
  ['gmp', /(\bGMP\b|good manufacturing|buenas pr[aá]cticas de manufactura|\bBPF\b)/i],
  ['sas', /\bSAS\b/],
  ['r', /\bR (programming|language|studio)|\bRStudio\b|\bR\/|, R,|\bR and Python\b/],
  ['python', /\bpython\b/i],
  ['sql', /\bSQL\b/],
  ['power_bi', /power ?bi/i],
  ['tableau', /\btableau\b/i],
  ['excel', /\bexcel\b/i],
  ['veeva', /\bveeva\b/i],
  ['medidata', /(medidata|\bRave\b)/i],
  ['salesforce', /salesforce/i],
  ['sap', /\bSAP\b/],
  ['argus_safety', /\bargus\b/i],
  ['meddra', /meddra/i],
  ['ctms', /\bCTMS\b/],
  ['edc', /\bEDC\b/],
];

const NUM_LETRA: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  um: 1, 'três': 3, quatro: 4, sete: 7, oito: 8, nove: 9, dez: 10,
};

export function extraerDescriptores(descripcion: string | null | undefined, titulo = ''): Descriptores {
  // Normaliza entidades HTML que a veces vienen en el texto ("5&#43; years").
  const t = `${titulo}\n${descripcion ?? ''}`.replace(/&#43;/g, '+').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
  const etiquetas: Descriptores['etiquetas'] = [];

  for (const [v, rx] of IDIOMAS) if (rx.test(t)) etiquetas.push({ tipo: 'idioma', valor: v });
  const ingles = nivelIngles(t);
  if (ingles !== 'no_mencionado') etiquetas.push({ tipo: 'idioma', valor: 'ingles' });

  // Un grado "deseable" o "preferido" no es requisito: va como etiqueta aparte y no cuenta para el mínimo.
  const RX_DESEABLE = /(preferred|preferable|desirable|deseable|desej[aá]vel|diferencial|a plus|is a plus|nice to have|valorable|valorad[oa])/i;
  const grados: string[] = [];
  for (const [g, rx] of GRADOS) {
    const rxg = new RegExp(rx.source, 'gi');
    let requerido = false;
    let deseable = false;
    for (const mm of t.matchAll(rxg)) {
      const i = mm.index ?? 0;
      const ctx = t.slice(Math.max(0, i - 40), i + mm[0].length + 50).split(/[.•\n;]/).find((x) => x.includes(mm[0])) ?? '';
      if (RX_DESEABLE.test(ctx)) deseable = true;
      else requerido = true;
    }
    if (requerido) {
      grados.push(g);
      etiquetas.push({ tipo: 'grado', valor: g });
    } else if (deseable) {
      etiquetas.push({ tipo: 'grado_deseable', valor: g });
    }
  }
  // Medicina cuenta como licenciatura para el mínimo.
  const orden = ['licenciatura', 'maestria', 'doctorado'];
  const grado_min = (orden.find((g) => grados.includes(g) || (g === 'licenciatura' && grados.includes('medicina'))) ?? null) as Descriptores['grado_min'];

  // Áreas: si el texto nombra 4 o más, casi siempre es el párrafo institucional de la empresa
  // ("trabajamos en oncología, vacunas, inmunología…"). En ese caso solo cuentan las que aparecen
  // en el título o que se mencionan al menos 2 veces.
  const areas = AREAS.filter(([, rx]) => rx.test(t));
  const confiables = areas.length >= 4
    ? areas.filter(([, rx]) => rx.test(titulo) || (t.match(new RegExp(rx.source, 'gi'))?.length ?? 0) >= 2)
    : areas;
  for (const [a] of confiables) etiquetas.push({ tipo: 'area_terapeutica', valor: a });
  for (const [h, rx] of HERRAMIENTAS) {
    if (!rx.test(t)) continue;
    // "GCP" junto a nubes es Google Cloud Platform, no Buenas Prácticas Clínicas.
    if (h === 'gcp_ich' && !/(good clinical practice|buenas pr[aá]cticas cl[ií]nicas|\bICH\b|\bBPC\b)/i.test(t) && /(google cloud|\bAWS\b|azure|cloud)/i.test(t)) continue;
    etiquetas.push({ tipo: 'herramienta', valor: h });
  }

  // Años de experiencia: el mínimo que se menciona ("3+ years", "mínimo 2 años", "2 a 4 anos").
  let anios_min: number | null = null;
  const tn = t.replace(new RegExp(`\\b(${Object.keys(NUM_LETRA).join('|')})\\b`, 'gi'), (w) => String(NUM_LETRA[w.toLowerCase()]));
  const rxAnios = /(?<!\d)(\d{1,2})(?!\d)\s*(?:\+|-|–|\/|a|to|ou|o|y|e|and)?\s*(?:\d{1,2}\s*)?(?:\+\s*)?(?:years?|yrs?|años?|anos?)(?![\p{L}])/giu;
  let m: RegExpExecArray | null;
  while ((m = rxAnios.exec(tn))) {
    const t2 = tn;
    const n = Number.parseInt(m[1], 10);
    // La palabra "experiencia" tiene que estar cerca del número (antes o después),
    // para no contar frases como "lanzó un producto en los últimos 5 años".
    // Solo dentro de la misma frase: se corta en punto, viñeta o salto de línea.
    // La línea anterior también cuenta ("Experience:\n• Minimum of 3 years").
    const antes = t2.slice(Math.max(0, m.index - 60), m.index).split(/\.(?:\s|$)/).pop() ?? '';
    const despues = t2.slice(m.index, m.index + m[0].length + 45).split(/[.•\n]/)[0];
    const ctx = antes + despues;
    if (/(edad|\bage\b|idade)/i.test(antes)) continue; // "edad de 25 a 40 años"
    // Requisitos secundarios ("2 years managerial", "de los cuales 2 en liderazgo") no son el mínimo del puesto.
    const mismaClausula = despues.split(/[,;(]/)[0] + antes.split(/[,;]/).pop()!.slice(-25);
    if (/(manag|leadership|liderazgo|lideran[cç]a|supervis|people lead|of which|de los cuales|dos quais|in a lead)/i.test(mismaClausula)) continue;
    if (n > 0 && n <= 25 && /(experien|exp\.|trabaj|work|atua)/i.test(ctx)) anios_min = anios_min === null ? n : Math.min(anios_min, n);
  }

  let contrato: Descriptores['contrato'] = null;
  if (/(intern\b|internship|trainee|becari|\bbeca\b|est[aá]gi|practicante|pasant|aprendiz|graduate program|programa talento)/i.test(titulo)) contrato = 'practicas';
  else if (/(freelance|independent contractor|contratista independiente)/i.test(t)) contrato = 'freelance';
  else if (
    /(temporary|temporal\b|tempor[aá]rio|fixed[- ]term|maternity cover|interinidad)/i.test(titulo) ||
    /(fixed[- ]term|temporary (role|position|assignment|contract|basis)|contrato (temporal|por tiempo determinado|de duraci[oó]n determinada)|vaga tempor[aá]ria|contrato tempor[aá]rio|maternity cover|cobertura de (baja|licencia)|interinidad)/i.test(t)
  ) contrato = 'temporal';

  return {
    idioma_anuncio: idiomaAnuncio(t),
    ingles,
    grado_min,
    anios_min,
    contrato,
    sponsor_dedicado: /(sponsor[- ]dedicated|single[- ]sponsor|\bFSP\b)/i.test(t),
    inclusion: /(\bPcD\b|discapacidad|defici[eê]ncia|disabilit|inclusiv|afirmativ|diversidad|diversidade)/i.test(titulo),
    etiquetas,
  };
}
