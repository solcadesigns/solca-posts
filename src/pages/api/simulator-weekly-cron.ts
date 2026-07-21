/**
 * Cron semanal del Simulador de Entrevistas (Fase 1.4.E · 19 jun 2026).
 *
 * Dispara los lunes a las 8 AM CDMX (14:00 UTC) vía Cloudflare Cron Trigger
 * (configurado en wrangler.jsonc; el wrapper `worker-entry.mjs` reenvía el
 * evento `scheduled` a este endpoint).
 *
 * Lógica:
 *   1. Calcula la ventana de la semana anterior (lunes 00:00 → domingo 23:59 UTC).
 *   2. Consulta D1: total/completadas, scores promedio, top vocab ausente,
 *      top preguntas reprobadas, distribución por área y rol.
 *   3. Guarda el digest en KV SIMULATOR_METRICS con clave `digest:YYYY-WNN`
 *      (TTL 365 días — historial anual).
 *   4. TODO opcional: enviar email a hello@solcaciencia.com via MailerSend
 *      cuando exista env.MAILERSEND_API_KEY (no bloqueante).
 *   5. Devuelve JSON con el digest para debug manual.
 *
 * Auth: ?key= debe coincidir con env.STATS_KEY. Esto cubre tanto invocación
 * manual como llamadas desde el wrapper del cron (que pasa el key del env).
 *
 * Modos:
 *   - POST (default): genera y guarda el digest de la semana anterior.
 *   - GET ?show=latest: muestra el último digest guardado (no recomputa).
 *   - GET ?show=list: lista las últimas 12 claves digest disponibles.
 *
 * URL típica:
 *   POST https://solcaciencia.com/api/simulator-weekly-cron?key=<STATS_KEY>
 */

import type { APIRoute } from 'astro';

export const prerender = false;

