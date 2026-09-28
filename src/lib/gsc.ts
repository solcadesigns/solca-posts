// Cliente mínimo de Google Search Console · Search Analytics API.
//
// Origen (21 sep 2026): esta lógica ya vivía dentro de src/pages/api/weekly-report.ts
// desde el 10 ago 2026. Se extrajo aquí para que /api/seo-signals la pueda usar
// sin tocar weekly-report, que es un archivo de ~1000 líneas en producción.
//
// Deliberadamente NO se refactorizó weekly-report para que importe de aquí.
// Queda el código duplicado en los dos lados. Es feo y está asumido: el riesgo
// de romper el reporte semanal por una extracción cosmética es mayor que el
// costo de mantener cuarenta líneas repetidas. Si algún día se toca
// weekly-report por otra razón, ahí sí conviene migrarlo a este módulo.
//
// Auth: service account con JWT RS256 firmado con WebCrypto. Sin googleapis,
// que no corre en Workers. Scope de solo lectura.

export interface GscApiRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

/** Fila normalizada de una dimensión (query, page, country). */
export interface GscRow {
  key: string;
  clicks: number;
  impresiones: number;
  ctr_pct: number;
  posicion: number;
}

/** PEM (PKCS8) → ArrayBuffer para crypto.subtle.importKey. */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function base64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Intercambia un JWT de service account por un access token de Google.
 * privateKeyPem acepta saltos de línea reales o "\n" escapados, porque
 * `wrangler secret put` suele guardar el segundo formato.
 */
export async function getGoogleAccessToken(
  clientEmail: string,
  privateKeyPem: string,
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem.replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const jwt = `${header}.${claims}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  if (!res.ok) {
    throw new Error(`google token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('google token: respuesta sin access_token');
  return data.access_token;
}

/** POST a Search Analytics API. Devuelve rows ([] si no hay data). */
export async function gscQuery(
  token: string,
  siteUrl: string,
  body: Record<string, unknown>,
): Promise<GscApiRow[]> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`gsc query ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { rows?: GscApiRow[] };
  return data.rows ?? [];
}

/** Normaliza filas de una dimensión. stripOrigin quita el https://dominio de las páginas. */
export function gscRows(rows: GscApiRow[], stripOrigin = false): GscRow[] {
  return rows
    .filter((r) => r.keys?.[0])
    .map((r) => ({
      key: stripOrigin ? r.keys![0].replace(/^https?:\/\/[^/]+/, '') : r.keys![0],
      clicks: r.clicks ?? 0,
      impresiones: r.impressions ?? 0,
      ctr_pct: +(((r.ctr ?? 0) * 100).toFixed(2)),
      posicion: +((r.position ?? 0).toFixed(2)),
    }));
}

/** yyyy-mm-dd en UTC, que es lo que espera la API. */
export function fmtDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Ventana de consulta respetando el lag de publicación de GSC.
 * GSC publica con ~3 días de retraso: pedir hasta hoy devuelve días vacíos
 * que ensucian los promedios. La ventana termina hace `lagDias`.
 */
export function ventanaGsc(dias: number, lagDias = 3): { start: Date; end: Date } {
  const end = new Date(Date.now() - lagDias * 86_400_000);
  const start = new Date(end.getTime() - dias * 86_400_000);
  return { start, end };
}
