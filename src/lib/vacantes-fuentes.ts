/**
 * Fuentes del buscador de vacantes (22 oct 2026).
 *
 * Solo portales oficiales de empleo de cada empresa. Nunca LinkedIn ni agregadores.
 * Todas usan la API pública de Workday (/wday/cxs/...), la misma que consume su
 * página de carreras; el robots.txt de myworkdayjobs.com no la bloquea.
 * Verificadas el 22 oct 2026: todas devolvieron vacantes de LATAM o España.
 *
 * Para agregar una fuente Workday: copia una línea y cambia host, tenant y site
 * (están en la URL de su portal: https://<host>/<site>).
 */

export type TipoEmpresa = 'farma' | 'cro' | 'medtech';

export interface FuenteWorkday {
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

export const FUENTES: FuenteWorkday[] = [
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
];

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
