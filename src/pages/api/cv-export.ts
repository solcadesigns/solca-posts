import type { APIRoute } from 'astro';

export const prerender = false;

interface SurveyRecord {
  ts: string;
  exposed: string[];
  answers: Record<string, string | string[]>;
}

// Canonical question list — order defines column order in CSV.
// Stage first (it's the core, always exposed), then alphabetical secondary.
const QUESTION_IDS = [
  'stage',       // core (always exposed)
  'urgency',
  'obstacle',
  'field',
  'confidence',
  'attempts',
  'mobility',
  'motivation',
  'english',
  'sources',     // multi-select
];

const MULTI_SELECT = new Set(['sources']);

/** RFC4180 CSV escaping. */
function csvEscape(val: unknown): string {
  if (val === undefined || val === null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

async function listAllSurveys(kv: KVNamespace): Promise<SurveyRecord[]> {
  const records: SurveyRecord[] = [];
  let cursor: string | undefined;
  do {
    const result = await kv.list({ prefix: 's:', cursor, limit: 1000 });
    for (const key of result.keys) {
      try {
        const raw = await kv.get(key.name);
        if (raw) records.push(JSON.parse(raw) as SurveyRecord);
      } catch (err) {
        console.error('Failed to parse survey:', key.name, err);
      }
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return records;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env;

  const expectedKey = env?.STATS_KEY as string | undefined;
  if (!expectedKey) {
    return new Response('stats_disabled', { status: 503 });
  }
  if (url.searchParams.get('key') !== expectedKey) {
    return new Response('unauthorized', { status: 401 });
  }

  const kv = env?.CV_METRICS as KVNamespace | undefined;
  if (!kv) {
    return new Response('CV_METRICS KV no enlazado.', { status: 503 });
  }

  try {
    const records = await listAllSurveys(kv);
    records.sort((a, b) => a.ts.localeCompare(b.ts));

    // Wide format: ts, then for each question: q_X_exposed (0/1) and q_X_answer
    // For multi-select, answer is pipe-separated values ("linkedin|podcasts")
    const header: string[] = ['ts'];
    for (const qid of QUESTION_IDS) {
      header.push(`${qid}_exposed`);
      header.push(`${qid}_answer`);
    }

    const rows = [toCsvRow(header)];
    for (const r of records) {
      const exposed = new Set(r.exposed);
      const row: (string | number)[] = [r.ts];
      for (const qid of QUESTION_IDS) {
        row.push(exposed.has(qid) ? 1 : 0);
        const ans = r.answers[qid];
        if (ans === undefined) {
          row.push('');
        } else if (MULTI_SELECT.has(qid) && Array.isArray(ans)) {
          row.push(ans.join('|'));
        } else {
          row.push(String(ans));
        }
      }
      rows.push(toCsvRow(row));
    }
    const csv = rows.join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="solca-cv-survey.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('cv-export failed:', err);
    return new Response('internal error', { status: 500 });
  }
};
