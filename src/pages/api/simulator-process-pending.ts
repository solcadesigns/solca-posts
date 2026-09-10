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
import { getRoleCta } from '../../lib/simulator-defaults';
import type { SessionState, ChatMessage, FinalReport } from '../../lib/simulator-types';

export const prerender = false;

// FIX (8 sept 2026): migrado a Haiku 4.5 para los chunks del reporte.
// Post-mortem: Sonnet 4.5 tarda ~20-30s por chunk → excede el timeout del cron
// externo (30s en cron-job.org free). Haiku 4.5 es 3x más rápido (~8s por chunk)
// y 3x más barato ($1/$5 vs $3/$15). Calidad más que suficiente para generar
// JSON estructurado según framework fijo (no razonamiento complejo).
// Las preguntas de la sesión siguen con Sonnet (calidad conversacional).
const MODEL = 'claude-haiku-4-5';
const TEMPERATURE = 0.5;
// FIX (8 sept 2026): MAX_ATTEMPTS de 2 → 1. Single-shot por chunk.
// Post-mortem: cada attempt gasta tokens completos y con reintentos internos
// del retryableChatCompletion (3 más), un solo pending fallido gasta 6+ requests.
// Con single-shot: 1 chunk = 1 request = costo predecible.
const MAX_ATTEMPTS = 1;
// FIX (9 sept 2026): reducido de 3 → 2 preguntas por chunk.
// Post-mortem: con 3 preguntas + contexto real (~30-40k tokens de mensajes
// acumulados de sesión de 15q), los chunks 4-5 todavía tardan >28s incluso
// con prompt caching del system. El bottleneck son los mensajes, no el system.
// Con 2 preguntas el output es más corto → menos tiempo total.
// Trade-off: 15q = 1 summary + 8 breakdowns = 9 corridas × 2 min = ~18 min.
const CHUNK_BREAKDOWN_SIZE = 2;

// Ángulos pedagógicos asignados determinísticamente por chunk breakdown.
// v3 (10 sept 2026) · reemplaza rotación libre por asignación fija para
// garantizar cobertura de los 4 ángulos (A, C, D, E) en 10 preguntas.
// Antes: cada chunk elegía libremente sus ángulos y podía repetir uno 5
// veces mientras omitía otros. Ahora: mapa determinístico por índice de
// chunk. Cobertura para 10 preguntas: A×3, C×2, D×3, E×2.
//
// El mapa cubre hasta 8 chunks (16 preguntas), suficiente para el máximo
// actual de 15q (7 chunks) más margen. Si un chunkIndex excede el mapa,
// se cae a rotación libre en el prompt del chunk (fallback seguro).
const ANGLES_BY_CHUNK: Array<Array<'A' | 'C' | 'D' | 'E'>> = [
  ['A', 'C'], // pregs 1-2
  ['D', 'E'], // pregs 3-4
  ['C', 'A'], // pregs 5-6
  ['E', 'D'], // pregs 7-8
  ['A', 'D'], // pregs 9-10
  ['C', 'E'], // pregs 11-12 (reserva)
  ['D', 'A'], // pregs 13-14 (reserva)
  ['E', 'C'], // pregs 15-16 (reserva)
];

/**
 * Devuelve los ángulos pedagógicos asignados a un chunk breakdown, dado
 * el índice del chunk (0-indexed). Fallback a undefined si el índice
 * excede el mapa (dispara rotación libre en buildBreakdownChunkPrompt).
 */
function getAssignedAngles(chunkIndex: number): Array<'A' | 'C' | 'D' | 'E'> | undefined {
  if (chunkIndex < 0 || chunkIndex >= ANGLES_BY_CHUNK.length) return undefined;
  return ANGLES_BY_CHUNK[chunkIndex];
}

interface PendingRecord {
  sessionId: string;
  enqueuedAt: string;
  errorMessage: string;
  attempts: number;
  priority: 'normal' | 'high';
  userEmail?: string;
  userFirstName?: string;
}

// Budget hard por sesión (8 sept 2026 · post-mortem sangrado).
// Si una sola sesión supera este límite total de tokens (input+output sumado
// entre todos los chunks + reintentos), se marca como failed y no se
// procesa más. Protección de último recurso contra runaway.
// 200k tokens ≈ $0.60 USD con Sonnet 4.5, ~$0.20 con Haiku 4.5.
const MAX_TOKENS_PER_SESSION = 200000;

