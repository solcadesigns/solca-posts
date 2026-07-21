/**
 * Endpoint principal del Simulador de Entrevistas.
 * Fase 1.1 · v0.5 del system prompt · 16 jun 2026.
 *
 * Tres acciones:
 *  - "init":  arranca sesión nueva con perfil (+ cvSummary opcional para planes pagos)
 *  - "next":  procesa respuesta del candidato y devuelve siguiente pregunta o reporte final
 *  - "finish": fuerza cierre anticipado
 *
 * Beta cerrada: si llega `betaCode`, lo valida contra SIMULATOR_BETA_CODES.
 *
 * Modelo: claude-sonnet-4-5-20251001 (decisión 16 jun 2026).
 * Non-streaming en MVP. Streaming en v2 si la beta valida el producto.
 */

import type { APIRoute } from 'astro';
import { retryableChatCompletion, extractText, AnthropicError } from '../../lib/anthropic';
import { buildSystemPrompt } from '../../lib/simulator-prompt';
import { inferRole, getStageInfo } from '../../lib/simulator-defaults';
import { parseFinalOutput } from '../../lib/simulator-metrics-parser';
import { writeMetricsToD1 } from '../../lib/simulator-metrics-writer';
import type {
  CandidateProfile,
  CvSummary,
  Plan,
  QuestionTurn,
  QuestionType,
  SessionEndpointRequest,
  SessionEndpointResponse,
  SessionState,
} from '../../lib/simulator-types';

export const prerender = false;

const MODEL = 'claude-sonnet-4-6';
const TEMPERATURE = 0.5; // ligeramente más alto que cv-review para variabilidad de feedback
const MAX_TOKENS_PER_TURN = 2000;
// Fase 1.4.G.4 · 19 jun 2026 · max_tokens del reporte final escala con
// numero de preguntas para evitar truncamiento. Cada question_breakdown
// pesa ~500-600 tokens; summary + cta + metrics_anonymous suman ~2500.
// Cap a 16000 para mantenerse dentro del límite de Sonnet 4.6.
const FINAL_REPORT_BASE_TOKENS = 3000;
const FINAL_REPORT_TOKENS_PER_QUESTION = 600;
const FINAL_REPORT_TOKENS_CAP = 16000;
function finalReportMaxTokens(questionCount: number): number {
  const computed = FINAL_REPORT_BASE_TOKENS + questionCount * FINAL_REPORT_TOKENS_PER_QUESTION;
  return Math.min(computed, FINAL_REPORT_TOKENS_CAP);
}

interface BetaCodeRecord {
  nombre_pila?: string;
  email_hash?: string;
  max_sessions: number;
  sessions_used: number;
  granted_at: string;
  expires_at: string;
  cohort?: string;
}

