import type { APIRoute } from 'astro';
import { CV_REVIEW_SYSTEM_PROMPT, buildCvReviewUserMessage } from '../../lib/cv-review-prompt';
import {
  RUBRIC_VERSION,
  ROL_NO_SEGURO,
  readRolObjetivo,
  rolLabel,
  lineBreakCount,
  parseJsonLenient,
  validateCvReview,
  countByEstado,
} from '../../lib/cv-review-rubric';
import { chatCompletion, extractText, AnthropicError } from '../../lib/anthropic';
import { checkCvSubmitLimit, incrementCvSubmitCount } from '../../lib/rate-limit';
import { sendEmail, sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { extractUtms, type UtmRecord } from '../../lib/utm';
import { extractAttribution, emailHashFull, type Attribution } from '../../lib/attribution';
import { guardarEventoD1 } from '../../lib/eventos-d1';
import {
  readMarketing,
  consentFields,
  consentKvMeta,
  registrarConsentimiento,
  CONSENT_MSG,
} from '../../lib/consent';
// Postmark reemplaza a Brevo (jul 2026). Ver _docs/que-rompimos-brevo-mailerlite.md.

export const prerender = false;

interface CVReviewRequest {
  cv: string;
  email: string;
  country?: string;
  consent?: boolean;
  // 2 nov 2026: casilla opcional de correos comerciales (src/lib/consent.ts). El análisis funciona igual sin ella.
  marketing?: boolean;
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
  // 6 nov 2026 (rúbrica v2): rol objetivo opcional y señales de la extracción. No llevan texto del CV.
  rol_objetivo?: string;
  origen?: string;
  paginas?: number;
  caracteres?: number;
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
  marketing = false,
  ts: string = new Date().toISOString(),
): Promise<void> {
  // Si hay KV namespace `EMAILS` configurado, guardamos. Si no, log a console (visible vía `wrangler tail`).
  const kv = runtime?.env?.EMAILS as KVNamespace | undefined;
  const consent = consentFields(ts, marketing, 'cv');
  const record = {
    email: email.toLowerCase().trim(),
    country: country?.toLowerCase().trim(),
    ip,
    ts,
    ...(referrer ? { referrer } : {}),
    ...utms,
    // 30 oct 2026 (P2): llave de unión con ventas (sha256 completo) + aid/ft/lt/interno.
    email_hash: await emailHashFull(email),
    ...attr,
    // 2 nov 2026: versión del texto aceptado, fecha y casilla comercial (src/lib/consent.ts).
    ...consent,
  };
  if (kv && typeof kv.put === 'function') {
    const key = `email:${record.ts}:${record.email}`;
    try {
      // Metadata con el consentimiento para que blog-broadcast lo lea con `list`, sin `get`.
      await kv.put(key, JSON.stringify(record), { metadata: consentKvMeta(consent) });
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
  const marketing = readMarketing(body);
  const rolObjetivo = readRolObjetivo(body.rol_objetivo);
  const origen: 'pdf' | 'pegado' = body.origen === 'pdf' ? 'pdf' : 'pegado';
  const paginasNum = Number(body.paginas);
  const paginas = origen === 'pdf' && Number.isInteger(paginasNum) && paginasNum >= 1 && paginasNum <= 60 ? paginasNum : null;
  // `caracteres` del cliente se ignora: el largo que cuenta es el del texto recibido (pudo editarse).

  // Validations
  if (!consent) {
    return jsonResponse(
      { error: 'consent_required', message: CONSENT_MSG.privacidad_requerida },
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
        // 6 nov 2026 (rúbrica v2): rol del formulario, origen del texto y conteos por estado. Sin texto del CV.
        rubric_version: RUBRIC_VERSION,
        rol_objetivo: rolObjetivo,
        origen,
        paginas: paginas ?? undefined,
        ms: typeof rec.ms === 'number' ? rec.ms : undefined,
        parcial: typeof rec.parcial === 'boolean' ? rec.parcial : undefined,
        n_prioritario: typeof rec.nPrioritario === 'number' ? rec.nPrioritario : undefined,
        n_mejorable: typeof rec.nMejorable === 'number' ? rec.nMejorable : undefined,
        n_solido: typeof rec.nSolido === 'number' ? rec.nSolido : undefined,
        n_no_evaluable: typeof rec.nNoEvaluable === 'number' ? rec.nNoEvaluable : undefined,
        n_ajustes: typeof rec.nAjustes === 'number' ? rec.nAjustes : undefined,
      },
    });
  };
  await saveAttempt({ ...attemptBase, status: 'started' });

  // Mensaje de usuario: datos del formulario + CV entre marcas (rúbrica v2).
  const userMessage = buildCvReviewUserMessage({
    cv,
    country,
    rolLabel: rolLabel(rolObjetivo),
    rolNoSeguro: rolObjetivo === ROL_NO_SEGURO,
    origen,
    paginas,
    saltos: lineBreakCount(cv),
  });
  const t0 = Date.now();

  // Call Claude with prefill technique: prefill assistant with "{" so Claude continues a JSON object
  let completion;
  try {
    completion = await chatCompletion({
      apiKey,
      model: 'claude-haiku-4-5-20251001',
      system: CV_REVIEW_SYSTEM_PROMPT,
      temperature: 0.3,
      // 6 nov 2026 (v2): más campos de salida (estado, evidencia, prioridades, reescrituras). 5000 → 7000.
      // El aumento real se mide con output_tokens en cv_attempt.
      maxTokens: 7000,
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
  const outputTokens = completion.usage?.output_tokens;
  const ms = Date.now() - t0;

  // Parseo tolerante: si el modelo se cortó por max_tokens, se cierra el JSON en el último objeto completo.
  const parsedLenient = parseJsonLenient(jsonString);
  if (!parsedLenient) {
    console.error('LLM returned non-JSON:', jsonString.slice(0, 500));
    await saveAttempt({ ...attemptBase, status: 'parse_error', outputTokens, ms });
    return jsonResponse(
      {
        error: 'parse_error',
        message:
          'Recibimos una respuesta inesperada. Intenta de nuevo o pega el CV con saltos de línea limpios.',
      },
      500,
    );
  }

  // Validación v2: citas literales, estados, grupos por id, prioridades y reescrituras. Acepta parciales.
  const validated = validateCvReview(parsedLenient.value, { cv, origen, paginas, rolObjetivo });
  if (!validated) {
    console.error('LLM returned malformed structure:', JSON.stringify(parsedLenient.value).slice(0, 500));
    await saveAttempt({ ...attemptBase, status: 'incomplete_result', outputTokens, ms });
    return jsonResponse(
      {
        error: 'incomplete_result',
        message:
          'El análisis quedó incompleto. Intenta de nuevo; si persiste, asegúrate de pegar el CV completo.',
      },
      500,
    );
  }
  const parsed = validated.result;
  const parcial = validated.report.parcial || parsedLenient.repaired;
  if (Object.keys(validated.report.issues).length) {
    console.log('cv-review:ajustes', JSON.stringify({ ...validated.report.issues, reparado: parsedLenient.repaired }));
  }
  const conteos = countByEstado(parsed.observaciones);

  // Guardar lead, consentimiento, intento y contador. 6 nov 2026: todo con await; ctx.waitUntil no
  // ejecuta el callback en Astro sobre Workers (gotcha documentado en oscar-context).
  const ip = clientAddress ?? request.headers.get('cf-connecting-ip');

  // Extraer UTMs del body (los pone el cliente desde window.__utm).
  const utms = extractUtms(body as unknown as Record<string, unknown>);
  const leadTs = new Date().toISOString();

  await storeEmail(
    runtime as { env?: Record<string, unknown> },
    email,
    country,
    ip,
    utms,
    referrer,
    extractAttribution(body),
    marketing,
    leadTs,
  ).catch((err) => console.error('storeEmail failed', err));
  // 2 nov 2026: prueba del consentimiento + evento lead_captured en D1 (permanente, sin correo).
  await registrarConsentimiento(attemptDb, {
    ts: leadTs,
    emailHash: await emailHashFull(email),
    form: 'cv',
    marketing,
    attr,
    utms,
    country: request.headers.get('cf-ipcountry'),
  });
  await saveAttempt({
    ...attemptBase,
    status: 'ok',
    outputTokens,
    ms,
    parcial,
    nPrioritario: conteos.prioritario,
    nMejorable: conteos.mejorable,
    nSolido: conteos.solido,
    nNoEvaluable: conteos.no_evaluable,
    nAjustes: Object.values(validated.report.issues).reduce((a, b) => a + b, 0),
  }).catch((err) => console.error('saveAttempt failed', err));
  // 2 nov 2026: welcome-cv es comercial (presenta el newsletter y lleva al quiz); el análisis ya está en
  // pantalla. Solo se manda con la casilla opcional marcada.
  if (marketing) {
    await sendWelcomeCv(
      runtime as { env?: Record<string, unknown> },
      email,
      // Postmark solo usa el primer nombre; parsed.candidateName puede venir con nombre completo.
      parsed.candidateName?.trim().split(/\s+/)[0],
    ).catch((err) => console.error('sendWelcomeCv failed', err));
  }
  // El contador también sirve de prueba para /api/cv-waitlist (este correo hizo un análisis en 30 días).
  await incrementCvSubmitCount(limitsKV, email).catch((err) =>
    console.error('incrementCvSubmitCount failed', err),
  );

  // Return structured result
  return jsonResponse(
    { ...parsed, parcial, usage: completion.usage },
    200,
  );
};
