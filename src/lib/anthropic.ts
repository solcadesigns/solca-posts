/**
 * Wrapper mínimo del cliente Anthropic (Claude).
 * Usa fetch nativo de Workers, sin SDK para mantener bundle pequeño y zero deps.
 *
 * Docs: https://docs.anthropic.com/en/api/messages
 *
 * 6 nov 2026: Haiku 4.5 → Haiku 5.5 (`claude-haiku-5-5`). Las diferencias por modelo viven en
 * construirCuerpo(); el respaldo temporal a Haiku 4.5, en chatCompletion(). Prueba offline:
 * `node scripts/test-anthropic-body.mjs`.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Modelo Haiku vigente (6 nov 2026). */
export const HAIKU = 'claude-haiku-5-5';
/** Respaldo temporal: se usa solo si Haiku 5.5 responde 4xx/5xx. Quitar cuando 5.5 esté estable. */
export const HAIKU_RESPALDO = 'claude-haiku-4-5';

export type Esfuerzo = 'low' | 'medium' | 'high';

export interface ChatCompletionOptions {
  apiKey: string;
  /** Default: claude-haiku-5-5 */
  model?: string;
  /** System prompt (top-level, no se manda como mensaje) */
  system: string;
  messages: ChatMessage[];
  /**
   * 0..1, default 0.3. Solo se manda a modelos que lo aceptan (Haiku 4.5, también en el respaldo).
   * Haiku 5.5 y Sonnet 5.5 responden 400 con un valor distinto del default, así que no se envía.
   */
  temperature?: number;
  /** Required. Default 4000. Es el tope para el modelo principal (ya con el margen de Haiku 5.5). */
  maxTokens?: number;
  /**
   * Haiku 5.5 (6 nov 2026): nivel de esfuerzo (`output_config.effort`). Default 'low'. Se ignora en
   * modelos sin effort (Haiku 4.5).
   */
  effort?: Esfuerzo;
  /**
   * Haiku 5.5: 'adaptive' (default del modelo; el pensamiento cuenta contra max_tokens) o 'disabled'
   * (permitido con effort low/medium/high). Se ignora en otros modelos.
   */
  thinking?: 'adaptive' | 'disabled';
  /**
   * Haiku 5.5: JSON schema para salidas estructuradas (`output_config.format`). Sustituye al prefill
   * `{`. En el respaldo a Haiku 4.5 no se manda: ahí vuelven el prefill y la temperatura.
   */
  jsonSchema?: Record<string, unknown>;
  /**
   * Prefill del asistente (p. ej. `{`). Solo se agrega en modelos que lo aceptan (Haiku 4.5, en el
   * respaldo); Haiku 5.5 responde 400 con un prefill. Si se usó, la respuesta lo trae en `prefill`
   * para que quien llama lo anteponga al texto.
   */
  prefill?: string;
  /** Tope de tokens para el respaldo a Haiku 4.5 (el valor de antes). Default: maxTokens. */
  maxTokensRespaldo?: number;
  /**
   * Timeout del fetch a Anthropic en milisegundos. Default 85000 (85s) para
   * dejar margen antes del gateway timeout de Cloudflare (100s). Si el fetch
   * excede este timeout, se aborta y se lanza AnthropicError con status 524
   * (retryable). Agregado 2 sept 2026 tras sesión 27d9355c.
   * 6 nov 2026: el respaldo a Haiku 4.5 usa solo el tiempo que sobra de este mismo tope.
   */
  timeoutMs?: number;
  /**
   * Si true, envía el system prompt con cache_control ephemeral (Anthropic
   * prompt caching). El primer request cachea el system (+25% costo del write),
   * llamadas subsecuentes en <5 min pagan 10% del costo del input Y se ahorran
   * el tiempo de encoding. Ideal para chunks del reporte que comparten el
   * mismo buildSystemPrompt gigante (~5-8k tokens). Agregado 9 sept 2026.
   */
  cacheSystem?: boolean;
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  /** Modelo que respondió según la API (con el respaldo, el id de Haiku 4.5). */
  model: string;
  content: Array<{ type: string; text?: string }>;
  stop_reason: string;
  stop_details?: { category?: string } | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  /** Agregado por este wrapper: el prefill que se mandó (solo en el respaldo). Anteponerlo al texto. */
  prefill?: string;
  /** Agregado por este wrapper: true si respondió el respaldo (Haiku 4.5). */
  respaldo?: boolean;
  /** Agregado por este wrapper: status HTTP del modelo principal que activó el respaldo. */
  statusRespaldo?: number;
}

