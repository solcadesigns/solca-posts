/**
 * /api/cv-process-pending · reintentos del revisor de CV · 6 nov 2026 (bloque B).
 *
 * Lo dispara el Cron Trigger de Cloudflare `*\/5 * * * *` (handler inyectado por scripts/patch-cron-handler.mjs),
 * con la misma protección que los demás endpoints de cron (`?key=<STATS_KEY>`). Endpoint aparte del de
 * /api/simulator-process-pending: aquel procesa chunks de sesiones con otro estado, presupuesto y circuit breaker.
 *
 * La lógica (estados pending → send → closing, reclamo, marca cvdone, orden correo → conteo) vive en
 * src/lib/cv-pending.ts, que se prueba offline. Aquí solo se conectan KV, modelo, Postmark y eventos.
 * Todo con await: ctx.waitUntil no ejecuta en Astro sobre Workers.
 */

import type { APIRoute } from 'astro';
import { processCvPendingOnce, type CvJob, type KvLike } from '../../lib/cv-pending';
import {
  runCvAnalysis,
  finalizeCvSuccess,
  sendCvAnalysisEmail,
  jobLeadContext,
  jobAttemptCtx,
  recordCvAttemptD1,
  putAttemptKv,
  sendCvApology,
  alertCvFailure,
} from '../../lib/cv-review-run';

export const prerender = false;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

/** Registro `attempt:` (KV EMAILS, 180 días): lleva correo, nunca texto del CV ni resultado. */
function attemptKvRecord(job: CvJob, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    email: job.email,
    country: job.country,
    ts: job.attemptTs,
    cvLength: job.cvLength,
    ...(job.referrer ? { referrer: job.referrer } : {}),
    ...job.utms,
    ...job.attr,
    attempts: job.attempts,
    ...extra,
  };
}

export const GET: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};
  const statsKey = env.STATS_KEY as string | undefined;
  const url = new URL(request.url);
  if (!statsKey || url.searchParams.get('key') !== statsKey) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }
  const kv = env.CV_LIMITS as KVNamespace | undefined;
  if (!kv) return jsonResponse({ ok: false, error: 'kv_missing' }, 500);

  const simKV = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  const paused = !!(simKV && (await simKV.get('anthropic_paused')));
  const apiKey = env.ANTHROPIC_API_KEY as string | undefined;
  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  const emailsKV = env.EMAILS as KVNamespace | undefined;

  const r = await processCvPendingOnce({
    kv: kv as unknown as KvLike,
    paused,
    now: () => Date.now(),
    newId: () => crypto.randomUUID(),
    analyze: async (job) => {
      if (!apiKey) return { ok: false, status: 'llm_error', ms: 0 };
      const o = await runCvAnalysis(apiKey, {
        cv: job.cv,
        country: job.country,
        rolObjetivo: job.rolObjetivo,
        origen: job.origen,
        paginas: job.paginas,
      });
      return o.ok
        ? { ok: true, result: o.result, parcial: o.parcial, outputTokens: o.outputTokens, ms: o.ms, modelo: o.modelo }
        : { ok: false, status: o.status, outputTokens: o.outputTokens, ms: o.ms, modelo: o.modelo };
    },
    sendAnalysis: (job, result) =>
      sendCvAnalysisEmail(token, job.email, result, { rolFormulario: job.rolObjetivo, marketing: job.marketing, reintento: true }),
    finalize: async (job, result) => {
      await finalizeCvSuccess(env, jobLeadContext(job), result, {
        rolFormulario: job.rolObjetivo,
        reintento: true,
        sendAnalysisEmail: false,
      }).catch((err) => console.error('cv-process-pending: finalize failed', err));
    },
    sendApology: (job) => sendCvApology(token, job.email),
    alert: (job, motivo, apologySent) => alertCvFailure(token, job, motivo, apologySent),
    record: async (job, status, extra = {}) => {
      await putAttemptKv(emailsKV, job.attemptKey, attemptKvRecord(job, { status, ...extra }));
      const conteos = job.result
        ? job.result.observaciones.reduce(
            (c, o) => ({ ...c, [o.estado]: c[o.estado] + 1 }),
            { prioritario: 0, mejorable: 0, solido: 0, no_evaluable: 0 },
          )
        : undefined;
      await recordCvAttemptD1(db, jobAttemptCtx(job), {
        status,
        intentoN: job.attempts,
        outputTokens: job.outputTokens,
        ms: job.ms,
        modelo: job.modelo,
        parcial: job.parcial,
        conteos,
        correo: typeof extra.correo === 'boolean' ? extra.correo : undefined,
      });
    },
  });

  return jsonResponse({ ok: true, ...r, job: r.job ? r.job.slice(-8) : undefined, paused });
};

export const POST = GET;
