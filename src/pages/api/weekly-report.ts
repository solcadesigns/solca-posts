/**
 * Endpoint · Informe semanal de métricas Solca Ciencia (30 jul 2026).
 *
 * Agrega datos de las 4 fuentes propias (KV EMAILS, KV QUIZ_METRICS, KV
 * CV_LIMITS, D1 SIMULATOR_METRICS_DB) en un solo JSON para consumo por el
 * artifact HTML del dashboard interno.
 *
 * Ventana temporal: última semana calendario (7 días desde hoy) vs semana
 * anterior. Todos los deltas se calculan sobre esas dos ventanas.
 *
 * Métricas incluidas:
 *   - top_metric: nuevos suscriptores KV EMAILS última semana + delta
 *   - subscripciones: totales, por fuente (cv/quiz), top países
 *   - quiz_match: completions, distribución rol, agreement, drop-off gate→complete
 *   - cv_review: análisis, únicos vs recurrentes, rate limit hits
 *   - simulator: sesiones, feedback promedios y count textos libres
 *
 * Auth: query param ?key= debe coincidir con env.STATS_KEY (mismo patrón
 * que simulator-stats, quiz-stats, simulator-feedback-texts).
 *
 * NO expone PII (emails, nombres, IPs). Solo agregados.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface WindowStats {
  n: number;
}

interface DeltaStats {
  current: number;
  previous: number;
  delta_abs: number;
  delta_pct: number | null;   // null si previous = 0 (evita división por cero)
}

interface WeeklyReport {
  generated_at: string;
  window: {
    week_current: { start: string; end: string };
    week_previous: { start: string; end: string };
  };
  top_metric: {
    label: string;
    current: number;
    previous: number;
    delta_abs: number;
    delta_pct: number | null;
  };
  subscripciones: {
    total_acumulado: number;
    esta_semana: WindowStats & { por_fuente: Record<string, number> };
    semana_anterior: WindowStats & { por_fuente: Record<string, number> };
    top_paises_acumulado: Array<{ pais: string; n: number }>;
  };
  quiz_match: {
    completions_acumuladas: number;
    esta_semana: number;
    semana_anterior: number;
    distribucion_rol_acumulado: Record<string, number>;
    agreement_rate: number | null;
    // Funnel gate→complete con definiciones estrictas:
    // gates_unique_acumulado = emails únicos que enviaron gate del quiz
    // drop_off_pct = 1 - (completions / gates_unique)
    // repeat_gates = emails que enviaron gate 2+ veces (intentos con abandono)
    gates_unique_acumulado: number;
    drop_off_gate_to_complete_pct: number | null;
    repeat_gates: number;
  };
  cv_review: {
    analisis_acumulados: number;
    esta_semana: number;
    semana_anterior: number;
    emails_unicos_acumulado: number;
  };
  simulator: {
    sesiones_acumuladas: number;
    esta_semana: number;
    completitud_pct: number;
    duracion_promedio_min: number | null;
    feedback_total: number;
    feedback_con_texto_util: number;
    avg_realismo: number | null;
    avg_utilidad: number | null;
    avg_facilidad: number | null;
  };
  // Postmark Analytics — se llena si POSTMARK_SERVER_TOKEN está presente.
  // Datos de últimos 30 días por tag. Requiere Open + Link tracking activo
  // en Server Settings (activado el 30 jul 2026); data acumula desde esa fecha.
  email_health: {
    ventana_dias: number;
    por_tag: Record<string, EmailTagStats>;
    disponible: boolean;
    nota?: string;
  };
  // Cloudflare Web Analytics · trafficos del edge del dominio.
  // Requiere CLOUDFLARE_ANALYTICS_TOKEN (secret) + SOLCACIENCIA_ZONE_ID (var pública).
  traffic: {
    disponible: boolean;
    ventana_dias: number;
    page_views_esta_semana: number;
    page_views_semana_anterior: number;
    unique_visitors_esta_semana: number;
    unique_visitors_semana_anterior: number;
    top_paginas: Array<{ path: string; views: number }>;
    top_referrers: Array<{ referrer: string; views: number }>;
    top_paises: Array<{ pais: string; views: number }>;
    nota?: string;
  };
}

interface EmailTagStats {
  sent: number;
  bounced: number;
  bounce_rate_pct: number;
  spam_complaints: number;
  opens_unique: number;
  open_rate_pct: number | null;    // null si tracking está OFF o sent=0
  clicks_unique: number;
  click_rate_pct: number | null;   // idem
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function computeDelta(current: number, previous: number): DeltaStats {
  const delta_abs = current - previous;
  const delta_pct = previous === 0 ? null : +((delta_abs / previous) * 100).toFixed(1);
  return { current, previous, delta_abs, delta_pct };
}

interface EmailRec {
  email?: string;
  ts?: string;
  country?: string;
  stage?: 'gate' | 'complete';
}

interface QuizRec {
  ts: string;
  role?: 'PM' | 'MSL' | 'CR';
  selfMatch?: 'PM' | 'MSL' | 'CR' | 'NS';
}

/**
 * Consulta Postmark Analytics para un tag específico en los últimos N días.
 * Retorna null si la llamada falla o si el token no está.
 *
 * Postmark endpoints:
 *   - GET /stats/outbound?tag=X&fromdate=&todate=
 *     → Sent, Bounced, SpamComplaints, BounceRate
 *   - GET /stats/outbound/opens?tag=X&fromdate=&todate=
 *     → Opens, Unique
 *   - GET /stats/outbound/clicks?tag=X&fromdate=&todate=
 *     → Clicks, Unique
 */
