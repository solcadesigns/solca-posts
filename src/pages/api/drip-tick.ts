/**
 * Endpoint · Drip diario de bienvenida (4 ago 2026).
 *
 * Ejecuta la lógica de "enviar el email del día N desde registro" para dos
 * tracks: `cv` (leads que se registraron por /revisar-cv) y `quiz` (leads que
 * completaron /quiz-rol con un rol asignado).
 *
 * Trigger normal: Cloudflare Cron `"0 15 * * *"` = 9 AM CDMX diario
 * (ver wrangler.jsonc y scripts/patch-cron-handler.mjs v4).
 * Trigger manual: `GET /api/drip-tick?key=<STATS_KEY>[&dry=true][&limit=N]`.
 *
 * Envía si y solo si:
 *   1. `age_days` (redondeado floor a UTC) coincide EXACTAMENTE con uno de
 *      DRIP_STEPS = {3, 7, 12, 20}. Si un lead se salta un día (cron falló,
 *      Postmark caído, etc.), ese email no se recupera automáticamente.
 *   2. No hay dedupe previo en KV EMAILS con key `drip:{email}:{track}:{step}`.
 *   3. No hay unsubscribe en KV EMAILS con key `unsub:{email}:drip`.
 *   4. El lead NO recibió `blog-broadcast` en las últimas 48h (anti-fatiga
 *      cruzada con Solca Insight).
 *
 * Tracks:
 *   - `cv`: leads de KV EMAILS prefix `email:`. templateModel simple.
 *   - `quiz`: leads de KV EMAILS prefix `quiz:`. Requiere `role ∈ {PM,MSL,CR}`
 *      del record. Si no hay rol (gate sin complete), skip.
 *
 * Dedupe por (email, track): un email puede estar en ambos tracks si se
 * registró por CV y por Quiz. Ambos drips corren independientes.
 * `firstSeen` = timestamp mínimo de records de ese track para ese email.
 *
 * Rate limit Postmark: 300 emails/segundo. Volumen esperado << 100/día;
 * enviamos secuencialmente sin throttling artificial.
 */

import type { APIRoute } from 'astro';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import {
  DRIP_STEPS,
  type DripStep,
  type DripTrack,
  buildUnsubUrl,
  hasRecentTagForRecipient,
  templateAliasFor,
  DRIP_ROLE_LABELS,
  siteOrigin,
} from '../../lib/drip';

export const prerender = false;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 200;
const BROADCAST_COLLISION_HOURS = 48;
const FROM_ADDRESS = 'Oscar Solís <hola@solcaciencia.com>';

interface EmailRec {
  email?: string;
  ts?: string;
  name?: string;
  role?: 'PM' | 'MSL' | 'CR';
  stage?: 'gate' | 'complete';
  country?: string;
}

interface Candidate {
  email: string;
  track: DripTrack;
  firstSeenMs: number;
  firstName?: string;
  role?: 'PM' | 'MSL' | 'CR';
  country?: string;
}

interface TickAction {
  email: string;
  track: DripTrack;
  step: DripStep | null;
  ageDays: number;
  outcome:
    | 'sent'
    | 'dry_would_send'
    | 'skip_no_step_today'
    | 'skip_already_sent'
    | 'skip_unsubscribed'
    | 'skip_recent_broadcast'
    | 'skip_quiz_incomplete'
    | 'skip_no_token'
    | 'error';
  messageId?: string;
  error?: string;
}

