/**
 * Wrapper mínimo del cliente Anthropic (Claude).
 * Usa fetch nativo de Workers, sin SDK para mantener bundle pequeño y zero deps.
 *
 * Docs: https://docs.anthropic.com/en/api/messages
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  apiKey: string;
  /** Default: claude-haiku-4-5-20251001 */
  model?: string;
  /** System prompt (top-level, no se manda como mensaje) */
  system: string;
  messages: ChatMessage[];
  /** 0..1, default 0.3 para outputs estructurados */
  temperature?: number;
  /** Required. Default 4000 */
  maxTokens?: number;
  /**
   * Timeout del fetch a Anthropic en milisegundos. Default 85000 (85s) para
   * dejar margen antes del gateway timeout de Cloudflare (100s). Si el fetch
   * excede este timeout, se aborta y se lanza AnthropicError con status 524
   * (retryable). Agregado 2 sept 2026 tras sesión 27d9355c.
   */
  timeoutMs?: number;
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  model: string;
  content: Array<{ type: string; text?: string }>;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'AnthropicError';
  }
}

export async function chatCompletion(
  options: ChatCompletionOptions,
): Promise<AnthropicResponse> {
  const {
    apiKey,
    model = 'claude-haiku-4-5-20251001',
    system,
    messages,
    temperature = 0.3,
    maxTokens = 4000,
    timeoutMs = 85000, // 85s · deja margen contra el gateway timeout de Cloudflare (100s)
  } = options;

  const body = {
    model,
    system,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

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
        'x-api-key': apiKey,
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

  return (await response.json()) as AnthropicResponse;
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

export async function retryableChatCompletion(
  options: ChatCompletionOptions,
  context = 'unknown',
): Promise<AnthropicResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    try {
      const result = await chatCompletion(options);
      if (attempt > 0) {
        console.warn(
          `[anthropic-retry] ${context} succeeded on attempt ${attempt + 1}/${RETRY_DELAYS_MS.length}`,
        );
      }
      return result;
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof AnthropicError && RETRYABLE_STATUS.has(err.status);
      const willRetry = isRetryable && attempt < RETRY_DELAYS_MS.length - 1;

      console.warn(
        `[anthropic-retry] ${context} attempt ${attempt + 1}/${RETRY_DELAYS_MS.length} failed`,
        JSON.stringify({
          status: err instanceof AnthropicError ? err.status : 'unknown',
          message: err instanceof Error ? err.message : String(err),
          retryable: isRetryable,
          willRetry,
        }),
      );

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
    model = 'claude-haiku-4-5-20251001',
    system,
    messages,
    temperature = 0.3,
    maxTokens = 4000,
    timeoutMs = 180000, // 180s · con streaming Cloudflare no corta, así que más margen
  } = options;

  const body = {
    model,
    system,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

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
  return {
    id: messageMeta.id ?? '',
    type: messageMeta.type ?? 'message',
    role: messageMeta.role ?? 'assistant',
    model: messageMeta.model ?? model,
    content: [{ type: 'text', text: fullText }],
    stop_reason: messageMeta.stop_reason ?? 'end_turn',
    usage: messageMeta.usage ?? { input_tokens: 0, output_tokens: 0 },
  };
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