/**
 * Parámetros que dependen del modelo (30 oct 2026, retiro de Sonnet 4.5 el 30 nov 2026).
 * Claude Sonnet 5.5 rechaza con 400 un `temperature` distinto del default y piensa por default
 * (los tokens de pensamiento cuentan contra max_tokens y suman latencia). `between_tools` apaga
 * el pensamiento, que es como se comportaba Sonnet 4.5 en estas llamadas.
 *
 * 6 nov 2026, Haiku 5.5: sin temperature/top_p/top_k ni prefill (400 los dos), effort explícito,
 * pensamiento adaptive o disabled según la llamada, y el JSON con `output_config.format`.
 */
function parametrosDeModelo(model: string, options: ChatCompletionOptions): Record<string, unknown> {
  if (model === 'claude-sonnet-5-5') return { thinking: { type: 'between_tools' } };
  if (model === HAIKU) {
    const outputConfig: Record<string, unknown> = { effort: options.effort ?? 'low' };
    if (options.jsonSchema) outputConfig.format = { type: 'json_schema', schema: options.jsonSchema };
    return {
      thinking: { type: options.thinking ?? 'adaptive' },
      output_config: outputConfig,
    };
  }
  return { temperature: options.temperature ?? 0.3 };
}

/** Modelos que aceptan un prefill del asistente (6 nov 2026). */
function aceptaPrefill(model: string): boolean {
  return model !== HAIKU && model !== 'claude-sonnet-5-5';
}

/**
 * Arma el cuerpo de /v1/messages para un modelo. Puro (sin fetch), para probarlo offline.
 * `model` permite pedir el cuerpo del respaldo con las mismas opciones.
 */
export function construirCuerpo(
  options: ChatCompletionOptions,
  model: string = options.model ?? HAIKU,
): Record<string, unknown> {
  const { system, messages, maxTokens = 4000, cacheSystem = false, prefill } = options;
  // Anthropic prompt caching: si cacheSystem=true, mandamos system como array
  // con cache_control ephemeral. Anthropic cachea automáticamente y responde
  // en llamadas subsecuentes con cache_read_input_tokens (10% del costo del
  // input regular Y sin el tiempo de encoding).
  const systemField = cacheSystem
    ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    : system;
  const usarPrefill = Boolean(prefill) && aceptaPrefill(model);
  const esRespaldo = model === HAIKU_RESPALDO && options.model === HAIKU;
  return {
    model,
    system: systemField,
    messages: usarPrefill ? [...messages, { role: 'assistant', content: prefill }] : messages,
    ...parametrosDeModelo(model, options),
    max_tokens: esRespaldo ? (options.maxTokensRespaldo ?? maxTokens) : maxTokens,
  };
}

export class AnthropicError extends Error {
  status: number;
  body?: unknown;
  // Sin parameter properties (`public status`) para que Node importe este .ts sin compilar en las pruebas.
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'AnthropicError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Haiku 5.5 y Sonnet 5.5 pueden negarse por sus clasificadores de seguridad: HTTP 200 con stop_reason
 * "refusal" (6 nov 2026). Quien llama distingue el caso con `instanceof AnthropicRefusalError` o
 * `codigo === 'refusal'` y muestra su mensaje genérico en español (nunca "Anthropic API error 200"). Se lanza como error para que siga el mismo camino que cualquier otra falla. Status 200:
 * no está en RETRYABLE_STATUS ni activa el kill switch (402/403) ni el respaldo (que solo mira 4xx/5xx).
 * No se reintenta con Haiku 4.5 a propósito: sería saltarse el clasificador.
 */
export class AnthropicRefusalError extends AnthropicError {
  readonly codigo = 'refusal';
  category?: string;
  constructor(model: string, category?: string) {
    super(200, `Anthropic refusal (${model}${category ? `, ${category}` : ''})`, { stop_reason: 'refusal', category });
    this.name = 'AnthropicRefusalError';
    this.category = category;
  }
}

function revisarRechazo(response: AnthropicResponse): void {
  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category;
    console.warn('[anthropic-refusal]', JSON.stringify({ model: response.model, category }));
    throw new AnthropicRefusalError(response.model, category);
  }
}

