/**
 * /api/simulator-process-pending · procesa sesiones con reporte final pendiente.
 *
 * Blindaje C (2 sept 2026): si handleNext o handleRetryReport agotan reintentos
 * y encolan la sesión con prefix `pending:` en KV SIMULATOR_SESSIONS, este
 * endpoint las procesa async fuera del contexto de la request original.
 *
 * Se llama por cron trigger cada 5-10 min. También se puede llamar manualmente
 * para forzar procesamiento inmediato.
 *
 * Auth: query param `key=<STATS_KEY>` (mismo secret que usan los dashboards
 * de Solca en /api/cv-stats, /api/quiz-stats, /api/simulator-stats).
 *
 * Comportamiento:
 * 1. Lista `pending:*` en SIMULATOR_SESSIONS.
 * 2. Por cada pending, carga el state completo, intenta generar el reporte
 *    con streaming (más tiempo disponible, sin gateway 100s si CF activa
 *    unbound o si el streaming mantiene la conexión).
 * 3. Éxito → actualiza state.finalReport en KV, envía email al usuario con
 *    el reporte, borra el `pending:`.
 * 4. Fallo → incrementa attempts. Si >= 3, envía email al usuario con
 *    disculpa + link a escribirnos, borra pending.
 *
 * Compatibilidad con Cron Trigger de Cloudflare:
 * - Opción A: Astro Cloudflare adapter + scheduled handler (compleja).
 * - Opción B (usada): cron externo que hace curl a este endpoint. Ver
 *   `_docs/PAYWALL_SIMULADOR.md` sección "Cron pending processor".
 */

import type { APIRoute } from 'astro';
import { retryableChatCompletionStream, extractText, AnthropicError } from '../../lib/anthropic';
import { buildSystemPrompt } from '../../lib/simulator-prompt';
import { parseFinalOutput } from '../../lib/simulator-metrics-parser';
import { sendEmail, PostmarkError } from '../../lib/postmark';
import type { SessionState, ChatMessage } from '../../lib/simulator-types';

export const prerender = false;

const MODEL = 'claude-sonnet-4-6';
const TEMPERATURE = 0.5;
const MAX_ATTEMPTS = 3;
const FINAL_REPORT_BASE_TOKENS = 3000;
const FINAL_REPORT_TOKENS_PER_QUESTION = 400;
const FINAL_REPORT_TOKENS_CAP = 16000;

interface PendingRecord {
  sessionId: string;
  enqueuedAt: string;
  errorMessage: string;
  attempts: number;
  priority: 'normal' | 'high';
  userEmail?: string;
  userFirstName?: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function finalReportMaxTokens(questionCount: number): number {
  const computed = FINAL_REPORT_BASE_TOKENS + questionCount * FINAL_REPORT_TOKENS_PER_QUESTION;
  return Math.min(computed, FINAL_REPORT_TOKENS_CAP);
}

function buildMessagesFromState(state: SessionState): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const turn of state.turns) {
    if (turn.questionText) messages.push({ role: 'assistant', content: turn.questionText });
    if (turn.userAnswer) {
      const withTiming = turn.userAnswerSeconds
        ? `${turn.userAnswer}\n\n(Tiempo de respuesta: ${turn.userAnswerSeconds} segundos)`
        : turn.userAnswer;
      messages.push({ role: 'user', content: withTiming });
    }
  }
  messages.push({
    role: 'user',
    content:
      'Esa fue la última respuesta del candidato. Devuelve el reporte final en JSON según el schema del system prompt.',
  });
  return messages;
}