interface WeeklyDigest {
  generated_at: string;
  week_iso: string;
  range: { start_iso: string; end_iso: string };
  totals: {
    sessions_iniciadas: number;
    sessions_completadas: number;
    completitud_pct: number | null;
    duracion_promedio_seg: number | null;
  };
  scores: {
    tecnico: number | null;
    estructura: number | null;
    especificidad: number | null;
    alertas_promedio: number | null;
  };
  top_vocab_ausente: Array<{ tag: string; n: number }>;
  top_preguntas_reprobadas: Array<{ tag: string; n: number }>;
  top_gaps: Array<{ tag: string; n: number }>;
  distribucion_area: Record<string, number>;
  distribucion_rol: Record<string, number>;
  distribucion_etapa: Record<string, number>;
  notas: string[];
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * Calcula la ventana semanal previa (lunes 00:00 UTC → domingo 23:59:59 UTC)
 * desde "ahora". Devuelve también la etiqueta ISO YYYY-WNN.
 */
function previousWeekWindow(now: Date): { startMs: number; endMs: number; weekIso: string } {
  // Encuentra el lunes 00:00 UTC de ESTA semana
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay: domingo=0, lunes=1, ... sábado=6
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // 0 = lunes, 6 = domingo
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  // Semana previa = una semana antes
  const startThis = d.getTime();
  const startPrev = startThis - 7 * 24 * 3600 * 1000;
  const endPrev = startThis - 1; // un milisegundo antes del lunes actual

  // Etiqueta ISO YYYY-WNN — el AÑO ISO puede no coincidir con el año
  // calendario cuando la semana cruza enero (ej. semana del 29 dic 2025 al 4 ene 2026 = 2026-W01).
  const { year, week } = getIsoYearWeek(new Date(startPrev));
  const weekIso = `${year}-W${String(week).padStart(2, '0')}`;

  return { startMs: startPrev, endMs: endPrev, weekIso };
}

/**
 * Devuelve año ISO + número de semana ISO para una fecha (ISO 8601).
 * Algoritmo estándar: la semana N de año Y es la que contiene el primer jueves de Y.
 * Para fechas a fin/principio de año, el año ISO puede diferir del año calendario.
 */
function getIsoYearWeek(date: Date): { year: number; week: number } {
  // Copia inmutable
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Mover al jueves más cercano (domingo cuenta como día 7)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const isoYear = d.getUTCFullYear();
  // Inicio del año ISO (1 de enero del año del jueves)
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  // Número de semana = ceil(días desde inicio de año / 7)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: isoYear, week };
}

async function computeWeeklyDigest(db: D1Database, startMs: number, endMs: number): Promise<Omit<WeeklyDigest, 'generated_at' | 'week_iso' | 'range' | 'notas'>> {
  // Totales y duración
  const totals = await db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completadas,
        AVG(CASE WHEN completed = 1 THEN sesion_duracion_total_seg END) AS dur_avg
       FROM sessions
       WHERE ts >= ? AND ts <= ?`,
    )
    .bind(startMs, endMs)
    .first<{ total: number; completadas: number; dur_avg: number | null }>();

  // Scores promedio (sesiones completadas en la ventana)
  const scoresRow = await db
    .prepare(
      `SELECT AVG(score_tecnico) tec, AVG(score_estructura) est,
              AVG(score_especificidad) esp, AVG(alertas_count) alertas
       FROM sessions
       WHERE ts >= ? AND ts <= ? AND completed = 1`,
    )
    .bind(startMs, endMs)
    .first<{ tec: number | null; est: number | null; esp: number | null; alertas: number | null }>();

  // Top vocab ausente (joins con sessions para limitar al rango)
  const topVocab = await db
    .prepare(
      `SELECT t.tag_value, COUNT(*) AS n
       FROM session_tags t
       JOIN sessions s ON s.session_id = t.session_id
       WHERE t.tag_type = 'vocab_ausente' AND s.ts >= ? AND s.ts <= ?
       GROUP BY t.tag_value
       ORDER BY n DESC LIMIT 10`,
    )
    .bind(startMs, endMs)
    .all();

  const topPreg = await db
    .prepare(
      `SELECT t.tag_value, COUNT(*) AS n
       FROM session_tags t
       JOIN sessions s ON s.session_id = t.session_id
       WHERE t.tag_type = 'pregunta_reprobada' AND s.ts >= ? AND s.ts <= ?
       GROUP BY t.tag_value
       ORDER BY n DESC LIMIT 10`,
    )
    .bind(startMs, endMs)
    .all();

  const topGaps = await db
    .prepare(
      `SELECT t.tag_value, COUNT(*) AS n
       FROM session_tags t
       JOIN sessions s ON s.session_id = t.session_id
       WHERE t.tag_type = 'gap' AND s.ts >= ? AND s.ts <= ?
       GROUP BY t.tag_value
       ORDER BY n DESC LIMIT 10`,
    )
    .bind(startMs, endMs)
    .all();

  const byArea = await db
    .prepare(
      `SELECT area_formacion, COUNT(*) AS n
       FROM sessions
       WHERE ts >= ? AND ts <= ?
       GROUP BY area_formacion ORDER BY n DESC`,
    )
    .bind(startMs, endMs)
    .all();

  const byRol = await db
    .prepare(
      `SELECT rol_apuntado, COUNT(*) AS n
       FROM sessions
       WHERE ts >= ? AND ts <= ?
       GROUP BY rol_apuntado ORDER BY n DESC`,
    )
    .bind(startMs, endMs)
    .all();

  const byEtapa = await db
    .prepare(
      `SELECT etapa, COUNT(*) AS n
       FROM sessions
       WHERE ts >= ? AND ts <= ?
       GROUP BY etapa ORDER BY n DESC`,
    )
    .bind(startMs, endMs)
    .all();

  const total = totals?.total ?? 0;
  const completadas = totals?.completadas ?? 0;

  function toMap(rows: Array<Record<string, unknown>>, keyCol: string): Record<string, number> {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const k = r[keyCol];
      if (k == null) continue;
      m[String(k)] = Number(r.n ?? 0);
    }
    return m;
  }
  function toTopList(rows: Array<Record<string, unknown>>): Array<{ tag: string; n: number }> {
    return rows.map((r) => ({ tag: String(r.tag_value ?? ''), n: Number(r.n ?? 0) }));
  }

  return {
    totals: {
      sessions_iniciadas: total,
      sessions_completadas: completadas,
      completitud_pct: total > 0 ? +((completadas / total) * 100).toFixed(1) : null,
      duracion_promedio_seg: totals?.dur_avg ?? null,
    },
    scores: {
      tecnico: scoresRow?.tec ?? null,
      estructura: scoresRow?.est ?? null,
      especificidad: scoresRow?.esp ?? null,
      alertas_promedio: scoresRow?.alertas ?? null,
    },
    top_vocab_ausente: toTopList(topVocab.results as Array<Record<string, unknown>>),
    top_preguntas_reprobadas: toTopList(topPreg.results as Array<Record<string, unknown>>),
    top_gaps: toTopList(topGaps.results as Array<Record<string, unknown>>),
    distribucion_area: toMap(byArea.results as Array<Record<string, unknown>>, 'area_formacion'),
    distribucion_rol: toMap(byRol.results as Array<Record<string, unknown>>, 'rol_apuntado'),
    distribucion_etapa: toMap(byEtapa.results as Array<Record<string, unknown>>, 'etapa'),
  };
}

async function runWeeklyDigest(env: Record<string, unknown>): Promise<WeeklyDigest> {
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  const kv = env.SIMULATOR_METRICS as KVNamespace | undefined;
  if (!db) throw new Error('SIMULATOR_METRICS_DB binding no enlazado');

  const now = new Date();
  const { startMs, endMs, weekIso } = previousWeekWindow(now);

  const partial = await computeWeeklyDigest(db, startMs, endMs);

  const notas: string[] = [];
  if (partial.totals.sessions_iniciadas === 0) {
    notas.push('No hubo sesiones en la ventana. Posibles causas: producto en silencio, semana de feriado, o todavía no llegan los primeros beta.');
  }
  if (partial.scores.estructura !== null && partial.scores.estructura < 3) {
    notas.push('Score promedio de estructura < 3 · señal de que el banco semilla debería incluir más ejemplos STAR o el system prompt debería reforzar la regla de estructura.');
  }
  if (partial.top_vocab_ausente.some((v) => v.tag.toLowerCase().includes('ich-gcp') && v.n >= 3)) {
    notas.push('ICH-GCP ausente en al menos 3 sesiones · candidato fuerte para newsletter Solca Insight.');
  }

  const digest: WeeklyDigest = {
    generated_at: now.toISOString(),
    week_iso: weekIso,
    range: { start_iso: new Date(startMs).toISOString(), end_iso: new Date(endMs).toISOString() },
    notas,
    ...partial,
  };

  // Guardar en KV con TTL 365 días
  if (kv) {
    await kv.put(`digest:${weekIso}`, JSON.stringify(digest), {
      expirationTtl: 365 * 24 * 3600,
    });
  }

  // TODO opcional · envío de email via MailerSend (transactional)
  // Cuando env.MAILERSEND_API_KEY esté presente:
  //   await sendDigestEmail(env.MAILERSEND_API_KEY, 'hello@solcaciencia.com', digest);
  // Mientras tanto: consulta /api/simulator-weekly-cron?show=latest o ve a /admin/simulator-metrics.

  return digest;
}

async function listRecentDigests(kv: KVNamespace, limit = 12): Promise<string[]> {
  const result = await kv.list({ prefix: 'digest:', limit });
  return result.keys.map((k) => k.name);
}

async function getLatestDigest(kv: KVNamespace): Promise<WeeklyDigest | null> {
  // KV no ordena por nombre; los digest IDs siguen formato YYYY-WNN que es lexicográfico ascendente.
  // Para obtener el más reciente, listamos y tomamos el último alfabético.
  const result = await kv.list({ prefix: 'digest:', limit: 1000 });
  if (!result.keys.length) return null;
  const sorted = result.keys.map((k) => k.name).sort();
  const latest = sorted[sorted.length - 1];
  const raw = await kv.get(latest);
  return raw ? (JSON.parse(raw) as WeeklyDigest) : null;
}

export const POST: APIRoute = async ({ url, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};

  const expectedKey = env.STATS_KEY as string | undefined;
  if (!expectedKey) return jsonResponse({ error: 'stats_disabled' }, 503);
  const providedKey = url.searchParams.get('key');
  if (providedKey !== expectedKey) return jsonResponse({ error: 'unauthorized' }, 401);

  try {
    const digest = await runWeeklyDigest(env);
    return jsonResponse({ ok: true, digest }, 200);
  } catch (err) {
    console.error('weekly-cron POST failed:', err);
    return jsonResponse({ error: 'internal', message: (err as Error)?.message }, 500);
  }
};

export const GET: APIRoute = async ({ url, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};

  const expectedKey = env.STATS_KEY as string | undefined;
  if (!expectedKey) return jsonResponse({ error: 'stats_disabled' }, 503);
  const providedKey = url.searchParams.get('key');
  if (providedKey !== expectedKey) return jsonResponse({ error: 'unauthorized' }, 401);

  const kv = env.SIMULATOR_METRICS as KVNamespace | undefined;
  if (!kv) return jsonResponse({ error: 'kv_missing' }, 503);

  const show = url.searchParams.get('show') ?? 'latest';
  try {
    if (show === 'list') {
      const keys = await listRecentDigests(kv);
      return jsonResponse({ keys }, 200);
    }
    if (show === 'latest') {
      const latest = await getLatestDigest(kv);
      return jsonResponse({ latest }, 200);
    }
    // Especifico: ?show=2026-W25
    const raw = await kv.get(`digest:${show}`);
    return jsonResponse({ digest: raw ? JSON.parse(raw) : null }, 200);
  } catch (err) {
    console.error('weekly-cron GET failed:', err);
    return jsonResponse({ error: 'internal', message: (err as Error)?.message }, 500);
  }
};

// Exportada para que el wrapper del cron (worker-entry.mjs) la pueda invocar
// directamente sin pasar por HTTP (modo "internal").
export { runWeeklyDigest };
