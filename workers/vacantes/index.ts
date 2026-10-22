/**
 * Worker solca-vacantes · lector diario de vacantes LATAM/España (22 oct 2026).
 *
 * Una vez al día (cron) lee los portales oficiales de las fuentes en
 * src/lib/vacantes-fuentes.ts, guarda en D1 (tabla `vacantes`) las vacantes de
 * MX, BR, AR, CO, CL, PE y ES, y marca como cerradas las que ya no aparecen.
 * No usa IA: cero tokens. Diseño: _docs/VACANTES_BUSCADOR.md.
 *
 * Carga manual (primera carga o pruebas): GET /run?key=<RUN_KEY>[&fuente=iqvia]
 * Recalcular rol, nivel y descriptores tras cambiar reglas: GET /run?key=<RUN_KEY>&modo=reprocesar
 */
import { FUENTES, paisesEnTexto, type FuenteWorkday } from '../../src/lib/vacantes-fuentes';
import {
  CLASIFICACION_VERSION,
  clasificarModalidad,
  clasificarNivel,
  clasificarRolEmpresa,
} from '../../src/lib/vacantes-clasificar';
import { DESCRIPTORES_VERSION, extraerDescriptores } from '../../src/lib/vacantes-descriptores';

interface Env {
  DB: D1Database;
  RUN_KEY?: string;
}

const UA = 'Mozilla/5.0 (compatible; SolcaVacantes/1.0; +https://solcaciencia.com/vacantes)';
const PAGE = 20;
const MAX_PAGES = 60; // tope de seguridad por fuente (1,200 vacantes)
const MAX_NEW_DETAILS = 400; // detalles nuevos por fuente y corrida; el resto entra al día siguiente
const CONCURRENCY = 5;
const DESC_MAX = 20000;

