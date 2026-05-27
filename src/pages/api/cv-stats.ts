import type { APIRoute } from 'astro';

export const prerender = false;

interface SurveyRecord {
  ts: string;
  exposed: string[];
  answers: Record<string, string | string[]>;
}

interface QuestionStats {
  exposed: number;
  answered: number;
  response_rate: number;
  distribution: Record<string, number>;
}

interface Stats {
  total_submissions: number;
  range: { earliest: string | null; latest: string | null };
  per_question: Record<string, QuestionStats>;
  cross_tabs_vs_stage: Record<string, Record<string, Record<string, number>>>;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function listAllSurveys(kv: KVNamespace): Promise<SurveyRecord[]> {
  const records: SurveyRecord[] = [];
  let cursor: string | undefined;
  do {
    const result = await kv.list({ prefix: 's:', cursor, limit: 1000 });
    for (const key of result.keys) {
      try {
        const raw = await kv.get(key.name);
        if (raw) {
          const parsed = JSON.parse(raw) as SurveyRecord;
          records.push(parsed);
        }
      } catch (err) {
        console.error('Failed to parse survey:', key.name, err);
      }
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return records;
}

function aggregate(records: SurveyRecord[]): Stats {
  const stats: Stats = {
    total_submissions: records.length,
    range: { earliest: null, latest: null },
    per_question: {},
    cross_tabs_vs_stage: {},
  };

  for (const r of records) {
    if (!stats.range.earliest || r.ts < stats.range.earliest) stats.range.earliest = r.ts;
    if (!stats.range.latest || r.ts > stats.range.latest) stats.range.latest = r.ts;

    // Per-question stats
    for (const qid of r.exposed) {
      if (!stats.per_question[qid]) {
        stats.per_question[qid] = { exposed: 0, answered: 0, response_rate: 0, distribution: {} };
      }
      stats.per_question[qid].exposed++;
      const ans = r.answers[qid];
      if (ans !== undefined) {
        stats.per_question[qid].answered++;
        const values = Array.isArray(ans) ? ans : [ans];
        for (const v of values) {
          stats.per_question[qid].distribution[v] = (stats.per_question[qid].distribution[v] || 0) + 1;
        }
      }
    }

    // Cross-tabs: stage × every other answered question
    const stage = r.answers.stage;
    if (typeof stage === 'string') {
      for (const [qid, ans] of Object.entries(r.answers)) {
        if (qid === 'stage') continue;
        if (!stats.cross_tabs_vs_stage[qid]) stats.cross_tabs_vs_stage[qid] = {};
        if (!stats.cross_tabs_vs_stage[qid][stage]) stats.cross_tabs_vs_stage[qid][stage] = {};
        const values = Array.isArray(ans) ? ans : [ans];
        for (const v of values) {
          stats.cross_tabs_vs_stage[qid][stage][v] = (stats.cross_tabs_vs_stage[qid][stage][v] || 0) + 1;
        }
      }
    }
  }

  // Compute response rates
  for (const qid of Object.keys(stats.per_question)) {
    const q = stats.per_question[qid];
    q.response_rate = q.exposed > 0 ? +(q.answered / q.exposed).toFixed(3) : 0;
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

  const kv = env?.CV_METRICS as KVNamespace | undefined;
  if (!kv) {
    return jsonResponse({ error: 'kv_missing', message: 'CV_METRICS KV namespace no enlazado.' }, 503);
  }

  try {
    const records = await listAllSurveys(kv);
    const stats = aggregate(records);
    return jsonResponse(stats, 200);
  } catch (err) {
    console.error('cv-stats failed:', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
};
