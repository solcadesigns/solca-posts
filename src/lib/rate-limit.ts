/**
 * Rate limiting por email vía Cloudflare KV.
 * Default: 2 análisis por email cada 30 días.
 *
 * 13 nov 2026: la ventana de 30 días se cuenta desde el PRIMER análisis (`firstAt`), que es lo que dice el
 * mensaje y el curso ("2 análisis por correo cada 30 días"). Antes el TTL se reiniciaba en cada análisis y el
 * bloqueo duraba 30 días después del segundo, mientras el aviso calculaba los días desde el primero (podía decir
 * "~0 días" estando bloqueado). La llave sigue viviendo 30 días desde el último análisis (TTL deslizante) porque
 * `cv-waitlist.ts` la usa como prueba de un análisis reciente; la regla del cupo la decide `firstAt`.
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
  /** ISO del momento en que se libera el cupo (firstAt + ventana). Solo cuando hay un análisis en la ventana. */
  resetAt?: string;
  state?: RateLimitState;
}

/** ¿La ventana que abrió `firstAt` ya terminó? (estado ilegible = terminada). */
function ventanaVencida(state: RateLimitState, ttlSeconds: number, now = Date.now()): boolean {
  const firstAtMs = new Date(state.firstAt).getTime();
  return !Number.isFinite(firstAtMs) || now - firstAtMs >= ttlSeconds * 1000;
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
    // Ventana vencida: el cupo ya se liberó aunque la llave siga viva (TTL deslizante).
    if (ventanaVencida(state, ttlSeconds)) {
      return { allowed: true, count: 0, max, resetInDays: ttlSeconds / 86400, state };
    }
    const resetAtMs = new Date(state.firstAt).getTime() + ttlSeconds * 1000;
    const resetInSeconds = Math.max(0, (resetAtMs - Date.now()) / 1000);
    return {
      allowed: state.count < max,
      count: state.count,
      max,
      resetInDays: Math.max(1, Math.ceil(resetInSeconds / 86400)),
      resetAt: new Date(resetAtMs).toISOString(),
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
      if (ventanaVencida(state, ttlSeconds)) {
        // Ventana nueva: este análisis es el primero de los siguientes 30 días.
        state = { count: 1, firstAt: now, lastAt: now };
      } else {
        state.count += 1;
        state.lastAt = now;
      }
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
