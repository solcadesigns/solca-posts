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
  empresa: string;
  tipo: TipoEmpresa;
  host: string;
  tenant: string;
  site: string;
}

export const FUENTES: FuenteWorkday[] = [
  { id: 'iqvia', empresa: 'IQVIA', tipo: 'cro', host: 'iqvia.wd1.myworkdayjobs.com', tenant: 'iqvia', site: 'IQVIA' },
  { id: 'icon', empresa: 'ICON', tipo: 'cro', host: 'icon.wd3.myworkdayjobs.com', tenant: 'icon', site: 'broadbean_external' },
  { id: 'fortrea', empresa: 'Fortrea', tipo: 'cro', host: 'fortrea.wd1.myworkdayjobs.com', tenant: 'fortrea', site: 'Fortrea' },
  { id: 'pfizer', empresa: 'Pfizer', tipo: 'farma', host: 'pfizer.wd1.myworkdayjobs.com', tenant: 'pfizer', site: 'PfizerCareers' },
  { id: 'msd', empresa: 'MSD', tipo: 'farma', host: 'msd.wd5.myworkdayjobs.com', tenant: 'msd', site: 'SearchJobs' },
  { id: 'novartis', empresa: 'Novartis', tipo: 'farma', host: 'novartis.wd3.myworkdayjobs.com', tenant: 'novartis', site: 'Novartis_Careers' },
  { id: 'astrazeneca', empresa: 'AstraZeneca', tipo: 'farma', host: 'astrazeneca.wd3.myworkdayjobs.com', tenant: 'astrazeneca', site: 'Careers' },
  { id: 'sanofi', empresa: 'Sanofi', tipo: 'farma', host: 'sanofi.wd3.myworkdayjobs.com', tenant: 'sanofi', site: 'SanofiCareers' },
  { id: 'roche', empresa: 'Roche', tipo: 'farma', host: 'roche.wd3.myworkdayjobs.com', tenant: 'roche', site: 'roche-ext' },
  { id: 'gsk', empresa: 'GSK', tipo: 'farma', host: 'gsk.wd5.myworkdayjobs.com', tenant: 'gsk', site: 'GSKCareers' },
  { id: 'amgen', empresa: 'Amgen', tipo: 'farma', host: 'amgen.wd1.myworkdayjobs.com', tenant: 'amgen', site: 'Careers' },
  { id: 'viatris', empresa: 'Viatris', tipo: 'farma', host: 'viatris.wd5.myworkdayjobs.com', tenant: 'viatris', site: 'External' },
  { id: 'bms', empresa: 'Bristol Myers Squibb', tipo: 'farma', host: 'bristolmyerssquibb.wd5.myworkdayjobs.com', tenant: 'bristolmyerssquibb', site: 'BMS' },
  { id: 'almirall', empresa: 'Almirall', tipo: 'farma', host: 'almirall.wd3.myworkdayjobs.com', tenant: 'almirall', site: 'External' },
  { id: 'medtronic', empresa: 'Medtronic', tipo: 'medtech', host: 'medtronic.wd1.myworkdayjobs.com', tenant: 'medtronic', site: 'MedtronicCareers' },
];

export const PAISES_OBJETIVO = ['mx', 'br', 'ar', 'co', 'cl', 'pe', 'es'] as const;
export type PaisObjetivo = (typeof PAISES_OBJETIVO)[number];

export const PAIS_NOMBRE: Record<PaisObjetivo, string> = {
  mx: 'México', br: 'Brasil', ar: 'Argentina', co: 'Colombia', cl: 'Chile', pe: 'Perú', es: 'España',
};

/**
 * Reconoce el país en textos de ubicación de Workday. Acepta códigos ISO3 ("MEX - …"),
 * nombres en inglés, español y portugués, y las ciudades principales.
 */
const PAIS_RX: Record<PaisObjetivo, RegExp> = {
  mx: /\b(MEX|Mexico|México|Ciudad de M[eé]xico|Guadalajara|Monterrey|Toluca)\b/i,
  br: /\b(BRA|Brazil|Brasil|S[aã]o Paulo|Rio de Janeiro|Curitiba|Campinas)\b/i,
  ar: /\b(ARG|Argentina|Buenos Aires)\b/i,
  co: /\b(COL|Colombia|Bogot[aá]|Medell[ií]n)\b/i,
  cl: /\b(CHL|Chile)\b|\bSantiago,? (de )?Chile\b/i,
  pe: /\b(PER|Peru|Perú|Lima)\b/,
  es: /\b(ESP|Spain|España|Madrid|Barcelona|Valencia|Sevilla|Bilbao)\b/i,
};

export function paisesEnTexto(texto: string | null | undefined): PaisObjetivo[] {
  if (!texto) return [];
  return PAISES_OBJETIVO.filter((p) => PAIS_RX[p].test(texto));
}
