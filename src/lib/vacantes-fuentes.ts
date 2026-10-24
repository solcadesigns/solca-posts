/**
 * Fuentes del buscador de vacantes (22 oct 2026).
 *
 * Solo portales oficiales de empleo de cada empresa. Nunca LinkedIn ni agregadores.
 * Plataformas: Workday (API pública /wday/cxs/, la misma que consume su página de carreras), Jibe, Jobvite
 * y Phenom (página de resultados con datos embebidos y ficha con JSON-LD JobPosting).
 * El lector revisa robots.txt de cada portal en cada corrida y salta la fuente si lo prohíbe.
 * Thermo Fisher / PPD se lee por su portal Phenom: su sitio Workday prohíbe /ThermoFisherCareers/ en robots.txt.
 * Excluidas por robots.txt: Parexel y Takeda (prohíben /search-jobs/), ZS (careers-zs.icims.com) y Accenture (/careers/jobsearch).
 *
 * Para agregar una fuente Workday: copia una línea y cambia host, tenant y site
 * (están en la URL de su portal: https://<host>/<site>).
 */

export type TipoEmpresa = 'farma' | 'cro' | 'medtech' | 'consultoria';

export interface FuenteWorkday {
  plataforma?: 'workday'; // por omisión
  id: string;
  // Fecha en que la fuente entró al buscador. Para tendencias se compara un panel
  // fijo (fuentes con alta anterior al periodo), porque sumar fuentes infla las cifras.
  alta: string;
  empresa: string;
  tipo: TipoEmpresa;
  host: string;
  tenant: string;
  site: string;
}

/**
 * Portales Phenom (search-results + ficha con JSON-LD JobPosting, el estándar de schema.org).
 * `base` es la raíz del idioma del portal, sin diagonal final (ej. https://careers.emdgroup.com/us/en).
 */
export interface FuentePhenom {
  plataforma: 'phenom';
  id: string;
  alta: string;
  empresa: string;
  tipo: TipoEmpresa;
  base: string;
}

/**
 * Portales Jibe (careers.<empresa>.com/api/jobs): JSON público con filtro ?country= y la descripción completa
 * en el listado, así que no hace falta pedir la ficha. `base` es el origen (ej. https://careers.medpace.com).
 */
export interface FuenteJibe {
  plataforma: 'jibe';
  id: string;
  alta: string;
  empresa: string;
  tipo: TipoEmpresa;
  base: string;
}

/** Portales Jobvite (jobs.jobvite.com/<empresa>): lista HTML en una página y ficha con JSON-LD JobPosting. */
export interface FuenteJobvite {
  plataforma: 'jobvite';
  id: string;
  alta: string;
  empresa: string;
  tipo: TipoEmpresa;
  base: string;
}

export type Fuente = FuenteWorkday | FuentePhenom | FuenteJibe | FuenteJobvite;

