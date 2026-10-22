/**
 * Descriptores de cada vacante extraídos del texto de la descripción (22 oct 2026).
 *
 * Reglas, sin IA: cero tokens y reproducible. Como la descripción completa se
 * guarda en D1, se puede volver a extraer todo cuando cambien las reglas
 * (sube DESCRIPTORES_VERSION y corre el worker con modo=descriptores).
 *
 * Sirve para el análisis de contenido (mensual, trimestral, anual): qué piden las
 * vacantes de cada rol y país, y cómo cambia con el tiempo. Ver _docs/VACANTES_BUSCADOR.md.
 */

export const DESCRIPTORES_VERSION = 'd1';

export interface Descriptores {
  idioma_anuncio: 'es' | 'en' | 'pt' | null;
  ingles: 'no_mencionado' | 'mencionado' | 'basico' | 'intermedio' | 'avanzado' | 'nativo';
  grado_min: 'licenciatura' | 'maestria' | 'doctorado' | null; // el más bajo que la vacante acepta
  anios_min: number | null;
  contrato: 'temporal' | 'freelance' | 'practicas' | null; // null = no lo dice (casi siempre indefinido)
  sponsor_dedicado: boolean;
  inclusion: boolean;
  etiquetas: Array<{ tipo: 'idioma' | 'grado' | 'area_terapeutica' | 'herramienta'; valor: string }>;
}

function cuenta(texto: string, palabras: string[]): number {
  let n = 0;
  for (const p of palabras) {
    const m = texto.match(new RegExp(`\\b${p}\\b`, 'gi'));
    if (m) n += m.length;
  }
  return n;
}

function idiomaAnuncio(t: string): Descriptores['idioma_anuncio'] {
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

function nivelIngles(t: string): Descriptores['ingles'] {
  if (!RX_INGLES.test(t)) return 'no_mencionado';
  // Ventana de texto alrededor de cada mención del idioma.
  const ventanas: string[] = [];
  const rx = /(english|ingl[eé]s|ingl[eê]s)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(t))) ventanas.push(t.slice(Math.max(0, m.index - 80), m.index + 80));
  const v = ventanas.join(' ');
  if (/(native|nativo|bilingual|biling[uü]e|mother tongue)/i.test(v)) return 'nativo';
  if (/(\bC1\b|\bC2\b|fluent|fluency|fluid|fluido|fluente|advanced|avanzado|avan[cç]ado|proficien|excellent|excelente|full professional|strong|high level|alto nivel|n[ií]vel alto)/i.test(v)) return 'avanzado';
  if (/(\bB2\b|\bB1\b|intermedi|good command|buen nivel|bom n[ií]vel|conversational|conversacional|working knowledge)/i.test(v)) return 'intermedio';
  if (/(\bA2\b|\bA1\b|b[aá]sico|basic)/i.test(v)) return 'basico';
  return 'mencionado';
}

const IDIOMAS: Array<[string, RegExp]> = [
  ['portugues', /(portuguese|portugu[eé]s|portugu[eê]s)/i],
  ['espanol', /(spanish|espa[nñ]ol|espanhol|castellano)/i],
  ['aleman', /(german\b|alem[aá]n|alem[aã]o)/i],
  ['frances', /(french\b|franc[eé]s|franc[eê]s)/i],
  ['italiano', /(italian\b|italiano)/i],
];

const GRADOS: Array<[string, RegExp]> = [
  ['licenciatura', /(bachelor|\bBSc?\b|\bB\.S\.|licenciatura|gradua[cç][aã]o|graduado|grado universitario|t[ií]tulo universitario|degree in|university degree|ensino superior|carrera (profesional|universitaria)|ingenier[ií]a en|qu[ií]mico farmac)/i],
  ['maestria', /(master|\bMSc?\b|\bM\.S\.|maestr[ií]a|mestrado|m[aá]ster|\bMBA\b|posgrado|p[oó]s-gradua|postgraduate)/i],
  ['doctorado', /(\bPh\.?\s?D\b|doctorate|doctoral degree|doctorado|doutorado|\bMD\b|medical degree|m[eé]dico cirujano|\bPharmD\b)/i],
];

