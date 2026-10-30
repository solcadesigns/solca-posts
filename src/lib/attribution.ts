/**
 * Atribución de leads y ventas · 30 oct 2026 (P2 del diagnóstico de consultoría, EMB-2/EMB-6).
 *
 * El cliente (BaseLayout) guarda en localStorage:
 *   solca_aid     UUID anónimo del navegador (el mismo que ya usaban /vacantes y la encuesta)
 *   solca_ft      primer toque con fuente (UTM o referrer externo); no se sobrescribe
 *   solca_lt      último toque con fuente; se actualiza en cada llegada con UTM o referrer externo
 *   solca_interno '1' si Oscar abrió el sitio con ?interno=1 (tráfico propio, se excluye del reporte)
 * y los manda como `aid`, `ft`, `lt`, `interno` en eventos, leads y checkout.
 *
 * Aquí se valida todo lo que llega del cliente: aid solo como UUID, ft/lt con allow-list de llaves y
 * longitudes, interno solo como booleano true. Nada de esto contiene correo ni IP.
 */

import { sanitizeUtmValue } from './utm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HOST_RE = /^[a-z0-9.-]{1,100}$/;
const TOUCH_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const MAX_TOUCH_UTM = 100; // más corto que el UTM normal: ft/lt se guardan en cada lead y en Stripe metadata

export interface Touch {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  ref_host?: string;     // hostname externo del referrer (sin ruta ni query)
  landing_path?: string; // ruta donde aterrizó
  ts?: string;           // ISO del toque
}

export interface Attribution {
  aid?: string;
  ft?: Touch;
  lt?: Touch;
  interno?: true;
}

export function sanitizeAid(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase();
  return UUID_RE.test(v) ? v : undefined;
}

export function sanitizeHost(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase().replace(/^www\./, '');
  if (!HOST_RE.test(v) || !v.includes('.')) return undefined;
  if (v === 'solcaciencia.com' || v.endsWith('.solcaciencia.com')) return undefined; // propio, no es fuente
  return v;
}

function sanitizePath(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().split(/[?#]/)[0].replace(/[^A-Za-z0-9/_.-]/g, '').slice(0, 100);
  return v.startsWith('/') ? v : undefined;
}

function sanitizeTs(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length > 30) return undefined;
  const ms = Date.parse(raw);
  // Rango razonable: desde el lanzamiento del sitio hasta un día en el futuro (reloj del cliente).
  if (!Number.isFinite(ms) || ms < Date.parse('2026-01-01') || ms > Date.now() + 86_400_000) return undefined;
  return new Date(ms).toISOString();
}

/** Valida un toque (ft o lt). Solo llaves conocidas; devuelve undefined si no queda fuente. */
export function sanitizeTouch(raw: unknown): Touch | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const src = raw as Record<string, unknown>;
  const out: Touch = {};
  for (const k of TOUCH_UTM_KEYS) {
    const v = sanitizeUtmValue(src[k])?.slice(0, MAX_TOUCH_UTM);
    if (v) out[k] = v;
  }
  const host = sanitizeHost(src.ref_host);
  if (host) out.ref_host = host;
  if (!out.utm_source && !out.utm_campaign && !out.ref_host) return undefined; // sin fuente = sin toque
  const path = sanitizePath(src.landing_path);
  if (path) out.landing_path = path;
  const ts = sanitizeTs(src.ts);
  if (ts) out.ts = ts;
  return out;
}

/** Extrae aid/ft/lt/interno de un body arbitrario. Nunca lanza. */
export function extractAttribution(body: unknown): Attribution {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  const out: Attribution = {};
  const aid = sanitizeAid(b.aid);
  if (aid) out.aid = aid;
  const ft = sanitizeTouch(b.ft);
  if (ft) out.ft = ft;
  const lt = sanitizeTouch(b.lt);
  if (lt) out.lt = lt;
  if (b.interno === true) out.interno = true;
  return out;
}

/** Fuente legible de un toque: utm_source, o el host del referrer. */
export function touchSource(t: Touch | undefined): string | undefined {
  return t?.utm_source ?? t?.ref_host;
}

// User-agents de bots, previsualizadores y navegadores sin cabeza (P6). Se evalúa en el servidor.
const BOT_UA_RE = /bot|crawler|spider|crawl|headless|preview|linkedinbot|facebookexternalhit|slurp|bingpreview|lighthouse|pingdom|uptime|curl|wget|python-requests|httpclient|go-http-client/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true; // un navegador real siempre manda user-agent
  return BOT_UA_RE.test(ua);
}

/**
 * sha256(lower(trim(email))) en hex completo (64 caracteres). Llave de unión entre leads, Stripe y Hotmart.
 * Ojo: el `credits:`/`email_hash` del Simulador usa los primeros 16 caracteres de este mismo hash.
 */
export async function emailHashFull(email: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