function jsonResponse(data: SessionEndpointResponse, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function uuid(): string {
  // Cloudflare Workers no tiene crypto.randomUUID() en todas las versiones; fallback.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as { randomUUID(): string }).randomUUID();
  }
  return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ──────────────────────────────────────────────────────────────────
// Validación de código beta (si está presente)
// ──────────────────────────────────────────────────────────────────

async function validateBetaCode(
  kv: KVNamespace | undefined,
  code: string,
): Promise<{ ok: boolean; reason?: string; record?: BetaCodeRecord }> {
  if (!kv) {
    // Sin KV configurado en desarrollo → permitir
    return { ok: true };
  }
  const raw = await kv.get(`beta:${code}`);
  if (!raw) return { ok: false, reason: 'invalid' };

  let record: BetaCodeRecord;
  try {
    record = JSON.parse(raw) as BetaCodeRecord;
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (record.sessions_used >= record.max_sessions) {
    return { ok: false, reason: 'exhausted', record };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired', record };
  }

  return { ok: true, record };
}

async function incrementBetaCodeUsage(
  kv: KVNamespace | undefined,
  code: string,
): Promise<void> {
  if (!kv) return;
  const raw = await kv.get(`beta:${code}`);
  if (!raw) return;
  try {
    const record = JSON.parse(raw) as BetaCodeRecord;
    record.sessions_used += 1;
    await kv.put(`beta:${code}`, JSON.stringify(record));
  } catch (err) {
    console.error('Failed to increment beta code usage:', err);
  }
}

// ──────────────────────────────────────────────────────────────────
// Helpers para construir mensajes
// ──────────────────────────────────────────────────────────────────

/**
 * Convierte el historial de turns a la lista de mensajes Anthropic.
 * El primer mensaje del usuario contiene el perfil + el saludo inicial automático.
 */
function buildMessagesFromState(state: SessionState): {
  role: 'user' | 'assistant';
  content: string;
}[] {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  // Mensaje inicial del candidato (en realidad es system + saludo)
  messages.push({
    role: 'user',
    content:
      'Empezamos la sesión. Aplica las reglas del system prompt: saluda brevemente y presenta la primera pregunta.',
  });

  for (const turn of state.turns) {
    if (turn.feedback || turn.questionText) {
      // Pregunta + (si hay) feedback que Claude generó previamente
      const assistantContent = turn.feedback
        ? renderTurnForHistory(turn)
        : turn.questionText;
      messages.push({ role: 'assistant', content: assistantContent });
    }
    if (turn.userAnswer) {
      // Respuesta del candidato
      const answerWithTiming = turn.userAnswerSeconds
        ? `${turn.userAnswer}\n\n(Tiempo de respuesta: ${turn.userAnswerSeconds} segundos)`
        : turn.userAnswer;
      messages.push({ role: 'user', content: answerWithTiming });
    }
  }

  return messages;
}

function renderTurnForHistory(turn: QuestionTurn): string {
  const fb = turn.feedback;
  if (!fb) return turn.questionText;
  return `Pregunta ${turn.questionNumber}: ${turn.questionText}\n\n[Feedback dado en su momento — para tu memoria de la sesión]\nScores: técnico ${fb.scores.tecnico}, estructura ${fb.scores.estructura}, especificidad ${fb.scores.especificidad}\nÁngulo usado: ${fb.angle}`;
}

// ──────────────────────────────────────────────────────────────────
// Acción 'init' · arranca sesión nueva
// ──────────────────────────────────────────────────────────────────

async function handleInit(
  body: SessionEndpointRequest,
  env: Record<string, unknown>,
): Promise<SessionEndpointResponse> {
  const apiKey = env.ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) {
    return {
      ok: false,
      error: 'ANTHROPIC_API_KEY no configurada',
      errorCode: 'internal',
    };
  }

  if (!body.profile) {
    return { ok: false, error: 'Falta profile', errorCode: 'invalid_profile' };
  }

  // Validar beta code si vino
  if (body.betaCode) {
    const betaKv = env.SIMULATOR_BETA_CODES as KVNamespace | undefined;
    const check = await validateBetaCode(betaKv, body.betaCode);
    if (!check.ok) {
      return {
        ok: false,
        error: `Código beta ${check.reason}`,
        errorCode: check.reason === 'exhausted' ? 'beta_code_exhausted' : 'beta_code_invalid',
      };
    }
  }

  // v0.6: si el frontend mandó interviewStage, derivamos questionCount de la etapa.
  // Si solo mandó questionCount (compatibilidad con tests viejos), mantiene ese valor.
  const profile: CandidateProfile = {
    ...body.profile,
    role: body.profile.role ?? inferRole(body.profile.roleTitle),
  };
  if (profile.interviewStage) {
    profile.questionCount = getStageInfo(profile.interviewStage).questionCount;
  }

  const plan = body.plan ?? 'gratis';
  const sessionNumberInPackage = body.sessionNumberInPackage ?? 1;
  const cvSummary = plan !== 'gratis' ? body.cvSummary : undefined;

  const systemPrompt = buildSystemPrompt({
    profile,
    plan,
    sessionNumberInPackage,
    cvSummary,
  });

  const state: SessionState = {
    sessionId: uuid(),
    startedAt: new Date().toISOString(),
    profile,
    plan,
    sessionNumberInPackage,
    cvSummary,
    turns: [],
    finished: false,
  };

  const messages = buildMessagesFromState(state);

  let response;
  try {
    response = await retryableChatCompletion(
      {
        apiKey,
        model: MODEL,
        system: systemPrompt,
        messages,
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS_PER_TURN,
      },
      'init',
    );
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error('Anthropic error in init:', err.status, err.body);
      return {
        ok: false,
        error: `Anthropic API error ${err.status}`,
        errorCode: 'anthropic_error',
      };
    }
    throw err;
  }

  const assistantText = extractText(response);

  // El primer mensaje del assistant incluye saludo + (si CV) validación del resumen + pregunta 1.
  // Para el frontend, esta primera respuesta se trata como un "intro turn" + pregunta 1.
  // Detección heurística: la pregunta 1 está en el último bloque después del saludo.
  // Por simplicidad, guardamos todo el texto como el contenido del primer turno y dejamos
  // que el frontend muestre el bloque completo y permita responder.

  const firstTurn: QuestionTurn = {
    questionNumber: 1,
    type: 'general', // primera pregunta típicamente es general
    language: profile.language === 'ingles' ? 'en' : 'es',
    questionText: assistantText,
    suggestedPrepSeconds: 30,
    suggestedAnswerSeconds: 90,
  };

  state.turns.push(firstTurn);
  // Guardamos el betaCode en el state para que retry_report pueda re-validar o
  // simplemente registrar de qué beta vino · no se mostraría al usuario.
  if (body.betaCode) state.betaCode = body.betaCode;

  // Si la beta code se validó, incrementamos el uso
  if (body.betaCode) {
    await incrementBetaCodeUsage(
      env.SIMULATOR_BETA_CODES as KVNamespace | undefined,
      body.betaCode,
    );
  }

  // Fase 1.5.J · persistir state inicial para recovery
  await persistSessionState(env, state);

  return {
    ok: true,
    sessionState: state,
    nextQuestion: firstTurn,
  };
}

