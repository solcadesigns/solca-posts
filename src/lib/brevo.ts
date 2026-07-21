/**
 * DEPRECATED · 21 jul 2026
 * ----------------------------------------------------------------
 * Este archivo ya no se importa desde ningún endpoint. Reemplazado por
 * src/lib/postmark.ts. Ver _docs/que-rompimos-brevo-mailerlite.md para el
 * razonamiento (violación de política de consentimiento entre marcas + suspensión
 * de MailerLite por lista importada). Mantenido como referencia histórica.
 * Puede eliminarse tras verificar que ningún import quedó vivo.
 * ----------------------------------------------------------------
 *
 * Wrapper mínimo del cliente Brevo (ex-Sendinblue) REST API v3.
 * Reemplaza a src/lib/mailerlite.ts (cuenta MailerLite terminada 11 jul 2026).
 *
 * Docs: https://developers.brevo.com/reference/createcontact
 *
 * Diferencias clave vs MailerLite:
 * - Auth: header `api-key: <BREVO_API_KEY>` (no Bearer token).
 * - "Groups" → "Lists". Los list IDs son numéricos (int), no strings.
 * - "Fields" → "attributes". Los nombres de attribute van en MAYÚSCULAS.
 * - Upsert: pasar `updateEnabled: true` para actualizar si el contacto ya existe.
 */

const BREVO_BASE = 'https://api.brevo.com/v3';

export interface BrevoContactInput {
  email: string;
  attributes?: Record<string, string | number | boolean | undefined>;
  listIds?: number[];
  updateEnabled?: boolean;
  ext_id?: string;
  emailBlacklisted?: boolean;
  smsBlacklisted?: boolean;
}

export interface BrevoContact {
  id: number;
  email: string;
  emailBlacklisted?: boolean;
  smsBlacklisted?: boolean;
  createdAt?: string;
  modifiedAt?: string;
  attributes?: Record<string, unknown>;
  listIds?: number[];
}

export class BrevoError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'BrevoError';
  }
}

/**
 * Crea o actualiza un contacto en Brevo. Idempotente por email cuando
 * `updateEnabled: true` (default).
 *
 * Brevo responde 201 al crear un contacto nuevo, 204 al actualizar uno existente
 * (con `updateEnabled: true`), y 400 si el email ya existe y `updateEnabled` es false.
 *
 * Fire-and-forget seguro para opt-in de formulario.
 */
export async function upsertContact(
  apiKey: string,
  input: BrevoContactInput,
): Promise<{ ok: true; created: boolean; email: string }> {
  const body = {
    email: input.email.toLowerCase().trim(),
    attributes: input.attributes,
    listIds: input.listIds,
    updateEnabled: input.updateEnabled ?? true,
    ext_id: input.ext_id,
    emailBlacklisted: input.emailBlacklisted,
    smsBlacklisted: input.smsBlacklisted,
  };

  const res = await fetch(`${BREVO_BASE}/contacts`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  // 201 = creado; 204 = actualizado (con updateEnabled=true).
  if (res.status === 201 || res.status === 204) {
    return { ok: true, created: res.status === 201, email: body.email };
  }

  let errorBody: unknown;
  try {
    errorBody = await res.json();
  } catch {
    errorBody = await res.text();
  }
  throw new BrevoError(
    res.status,
    `Brevo upsert failed: ${res.status} ${res.statusText}`,
    errorBody,
  );
}

/**
 * Obtiene un contacto por email. Devuelve null si no existe (404).
 * Incluye los listIds actuales.
 *
 * Docs: https://developers.brevo.com/reference/getcontactinfo
 */
export async function getContact(
  apiKey: string,
  email: string,
): Promise<BrevoContact | null> {
  const normalizedEmail = encodeURIComponent(email.toLowerCase().trim());
  const res = await fetch(`${BREVO_BASE}/contacts/${normalizedEmail}`, {
    method: 'GET',
    headers: {
      'api-key': apiKey,
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
    throw new BrevoError(
      res.status,
      `Brevo getContact failed: ${res.status} ${res.statusText}`,
      errorBody,
    );
  }

  const data = (await res.json()) as BrevoContact;
  return data;
}

/**
 * Agrega un contacto existente a listas específicas sin tocar sus attributes.
 * Útil cuando el contacto ya está en Brevo y solo queremos asignarlo a un canal nuevo.
 *
 * Docs: https://developers.brevo.com/reference/addcontacttolist-1
 */
export async function addContactToList(
  apiKey: string,
  listId: number,
  emails: string[],
): Promise<{ contacts: { success: string[]; failure: string[] } }> {
  const res = await fetch(`${BREVO_BASE}/contacts/lists/${listId}/contacts/add`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ emails: emails.map((e) => e.toLowerCase().trim()) }),
  });

  if (!res.ok && res.status !== 201) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = await res.text();
    }
    throw new BrevoError(
      res.status,
      `Brevo addContactToList failed: ${res.status} ${res.statusText}`,
      errorBody,
    );
  }

  const data = (await res.json()) as { contacts: { success: string[]; failure: string[] } };
  return data;
}
