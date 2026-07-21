import type { APIRoute } from 'astro';
import { CV_REVIEW_SYSTEM_PROMPT } from '../../lib/cv-review-prompt';
import { chatCompletion, extractText, AnthropicError } from '../../lib/anthropic';
import { checkCvSubmitLimit, incrementCvSubmitCount } from '../../lib/rate-limit';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
// Postmark reemplaza a Brevo (jul 2026). Ver _docs/que-rompimos-brevo-mailerlite.md.

export const prerender = false;

interface CVReviewRequest {
  cv: string;
  email: string;
  country?: string;
  consent?: boolean;
}

interface Observacion {
  categoria: string;
  evaluacion: string;
  recomendacion: string;
}

interface CVReviewResult {
  candidateName: string;
  retroalimentacion: string;
  observaciones: Observacion[];
}

const MIN_CV_LENGTH = 200;
const MAX_CV_LENGTH = 15_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * Envía el welcome de Solca Insight vía Postmark, template welcome-solca-insight.
 * Fire-and-forget. Si POSTMARK_SERVER_TOKEN no está configurado, salta silenciosamente.
 * El template soporta la rama is_cv (this endpoint) y is_quiz (quiz-subscribe.ts).
 */
async function sendWelcomeCv(
  runtime: { env?: Record<string, unknown> } | undefined,
  email: string,
  firstName: string | undefined,
): Promise<void> {
  const token = runtime?.env?.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!token) {
    console.log('cv-review:postmark-skipped (no POSTMARK_SERVER_TOKEN)');
    return;
  }

  try {
    const result = await sendEmailWithTemplate(token, {
      from: 'Oscar Solís <hola@solcaciencia.com>',
      to: email,
      templateAlias: 'welcome-solca-insight',
      templateModel: {
        first_name: firstName ?? '',
        is_cv: true,
        is_quiz: false,
        role_label: '',
      },
      tag: 'welcome-cv',
      metadata: { source: 'cv-review' },
    });
    console.log('cv-review:postmark-sent', result.messageId, result.to);
  } catch (err) {
    if (err instanceof PostmarkError) {
      console.error('Postmark send failed:', err.status, JSON.stringify(err.body));
    } else {
      console.error('Postmark unexpected error:', err);
    }
  }
}