async function fetchPostmarkStats(
  token: string,
  tag: string,
  daysBack: number,
): Promise<EmailTagStats | null> {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const qs = `tag=${encodeURIComponent(tag)}&fromdate=${fmt(fromDate)}&todate=${fmt(toDate)}`;
  const headers = {
    'X-Postmark-Server-Token': token,
    Accept: 'application/json',
  };

  try {
    const [statsRes, opensRes, clicksRes] = await Promise.all([
      fetch(`https://api.postmarkapp.com/stats/outbound?${qs}`, { headers }),
      fetch(`https://api.postmarkapp.com/stats/outbound/opens?${qs}`, { headers }),
      fetch(`https://api.postmarkapp.com/stats/outbound/clicks?${qs}`, { headers }),
    ]);

    if (!statsRes.ok) return null;

    const stats = (await statsRes.json()) as {
      Sent?: number;
      Bounced?: number;
      SpamComplaints?: number;
      BounceRate?: number;
    };
    const opens = opensRes.ok
      ? ((await opensRes.json()) as { Opens?: number; Unique?: number })
      : { Opens: 0, Unique: 0 };
    const clicks = clicksRes.ok
      ? ((await clicksRes.json()) as { Clicks?: number; Unique?: number })
      : { Clicks: 0, Unique: 0 };

    const sent = stats.Sent ?? 0;
    const bounced = stats.Bounced ?? 0;
    const opens_unique = opens.Unique ?? 0;
    const clicks_unique = clicks.Unique ?? 0;

    return {
      sent,
      bounced,
      bounce_rate_pct: sent > 0 ? +((bounced / sent) * 100).toFixed(1) : 0,
      spam_complaints: stats.SpamComplaints ?? 0,
      opens_unique,
      open_rate_pct: sent > 0 ? +((opens_unique / sent) * 100).toFixed(1) : null,
      clicks_unique,
      click_rate_pct: sent > 0 ? +((clicks_unique / sent) * 100).toFixed(1) : null,
    };
  } catch (err) {
    console.warn('postmark-stats fetch failed', tag, err);
    return null;
  }
}