/**
 * Lee, suma y persiste el contador de tokens de una sesión.
 * Retorna { exceeded: true } si el nuevo total supera el budget.
 * Key: session_budget:<sessionId> · TTL 90 días.
 */
async function trackSessionBudget(
  kv: KVNamespace,
  sessionId: string,
  tokensToAdd: number,
): Promise<{ exceeded: boolean; totalTokens: number }> {
  const key = `session_budget:${sessionId}`;
  const rawCurrent = await kv.get(key);
  const current = rawCurrent ? Number.parseInt(rawCurrent, 10) : 0;
  const nextTotal = current + tokensToAdd;
  await kv.put(key, String(nextTotal), { expirationTtl: 60 * 60 * 24 * 90 });
  return { exceeded: nextTotal > MAX_TOKENS_PER_SESSION, totalTokens: nextTotal };
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
): Promise<{ parsed: Record<string, unknown>; tokensUsed: number }> {
  const promptOptions = {
    profile: state.profile,
    plan: state.plan,
    sessionNumberInPackage: state.sessionNumberInPackage,
    cvSummary: state.cvSummary,
  };

  // Asignación determinística de ángulos pedagógicos por chunk breakdown.
  // Calcula chunkIndex a partir del rango: (start-1) / CHUNK_BREAKDOWN_SIZE.
  // start=1 → índice 0, start=3 → índice 1, etc.
  // Si CHUNK_BREAKDOWN_SIZE cambia, el mapa sigue funcionando porque el
  // buildBreakdownChunkPrompt valida el tamaño esperado vs el array.
  let assignedAngles: Array<'A' | 'C' | 'D' | 'E'> | undefined;
  if (chunkType === 'breakdown' && breakdownRange) {
    const chunkIndex = Math.floor((breakdownRange.start - 1) / CHUNK_BREAKDOWN_SIZE);
    assignedAngles = getAssignedAngles(chunkIndex);
  }

  const systemPrompt =
    chunkType === 'summary'
      ? buildSummaryChunkPrompt(promptOptions)
      : buildBreakdownChunkPrompt(
          promptOptions,
          breakdownRange!.start,
          breakdownRange!.end,
          assignedAngles,
        );

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
      // maxTokens ajustado: 2200 permite breakdown de 3q sin truncado JSON.
      maxTokens: 2200,
      timeoutMs: 28000,
      // Prompt caching (9 sept 2026): el system prompt (~5-8k tokens) se
      // cachea. Chunks subsecuentes leen del cache: 90% descuento en costo Y
      // se ahorran el tiempo de encoding. Antes: chunk 4-5 timeout a 28s
      // porque encoding del system+messages tomaba >20s.
      cacheSystem: true,
    },
    `pending-chunk-${chunkType}${breakdownRange ? `-${breakdownRange.start}-${breakdownRange.end}` : ''}`,
    1,
  );

  const text = extractText(response);
  const tokensUsed =
    (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
  // Extraer JSON del texto (puede venir con ```json ... ```)
  const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) ?? text.match(/(\{[\s\S]+\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;
  return { parsed: JSON.parse(jsonStr) as Record<string, unknown>, tokensUsed };
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
    // CTA override (9 sept 2026): usamos catálogo hardcoded por rol en vez de
    // dejar que el modelo invente títulos/URLs. Los tres libros Solca (MSL,
    // Clinical_PM, CRA) tienen URL Hotmart verificada. Otros roles caen al
    // curso CV con módulo de entrevistas.
    cta: getRoleCta(state.profile.role),
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
            // ?autodownload=1 hace que la landing dispare el download del PDF
            // automáticamente al cargar (si el reporte está ready). Un solo click
            // desde el email = PDF en tu disco.
            report_url: `https://solcaciencia.com/simulador-entrevistas/sesion?sessionId=${state.sessionId}&autodownload=1`,
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

  // GUARD DE BUDGET (8 sept 2026): check ANTES de cualquier llamada Anthropic.
  // Si esta sesión ya excedió el budget en corridas anteriores, cortamos aquí
  // sin gastar más tokens.
  const budgetPre = await trackSessionBudget(kv, pending.sessionId, 0);
  if (budgetPre.exceeded) {
    console.warn(`[pending-cron] sessionBudget exceeded ${pending.sessionId} (${budgetPre.totalTokens}), aborting`);
    await kv.delete(pendingKey);
    state.finalReportStatus = 'failed';
    state.finalReportError = `Session budget excedido: ${budgetPre.totalTokens} tokens > ${MAX_TOKENS_PER_SESSION}`;
    await kv.put(`session:${state.sessionId}`, JSON.stringify(state), {
      expirationTtl: 60 * 60 * 24 * 90,
    });
    return { ok: false, status: 'budget_exceeded' };
  }

  // Procesar 1 chunk (el primero de la lista)
  const chunk = chunksNeeded[0];
  try {
    let tokensUsedThisChunk = 0;
    if (chunk.type === 'summary') {
      const { parsed, tokensUsed } = await generateChunk(apiKey, state, 'summary');
      tokensUsedThisChunk = tokensUsed;
      state.finalReportChunks.summary = parsed as SessionState['finalReportChunks']['summary'];
    } else {
      const { parsed, tokensUsed } = await generateChunk(apiKey, state, 'breakdown', {
        start: chunk.start,
        end: chunk.end,
      });
      tokensUsedThisChunk = tokensUsed;
      const questionsData = (parsed as { questions_breakdown?: unknown[] }).questions_breakdown ?? [];
      // FIX (9 sept 2026): mapear snake_case (Anthropic JSON) → camelCase
      // (TS interfaces). El PDF renderer accede a `qb.questionNumber` pero
      // Anthropic devuelve `question_number` → resultado: "Pregunta undefined".
      const mappedQuestions = questionsData.map((q) => {
        const src = q as Record<string, unknown>;
        return {
          questionNumber: src.question_number,
          questionText: src.question_text,
          userAnswer: src.user_answer,
          scores: src.scores,
          angleUsed: src.angle_used,
          whatWorked: src.what_worked,
          whatToImprove: src.what_to_improve,
          modelPhrase: src.model_phrase,
        };
      });
      state.finalReportChunks.breakdowns = state.finalReportChunks.breakdowns ?? [];
      state.finalReportChunks.breakdowns.push({
        start: chunk.start,
        end: chunk.end,
        questions: mappedQuestions as FinalReport['questionsBreakdown'],
      });
    }

    // Persistir progreso
    await kv.put(`session:${state.sessionId}`, JSON.stringify(state), {
      expirationTtl: 60 * 60 * 24 * 90,
    });

    // Actualizar budget con tokens usados en este chunk
    const budgetPost = await trackSessionBudget(kv, pending.sessionId, tokensUsedThisChunk);
    const remaining = chunksNeeded.length - 1;
    return {
      ok: true,
      status: `chunk_done · ${chunk.type}${chunk.type === 'breakdown' ? ` ${chunk.start}-${chunk.end}` : ''} · ${remaining} restantes · ${tokensUsedThisChunk}t (total ${budgetPost.totalTokens}t)`,
    };
  } catch (err) {
    pending.attempts += 1;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[pending-cron] chunk failed for ${pending.sessionId}:`, errMsg);

    // Kill switch balance: si Anthropic devolvió 402/403, pausar TODO el
    // Anthropic global por 15 min. Evita que las próximas corridas del cron
    // sigan disparando requests que van a fallar y gastar dinero antes.
    if (err instanceof AnthropicError && (err.status === 402 || err.status === 403)) {
      await kv.put(
        'anthropic_paused',
        `pending-chunk ${err.status}: ${JSON.stringify(err.body).slice(0, 150)}`,
        { expirationTtl: 15 * 60 },
      );
      console.warn('[pending-cron] anthropic_paused SET por 15 min');
    }

    // Cargo conservador de tokens estimados aunque no completó (evita subestimar).
    const estimatedInputTokens = Math.min(
      Math.round(JSON.stringify(state.turns).length / 4),
      100000,
    );
    await trackSessionBudget(kv, pending.sessionId, estimatedInputTokens);

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

  // Kill switch global (post-mortem 8 sept): si el flag anthropic_paused
  // existe, no procesamos nada. Evita que el cron dispare requests que
  // sabemos van a fallar y gastar tokens.
  const pauseReason = await kv.get('anthropic_paused');
  if (pauseReason) {
    return jsonResponse({
      ok: true,
      processed: 0,
      paused: true,
      reason: pauseReason.slice(0, 200),
      note: 'Anthropic paused. Waiting for TTL to expire (15 min) or manual clear.',
    });
  }

  // Limit=1 · procesamos 1 pending por corrida (cada uno tarda hasta 25s).
  const list = await kv.list({ prefix: 'pending:', limit: 1 });
  if (list.keys.length === 0) {
    return jsonResponse({ ok: true, processed: 0, message: 'no pending sessions' });
  }

  // FIX 7 sept 2026: procesamiento SÍNCRONO await (antes fire-and-forget).
  // Post-mortem: ctx.waitUntil() en Cloudflare Workers con Astro adapter NO
  // ejecuta la promise después de responder 200 — el isolate muere. Todos los
  // pendings quedaban en attempts=0, chunks=0. Ahora esperamos el chunk (~15-25s)
  // dentro del handler; el cron externo tolera 30s, así que cabe.
  const enqueued: Array<{ sessionId: string; status: string }> = [];

  for (const k of list.keys) {
    const raw = await kv.get(k.name);
    if (!raw) continue;
    let pending: PendingRecord;
    try {
      pending = JSON.parse(raw) as PendingRecord;
    } catch {
      continue;
    }
    // Safety: pending.attempts puede venir undefined si el pending es viejo.
    pending.attempts = pending.attempts ?? 0;

    // CIRCUIT BREAKER PRE-CHUNK (7 sept 2026): antes de gastar UN SOLO token,
    // verificamos si este pending ya superó MAX_ATTEMPTS. Si sí, lo eliminamos
    // sin invocar Anthropic. Esto evita el sangrado del incidente del 7 sept
    // donde un pending con chunks fallando podía consumir tokens indefinidamente.
    if (pending.attempts >= MAX_ATTEMPTS) {
      console.warn(`[pending-cron] SKIP + DELETE pending ${pending.sessionId} (attempts=${pending.attempts} >= ${MAX_ATTEMPTS})`);
      await kv.delete(k.name);
      // Marcar la sesión como permanently_failed para que el frontend deje de reintentar
      let stateUserEmail: string | undefined;
      let stateRole: string | undefined;
      try {
        const rawState = await kv.get(`session:${pending.sessionId}`);
        if (rawState) {
          const state = JSON.parse(rawState) as SessionState;
          state.finalReportStatus = 'failed';
          state.finalReportError = `Cortado por circuit breaker: ${pending.attempts} intentos sin éxito.`;
          await kv.put(`session:${pending.sessionId}`, JSON.stringify(state), {
            expirationTtl: 60 * 60 * 24 * 90,
          });
          stateUserEmail = state.userEmail;
          stateRole = state.profile.roleTitle ?? state.profile.role;
        }
      } catch (err) {
        console.error('[pending-cron] failed to mark state as permanently_failed:', err);
      }
      // Email de alerta a Solca cuando el circuit breaker se activa
      const postmarkToken = env.POSTMARK_SERVER_TOKEN as string | undefined;
      if (postmarkToken) {
        try {
          await sendEmail(postmarkToken, {
            from: 'hello@solcaciencia.com',
            to: 'hello@solcaciencia.com',
            subject: `[Simulador CIRCUIT BREAKER] Sesión ${pending.sessionId.slice(0, 8)} cortada tras ${pending.attempts} intentos`,
            textBody: [
              `El circuit breaker cortó una sesión del simulador porque ya no pudo generarse el reporte en ${pending.attempts} intentos.`,
              ``,
              `sessionId: ${pending.sessionId}`,
              `rol: ${stateRole ?? 'desconocido'}`,
              `usuario email: ${stateUserEmail ?? 'desconocido'}`,
              `último error: ${pending.errorMessage}`,
              ``,
              `Recuperar manualmente:`,
              `  node scripts/simulator-recover-report.mjs ${pending.sessionId}`,
              ``,
              `Si este es un fallo recurrente (varios en un día), investiga bug estructural antes de recuperar caso por caso.`,
            ].join('\n'),
            tag: 'simulator-circuit-breaker',
            metadata: { sessionId: pending.sessionId, attempts: String(pending.attempts) },
          });
        } catch {
          /* ignore email failure */
        }
      }
      enqueued.push({ sessionId: pending.sessionId, status: 'skipped_max_attempts_notified' });
      continue;
    }

    // Await SÍNCRONO — 1 chunk por pending por corrida. Rompe si excede
    // el subrequest timeout, pero el chunk está diseñado para <25s.
    const r = await processOneChunk(env, k.name, pending);
    enqueued.push({ sessionId: pending.sessionId, status: r.status });
  }

  return jsonResponse({
    ok: true,
    enqueued: enqueued.length,
    results: enqueued,
    note: 'Chunking · each cron run processes 1 chunk per pending. Check KV for state.finalReportStatus.',
  });
};

export const POST = GET;