export const FUENTES: Fuente[] = [
  { id: 'iqvia', alta: '2026-10-22', empresa: 'IQVIA', tipo: 'cro', host: 'iqvia.wd1.myworkdayjobs.com', tenant: 'iqvia', site: 'IQVIA' },
  { id: 'icon', alta: '2026-10-22', empresa: 'ICON', tipo: 'cro', host: 'icon.wd3.myworkdayjobs.com', tenant: 'icon', site: 'broadbean_external' },
  { id: 'fortrea', alta: '2026-10-22', empresa: 'Fortrea', tipo: 'cro', host: 'fortrea.wd1.myworkdayjobs.com', tenant: 'fortrea', site: 'Fortrea' },
  { id: 'pfizer', alta: '2026-10-22', empresa: 'Pfizer', tipo: 'farma', host: 'pfizer.wd1.myworkdayjobs.com', tenant: 'pfizer', site: 'PfizerCareers' },
  { id: 'msd', alta: '2026-10-22', empresa: 'MSD', tipo: 'farma', host: 'msd.wd5.myworkdayjobs.com', tenant: 'msd', site: 'SearchJobs' },
  { id: 'novartis', alta: '2026-10-22', empresa: 'Novartis', tipo: 'farma', host: 'novartis.wd3.myworkdayjobs.com', tenant: 'novartis', site: 'Novartis_Careers' },
  { id: 'astrazeneca', alta: '2026-10-22', empresa: 'AstraZeneca', tipo: 'farma', host: 'astrazeneca.wd3.myworkdayjobs.com', tenant: 'astrazeneca', site: 'Careers' },
  { id: 'sanofi', alta: '2026-10-22', empresa: 'Sanofi', tipo: 'farma', host: 'sanofi.wd3.myworkdayjobs.com', tenant: 'sanofi', site: 'SanofiCareers' },
  { id: 'roche', alta: '2026-10-22', empresa: 'Roche', tipo: 'farma', host: 'roche.wd3.myworkdayjobs.com', tenant: 'roche', site: 'roche-ext' },
  { id: 'gsk', alta: '2026-10-22', empresa: 'GSK', tipo: 'farma', host: 'gsk.wd5.myworkdayjobs.com', tenant: 'gsk', site: 'GSKCareers' },
  { id: 'amgen', alta: '2026-10-22', empresa: 'Amgen', tipo: 'farma', host: 'amgen.wd1.myworkdayjobs.com', tenant: 'amgen', site: 'Careers' },
  { id: 'viatris', alta: '2026-10-22', empresa: 'Viatris', tipo: 'farma', host: 'viatris.wd5.myworkdayjobs.com', tenant: 'viatris', site: 'External' },
  { id: 'bms', alta: '2026-10-22', empresa: 'Bristol Myers Squibb', tipo: 'farma', host: 'bristolmyerssquibb.wd5.myworkdayjobs.com', tenant: 'bristolmyerssquibb', site: 'BMS' },
  { id: 'almirall', alta: '2026-10-22', empresa: 'Almirall', tipo: 'farma', host: 'almirall.wd3.myworkdayjobs.com', tenant: 'almirall', site: 'External' },
  { id: 'medtronic', alta: '2026-10-22', empresa: 'Medtronic', tipo: 'medtech', host: 'medtronic.wd1.myworkdayjobs.com', tenant: 'medtronic', site: 'MedtronicCareers' },
  // 23 oct 2026: Lilly publica en Phenom, pero su postulación y su API son Workday.
  { id: 'lilly', alta: '2026-10-23', empresa: 'Eli Lilly', tipo: 'farma', host: 'lilly.wd115.myworkdayjobs.com', tenant: 'lilly', site: 'LLY' },
  // 23 oct 2026: evaluadas a partir del listado de la herramienta de referencia (ver _docs/VACANTES_BUSCADOR.md).
  { id: 'gilead', alta: '2026-10-23', empresa: 'Gilead', tipo: 'farma', host: 'gilead.wd1.myworkdayjobs.com', tenant: 'gilead', site: 'GileadCareers' },
  { id: 'rovi', alta: '2026-10-23', empresa: 'Rovi', tipo: 'farma', host: 'rovi.wd3.myworkdayjobs.com', tenant: 'rovi', site: 'Rovi_Careers' },
  { id: 'regeneron', alta: '2026-10-23', empresa: 'Regeneron', tipo: 'farma', host: 'regeneron.wd1.myworkdayjobs.com', tenant: 'regeneron', site: 'Careers' },
  { id: 'ipsen', alta: '2026-10-23', empresa: 'Ipsen', tipo: 'farma', host: 'ipsen.wd103.myworkdayjobs.com', tenant: 'ipsen', site: 'Ipsen_Careers' },
  { id: 'lonza', alta: '2026-10-23', empresa: 'Lonza', tipo: 'farma', host: 'lonza.wd3.myworkdayjobs.com', tenant: 'lonza', site: 'Lonza_Careers' },
  { id: 'sartorius', alta: '2026-10-23', empresa: 'Sartorius', tipo: 'medtech', host: 'sartorius.wd3.myworkdayjobs.com', tenant: 'sartorius', site: 'SartoriusCareers' },
  // 24 oct 2026: consultoría de life sciences. Trinity tiene oficina en Ciudad de México.
  // ZS y Accenture quedan fuera: su robots.txt prohíbe la búsqueda (ZS publica en careers-zs.icims.com).
  { id: 'trinity', alta: '2026-10-24', empresa: 'Trinity Life Sciences', tipo: 'consultoria', host: 'trinitylifesciences.wd108.myworkdayjobs.com', tenant: 'trinitylifesciences', site: 'Trinity' },
  // 24 oct 2026: Medpace (CRO, API Jibe; robots pide 5 s entre peticiones) y BioMarin (Jobvite).
  { plataforma: 'jibe', id: 'medpace', alta: '2026-10-24', empresa: 'Medpace', tipo: 'cro', base: 'https://careers.medpace.com' },
  { plataforma: 'jobvite', id: 'biomarin', alta: '2026-10-24', empresa: 'BioMarin', tipo: 'farma', base: 'https://jobs.jobvite.com/biomarin' },
  // Las fuentes Phenom van al final: son las más lentas (una ficha a la vez).
  { plataforma: 'phenom', id: 'merckkgaa', alta: '2026-10-23', empresa: 'Merck KGaA (EMD)', tipo: 'farma', base: 'https://careers.emdgroup.com/us/en' },
  // Thermo Fisher (incluye PPD): su sitio Workday prohíbe la lectura en robots.txt, pero su portal público (Phenom) la permite.
  { plataforma: 'phenom', id: 'thermofisher', alta: '2026-10-23', empresa: 'Thermo Fisher (PPD)', tipo: 'cro', base: 'https://jobs.thermofisher.com/global/en' },
];

