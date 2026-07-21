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
  } = options;

  const body = {
    model,
    system,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
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
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 529]);
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
