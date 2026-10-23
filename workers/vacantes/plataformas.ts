/**
 * Lectores por plataforma (23 oct 2026). Cada plataforma sabe listar las vacantes de
 * los países objetivo y leer el detalle de una vacante; el resto del proceso (guardar,
 * clasificar, cerrar, controles) es común y vive en index.ts.
 *
 * - Workday: API pública /wday/cxs/<tenant>/<site>/jobs y detalle por externalPath.
 * - Phenom: página search-results con los resultados embebidos (eagerLoadRefineSearch),
 *   filtrada por país con qcountry, y ficha /job/<id> con JSON-LD JobPosting (schema.org).
 */
import {
  PAISES_OBJETIVO,
  PAIS_EN,
  paisesEnTexto,
  type Fuente,
  type FuenteWorkday,
  type FuentePhenom,
  type PaisObjetivo,
} from '../../src/lib/vacantes-fuentes';

export const UA = 'Mozilla/5.0 (compatible; SolcaVacantes/1.0; +https://solcaciencia.com/vacantes)';
const PAGE = 20;
const MAX_PAGES = 60;
const DESC_MAX = 20000;

export interface ItemListado {
  id: string;            // fuente:llave
  titulo: string;
  llave: 'req' | 'ruta';
  ref: unknown;          // lo que necesita detalle() para leer la ficha
}

export interface Listado {
  items: ItemListado[];
  completo: boolean;     // false si no se pudieron leer todas las páginas
}

export interface Detalle {
  titulo: string;
  url: string;
  principalIso: string | null;   // país de la ubicación principal (ISO-2, minúsculas), aunque no sea objetivo
  paises: PaisObjetivo[];
  ubicacion: string;
  nUbicaciones: number;
  modalidad: string | null;      // texto crudo para clasificarModalidad
  fecha: string | null;          // YYYY-MM-DD
  descripcion: string | null;    // texto plano
}

async function postJson(url: string, body: unknown): Promise<any> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** HTML de un portal. Phenom responde 410/429 si se le pide rápido: se espera y se reintenta una vez. */
async function getTexto(url: string): Promise<string> {
  for (let intento = 0; intento < 2; intento++) {
    const r = await fetch(url, { headers: { Accept: 'text/html', 'User-Agent': UA } });
    if (r.ok) return r.text();
    if (intento === 0 && (r.status === 410 || r.status === 429 || r.status >= 500)) {
      await espera(2500);
      continue;
    }
    throw new Error(`HTTP ${r.status} ${url}`);
  }
  throw new Error(`HTTP sin respuesta ${url}`);
}

/** Pausa entre fichas de Phenom para no saturar el portal. */
export const PAUSA_PHENOM_MS = 400;

/** Decodifica entidades HTML (Phenom manda el HTML de la descripción escapado: &lt;p&gt;…). */
export function decodificarEntidades(t: string): string {
  return t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

export function textoPlano(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h\d)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, DESC_MAX);
}

// ──────────────────────────────── robots.txt

/**
 * ¿El robots.txt del portal permite las rutas que usamos? (RFC 9309, simplificado)
 * - Grupos de varias líneas User-agent seguidas; se usa el grupo de "solcavacantes" si existe, si no el de "*".
 * - Comentarios con # se ignoran; "*" es comodín y "$" es fin de ruta.
 * - Gana la regla más larga que coincida (Allow o Disallow); empate: gana Allow.
 * - 404 = todo permitido; 5xx o falla de red = se salta la fuente (se asume prohibido).
 */
