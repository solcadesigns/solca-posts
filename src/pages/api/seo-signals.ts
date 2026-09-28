// /api/seo-signals · señales editoriales en vivo desde Google Search Console.
//
// Por qué existe (21 sep 2026): el backlog del blog (_docs/BLOG_BACKLOG.md) se
// arma con exports manuales de CSV de GSC. El último es del 14 sep 2026. La
// tarea agendada de los lunes elige tema de esa lista, que envejece sola,
// mientras la API de lectura de GSC ya estaba conectada desde el 10 ago y
// nadie la consultaba para decidir contenido.
//
// Este endpoint no da "el reporte de la semana" (eso es /api/weekly-report).
// Da exactamente los cuatro insumos de la decisión editorial del lunes:
//
//   1. oportunidades_query  queries con impresiones y CERO clicks → intención
//                           de búsqueda que ya nos ve y no nos abre. Es de
//                           donde salen los temas nuevos.
//   2. fixes_pagina         páginas con impresiones altas y CTR bajo → rankean
//                           pero nadie entra. Reescribir title/meta/TL;DR rinde
//                           más que un post nuevo. Es el criterio que generó
//                           los P0/P1 de la sección "Fixes al corpus existente".
//   3. ganadoras            páginas con más clicks → para NO canibalizarlas al
//                           elegir keyword. Hoy ese chequeo se hace con grep.
//   4. paises               de dónde viene el tráfico real → decide el ancla
//                           regional (ANMAT vs COFEPRIS, pesos ARG vs MXN).
//
// Auth: ?key= debe coincidir con env.STATS_KEY. Mismo patrón que weekly-report
// y que los paneles de /admin. Read-only: no escribe nada, en ningún lado.
//
// Uso:
//   /api/seo-signals?key=<STATS_KEY>
//   /api/seo-signals?key=...&dias=28&min_impresiones=5&max_ctr=2
import type { APIRoute } from 'astro';
import { getGoogleAccessToken, gscQuery, gscRows, fmtDay, ventanaGsc } from '../../lib/gsc';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

/** Lee un entero del query string con default y tope, para no confiar en la URL. */
const num = (v: string | null, def: number, min: number, max: number) => {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
};

export const GET: APIRoute = async ({ url, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};

  const expectedKey = env.STATS_KEY as string | undefined;
  if (!expectedKey) return json({ error: 'stats_disabled' }, 503);
  if (url.searchParams.get('key') !== expectedKey) {
    return json({ error: 'unauthorized' }, 401);
  }

  const clientEmail = env.GSC_CLIENT_EMAIL as string | undefined;
  const privateKey = env.GSC_PRIVATE_KEY as string | undefined;
  const siteUrl = (env.GSC_SITE_URL as string | undefined) ?? 'sc-domain:solcaciencia.com';

  if (!clientEmail || !privateKey) {
    return json(
      {
        error: 'gsc_no_configurado',
        nota: 'Faltan los secrets GSC_CLIENT_EMAIL y/o GSC_PRIVATE_KEY.',
      },
      503,
    );
  }

  // 90 días por default: ventana larga para que una query con 3 impresiones al
  // mes alcance a aparecer. El research del 14 sep usó exactamente 3 meses.
  const dias = num(url.searchParams.get('dias'), 90, 7, 480);
  // Umbral de ruido. Con menos de 3 impresiones no hay señal, solo azar.
  const minImpresiones = num(url.searchParams.get('min_impresiones'), 3, 1, 1000);
  // CTR por debajo del cual una página cuenta como "rankea pero no la abren".
  const maxCtr = num(url.searchParams.get('max_ctr'), 1.5, 0, 100);

  const { start, end } = ventanaGsc(dias);
  const rango = { startDate: fmtDay(start), endDate: fmtDay(end) };

  try {
    const token = await getGoogleAccessToken(clientEmail, privateKey);

    // rowLimit alto porque el filtrado interesante (clicks === 0) es justo la
    // cola: la API ordena por clicks desc, así que lo que buscamos vive al final.
    const [totalesRaw, queriesRaw, paginasRaw, paisesRaw] = await Promise.all([
      gscQuery(token, siteUrl, { ...rango }),
      gscQuery(token, siteUrl, { ...rango, dimensions: ['query'], rowLimit: 1000 }),
      gscQuery(token, siteUrl, { ...rango, dimensions: ['page'], rowLimit: 500 }),
      gscQuery(token, siteUrl, { ...rango, dimensions: ['country'], rowLimit: 25 }),
    ]);

    const queries = gscRows(queriesRaw);
    const paginas = gscRows(paginasRaw, true);
    const paises = gscRows(paisesRaw);

    const t = totalesRaw[0];
    const totales = {
      clicks: t?.clicks ?? 0,
      impresiones: t?.impressions ?? 0,
      ctr_pct: t?.impressions ? +(((t.ctr ?? 0) * 100).toFixed(2)) : null,
      posicion_media: t?.impressions ? +((t.position ?? 0).toFixed(2)) : null,
    };

    const porImpresiones = (a: { impresiones: number }, b: { impresiones: number }) =>
      b.impresiones - a.impresiones;

    // 1 · Intención que ya nos ve y no nos abre.
    const oportunidades_query = queries
      .filter((q) => q.clicks === 0 && q.impresiones >= minImpresiones)
      .sort(porImpresiones)
      .slice(0, 60);

    // 2 · Rankea pero no convierte el click. Incluye las de cero clicks.
    const fixes_pagina = paginas
      .filter((p) => p.impresiones >= Math.max(minImpresiones, 10) && p.ctr_pct <= maxCtr)
      .sort(porImpresiones)
      .slice(0, 30);

    // 3 · Lo que no hay que canibalizar.
    const ganadoras = paginas
      .filter((p) => p.clicks > 0)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 15);

    return json({
      generado: new Date().toISOString(),
      ventana: { start: rango.startDate, end: rango.endDate, dias, lag_dias: 3 },
      parametros: { min_impresiones: minImpresiones, max_ctr: maxCtr },
      totales,
      conteos: {
        queries_analizadas: queries.length,
        paginas_analizadas: paginas.length,
        oportunidades: oportunidades_query.length,
        fixes: fixes_pagina.length,
      },
      oportunidades_query,
      fixes_pagina,
      ganadoras,
      paises: paises.sort((a, b) => b.clicks - a.clicks).slice(0, 12),
      // Recordatorios para quien consuma esto (incluida la tarea del lunes).
      // Van en el payload a propósito: si el endpoint se lee sin contexto, las
      // reglas de honestidad viajan con los datos.
      advertencias: [
        'Estos números son de GSC y son citables como propios ("según Search Console de solcaciencia.com"). NO son datos de industria ni del mercado pharma: no extrapolar.',
        'rowLimit está topado. Si queries_analizadas llega a 1000, hay cola sin ver y los conteos son un piso, no un total.',
        'La ventana termina hace 3 días por el lag de publicación de GSC.',
      ],
    });
  } catch (err) {
    return json(
      { error: 'gsc_error', detalle: err instanceof Error ? err.message : String(err) },
      502,
    );
  }
};