async function storeEmail(
  runtime: { env?: Record<string, unknown> } | undefined,
  email: string,
  country: string | undefined,
  ip: string | null,
): Promise<void> {
  // Si hay KV namespace `EMAILS` configurado, guardamos. Si no, log a console (visible vía `wrangler tail`).
  const kv = runtime?.env?.EMAILS as KVNamespace | undefined;
  const record = {
    email: email.toLowerCase().trim(),
    country: country?.toLowerCase().trim(),
    ip,
    ts: new Date().toISOString(),
  };
  if (kv && typeof kv.put === 'function') {
    const key = `email:${record.ts}:${record.email}`;
    try {
      await kv.put(key, JSON.stringify(record));
    } catch (err) {
      console.error('KV put failed:', err);
    }
  } else {
    console.log('cv-review:email-captured', JSON.stringify(record));
  }
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  // Parse body
  let body: CVReviewRequest;
  try {
    body = (await request.json()) as CVReviewRequest;
  } catch {
    return jsonResponse({ error: 'invalid_json', message: 'Body inválido' }, 400);
  }

  const cv = (body.cv ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const country = body.country?.trim();
  const consent = body.consent === true;

  // Validations
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
  if (cv.length < MIN_CV_LENGTH) {
    return jsonResponse(
      {
        error: 'cv_too_short',
        message: `El CV es muy corto (mínimo ${MIN_CV_LENGTH} caracteres). Pega el texto completo de tu CV.`,
      },
      400,
    );
  }
  if (cv.length > MAX_CV_LENGTH) {
    return jsonResponse(
      {
        error: 'cv_too_long',
        message: `El CV excede el máximo de ${MAX_CV_LENGTH} caracteres. Recorta secciones poco relevantes.`,
      },
      400,
    );
  }

  // Read ANTHROPIC_API_KEY from Cloudflare env (configured via `wrangler secret put ANTHROPIC_API_KEY`)
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const apiKey = runtime?.env?.ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY no está configurada como secret');
    return jsonResponse(
      {
        error: 'config_error',
        message:
          'El servicio está en mantenimiento momentáneo. Intenta de nuevo en unos minutos.',
      },
      503,
    );
  }

  // Rate limit: max 2 análisis por email cada 30 días
  const limitsKV = runtime?.env?.CV_LIMITS as KVNamespace | undefined;
  const limitCheck = await checkCvSubmitLimit(limitsKV, email);
  if (!limitCheck.allowed) {
    return jsonResponse(
      {
        error: 'rate_limited',
        message: `Ya usaste tus ${limitCheck.max} análisis gratuitos. Tu cupo se renueva en ~${limitCheck.resetInDays} días. Si necesitas otro análisis antes, escríbenos en /contacto.`,
      },
      429,
    );
  }

  // Build user message
  const userMessage = `País del candidato: ${country || 'no especificado'}\n\n--- INICIO DEL CV ---\n${cv}\n--- FIN DEL CV ---\n\nGenera el análisis ahora siguiendo exactamente el formato JSON especificado.`;

  // Call Claude with prefill technique: prefill assistant with "{" so Claude continues a JSON object
  let completion;
  try {
    completion = await chatCompletion({
      apiKey,
      model: 'claude-haiku-4-5-20251001',
      system: CV_REVIEW_SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 4000,
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: '{' }, // prefill — fuerza JSON limpio
      ],
    });
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error('Anthropic error', err.status, err.body);
    } else {
      console.error('Unexpected error calling Anthropic', err);
    }
    return jsonResponse(
      {
        error: 'llm_error',
        message:
          'No pudimos completar el análisis en este momento. Intenta de nuevo en un minuto.',
      },
      502,
    );
  }

  // Reconstruct the JSON: prepend `{` (prefill) to the response text
  const rawText = extractText(completion).trim();
  const jsonString = '{' + rawText;

  let parsed: CVReviewResult;
  try {
    parsed = JSON.parse(jsonString) as CVReviewResult;
  } catch (err) {
    console.error('LLM returned non-JSON:', jsonString.slice(0, 500));
    return jsonResponse(
      {
        error: 'parse_error',
        message:
          'Recibimos una respuesta inesperada. Intenta de nuevo o pega el CV con saltos de línea limpios.',
      },
      500,
    );
  }

  // Sanity check structure
  if (
    !parsed.candidateName ||
    !parsed.retroalimentacion ||
    !Array.isArray(parsed.observaciones) ||
    parsed.observaciones.length === 0
  ) {
    console.error('LLM returned malformed structure:', JSON.stringify(parsed).slice(0, 500));
    return jsonResponse(
      {
        error: 'incomplete_result',
        message:
          'El análisis quedó incompleto. Intenta de nuevo; si persiste, asegúrate de pegar el CV completo.',
      },
      500,
    );
  }

  // Store email + push a MailerLite + increment rate-limit counter (fire-and-forget)
  // Usamos ctx.waitUntil para que Cloudflare mantenga el worker vivo hasta que terminen
  const ip = clientAddress ?? request.headers.get('cf-connecting-ip');
  const ctx = (runtime as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined)?.ctx;
  const waitUntil = ctx?.waitUntil?.bind(ctx) ?? ((p: Promise<unknown>) => p);

  waitUntil(
    storeEmail(
      runtime as { env?: Record<string, unknown> },
      email,
      country,
      ip,
    ).catch((err) => console.error('storeEmail failed', err)),
  );
  waitUntil(
    sendWelcomeCv(
      runtime as { env?: Record<string, unknown> },
      email,
      // Postmark solo usa el primer nombre; parsed.candidateName puede venir con nombre completo.
      parsed.candidateName?.trim().split(/\s+/)[0],
    ).catch((err) => console.error('sendWelcomeCv failed', err)),
  );
  waitUntil(
    incrementCvSubmitCount(limitsKV, email).catch((err) =>
      console.error('incrementCvSubmitCount failed', err),
    ),
  );

  // Return structured result
  return jsonResponse(
    {
      candidateName: parsed.candidateName,
      retroalimentacion: parsed.retroalimentacion,
      observaciones: parsed.observaciones,
      usage: completion.usage,
    },
    200,
  );
};