/**
 * Consulta Cloudflare GraphQL Analytics API para el zone dado.
 * Retorna traffic stats de últimos 14 días (esta semana + anterior).
 * Ver: https://developers.cloudflare.com/analytics/graphql-api/
 */
interface CloudflareTrafficStats {
  pv_current: number;
  pv_previous: number;
  uv_current: number;
  uv_previous: number;
  top_pages: Array<{ path: string; views: number }>;
  top_referrers: Array<{ referrer: string; views: number }>;
  top_countries: Array<{ pais: string; views: number }>;
}

async function fetchCloudflareTraffic(
  token: string,
  zoneId: string,
): Promise<CloudflareTrafficStats | null> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString();

  const query = `
    query($zoneTag: String!, $curFrom: Time!, $curTo: Time!, $prevFrom: Time!, $prevTo: Time!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          cur: httpRequestsAdaptiveGroups(
            limit: 1,
            filter: { datetime_geq: $curFrom, datetime_leq: $curTo }
          ) {
            sum { visits }
            uniq { uniques }
          }
          prev: httpRequestsAdaptiveGroups(
            limit: 1,
            filter: { datetime_geq: $prevFrom, datetime_leq: $prevTo }
          ) {
            sum { visits }
            uniq { uniques }
          }
          topPages: httpRequestsAdaptiveGroups(
            limit: 10,
            filter: { datetime_geq: $curFrom, datetime_leq: $curTo },
            orderBy: [sum_visits_DESC]
          ) {
            sum { visits }
            dimensions { clientRequestPath }
          }
          topRefs: httpRequestsAdaptiveGroups(
            limit: 10,
            filter: { datetime_geq: $curFrom, datetime_leq: $curTo, clientRequestReferer_neq: "" },
            orderBy: [sum_visits_DESC]
          ) {
            sum { visits }
            dimensions { clientRequestReferer }
          }
          topCountries: httpRequestsAdaptiveGroups(
            limit: 10,
            filter: { datetime_geq: $curFrom, datetime_leq: $curTo },
            orderBy: [sum_visits_DESC]
          ) {
            sum { visits }
            dimensions { clientCountryName }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          zoneTag: zoneId,
          curFrom: fmt(weekAgo),
          curTo: fmt(now),
          prevFrom: fmt(twoWeeksAgo),
          prevTo: fmt(weekAgo),
        },
      }),
    });
    if (!res.ok) {
      console.warn('cloudflare-analytics HTTP fail', res.status);
      return null;
    }
    const body = (await res.json()) as {
      data?: {
        viewer?: {
          zones?: Array<{
            cur?: Array<{ sum?: { visits?: number }; uniq?: { uniques?: number } }>;
            prev?: Array<{ sum?: { visits?: number }; uniq?: { uniques?: number } }>;
            topPages?: Array<{ sum?: { visits?: number }; dimensions?: { clientRequestPath?: string } }>;
            topRefs?: Array<{ sum?: { visits?: number }; dimensions?: { clientRequestReferer?: string } }>;
            topCountries?: Array<{ sum?: { visits?: number }; dimensions?: { clientCountryName?: string } }>;
          }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (body.errors?.length) {
      console.warn('cloudflare-analytics GraphQL errors', body.errors[0]?.message);
      return null;
    }
    const zone = body.data?.viewer?.zones?.[0];
    if (!zone) return null;

    return {
      pv_current: zone.cur?.[0]?.sum?.visits ?? 0,
      pv_previous: zone.prev?.[0]?.sum?.visits ?? 0,
      uv_current: zone.cur?.[0]?.uniq?.uniques ?? 0,
      uv_previous: zone.prev?.[0]?.uniq?.uniques ?? 0,
      top_pages: (zone.topPages ?? [])
        .map((r) => ({ path: r.dimensions?.clientRequestPath ?? '', views: r.sum?.visits ?? 0 }))
        .filter((r) => r.path),
      top_referrers: (zone.topRefs ?? [])
        .map((r) => ({ referrer: r.dimensions?.clientRequestReferer ?? '', views: r.sum?.visits ?? 0 }))
        .filter((r) => r.referrer),
      top_countries: (zone.topCountries ?? [])
        .map((r) => ({ pais: r.dimensions?.clientCountryName ?? '', views: r.sum?.visits ?? 0 }))
        .filter((r) => r.pais),
    };
  } catch (err) {
    console.warn('cloudflare-analytics fetch failed', err);
    return null;
  }
}

/**
 * Recorre KV con prefix, parsea, aplica callback por registro válido.
 * Silencia registros corruptos con warn a console.
 */
async function walkKv<T>(kv: KVNamespace, prefix: string, onRec: (r: T, key: string) => void): Promise<void> {
  let cursor: string | undefined;
  do {
    const res = await kv.list({ prefix, cursor, limit: 1000 });
    for (const key of res.keys) {
      const raw = await kv.get(key.name);
      if (!raw) continue;
      try {
        onRec(JSON.parse(raw) as T, key.name);
      } catch (err) {
        console.warn('weekly-report: parse fail', key.name, err);
      }
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
}

export const GET: APIRoute = async ({ url, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};

  const expectedKey = env.STATS_KEY as string | undefined;
  if (!expectedKey) return jsonResponse({ error: 'stats_disabled' }, 503);
  if (url.searchParams.get('key') !== expectedKey) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const emailsKv = env.EMAILS as KVNamespace | undefined;
  const quizKv = env.QUIZ_METRICS as KVNamespace | undefined;
  const limitsKv = env.CV_LIMITS as KVNamespace | undefined;
  const simDb = env.SIMULATOR_METRICS_DB as D1Database | undefined;

  const now = Date.now();
  const weekAgo = now - WEEK_MS;
  const twoWeeksAgo = now - 2 * WEEK_MS;

  const nowIso = new Date(now).toISOString();
  const weekAgoIso = new Date(weekAgo).toISOString();
  const twoWeeksAgoIso = new Date(twoWeeksAgo).toISOString();

  try {
    // ── 1. Suscripciones (KV EMAILS) ─────────────────────────────
    // Los records vienen de dos endpoints:
    //   - cv-review.ts        → key `email:{iso}:{email}`
    //   - quiz-subscribe.ts   → key `quiz:{iso}:{email}` (gate + complete)
    // Deduplicamos por email para totales, pero contamos por fuente para deltas.
    const subs = {
      total_acumulado: 0,
      cur: { n: 0, por_fuente: {} as Record<string, number> },
      prev: { n: 0, por_fuente: {} as Record<string, number> },
      paises: new Map<string, number>(),
      seen_emails: new Set<string>(),
      // Métricas específicas del quiz funnel — separadas de CV Review
      quiz_gate_emails_unique: new Set<string>(),   // gates únicos (dedupe por email)
      quiz_gate_records_total: 0,                    // total records `quiz:` en EMAILS (con dupes por reintento)
      cv_review_emails_unique: new Set<string>(),   // suscripciones CV Review únicas
    };

    if (emailsKv) {
      await walkKv<EmailRec>(emailsKv, '', (rec, key) => {
        // Filtrar solo registros de suscripción
        const isEmail = key.startsWith('email:');   // CV Review lead
        const isQuiz = key.startsWith('quiz:');     // Quiz gate/complete
        if (!isEmail && !isQuiz) return;

        const email = (rec.email ?? '').toLowerCase().trim();
        const tsMs = rec.ts ? Date.parse(rec.ts) : NaN;
        if (!email || isNaN(tsMs)) return;

        // Trackeo separado para métricas del quiz funnel
        if (isQuiz) {
          subs.quiz_gate_records_total++;
          subs.quiz_gate_emails_unique.add(email);
        } else if (isEmail) {
          subs.cv_review_emails_unique.add(email);
        }

        // Dedup por email (una vez cada uno para totales/países)
        if (!subs.seen_emails.has(email)) {
          subs.seen_emails.add(email);
          subs.total_acumulado++;
          if (rec.country) {
            subs.paises.set(rec.country, (subs.paises.get(rec.country) ?? 0) + 1);
          }
        }

        // Deltas por semana + fuente (cuenta cada registro, no email único)
        const fuente = isEmail ? 'cv_review' : 'quiz';
        if (tsMs >= weekAgo && tsMs <= now) {
          subs.cur.n++;
          subs.cur.por_fuente[fuente] = (subs.cur.por_fuente[fuente] ?? 0) + 1;
        } else if (tsMs >= twoWeeksAgo && tsMs < weekAgo) {
          subs.prev.n++;
          subs.prev.por_fuente[fuente] = (subs.prev.por_fuente[fuente] ?? 0) + 1;
        }
      });
    }

    const topPaises = Array.from(subs.paises.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pais, n]) => ({ pais, n }));

    // ── 2. Quiz Match (KV QUIZ_METRICS, prefix "m:") ────────────
    const quiz = {
      total: 0,
      cur: 0,
      prev: 0,
      rol: { PM: 0, MSL: 0, CR: 0 } as Record<string, number>,
      agree_hits: 0,
      agree_total: 0,
    };

    if (quizKv) {
      await walkKv<QuizRec>(quizKv, 'm:', (rec) => {
        quiz.total++;
        if (rec.role) quiz.rol[rec.role] = (quiz.rol[rec.role] ?? 0) + 1;
        const tsMs = rec.ts ? Date.parse(rec.ts) : NaN;
        if (!isNaN(tsMs)) {
          if (tsMs >= weekAgo && tsMs <= now) quiz.cur++;
          else if (tsMs >= twoWeeksAgo && tsMs < weekAgo) quiz.prev++;
        }
        if (rec.selfMatch && rec.role && rec.selfMatch !== 'NS') {
          quiz.agree_total++;
          if (rec.selfMatch === rec.role) quiz.agree_hits++;
        }
      });
    }

    // Drop-off gate→complete usando definiciones estrictas:
    //   - "empezar" = envió gate (record `quiz:` en EMAILS, deduplicado por email)
    //   - "terminar" = vio resultado (record en QUIZ_METRICS)
    // drop_off_pct = 1 - (completions / gates_únicos)
    //
    // Nota: quiz.total puede exceder gates_únicos si un email completó 2 veces
    // (edge case raro). Se cap a min(1, ratio) para evitar drop_off negativo.
    const gates_unique = subs.quiz_gate_emails_unique.size;
    const drop_off_pct = gates_unique > 0
      ? +((1 - Math.min(1, quiz.total / gates_unique)) * 100).toFixed(1)
      : null;

    // Repeat gates: emails que enviaron gate 2+ veces (intentaron abandonar y regresar)
    const repeat_gates = subs.quiz_gate_records_total - gates_unique;

    // ── 3. CV Review (KV CV_LIMITS, un key por email con contador) ──
    // Estructura típica: key `email` → JSON { count, first_ts, last_ts }
    // Para simplificar, contamos keys totales (emails únicos) y sumamos count.
    const cv = { total_analisis: 0, emails_unicos: 0, cur: 0, prev: 0 };

    if (limitsKv) {
      const list = await limitsKv.list({ limit: 1000 });
      cv.emails_unicos = list.keys.length;
      for (const key of list.keys) {
        try {
          const raw = await limitsKv.get(key.name);
          if (!raw) continue;
          const rec = JSON.parse(raw) as { count?: number; last_ts?: string; first_ts?: string };
          cv.total_analisis += rec.count ?? 1;
          // Para deltas, usar last_ts como proxy
          const tsMs = rec.last_ts ? Date.parse(rec.last_ts) : NaN;
          if (!isNaN(tsMs)) {
            if (tsMs >= weekAgo && tsMs <= now) cv.cur++;
            else if (tsMs >= twoWeeksAgo && tsMs < weekAgo) cv.prev++;
          }
        } catch (err) {
          // record corrupto
        }
      }
    }

    // ── 4. Simulator (D1) ─────────────────────────────────────────
    const sim = {
      total: 0,
      cur: 0,
      completadas: 0,
      completitud_pct: 0,
      duracion_promedio_min: null as number | null,
      feedback_total: 0,
      feedback_util: 0,
      avg_realismo: null as number | null,
      avg_utilidad: null as number | null,
      avg_facilidad: null as number | null,
    };

    if (simDb) {
      const totalsRow = await simDb
        .prepare(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completadas,
                  AVG(sesion_duracion_total_seg) AS dur_avg,
                  SUM(CASE WHEN ts >= ? THEN 1 ELSE 0 END) AS cur_week
           FROM sessions`,
        )
        .bind(weekAgo)
        .first<{
          total: number;
          completadas: number;
          dur_avg: number | null;
          cur_week: number;
        }>();

      sim.total = totalsRow?.total ?? 0;
      sim.completadas = totalsRow?.completadas ?? 0;
      sim.completitud_pct = sim.total > 0 ? +((sim.completadas / sim.total) * 100).toFixed(1) : 0;
      sim.duracion_promedio_min = totalsRow?.dur_avg ? +(totalsRow.dur_avg / 60).toFixed(1) : null;
      sim.cur = totalsRow?.cur_week ?? 0;

      const fbRow = await simDb
        .prepare(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN (sorpresa IS NOT NULL AND length(trim(sorpresa)) > 6)
                             OR (mejora IS NOT NULL AND length(trim(mejora)) > 6)
                        THEN 1 ELSE 0 END) AS util,
                  AVG(realismo) AS r,
                  AVG(utilidad) AS u,
                  AVG(facilidad) AS f
           FROM beta_feedback`,
        )
        .first<{ total: number; util: number; r: number | null; u: number | null; f: number | null }>();

      sim.feedback_total = fbRow?.total ?? 0;
      sim.feedback_util = fbRow?.util ?? 0;
      sim.avg_realismo = fbRow?.r ? +fbRow.r.toFixed(2) : null;
      sim.avg_utilidad = fbRow?.u ? +fbRow.u.toFixed(2) : null;
      sim.avg_facilidad = fbRow?.f ? +fbRow.f.toFixed(2) : null;
    }

    // ── 5. Email health (Postmark Analytics API) ─────────────────
    // Consulta por tag los últimos 30 días. Data útil solo si Open+Link
    // tracking están ON en Server Settings (activados 30 jul 2026).
    const postmarkToken = env.POSTMARK_SERVER_TOKEN as string | undefined;
    const email_health = {
      ventana_dias: 30,
      por_tag: {} as Record<string, EmailTagStats>,
      disponible: !!postmarkToken,
      nota: undefined as string | undefined,
    };

    if (postmarkToken) {
      const tags = ['welcome-cv', 'welcome-quiz', 'blog-broadcast'];
      const results = await Promise.all(
        tags.map((t) => fetchPostmarkStats(postmarkToken, t, 30)),
      );
      tags.forEach((t, i) => {
        if (results[i]) {
          email_health.por_tag[t] = results[i]!;
        }
      });
      // Nota: si todos los open_rate_pct son 0 o null, es señal de que
      // tracking aún no acumuló data (< 24h desde activación o cero envíos post-activación).
      const totalOpens = Object.values(email_health.por_tag).reduce(
        (acc, s) => acc + (s.opens_unique ?? 0),
        0,
      );
      if (totalOpens === 0) {
        email_health.nota =
          'Open/Link tracking activados 30 jul 2026; los envíos previos no tienen data. Espera ~2 semanas para métricas confiables.';
      }
    } else {
      email_health.nota = 'POSTMARK_SERVER_TOKEN no configurado en env; email_health no disponible.';
    }

    // ── 6. Cloudflare Web Analytics (traffic del edge) ───────────
    const cfToken = env.CLOUDFLARE_ANALYTICS_TOKEN as string | undefined;
    const zoneId = env.SOLCACIENCIA_ZONE_ID as string | undefined;
    const traffic = {
      disponible: false,
      ventana_dias: 7,
      page_views_esta_semana: 0,
      page_views_semana_anterior: 0,
      unique_visitors_esta_semana: 0,
      unique_visitors_semana_anterior: 0,
      top_paginas: [] as Array<{ path: string; views: number }>,
      top_referrers: [] as Array<{ referrer: string; views: number }>,
      top_paises: [] as Array<{ pais: string; views: number }>,
      nota: undefined as string | undefined,
    };

    if (cfToken && zoneId) {
      const cf = await fetchCloudflareTraffic(cfToken, zoneId);
      if (cf) {
        traffic.disponible = true;
        traffic.page_views_esta_semana = cf.pv_current;
        traffic.page_views_semana_anterior = cf.pv_previous;
        traffic.unique_visitors_esta_semana = cf.uv_current;
        traffic.unique_visitors_semana_anterior = cf.uv_previous;
        traffic.top_paginas = cf.top_pages;
        traffic.top_referrers = cf.top_referrers;
        traffic.top_paises = cf.top_countries;
      } else {
        traffic.nota = 'Cloudflare Analytics no devolvió data (token o permisos).';
      }
    } else {
      traffic.nota = 'Falta CLOUDFLARE_ANALYTICS_TOKEN o SOLCACIENCIA_ZONE_ID.';
    }

    // ── Armar respuesta ──────────────────────────────────────────
    const topDelta = computeDelta(subs.cur.n, subs.prev.n);

    const report: WeeklyReport = {
      generated_at: nowIso,
      window: {
        week_current: { start: weekAgoIso, end: nowIso },
        week_previous: { start: twoWeeksAgoIso, end: weekAgoIso },
      },
      top_metric: {
        label: 'Nuevos suscriptores última semana',
        ...topDelta,
      },
      subscripciones: {
        total_acumulado: subs.total_acumulado,
        esta_semana: { n: subs.cur.n, por_fuente: subs.cur.por_fuente },
        semana_anterior: { n: subs.prev.n, por_fuente: subs.prev.por_fuente },
        top_paises_acumulado: topPaises,
      },
      quiz_match: {
        completions_acumuladas: quiz.total,
        esta_semana: quiz.cur,
        semana_anterior: quiz.prev,
        distribucion_rol_acumulado: quiz.rol,
        agreement_rate: quiz.agree_total > 0 ? +(quiz.agree_hits / quiz.agree_total).toFixed(3) : null,
        gates_unique_acumulado: gates_unique,
        drop_off_gate_to_complete_pct: drop_off_pct,
        repeat_gates,
      },
      cv_review: {
        analisis_acumulados: cv.total_analisis,
        esta_semana: cv.cur,
        semana_anterior: cv.prev,
        emails_unicos_acumulado: cv.emails_unicos,
      },
      simulator: {
        sesiones_acumuladas: sim.total,
        esta_semana: sim.cur,
        completitud_pct: sim.completitud_pct,
        duracion_promedio_min: sim.duracion_promedio_min,
        feedback_total: sim.feedback_total,
        feedback_con_texto_util: sim.feedback_util,
        avg_realismo: sim.avg_realismo,
        avg_utilidad: sim.avg_utilidad,
        avg_facilidad: sim.avg_facilidad,
      },
      email_health,
      traffic,
    };

    return jsonResponse(report, 200);
  } catch (err) {
    console.error('weekly-report failed:', err);
    return jsonResponse({ error: 'internal', message: (err as Error)?.message }, 500);
  }
};
