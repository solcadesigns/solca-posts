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
/**
 * Kill switch por balance Anthropic (8 sept 2026 · post-mortem sangrado).
 *
 * Cuando Anthropic devuelve 402 (payment required) o 403 (invalid API key /
 * permission denied) o 529 recurrente (overloaded), seteamos un flag en KV
 * con TTL 15 min. Mientras el flag esté activo, handleNext y trySyncFinalReport
 * responden con error inmediato SIN llamar Anthropic — evita quemar dinero
 * cuando ya no hay balance o la key está mal.
 *
 * El flag se limpia solo tras 15 min (por si el usuario recargó fondos).
 * También se puede limpiar manualmente:
 *   npx wrangler kv key delete "anthropic_paused" --binding=SIMULATOR_SESSIONS --remote
 */
const ANTHROPIC_PAUSED_TTL_SECONDS = 15 * 60;
const ANTHROPIC_PAUSED_KEY = 'anthropic_paused';

async function isAnthropicPaused(env: Record<string, unknown>): Promise<boolean> {
  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (!kv) return false;
  const v = await kv.get(ANTHROPIC_PAUSED_KEY);
  return v != null;
}

async function markAnthropicPaused(
  env: Record<string, unknown>,
  reason: string,
): Promise<void> {
  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (!kv) return;
  try {
    await kv.put(ANTHROPIC_PAUSED_KEY, reason.slice(0, 200), {
      expirationTtl: ANTHROPIC_PAUSED_TTL_SECONDS,
    });
    console.warn(`[anthropic-pause] MARKED: ${reason.slice(0, 200)}`);
  } catch (err) {
    console.error('[anthropic-pause] failed to persist:', err);
  }
}

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