export async function robotsPermite(origen: string, rutas: string[]): Promise<{ ok: boolean; regla?: string }> {
  let txt = '';
  try {
    const r = await fetch(`${origen}/robots.txt`, { headers: { 'User-Agent': UA } });
    if (r.status >= 500) return { ok: false, regla: `robots.txt respondió ${r.status}` };
    if (!r.ok) return { ok: true };
    txt = await r.text();
  } catch {
    return { ok: false, regla: 'robots.txt no respondió' };
  }
  type Regla = { allow: boolean; ruta: string };
  const grupos: Array<{ agentes: string[]; reglas: Regla[] }> = [];
  let actual: { agentes: string[]; reglas: Regla[] } | null = null;
  let ultimaFueAgente = false;
  for (const cruda of txt.split(/\r?\n/)) {
    const linea = cruda.replace(/#.*$/, '').trim();
    if (!linea) continue;
    const idx = linea.indexOf(':');
    if (idx < 0) continue;
    const clave = linea.slice(0, idx).trim().toLowerCase();
    const valor = linea.slice(idx + 1).trim();
    if (clave === 'user-agent') {
      if (!actual || !ultimaFueAgente) {
        actual = { agentes: [], reglas: [] };
        grupos.push(actual);
      }
      actual.agentes.push(valor.toLowerCase());
      ultimaFueAgente = true;
    } else if ((clave === 'allow' || clave === 'disallow') && actual) {
      ultimaFueAgente = false;
      if (valor) actual.reglas.push({ allow: clave === 'allow', ruta: valor });
    } else {
      ultimaFueAgente = false;
    }
  }
  const grupo = grupos.find((g) => g.agentes.some((a) => a.includes('solcavacantes'))) ?? grupos.find((g) => g.agentes.includes('*'));
  if (!grupo) return { ok: true };
  // "*" = cualquier cosa; "$" final = fin de ruta; cualquier otro "$" se toma literal.
  const aRegex = (r: string) => {
    const fin = r.endsWith('$');
    const cuerpo = (fin ? r.slice(0, -1) : r).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + cuerpo + (fin ? '$' : ''));
  };
  for (const ruta of rutas) {
    let mejor: Regla | null = null;
    for (const regla of grupo.reglas) {
      if (!aRegex(regla.ruta).test(ruta)) continue;
      if (!mejor || regla.ruta.length > mejor.ruta.length || (regla.ruta.length === mejor.ruta.length && regla.allow)) mejor = regla;
    }
    if (mejor && !mejor.allow) return { ok: false, regla: `${mejor.ruta} (bloquea ${ruta})` };
  }
  return { ok: true };
}

/** Rutas reales que pide el lector (con su query), para revisarlas contra robots.txt. */
export function rutasDe(f: Fuente): { origen: string; rutas: string[] } {
  if (f.plataforma === 'phenom') {
    const u = new URL(f.base);
    return { origen: u.origin, rutas: [`${u.pathname}/search-results`, `${u.pathname}/search-results?qcountry=Mexico&from=0`, `${u.pathname}/job/0`] };
  }
  return { origen: `https://${f.host}`, rutas: [`/wday/cxs/${f.tenant}/${f.site}/jobs`, `/wday/cxs/${f.tenant}/${f.site}/job/x`] };
}

// ──────────────────────────────── Workday

/** Busca en las facetas de ubicación los ids de los países objetivo. Prefiere la faceta de país. */
function facetasPais(facets: any[]): { param: string; ids: string[] } | null {
  const found: Record<string, string[]> = {};
  const walk = (list: any[], parent?: string) => {
    for (const f of list ?? []) {
      const param: string | undefined = f.facetParameter ?? parent;
      for (const v of f.values ?? []) {
        if (Array.isArray(v.values) && v.values.length) {
          walk([v], v.facetParameter ?? param);
          continue;
        }
        if (!param || !/ocation|ountry/i.test(param)) continue;
        if (paisesEnTexto(v.descriptor).length) (found[param] ??= []).push(v.id);
      }
    }
  };
  walk(facets);
  const params = Object.keys(found);
  if (!params.length) return null;
  const pref = params.find((p) => /ountry/i.test(p)) ?? params.find((p) => p === 'locations') ?? params[0];
  return { param: pref, ids: found[pref] };
}

async function listarWorkday(f: FuenteWorkday): Promise<Listado> {
  const base = `https://${f.host}/wday/cxs/${f.tenant}/${f.site}`;
  const first = await postJson(`${base}/jobs`, { appliedFacets: {}, limit: 1, offset: 0, searchText: '' });
  const fac = facetasPais(first.facets);
  if (!fac) throw new Error('sin facetas de país objetivo');
  const items: ItemListado[] = [];
  let total = Infinity;
  let leidas = 0;
  for (let p = 0; p < MAX_PAGES && p * PAGE < total; p++) {
    const d = await postJson(`${base}/jobs`, { appliedFacets: { [fac.param]: fac.ids }, limit: PAGE, offset: p * PAGE, searchText: '' });
    if (p === 0) total = d.total ?? 0;
    const page: Array<{ title?: string; externalPath?: string; bulletFields?: string[]; locationsText?: string }> = d.jobPostings ?? [];
    if (!page.length) break;
    leidas += page.length;
    // Workday a veces devuelve entradas incompletas (solo bulletFields): no se pueden leer.
    for (const x of page) {
      if (!x.externalPath || !x.title || RX_PRUEBA.test(x.title)) continue;
      const req = x.bulletFields?.[0];
      items.push({
        id: `${f.id}:${req ?? x.externalPath}`, titulo: x.title, llave: req ? 'req' : 'ruta',
        ref: { externalPath: x.externalPath, locationsText: x.locationsText ?? '' },
      });
    }
  }
  return { items, completo: leidas >= Math.min(total, MAX_PAGES * PAGE) };
}