// ──────────────────────────────────────────────────────────────────
// Acción 'next' · procesa respuesta y devuelve siguiente pregunta o reporte
// ──────────────────────────────────────────────────────────────────

async function handleNext(
  body: SessionEndpointRequest,
  env: Record<string, unknown>,
): Promise<SessionEndpointResponse> {
  const apiKey = env.ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) {
    return {
      ok: false,
      error: 'ANTHROPIC_API_KEY no configurada',
      errorCode: 'internal',
    };
  }

  if (!body.sessionState || !body.userAnswer) {
    return {
      ok: false,
      error: 'Falta sessionState o userAnswer',
      errorCode: 'invalid_action',
    };
  }

  const state: SessionState = body.sessionState;
  const { profile, plan, sessionNumberInPackage, cvSummary } = state;

  // Agregar la respuesta del candidato al último turn
  const lastTurn = state.turns[state.turns.length - 1];
  if (lastTurn && !lastTurn.userAnswer) {
    lastTurn.userAnswer = body.userAnswer;
    lastTurn.userAnswerSeconds = body.userAnswerSeconds;
  }

  // Fase 1.5.J · persistir state con la respuesta ANTES de llamar a Claude.
  // Si Claude falla, el state guardado tiene la respuesta del usuario y se
  // puede recuperar via 'resume' o reintentar reporte via 'retry_report'.
  await persistSessionState(env, state);

  const isLastQuestion = state.turns.length >= profile.questionCount;

  const systemPrompt = buildSystemPrompt({
    profile,
    plan,
    sessionNumberInPackage,
    cvSummary,
  });

  const messages = buildMessagesFromState(state);

  if (isLastQuestion) {
    // v0.7: feedback diferido. Pedir el reporte final expandido con summary + questions_breakdown.
    messages.push({
      role: 'user',
      content:
        'Esa fue la última respuesta del candidato. Ahora devuelve los DOS bloques JSON del reporte final según el formato v0.7 especificado en el system prompt: primero el reporte expandido con summary + questions_breakdown + cta, después el JSON de métricas anónimas. NO devuelvas feedback por turnos — todo va consolidado en el reporte.',
    });
  } else {
    // v0.7: sin feedback explícito. Solo transición breve + siguiente pregunta.
    messages.push({
      role: 'user',
      content:
        'Continúa con la siguiente pregunta. NO des feedback explícito sobre la respuesta anterior (eso va consolidado al final). Puedes hacer una transición breve de una línea si quieres ("Entendido", "Pasamos a la siguiente"), o ir directo a la pregunta. Recuerda que el adaptive de contenido (Mecanismo 2) sigue activo: si detectaste gap o fortaleza, la siguiente pregunta puede explorarlo.',
    });
  }

  const effectiveMaxTokens = isLastQuestion
    ? finalReportMaxTokens(profile.questionCount)
    : MAX_TOKENS_PER_TURN;

  let response;
  try {
    response = await retryableChatCompletion(
      {
        apiKey,
        model: MODEL,
        system: systemPrompt,
        messages,
        temperature: TEMPERATURE,
        maxTokens: effectiveMaxTokens,
      },
      isLastQuestion ? 'next-final-report' : 'next-question',
    );
  } catch (err) {
    // Si fue en el último turn (reporte final), marcar el state para que
    // el frontend pueda ofrecer 'retry_report' sin re-hacer preguntas.
    if (isLastQuestion) {
      state.finalReportError = err instanceof Error ? err.message : 'unknown';
      await persistSessionState(env, state);
    }
    if (err instanceof AnthropicError) {
      console.error('Anthropic error in next:', err.status, err.body);
      return {
        ok: false,
        error: `Anthropic API error ${err.status}`,
        errorCode: 'anthropic_error',
        sessionState: state, // devolver state para que frontend tenga sessionId
      };
    }
    throw err;
  }

  const assistantText = extractText(response);

  // Detectar truncamiento por max_tokens (Fase 1.4.G.4)
  if (response.stop_reason === 'max_tokens') {
    console.warn(
      '[simulator-session] Claude hit max_tokens cap',
      JSON.stringify({
        isLastQuestion,
        maxTokensUsed: effectiveMaxTokens,
        outputTokens: response.usage.output_tokens,
        questionCount: profile.questionCount,
        textPrefix: assistantText.slice(0, 200),
        textSuffix: assistantText.slice(-200),
      }),
    );
  }

  if (isLastQuestion) {
    state.finished = true;

    // v0.7 + Fase 1.4.1: parsing server-side completo del output de Claude.
    const parsed = parseFinalOutput(assistantText);

    // Timings reales server-side (más confiables que los que reporte Claude)
    const startedAtMs = new Date(state.startedAt).getTime();
    const sesionDuracionTotalSeg = Math.max(0, Math.round((Date.now() - startedAtMs) / 1000));
    const respuestaTimings = state.turns
      .map((t) => t.userAnswerSeconds)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const respuestaPromedioSeg =
      respuestaTimings.length > 0
        ? Math.round(respuestaTimings.reduce((a, b) => a + b, 0) / respuestaTimings.length)
        : 0;

    // Sobrescribir timings en métricas con los reales (si el parsing tuvo éxito)
    if (parsed.metricsAnonymous) {
      parsed.metricsAnonymous.sesionDuracionTotalSeg = sesionDuracionTotalSeg;
      parsed.metricsAnonymous.respuestaPromedioSeg = respuestaPromedioSeg;
      parsed.metricsAnonymous.ts = state.startedAt;
    }

    // Guardar en D1 (best-effort · no bloqueamos al usuario si falla)
    if (parsed.metricsAnonymous) {
      try {
        const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
        if (db) {
          await writeMetricsToD1(db, {
            sessionId: state.sessionId,
            metrics: parsed.metricsAnonymous,
            hasCvSummary: Boolean(cvSummary),
          });
        }
      } catch (writeErr) {
        console.error('Failed to write session metrics to D1:', writeErr);
      }
    }

    // Asegurar sessionId en el reporte
    const finalReport = parsed.finalReport ?? {
      sessionId: state.sessionId,
      rol: profile.roleTitle ?? 'No especificado',
      nQuestions: profile.questionCount,
      summary: {
        scores: { tecnico: 0, estructura: 0, especificidad: 0, alertasCount: 0 },
        fortalezas: [],
        areasDeMejora: [],
        vocabularioAIncorporar: [],
        recomendacionFinal: assistantText,
      },
      questionsBreakdown: [],
      cta: {
        type: 'recurso_gratuito' as const,
        title: 'Reporte sin parsear',
        description: 'No se pudo parsear el JSON del reporte. Texto crudo abajo:\n\n' + assistantText,
        url: '/revisar-cv',
      },
    };

    if (!finalReport.sessionId) {
      finalReport.sessionId = state.sessionId;
    }

    // Fase 1.5.J · persistir state completo con el reporte
    state.finalReport = finalReport;
    state.metricsAnonymous = parsed.metricsAnonymous ?? undefined;
    delete state.finalReportError;
    await persistSessionState(env, state);

    return {
      ok: true,
      sessionState: state,
      finished: true,
      finalReport,
    };
  }

  // Pregunta siguiente
  const nextQuestionNumber = state.turns.length + 1;
  const nextTurn: QuestionTurn = {
    questionNumber: nextQuestionNumber,
    type: 'general', // Fase 1.2 mejorará detección
    language:
      profile.language === 'ingles'
        ? 'en'
        : profile.language === 'bilingue' && nextQuestionNumber > profile.questionCount / 2
          ? 'en'
          : 'es',
    questionText: assistantText,
    suggestedPrepSeconds: 30,
    suggestedAnswerSeconds: 90,
  };

  state.turns.push(nextTurn);

  return {
    ok: true,
    sessionState: state,
    nextQuestion: nextTurn,
  };
}

