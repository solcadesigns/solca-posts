/**
 * Correo único de aviso de privacidad y reconfirmación (legado España) · 2 nov 2026.
 *
 * Envío: /api/aviso-privacidad-2026-11 (POST, x-broadcast-secret). Confirmación: /api/confirmar-correos.
 * La firma usa el mismo esquema que drip-unsubscribe (HMAC-SHA256 base64url con DRIP_UNSUB_SECRET), pero sobre
 * `reconfirmacion-es:<email>` para que una firma de baja no sirva como firma de alta ni al revés.
 */

import { hmacSignEmail, hmacVerifyEmail, siteOrigin } from './drip';

export const AVISO_CAMPAIGN = 'aviso-privacidad-2026-11';
/** Alias de la plantilla de Postmark y tag de medición (aperturas y clics por tag). */
export const AVISO_TEMPLATE_ALIAS = AVISO_CAMPAIGN;
export const AVISO_TAG = AVISO_CAMPAIGN;
export const RECONFIRM_FORM = 'reconfirmacion-es' as const;
/** Marca de idempotencia en KV EMAILS: `reconfirm:<email>`. */
export const RECONFIRM_MARKER_PREFIX = 'reconfirm:';

const SIG_DOMAIN = 'reconfirmacion-es:';

export async function signReconfirm(secret: string, email: string): Promise<string> {
  return hmacSignEmail(secret, SIG_DOMAIN + email.toLowerCase().trim());
}

export async function verifyReconfirm(secret: string, email: string, sig: string): Promise<boolean> {
  return hmacVerifyEmail(secret, SIG_DOMAIN + email.toLowerCase().trim(), sig);
}

export async function buildConfirmUrl(
  env: Record<string, unknown> | undefined,
  email: string,
  secret: string,
): Promise<string> {
  const e = email.toLowerCase().trim();
  const params = new URLSearchParams({ email: e, sig: await signReconfirm(secret, e) });
  return `${siteOrigin(env)}/api/confirmar-correos?${params.toString()}`;
}
