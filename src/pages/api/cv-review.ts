import type { APIRoute } from 'astro';
import { CV_REVIEW_SYSTEM_PROMPT } from '../../lib/cv-review-prompt';
import { chatCompletion, extractText, AnthropicError } from '../../lib/anthropic';
import { checkCvSubmitLimit, incrementCvSubmitCount } from '../../lib/rate-limit';
import { sendEmail, sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { extractUtms, type UtmRecord } from '../../lib/utm';
import { extractAttribution, emailHashFull, type Attribution } from '../../lib/attribution';
import { guardarEventoD1 } from '../../lib/eventos-d1';
// Postmark reemplaza a Brevo (jul 2026). Ver _docs/que-rompimos-brevo-mailerlite.md.

export const prerender = false;

interface CVReviewRequest {
  cv: string;
  email: string;
  country?: string;
  consent?: boolean;
  // UTMs opcionales: los agrega el cliente desde window.__utm (P1 sprint 2026-08-18).
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  // Página de origen externa (document.referrer al aterrizar). Ver revisar-cv.astro.
  referrer?: string;
  // 30 oct 2026 (P2): aid, primer/último toque y bandera interna (BaseLayout window.__attr).
  aid?: string;
  ft?: unknown;
  lt?: unknown;
  interno?: boolean;
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
  utms: UtmRecord,
  referrer?: string,
  attr: Attribution = {},
): Promise<void> {
  // Si hay KV namespace `EMAILS` configurado, guardamos. Si no, log a console (visible vía `wrangler tail`).
  const kv = runtime?.env?.EMAILS as KVNamespace | undefined;
  const record = {
    email: email.toLowerCase().trim(),
    country: country?.toLowerCase().trim(),
    ip,
    ts: new Date().toISOString(),
    ...(referrer ? { referrer } : {}),
    ...utms,
    // 30 oct 2026 (P2): llave de unión con ventas (sha256 completo) + aid/ft/lt/interno.
    email_hash: await emailHashFull(email),
    ...attr,
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

// Tope diario global (20 oct 2026): un pico de 29 análisis en un día (vs 1-2 normal)
// llegó sin aviso. El tope corta el gasto si el pico crece; al alcanzarlo se avisa
// una sola vez a hello@ para decidir si se sube.
const DAILY_CAP = 50;

async function bumpDailyCount(kv: KVNamespace | undefined): Promise<number> {
  if (!kv) return 0;
  const key = `cv_daily:${new Date().toISOString().slice(0, 10)}`;
  const current = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0;
  const next = current + 1;
  await kv.put(key, String(next), { expirationTtl: 60 * 60 * 48 });
  return next;
}

// Registro de intentos (20 oct 2026): el registro `email:` solo existe cuando el
// análisis sale bien. `attempt:` se escribe antes de llamar a Anthropic y se
// actualiza con el resultado; los que quedan en 'started' son abandonos
// (p. ej., la persona cerró la página durante los 30-40 s de espera).
async function putAttempt(
  kv: KVNamespace | undefined,
  key: string,
  record: Record<string, unknown>,
): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 180 });
  } catch (err) {
    console.error('attempt put failed', err);
  }
}

