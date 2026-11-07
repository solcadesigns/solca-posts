/**
 * /api/cv-medida-process · cola de CV a la medida (6 nov 2026).
 *
 * Lo dispara el mismo Cron Trigger `*\/5 * * * *` que /api/cv-process-pending (scripts/patch-cron-handler.mjs llama
 * a los dos, uno después del otro); no hay trigger nuevo porque la cuenta está en el tope de 5. Protegido con
 * `?key=<STATS_KEY>` como los demás endpoints de cron. La lógica vive en src/lib/cv-medida-queue.ts (probada offline).
 */

import type { APIRoute } from 'astro';
import { procesarCvMedidaUnaVez, type KvLike } from '../../lib/cv-medida-queue';
import { depsProcesador } from '../../lib/cv-medida-run';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  const statsKey = env.STATS_KEY as string | undefined;
  if (!statsKey || new URL(request.url).searchParams.get('key') !== statsKey) return json({ ok: false, error: 'unauthorized' }, 401);
  const kv = env.CV_LIMITS as KVNamespace | undefined;
  if (!kv) return json({ ok: false, error: 'kv_missing' }, 500);
  const simKV = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  const paused = !!(simKV && (await simKV.get('anthropic_paused')));
  const r = await procesarCvMedidaUnaVez(depsProcesador(env, kv as unknown as KvLike, paused));
  return json({ ok: true, ...r, job: r.job ? r.job.slice(0, 8) : undefined, paused });
};

export const POST = GET;
