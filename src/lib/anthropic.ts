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

/** Helper: extract text from Anthropic response content blocks */
export function extractText(response: AnthropicResponse): string {
  return response.content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text as string)
    .join('');
}
