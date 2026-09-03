/**
 * /api/simulator-post-package-cron
 *
 * Task #74 (3 sept 2026). Envía email opcional de feedback al usuario que
 * terminó su paquete pagado hace ≥24h y no dejó feedback tipo package_final.
 *
 * Incluye cupón de descuento al Curso Solca CV+ATS+LinkedIn (Hotmart) para
 * incentivar respuesta.
 *
 * Se llama por cron externo (mismo cron-job.org que llama /simulator-process-pending,
 * o cron nuevo). Auth: `?key=<STATS_KEY>`.
 *
 * Flujo:
 * 1. Lista KV `pkg_end:*` (targets encolados en handleNext cuando remaining=0).
 * 2. Por cada target, verifica que hayan pasado ≥24h desde terminadoAt.
 * 3. Cross-check con D1 `paid_feedback` · si YA respondió package_final, skip + borra pkg_end.
 * 4. Si NO respondió, envía email Postmark `simulator-post-package-feedback` + borra pkg_end.
 *
 * Cupón: variable env HOTMART_COUPON_FEEDBACK (default `FEEDBACK25`).
 * El link al curso Solca puede incluir el cupón preapplicado en URL o solo mencionarlo.
 */

import type { APIRoute } from 'astro';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';

export const prerender = false;

interface PackageEndTarget {
  email: string;
  firstName?: string;
  plan: 'basico' | 'premium';
  role?: string;
  terminadoAt: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function alreadyFedback(db: D1Database, sessionId: string): Promise<boolean> {
  try {
    const row = await db
      .prepare(
        `SELECT id FROM paid_feedback WHERE session_id = ? AND feedback_type = 'package_final' LIMIT 1`,
      )
      .bind(sessionId)
      .first();
    return !!row;
  } catch {
    return false;
  }
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env: Record<string, unknown> } }).runtime?.env ?? {};
  const statsKey = env.STATS_KEY as string | undefined;
  const url = new URL(request.url);
  if (!statsKey || url.searchParams.get('key') !== statsKey) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  const postmarkToken = env.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!kv) return jsonResponse({ ok: false, error: 'kv_missing' }, 500);

  // Default FEEDBACK35 · 35% off en el Curso Solca (Hotmart). Cupón mayor que
  // SUSCRIPTOR30 (30%) porque quien ya compró el paquete merece un poquito más
  // que quien solo es suscriptor del newsletter. Override con env var.
  const couponCode = (env.HOTMART_COUPON_FEEDBACK as string | undefined) ?? 'FEEDBACK35';
  const courseUrl =
    'https://solcadesigns.hotmart.host/cv-en-ciencias-biologicas-y-de-de-la-salud-ats-linkedin-e78259bd-c882-4b61-b496-9d3da84d06b2';

  const list = await kv.list({ prefix: 'pkg_end:', limit: 50 });
  if (list.keys.length === 0) {
    return jsonResponse({ ok: true, processed: 0, message: 'no targets' });
  }

  const nowMs = Date.now();
  const cutoffAgeMs = 24 * 60 * 60 * 1000; // 24h de espera antes de enviar
  const results: Array<{ sessionId: string; status: string }> = [];

  for (const k of list.keys) {
    const sessionId = k.name.slice('pkg_end:'.length);
    const raw = await kv.get(k.name);
    if (!raw) {
      results.push({ sessionId, status: 'stale · deleted' });
      await kv.delete(k.name);
      continue;
    }

    let target: PackageEndTarget;
    try {
      target = JSON.parse(raw) as PackageEndTarget;
    } catch {
      results.push({ sessionId, status: 'parse_error · deleted' });
      await kv.delete(k.name);
      continue;
    }

    const ageMs = nowMs - new Date(target.terminadoAt).getTime();
    if (ageMs < cutoffAgeMs) {
      results.push({ sessionId, status: `waiting · ${Math.round(ageMs / 3600000)}h de 24h` });
      continue;
    }

    // Verificar si ya respondió package_final
    if (db && (await alreadyFedback(db, sessionId))) {
      results.push({ sessionId, status: 'already_responded · deleted' });
      await kv.delete(k.name);
      continue;
    }

    // Enviar email
    if (!postmarkToken) {
      results.push({ sessionId, status: 'postmark_missing' });
      continue;
    }
    try {
      const planLabel = target.plan === 'premium' ? 'Premium' : 'Básico';
      await sendEmailWithTemplate(postmarkToken, {
        from: 'Oscar Solís <hola@solcaciencia.com>',
        to: target.email,
        templateAlias: 'simulator-post-package-feedback',
        messageStream: 'outbound',
        tag: 'simulator-post-package',
        templateModel: {
          first_name: target.firstName || 'ahí',
          plan_label: planLabel,
          role_practiced: target.role || 'tu rol',
          coupon_code: couponCode,
          course_url: courseUrl,
          feedback_url: `https://solcaciencia.com/simulador-entrevistas/sesion?email=${encodeURIComponent(target.email)}&feedback=1`,
        },
        metadata: {
          source: 'post-package-cron',
          session_id: sessionId,
          plan: target.plan,
        },
      });
      results.push({ sessionId, status: 'sent · deleted' });
      await kv.delete(k.name);
    } catch (err) {
      if (err instanceof PostmarkError) {
        results.push({ sessionId, status: `postmark_${err.status}` });
      } else {
        results.push({ sessionId, status: 'send_error' });
      }
      // No borramos el target para reintentar en la próxima corrida
    }
  }

  return jsonResponse({ ok: true, processed: results.length, results });
};

// POST alias para compatibilidad con crons que solo mandan POST
export const POST = GET;