/** Una sola petición sin streaming, sin respaldo. */
async function enviarUnaVez(
  options: ChatCompletionOptions,
  model: string,
  timeoutMs: number,
): Promise<AnthropicResponse> {
  const body = construirCuerpo(options, model);

  // AbortController con timeout explícito. Si Anthropic tarda más de timeoutMs,
  // abortamos y convertimos el error en AnthropicError 524 (retryable) en vez
  // de dejar que Cloudflare mate el Worker entero a los 100s.
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (err instanceof Error && err.name === 'AbortError') {
      // Convertir a AnthropicError 524 para que retryableChatCompletion lo reintente
      throw new AnthropicError(
        524,
        `Anthropic fetch aborted after ${timeoutMs}ms (client-side timeout to avoid Cloudflare gateway 524)`,
        'client_timeout',
      );
    }
    throw err;
  }
  clearTimeout(timeoutHandle);

  if (!response.ok) {
    // Bug fix 2026-08-18: leer el body UNA SOLA VEZ.
    // Antes usábamos try { await response.json() } catch { await response.text() },
    // pero cuando .json() fallaba (Anthropic 5xx devuelve HTML de overload, 529
    // devuelve texto plano de infra), el segundo await intentaba consumir el
    // body ya leído y tiraba "Body has already been used. It can only be used
    // once. Use tee() first if you need to read it twice." — esa excepción se
    // propagaba fuera del AnthropicError y rompía retryableChatCompletion.
    // Fix: leer como texto una sola vez, después intentar parsear el string.
    const errorText = await response.text();
    let errorBody: unknown = errorText;
    try {
      errorBody = JSON.parse(errorText);
    } catch {
      // errorBody se queda como el string plano; suficiente para diagnosticar.
    }
    throw new AnthropicError(
      response.status,
      `Anthropic API error: ${response.status} ${response.statusText}`,
      errorBody,
    );
  }

  const data = (await response.json()) as AnthropicResponse;
  if (options.prefill && (body.messages as ChatMessage[]).length > options.messages.length) {
    data.prefill = options.prefill;
  }
  return data;
}

/**
 * Tiempo mínimo que debe quedar del timeout para intentar el respaldo. 12 s (revisión 6 nov 2026): en las rutas
 * de 25 s (reporte sync) y 28 s (chunks), un respaldo con menos tiempo casi seguro se corta a la mitad.
 */
export const RESPALDO_MIN_MS = 12000;

/**
 * Respaldo temporal (6 nov 2026, mismo patrón que Sonnet 5.5): si Haiku 5.5 falla con 4xx/5xx, se repite
 * una vez con Haiku 4.5 y los parámetros de antes (temperature y prefill). No aplica a 401/402/403 (cuenta o
 * saldo: Haiku 4.5 fallaría igual y el kill switch necesita ver el status original), a los rechazos de
 * seguridad, ni cuando ya no queda tiempo del timeout (p. ej. tras un 524 del cliente). Quitar cuando
 * Haiku 5.5 lleve unas semanas sin `[anthropic-fallback]` en los logs.
 */
export function debeUsarRespaldo(options: ChatCompletionOptions, err: unknown, msRestantes: number): boolean {
  return (
    (options.model ?? HAIKU) === HAIKU &&
    err instanceof AnthropicError &&
    !(err instanceof AnthropicRefusalError) &&
    err.status >= 400 &&
    ![401, 402, 403].includes(err.status) &&
    msRestantes >= RESPALDO_MIN_MS
  );
}

export async function chatCompletion(
  options: ChatCompletionOptions,
): Promise<AnthropicResponse> {
  const model = options.model ?? HAIKU;
  const timeoutMs = options.timeoutMs ?? 85000; // 85s · deja margen contra el gateway timeout de Cloudflare (100s)
  const t0 = Date.now();
  let response: AnthropicResponse;
  try {
    response = await enviarUnaVez(options, model, timeoutMs);
  } catch (err) {
    const msRestantes = timeoutMs - (Date.now() - t0);
    if (!debeUsarRespaldo(options, err, msRestantes)) throw err;
    const e = err as AnthropicError;
    console.warn(
      `[anthropic-fallback] ${HAIKU} respondió ${e.status}; reintento con ${HAIKU_RESPALDO}`,
      JSON.stringify(e.body ?? null).slice(0, 300),
    );
    response = await enviarUnaVez({ ...options, model: HAIKU }, HAIKU_RESPALDO, msRestantes);
    response.respaldo = true;
    response.statusRespaldo = e.status;
  }
  revisarRechazo(response);
  return response;
}

