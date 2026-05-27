import type { APIRoute } from 'astro';

export const prerender = false;

interface MetricRecord {
  ts: string;
  role: 'PM' | 'MSL' | 'CR';
  scores?: { PM: number; MSL: number; CR: number };
  selfMatch?: 'PM' | 'MSL' | 'CR' | 'NS';
  country?: string;
}

interface Stats {
  total_completions: number;
  range: { earliest: string | null; latest: string | null };
  by_role: Record<string, number>;
  by_country: Record<string, number>;
  by_self_match: Record<string, number>;
  agreement_overall: number;  // % de usuarios cuyo self_match == role real (excluye NS)
  matrix: Record<string, Record<string, number>>;  // matrix[selfMatch][actualRole] = count
  avg_scores_by_role: Record<string, { PM: number; MSL: number; CR: number; n: number }>;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function emptyStats(): Stats {
  return {
    total_completions: 0,
    range: { earliest: null, latest: null },
    by_role: { PM: 0, MSL: 0, CR: 0 },
    by_country: {},
    by_self_match: { PM: 0, MSL: 0, CR: 0, NS: 0, undefined: 0 },
    agreement_overall: 0,
    matrix: {
      PM: { PM: 0, MSL: 0, CR: 0 },
      MSL: { PM: 0, MSL: 0, CR: 0 },
      CR: { PM: 0, MSL: 0, CR: 0 },
      NS: { PM: 0, MSL: 0, CR: 0 },
    },
    avg_scores_by_role: {
      PM: { PM: 0, MSL: 0, CR: 0, n: 0 },
      MSL: { PM: 0, MSL: 0, CR: 0, n: 0 },
      CR: { PM: 0, MSL: 0, CR: 0, n: 0 },
    },
  };
}

async function listAllMetrics(kv: KVNamespace): Promise<MetricRecord[]> {
  const records: MetricRecord[] = [];
  let cursor: string | undefined;
  do {
    const result = await kv.list({ prefix: 'm:', cursor, limit: 1000 });
    for (const key of result.keys) {
      try {
        const raw = await kv.get(key.name);
        if (raw) {
          const parsed = JSON.parse(raw) as MetricRecord;
          records.push(parsed);
        }
      } catch (err) {
        console.error('Failed to parse metric:', key.name, err);
      }
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return records;
}

function aggregate(records: MetricRecord[]): Stats {
  const stats = emptyStats();
  stats.total_completions = records.length;
  if (records.length === 0) return stats;

  let agreementHits = 0;
  let agreementTotal = 0;

  for (const r of records) {
    if (!stats.range.earliest || r.ts < stats.range.earliest) stats.range.earliest = r.ts;
    if (!stats.range.latest || r.ts > stats.range.latest) stats.range.latest = r.ts;

    if (r.role && stats.by_role[r.role] !== undefined) {
      stats.by_role[r.role]++;
    }
    if (r.country) {
      stats.by_country[r.country] = (stats.by_country[r.country] || 0) + 1;
    }
    const sm = r.selfMatch ?? 'undefined';
    stats.by_self_match[sm] = (stats.by_self_match[sm] || 0) + 1;

    if (r.selfMatch && r.role && r.selfMatch !== 'NS') {
      stats.matrix[r.selfMatch][r.role]++;
      agreementTotal++;
      if (r.selfMatch === r.role) agreementHits++;
    } else if (r.selfMatch === 'NS' && r.role) {
      stats.matrix.NS[r.role]++;
    }

    if (r.scores && r.role) {
      const bucket = stats.avg_scores_by_role[r.role];
      bucket.PM += r.scores.PM;
      bucket.MSL += r.scores.MSL;
      bucket.CR += r.scores.CR;
      bucket.n++;
    }
  }

  stats.agreement_overall = agreementTotal > 0 ? +(agreementHits / agreementTotal).toFixed(3) : 0;

  // Convert sums to averages
  for (const role of ['PM', 'MSL', 'CR'] as const) {
    const b = stats.avg_scores_by_role[role];
    if (b.n > 0) {
      b.PM = +(b.PM / b.n).toFixed(2);
      b.MSL = +(b.MSL / b.n).toFixed(2);
      b.CR = +(b.CR / b.n).toFixed(2);
    }
  }

  return stats;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env;

  const expectedKey = env?.STATS_KEY as string | undefined;
  if (!expectedKey) {
    return jsonResponse({ error: 'stats_disabled', message: 'STATS_KEY no configurado en el servidor.' }, 503);
  }
  const providedKey = url.searchParams.get('key');
  if (providedKey !== expectedKey) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const kv = env?.QUIZ_METRICS as KVNamespace | undefined;
  if (!kv) {
    return jsonResponse({ error: 'kv_missing', message: 'QUIZ_METRICS KV namespace no enlazado.' }, 503);
  }

  try {
    const records = await listAllMetrics(kv);
    const stats = aggregate(records);
    return jsonResponse(stats, 200);
  } catch (err) {
    console.error('quiz-stats failed:', err);
    return jsonResponse({ error: 'internal', message: 'Error al agregar métricas.' }, 500);
  }
};
