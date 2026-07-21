/**
 * Wrapper mínimo del cliente Postmark REST API.
 * Reemplaza a src/lib/brevo.ts (jul 2026 · migración por incumplimiento de política
 * de consentimiento entre marcas — ver _docs/que-rompimos-brevo-mailerlite.md).
 *
 * Docs: https://postmarkapp.com/developer/api/email-api
 *
 * Diferencias vs Brevo:
 * - Postmark es transaccional puro: NO maneja "listas" ni workflows visuales.
 * - El opt-in se guarda en Cloudflare KV (nuestro source of truth).
 * - El envío es on-demand: cada llamada envía UN email.
 * - Segmentación por rol la maneja nuestro código, no el proveedor.
 * - Templates en Postmark se referencian por alias o ID; el modelo va en JSON.
 *
 * Test mode: si la cuenta Postmark está en Test mode, solo puede enviar a
 * direcciones verificadas (sender signatures). Para producción hay que solicitar
 * approval desde la UI de Postmark.
 */

const POSTMARK_BASE = 'https://api.postmarkapp.com';

export interface PostmarkEmailInput {
  to: string;
  from: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  tag?: string;
  metadata?: Record<string, string>;
  messageStream?: string; // default 'outbound' (transactional)
}

export interface PostmarkTemplateInput {
  to: string;
  from: string;
  templateAlias?: string;
  templateId?: number;
  templateModel: Record<string, unknown>;
  tag?: string;
  metadata?: Record<string, string>;
  messageStream?: string;
}

export interface PostmarkSuccess {
  ok: true;
  messageId: string;
  submittedAt: string;
  to: string;
}

export class PostmarkError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'PostmarkError';
  }
}

/**
 * Envía un email transaccional inline (sin template).
 *
 * Fire-and-forget seguro. Si el token no está, salta silenciosamente y loguea.
 * En Test mode solo entrega a direcciones que estén como Sender Signatures.
 */
export async function sendEmail(
  token: string,
  input: PostmarkEmailInput,
): Promise<PostmarkSuccess> {
  if (!input.htmlBody && !input.textBody) {
    throw new PostmarkError(0, 'sendEmail requires htmlBody or textBody');
  }

  const body: Record<string, unknown> = {
    From: input.from,
    To: input.to.toLowerCase().trim(),
    Subject: input.subject,
    MessageStream: input.messageStream ?? 'outbound',
  };
  if (input.htmlBody) body.HtmlBody = input.htmlBody;
  if (input.textBody) body.TextBody = input.textBody;
  if (input.tag) body.Tag = input.tag;
  if (input.metadata) body.Metadata = input.metadata;

  const res = await fetch(`${POSTMARK_BASE}/email`, {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    ErrorCode?: number;
    Message?: string;
    MessageID?: string;
    SubmittedAt?: string;
    To?: string;
  };

  if (!res.ok || (data.ErrorCode && data.ErrorCode !== 0)) {
    throw new PostmarkError(
      res.status,
      `Postmark sendEmail failed: ${res.status} ${data.Message ?? res.statusText}`,
      data,
    );
  }

  return {
    ok: true,
    messageId: data.MessageID ?? '',
    submittedAt: data.SubmittedAt ?? '',
    to: data.To ?? input.to,
  };
}

/**
 * Envía un email usando un template guardado en Postmark.
 * Los templates permiten separar contenido de código y editarlos sin redeploy.
 *
 * Docs: https://postmarkapp.com/developer/api/templates-api
 */
export async function sendEmailWithTemplate(
  token: string,
  input: PostmarkTemplateInput,
): Promise<PostmarkSuccess> {
  if (!input.templateAlias && !input.templateId) {
    throw new PostmarkError(
      0,
      'sendEmailWithTemplate requires templateAlias or templateId',
    );
  }

  const body: Record<string, unknown> = {
    From: input.from,
    To: input.to.toLowerCase().trim(),
    TemplateModel: input.templateModel,
    MessageStream: input.messageStream ?? 'outbound',
  };
  if (input.templateAlias) body.TemplateAlias = input.templateAlias;
  if (input.templateId) body.TemplateId = input.templateId;
  if (input.tag) body.Tag = input.tag;
  if (input.metadata) body.Metadata = input.metadata;

  const res = await fetch(`${POSTMARK_BASE}/email/withTemplate`, {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    ErrorCode?: number;
    Message?: string;
    MessageID?: string;
    SubmittedAt?: string;
    To?: string;
  };

  if (!res.ok || (data.ErrorCode && data.ErrorCode !== 0)) {
    throw new PostmarkError(
      res.status,
      `Postmark sendEmailWithTemplate failed: ${res.status} ${data.Message ?? res.statusText}`,
      data,
    );
  }

  return {
    ok: true,
    messageId: data.MessageID ?? '',
    submittedAt: data.SubmittedAt ?? '',
    to: data.To ?? input.to,
  };
}
