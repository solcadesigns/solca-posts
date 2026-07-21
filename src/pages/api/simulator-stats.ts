/**
 * Endpoint agregador de métricas del Simulador de Entrevistas (Fase 1.4.D · 19 jun 2026).
 *
 * Consulta D1 (tabla sessions + session_tags) y devuelve KPIs agregados
 * en 5 grupos según §7.16.2 del SIMULADOR_ENTREVISTAS_ADDENDUM.md:
 *
 *  1. Uso del producto      (sesiones, completitud, duración, etapas)
 *  2. Calidad del simulador (scores, vocab ausente top, preguntas reprobadas, match)
 *  3. Editoriales           (% sin ICH-GCP, áreas, gaps comunes)
 *  4. Conversión y negocio  (% con CV, scores por etapa)
 *  5. Demográficos          (edad, género, match rol-demografía)
 *
 * Auth: query param ?key= debe coincidir con env.STATS_KEY (mismo patrón
 * que /api/cv-stats y /api/quiz-stats).
 *
 * Mismo endpoint sirve al dashboard interno (/admin/simulator-metrics) y
 * al cron semanal (Fase 1.4.E) reusando estas queries.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

interface DistributionMap {
  [bucket: string]: number;
}

interface TopTag {
  tag: string;
  n: number;
}

interface ScoreStats {
  avg: number | null;
  count: number;
}

interface SimulatorStats {
  generated_at: string;
  range: { earliest_ts: number | null; latest_ts: number | null };
  total_sessions: number;
  // 1. Uso del producto
  uso: {
    iniciadas: number;
    completadas: number;
    completitud_pct: number;
    duracion_promedio_seg: number | null;
    respuesta_promedio_seg: number | null;
    por_etapa: DistributionMap;
    sesiones_por_semana: Array<{ semana: string; n: number }>;
  };
  // 2. Calidad del simulador
  calidad: {
    score_tecnico: ScoreStats;
    score_estructura: ScoreStats;
    score_especificidad: ScoreStats;
    alertas_promedio: number | null;
    rol_y_match: DistributionMap;
    top_vocab_ausente: TopTag[];
    top_preguntas_reprobadas: TopTag[];
    top_gaps_detectados: TopTag[];
  };
  // 3. Editoriales (insights para Solca Insight)
  editoriales: {
    pct_sin_ich_gcp: number | null;       // % de sesiones donde ICH-GCP está en vocab_ausente
    pct_sin_star: number | null;          // % de sesiones donde STAR es gap
    distribucion_area_formacion: DistributionMap;
    distribucion_anios_experiencia: DistributionMap;
    distribucion_pais: DistributionMap;
  };
  // 4. Conversión y negocio
  negocio: {
    pct_con_cv_personalizado: number | null;
    scores_por_etapa: Record<
      string,
      { tecnico: number | null; estructura: number | null; especificidad: number | null; n: number }
    >;
    distribucion_focus: DistributionMap;
    distribucion_idioma: DistributionMap;
    distribucion_numero_preguntas: DistributionMap;
  };
  // 5. Demográficos
  demograficos: {
    submitted_count: number;
    submitted_pct: number | null;
    distribucion_edad: DistributionMap;
    distribucion_genero: DistributionMap;
    match_rol_por_edad: Record<string, DistributionMap>;
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function emptyStats(): SimulatorStats {
  return {
    generated_at: new Date().toISOString(),
    range: { earliest_ts: null, latest_ts: null },
    total_sessions: 0,
    uso: {
      iniciadas: 0,
      completadas: 0,
      completitud_pct: 0,
      duracion_promedio_seg: null,
      respuesta_promedio_seg: null,
      por_etapa: {},
      sesiones_por_semana: [],
    },
    calidad: {
      score_tecnico: { avg: null, count: 0 },
      score_estructura: { avg: null, count: 0 },
      score_especificidad: { avg: null, count: 0 },
      alertas_promedio: null,
      rol_y_match: {},
      top_vocab_ausente: [],
      top_preguntas_reprobadas: [],
      top_gaps_detectados: [],
    },
    editoriales: {
      pct_sin_ich_gcp: null,
      pct_sin_star: null,
      distribucion_area_formacion: {},
      distribucion_anios_experiencia: {},
      distribucion_pais: {},
    },
    negocio: {
      pct_con_cv_personalizado: null,
      scores_por_etapa: {},
      distribucion_focus: {},
      distribucion_idioma: {},
      distribucion_numero_preguntas: {},
    },
    demograficos: {
      submitted_count: 0,
      submitted_pct: null,
      distribucion_edad: {},
      distribucion_genero: {},
      match_rol_por_edad: {},
    },
  };
}

// Helpers de SQL → DistributionMap
function rowsToDistribution(rows: Array<Record<string, unknown>>, keyCol: string, countCol = 'n'): DistributionMap {
  const out: DistributionMap = {};
  for (const r of rows) {
    const k = r[keyCol];
    if (k === null || k === undefined) continue;
    const v = Number(r[countCol] ?? 0);
    out[String(k)] = v;
  }
  return out;
}

function rowsToTopTags(rows: Array<Record<string, unknown>>): TopTag[] {
  return rows.map((r) => ({ tag: String(r.tag_value ?? ''), n: Number(r.n ?? 0) }));
}

async function computeStats(db: D1Database): Promise<SimulatorStats> {
  const stats = emptyStats();

  // ───── Totals & rango temporal ─────
  const totalsRow = await db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completadas,
        AVG(sesion_duracion_total_seg) AS dur_avg,
        AVG(respuesta_promedio_seg) AS resp_avg,
        MIN(ts) AS earliest,
        MAX(ts) AS latest
      FROM sessions`,
    )
    .first<{
      total: number;
      completadas: number;
      dur_avg: number | null;
      resp_avg: number | null;
      earliest: number | null;
      latest: number | null;
    }>();

  stats.total_sessions = totalsRow?.total ?? 0;
  stats.range.earliest_ts = totalsRow?.earliest ?? null;
  stats.range.latest_ts = totalsRow?.latest ?? null;
  stats.uso.iniciadas = totalsRow?.total ?? 0;
  stats.uso.completadas = totalsRow?.completadas ?? 0;
  stats.uso.completitud_pct = totalsRow?.total
    ? +((totalsRow.completadas / totalsRow.total) * 100).toFixed(1)
    : 0;
  stats.uso.duracion_promedio_seg = totalsRow?.dur_avg ?? null;
  stats.uso.respuesta_promedio_seg = totalsRow?.resp_avg ?? null;

  if (stats.total_sessions === 0) {
    return stats;
  }

  // ───── 1. Uso del producto ─────
  const etapaRows = await db
    .prepare('SELECT etapa, COUNT(*) AS n FROM sessions GROUP BY etapa')
    .all();
  stats.uso.por_etapa = rowsToDistribution(etapaRows.results as Array<Record<string, unknown>>, 'etapa');

  // Sesiones por semana ISO (últimas 12 semanas)
  const semanaRows = await db
    .prepare(
      `SELECT strftime('%Y-W%W', ts / 1000, 'unixepoch') AS semana, COUNT(*) AS n
       FROM sessions
       GROUP BY semana
       ORDER BY semana DESC
       LIMIT 12`,
    )
    .all();
  stats.uso.sesiones_por_semana = (semanaRows.results as Array<{ semana: string; n: number }>)
    .map((r) => ({ semana: r.semana, n: Number(r.n) }))
    .reverse();

  // ───── 2. Calidad del simulador ─────
  const scoreRow = await db
    .prepare(
      `SELECT
        AVG(score_tecnico) AS tec_avg, COUNT(score_tecnico) AS tec_n,
        AVG(score_estructura) AS est_avg, COUNT(score_estructura) AS est_n,
        AVG(score_especificidad) AS esp_avg, COUNT(score_especificidad) AS esp_n,
        AVG(alertas_count) AS alertas_avg
      FROM sessions
      WHERE completed = 1`,
    )
    .first<{
      tec_avg: number | null; tec_n: number;
      est_avg: number | null; est_n: number;
      esp_avg: number | null; esp_n: number;
      alertas_avg: number | null;
    }>();
  if (scoreRow) {
    stats.calidad.score_tecnico = { avg: scoreRow.tec_avg, count: scoreRow.tec_n };
    stats.calidad.score_estructura = { avg: scoreRow.est_avg, count: scoreRow.est_n };
    stats.calidad.score_especificidad = { avg: scoreRow.esp_avg, count: scoreRow.esp_n };
    stats.calidad.alertas_promedio = scoreRow.alertas_avg;
  }

  const matchRows = await db
    .prepare('SELECT rol_y_match, COUNT(*) AS n FROM sessions WHERE rol_y_match IS NOT NULL GROUP BY rol_y_match')
    .all();
  stats.calidad.rol_y_match = rowsToDistribution(matchRows.results as Array<Record<string, unknown>>, 'rol_y_match');

  const topVocabRows = await db
    .prepare(
      `SELECT tag_value, COUNT(*) AS n
       FROM session_tags
       WHERE tag_type = 'vocab_ausente'
       GROUP BY tag_value
       ORDER BY n DESC
       LIMIT 10`,
    )
    .all();
  stats.calidad.top_vocab_ausente = rowsToTopTags(topVocabRows.results as Array<Record<string, unknown>>);

  const topPregRows = await db
    .prepare(
      `SELECT tag_value, COUNT(*) AS n
       FROM session_tags
       WHERE tag_type = 'pregunta_reprobada'
       GROUP BY tag_value
       ORDER BY n DESC
       LIMIT 10`,
    )
    .all();
  stats.calidad.top_preguntas_reprobadas = rowsToTopTags(topPregRows.results as Array<Record<string, unknown>>);

  const topGapsRows = await db
    .prepare(
      `SELECT tag_value, COUNT(*) AS n
       FROM session_tags
       WHERE tag_type = 'gap'
       GROUP BY tag_value
       ORDER BY n DESC
       LIMIT 10`,
    )
    .all();
  stats.calidad.top_gaps_detectados = rowsToTopTags(topGapsRows.results as Array<Record<string, unknown>>);

  // ───── 3. Editoriales ─────
  // % sin ICH-GCP: sesiones donde ICH-GCP aparece como vocab_ausente / total sesiones
  const ichRow = await db
    .prepare(
      `SELECT COUNT(DISTINCT session_id) AS n
       FROM session_tags
       WHERE tag_type = 'vocab_ausente' AND tag_value LIKE 'ICH-GCP%'`,
    )
    .first<{ n: number }>();
  stats.editoriales.pct_sin_ich_gcp =
    stats.total_sessions > 0 && ichRow ? +((ichRow.n / stats.total_sessions) * 100).toFixed(1) : null;

  const starRow = await db
    .prepare(
      `SELECT COUNT(DISTINCT session_id) AS n
       FROM session_tags
       WHERE tag_type = 'gap' AND (tag_value LIKE '%STAR%' OR tag_value LIKE '%star%')`,
    )
    .first<{ n: number }>();
  stats.editoriales.pct_sin_star =
    stats.total_sessions > 0 && starRow ? +((starRow.n / stats.total_sessions) * 100).toFixed(1) : null;

  const areaRows = await db
    .prepare('SELECT area_formacion, COUNT(*) AS n FROM sessions GROUP BY area_formacion ORDER BY n DESC')
    .all();
  stats.editoriales.distribucion_area_formacion = rowsToDistribution(
    areaRows.results as Array<Record<string, unknown>>,
    'area_formacion',
  );

  const expRows = await db
    .prepare('SELECT anios_experiencia, COUNT(*) AS n FROM sessions GROUP BY anios_experiencia')
    .all();
  stats.editoriales.distribucion_anios_experiencia = rowsToDistribution(
    expRows.results as Array<Record<string, unknown>>,
    'anios_experiencia',
  );

  const paisRows = await db
    .prepare('SELECT pais_inferido, COUNT(*) AS n FROM sessions WHERE pais_inferido IS NOT NULL GROUP BY pais_inferido')
    .all();
  stats.editoriales.distribucion_pais = rowsToDistribution(
    paisRows.results as Array<Record<string, unknown>>,
    'pais_inferido',
  );

  // ───── 4. Conversión y negocio ─────
  const cvRow = await db
    .prepare('SELECT SUM(has_cv_summary) AS n_cv, COUNT(*) AS n_total FROM sessions')
    .first<{ n_cv: number; n_total: number }>();
  stats.negocio.pct_con_cv_personalizado =
    cvRow && cvRow.n_total > 0 ? +((cvRow.n_cv / cvRow.n_total) * 100).toFixed(1) : null;

  const scoresPorEtapaRows = await db
    .prepare(
      `SELECT etapa,
              AVG(score_tecnico) AS tec, AVG(score_estructura) AS est,
              AVG(score_especificidad) AS esp, COUNT(*) AS n
       FROM sessions
       WHERE completed = 1
       GROUP BY etapa`,
    )
    .all();
  for (const r of scoresPorEtapaRows.results as Array<{
    etapa: string; tec: number | null; est: number | null; esp: number | null; n: number;
  }>) {
    stats.negocio.scores_por_etapa[r.etapa] = {
      tecnico: r.tec,
      estructura: r.est,
      especificidad: r.esp,
      n: Number(r.n),
    };
  }

  const focusRows = await db.prepare('SELECT focus, COUNT(*) AS n FROM sessions GROUP BY focus').all();
  stats.negocio.distribucion_focus = rowsToDistribution(
    focusRows.results as Array<Record<string, unknown>>,
    'focus',
  );

  const idiomaRows = await db.prepare('SELECT idioma, COUNT(*) AS n FROM sessions GROUP BY idioma').all();
  stats.negocio.distribucion_idioma = rowsToDistribution(
    idiomaRows.results as Array<Record<string, unknown>>,
    'idioma',
  );

  const nPregRows = await db
    .prepare('SELECT numero_preguntas, COUNT(*) AS n FROM sessions GROUP BY numero_preguntas')
    .all();
  stats.negocio.distribucion_numero_preguntas = rowsToDistribution(
    nPregRows.results as Array<Record<string, unknown>>,
    'numero_preguntas',
  );

  // ───── 5. Demográficos ─────
  const demoRow = await db
    .prepare('SELECT COUNT(*) AS n FROM sessions WHERE demographics_submitted_at IS NOT NULL')
    .first<{ n: number }>();
  stats.demograficos.submitted_count = demoRow?.n ?? 0;
  stats.demograficos.submitted_pct =
    stats.total_sessions > 0 && demoRow
      ? +((demoRow.n / stats.total_sessions) * 100).toFixed(1)
      : null;

  const edadRows = await db
    .prepare('SELECT edad_rango, COUNT(*) AS n FROM sessions WHERE edad_rango IS NOT NULL GROUP BY edad_rango')
    .all();
  stats.demograficos.distribucion_edad = rowsToDistribution(
    edadRows.results as Array<Record<string, unknown>>,
    'edad_rango',
  );

  const generoRows = await db
    .prepare('SELECT genero, COUNT(*) AS n FROM sessions WHERE genero IS NOT NULL GROUP BY genero')
    .all();
  stats.demograficos.distribucion_genero = rowsToDistribution(
    generoRows.results as Array<Record<string, unknown>>,
    'genero',
  );

  const matchEdadRows = await db
    .prepare(
      `SELECT edad_rango, rol_y_match, COUNT(*) AS n
       FROM sessions
       WHERE edad_rango IS NOT NULL AND rol_y_match IS NOT NULL
       GROUP BY edad_rango, rol_y_match`,
    )
    .all();
  for (const r of matchEdadRows.results as Array<{ edad_rango: string; rol_y_match: string; n: number }>) {
    if (!stats.demograficos.match_rol_por_edad[r.edad_rango]) {
      stats.demograficos.match_rol_por_edad[r.edad_rango] = {};
    }
    stats.demograficos.match_rol_por_edad[r.edad_rango][r.rol_y_match] = Number(r.n);
  }

  return stats;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env;

  const expectedKey = env?.STATS_KEY as string | undefined;
  if (!expectedKey) {
    return jsonResponse({ error: 'stats_disabled' }, 503);
  }
  const providedKey = url.searchParams.get('key');
  if (providedKey !== expectedKey) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const db = env?.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (!db) {
    return jsonResponse(
      { error: 'd1_missing', message: 'SIMULATOR_METRICS_DB binding no enlazado.' },
      503,
    );
  }

  try {
    const stats = await computeStats(db);
    return jsonResponse(stats, 200);
  } catch (err) {
    console.error('simulator-stats failed:', err);
    return jsonResponse({ error: 'internal', message: (err as Error)?.message }, 500);
  }
};
