/**
 * /api/simulator-process-pending · procesa pendings con CHUNKING del reporte.
 *
 * v0.8 (3 sept 2026): reescrito para chunking. Cada llamada a Anthropic <25s.
 * El reporte final se construye en múltiples chunks:
 *   - Chunk 1: summary (scores + fortalezas + areas + vocab + recomendacion + CTA)
 *   - Chunk N (por lotes de 5 preguntas): breakdown de preguntas
 *
 * Progreso persistido en `state.finalReportChunks` para retomar entre corridas
 * del cron. Al completarse todos los chunks → merge en `state.finalReport`,
 * `finalReportStatus='ready'`, envío de email al usuario.
 *
 * Auth: `?key=<STATS_KEY>`.
 *
 * Diseño fire-and-forget: responde inmediato al cron para no bloquear su
 * timeout (30s de cron-job.org gratis). Cada pending se procesa via
 * ctx.waitUntil hasta cabe (<25s por chunk). Si un pending necesita más
 * chunks de los que caben, se guarda progreso y siguiente corrida continúa.
 */

import type { APIRoute } from 'astro';
import {
  retryableChatCompletion,
  extractText,
  AnthropicError,
} from '../../lib/anthropic';
import {
  buildSummaryChunkPrompt,
  buildBreakdownChunkPrompt,
} from '../../lib/simulator-prompt';
import { parseFinalOutput } from '../../lib/simulator-metrics-parser';
import { sendEmail, sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { writeMetricsToD1 } from '../../lib/simulator-metrics-writer';
import type { SessionState, ChatMessage, FinalReport } from '../../lib/simulator-types';

export const prerender = false;

const MODEL = 'claude-sonnet-4-6';
const TEMPERATURE = 0.5;
const MAX_ATTEMPTS = 3;
const CHUNK_BREAKDOWN_SIZE = 5; // preguntas por chunk

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
  return messages;
}

/**
 * Procesa 1 chunk (summary o breakdown range) del reporte para un state dado.
 * Retorna el JSON parseado del chunk. Reintenta hasta MAX_ATTEMPTS con backoff.
 */