/**
 * Retry helper para chatCompletion (Fase 1.5.I · 19 jun 2026).
 *
 * Reintenta automáticamente errores transitorios de Anthropic (5xx, overloaded)
 * con backoff exponencial. NO reintenta errores de cliente (4xx invalid_request,
 * 401 auth) porque esos requieren intervención manual.
 *
 * Backoff: 1s, 3s, 7s (acumulado ~11s en peor caso, dentro de límites de CF Workers).
 * Max 3 intentos totales (1 inicial + 2 retries).
 *
 * Logs cada intento a console.warn para diagnóstico via wrangler tail.
 */
const RETRY_DELAYS_MS = [1000, 3000, 7000];
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 524, 529]);
// 524 = Cloudflare gateway timeout (agregado 2 sept 2026 tras sesión 27d9355c)
// 529 = Anthropic's "overloaded_error" status
// 429 = rate limit (con backoff suele resolver; si no, falla en el último intento)

/**
 * @param maxAttempts Override del máximo de intentos totales (default 3 · 1 inicial + 2 retries).
 *                    Pasa 1 para desactivar reintentos internos completamente.
 *                    Cada reintento consume tokens completos, así que en paths
 *                    donde el costo importa más que la fiabilidad (ej. el cron
 *                    del simulador), conviene usar 1.
 *                    Post-mortem 8 sept 2026: los reintentos internos silenciosos
 *                    contribuyeron al sangrado del 7-8 sept.
 */
export async function retryableChatCompletion(
  options: ChatCompletionOptions,
  context = 'unknown',
  maxAttempts?: number,
): Promise<AnthropicResponse> {
  const totalAttempts = Math.min(
    Math.max(1, maxAttempts ?? RETRY_DELAYS_MS.length),
    RETRY_DELAYS_MS.length,
  );
  let lastError: unknown;
  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      const result = await chatCompletion(options);
      if (attempt > 0) {
        console.warn(
          `[anthropic-retry] ${context} succeeded on attempt ${attempt + 1}/${totalAttempts}`,
        );
      }
      return result;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof AnthropicError && RETRYABLE_STATUS.has(err.status);
      const willRetry = isRetryable && attempt < totalAttempts - 1;

      console.warn(
        `[anthropic-retry] ${context} attempt ${attempt + 1}/${totalAttempts} failed`,
        JSON.stringify({
          status: err instanceof AnthropicError ? err.status : 'unknown',
          message: err instanceof Error ? err.message : String(err),
          retryable: isRetryable,
          willRetry,
        }),
      );

      // 11 nov 2026: se quitó el respaldo a Sonnet 4.5 (Anthropic lo retira el 30 nov 2026). Del 4 al 11 nov no se
      // activó ninguna vez (Workers Observability sin "[anthropic-fallback]"; D1 llm_modelo: 0 de 101 llamadas).

      if (!willRetry) {
        throw err;
      }

      const delayMs = RETRY_DELAYS_MS[attempt];
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All retry attempts failed');
}

/** Helper: extract text from Anthropic response content blocks */
export function extractText(response: AnthropicResponse): string {
  return response.content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text as string)
    .join('');
}

// ──────────────────────────────────────────────────────────────────
// Streaming API · agregado 2 sept 2026 tras sesión 27d9355c
// ──────────────────────────────────────────────────────────────────
//
// Cuando la respuesta de Anthropic tarda más de 100s, Cloudflare gateway
// devuelve 524 aunque el Worker siga vivo esperando. Con streaming, Anthropic
// empieza a enviar bytes en los primeros 1-2s (event start) y Cloudflare NO
// corta mientras haya tráfico. Por eso streaming elimina el 524 para reportes
// grandes (10-15 preguntas · ~7000-9000 tokens de output).
//
// Uso: idéntico a chatCompletion pero acumula chunks en un buffer y devuelve
// el response completo al cerrar el stream (message_stop). El caller no ve
// diferencia — solo que la generación tolera duraciones mayores.

/**
 * Versión streaming de chatCompletion. Acumula chunks del SSE de Anthropic
 * y devuelve el response completo al recibir message_stop.
 *
 * Se usa para el reporte final del simulador (grande, tarda 60-90s).
 * NO cambiar a streaming las llamadas por-turno (rápidas, no lo necesitan).
 */