function cleanReferrer(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().slice(0, 300);
  if (!/^https?:\/\//i.test(v)) return undefined;
  return v;
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

  // Kill switch compartido con el simulador (flag `anthropic_paused` en SIMULATOR_SESSIONS).
  const simKV = runtime?.env?.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (simKV && (await simKV.get('anthropic_paused'))) {
    return jsonResponse(
      {
        error: 'paused',
        message: 'El analizador está en pausa por mantenimiento. Intenta de nuevo más tarde.',
      },
      503,
    );
  }

  const dailyCount = await bumpDailyCount(limitsKV);
  if (dailyCount > DAILY_CAP) {
    return jsonResponse(
      {
        error: 'daily_cap',
        message:
          'Hoy alcanzamos el cupo diario de análisis gratuitos. Vuelve mañana: tu cupo personal sigue intacto.',
      },
      503,
    );
  }
  if (dailyCount === DAILY_CAP) {
    const postmarkToken = runtime?.env?.POSTMARK_SERVER_TOKEN as string | undefined;
    if (postmarkToken) {
      try {
        await sendEmail(postmarkToken, {
          from: 'hello@solcaciencia.com',
          to: 'hello@solcaciencia.com',
          subject: `[CV checker] Se alcanzó el tope diario de ${DAILY_CAP} análisis`,
          textBody: `El analizador de CV llegó hoy a ${DAILY_CAP} análisis. Los siguientes verán un aviso de cupo diario hasta mañana (UTC). Para subir el tope, cambia DAILY_CAP en src/pages/api/cv-review.ts.`,
          tag: 'cv-daily-cap',
        });
      } catch {
        /* ignore */
      }
    }
  }

  const emailsKV = runtime?.env?.EMAILS as KVNamespace | undefined;
  const referrer = cleanReferrer(body.referrer);
  const attemptTs = new Date().toISOString();
  const attemptKey = `attempt:${attemptTs}:${email}`;
  const attemptBase = {
    email,
    country,
    ts: attemptTs,
    cvLength: cv.length,
    ...(referrer ? { referrer } : {}),
    ...extractUtms(body as unknown as Record<string, unknown>),
    ...extractAttribution(body),
  };
  // 30 oct 2026: el registro `attempt:` (KV, 180 días) lleva el correo, así que no se vuelve permanente.
  // La parte anónima (estado, largo del CV, país, fuente, aid) se copia a D1 `eventos` como cv_attempt, sin TTL.
  const attemptDb = runtime?.env?.SIMULATOR_METRICS_DB as D1Database | undefined;
  const attemptTag = (await emailHashFull(email)).slice(0, 12);
  const attr = extractAttribution(body);
  const saveAttempt = async (rec: Record<string, unknown>): Promise<void> => {
    await putAttempt(emailsKV, attemptKey, rec);
    const status = String(rec.status ?? 'desconocido').slice(0, 30);
    const u = rec as { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string };
    await guardarEventoD1(attemptDb, `cvat:${attemptTs}:${attemptTag}:${status}`, {
      ts: new Date().toISOString(),
      event: 'cv_attempt',
      utm_source: u.utm_source, utm_medium: u.utm_medium, utm_campaign: u.utm_campaign,
      utm_content: u.utm_content, utm_term: u.utm_term,
      referrer, country: request.headers.get('cf-ipcountry') ?? undefined, // país de la IP (Cloudflare), como en eventos
      ...attr,
      extra: {
        status,
        pais_form: country ? country.slice(0, 40) : undefined, // país elegido en el formulario
        cv_length: cv.length,
        output_tokens: typeof rec.outputTokens === 'number' ? rec.outputTokens : undefined,
        intento: attemptTag, // une started con su resultado; es un prefijo de 12 caracteres del hash, no el correo
      },
    });
  };
  await saveAttempt({ ...attemptBase, status: 'started' });

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
      maxTokens: 5000, // 20 oct 2026: 4000 truncó 2 de 32 análisis de CVs largos
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
    await saveAttempt({
      ...attemptBase,
      status: 'llm_error',
      httpStatus: err instanceof AnthropicError ? err.status : undefined,
    });
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
    await saveAttempt({
      ...attemptBase,
      status: 'parse_error',
      outputTokens: completion.usage?.output_tokens,
    });
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
    await saveAttempt({
      ...attemptBase,
      status: 'incomplete_result',
      outputTokens: completion.usage?.output_tokens,
    });
    return jsonResponse(
      {
        error: 'incomplete_result',
        message:
          'El análisis quedó incompleto. Intenta de nuevo; si persiste, asegúrate de pegar el CV completo.',
      },
      500,
    );
  }

  // Store email + push a Postmark (welcome-cv) + increment rate-limit counter (fire-and-forget)
  // Usamos ctx.waitUntil para que Cloudflare mantenga el worker vivo hasta que terminen
  const ip = clientAddress ?? request.headers.get('cf-connecting-ip');
  const ctx = (runtime as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined)?.ctx;
  const waitUntil = ctx?.waitUntil?.bind(ctx) ?? ((p: Promise<unknown>) => p);

  // Extraer UTMs del body (los pone el cliente desde window.__utm).
  const utms = extractUtms(body as unknown as Record<string, unknown>);

  waitUntil(
    storeEmail(
      runtime as { env?: Record<string, unknown> },
      email,
      country,
      ip,
      utms,
      referrer,
      extractAttribution(body),
    ).catch((err) => console.error('storeEmail failed', err)),
  );
  waitUntil(
    saveAttempt({
      ...attemptBase,
      status: 'ok',
      outputTokens: completion.usage?.output_tokens,
    }),
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