// ──────────────────────────────────────────────────────────────────
// Acción 'finish' · cierre anticipado
// ──────────────────────────────────────────────────────────────────

async function handleFinish(
  body: SessionEndpointRequest,
): Promise<SessionEndpointResponse> {
  if (!body.sessionState) {
    return { ok: false, error: 'Falta sessionState', errorCode: 'invalid_action' };
  }
  const state = body.sessionState;
  state.finished = true;
  return { ok: true, sessionState: state, finished: true };
}

// ──────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────
// Persistencia del sessionState en KV (Fase 1.5.J · 19 jun 2026)
// ──────────────────────────────────────────────────────────────────
//
// Razón: el state vive en memoria del frontend. Si el browser muere, si el
// worker falla generando el reporte final, si el usuario recarga, todo se
// pierde. Para usuarios pagados eso es inaceptable. Persistimos el state
// completo en KV después de cada turn y exponemos:
//   - action='resume' : recupera el state por sessionId
//   - action='retry_report' : re-genera el reporte final desde el state guardado
//                              (sin re-hacer preguntas)
//
// Clave: session:<session_id>. TTL 90 días (igual que el spec de §4.2 del addendum).
// Tamaño: cada state pesa ~10-50KB según questionCount; KV soporta values hasta 25MB.

const SESSION_KV_TTL_SECONDS = 90 * 24 * 3600;