const AREAS: Array<[string, RegExp]> = [
  ['oncologia', /(oncolog|cancer|c[aá]ncer|c[aâ]ncer|tumor|hemato-?onc)/i],
  ['hematologia', /(hematolog|hemophilia|hemofilia)/i],
  ['inmunologia', /(immunolog|inmunolog|imunolog|autoimmune|autoinmun|rheumat|reumat|\bIMM\b|inflammat|inflamat)/i],
  ['cardiovascular', /(cardio|vascular|heart failure|hipertensi|atherosclero)/i],
  ['metabolismo', /(diabet|obesit|obesidad|metabol|endocrin)/i],
  ['neurociencias', /(neuro|psychiatr|psiquiatr|alzheimer|parkinson|multiple sclerosis|esclerosis m|epilep)/i],
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

export function extraerDescriptores(descripcion: string | null | undefined, titulo = ''): Descriptores {
  // Normaliza entidades HTML que a veces vienen en el texto ("5&#43; years").
  const t = `${titulo}\n${descripcion ?? ''}`.replace(/&#43;/g, '+').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
  const etiquetas: Descriptores['etiquetas'] = [];

  for (const [v, rx] of IDIOMAS) if (rx.test(t)) etiquetas.push({ tipo: 'idioma', valor: v });
  const ingles = nivelIngles(t);
  if (ingles !== 'no_mencionado') etiquetas.push({ tipo: 'idioma', valor: 'ingles' });

  const grados = GRADOS.filter(([, rx]) => rx.test(t)).map(([g]) => g);
  for (const g of grados) etiquetas.push({ tipo: 'grado', valor: g });
  const orden = ['licenciatura', 'maestria', 'doctorado'];
  const grado_min = (orden.find((g) => grados.includes(g)) ?? null) as Descriptores['grado_min'];

  for (const [a, rx] of AREAS) if (rx.test(t)) etiquetas.push({ tipo: 'area_terapeutica', valor: a });
  for (const [h, rx] of HERRAMIENTAS) if (rx.test(t)) etiquetas.push({ tipo: 'herramienta', valor: h });

  // Años de experiencia: el mínimo que se menciona ("3+ years", "mínimo 2 años", "2 a 4 anos").
  let anios_min: number | null = null;
  const rxAnios = /(\d{1,2})\s*(?:\+|-|–|\/|a|to|ou|o)?\s*(?:\d{1,2}\s*)?(?:\+\s*)?(?:years?|yrs?|años|anos)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = rxAnios.exec(t))) {
    const n = Number.parseInt(m[1], 10);
    // La palabra "experiencia" tiene que estar cerca del número (antes o después),
    // para no contar frases como "lanzó un producto en los últimos 5 años".
    // Solo dentro de la misma frase: se corta en punto, viñeta o salto de línea.
    const antes = t.slice(Math.max(0, m.index - 40), m.index).split(/[.•\n]/).pop() ?? '';
    const despues = t.slice(m.index, m.index + m[0].length + 45).split(/[.•\n]/)[0];
    const ctx = antes + despues;
    if (n > 0 && n <= 25 && /(experien|exp\.|trabaj|work|atua)/i.test(ctx)) anios_min = anios_min === null ? n : Math.min(anios_min, n);
  }

  let contrato: Descriptores['contrato'] = null;
  if (/(intern\b|internship|trainee|becari|est[aá]gi|practicante|pasant|aprendiz|graduate program)/i.test(titulo)) contrato = 'practicas';
  else if (/(freelance|independent contractor|contratista independiente|aut[oô]nomo)/i.test(t)) contrato = 'freelance';
  else if (/(temporary|temporal|tempor[aá]rio|fixed[- ]term|contrato por tiempo determinado|maternity cover|sustituci[oó]n|interinidad)/i.test(t)) contrato = 'temporal';

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
