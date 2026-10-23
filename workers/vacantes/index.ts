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
import { FUENTES, PAISES_OBJETIVO, paisesEnTexto, type FuenteWorkday } from '../../src/lib/vacantes-fuentes';
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
    `SELECT id, fuente, titulo, descripcion, tipo_empresa, ubicacion, es_principal FROM vacantes
     WHERE clasificacion_version IS NOT ? OR descriptores_version IS NOT ? LIMIT ?`,
  )
    .bind(CLASIFICACION_VERSION, DESCRIPTORES_VERSION, limite)
    .all();
  type Fila = { id: string; fuente: string; titulo: string; descripcion: string | null; tipo_empresa: string; ubicacion: string | null; es_principal: number | null };
  const lista = (rows.results ?? []) as Fila[];
  const upd = env.DB.prepare(
    'UPDATE vacantes SET rol = ?, nivel = ?, clasificacion_version = ?, tipo_publicacion = ?, grupo_dup = ? WHERE id = ?',
  );
  // Filas guardadas antes de existir pais_principal_iso: se aproxima con el texto de la ubicación principal.
  const updPrincipal = env.DB.prepare('UPDATE vacantes SET pais_principal_iso = ?, es_principal = ? WHERE id = ?');
  let stmts: D1PreparedStatement[] = [];
  for (const r of lista) {
    stmts.push(
      upd.bind(
        clasificarRolEmpresa(r.titulo, r.tipo_empresa), clasificarNivel(r.titulo), CLASIFICACION_VERSION,
        RX_BANCO_TALENTO.test(r.titulo) ? 'banco_talento' : 'vacante',
        huella(`${r.fuente}|${r.titulo.toLowerCase().replace(/\s+/g, ' ').trim()}|${(r.descripcion ?? '').slice(0, 1500)}`),
        r.id,
      ),
    );
    if (r.es_principal === null) {
      const p = paisesEnTexto(r.ubicacion)[0];
      stmts.push(updPrincipal.bind(p ?? null, p ? 1 : 0, r.id));
    }
    stmts.push(...descriptoresStmts(env.DB, r.id, r.titulo, r.descripcion));
    if (stmts.length >= 80) {
      await env.DB.batch(stmts);
      stmts = [];
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
  return lista.length;
}

/** Huella corta (FNV-1a) para agrupar plazas múltiples de la misma oferta. */
function huella(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const RX_BANCO_TALENTO = /(banco de talent|talent ?(pool|community)|comunidad de talento|candidatura espont)/i;

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
  estado: 'ok' | 'error' | 'parcial' | 'sospechosa';
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
    let leidas = 0;
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
      // Workday a veces devuelve entradas incompletas (solo bulletFields): no se pueden leer.
      postings.push(...page.filter((x) => x.externalPath && x.title));
      leidas += page.length;
    }
    // 1. Lectura incompleta (página vacía antes de tiempo, tope de páginas): no se cierra nada.
    if (leidas < Math.min(total, MAX_PAGES * PAGE)) res.estado = 'parcial';

    const idDe = (x: Posting) => `${f.id}:${x.bulletFields?.[0] ?? x.externalPath}`;
    const vistos = new Map(postings.map((x) => [idDe(x), x]));
    res.vistas = vistos.size;

    // Controles de calidad: primera lectura de la fuente (cohorte inicial) y caídas bruscas.
    const previas = await env.DB.prepare(
      "SELECT vistas FROM vacantes_corridas WHERE fuente = ? AND estado = 'ok' ORDER BY ts DESC LIMIT 7",
    ).bind(f.id).all<{ vistas: number }>();
    const historico = ((previas.results ?? []) as Array<{ vistas: number }>).map((r) => r.vistas).sort((a, b) => a - b);
    const primeraLectura = historico.length === 0;
    if (historico.length >= 3) {
      const mediana = historico[Math.floor(historico.length / 2)];
      // Si la fuente cae a la mitad o menos de su mediana, algo cambió en el portal: no se cierra nada.
      if (mediana >= 10 && res.vistas <= mediana * 0.5) {
        res.estado = 'sospechosa';
        res.error = `vistas ${res.vistas} contra mediana ${mediana}`;
      }
    }

    // 2. Cuáles ya conocemos (guardadas o descartadas antes).
    const conocidas = new Map<string, { titulo: string; activa: number }>();
    const rows = await env.DB.prepare('SELECT id, titulo, activa FROM vacantes WHERE fuente = ?').bind(f.id).all<{ id: string; titulo: string; activa: number }>();
    for (const r of (rows.results ?? []) as Array<{ id: string; titulo: string; activa: number }>) conocidas.set(r.id, { titulo: r.titulo, activa: r.activa });
    const ciclo = env.DB.prepare('INSERT INTO vacantes_ciclo (vacante_id, ts, evento, valor) VALUES (?, ?, ?, ?)');
    const descartadas = new Set<string>();
    const desc = await env.DB.prepare('SELECT id FROM vacantes_descartadas WHERE fuente = ?').bind(f.id).all<{ id: string }>();
    for (const r of (desc.results ?? []) as Array<{ id: string }>) descartadas.add(r.id);

    // 3. Las conocidas que siguen publicadas: actualizar última vez (y reabrir si estaban cerradas).
    // Si la empresa cambió el título, se actualiza y se marca para reclasificar.
    const siguen = [...vistos.keys()].filter((id) => conocidas.has(id));
    const upd = env.DB.prepare('UPDATE vacantes SET ultima_vez = ?, activa = 1, fecha_cierre = NULL WHERE id = ?');
    const updTitulo = env.DB.prepare(
      // clasificacion_version vacía (no NULL: la columna es NOT NULL) para que reprocesar la tome.
      "UPDATE vacantes SET ultima_vez = ?, activa = 1, fecha_cierre = NULL, titulo = ?, clasificacion_version = '', descriptores_version = NULL WHERE id = ?",
    );
    const stmtsSiguen: D1PreparedStatement[] = [];
    for (const id of siguen) {
      const previa = conocidas.get(id)!;
      const nuevoTitulo = vistos.get(id)!.title;
      if (nuevoTitulo && nuevoTitulo !== previa.titulo) {
        stmtsSiguen.push(updTitulo.bind(ahora, nuevoTitulo, id), ciclo.bind(id, ahora, 'cambio_titulo', previa.titulo.slice(0, 300)));
      } else {
        stmtsSiguen.push(upd.bind(ahora, id));
      }
      if (previa.activa === 0) stmtsSiguen.push(ciclo.bind(id, ahora, 'reapertura', null));
    }
    for (let i = 0; i < stmtsSiguen.length; i += 50) await env.DB.batch(stmtsSiguen.slice(i, i + 50));

    // 4. Las nuevas: leer el detalle, clasificar e insertar.
    const porLeer = [...vistos.entries()].filter(([id]) => !conocidas.has(id) && !descartadas.has(id));
    const nuevas = porLeer.slice(0, MAX_NEW_DETAILS);
    if (nuevas.length < porLeer.length) res.estado = 'parcial';
    const ins = env.DB.prepare(
      `INSERT INTO vacantes (id, fuente, empresa, tipo_empresa, titulo, url, pais, paises, ubicacion, modalidad,
         rol, nivel, fecha_publicacion, primera_vez, ultima_vez, activa, fecha_cierre, descripcion, clasificacion_version,
         pais_principal_iso, es_principal, n_ubicaciones, cohorte_inicial, tipo_publicacion, grupo_dup, id_llave)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ultima_vez = excluded.ultima_vez, activa = 1, fecha_cierre = NULL`,
    );
    const pendientes: D1PreparedStatement[] = [];
    const insDesc = env.DB.prepare('INSERT OR IGNORE INTO vacantes_descartadas (id, fuente, ts, motivo) VALUES (?, ?, ?, ?)');
    let insertadas = 0;
    await enParalelo(nuevas, CONCURRENCY, async ([id, x]) => {
      try {
        const det = await getJson(`${base}${x.externalPath}`);
        const info = det.jobPostingInfo ?? {};
        const titulo: string = info.title ?? x.title;
        const ubic = [info.location, ...(info.additionalLocations ?? []), info.country?.descriptor, x.locationsText]
          .filter(Boolean)
          .join(' | ');
        // País principal: el código ISO que trae Workday (más fiable que el texto). El resto, del texto de ubicaciones.
        const alpha2: string | undefined = info.jobRequisitionLocation?.country?.alpha2Code ?? info.country?.alpha2Code;
        const principalIso = alpha2 ? alpha2.toLowerCase() : undefined;
        const paises = [...new Set([
          ...(principalIso && (PAISES_OBJETIVO as readonly string[]).includes(principalIso) ? [principalIso] : []),
          ...paisesEnTexto(ubic),
        ])];
        if (!paises.length) {
          // La faceta coincidió pero ninguna ubicación es de un país objetivo: no volver a pedirla.
          pendientes.push(insDesc.bind(id, f.id, ahora, 'sin_pais_objetivo'));
          return;
        }
        const principal = principalIso && paises.includes(principalIso) ? principalIso : paises[0];
        const descripcion = info.jobDescription ? textoPlano(String(info.jobDescription)) : null;
        insertadas++;
        pendientes.push(
          ins.bind(
            id, f.id, f.empresa, f.tipo, titulo,
            typeof info.externalUrl === 'string' && info.externalUrl.startsWith('https://') ? info.externalUrl : `https://${f.host}/${f.site}${x.externalPath}`,
            principal, paises.join(','), (info.location ?? x.locationsText ?? '').slice(0, 300),
            clasificarModalidad(`${info.remoteType ?? ''} ${titulo}`),
            clasificarRolEmpresa(titulo, f.tipo), clasificarNivel(titulo),
            typeof info.startDate === 'string' ? info.startDate.slice(0, 10) : null,
            ahora, ahora,
            descripcion,
            CLASIFICACION_VERSION,
            principalIso ?? null,
            principalIso && (PAISES_OBJETIVO as readonly string[]).includes(principalIso) ? 1 : 0,
            1 + (Array.isArray(info.additionalLocations) ? info.additionalLocations.length : 0),
            primeraLectura ? 1 : 0,
            RX_BANCO_TALENTO.test(titulo) ? 'banco_talento' : 'vacante',
            huella(`${f.id}|${titulo.toLowerCase().replace(/\s+/g, ' ').trim()}|${(descripcion ?? '').slice(0, 1500)}`),
            x.bulletFields?.[0] ? 'req' : 'ruta',
          ),
          ciclo.bind(id, ahora, 'alta', null),
          ...descriptoresStmts(env.DB, id, titulo, descripcion),
        );
      } catch (err) {
        console.error('detalle falló', f.id, x.externalPath, String(err));
      }
    });
    for (let i = 0; i < pendientes.length; i += 50) await env.DB.batch(pendientes.slice(i, i + 50));
    res.nuevas = insertadas;

    // 5. Cerrar las que ya no aparecen. Solo si la lectura fue completa (una falla no cierra nada) y si
    // tampoco apareció en la lectura anterior: no se ve desde hace más de 30 horas. La fecha de cierre
    // es el último día en que se vio.
    if (res.estado === 'ok') {
      const limite = new Date(Date.parse(ahora) - 30 * 3600 * 1000).toISOString();
      const activas = await env.DB.prepare('SELECT id, ultima_vez FROM vacantes WHERE fuente = ? AND activa = 1 AND ultima_vez < ?')
        .bind(f.id, limite)
        .all<{ id: string; ultima_vez: string }>();
      const cerrar = ((activas.results ?? []) as Array<{ id: string; ultima_vez: string }>).filter((r) => !vistos.has(r.id));
      const totalActivas = await env.DB.prepare('SELECT COUNT(*) AS n FROM vacantes WHERE fuente = ? AND activa = 1').bind(f.id).first<{ n: number }>();
      if (cerrar.length > 5 && cerrar.length > (totalActivas?.n ?? 0) * 0.3) {
        // Cerrar más del 30 % de una fuente en un día no es normal: se deja para revisión.
        res.estado = 'sospechosa';
        res.error = `pretendía cerrar ${cerrar.length} de ${totalActivas?.n}`;
      } else {
        const cls = env.DB.prepare('UPDATE vacantes SET activa = 0, fecha_cierre = ?, cerrada_en = ? WHERE id = ?');
        const stmts = cerrar.flatMap((r) => [cls.bind(r.ultima_vez.slice(0, 10), ahora, r.id), ciclo.bind(r.id, ahora, 'cierre', null)]);
        for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
        res.cerradas = cerrar.length;
      }
    }
  } catch (err) {
    res.estado = 'error';
    res.error = String(err).slice(0, 300);
  }
  try {
    await env.DB.prepare(
      'INSERT INTO vacantes_corridas (ts, fuente, estado, vistas, nuevas, cerradas, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(ahora, res.fuente, res.estado, res.vistas, res.nuevas, res.cerradas, res.error ?? null)
      .run();
  } catch (err) {
    console.error('bitácora falló', f.id, String(err));
  }
  return res;
}