async function processPending(
  env: Record<string, unknown>,
  pendingKey: string,
  pending: PendingRecord,
): Promise<{ ok: boolean; status: string }> {
  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  const apiKey = env.ANTHROPIC_API_KEY as string | undefined;
  const postmarkToken = env.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!kv || !apiKey) return { ok: false, status: 'missing_env' };

  const raw = await kv.get(`session:${pending.sessionId}`);
  if (!raw) {
    await kv.delete(pendingKey);
    return { ok: false, status: 'state_expired' };
  }
  const state = JSON.parse(raw) as SessionState;

  // Resolver email del usuario si aún no está en el pending.
  // Cruzamos state.betaCode con KV EMAILS prefix `sim:` (mismo mecanismo que
  // scripts/simulator-lookup-email-fast.mjs pero on-demand).
  if (!pending.userEmail && state.betaCode) {
    const emailsKv = env.EMAILS as KVNamespace | undefined;
    if (emailsKv) {
      const emailList = await emailsKv.list({ prefix: 'sim:', limit: 1000 });
      for (const k of emailList.keys) {
        const leadRaw = await emailsKv.get(k.name);
        if (!leadRaw) continue;
        try {
          const lead = JSON.parse(leadRaw) as { code?: string; email?: string; name?: string };
          if (lead.code === state.betaCode && lead.email) {
            pending.userEmail = lead.email;
            pending.userFirstName = (lead.name ?? '').trim().split(/\s+/)[0] || undefined;
            break;
          }
        } catch {
          /* skip */
        }
      }
    }
  }

  const systemPrompt = buildSystemPrompt({
    profile: state.profile,
    plan: state.plan,
    sessionNumberInPackage: state.sessionNumberInPackage,
    cvSummary: state.cvSummary,
  });
  const messages = buildMessagesFromState(state);

  try {
    const response = await retryableChatCompletionStream(
      {
        apiKey,
        model: MODEL,
        system: systemPrompt,
        messages,
        temperature: TEMPERATURE,
        maxTokens: finalReportMaxTokens(state.profile.questionCount),
        timeoutMs: 300000, // 5 min · sin límite HTTP en este contexto de cron
      },
      `pending-${pending.sessionId}`,
    );

    const parsed = parseFinalOutput(extractText(response));
    if (!parsed.finalReport) {
      // Parse falló · incrementar attempts
      pending.attempts += 1;
      if (pending.attempts >= MAX_ATTEMPTS) {
        await kv.delete(pendingKey);
        return { ok: false, status: 'parse_failed_max_attempts' };
      }
      await kv.put(pendingKey, JSON.stringify(pending), { expirationTtl: 60 * 60 * 24 * 7 });
      return { ok: false, status: 'parse_failed_retry_scheduled' };
    }

    // Éxito: actualiza state con el reporte generado, borra pending.
    state.finalReport = parsed.finalReport;
    state.finalReportError = undefined;
    state.finished = true;
    await kv.put(`session:${state.sessionId}`, JSON.stringify(state), {
      expirationTtl: 60 * 60 * 24 * 90,
    });
    await kv.delete(pendingKey);

    // Email al usuario si tenemos email + token.
    if (postmarkToken && pending.userEmail) {
      try {
        await sendEmail(postmarkToken, {
          from: 'Oscar Solís <hola@solcaciencia.com>',
          to: pending.userEmail,
          subject: `Tu reporte del Simulador · ${state.profile.roleTitle ?? 'práctica general'}`,
          textBody: `Hola ${pending.userFirstName ?? 'ahí'},\n\nTu reporte del simulador ya está listo. Puedes verlo en:\nhttps://solcaciencia.com/simulador-entrevistas/sesion?sessionId=${state.sessionId}\n\nDisculpa la demora — tuvimos un problema momentáneo generándolo y lo procesamos en segundo plano.\n\n— Oscar Solís · Solca Ciencia`,
          tag: 'simulator-pending-recovered',
        });
      } catch (err) {
        if (err instanceof PostmarkError) {
          console.error(`[pending-cron] Postmark failed for ${pending.sessionId}:`, err.status);
        }
      }
    }

    return { ok: true, status: 'recovered' };
  } catch (err) {
    pending.attempts += 1;
    const errMsg = err instanceof Error ? err.message : String(err);

    if (pending.attempts >= MAX_ATTEMPTS) {
      // Damos up. Notificar al usuario con disculpa y sacar del cola.
      await kv.delete(pendingKey);
      if (postmarkToken && pending.userEmail) {
        try {
          await sendEmail(postmarkToken, {
            from: 'Oscar Solís <hola@solcaciencia.com>',
            to: pending.userEmail,
            subject: `Sobre tu sesión del Simulador · seguimiento manual`,
            textBody: `Hola ${pending.userFirstName ?? 'ahí'},\n\nTuvimos un problema técnico persistente generando el reporte de tu sesión del simulador. Ya lo estamos revisando manualmente.\n\nSi puedes, respóndeme a este correo confirmando que quieres el reporte y te lo hago llegar lo antes posible.\n\nDisculpa las molestias.\n\n— Oscar Solís · Solca Ciencia`,
            tag: 'simulator-pending-failed',
          });
        } catch {
          /* ignore */
        }
      }
      return { ok: false, status: `max_attempts_reached · ${errMsg.slice(0, 100)}` };
    }

    // Reintentar en la próxima corrida del cron.
    await kv.put(pendingKey, JSON.stringify(pending), { expirationTtl: 60 * 60 * 24 * 7 });
    return { ok: false, status: `retry_scheduled · attempt ${pending.attempts}` };
  }
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env: Record<string, unknown> } }).runtime?.env ?? {};
  const statsKey = env.STATS_KEY as string | undefined;

  // Auth
  const url = new URL(request.url);
  const providedKey = url.searchParams.get('key');
  if (!statsKey || providedKey !== statsKey) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (!kv) return jsonResponse({ ok: false, error: 'kv_missing' }, 500);

  // Listar pending:*
  const list = await kv.list({ prefix: 'pending:', limit: 20 });
  if (list.keys.length === 0) {
    return jsonResponse({ ok: true, processed: 0, message: 'no pending sessions' });
  }

  const results: Array<{ sessionId: string; status: string }> = [];
  for (const k of list.keys) {
    const raw = await kv.get(k.name);
    if (!raw) continue;
    let pending: PendingRecord;
    try {
      pending = JSON.parse(raw) as PendingRecord;
    } catch {
      continue;
    }
    const r = await processPending(env, k.name, pending);
    results.push({ sessionId: pending.sessionId, status: r.status });
  }

  return jsonResponse({
    ok: true,
    processed: results.length,
    results,
  });
};

// Permitimos POST también para compatibilidad con crons externos que solo permiten POST
export const POST = GET;