interface Posting {
  title: string;
  externalPath: string;
  locationsText?: string;
  bulletFields?: string[];
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

function textoPlano(html: string): string {
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

/** Sentencias que guardan los descriptores de una vacante (columnas + etiquetas). */
function descriptoresStmts(db: D1Database, id: string, titulo: string, descripcion: string | null): D1PreparedStatement[] {
  const d = extraerDescriptores(descripcion, titulo);
  const out: D1PreparedStatement[] = [
    db.prepare(
      `UPDATE vacantes SET idioma_anuncio = ?, ingles = ?, grado_min = ?, anios_min = ?, contrato = ?,
         sponsor_dedicado = ?, inclusion = ?, descriptores_version = ? WHERE id = ?`,
    ).bind(d.idioma_anuncio, d.ingles, d.grado_min, d.anios_min, d.contrato, d.sponsor_dedicado ? 1 : 0, d.inclusion ? 1 : 0, DESCRIPTORES_VERSION, id),
    db.prepare('DELETE FROM vacantes_etiquetas WHERE vacante_id = ?').bind(id),
  ];
  const ins = db.prepare('INSERT OR IGNORE INTO vacantes_etiquetas (vacante_id, tipo, valor) VALUES (?, ?, ?)');
  for (const e of d.etiquetas) out.push(ins.bind(id, e.tipo, e.valor));
  return out;
}

/**
 * Recalcula rol, nivel y descriptores de las vacantes guardadas con una versión
 * anterior de las reglas. Corre en lotes; el cron lo llama cada día.
 */
async function reprocesar(env: Env, limite = 400): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT id, titulo, descripcion, tipo_empresa FROM vacantes
     WHERE clasificacion_version IS NOT ? OR descriptores_version IS NOT ? LIMIT ?`,
  )
    .bind(CLASIFICACION_VERSION, DESCRIPTORES_VERSION, limite)
    .all<{ id: string; titulo: string; descripcion: string | null; tipo_empresa: string }>();
  const lista = (rows.results ?? []) as Array<{ id: string; titulo: string; descripcion: string | null; tipo_empresa: string }>;
  const upd = env.DB.prepare('UPDATE vacantes SET rol = ?, nivel = ?, clasificacion_version = ? WHERE id = ?');
  let stmts: D1PreparedStatement[] = [];
  for (const r of lista) {
    stmts.push(upd.bind(clasificarRolEmpresa(r.titulo, r.tipo_empresa), clasificarNivel(r.titulo), CLASIFICACION_VERSION, r.id));
    stmts.push(...descriptoresStmts(env.DB, r.id, r.titulo, r.descripcion));
    if (stmts.length >= 80) {
      await env.DB.batch(stmts);
      stmts = [];
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
  return lista.length;
}

async function enParalelo<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const x = items[i++];
      await fn(x);
    }
  });
  await Promise.all(workers);
}

interface Resultado {
  fuente: string;
  estado: 'ok' | 'error' | 'parcial';
  vistas: number;
  nuevas: number;
  cerradas: number;
  error?: string;
}

async function leerFuente(env: Env, f: FuenteWorkday, ahora: string): Promise<Resultado> {
  const base = `https://${f.host}/wday/cxs/${f.tenant}/${f.site}`;
  const res: Resultado = { fuente: f.id, estado: 'ok', vistas: 0, nuevas: 0, cerradas: 0 };
  try {
    const first = await postJson(`${base}/jobs`, { appliedFacets: {}, limit: 1, offset: 0, searchText: '' });
    const fac = facetasPais(first.facets);
    if (!fac) throw new Error('sin facetas de país objetivo');

    // 1. Listado completo filtrado a los países objetivo.
    const postings: Posting[] = [];
    let total = Infinity;
    for (let p = 0; p < MAX_PAGES && p * PAGE < total; p++) {
      const d = await postJson(`${base}/jobs`, {
        appliedFacets: { [fac.param]: fac.ids },
        limit: PAGE,
        offset: p * PAGE,
        searchText: '',
      });
      if (p === 0) total = d.total ?? 0;
      const page: Posting[] = d.jobPostings ?? [];
      if (!page.length) break;
      postings.push(...page);
    }
    if (total > MAX_PAGES * PAGE) res.estado = 'parcial';

    const idDe = (x: Posting) => `${f.id}:${x.bulletFields?.[0] ?? x.externalPath}`;
    const vistos = new Map(postings.map((x) => [idDe(x), x]));
    res.vistas = vistos.size;

    // 2. Cuáles ya conocemos.
    const conocidas = new Set<string>();
    const rows = await env.DB.prepare('SELECT id FROM vacantes WHERE fuente = ?').bind(f.id).all<{ id: string }>();
    for (const r of rows.results ?? []) conocidas.add(r.id);

    // 3. Las conocidas que siguen publicadas: actualizar última vez (y reabrir si estaban cerradas).
    const siguen = [...vistos.keys()].filter((id) => conocidas.has(id));
    const upd = env.DB.prepare('UPDATE vacantes SET ultima_vez = ?, activa = 1, fecha_cierre = NULL WHERE id = ?');
    for (let i = 0; i < siguen.length; i += 50) {
      await env.DB.batch(siguen.slice(i, i + 50).map((id) => upd.bind(ahora, id)));
    }

    // 4. Las nuevas: leer el detalle, clasificar e insertar.
    const nuevas = [...vistos.entries()].filter(([id]) => !conocidas.has(id)).slice(0, MAX_NEW_DETAILS);
    if (nuevas.length < [...vistos.keys()].filter((id) => !conocidas.has(id)).length) res.estado = 'parcial';
    const ins = env.DB.prepare(
      `INSERT OR REPLACE INTO vacantes (id, fuente, empresa, tipo_empresa, titulo, url, pais, paises, ubicacion, modalidad,
         rol, nivel, fecha_publicacion, primera_vez, ultima_vez, activa, fecha_cierre, descripcion, clasificacion_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
    );
    const pendientes: D1PreparedStatement[] = [];
    let insertadas = 0;
    await enParalelo(nuevas, CONCURRENCY, async ([id, x]) => {
      try {
        const det = await getJson(`${base}${x.externalPath}`);
        const info = det.jobPostingInfo ?? {};
        const titulo: string = info.title ?? x.title;
        const ubic = [info.location, ...(info.additionalLocations ?? []), info.country?.descriptor, x.locationsText]
          .filter(Boolean)
          .join(' | ');
        const paises = paisesEnTexto(ubic);
        if (!paises.length) return; // la faceta coincidió pero ninguna ubicación es de un país objetivo
        const principal = paisesEnTexto(`${info.country?.descriptor ?? ''} ${info.location ?? ''}`)[0] ?? paises[0];
        const descripcion = info.jobDescription ? textoPlano(String(info.jobDescription)) : null;
        insertadas++;
        pendientes.push(
          ins.bind(
            id, f.id, f.empresa, f.tipo, titulo,
            info.externalUrl ?? `https://${f.host}/${f.site}${x.externalPath}`,
            principal, paises.join(','), (info.location ?? x.locationsText ?? '').slice(0, 300),
            clasificarModalidad(`${info.remoteType ?? ''} ${titulo}`),
            clasificarRolEmpresa(titulo, f.tipo), clasificarNivel(titulo),
            typeof info.startDate === 'string' ? info.startDate.slice(0, 10) : null,
            ahora, ahora,
            descripcion,
            CLASIFICACION_VERSION,
          ),
          ...descriptoresStmts(env.DB, id, titulo, descripcion),
        );
      } catch (err) {
        console.error('detalle falló', f.id, x.externalPath, String(err));
      }
    });
    for (let i = 0; i < pendientes.length; i += 50) await env.DB.batch(pendientes.slice(i, i + 50));
    res.nuevas = insertadas;

    // 5. Cerrar las que ya no aparecen. Solo si la lectura fue completa: una falla no cierra nada.
    if (res.estado === 'ok') {
      const activas = await env.DB.prepare('SELECT id FROM vacantes WHERE fuente = ? AND activa = 1').bind(f.id).all<{ id: string }>();
      const cerrar = ((activas.results ?? []) as Array<{ id: string }>).map((r) => r.id).filter((id) => !vistos.has(id));
      const cls = env.DB.prepare('UPDATE vacantes SET activa = 0, fecha_cierre = ? WHERE id = ?');
      for (let i = 0; i < cerrar.length; i += 50) await env.DB.batch(cerrar.slice(i, i + 50).map((id: string) => cls.bind(ahora.slice(0, 10), id)));
      res.cerradas = cerrar.length;
    }
  } catch (err) {
    res.estado = 'error';
    res.error = String(err).slice(0, 300);
  }
  await env.DB.prepare(
    'INSERT INTO vacantes_corridas (ts, fuente, estado, vistas, nuevas, cerradas, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(ahora, res.fuente, res.estado, res.vistas, res.nuevas, res.cerradas, res.error ?? null)
    .run();
  return res;
}

async function correr(env: Env, soloFuente?: string): Promise<Resultado[]> {
  const ahora = new Date().toISOString();
  const fuentes = soloFuente ? FUENTES.filter((f) => f.id === soloFuente) : FUENTES;
  const out: Resultado[] = [];
  for (const f of fuentes) out.push(await leerFuente(env, f, ahora)); // una fuente a la vez: amable con los portales
  return out;
}

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const r = await correr(env);
    const reproc = await reprocesar(env);
    console.log('vacantes', JSON.stringify(r), 'reprocesadas', reproc);
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/run') return new Response('solca-vacantes', { status: 200 });
    if (!env.RUN_KEY || url.searchParams.get('key') !== env.RUN_KEY) return new Response('unauthorized', { status: 401 });
    if (url.searchParams.get('modo') === 'reprocesar') {
      let total = 0;
      for (let n = await reprocesar(env); n > 0; n = await reprocesar(env)) total += n;
      return new Response(JSON.stringify({ reprocesadas: total }), { headers: { 'Content-Type': 'application/json' } });
    }
    const r = await correr(env, url.searchParams.get('fuente') ?? undefined);
    return new Response(JSON.stringify(r, null, 2), { headers: { 'Content-Type': 'application/json' } });
  },
};