/**
 * Foto diaria agregada: activas por fuente, país, rol y nivel con la versión de reglas del día.
 * Excluye bancos de talento. Cada país cuenta las vacantes que lo incluyen entre sus ubicaciones
 * (activas) y, aparte, las que lo tienen como ubicación principal (activas_principal).
 */
async function fotoDiaria(env: Env, ahora: string): Promise<void> {
  const fecha = ahora.slice(0, 10);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM vacantes_diario WHERE fecha = ?').bind(fecha),
    env.DB.prepare(
      `INSERT INTO vacantes_diario (fecha, fuente, pais, rol, nivel, activas, activas_principal, reglas)
       SELECT ?, v.fuente, p.k, v.rol, v.nivel, COUNT(*),
              SUM(CASE WHEN v.pais_principal_iso = p.k THEN 1 ELSE 0 END), ?
       FROM vacantes v
       JOIN (SELECT 'mx' AS k UNION ALL SELECT 'br' UNION ALL SELECT 'ar' UNION ALL SELECT 'co'
             UNION ALL SELECT 'cl' UNION ALL SELECT 'pe' UNION ALL SELECT 'es') p
         ON (',' || v.paises || ',') LIKE '%,' || p.k || ',%'
       WHERE v.activa = 1 AND COALESCE(v.tipo_publicacion, 'vacante') = 'vacante'
       GROUP BY v.fuente, p.k, v.rol, v.nivel`,
    ).bind(fecha, `${CLASIFICACION_VERSION}/${DESCRIPTORES_VERSION}`),
  ]);
}

async function correr(env: Env, soloFuente?: string): Promise<Resultado[]> {
  const ahora = new Date().toISOString();
  const fuentes = soloFuente ? FUENTES.filter((f) => f.id === soloFuente) : FUENTES;
  const out: Resultado[] = [];
  for (const f of fuentes) out.push(await leerFuente(env, f, ahora)); // una fuente a la vez: amable con los portales
  try {
    await fotoDiaria(env, ahora);
  } catch (err) {
    console.error('foto diaria falló', String(err));
  }
  return out;
}

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const r = await correr(env);
    const reproc = await reprocesar(env);
    if (reproc > 0) await fotoDiaria(env, new Date().toISOString()); // la foto del día con las reglas vigentes
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