async function persistSessionState(
  env: Record<string, unknown>,
  state: SessionState,
): Promise<void> {
  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (!kv) {
    console.warn('[simulator-session] SIMULATOR_SESSIONS KV no enlazado · persistencia OFF');
    return;
  }
  try {
    await kv.put(`session:${state.sessionId}`, JSON.stringify(state), {
      expirationTtl: SESSION_KV_TTL_SECONDS,
    });
  } catch (err) {
    // Best-effort · no bloqueamos al usuario si falla la persistencia
    console.error('[simulator-session] persist failed for', state.sessionId, err);
  }
}

async function loadSessionState(
  env: Record<string, unknown>,
  sessionId: string,
): Promise<SessionState | null> {
  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (!kv) return null;
  try {
    const raw = await kv.get(`session:${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch (err) {
    console.error('[simulator-session] load failed for', sessionId, err);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────
// Acción 'resume' · recupera state persistido (Fase 1.5.J)
// ──────────────────────────────────────────────────────────────────

async function handleResume(
  body: SessionEndpointRequest,
  env: Record<string, unknown>,
): Promise<SessionEndpointResponse> {
  if (!body.sessionId) {
    return { ok: false, error: 'Missing sessionId for resume', errorCode: 'invalid_action' };
  }
  const state = await loadSessionState(env, body.sessionId);
  if (!state) {
    return { ok: false, error: 'Session not found (puede haber expirado tras 90 días)', errorCode: 'invalid_action' };
  }
  return {
    ok: true,
    sessionState: state,
    finished: state.finished,
    finalReport: state.finalReport,
  };
}

// ──────────────────────────────────────────────────────────────────
// Acción 'retry_report' · re-genera reporte final desde state persistido (Fase 1.5.J)
// ──────────────────────────────────────────────────────────────────

async function handleRetryReport(
  body: SessionEndpointRequest,
  env: Record<string, unknown>,
): Promise<SessionEndpointResponse> {
  const apiKey = env.ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY no configurada', errorCode: 'internal' };
  }
  if (!body.sessionId) {
    return { ok: false, error: 'Missing sessionId for retry_report', errorCode: 'invalid_action' };
  }

  const state = await loadSessionState(env, body.sessionId);
  if (!state) {
    return { ok: false, error: 'Session not found (puede haber expirado tras 90 días)', errorCode: 'invalid_action' };
  }

  // Verificar que todas las preguntas tienen respuesta antes de pedir el reporte
  const allAnswered = state.turns.length === state.profile.questionCount
    && state.turns.every((t) => t.userAnswer && t.userAnswer.length > 0);
  if (!allAnswered) {
    return {
      ok: false,
      error: 'La sesión no está completa · faltan respuestas. No se puede generar reporte.',
      errorCode: 'invalid_action',
    };
  }

  const systemPrompt = buildSystemPrompt({
    profile: state.profile,
    plan: state.plan,
    sessionNumberInPackage: state.sessionNumberInPackage,
    cvSummary: state.cvSummary,
  });
  const messages = buildMessagesFromState(state);
  messages.push({
    role: 'user',
    content:
      'Esa fue la última respuesta del candidato. Ahora devuelve los DOS bloques JSON del reporte final según el formato v0.7 especificado en el system prompt: primero el reporte expandido con summary + questions_breakdown + cta, después el JSON de métricas anónimas. NO devuelvas feedback por turnos — todo va consolidado en el reporte.',
  });

  let response;
  try {
    response = await retryableChatCompletion(
      {
        apiKey,
        model: MODEL,
        system: systemPrompt,
        messages,
        temperature: TEMPERATURE,
        maxTokens: finalReportMaxTokens(state.profile.questionCount),
      },
      'retry_report',
    );
  } catch (err) {
    // Marca el state como failed para que el frontend pueda mostrar otro reintento
    state.finalReportError = err instanceof Error ? err.message : 'unknown error';
    await persistSessionState(env, state);
    if (err instanceof AnthropicError) {
      return { ok: false, error: `Anthropic API error ${err.status}`, errorCode: 'anthropic_error' };
    }
    throw err;
  }

  const assistantText = extractText(response);
  if (response.stop_reason === 'max_tokens') {
    console.warn('[retry_report] Claude hit max_tokens cap on retry', {
      sessionId: state.sessionId,
      questionCount: state.profile.questionCount,
    });
  }

  const parsed = parseFinalOutput(assistantText);

  if (parsed.metricsAnonymous) {
    // Re-calcular timings reales basados en state persistido
    const startedAtMs = new Date(state.startedAt).getTime();
    const respuestaTimings = state.turns
      .map((t) => t.userAnswerSeconds)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    parsed.metricsAnonymous.sesionDuracionTotalSeg = Math.max(0, Math.round((Date.now() - startedAtMs) / 1000));
    parsed.metricsAnonymous.respuestaPromedioSeg =
      respuestaTimings.length > 0
        ? Math.round(respuestaTimings.reduce((a, b) => a + b, 0) / respuestaTimings.length)
        : 0;
    parsed.metricsAnonymous.ts = state.startedAt;

    try {
      const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
      if (db) {
        await writeMetricsToD1(db, {
          sessionId: state.sessionId,
          metrics: parsed.metricsAnonymous,
          hasCvSummary: Boolean(state.cvSummary),
        });
      }
    } catch (writeErr) {
      console.error('[retry_report] D1 write failed:', writeErr);
    }
  }

  const finalReport = parsed.finalReport ?? {
    sessionId: state.sessionId,
    rol: state.profile.roleTitle ?? 'No especificado',
    nQuestions: state.profile.questionCount,
    summary: {
      scores: { tecnico: 0, estructura: 0, especificidad: 0, alertasCount: 0 },
      fortalezas: [],
      areasDeMejora: [],
      vocabularioAIncorporar: [],
      recomendacionFinal: assistantText,
    },
    questionsBreakdown: [],
    cta: {
      type: 'recurso_gratuito' as const,
      title: 'Reporte sin parsear',
      description: 'No se pudo parsear el JSON del reporte. Texto crudo abajo:\n\n' + assistantText,
      url: '/revisar-cv',
    },
  };
  if (!finalReport.sessionId) finalReport.sessionId = state.sessionId;

  state.finished = true;
  state.finalReport = finalReport;
  state.metricsAnonymous = parsed.metricsAnonymous ?? undefined;
  delete state.finalReportError;
  await persistSessionState(env, state);

  return {
    ok: true,
    sessionState: state,
    finished: true,
    finalReport,
  };
}

// ──────────────────────────────────────────────────────────────────
// POST handler
// ──────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};

  let body: SessionEndpointRequest;
  try {
    body = (await request.json()) as SessionEndpointRequest;
  } catch {
    return jsonResponse(
      { ok: false, error: 'Invalid JSON body', errorCode: 'invalid_action' },
      400,
    );
  }

  try {
    switch (body.action) {
      case 'init':
        return jsonResponse(await handleInit(body, env));
      case 'next':
        return jsonResponse(await handleNext(body, env));
      case 'finish':
        return jsonResponse(await handleFinish(body));
      case 'resume':
        return jsonResponse(await handleResume(body, env));
      case 'retry_report':
        return jsonResponse(await handleRetryReport(body, env));
      default:
        return jsonResponse(
          { ok: false, error: 'Unknown action', errorCode: 'invalid_action' },
          400,
        );
    }
  } catch (err) {
    console.error('simulator-session error:', err);
    return jsonResponse(
      { ok: false, error: 'Internal server error', errorCode: 'internal' },
      500,
    );
  }
};