interface TickSummary {
  triggered_at: string;
  dry: boolean;
  limit: number;
  scanned: number;
  candidates: number;
  by_outcome: Record<string, number>;
  sent_details: Array<{ email: string; track: DripTrack; step: DripStep; messageId?: string }>;
  errors: Array<{ email: string; track: DripTrack; error: string }>;
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

function isAuthorized(url: URL, headers: Headers, expectedKey: string | undefined): boolean {
  if (headers.get('X-Cron-Trigger') === '1') return true;
  if (!expectedKey) return false;
  return url.searchParams.get('key') === expectedKey;
}

/**
 * Recorre KV EMAILS con el prefix dado y arma un mapa de candidates,
 * quedándose con el firstSeen y con el metadata más útil por (email, track).
 */
async function collectCandidates(
  kv: KVNamespace,
  prefix: string,
  track: DripTrack,
  target: Map<string, Candidate>,
): Promise<number> {
  let scanned = 0;
  let cursor: string | undefined;
  do {
    const res = await kv.list({ prefix, cursor, limit: 1000 });
    for (const key of res.keys) {
      const raw = await kv.get(key.name);
      if (!raw) continue;
      let rec: EmailRec;
      try {
        rec = JSON.parse(raw) as EmailRec;
      } catch {
        continue;
      }
      const email = (rec.email ?? '').toLowerCase().trim();
      const tsMs = rec.ts ? Date.parse(rec.ts) : NaN;
      if (!email || isNaN(tsMs)) continue;
      scanned++;

      const composite = `${email}|${track}`;
      const existing = target.get(composite);
      if (!existing) {
        target.set(composite, {
          email,
          track,
          firstSeenMs: tsMs,
          firstName: rec.name?.trim().split(/\s+/)[0],
          role: rec.role && ['PM', 'MSL', 'CR'].includes(rec.role) ? rec.role : undefined,
          country: rec.country,
        });
      } else {
        if (tsMs < existing.firstSeenMs) existing.firstSeenMs = tsMs;
        // Upgrade con metadata más rica (rol o nombre) cuando aparezca en un
        // record posterior. En Quiz gate viene name; en complete viene role.
        if (!existing.role && rec.role) existing.role = rec.role;
        if (!existing.firstName && rec.name) existing.firstName = rec.name.split(/\s+/)[0];
        if (!existing.country && rec.country) existing.country = rec.country;
      }
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return scanned;
}

/**
 * Devuelve el step exacto que corresponde a `ageDays`, o null si no hay envío
 * previsto hoy. Enviamos SOLO el día exacto — sin recuperación de faltas.
 */
function stepForAge(ageDays: number): DripStep | null {
  return DRIP_STEPS.find((s) => s === ageDays) ?? null;
}

async function processOne(
  candidate: Candidate,
  step: DripStep,
  ctx: {
    kv: KVNamespace;
    postmarkToken: string | undefined;
    unsubSecret: string;
    env: Record<string, unknown>;
    dry: boolean;
    nowMs: number;
    ageDays: number;
  },
): Promise<TickAction> {
  const base: TickAction = {
    email: candidate.email,
    track: candidate.track,
    step,
    ageDays: ctx.ageDays,
    outcome: 'sent',
  };

  // Quiz sin rol: skip. El welcome tampoco se envió; el drip tampoco.
  if (candidate.track === 'quiz' && !candidate.role) {
    return { ...base, outcome: 'skip_quiz_incomplete' };
  }

  // Dedupe: un envío por (email, track, step)
  const dedupeKey = `drip:${candidate.email}:${candidate.track}:${step}`;
  const already = await ctx.kv.get(dedupeKey);
  if (already) return { ...base, outcome: 'skip_already_sent' };

  // Kill switch específico del drip
  const unsub = await ctx.kv.get(`unsub:${candidate.email}:drip`);
  if (unsub) return { ...base, outcome: 'skip_unsubscribed' };

  // Anti-colisión con blog broadcast (48h)
  if (ctx.postmarkToken) {
    const recent = await hasRecentTagForRecipient(
      ctx.postmarkToken,
      candidate.email,
      'blog-broadcast',
      BROADCAST_COLLISION_HOURS,
    );
    if (recent) return { ...base, outcome: 'skip_recent_broadcast' };
  }

  if (!ctx.postmarkToken) return { ...base, outcome: 'skip_no_token' };

  const unsubUrl = await buildUnsubUrl(ctx.env, candidate.email, ctx.unsubSecret);
  const roleLabel = candidate.role ? DRIP_ROLE_LABELS[candidate.role] : '';
  const templateModel: Record<string, unknown> = {
    first_name: candidate.firstName ?? '',
    role_label: roleLabel,
    role_slug: candidate.role?.toLowerCase() ?? '',
    site_origin: siteOrigin(ctx.env),
    unsub_url: unsubUrl,
  };

  if (ctx.dry) {
    return { ...base, outcome: 'dry_would_send' };
  }

  try {
    const result = await sendEmailWithTemplate(ctx.postmarkToken, {
      from: FROM_ADDRESS,
      to: candidate.email,
      templateAlias: templateAliasFor(candidate.track, step),
      templateModel,
      tag: `drip-${candidate.track}-d${step}`,
      metadata: {
        source: 'drip-tick',
        track: candidate.track,
        step: String(step),
      },
    });
    // Marca dedupe. Sin TTL: los drips son one-shot por lifetime del lead.
    await ctx.kv.put(
      dedupeKey,
      JSON.stringify({
        sentAt: new Date(ctx.nowMs).toISOString(),
        messageId: result.messageId,
        track: candidate.track,
        step,
      }),
    );
    return { ...base, outcome: 'sent', messageId: result.messageId };
  } catch (err) {
    const msg =
      err instanceof PostmarkError
        ? `Postmark ${err.status}: ${err.message}`
        : (err as Error)?.message ?? 'unknown';
    console.error('drip-tick send failed', candidate.email, candidate.track, step, msg);
    return { ...base, outcome: 'error', error: msg };
  }
}

async function runTick(
  env: Record<string, unknown>,
  dry: boolean,
  limit: number,
): Promise<TickSummary> {
  const kv = env.EMAILS as KVNamespace | undefined;
  const postmarkToken = env.POSTMARK_SERVER_TOKEN as string | undefined;
  const unsubSecret = (env.DRIP_UNSUB_SECRET as string | undefined) ?? '';

  const summary: TickSummary = {
    triggered_at: new Date().toISOString(),
    dry,
    limit,
    scanned: 0,
    candidates: 0,
    by_outcome: {},
    sent_details: [],
    errors: [],
  };

  if (!kv) {
    summary.by_outcome.error = 1;
    summary.errors.push({ email: '-', track: 'cv', error: 'EMAILS KV binding missing' });
    return summary;
  }
  if (!unsubSecret) {
    summary.by_outcome.error = 1;
    summary.errors.push({ email: '-', track: 'cv', error: 'DRIP_UNSUB_SECRET missing' });
    return summary;
  }

  const candidates = new Map<string, Candidate>();
  summary.scanned += await collectCandidates(kv, 'email:', 'cv', candidates);
  summary.scanned += await collectCandidates(kv, 'quiz:', 'quiz', candidates);
  summary.candidates = candidates.size;

  const nowMs = Date.now();
  let sentCount = 0;

  for (const cand of Array.from(candidates.values())) {
    if (sentCount >= limit) break;
    const ageDays = Math.floor((nowMs - cand.firstSeenMs) / DAY_MS);
    const step = stepForAge(ageDays);
    if (step === null) {
      summary.by_outcome.skip_no_step_today =
        (summary.by_outcome.skip_no_step_today ?? 0) + 1;
      continue;
    }
    const action = await processOne(cand, step, {
      kv,
      postmarkToken,
      unsubSecret,
      env,
      dry,
      nowMs,
      ageDays,
    });
    summary.by_outcome[action.outcome] = (summary.by_outcome[action.outcome] ?? 0) + 1;
    if (action.outcome === 'sent') {
      sentCount++;
      summary.sent_details.push({
        email: cand.email,
        track: cand.track,
        step,
        messageId: action.messageId,
      });
    } else if (action.outcome === 'error') {
      summary.errors.push({ email: cand.email, track: cand.track, error: action.error ?? '' });
    }
  }

  return summary;
}

export const GET: APIRoute = async ({ url, request, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};
  const expectedKey = env.STATS_KEY as string | undefined;
  if (!isAuthorized(url, request.headers, expectedKey)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const dry = url.searchParams.get('dry') === 'true';
  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : DEFAULT_LIMIT;

  try {
    const summary = await runTick(env, dry, limit);
    return jsonResponse(summary, 200);
  } catch (err) {
    console.error('drip-tick failed:', err);
    return jsonResponse({ error: 'internal', message: (err as Error)?.message }, 500);
  }
};

/**
 * POST se acepta también para permitir el trigger interno del wrapper cron
 * (que hace POST con X-Cron-Trigger:1 header) sin que Astro CSRF-block.
 */
export const POST = GET;
