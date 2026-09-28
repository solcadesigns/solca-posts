import type { APIRoute } from 'astro';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { extractUtms, UTM_KEYS } from '../../lib/utm';
// Postmark reemplaza a Brevo (jul 2026). Ver _docs/que-rompimos-brevo-mailerlite.md.
// El opt-in vive en KV EMAILS. La segmentación por rol (PM/MSL/CR/FV/Consulting) vive en el record
// del KV — Postmark no maneja listas.

export const prerender = false;

// Roles del quiz. Ampliado 2026-09-28: se añaden Farmacovigilancia (FV) y
// Life Sciences Consulting (Consulting) al quiz-rol. Los 3 primeros tienen
// libro publicado en Hotmart; FV y Consulting apuntan al Simulador con
// módulo pre-seleccionado mientras se publican sus libros (roadmap editorial
// 2026Q4-2027Q1).
type QuizRole = 'PM' | 'MSL' | 'CR' | 'FV' | 'Consulting';

// Etiquetas humanas para el rol que resulta del quiz. Usadas en el template welcome.
const ROLE_LABELS: Record<QuizRole, string> = {
  PM: 'Project Manager clínico',
  MSL: 'Medical Science Liaison',
  CR: 'Clinical Research',
  FV: 'Farmacovigilancia',
  Consulting: 'Life Sciences Consulting',
};

interface QuizSubscribeRequest {
  email: string;
  name?: string;
  role?: QuizRole;
  scores?: Partial<Record<QuizRole, number>>;
  country?: string;
  consent?: boolean;
  stage?: 'gate' | 'complete';
  selfMatch?: QuizRole | 'NS';
  // UTMs opcionales: los agrega el cliente desde window.__utm (P1 sprint 2026-08-18).
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set<string>(['PM', 'MSL', 'CR', 'FV', 'Consulting']);
const VALID_SELF_MATCH = new Set<string>(['PM', 'MSL', 'CR', 'FV', 'Consulting', 'NS']);

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
  role: QuizRole,
): Promise<void> {
  const token = runtime?.env?.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!token) {
    console.log('quiz-subscribe:postmark-skipped (no POSTMARK_SERVER_TOKEN)');
    return;
  }

  // CTA · próximo paso concreto según rol. Añadido 2026-09-28.
  // Contexto: reporte semanal mostró welcome-quiz con 12.5% CTR vs
  // welcome-cv con 78.6%. El welcome-cv tiene CTA claro; el de quiz no.
  // Le pasamos al template una URL del simulador (o del libro) con
  // pre-selección del rol y UTM para atribuir el clic.
  //
  // El template `welcome-solca-insight` en Postmark debe usar estos
  // campos nuevos: {{cta_url}}, {{cta_label}}, {{role_next_step}}.
  const CTA_BY_ROLE: Record<QuizRole, { label: string; next: string; module: string }> = {
    PM: {
      label: 'Practica preguntas de Project Manager clínico',
      next: 'Simulador con módulo PM clínico: 5 preguntas de screening (freemium, sin costo).',
      module: 'pm',
    },
    MSL: {
      label: 'Practica preguntas de MSL',
      next: 'Simulador con módulo MSL: 5 preguntas de screening (freemium, sin costo).',
      module: 'msl',
    },
    CR: {
      label: 'Practica preguntas de Clinical Research',
      next: 'Simulador con módulo Clinical Research: 5 preguntas de screening (freemium, sin costo).',
      module: 'cr',
    },
    FV: {
      label: 'Practica preguntas de Farmacovigilancia',
      next: 'Simulador con módulo Farmacovigilancia: 5 preguntas de screening en CRO/BPO (freemium, sin costo).',
      module: 'fv',
    },
    Consulting: {
      label: 'Practica preguntas de Life Sciences Consulting',
      next: 'Simulador con módulo Strategy Consulting: preguntas de case interview + fit típicas en pharma consulting (freemium, sin costo).',
      module: 'strategy-consulting',
    },
  };
  const ctaCfg = CTA_BY_ROLE[role];
  const ctaUrl =
    `https://solcaciencia.com/simulador-entrevistas/` +
    `?modulo=${ctaCfg.module}` +
    `&utm_source=email&utm_medium=welcome-quiz` +
    `&utm_campaign=welcome-quiz-cta&utm_content=rol-${ctaCfg.module}`;

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
        // Nuevos campos para el CTA — el template de Postmark debe usarlos.
        cta_url: ctaUrl,
        cta_label: ctaCfg.label,
        role_next_step: ctaCfg.next,
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

  // Extraer UTMs del body (los pone el cliente desde window.__utm).
  // Server-side sanitiza (allow-list + truncado); no confiamos en input crudo.
  const utms = extractUtms(body as unknown as Record<string, unknown>);

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
    ...utms,
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
      // Solo utm_campaign en el metric anónimo — suficiente para atribución
      // de conversión en weekly-report. Source/medium quedan solo en el
      // record de EMAILS (que ya tiene PII como email).
      utm_campaign: utms.utm_campaign,
      utm_source: utms.utm_source,
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
