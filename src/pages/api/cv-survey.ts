import type { APIRoute } from 'astro';
import { extractUtms } from '../../lib/utm';

export const prerender = false;

// Canonical question pool — keep in sync with revisar-cv.astro
const VALID_QUESTIONS: Record<string, Set<string>> = {
  stage: new Set(['phd_1_2', 'phd_3_5', 'phd_writing', 'postdoc', 'post_phd', 'in_industry']),
  urgency: new Set(['0_3m', '3_6m', '6_12m', '1_2y', 'exploring']),
  obstacle: new Set(['no_callbacks', 'no_role_clarity', 'english', 'networking', 'time', 'other']),
  field: new Set([
    'mol_bio', 'immuno', 'pharm', 'oncology', 'neuro',
    'micro', 'chem', 'public_health', 'bioinfo', 'other',
  ]),
  confidence: new Set(['1', '2', '3', '4', '5']),
  attempts: new Set(['0', '1_5', '6_20', '20_plus']),
  mobility: new Set(['any_country', 'hispanic', 'same_country', 'no_move']),
  motivation: new Set(['salary', 'stability', 'academia_fatigue', 'impact', 'family', 'curiosity', 'other']),
  english: new Set(['native', 'advanced', 'intermediate', 'basic']),
  sources: new Set(['linkedin', 'podcasts', 'mentors', 'courses', 'forums', 'nothing']),
};

const MULTI_SELECT = new Set(['sources']);

interface SurveyRequest {
  exposed?: string[];
  answers?: Record<string, string | string[]>;
  // Contexto anónimo del análisis (20 oct 2026): país elegido en el formulario,
  // UTMs y dominio de origen. Nunca correo, nombre ni texto del CV: la encuesta
  // promete no vincularse al email ni al CV.
  country?: string;
  referrerHost?: string;
}

const VALID_COUNTRIES = new Set([
  'México', 'Brasil', 'Argentina', 'Colombia', 'Chile', 'España', 'Perú', 'Ecuador', 'Otro LATAM', 'Otro',
]);

function cleanHost(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase().slice(0, 100);
  return /^[a-z0-9.-]+$/.test(v) ? v : undefined;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function storeSurvey(
  runtime: { env?: Record<string, unknown> } | undefined,
  anonRecord: Record<string, unknown>,
): Promise<void> {
  const kv = runtime?.env?.CV_METRICS as KVNamespace | undefined;
  if (!kv || typeof kv.put !== 'function') {
    console.log('cv-survey:skipped (no CV_METRICS KV)', JSON.stringify(anonRecord));
    return;
  }
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `s:${anonRecord.ts}:${rand}`;
  try {
    await kv.put(key, JSON.stringify(anonRecord));
  } catch (err) {
    console.error('CV_METRICS put failed:', err);
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: SurveyRequest;
  try {
    body = (await request.json()) as SurveyRequest;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const exposed = Array.isArray(body.exposed) ? body.exposed : [];
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

  // Validation: every exposed ID must be a valid question; every answer must be in the option set
  const validExposed: string[] = [];
  const validAnswers: Record<string, string | string[]> = {};
  for (const qid of exposed) {
    if (!(qid in VALID_QUESTIONS)) continue;
    validExposed.push(qid);
    const ans = answers[qid];
    if (ans === undefined) continue;
    if (MULTI_SELECT.has(qid)) {
      if (!Array.isArray(ans)) continue;
      const filtered = ans.filter((v) => typeof v === 'string' && VALID_QUESTIONS[qid].has(v));
      if (filtered.length > 0) validAnswers[qid] = filtered;
    } else {
      if (typeof ans !== 'string') continue;
      if (VALID_QUESTIONS[qid].has(ans)) validAnswers[qid] = ans;
    }
  }

  if (validExposed.length === 0) {
    return jsonResponse({ error: 'no_valid_questions' }, 400);
  }

  const runtime = (locals as {
    runtime?: {
      env?: Record<string, unknown>;
      ctx?: { waitUntil?: (p: Promise<unknown>) => void };
    };
  }).runtime;
  const ctx = runtime?.ctx;
  const waitUntil = ctx?.waitUntil?.bind(ctx) ?? ((p: Promise<unknown>) => p);

  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    exposed: validExposed,
    answers: validAnswers,
  };
  if (typeof body.country === 'string' && VALID_COUNTRIES.has(body.country)) record.country = body.country;
  const referrerHost = cleanHost(body.referrerHost);
  if (referrerHost) record.referrerHost = referrerHost;
  Object.assign(record, extractUtms(body as unknown as Record<string, unknown>));

  waitUntil(
    storeSurvey(runtime as { env?: Record<string, unknown> }, record).catch((err) =>
      console.error('storeSurvey failed', err),
    ),
  );

  return jsonResponse({ ok: true, accepted: Object.keys(validAnswers).length }, 200);
};