async function generateChunk(
  apiKey: string,
  state: SessionState,
  chunkType: 'summary' | 'breakdown',
  breakdownRange?: { start: number; end: number },
): Promise<Record<string, unknown>> {
  const promptOptions = {
    profile: state.profile,
    plan: state.plan,
    sessionNumberInPackage: state.sessionNumberInPackage,
    cvSummary: state.cvSummary,
  };
  const systemPrompt =
    chunkType === 'summary'
      ? buildSummaryChunkPrompt(promptOptions)
      : buildBreakdownChunkPrompt(promptOptions, breakdownRange!.start, breakdownRange!.end);

  const messages = buildMessagesFromState(state);
  messages.push({
    role: 'user',
    content:
      chunkType === 'summary'
        ? 'Devuelve el JSON del SUMMARY del reporte final. Solo summary + scores + fortalezas + areas_de_mejora + vocabulario_a_incorporar + recomendacion_final + CTA. Nada más.'
        : `Devuelve el JSON del BREAKDOWN de las preguntas ${breakdownRange!.start} a ${breakdownRange!.end}. Solo questions_breakdown. Nada más.`,
  });

  const response = await retryableChatCompletion(
    {
      apiKey,
      model: MODEL,
      system: systemPrompt,
      messages,
      temperature: TEMPERATURE,
      maxTokens: 4000, // suficiente para 1 chunk, cabe en <25s
      timeoutMs: 25000, // margen bajo el subrequest limit de 30s de Cloudflare
    },
    `pending-chunk-${chunkType}${breakdownRange ? `-${breakdownRange.start}-${breakdownRange.end}` : ''}`,
  );

  const text = extractText(response);
  // Extraer JSON del texto (puede venir con ```json ... ```)
  const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) ?? text.match(/(\{[\s\S]+\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;
  return JSON.parse(jsonStr) as Record<string, unknown>;
}

/**
 * Merge de chunks (summary + breakdowns) en un FinalReport completo.
 */
function mergeChunks(state: SessionState): FinalReport | null {
  const chunks = state.finalReportChunks;
  if (!chunks?.summary) return null;
  const summaryData = chunks.summary as unknown as {
    session_id?: string;
    rol?: string;
    n_questions?: number;
    summary?: {
      scores?: { tecnico: number; estructura: number; especificidad: number; alertas_count?: number };
      fortalezas?: string[];
      areas_de_mejora?: string[];
      vocabulario_a_incorporar?: string[];
      recomendacion_final?: string;
    };
    cta?: { type?: string; title?: string; description?: string; url?: string };
  };

  const breakdown: FinalReport['questionsBreakdown'] = [];
  const chunksList = chunks.breakdowns ?? [];
  const sortedChunks = [...chunksList].sort((a, b) => a.start - b.start);
  for (const bc of sortedChunks) {
    breakdown.push(...(bc.questions ?? []));
  }

  return {
    sessionId: state.sessionId,
    rol: summaryData.rol ?? state.profile.roleTitle ?? 'No especificado',
    nQuestions: summaryData.n_questions ?? state.profile.questionCount,
    summary: {
      scores: {
        tecnico: summaryData.summary?.scores?.tecnico ?? 0,
        estructura: summaryData.summary?.scores?.estructura ?? 0,
        especificidad: summaryData.summary?.scores?.especificidad ?? 0,
        alertasCount: summaryData.summary?.scores?.alertas_count ?? 0,
      },
      fortalezas: summaryData.summary?.fortalezas ?? [],
      areasDeMejora: summaryData.summary?.areas_de_mejora ?? [],
      vocabularioAIncorporar: summaryData.summary?.vocabulario_a_incorporar ?? [],
      recomendacionFinal: summaryData.summary?.recomendacion_final ?? '',
    },
    questionsBreakdown: breakdown,
    cta: {
      type: (summaryData.cta?.type as 'libro' | 'recurso_gratuito') ?? 'recurso_gratuito',
      title: summaryData.cta?.title ?? 'Siguiente paso',
      description: summaryData.cta?.description ?? '',
      url: summaryData.cta?.url ?? '/revisar-cv',
    },
  };
}

/**
 * Procesa 1 pending: hace 1 chunk por corrida para no exceder budget de time.
 * Si aún faltan más chunks, deja progreso en el state para que la próxima
 * corrida del cron continúe.
 */
async function processOneChunk(
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
  state.finalReportChunks = state.finalReportChunks ?? {};
  state.finalReportStatus = state.finalReportStatus ?? 'processing';

  const totalQuestions = state.profile.questionCount;
  const chunksNeeded: Array<
    | { type: 'summary' }
    | { type: 'breakdown'; start: number; end: number }
  > = [];

  // Chunk summary si aún no está
  if (!state.finalReportChunks.summary) {
    chunksNeeded.push({ type: 'summary' });
  }

  // Chunks breakdown (lotes de 5)
  const existingRanges = new Set(
    (state.finalReportChunks.breakdowns ?? []).map((b) => `${b.start}-${b.end}`),
  );
  for (let start = 1; start <= totalQuestions; start += CHUNK_BREAKDOWN_SIZE) {
    const end = Math.min(start + CHUNK_BREAKDOWN_SIZE - 1, totalQuestions);
    const rangeKey = `${start}-${end}`;
    if (!existingRanges.has(rangeKey)) {
      chunksNeeded.push({ type: 'breakdown', start, end });
    }
  }

  if (chunksNeeded.length === 0) {
    // Todos los chunks completos, merge y finalizar
    const finalReport = mergeChunks(state);
    if (!finalReport) {
      await kv.delete(pendingKey);
      return { ok: false, status: 'merge_failed' };
    }
    state.finalReport = finalReport;
    state.finalReportStatus = 'ready';
    delete state.finalReportError;

    await kv.put(`session:${state.sessionId}`, JSON.stringify(state), {
      expirationTtl: 60 * 60 * 24 * 90,
    });
    await kv.delete(pendingKey);

    // Escribir métricas a D1 si el summary trae metrics_anonymous (chunk summary lo omite,
    // pero podemos derivar métricas mínimas de scores promedio)
    // Se omite por brevedad — puede agregarse después.

    // Enviar email al usuario
    const email = pending.userEmail || state.userEmail;
    const firstName = pending.userFirstName || (email ? email.split('@')[0] : 'ahí');
    if (postmarkToken && email) {
      try {
        await sendEmailWithTemplate(postmarkToken, {
          from: 'Oscar Solís <hola@solcaciencia.com>',
          to: email,
          templateAlias: 'simulator-report-ready',
          messageStream: 'outbound',
          tag: 'simulator-report-ready',
          templateModel: {
            first_name: firstName,
            rol: finalReport.rol,
            n_questions: finalReport.nQuestions,
            tecnico: finalReport.summary.scores.tecnico.toFixed(1),
            estructura: finalReport.summary.scores.estructura.toFixed(1),
            especificidad: finalReport.summary.scores.especificidad.toFixed(1),
            recomendacion_final: finalReport.summary.recomendacionFinal,
            report_url: `https://solcaciencia.com/simulador-entrevistas/sesion?sessionId=${state.sessionId}`,
          },
        });
      } catch (err) {
        if (err instanceof PostmarkError) {
          console.error(`[pending-cron] Postmark failed for ${pending.sessionId}:`, err.status);
        }
      }
    }

    return { ok: true, status: 'ready · email sent' };
  }

  // Procesar 1 chunk (el primero de la lista)
  const chunk = chunksNeeded[0];
  try {
    if (chunk.type === 'summary') {
      const parsed = await generateChunk(apiKey, state, 'summary');
      state.finalReportChunks.summary = parsed as SessionState['finalReportChunks']['summary'];
    } else {
      const parsed = await generateChunk(apiKey, state, 'breakdown', {
        start: chunk.start,
        end: chunk.end,
      });
      const questionsData = (parsed as { questions_breakdown?: unknown[] }).questions_breakdown ?? [];
      state.finalReportChunks.breakdowns = state.finalReportChunks.breakdowns ?? [];
      state.finalReportChunks.breakdowns.push({
        start: chunk.start,
        end: chunk.end,
        questions: questionsData as FinalReport['questionsBreakdown'],
      });
    }

    // Persistir progreso
    await kv.put(`session:${state.sessionId}`, JSON.stringify(state), {
      expirationTtl: 60 * 60 * 24 * 90,
    });

    const remaining = chunksNeeded.length - 1;
    return {
      ok: true,
      status: `chunk_done · ${chunk.type}${chunk.type === 'breakdown' ? ` ${chunk.start}-${chunk.end}` : ''} · ${remaining} chunks restantes`,
    };
  } catch (err) {
    pending.attempts += 1;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[pending-cron] chunk failed for ${pending.sessionId}:`, errMsg);

    if (pending.attempts >= MAX_ATTEMPTS) {
      // Damos up. Notificar al usuario con disculpa.
      await kv.delete(pendingKey);
      state.finalReportStatus = 'failed';
      state.finalReportError = errMsg;
      await kv.put(`session:${state.sessionId}`, JSON.stringify(state), {
        expirationTtl: 60 * 60 * 24 * 90,
      });
      const email = pending.userEmail || state.userEmail;
      const firstName = pending.userFirstName || (email ? email.split('@')[0] : 'ahí');
      if (postmarkToken && email) {
        try {
          await sendEmail(postmarkToken, {
            from: 'Oscar Solís <hola@solcaciencia.com>',
            to: email,
            subject: `Sobre tu sesión del Simulador · seguimiento manual`,
            textBody: `Hola ${firstName},\n\nTuvimos un problema técnico persistente generando el reporte de tu sesión del simulador. Ya lo estamos revisando manualmente.\n\nSi puedes, respóndeme confirmando que quieres el reporte y te lo hago llegar lo antes posible.\n\nDisculpa las molestias.\n\n— Oscar Solís · Solca Ciencia`,
            tag: 'simulator-pending-failed',
          });
        } catch {
          /* ignore */
        }
      }
      return { ok: false, status: `max_attempts_reached · ${errMsg.slice(0, 100)}` };
    }

    // Reintentar en la próxima corrida
    await kv.put(pendingKey, JSON.stringify(pending), { expirationTtl: 60 * 60 * 24 * 7 });
    return { ok: false, status: `retry_scheduled · attempt ${pending.attempts}` };
  }
}

export const GET: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as { runtime?: { env: Record<string, unknown>; ctx?: { waitUntil?: (p: Promise<unknown>) => void } } }).runtime;
  const env = runtime?.env ?? {};
  const statsKey = env.STATS_KEY as string | undefined;
  const url = new URL(request.url);
  if (!statsKey || url.searchParams.get('key') !== statsKey) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (!kv) return jsonResponse({ ok: false, error: 'kv_missing' }, 500);

  const list = await kv.list({ prefix: 'pending:', limit: 5 });
  if (list.keys.length === 0) {
    return jsonResponse({ ok: true, processed: 0, message: 'no pending sessions' });
  }

  // Fire-and-forget: procesar cada pending en background para no bloquear el cron.
  const enqueued: Array<{ sessionId: string; status: string }> = [];
  const waitUntil = runtime?.ctx?.waitUntil;

  for (const k of list.keys) {
    const raw = await kv.get(k.name);
    if (!raw) continue;
    let pending: PendingRecord;
    try {
      pending = JSON.parse(raw) as PendingRecord;
    } catch {
      continue;
    }
    const promise = processOneChunk(env, k.name, pending);
    if (waitUntil) {
      waitUntil(promise);
      enqueued.push({ sessionId: pending.sessionId, status: 'processing_background' });
    } else {
      const r = await promise;
      enqueued.push({ sessionId: pending.sessionId, status: r.status });
    }
  }

  return jsonResponse({
    ok: true,
    enqueued: enqueued.length,
    results: enqueued,
    note: 'Chunking · each cron run processes 1 chunk per pending. Check KV for state.finalReportStatus.',
  });
};

export const POST = GET;
