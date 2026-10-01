import type { APIRoute } from 'astro';

export const prerender = false;

// Roles del quiz. Ampliado 2026-10-01 para incluir FV y Consulting (agregados
// al quiz-rol el 2026-09-28). Si en el futuro se añaden más roles, basta con
// extender ROLES; emptyStats() y aggregate() lo recorren dinámicamente.
const ROLES = ['PM', 'MSL', 'CR', 'FV', 'Consulting'] as const;
type Role = (typeof ROLES)[number];
type SelfMatch = Role | 'NS';

type ScoreMap = Partial<Record<Role, number>>;

interface MetricRecord {
  ts: string;
  role: Role;
  scores?: ScoreMap;
  selfMatch?: SelfMatch;
  country?: string;
  utm_source?: string;
  utm_campaign?: string;
}

interface Stats {
  total_completions: number;
  range: { earliest: string | null; latest: string | null };
  by_role: Record<string, number>;
  by_country: Record<string, number>;
  by_self_match: Record<string, number>;
  agreement_overall: number;  // % de usuarios cuyo self_match == role real (excluye NS)
  matrix: Record<string, Record<string, number>>;  // matrix[selfMatch][actualRole] = count
  avg_scores_by_role: Record<string, Record<string, number> & { n: number }>;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function emptyScoresRow(): Record<string, number> & { n: number } {
  const row: Record<string, number> & { n: number } = { n: 0 } as never;
  for (const r of ROLES) row[r] = 0;
  return row;
}

function emptyMatrixRow(): Record<string, number> {
  const row: Record<string, number> = {};
  for (const r of ROLES) row[r] = 0;
  return row;
}

function emptyStats(): Stats {
  const by_role: Record<string, number> = {};
  const by_self_match: Record<string, number> = { NS: 0, undefined: 0 };
  const matrix: Record<string, Record<string, number>> = { NS: emptyMatrixRow() };
  const avg_scores_by_role: Record<string, Record<string, number> & { n: number }> = {};
  for (const r of ROLES) {
    by_role[r] = 0;
    by_self_match[r] = 0;
    matrix[r] = emptyMatrixRow();
    avg_scores_by_role[r] = emptyScoresRow();
  }
  return {
    total_completions: 0,
    range: { earliest: null, latest: null },
    by_role,
    by_country: {},
    by_self_match,
    agreement_overall: 0,
    matrix,
    avg_scores_by_role,
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

function isKnownRole(x: unknown): x is Role {
  return typeof x === 'string' && (ROLES as readonly string[]).includes(x);
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

    // by_role (defensivo contra roles desconocidos de registros viejos)
    if (isKnownRole(r.role)) {
      stats.by_role[r.role]++;
    } else if (r.role) {
      // registro con rol no reconocido · cuenta en una bucket aparte
      const key = `_unknown_${String(r.role)}`;
      stats.by_role[key] = (stats.by_role[key] || 0) + 1;
    }

    if (r.country) {
      stats.by_country[r.country] = (stats.by_country[r.country] || 0) + 1;
    }

    const sm = r.selfMatch ?? 'undefined';
    stats.by_self_match[sm] = (stats.by_self_match[sm] || 0) + 1;

    // Matriz self-match × rol real
    if (r.selfMatch && isKnownRole(r.role)) {
      if (r.selfMatch === 'NS') {
        stats.matrix.NS[r.role]++;
      } else if (isKnownRole(r.selfMatch)) {
        stats.matrix[r.selfMatch][r.role]++;
        agreementTotal++;
        if (r.selfMatch === r.role) agreementHits++;
      }
    }

    // Promedios de scores por rol real
    if (r.scores && isKnownRole(r.role)) {
      const bucket = stats.avg_scores_by_role[r.role];
      for (const rr of ROLES) {
        const v = r.scores[rr];
        if (typeof v === 'number' && Number.isFinite(v)) {
          bucket[rr] += v;
        }
      }
      bucket.n++;
    }
  }

  stats.agreement_overall = agreementTotal > 0 ? +(agreementHits / agreementTotal).toFixed(3) : 0;

  // Convert sums to averages
  for (const role of ROLES) {
    const b = stats.avg_scores_by_role[role];
    if (b.n > 0) {
      for (const rr of ROLES) {
        b[rr] = +(b[rr] / b.n).toFixed(2);
      }
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
    return jsonResponse(
      {
        error: 'internal',
        message: 'Error al agregar métricas.',
        detail: String(err instanceof Error ? err.message : err),
      },
      500,
    );
  }
};
