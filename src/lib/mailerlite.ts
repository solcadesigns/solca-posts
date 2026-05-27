/**
 * Wrapper mínimo del cliente MailerLite REST API.
 * Docs: https://developers.mailerlite.com/docs/subscribers.html#create-upsert-subscriber
 */

const MAILERLITE_BASE = 'https://connect.mailerlite.com/api';

export interface MailerLiteSubscriberInput {
  email: string;
  fields?: Record<string, string | undefined>;
  groups?: string[]; // array de group IDs
  status?: 'active' | 'unsubscribed' | 'unconfirmed' | 'bounced' | 'junk';
  ip_address?: string;
  subscribed_at?: string;
}

export interface MailerLiteSubscriber {
  id: string;
  email: string;
  status: string;
  fields?: Record<string, unknown>;
  groups?: Array<{ id: string; name?: string }>;
}

export class MailerLiteError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'MailerLiteError';
  }
}

/**
 * Crea o actualiza un subscriber. Idempotente por email — si ya existe, lo actualiza.
 * Devuelve el subscriber resultante.
 */
export async function upsertSubscriber(
  apiKey: string,
  input: MailerLiteSubscriberInput,
): Promise<MailerLiteSubscriber> {
  const body = {
    email: input.email.toLowerCase().trim(),
    fields: input.fields,
    groups: input.groups,
    status: input.status ?? 'active',
    ip_address: input.ip_address,
    subscribed_at: input.subscribed_at,
  };

  const res = await fetch(`${MAILERLITE_BASE}/subscribers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = await res.text();
    }
    throw new MailerLiteError(
      res.status,
      `MailerLite upsert failed: ${res.status} ${res.statusText}`,
      errorBody,
    );
  }

  const data = (await res.json()) as { data: MailerLiteSubscriber };
  return data.data;
}

/**
 * Obtiene un subscriber por email. Devuelve null si no existe (404).
 * Incluye los grupos en los que está actualmente.
 */
export async function getSubscriber(
  apiKey: string,
  email: string,
): Promise<MailerLiteSubscriber | null> {
  const normalizedEmail = encodeURIComponent(email.toLowerCase().trim());
  const res = await fetch(`${MAILERLITE_BASE}/subscribers/${normalizedEmail}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = await res.text();
    }
    throw new MailerLiteError(
      res.status,
      `MailerLite getSubscriber failed: ${res.status} ${res.statusText}`,
      errorBody,
    );
  }

  const data = (await res.json()) as { data: MailerLiteSubscriber };
  return data.data;
}
