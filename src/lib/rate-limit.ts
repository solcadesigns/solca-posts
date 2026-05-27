/**
 * Rate limiting por email vía Cloudflare KV.
 * Default: 2 análisis por email cada 30 días.
 */

const DEFAULT_MAX_SUBMISSIONS = 2;
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 días

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface RateLimitState {
  count: number;
  firstAt: string;
  lastAt: string;
}

export interface RateLimitCheck {
  allowed: boolean;
  count: number;
  max: number;
  resetInDays: number;
  state?: RateLimitState;
}

/**
 * Verifica si el email puede enviar otro CV.
 * No incrementa; solo lee.
 */
export async function checkCvSubmitLimit(
  kv: KVNamespace | undefined,
  email: string,
  options?: { max?: number; ttlSeconds?: number },
): Promise<RateLimitCheck> {
  const max = options?.max ?? DEFAULT_MAX_SUBMISSIONS;
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  if (!kv) {
    // Sin KV configurado: permite todo (modo desarrollo o pre-launch)
    return { allowed: true, count: 0, max, resetInDays: 0 };
  }

  const hash = await sha256Hex(email.toLowerCase().trim());
  const key = `cv-submit:${hash.slice(0, 24)}`;
  const raw = await kv.get(key);

  if (!raw) {
    return { allowed: true, count: 0, max, resetInDays: ttlSeconds / 86400 };
  }

  try {
    const state = JSON.parse(raw) as RateLimitState;
    const firstAtMs = new Date(state.firstAt).getTime();
    const ageSeconds = (Date.now() - firstAtMs) / 1000;
    const resetInSeconds = Math.max(0, ttlSeconds - ageSeconds);
    return {
      allowed: state.count < max,
      count: state.count,
      max,
      resetInDays: Math.ceil(resetInSeconds / 86400),
      state,
    };
  } catch {
    // Corrupt state, allow fresh start
    return { allowed: true, count: 0, max, resetInDays: ttlSeconds / 86400 };
  }
}

/**
 * Incrementa el contador del email. Llama después de un análisis exitoso.
 */
export async function incrementCvSubmitCount(
  kv: KVNamespace | undefined,
  email: string,
  options?: { ttlSeconds?: number },
): Promise<void> {
  if (!kv) return;
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  const hash = await sha256Hex(email.toLowerCase().trim());
  const key = `cv-submit:${hash.slice(0, 24)}`;
  const now = new Date().toISOString();

  const raw = await kv.get(key);
  let state: RateLimitState;
  if (raw) {
    try {
      state = JSON.parse(raw) as RateLimitState;
      state.count += 1;
      state.lastAt = now;
    } catch {
      state = { count: 1, firstAt: now, lastAt: now };
    }
  } else {
    state = { count: 1, firstAt: now, lastAt: now };
  }

  try {
    await kv.put(key, JSON.stringify(state), { expirationTtl: ttlSeconds });
  } catch (err) {
    console.error('Rate limit KV put failed:', err);
  }
}
