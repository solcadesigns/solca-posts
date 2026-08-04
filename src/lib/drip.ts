/**
 * src/lib/drip.ts · Helpers del drip de bienvenida Postmark.
 *
 * Piezas expuestas:
 *   - DRIP_STEPS: días desde registro en los que envía cada email (3, 7, 12, 20).
 *   - hmacSignEmail: firma un email con HMAC-SHA256 para el link de baja.
 *   - hmacVerifyEmail: valida la firma que llega en /api/drip-unsubscribe.
 *   - buildUnsubUrl: arma el URL absoluto que va en templateModel.unsub_url.
 *   - hasRecentBlogBroadcast: consulta Postmark Messages API para saber si un
 *     recipient recibió blog-broadcast en las últimas N horas. Usado para skip
 *     anti-fatiga (ventana 48h).
 *   - templateAliasFor: convierte (track, step) → alias Postmark canonical.
 */

export const DRIP_STEPS = [3, 7, 12, 20] as const;
export type DripStep = typeof DRIP_STEPS[number];
export type DripTrack = 'cv' | 'quiz';

/**
 * Base URL del sitio para armar links absolutos. Se puede sobreescribir por env.
 */
export function siteOrigin(env: Record<string, unknown> | undefined): string {
  const fromEnv = env?.SITE_ORIGIN as string | undefined;
  return fromEnv?.replace(/\/+$/, '') ?? 'https://solcaciencia.com';
}

/**
 * HMAC-SHA256 base64url del email con el secret. La comparación se hace
 * timing-safe en hmacVerifyEmail.
 */
export async function hmacSignEmail(secret: string, email: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(email.toLowerCase().trim()));
  return base64UrlEncode(new Uint8Array(sig));
}

export async function hmacVerifyEmail(
  secret: string,
  email: string,
  expected: string,
): Promise<boolean> {
  if (!expected || typeof expected !== 'string') return false;
  const computed = await hmacSignEmail(secret, email);
  return timingSafeEqualStr(computed, expected);
}

/**
 * URL absoluto para el link de baja del drip. Va en templateModel.unsub_url y
 * el template lo pinta como "no quiero recibir más de estos".
 */
export async function buildUnsubUrl(
  env: Record<string, unknown> | undefined,
  email: string,
  secret: string,
): Promise<string> {
  const sig = await hmacSignEmail(secret, email);
  const params = new URLSearchParams({ email: email.toLowerCase().trim(), sig });
  return `${siteOrigin(env)}/api/drip-unsubscribe?${params.toString()}`;
}

/**
 * Consulta Postmark Messages API por recipient + tag. Retorna true si hubo al
 * menos un envío en las últimas `hoursBack` horas. Falla-abierta: si el token
 * no está o la API falla, retorna false (o sea, no bloquea el drip).
 *
 * Postmark Messages API doc:
 * https://postmarkapp.com/developer/api/messages-api#outbound-message-search
 */
export async function hasRecentTagForRecipient(
  token: string | undefined,
  email: string,
  tag: string,
  hoursBack: number,
): Promise<boolean> {
  if (!token) return false;
  const from = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const params = new URLSearchParams({
    recipient: email.toLowerCase().trim(),
    tag,
    fromdate: from.toISOString().slice(0, 19).replace('T', ' '),
    count: '1',
    offset: '0',
  });
  try {
    const res = await fetch(
      `https://api.postmarkapp.com/messages/outbound?${params.toString()}`,
      {
        headers: {
          'X-Postmark-Server-Token': token,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) return false;
    const body = (await res.json()) as {
      Messages?: Array<{ MessageID?: string }>;
      TotalCount?: number;
    };
    return (body.TotalCount ?? 0) > 0 || (body.Messages ?? []).length > 0;
  } catch {
    return false;
  }
}

/**
 * Alias del template Postmark que corresponde a (track, step).
 * Templates a crear en Postmark dashboard con exactos estos alias.
 */
export function templateAliasFor(track: DripTrack, step: DripStep): string {
  return `drip-${track}-d${step}`;
}

/**
 * Nombre humano de rol pharma. Duplica ROLE_LABELS de quiz-subscribe.ts a
 * propósito para no crear import cíclico con endpoints (drip vive en /lib/).
 */
export const DRIP_ROLE_LABELS: Record<'PM' | 'MSL' | 'CR', string> = {
  PM: 'Product Manager',
  MSL: 'Medical Science Liaison',
  CR: 'Clinical Research',
};

// ── Helpers internos ─────────────────────────────────────────────────────

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
