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
import {
  retryableChatCompletion,
  retryableChatCompletionStream,
  extractText,
  AnthropicError,
} from '../../lib/anthropic';
import { buildSystemPrompt } from '../../lib/simulator-prompt';
import { inferRole, getStageInfo } from '../../lib/simulator-defaults';
import { parseFinalOutput } from '../../lib/simulator-metrics-parser';
import { writeMetricsToD1, writeSessionInitialToD1 } from '../../lib/simulator-metrics-writer';
import { sendEmail, PostmarkError } from '../../lib/postmark';
import type {
  CandidateProfile,
  CreditsRecord,
  CvSummary,
  Plan,
  QuestionTurn,
  QuestionType,
  SessionEndpointRequest,
  SessionEndpointResponse,
  SessionState,
} from '../../lib/simulator-types';
import { PLAN_CONFIG, applyPlanGating } from '../../lib/simulator-types';

/** Hash SHA-256 del email lowercased trimmed, primeros 16 hex chars. */
async function hashEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * Decrementa remaining en SIMULATOR_CREDITS. Se llama al persistir el reporte
 * final exitoso (misma regla que betaCode: solo cuenta si el usuario completó).
 * Idempotente: si el record no existe o remaining ya está en 0, no hace nada.
 */
async function decrementCredits(
  env: Record<string, unknown>,
  emailHashValue: string,
): Promise<void> {
  const kv = env.SIMULATOR_CREDITS as KVNamespace | undefined;
  if (!kv) return;
  try {
    const raw = await kv.get(`credits:${emailHashValue}`);
    if (!raw) return;
    const record = JSON.parse(raw) as CreditsRecord;
    if (record.remaining <= 0) return;
    record.remaining -= 1;
    await kv.put(`credits:${emailHashValue}`, JSON.stringify(record), {
      expirationTtl: Math.max(
        60 * 60 * 24, // mínimo 1 día
        Math.floor((new Date(record.expiresAt).getTime() - Date.now()) / 1000),
      ),
    });
  } catch (err) {
    console.error('[simulator-session] decrementCredits failed for', emailHashValue, err);
  }
}

export const prerender = false;