async function detalleWorkday(f: FuenteWorkday, ref: unknown): Promise<Detalle | null> {
  const { externalPath, locationsText } = ref as { externalPath: string; locationsText: string };
  const det = await getJson(`https://${f.host}/wday/cxs/${f.tenant}/${f.site}${externalPath}`);
  const info = det.jobPostingInfo ?? {};
  const titulo: string = info.title ?? '';
  const adicionales: string[] = Array.isArray(info.additionalLocations) ? info.additionalLocations : [];
  const ubic = [info.location, ...adicionales, info.country?.descriptor, locationsText].filter(Boolean).join(' | ');
  const alpha2: string | undefined = info.jobRequisitionLocation?.country?.alpha2Code ?? info.country?.alpha2Code;
  const principalIso = alpha2 ? alpha2.toLowerCase() : null;
  const paises = [...new Set<PaisObjetivo>([
    ...(principalIso && (PAISES_OBJETIVO as readonly string[]).includes(principalIso) ? [principalIso as PaisObjetivo] : []),
    ...paisesEnTexto(ubic),
  ])];
  return {
    titulo,
    url: typeof info.externalUrl === 'string' && info.externalUrl.startsWith('https://') ? info.externalUrl : `https://${f.host}/${f.site}${externalPath}`,
    principalIso,
    paises,
    ubicacion: String(info.location ?? locationsText ?? '').slice(0, 300),
    nUbicaciones: 1 + adicionales.length,
    modalidad: info.remoteType ?? null,
    fecha: typeof info.startDate === 'string' ? info.startDate.slice(0, 10) : null,
    descripcion: info.jobDescription ? textoPlano(String(info.jobDescription)) : null,
  };
}

// ──────────────────────────────── Phenom

