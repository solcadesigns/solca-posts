/**
 * UTM tracking helpers · P1 sprint 2026-08-18.
 *
 * Objetivo: capturar los parámetros UTM cuando el visitante aterriza en
 * solcaciencia.com desde una campaña (LinkedIn post, newsletter, etc.),
 * persistirlos en el navegador, y adjuntarlos a los POST del funnel
 * (quiz-subscribe, cv-review) para atribución downstream en weekly-report.
 *
 * Convención: usamos los 5 UTMs estándar de Google Analytics.
 *   utm_source   → plataforma (linkedin, newsletter, hotmart)
 *   utm_medium   → tipo de contenido (post, carousel, teaser, email)
 *   utm_campaign → identificador de la campaña (sept-w1-teaser)
 *   utm_content  → variante A/B (title-a, cta-b)
 *   utm_term     → keyword (usualmente vacío en LinkedIn)
 *
 * Protecciones:
 *   - Allow-list de keys → nunca aceptamos claves fuera de UTM_KEYS.
 *   - Longitud máxima 200 chars por valor → previene bombing del KV.
 *   - Sanitización básica → lowercase, trim, sin caracteres de control.
 */

export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

export type UtmKey = typeof UTM_KEYS[number];
export type UtmRecord = Partial<Record<UtmKey, string>>;

const MAX_UTM_LEN = 200;

/**
 * Sanitiza un valor UTM antes de persistirlo.
 * - Trim + lowercase.
 * - Recorta a 200 chars.
 * - Elimina caracteres de control y saltos de línea.
 * - Devuelve undefined si el valor queda vacío después de sanitizar.
 */
export function sanitizeUtmValue(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw
    .trim()
    .toLowerCase()
    // Elimina control chars, tabs, saltos de linea
    .replace(/[\x00-\x1f\x7f]/g, '')
    .slice(0, MAX_UTM_LEN);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Extrae UTMs válidos de un objeto arbitrario (típicamente el body de un POST).
 * Solo acepta claves del allow-list UTM_KEYS. Ignora todo lo demás.
 */
export function extractUtms(source: Record<string, unknown> | null | undefined): UtmRecord {
  if (!source || typeof source !== 'object') return {};
  const out: UtmRecord = {};
  for (const key of UTM_KEYS) {
    const sanitized = sanitizeUtmValue(source[key]);
    if (sanitized) out[key] = sanitized;
  }
  return out;
}

/**
 * Extrae UTMs de un URLSearchParams (útil para parsear window.location.search
 * o referrer del server-side).
 */
export function extractUtmsFromSearchParams(params: URLSearchParams): UtmRecord {
  const out: UtmRecord = {};
  for (const key of UTM_KEYS) {
    const sanitized = sanitizeUtmValue(params.get(key));
    if (sanitized) out[key] = sanitized;
  }
  return out;
}

/**
 * True si el record tiene al menos un UTM. Útil para condicional de logging.
 */
export function hasAnyUtm(rec: UtmRecord): boolean {
  return UTM_KEYS.some((k) => typeof rec[k] === 'string' && rec[k]!.length > 0);
}