/** Nombre del país como lo filtran los portales Phenom (parámetro qcountry). */
export const PAIS_EN: Record<PaisObjetivo, string> = {
  mx: 'Mexico', br: 'Brazil', ar: 'Argentina', co: 'Colombia', cl: 'Chile', pe: 'Peru', es: 'Spain',
};

export const PAISES_OBJETIVO = ['mx', 'br', 'ar', 'co', 'cl', 'pe', 'es'] as const;
export type PaisObjetivo = (typeof PAISES_OBJETIVO)[number];

export const PAIS_NOMBRE: Record<PaisObjetivo, string> = {
  mx: 'México', br: 'Brasil', ar: 'Argentina', co: 'Colombia', cl: 'Chile', pe: 'Perú', es: 'España',
};

/**
 * Reconoce el país en textos de ubicación de Workday. Dos tipos de pista:
 * - códigos ISO3 en mayúsculas al inicio de un segmento ("MEX - Ciudad de México"), sensibles a mayúsculas
 *   para no confundir "Col." (colonia) con Colombia;
 * - nombres de país en inglés, español y portugués, y solo ciudades sin homónimos en otros países
 *   (se excluyen Lima, Valencia, Guadalajara, Santiago, Cali: existen en EE. UU., Venezuela o España).
 * El país principal sale del código ISO del detalle (alpha2Code); esto es para las ubicaciones adicionales.
 */
const PAIS_ISO3: Record<PaisObjetivo, RegExp> = {
  mx: /(^|[|,;]\s*)MEX\b/, br: /(^|[|,;]\s*)BRA\b/, ar: /(^|[|,;]\s*)ARG\b/, co: /(^|[|,;]\s*)COL\b/,
  cl: /(^|[|,;]\s*)CHL\b/, pe: /(^|[|,;]\s*)PER\b/, es: /(^|[|,;]\s*)ESP\b/,
};
const PAIS_NOMBRE_RX: Record<PaisObjetivo, RegExp> = {
  mx: /(?<!new )(?<![\p{L}])(mexico|méxico|ciudad de m[eé]xico|cdmx|monterrey|toluca)(?![\p{L}])/iu,
  br: /(?<![\p{L}])(brazil|brasil|s[aã]o paulo|rio de janeiro|curitiba|campinas)(?![\p{L}])/iu,
  ar: /(?<![\p{L}])(argentina|buenos aires)(?![\p{L}])/iu,
  co: /(?<![\p{L}])(colombia|bogot[aá]|medell[ií]n)(?![\p{L}])/iu,
  cl: /(?<![\p{L}])(chile)(?![\p{L}])/iu,
  pe: /(?<![\p{L}])(peru|perú)(?![\p{L}])/iu,
  es: /(?<![\p{L}])(spain|españa|espanha|madrid|barcelona)(?![\p{L}])/iu,
};

export function paisesEnTexto(texto: string | null | undefined): PaisObjetivo[] {
  if (!texto) return [];
  return PAISES_OBJETIVO.filter((p) => PAIS_ISO3[p].test(texto) || PAIS_NOMBRE_RX[p].test(texto));
}

/**
 * Ubicación que nombra un país fuera de los siete (Dublín, Londres, Varsovia, EE. UU.…).
 * Sirve cuando el portal no da el país de la sede: si la ubicación no nombra otro país y la vacante
 * solo tiene un país objetivo, la sede es ese país ("INSURGENTES" → México, "Recife" → Brasil).
 */
const RX_OTRO_PAIS = /(ireland|dublin|united kingdom|\buk\b|england|london|reading|leeds|maidenhead|watford|germany|frankfurt|berlin|bulgaria|sofia|poland|warsaw|italy|milan|france|paris|portugal|lisbon|lisboa|sweden|stockholm|gothenburg|serbia|belgrade|hungary|budapest|croatia|zagreb|czech|prague|brno|south africa|johannesburg|united states|\busa\b|new jersey|pennsylvania|belgium|brussels|netherlands|amsterdam|switzerland|india|hyderabad|china|canada|mississauga|burlington|romania|bucharest|bucuresti|greece|athens|turkey|israel|japan|australia|latvia|riga|estonia|tartu|kenya|nairobi|costa rica|\bNLD\b)/i;
const RX_US = /(^|[\s,(-])US([\s,)-]|$)/; // mayúsculas: no confundir con "us"
export function ubicacionFueraDeObjetivo(ubicacion: string | null | undefined): boolean {
  return RX_OTRO_PAIS.test(ubicacion ?? '') || RX_US.test(ubicacion ?? '');
}

/** País de la sede cuando el portal no lo da: por texto de la ubicación o, si hay un solo país objetivo, ese. */
export function principalPorUbicacion(ubicacion: string | null | undefined, paises: readonly string[]): PaisObjetivo | null {
  const porTexto = paisesEnTexto(ubicacion)[0];
  if (porTexto) return porTexto;
  if (paises.length === 1 && !ubicacionFueraDeObjetivo(ubicacion)) return paises[0] as PaisObjetivo;
  return null;
}
