import type { APIRoute } from 'astro';

export const prerender = false;

interface MetricRecord {
  ts: string;
  role: 'PM' | 'MSL' | 'CR';
  scores?: { PM: number; MSL: number; CR: number };
  selfMatch?: 'PM' | 'MSL' | 'CR' | 'NS';
  country?: string;
}

/** RFC4180 CSV escaping: wrap in quotes if contains comma/quote/newline; double internal quotes. */
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

async function listAllMetrics(kv: KVNamespace): Promise<MetricRecord[]> {
  const records: MetricRecord[] = [];
  let cursor: string | undefined;
  do {
    const result = await kv.list({ prefix: 'm:', cursor, limit: 1000 });
    for (const key of result.keys) {
      try {
        const raw = await kv.get(key.name);
        if (raw) records.push(JSON.parse(raw) as MetricRecord);
      } catch (err) {
        console.error('Failed to parse metric:', key.name, err);
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

  const kv = env?.QUIZ_METRICS as KVNamespace | undefined;
  if (!kv) {
    return new Response('QUIZ_METRICS KV no enlazado.', { status: 503 });
  }

  try {
    const records = await listAllMetrics(kv);
    // Sort chronologically for cleaner Sheet view
    records.sort((a, b) => a.ts.localeCompare(b.ts));

    const header = ['ts', 'role', 'self_match', 'country', 'score_pm', 'score_msl', 'score_cr'];
    const rows = [toCsvRow(header)];
    for (const r of records) {
      rows.push(
        toCsvRow([
          r.ts,
          r.role,
          r.selfMatch ?? '',
          r.country ?? '',
          r.scores?.PM ?? '',
          r.scores?.MSL ?? '',
          r.scores?.CR ?? '',
        ]),
      );
    }
    const csv = rows.join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="solca-quiz-metrics.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('quiz-export failed:', err);
    return new Response('internal error', { status: 500 });
  }
};