const MODEL = 'claude-sonnet-4-6';
const TEMPERATURE = 0.5; // ligeramente más alto que cv-review para variabilidad de feedback
const MAX_TOKENS_PER_TURN = 2000;
// Fase 1.4.G.4 · 19 jun 2026 · max_tokens del reporte final escala con
// numero de preguntas para evitar truncamiento. Cada question_breakdown
// pesa ~500-600 tokens; summary + cta + metrics_anonymous suman ~2500.
// Cap a 16000 para mantenerse dentro del límite de Sonnet 4.6.
const FINAL_REPORT_BASE_TOKENS = 3000;
// Bajado de 600 a 400 el 2 sept 2026 tras 524 timeout en sesión 27d9355c (10 preguntas
// pedían 9000 tokens de output → generación >100s → Cloudflare cortaba). Con 400 tokens
// por pregunta, 10q pide 7000 y suele completar en ~70s. Warning stop_reason=max_tokens
// sigue activo para detectar truncamiento si el modelo insiste en más.
const FINAL_REPORT_TOKENS_PER_QUESTION = 400;
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

  // Validar beta code si vino (legacy pre-paywall)
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
  const profile: CandidateProfile = {
    ...body.profile,
    role: body.profile.role ?? inferRole(body.profile.roleTitle),
  };
  if (profile.interviewStage) {
    profile.questionCount = getStageInfo(profile.interviewStage).questionCount;
  }

  // ── Paywall (2 sept 2026): lookup de créditos por email si no vino betaCode ──
  // Si el body trae `email`, buscamos su record en SIMULATOR_CREDITS. Escenarios:
  //   - No existe → asignamos plan='gratis' con 1 crédito (freemium automático).
  //   - Existe expirado → error credits_expired (usuario debe recomprar).
  //   - Existe con remaining=0 → error credits_exhausted (usuario debe recomprar).
  //   - Existe válido → usamos record.plan (ignora el plan del body, la KV es la fuente de verdad).
  // Si el body NO trae email pero sí betaCode, usamos el flujo legacy (plan=gratis por default).
  let plan: Plan = body.plan ?? 'gratis';
  let creditsRecord: CreditsRecord | null = null;
  const email = body.email?.trim().toLowerCase();
  if (email) {
    const creditsKv = env.SIMULATOR_CREDITS as KVNamespace | undefined;
    if (creditsKv) {
      const hash = await hashEmail(email);
      const existingRaw = await creditsKv.get(`credits:${hash}`);
      if (existingRaw) {
        try {
          creditsRecord = JSON.parse(existingRaw) as CreditsRecord;
        } catch {
          creditsRecord = null;
        }
      }
      if (creditsRecord) {
        // Verificar expiración
        if (new Date(creditsRecord.expiresAt).getTime() < Date.now()) {
          return {
            ok: false,
            error:
              'Tus créditos del simulador expiraron. Compra un paquete nuevo desde solcaciencia.com/simulador-entrevistas/.',
            errorCode: 'credits_expired',
            planUsed: creditsRecord.plan,
          };
        }
        // Verificar remaining
        if (creditsRecord.remaining <= 0) {
          return {
            ok: false,
            error:
              'Ya usaste todas las sesiones incluidas en tu paquete. Compra otro desde solcaciencia.com/simulador-entrevistas/.',
            errorCode: 'credits_exhausted',
            planUsed: creditsRecord.plan,
          };
        }
        plan = creditsRecord.plan;
      } else {
        // Primer uso · asignar freemium automático.
        const now = new Date();
        const expiresAt = new Date(now.getTime() + PLAN_CONFIG.gratis.vigenciaDias * 24 * 60 * 60 * 1000);
        creditsRecord = {
          plan: 'gratis',
          remaining: PLAN_CONFIG.gratis.sessionsIncluded,
          purchasedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          history: [
            {
              at: now.toISOString(),
              plan: 'gratis',
              sessionsAdded: PLAN_CONFIG.gratis.sessionsIncluded,
              stripeSessionId: 'freemium-auto',
            },
          ],
        };
        await creditsKv.put(`credits:${hash}`, JSON.stringify(creditsRecord), {
          expirationTtl: 60 * 60 * 24 * PLAN_CONFIG.gratis.vigenciaDias,
        });
        plan = 'gratis';
      }
    }
  }

  const sessionNumberInPackage = body.sessionNumberInPackage ?? 1;
  const planConfig = PLAN_CONFIG[plan];

  // Gating por plan · 2 sept 2026 (post-feedback beta):
  // - Freemium: fuerza phone_screen, moderado, sin descripción/empresa de vacante.
  // - Básico/Premium: valida stages/dificultades permitidas.
  // Ver _docs/PAYWALL_SIMULADOR.md para el schema completo.
  Object.assign(profile, applyPlanGating(profile, plan));

  // Si por gating cambió la etapa, recalcula questionCount desde la nueva etapa.
  if (profile.interviewStage) {
    profile.questionCount = getStageInfo(profile.interviewStage).questionCount;
  }

  // CV: freemium SÍ acepta CV (regla post-beta), pero se respeta allowsCv del config
  // por si un plan futuro lo restringe.
  const cvSummary = planConfig.allowsCv ? body.cvSummary : undefined;

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
    betaCode: body.betaCode,
    // Paywall: persistimos el hash del email para decrementar credits al completar
    // sesión. Solo el hash (16 hex chars) — no el email plano — para no exponer PII.
    emailHash: email ? await hashEmail(email) : undefined,
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

  // NOTA (19 ago 2026): NO incrementamos sessions_used aquí.
  // Regla del pre-paywall: el contador se toca solo cuando el reporte final se
  // genera con éxito (ver handleNext y handleRetryReport). Si el usuario abre
  // el simulador y abandona a mitad, o si el LLM falla, el código queda vivo
  // para reintentar. Esto evita "quemar" la sesión libre por accidente y
  // sostiene la promesa pública: la sesión cuenta cuando entregamos el reporte.

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

  // F1 (2026-08-18) · si esta es la última respuesta, registrar la sesión en D1
  // ANTES de pedirle el reporte a Claude. Así, aunque Claude falle o el parsing
  // reviente, la sesión queda contada y el usuario puede enviar feedback beta
  // (endpoint /api/simulator-beta-feedback valida FK contra sessions).
  if (isLastQuestion) {
    try {
      const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
      if (db) {
        const startedAtMs = new Date(state.startedAt).getTime();
        const respuestaTimings = state.turns
          .map((t) => t.userAnswerSeconds)
          .filter((v): v is number => typeof v === 'number' && v > 0);
        const respuestaPromedioSeg = respuestaTimings.length > 0
          ? Math.round(respuestaTimings.reduce((a, b) => a + b, 0) / respuestaTimings.length)
          : null;
        const sesionDuracionTotalSeg = Math.max(0, Math.round((Date.now() - startedAtMs) / 1000));
        await writeSessionInitialToD1(db, {
          sessionId: state.sessionId,
          startedAtIso: state.startedAt,
          areaFormacion: profile.formationArea,
          aniosExperiencia: profile.experienceYears,
          paisInferido: null,
          rolApuntado: profile.role ?? 'Other',
          idioma: profile.language,
          etapa: profile.interviewStage ?? 'panel',
          numeroPreguntas: profile.questionCount,
          focus: profile.focus,
          sesionDuracionTotalSeg,
          respuestaPromedioSeg,
          hasCvSummary: Boolean(cvSummary),
        });
      }
    } catch (initErr) {
      // Best-effort: no bloqueamos el flujo si el D1 write falla.
      console.error('[simulator-session] F1 initial session write failed:', initErr);
    }
  }

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
    // Blindaje B (2 sept 2026): reportes finales van por streaming para evitar
    // el gateway timeout de Cloudflare (100s). Turnos normales usan la llamada
    // non-streaming rápida (~5-15s).
    response = isLastQuestion
      ? await retryableChatCompletionStream(
          {
            apiKey,
            model: MODEL,
            system: systemPrompt,
            messages,
            temperature: TEMPERATURE,
            maxTokens: effectiveMaxTokens,
          },
          'next-final-report',
        )
      : await retryableChatCompletion(
          {
            apiKey,
            model: MODEL,
            system: systemPrompt,
            messages,
            temperature: TEMPERATURE,
            maxTokens: effectiveMaxTokens,
          },
          'next-question',
        );
  } catch (err) {
    // Si fue en el último turn (reporte final), marcar el state para que
    // el frontend pueda ofrecer 'retry_report' sin re-hacer preguntas.
    // Blindaje C: encolamos en pending para que el cron lo procese async,
    // así el usuario no depende de hacer retry manual.
    if (isLastQuestion) {
      const errorMessage = err instanceof Error ? err.message : 'unknown';
      state.finalReportError = errorMessage;
      await persistSessionState(env, state);
      await enqueuePendingReport(env, state, errorMessage);
      // F2: notificar a Solca (no bloqueante)
      await notifyReportFailure(env, state, errorMessage, 'next');
    }
    if (err instanceof AnthropicError) {
      console.error('Anthropic error in next:', err.status, err.body);
      return {
        ok: false,
        error: isLastQuestion
          ? 'Tu sesion se completo. Estamos generando el reporte en segundo plano y te llegara por email en unos minutos.'
          : `Anthropic API error ${err.status}`,
        errorCode: isLastQuestion ? 'pending_async' : 'anthropic_error',
        sessionState: state,
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

    // Paywall (2 sept 2026): decrementar credits del paywall si el usuario
    // pasó por email lookup. Mismo criterio que betaCode: solo al éxito.
    if (state.emailHash) {
      await decrementCredits(env, state.emailHash);
    }

    // NUEVO (19 ago 2026): incrementar sessions_used SOLO ahora, cuando el
    // reporte final se generó y se persistió con éxito. Si algo revienta en el
    // camino (LLM error, parse fail que no llega a este punto), el código queda
    // vivo para reintentar. Best-effort: si el KV falla, no bloqueamos al
    // usuario que ya está viendo su reporte.
    if (state.betaCode) {
      try {
        await incrementBetaCodeUsage(
          env.SIMULATOR_BETA_CODES as KVNamespace | undefined,
          state.betaCode,
        );
      } catch (incErr) {
        console.error('[simulator-session] increment betaCode failed at report success:', incErr);
      }
    }

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
// F2 (2026-08-18) · notificar por Postmark cuando el reporte final falla
// después del segundo intento. Antes nos enterábamos por email del propio
// usuario (caso Lilian) o revisando snapshots por diferencia de conteo.
// Ahora hello@solcaciencia.com recibe un email con sessionId, perfil resumen
// y error para poder disparar retry_report o generar el reporte manualmente.
// ──────────────────────────────────────────────────────────────────

async function notifyReportFailure(
  env: Record<string, unknown>,
  state: SessionState,
  errorMessage: string,
  origin: 'next' | 'retry_report',
): Promise<void> {
  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!token) {
    console.warn('[simulator-session] POSTMARK_SERVER_TOKEN missing · skip notify');
    return;
  }
  const p = state.profile;
  const respuestasCount = state.turns.filter((t) => t.userAnswer).length;
  const subject = `[Simulador] Fallo reporte final · ${p.roleTitle ?? p.role ?? 'rol'} · ${origin}`;
  const textBody = [
    `Falló la generación del reporte final del simulador.`,
    ``,
    `sessionId: ${state.sessionId}`,
    `origen del fallo: ${origin}`,
    `error: ${errorMessage}`,
    ``,
    `Perfil:`,
    `  rol: ${p.roleTitle ?? '(no especificado)'}`,
    `  empresa: ${p.company ?? '(no especificada)'}`,
    `  area formación: ${p.formationArea}`,
    `  años experiencia: ${p.experienceYears}`,
    `  idioma: ${p.language}`,
    `  etapa: ${p.interviewStage ?? 'panel'}`,
    `  dificultad: ${p.difficulty}`,
    `  n preguntas: ${p.questionCount}`,
    `  plan: ${state.plan}`,
    ``,
    `Respuestas completadas: ${respuestasCount}/${p.questionCount}`,
    ``,
    `Recuperación:`,
    `  curl -X POST https://solcaciencia.com/api/simulator-session \\`,
    `    -H "Content-Type: application/json" \\`,
    `    -d '{"action":"retry_report","sessionId":"${state.sessionId}"}'`,
    ``,
    `Si retry falla de nuevo, extraer state del KV SIMULATOR_SESSIONS y regenerar manualmente.`,
  ].join('\n');

  try {
    await sendEmail(token, {
      from: 'hello@solcaciencia.com',
      to: 'hello@solcaciencia.com',
      subject,
      textBody,
      tag: 'simulator-report-failure',
      metadata: {
        sessionId: state.sessionId,
        origin,
        rolApuntado: p.role ?? 'Other',
        plan: state.plan,
      },
    });
  } catch (mailErr) {
    if (mailErr instanceof PostmarkError) {
      console.error('[simulator-session] Postmark failure notify failed:',
        mailErr.status, mailErr.body);
    } else {
      console.error('[simulator-session] notifyReportFailure error:', mailErr);
    }
  }
}

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

/**
 * Blindaje C · encola una sesión cuyo reporte final falló para procesamiento
 * async por el cron `/api/simulator-process-pending`.
 *
 * Usa el mismo KV SIMULATOR_SESSIONS con prefix `pending:{sessionId}`. El cron
 * lista pendientes, genera el reporte fuera del contexto HTTP (sin timeout de
 * Cloudflare gateway) y envía al usuario por email.
 *
 * Retention: 7 días. Si el cron no logra procesar en ese plazo, el pending
 * expira y se pierde (extremadamente raro con streaming activo).
 */
async function enqueuePendingReport(
  env: Record<string, unknown>,
  state: SessionState,
  errorMessage: string,
): Promise<void> {
  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (!kv) {
    console.warn('[simulator-session] SIMULATOR_SESSIONS KV no enlazado · no puedo encolar pending');
    return;
  }
  const pending = {
    sessionId: state.sessionId,
    enqueuedAt: new Date().toISOString(),
    errorMessage,
    attempts: 0,
    priority: 'normal' as const,
  };
  try {
    await kv.put(`pending:${state.sessionId}`, JSON.stringify(pending), {
      expirationTtl: 60 * 60 * 24 * 7, // 7 días
    });
    console.log(`[simulator-session] session ${state.sessionId} encolada en pending`);
  } catch (err) {
    console.error('[simulator-session] enqueue pending failed for', state.sessionId, err);
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
    // Blindaje B: retry_report también por streaming (mismo motivo que handleNext).
    response = await retryableChatCompletionStream(
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
    // Blindaje C (2 sept 2026): si retry_report también agotó sus reintentos,
    // encolamos la sesión en KV `pending:` para que el cron worker la procese
    // en background (sin límite HTTP de Cloudflare). El usuario recibe mensaje
    // amigable "reporte llega por email en unos minutos" en vez de error crudo.
    const errorMessage = err instanceof Error ? err.message : 'unknown error';
    state.finalReportError = errorMessage;
    await persistSessionState(env, state);
    await enqueuePendingReport(env, state, errorMessage);
    // F2: notificar a Solca (no bloqueante) para monitoreo
    await notifyReportFailure(env, state, errorMessage, 'retry_report');
    if (err instanceof AnthropicError) {
      return {
        ok: false,
        error:
          'Estamos generando tu reporte en segundo plano. Te llegará por email en unos minutos.',
        errorCode: 'pending_async',
      };
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

  // Paywall: decrementar credits si emailHash está en el state.
  if (state.emailHash) {
    await decrementCredits(env, state.emailHash);
  }

  // NUEVO (19 ago 2026): mismo criterio que handleNext. El increment ocurre
  // solo aquí, cuando el retry sí generó reporte y lo persistió. Si el retry
  // vuelve a fallar, retornamos antes de este punto y el código queda vivo.
  if (state.betaCode) {
    try {
      await incrementBetaCodeUsage(
        env.SIMULATOR_BETA_CODES as KVNamespace | undefined,
        state.betaCode,
      );
    } catch (incErr) {
      console.error('[simulator-session] increment betaCode failed at retry_report success:', incErr);
    }
  }

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
