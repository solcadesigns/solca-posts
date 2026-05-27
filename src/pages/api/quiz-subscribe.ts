import type { APIRoute } from 'astro';
import { upsertSubscriber, getSubscriber, MailerLiteError } from '../../lib/mailerlite';

export const prerender = false;

// Group IDs en MailerLite
const ML_GROUP_NEWSLETTER = '187298307658220675';
const ML_GROUP_MATCH = {
  PM: '187300443631650371',
  MSL: '187300457000994034',
  CR: '187300467766723597',
} as const;

interface QuizSubscribeRequest {
  email: string;
  name?: string;
  role?: 'PM' | 'MSL' | 'CR';
  scores?: { PM: number; MSL: number; CR: number };
  country?: string;
  consent?: boolean;
  stage?: 'gate' | 'complete';
  selfMatch?: 'PM' | 'MSL' | 'CR' | 'NS';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set(['PM', 'MSL', 'CR']);
const VALID_SELF_MATCH = new Set(['PM', 'MSL', 'CR', 'NS']);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function storeQuizLead(
  runtime: { env?: Record<string, unknown> } | undefined,
  record: Record<string, unknown>,
): Promise<void> {
  const kv = runtime?.env?.EMAILS as KVNamespace | undefined;
  if (kv && typeof kv.put === 'function') {
    const key = `quiz:${record.ts}:${(record.email as string).toLowerCase()}`;
    try {
      await kv.put(key, JSON.stringify(record));
    } catch (err) {
      console.error('KV put (quiz) failed:', err);
    }
  } else {
    console.log('quiz-subscribe:lead-captured', JSON.stringify(record));
  }
}

/**
 * Escribe un registro anónimo de métricas (sin PII) a la KV QUIZ_METRICS.
 * No incluye email, name, ni IP. Solo datos agregables: rol, self-match, scores, country, ts.
 * Se llama solo en stage='complete'.
 */
async function storeQuizMetric(
  runtime: { env?: Record<string, unknown> } | undefined,
  anonRecord: Record<string, unknown>,
): Promise<void> {
  const kv = runtime?.env?.QUIZ_METRICS as KVNamespace | undefined;
  if (!kv || typeof kv.put !== 'function') {
    console.log('quiz-subscribe:metric-skipped (no QUIZ_METRICS KV)', JSON.stringify(anonRecord));
    return;
  }
  // Key con timestamp + random suffix para evitar colisión (timestamp ms no es único bajo carga)
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `m:${anonRecord.ts}:${rand}`;
  try {
    await kv.put(key, JSON.stringify(anonRecord));
  } catch (err) {
    console.error('KV put (metric) failed:', err);
  }
}

async function addToMailerLite(
  runtime: { env?: Record<string, unknown> } | undefined,
  email: string,
  name: string | undefined,
  role: 'PM' | 'MSL' | 'CR' | undefined,
  country: string | undefined,
  ip: string | null,
  stage: 'gate' | 'complete',
): Promise<void> {
  const apiKey = runtime?.env?.MAILERLITE_API_KEY as string | undefined;
  if (!apiKey) {
    console.log('quiz-subscribe:mailerlite-skipped (no API key configured)');
    return;
  }

  // Determinar grupos según stage
  let groups: string[];
  if (stage === 'gate') {
    // Inicial: solo newsletter general · capturamos el lead aunque abandonen el quiz
    groups = [ML_GROUP_NEWSLETTER];
  } else {
    // Complete: añadir al grupo del rol específico para disparar la welcome sequence
    if (!role) {
      console.error('addToMailerLite stage=complete sin role');
      return;
    }

    // ============ Retake guard ============
    // Si el subscriber ya está en CUALQUIER grupo Quiz·Match·* (porque ya tomó el quiz antes),
    // NO lo metemos al nuevo grupo de rol. Esto evita que un retake con resultado distinto
    // dispare una segunda welcome sequence encima de la que ya está corriendo o ya completó.
    // Solo aseguramos que sigan en Newsletter.
    const allMatchGroups = new Set<string>(Object.values(ML_GROUP_MATCH));
    let alreadyInMatchGroup = false;
    try {
      const existing = await getSubscriber(apiKey, email);
      if (existing?.groups?.length) {
        alreadyInMatchGroup = existing.groups.some((g) => allMatchGroups.has(g.id));
      }
    } catch (err) {
      // Si el lookup falla, NO bloqueamos — proceder con el insert normal.
      console.warn('quiz-subscribe:getSubscriber-failed (proceeding without guard)', err);
    }

    if (alreadyInMatchGroup) {
      console.log(
        `quiz-subscribe:retake-skipped email=${email} role=${role} (ya está en otro grupo Quiz·Match)`,
      );
      // Solo aseguramos Newsletter, no agregamos rol nuevo
      groups = [ML_GROUP_NEWSLETTER];
    } else {
      groups = [ML_GROUP_MATCH[role], ML_GROUP_NEWSLETTER];
    }
  }

  const fields: Record<string, string> = {};
  if (name) fields.name = name;
  if (country) fields.country = country;

  try {
    const sub = await upsertSubscriber(apiKey, {
      email,
      groups,
      fields: Object.keys(fields).length > 0 ? fields : undefined,
      ip_address: ip ?? undefined,
      subscribed_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      status: 'active',
    });
    console.log(`quiz-subscribe:mailerlite-upserted stage=${stage}`, sub.id, sub.email, 'role:', role ?? 'n/a');
  } catch (err) {
    if (err instanceof MailerLiteError) {
      console.error('MailerLite upsert failed:', err.status, JSON.stringify(err.body));
    } else {
      console.error('MailerLite unexpected error:', err);
    }
  }
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let body: QuizSubscribeRequest;
  try {
    body = (await request.json()) as QuizSubscribeRequest;
  } catch {
    return jsonResponse({ error: 'invalid_json', message: 'Body inválido' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const name = body.name?.trim();
  const country = body.country?.trim();
  const consent = body.consent === true;
  const role = body.role;
  const scores = body.scores;
  const stage = body.stage ?? 'gate';
  const selfMatch = body.selfMatch && VALID_SELF_MATCH.has(body.selfMatch) ? body.selfMatch : undefined;

  if (!consent) {
    return jsonResponse(
      { error: 'consent_required', message: 'Debes aceptar la política de datos.' },
      400,
    );
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse(
      { error: 'invalid_email', message: 'Email inválido.' },
      400,
    );
  }
  if (stage === 'gate') {
    if (!name || name.length < 2 || name.length > 80) {
      return jsonResponse(
        { error: 'invalid_name', message: 'Nombre inválido.' },
        400,
      );
    }
  }
  if (stage === 'complete') {
    if (!role || !VALID_ROLES.has(role)) {
      return jsonResponse(
        { error: 'invalid_role', message: 'Rol no reconocido.' },
        400,
      );
    }
  }

  const runtime = (locals as {
    runtime?: {
      env?: Record<string, unknown>;
      ctx?: { waitUntil?: (p: Promise<unknown>) => void };
    };
  }).runtime;
  const ctx = runtime?.ctx;
  const waitUntil = ctx?.waitUntil?.bind(ctx) ?? ((p: Promise<unknown>) => p);
  const ip = clientAddress ?? request.headers.get('cf-connecting-ip');

  const record: Record<string, unknown> = {
    source: 'quiz',
    stage,
    email,
    name,
    role,
    scores,
    country: country?.toLowerCase(),
    ip,
    ts: new Date().toISOString(),
  };

  waitUntil(
    storeQuizLead(runtime as { env?: Record<string, unknown> }, { ...record, selfMatch }).catch((err) =>
      console.error('storeQuizLead failed', err),
    ),
  );

  // Métricas anónimas — solo en stage='complete' (cuando ya hay rol)
  if (stage === 'complete' && role) {
    const anonMetric: Record<string, unknown> = {
      ts: record.ts,
      role,
      scores,
      selfMatch,
      country: country?.toLowerCase(),
    };
    waitUntil(
      storeQuizMetric(runtime as { env?: Record<string, unknown> }, anonMetric).catch((err) =>
        console.error('storeQuizMetric failed', err),
      ),
    );
  }

  waitUntil(
    addToMailerLite(
      runtime as { env?: Record<string, unknown> },
      email,
      name,
      role,
      country,
      ip,
      stage,
    ).catch((err) => console.error('addToMailerLite (quiz) failed', err)),
  );

  return jsonResponse(
    {
      ok: true,
      stage,
      message:
        stage === 'gate'
          ? 'Suscrito al newsletter. Continúa con el quiz.'
          : 'Resultado guardado. Revisa tu email en minutos.',
    },
    200,
  );
};