// FIX (7 sept 2026): revertimos de sonnet-4-6 a sonnet-4-5. Ver comentario en
// simulator-process-pending.ts para el post-mortem del incidente de tokens.
const MODEL = 'claude-sonnet-4-5';
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
  // Post-paywall (3 sept 2026): cuando cohort='paywall' este campo trae el plan
  // que fue comprado. handleInit lo usa para override del plan default.
  plan?: Plan;
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

  // Auth requerida (3 sept 2026): rechazar init sin código y sin email.
  // Antes, un usuario podía abrir /sesion directo (sin código, sin email) y
  // obtener freemium anónimo ilimitado. Cierre de fuga: para arrancar sesión
  // el usuario debe llegar con código SIM-XXXX (pagado o freemium) O con email
  // registrado en la landing.
  if (!body.betaCode && !body.email) {
    return {
      ok: false,
      error:
        'Necesitas un código de acceso o registrarte primero en solcaciencia.com/simulador-entrevistas/',
      errorCode: 'beta_code_invalid',
    };
  }

  // Validar beta code si vino (legacy pre-paywall + nuevo cohort='paywall').
  // Post-paywall (3 sept 2026): el mismo mecanismo del código SIM-XXXXXXXX
  // sirve como auth para créditos comprados. El record trae cohort='paywall'
  // y el `plan` que se compró — lo capturamos aquí para override más adelante.
  let paywallCodeRecord: BetaCodeRecord | null = null;
  if (body.betaCode) {
    const betaKv = env.SIMULATOR_BETA_CODES as KVNamespace | undefined;
    const check = await validateBetaCode(betaKv, body.betaCode);
    if (!check.ok) {
      return {
        ok: false,
        error: `Código ${check.reason}`,
        errorCode: check.reason === 'exhausted' ? 'beta_code_exhausted' : 'beta_code_invalid',
      };
    }
    if (check.record?.cohort === 'paywall' && check.record.plan) {
      paywallCodeRecord = check.record;
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

  // Prioridad #1: auth por código paywall (SIM-XXXXXXXX generado por Stripe webhook)
  // El código es criptográficamente único, no adivinable con solo saber el email.
  if (paywallCodeRecord && paywallCodeRecord.plan) {
    plan = paywallCodeRecord.plan;
    // Sincronizar emailHash del record al state para decremento de credits al finalizar
    if (paywallCodeRecord.email_hash) {
      // Manejado más abajo cuando armamos el state
    }
    // Lookup credits para verificar remaining (por si acaso el record beta y credits divergen)
    if (paywallCodeRecord.email_hash) {
      const creditsKv = env.SIMULATOR_CREDITS as KVNamespace | undefined;
      if (creditsKv) {
        const raw = await creditsKv.get(`credits:${paywallCodeRecord.email_hash}`);
        if (raw) {
          try {
            creditsRecord = JSON.parse(raw) as CreditsRecord;
          } catch {
            /* ignore parse fail */
          }
        }
      }
    }
  }

  // Prioridad #2: lookup por email (freemium auto o lookup credits · legacy y para acceso freemium sin código)
  const email = body.email?.trim().toLowerCase();
  if (!paywallCodeRecord && email) {
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
    // Auth por código paywall: usar el email_hash del beta record (fuente autoritativa
    // porque el usuario ya no envía email plano cuando entra con código).
    emailHash: paywallCodeRecord?.email_hash ?? (email ? await hashEmail(email) : undefined),
    // 9 sept 2026: si el usuario entró con código (no email en URL) usamos el
    // email plano guardado en el beta record. Permite que el cron async envíe
    // el reporte por Postmark cuando el sync path falla.
    userEmail: email || paywallCodeRecord?.email || undefined,
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
// v0.8.3 (7 sept 2026) · path SYNC inline para reportes de sesiones cortas
// ──────────────────────────────────────────────────────────────────
//
// Cuando la sesión tiene ≤8 preguntas, el reporte final cabe en el subrequest
// timeout de 30s de Cloudflare Workers. Intentamos generarlo sincrónicamente
// aquí para dar el reporte inmediato al usuario. Si falla (timeout, JSON
// malformado, cualquier error), devolvemos { ok:false } y el caller cae al
// path async por chunks como respaldo automático.
//
// No lanza excepciones. Timeout duro de 25s (5s de margen bajo el 30s de CF).

async function trySyncFinalReport(
  state: SessionState,
  env: Record<string, unknown>,
): Promise<
  | { ok: true; finalReport: NonNullable<SessionState['finalReport']> }
  | { ok: false; error: string }
> {
  const apiKey = env.ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) return { ok: false, error: 'no_api_key' };

  // Guard kill switch balance (post-mortem 8 sept)
  if (await isAnthropicPaused(env)) {
    return { ok: false, error: 'anthropic_paused' };
  }

  try {
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

    const response = await retryableChatCompletion(
      {
        apiKey,
        // Haiku 4.5 en sync 10q · más rápido que Sonnet, cabe mejor en el
        // timeout de 25s. Sonnet no cabía consistentemente con 10q + contexto real.
        model: 'claude-haiku-4-5',
        system: systemPrompt,
        messages,
        temperature: TEMPERATURE,
        maxTokens: finalReportMaxTokens(state.profile.questionCount),
        timeoutMs: 25000,
        cacheSystem: true,
      },
      'sync_final_report',
      1,
    );

    const assistantText = extractText(response);
    const parsed = parseFinalOutput(assistantText);

    if (!parsed.finalReport) {
      return { ok: false, error: 'parse_no_final_report' };
    }
    if (!parsed.finalReport.sessionId) {
      parsed.finalReport.sessionId = state.sessionId;
    }
    // CTA override (9 sept 2026): forzar URLs Hotmart verificadas por rol.
    // El modelo puede seguir generando su propuesta pero se descarta a favor
    // del catálogo hardcoded. Ver `getRoleCta` en simulator-defaults.
    parsed.finalReport.cta = getRoleCta(state.profile.role);

    // Escribir métricas a D1 si vinieron
    if (parsed.metricsAnonymous) {
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
        console.error('[sync_final_report] D1 write failed:', writeErr);
      }
      state.metricsAnonymous = parsed.metricsAnonymous;
    }

    return { ok: true, finalReport: parsed.finalReport };
  } catch (err) {
    // Kill switch balance: si Anthropic devolvió 402/403, pausar
    if (err instanceof AnthropicError && (err.status === 402 || err.status === 403)) {
      await markAnthropicPaused(env, `sync_final_report ${err.status}: ${JSON.stringify(err.body).slice(0, 150)}`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
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

  // v0.8.3 (7 sept 2026): híbrido sync/async según largo de sesión.
  // Los planes de sesión son 5 / 10 / 15 preguntas (no hay intermedios).
  // - 5 preguntas: SYNC inline. Reporte cabe en <30s (Cloudflare subrequest).
  //   Es el caso validado en producción antes del async chunks.
  // - 10 y 15 preguntas: async por chunks (task #76 · cron process-pending).
  //   El reporte sync tarda 40-90s → siempre timeout, no vale la pena intentar.
  // Si sync falla (raro), cae al async como red de seguridad.
  // Subido de 5 → 10 el 9 sept 2026. 15q deshabilitado en la UI (ver
  // sesion.astro). Con Sonnet 4.5 + prompt caching, 10q debería caber en
  // <25s del sync path. Si Sonnet no cabe, fallback automático a async.
  const SYNC_MAX_QUESTIONS = 10;
  if (isLastQuestion) {
    // Guardar userEmail en state para que el cron envíe email al terminar.
    if (body.email) {
      state.userEmail = body.email;
    }

    // Path SYNC inline para sesiones cortas
    if (profile.questionCount <= SYNC_MAX_QUESTIONS) {
      const syncResult = await trySyncFinalReport(state, env);
      if (syncResult.ok) {
        // Reporte generado exitosamente inline · devolver directo
        state.finished = true;
        state.finalReport = syncResult.finalReport;
        state.finalReportStatus = 'ready';
        delete state.finalReportError;
        await persistSessionState(env, state);

        // Decrementar créditos + incrementar betaCode ya que el reporte se entregó
        if (state.emailHash) await decrementCredits(env, state.emailHash);
        if (state.betaCode) {
          try {
            await incrementBetaCodeUsage(
              env.SIMULATOR_BETA_CODES as KVNamespace | undefined,
              state.betaCode,
            );
          } catch (incErr) {
            console.error('[simulator-session] increment betaCode failed at sync path:', incErr);
          }
        }

        // Devolver creditsRemaining
        let creditsRemaining: number | undefined;
        if (state.emailHash) {
          const creditsKv = env.SIMULATOR_CREDITS as KVNamespace | undefined;
          if (creditsKv) {
            try {
              const raw = await creditsKv.get(`credits:${state.emailHash}`);
              if (raw) {
                const rec = JSON.parse(raw) as CreditsRecord;
                creditsRemaining = rec.remaining;
              }
            } catch { /* best-effort */ }
          }
        }

        return {
          ok: true,
          sessionState: state,
          finished: true,
          finalReport: syncResult.finalReport,
          planUsed: state.plan,
          creditsRemaining,
        };
      }
      // Si sync falló, cae al async como respaldo (misma UX que sesiones largas)
      console.warn(`[simulator-session] sync path failed for ${state.sessionId}, falling back to async: ${syncResult.error}`);
    }

    // Path ASYNC por chunks (sesiones largas o fallback de sync)
    state.finalReportStatus = 'queued';
    state.finished = true;
    await persistSessionState(env, state);

    // Encolar pending con más contexto para el cron
    await enqueuePendingReport(env, state, 'async_by_default_v0.8');

    // Devolver credits remaining para que el frontend decida survey final
    let creditsRemaining: number | undefined;
    if (state.emailHash) {
      const creditsKv = env.SIMULATOR_CREDITS as KVNamespace | undefined;
      if (creditsKv) {
        try {
          const raw = await creditsKv.get(`credits:${state.emailHash}`);
          if (raw) {
            const rec = JSON.parse(raw) as CreditsRecord;
            creditsRemaining = rec.remaining;
          }
        } catch {
          /* best-effort */
        }
      }
    }

    // Decrementar créditos ahora (regla del pre-paywall: contador se toca cuando el
    // usuario termina las preguntas. El reporte se garantiza por email async).
    // Si el usuario abandonó a mitad, no hay decremento porque no llegamos aquí.
    if (state.emailHash) {
      await decrementCredits(env, state.emailHash);
    }
    if (state.betaCode) {
      try {
        await incrementBetaCodeUsage(
          env.SIMULATOR_BETA_CODES as KVNamespace | undefined,
          state.betaCode,
        );
      } catch (incErr) {
        console.error('[simulator-session] increment betaCode failed at queue:', incErr);
      }
    }

    return {
      ok: true,
      sessionState: state,
      finished: true,
      finalReport: undefined,
      planUsed: state.plan,
      creditsRemaining,
      errorCode: 'pending_async',
      error:
        'Tu sesion se completo. Estamos generando el reporte por chunks para evitar timeouts. Aparecera en esta pantalla en 2-5 min y te llegara por email tambien.',
    };
  }

  const systemPrompt = buildSystemPrompt({
    profile,
    plan,
    sessionNumberInPackage,
    cvSummary,
  });

  const messages = buildMessagesFromState(state);

  // v0.7: sin feedback explícito por turno. Solo transición breve + siguiente pregunta.
  messages.push({
    role: 'user',
    content:
      'Continúa con la siguiente pregunta. NO des feedback explícito sobre la respuesta anterior (eso va consolidado al final). Puedes hacer una transición breve de una línea si quieres ("Entendido", "Pasamos a la siguiente"), o ir directo a la pregunta. Recuerda que el adaptive de contenido (Mecanismo 2) sigue activo: si detectaste gap o fortaleza, la siguiente pregunta puede explorarlo.',
  });

  // Guard de kill switch por balance (8 sept 2026)
  if (await isAnthropicPaused(env)) {
    return {
      ok: false,
      error: 'Servicio temporalmente saturado. Reintenta en unos minutos.',
      errorCode: 'anthropic_paused' as unknown as SessionEndpointResponse['errorCode'],
      sessionState: state,
    };
  }

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
      'next-question',
      1, // maxAttempts=1 · no reintentos internos (post-mortem 8 sept)
    );
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error('Anthropic error in next:', err.status, err.body);
      // Kill switch · si es 402 (balance) o 403 (auth), pausar por 15 min
      if (err.status === 402 || err.status === 403) {
        await markAnthropicPaused(env, `next-question ${err.status}: ${JSON.stringify(err.body).slice(0, 150)}`);
      }
      return {
        ok: false,
        error: `Anthropic API error ${err.status}`,
        errorCode: 'anthropic_error',
        sessionState: state,
      };
    }
    throw err;
  }

  const assistantText = extractText(response);

  // Detectar truncamiento por max_tokens
  if (response.stop_reason === 'max_tokens') {
    console.warn(
      '[simulator-session] Claude hit max_tokens cap on next-question',
      JSON.stringify({
        outputTokens: response.usage.output_tokens,
        questionCount: profile.questionCount,
        textPrefix: assistantText.slice(0, 200),
      }),
    );
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

  // Dedup · si ya notificamos por este sessionId en la última hora, skip.
  // Evita spam cuando el usuario da retry múltiples veces o cuando el cron
  // vuelve a tocar la misma sesión. Usa el mismo KV que sessions (ya bound).
  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  const dedupKey = `notify:${state.sessionId}`;
  if (kv) {
    const already = await kv.get(dedupKey);
    if (already) {
      console.log(`[simulator-session] notify dedup hit para ${state.sessionId}, skip`);
      return;
    }
    await kv.put(dedupKey, '1', { expirationTtl: 3600 });
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
 * Task #74 · encola un email post-paquete cuando el usuario termina la última
 * sesión de su paquete (remaining=0). Cron `/api/simulator-post-package-cron`
 * lo procesa al día siguiente para enviar email opcional de feedback + cupón.
 *
 * KV: SIMULATOR_SESSIONS con prefix `pkg_end:{sessionId}` · TTL 3 días.
 * Guarda email plano (necesario para Postmark) pero solo temporalmente.
 */
async function enqueuePackageEndEmail(
  env: Record<string, unknown>,
  sessionId: string,
  data: { email: string; firstName?: string; plan: Plan; role?: string; terminadoAt: string },
): Promise<void> {
  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (!kv) return;
  try {
    await kv.put(`pkg_end:${sessionId}`, JSON.stringify(data), {
      expirationTtl: 60 * 60 * 24 * 3, // 3 días
    });
  } catch (err) {
    console.error('[simulator-session] enqueue pkg_end failed for', sessionId, err);
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

  // CIRCUIT BREAKER (7 sept 2026): si la sesión ya fue marcada como
  // permanently_failed por el cron, no dispares otro retry — respondemos
  // directamente sin gastar tokens. El usuario debe contactar soporte.
  if (state.finalReportStatus === 'failed' && (state.finalReportError ?? '').includes('circuit breaker')) {
    return {
      ok: false,
      error: 'Tu sesión requiere revisión manual. Escríbenos a hello@solcaciencia.com y te lo hacemos llegar.',
      errorCode: 'permanently_failed' as unknown as SessionEndpointResponse['errorCode'],
    };
  }

  // CIRCUIT BREAKER (7 sept 2026): si ya hay un pending activo para esta
  // sesión, NO dispares otro retry sincrónico — devuelve pending_async y deja
  // que el cron continúe. Evita el sangrado por clicks múltiples del usuario.
  const kv = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (kv) {
    const pendingRaw = await kv.get(`pending:${body.sessionId}`);
    if (pendingRaw) {
      return {
        ok: false,
        error: 'Ya estamos procesando tu reporte. Espera unos minutos — llegará por email cuando esté listo.',
        errorCode: 'pending_async',
      };
    }
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

  // v0.8.2 (7 sept 2026): SIEMPRE encolar en pending directamente. NO intentar
  // fetch sync a Anthropic. Post-mortem del incidente 7 sept: el fetch sync
  // aquí tenía riesgo alto de: (a) fallar por Cloudflare 30s timeout gastando
  // tokens, (b) provocar retries múltiples si el usuario clickeaba el botón.
  // El cron process-pending genera el reporte por chunks (task #76).
  state.finalReportStatus = 'processing';
  state.finalReportError = undefined;
  await persistSessionState(env, state);
  await enqueuePendingReport(env, state, 'usuario disparó retry_report');
  return {
    ok: false,
    error: 'Estamos generando tu reporte en segundo plano. Te llegará por email en unos minutos.',
    errorCode: 'pending_async',
  };

  // Todo el código sync post-fetch (parseo, persist, decrementCredits,
  // incrementBetaCodeUsage, D1 metrics) se ejecuta ahora en el cron
  // process-pending cuando genera el chunk final. Ver task #76.
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
