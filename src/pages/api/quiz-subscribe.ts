import type { APIRoute } from 'astro';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
// Postmark reemplaza a Brevo (jul 2026). Ver _docs/que-rompimos-brevo-mailerlite.md.
// El opt-in vive en KV EMAILS. La segmentación por rol (PM/MSL/CR) vive en el record
// del KV — Postmark no maneja listas.

export const prerender = false;

// Etiquetas humanas para el rol que resulta del quiz. Usadas en el template welcome.
const ROLE_LABELS: Record<'PM' | 'MSL' | 'CR', string> = {
  PM: 'Product Manager',
  MSL: 'Medical Science Liaison',
  CR: 'Clinical Research',
};

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
 * Envía el welcome de Solca Insight vía Postmark, template welcome-solca-insight.
 * Fire-and-forget. Solo se llama en stage='complete' con un rol válido.
 * Si POSTMARK_SERVER_TOKEN no está configurado, salta silenciosamente.
 */
async function sendWelcomeQuiz(
  runtime: { env?: Record<string, unknown> } | undefined,
  email: string,
  firstName: string | undefined,
  role: 'PM' | 'MSL' | 'CR',
): Promise<void> {
  const token = runtime?.env?.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!token) {
    console.log('quiz-subscribe:postmark-skipped (no POSTMARK_SERVER_TOKEN)');
    return;
  }

  try {
    const result = await sendEmailWithTemplate(token, {
      from: 'Oscar Solís <hola@solcaciencia.com>',
      to: email,
      templateAlias: 'welcome-solca-insight',
      templateModel: {
        first_name: firstName ?? '',
        is_cv: false,
        is_quiz: true,
        role_label: ROLE_LABELS[role],
      },
      tag: 'welcome-quiz',
      metadata: { source: 'quiz-subscribe', role },
    });
    console.log('quiz-subscribe:postmark-sent', result.messageId, result.to, 'role:', role);
  } catch (err) {
    if (err instanceof PostmarkError) {
      console.error('Postmark send failed:', err.status, JSON.stringify(err.body));
    } else {
      console.error('Postmark unexpected error:', err);
    }
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

  // Métricas anónimas + welcome — solo en stage='complete' (cuando ya hay rol)
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
    waitUntil(
      sendWelcomeQuiz(
        runtime as { env?: Record<string, unknown> },
        email,
        // Postmark solo usa el primer nombre; name puede venir con nombre completo.
        name?.trim().split(/\s+/)[0],
        role,
      ).catch((err) => console.error('sendWelcomeQuiz failed', err)),
    );
  }

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