export async function chatCompletionStream(
  options: ChatCompletionOptions,
): Promise<AnthropicResponse> {
  const {
    apiKey,
    model = HAIKU,
    timeoutMs = 180000, // 180s · con streaming Cloudflare no corta, así que más margen
  } = options;

  // 6 nov 2026: mismo cuerpo por modelo que chatCompletion (sin respaldo: hoy nadie usa el streaming).
  const body = { ...construirCuerpo(options, model), stream: true };

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AnthropicError(
        524,
        `Anthropic stream aborted after ${timeoutMs}ms`,
        'client_timeout',
      );
    }
    throw err;
  }

  if (!response.ok) {
    clearTimeout(timeoutHandle);
    const errorText = await response.text();
    let errorBody: unknown = errorText;
    try {
      errorBody = JSON.parse(errorText);
    } catch {
      /* keep string */
    }
    throw new AnthropicError(
      response.status,
      `Anthropic API error: ${response.status} ${response.statusText}`,
      errorBody,
    );
  }

  if (!response.body) {
    clearTimeout(timeoutHandle);
    throw new AnthropicError(500, 'Anthropic stream response had no body');
  }

  // ── Acumular chunks SSE ────────────────────────────────────────
  // Anthropic streaming emite eventos como:
  //   event: message_start
  //   data: {"type":"message_start","message":{...}}
  //
  //   event: content_block_delta
  //   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
  //
  //   event: message_stop
  //   data: {"type":"message_stop"}
  //
  // Acumulamos los text_delta en un buffer y armamos el response al final.

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const textParts: string[] = [];
  let messageMeta: Partial<AnthropicResponse> = {
    id: '',
    type: 'message',
    role: 'assistant',
    model,
    content: [],
    stop_reason: 'end_turn',
    usage: { input_tokens: 0, output_tokens: 0 },
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Procesar líneas SSE (separadas por \n\n)
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        // Extraer la línea `data: ...` del evento
        const dataLine = event.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const jsonStr = dataLine.slice(5).trim();
        if (!jsonStr) continue;

        let payload: {
          type?: string;
          message?: Partial<AnthropicResponse>;
          delta?: { type?: string; text?: string; stop_reason?: string };
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        try {
          payload = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (payload.type === 'message_start' && payload.message) {
          messageMeta = { ...messageMeta, ...payload.message };
        } else if (payload.type === 'content_block_delta' && payload.delta?.type === 'text_delta') {
          if (payload.delta.text) textParts.push(payload.delta.text);
        } else if (payload.type === 'message_delta') {
          if (payload.delta?.stop_reason) messageMeta.stop_reason = payload.delta.stop_reason;
          if (payload.usage) {
            messageMeta.usage = {
              input_tokens: payload.usage.input_tokens ?? messageMeta.usage?.input_tokens ?? 0,
              output_tokens: payload.usage.output_tokens ?? messageMeta.usage?.output_tokens ?? 0,
            };
          }
        }
        // message_stop y otros eventos no requieren procesamiento adicional
      }
    }
  } finally {
    clearTimeout(timeoutHandle);
    reader.releaseLock();
  }

  const fullText = textParts.join('');
  const result: AnthropicResponse = {
    id: messageMeta.id ?? '',
    type: messageMeta.type ?? 'message',
    role: messageMeta.role ?? 'assistant',
    model: messageMeta.model ?? model,
    content: [{ type: 'text', text: fullText }],
    stop_reason: messageMeta.stop_reason ?? 'end_turn',
    usage: messageMeta.usage ?? { input_tokens: 0, output_tokens: 0 },
  };
  // Solo se acumulan text_delta: los bloques de pensamiento de Haiku 5.5 no entran al texto.
  revisarRechazo(result);
  return result;
}

/**
 * Retry wrapper para chatCompletionStream. Misma lógica que
 * retryableChatCompletion pero usa la versión streaming.
 */
export async function retryableChatCompletionStream(
  options: ChatCompletionOptions,
  context = 'unknown-stream',
): Promise<AnthropicResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    try {
      const result = await chatCompletionStream(options);
      if (attempt > 0) {
        console.warn(
          `[anthropic-retry-stream] ${context} succeeded on attempt ${attempt + 1}/${RETRY_DELAYS_MS.length}`,
        );
      }
      return result;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof AnthropicError && RETRYABLE_STATUS.has(err.status);
      const willRetry = isRetryable && attempt < RETRY_DELAYS_MS.length - 1;

      console.warn(
        `[anthropic-retry-stream] ${context} attempt ${attempt + 1}/${RETRY_DELAYS_MS.length} failed`,
        JSON.stringify({
          status: err instanceof AnthropicError ? err.status : 'unknown',
          message: err instanceof Error ? err.message : String(err),
          retryable: isRetryable,
          willRetry,
        }),
      );

      if (!willRetry) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All retry attempts failed');
}