/** Extrae el objeto JSON que sigue a una clave dentro del HTML (balanceando llaves). */
function objetoTras(html: string, clave: string): any | null {
  const i = html.indexOf(clave);
  if (i < 0) return null;
  const j = html.indexOf('{', i);
  if (j < 0) return null;
  let prof = 0;
  let enCadena = false;
  for (let k = j; k < html.length; k++) {
    const c = html[k];
    if (enCadena) {
      if (c === '\\') k++;
      else if (c === '"') enCadena = false;
      continue;
    }
    if (c === '"') enCadena = true;
    else if (c === '{') prof++;
    else if (c === '}' && --prof === 0) {
      try {
        return JSON.parse(html.slice(j, k + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

const ISO_POR_NOMBRE: Record<string, string> = {
  mexico: 'mx', 'méxico': 'mx', brazil: 'br', brasil: 'br', argentina: 'ar', colombia: 'co', chile: 'cl',
  peru: 'pe', 'perú': 'pe', spain: 'es', 'españa': 'es',
  // Fuera de los 7 países (para es_principal = 0 con país conocido, como en Workday).
  'united states': 'us', 'united states of america': 'us', 'united kingdom': 'gb', germany: 'de', france: 'fr',
  italy: 'it', portugal: 'pt', switzerland: 'ch', ireland: 'ie', belgium: 'be', netherlands: 'nl', poland: 'pl',
  india: 'in', china: 'cn', canada: 'ca', 'puerto rico': 'pr', bulgaria: 'bg', hungary: 'hu', 'czech republic': 'cz',
};

interface JobPhenom {
  jobId?: string;
  title?: string;
  country?: string;
  location?: string;
  multi_location?: string[];
  postedDate?: string;
}

/** Vacantes de prueba que algunos portales dejan publicadas ("DO NOT APPLY - TEST REQ"). */
export const RX_PRUEBA = /(do not apply|test req|\btest posting\b|no aplicar)/i;

async function listarPhenom(f: FuentePhenom): Promise<Listado> {
  const vistos = new Map<string, ItemListado>();
  let completo = true;
  // Total sin filtro: si un país no existe en el portal, Phenom ignora qcountry y devuelve todo.
  // Ojo: el parámetro s=1 también hace que ignore qcountry; la paginación usa solo from.
  const sinFiltro = objetoTras(await getTexto(`${f.base}/search-results`), '"eagerLoadRefineSearch"');
  const totalGlobal: number = sinFiltro?.totalHits ?? -1;
  for (const p of PAISES_OBJETIVO) {
    let total = Infinity;
    let leidas = 0;
    for (let from = 0, pagina = 0; from < total && pagina < MAX_PAGES; pagina++) {
      const html = await getTexto(`${f.base}/search-results?qcountry=${encodeURIComponent(PAIS_EN[p])}&from=${from}`);
      const o = objetoTras(html, '"eagerLoadRefineSearch"');
      if (!o) throw new Error('página de resultados sin datos embebidos');
      const jobs: JobPhenom[] = o.data?.jobs ?? [];
      if (pagina === 0) {
        total = o.totalHits ?? 0;
        // Filtro ignorado: mismo total que sin filtro, o la mayoría de la primera página es de otros países.
        const delPais = jobs.filter((x) => paisesEnTexto([x.country, x.location, ...(x.multi_location ?? [])].filter(Boolean).join(' | ')).includes(p)).length;
        if (total === totalGlobal || (jobs.length >= 5 && delPais < jobs.length / 2)) {
          total = 0;
          break;
        }
      }
      if (!jobs.length) break;
      leidas += jobs.length;
      from += jobs.length;
      for (const j of jobs) {
        if (!j.jobId || !j.title || RX_PRUEBA.test(j.title)) continue;
        // Solo si el país pedido aparece en sus ubicaciones (doble control del filtro).
        const ubic = [j.country, j.location, ...(j.multi_location ?? [])].filter(Boolean).join(' | ');
        if (!paisesEnTexto(ubic).includes(p)) continue;
        vistos.set(`${f.id}:${j.jobId}`, { id: `${f.id}:${j.jobId}`, titulo: j.title, llave: 'req', ref: j });
      }
    }
    if (leidas < total) completo = false;
  }
  return { items: [...vistos.values()], completo };
}

async function detallePhenom(f: FuentePhenom, ref: unknown): Promise<Detalle | null> {
  const j = ref as JobPhenom;
  const url = `${f.base}/job/${encodeURIComponent(String(j.jobId))}`;
  await espera(PAUSA_PHENOM_MS);
  const html = await getTexto(url);
  // JSON-LD JobPosting (puede venir solo o dentro de @graph).
  let jp: any = null;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const o = JSON.parse(m[1]);
      const lista = Array.isArray(o) ? o : o['@graph'] ?? [o];
      jp = lista.find((x: any) => x?.['@type'] === 'JobPosting') ?? jp;
    } catch {
      /* bloque inválido: se ignora */
    }
    if (jp) break;
  }
  // Si la ficha no trae JSON-LD JobPosting, Phenom suele traer los mismos datos embebidos en "jobDetail".
  const embebido = jp ? null : objetoTras(html, '"jobDetail"')?.data?.job;
  const ubicaciones = [j.location, ...(j.multi_location ?? []), j.country].filter(Boolean) as string[];
  const principalIso = ISO_POR_NOMBRE[(j.country ?? '').trim().toLowerCase()] ?? null;
  const paises = [...new Set<PaisObjetivo>([
    ...(principalIso && (PAISES_OBJETIVO as readonly string[]).includes(principalIso) ? [principalIso as PaisObjetivo] : []),
    ...paisesEnTexto(ubicaciones.join(' | ')),
  ])];
  // postedDate del listado es la fecha de publicación; datePosted del JSON-LD parece de actualización.
  const fecha = (j.postedDate ?? (typeof jp?.datePosted === 'string' ? jp.datePosted : embebido?.postedDate) ?? '').slice(0, 10) || null;
  const descHtml: unknown = jp?.description ?? embebido?.description;
  return {
    titulo: (jp?.title as string) ?? (embebido?.title as string) ?? j.title ?? '',
    url,
    principalIso,
    paises,
    ubicacion: String(j.location ?? '').slice(0, 300),
    nUbicaciones: Math.max(1, j.multi_location?.length ?? 1),
    // jobLocationType (TELECOMMUTE = remoto) casi nunca viene; respaldo: la ubicación ("Remote, Mexico").
    modalidad: [typeof jp?.jobLocationType === 'string' ? jp.jobLocationType : '', ...ubicaciones].join(' ') || null,
    fecha,
    descripcion: typeof descHtml === 'string' ? textoPlano(decodificarEntidades(descHtml)) : null,
  };
}

// ──────────────────────────────── despacho

export function listar(f: Fuente): Promise<Listado> {
  return f.plataforma === 'phenom' ? listarPhenom(f) : listarWorkday(f);
}

export function detalle(f: Fuente, ref: unknown): Promise<Detalle | null> {
  return f.plataforma === 'phenom' ? detallePhenom(f, ref) : detalleWorkday(f, ref);
}
