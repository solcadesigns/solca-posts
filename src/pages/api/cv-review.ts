import type { APIRoute } from 'astro';
import { readRolObjetivo, esDesdeCurso } from '../../lib/cv-review-rubric';
import { checkCvSubmitLimit, CUPO_ALUMNO } from '../../lib/rate-limit';
import { sendEmail } from '../../lib/postmark';
import { extractUtms } from '../../lib/utm';
import { extractAttribution, emailHashFull } from '../../lib/attribution';
import { readMarketing, CONSENT_MSG } from '../../lib/consent';
// 6 nov 2026 (bloque B): análisis, cierre, correo con el análisis y trabajos pendientes viven en cv-review-run.
import {
  runCvAnalysis,
  finalizeCvSuccess,
  cvJobKey,
  newCvJob,
  saveCvJob,
  markCvDone,
  putAttemptKv,
  recordCvAttemptD1,
  type CvAttemptCtx,
  type CvAttemptRec,
} from '../../lib/cv-review-run';
import { CV_PENDING_MSG } from '../../lib/cv-review-email';
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
  // 24 nov 2026: marca de alumno del curso (window.__alumno) → cupo CUPO_ALUMNO.
  alumno?: boolean;
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
 * Aviso de cupo agotado: la regla exacta (2 por correo cada 30 días desde el primero) y cuándo se libera.
 * La fecha es la del primer día completo (hora de México) en que ya se puede: si el cupo se libera a media
 * jornada, se da el día siguiente, para que "a partir del" nunca falle por unas horas.
 */
function mensajeCupo(max: number, resetInDays: number, resetAt?: string): string {
  let cuando = `en ${resetInDays} ${resetInDays === 1 ? 'día' : 'días'}`;
  if (resetAt) {
    try {
      const TZ = 'America/Mexico_City';
      let ms = new Date(resetAt).getTime();
      const hm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: TZ })
        .format(new Date(ms));
      if (hm !== '00:00:00') ms += 24 * 60 * 60 * 1000; // México sin horario de verano desde 2022: un día = 24 h
      const fecha = new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
      cuando = `a partir del ${fecha}`;
    } catch {
      // sin Intl: queda solo el número de días
    }
  }
  const curso = max < CUPO_ALUMNO ? ` Si eres alumno del curso, entra con el enlace de recursos de la lección: con él tienes ${CUPO_ALUMNO} análisis.` : '';
  return `Ya usaste tus ${max} análisis gratuitos. El cupo es de ${max} análisis por correo cada 30 días, contados desde tu primer análisis: podrás hacer otro ${cuando}.${curso} Si necesitas otro análisis antes, escríbenos en /contacto.`;
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
// 6 nov 2026: el helper vive en lib/cv-review-run (putAttemptKv), compartido con el reintento.

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

  // Rate limit: max 2 análisis por email cada 30 días, contados desde el primero (ver rate-limit.ts).
  // 24 nov 2026 (Oscar): alumnos del curso, 5. Se reconocen por la marca del navegador (window.__alumno, que
  // pone BaseLayout al entrar con un enlace del curso) o por los UTM del enlace (esDesdeCurso). No verifica la
  // compra: quien copie un enlace del curso también tiene 5; el tope diario global (DAILY_CAP) acota el gasto.
  const limitsKV = runtime?.env?.CV_LIMITS as KVNamespace | undefined;
  const alumnoCurso = body.interno !== true && (body.alumno === true || esDesdeCurso(extractUtms(body as unknown as Record<string, unknown>)));
  const limitCheck = await checkCvSubmitLimit(limitsKV, email, alumnoCurso ? { max: CUPO_ALUMNO } : undefined);
  if (!limitCheck.allowed) {
    return jsonResponse(
      {
        error: 'rate_limited',
        message: mensajeCupo(limitCheck.max, limitCheck.resetInDays, limitCheck.resetAt),
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
  const env = (runtime?.env ?? {}) as Record<string, unknown>;
  const attemptDb = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  const attemptTag = (await emailHashFull(email)).slice(0, 12);
  const attr = extractAttribution(body);
  const utms = extractUtms(body as unknown as Record<string, unknown>);
  const ipCountry = request.headers.get('cf-ipcountry');
  const attemptCtx: CvAttemptCtx = {
    attemptTs,
    intento: attemptTag,
    referrer,
    ipCountry,
    attr,
    utms,
    country,
    cvLength: cv.length,
    rolObjetivo,
    origen,
    paginas,
  };
  const saveAttempt = async (kvRec: Record<string, unknown>, d1: CvAttemptRec): Promise<void> => {
    await putAttemptKv(emailsKV, attemptKey, kvRec);
    await recordCvAttemptD1(attemptDb, attemptCtx, d1);
  };
  await saveAttempt({ ...attemptBase, status: 'started' }, { status: 'started' });

  // Una sola llamada al modelo; parseo tolerante y validación v2 (lib/cv-review-run).
  const outcome = await runCvAnalysis(apiKey, { cv, country, rolObjetivo, origen, paginas });
  const ip = clientAddress ?? request.headers.get('cf-connecting-ip');
  const jobKey = await cvJobKey(email);

  if (!outcome.ok) {
    await saveAttempt(
      { ...attemptBase, status: outcome.status, httpStatus: outcome.httpStatus, outputTokens: outcome.outputTokens, ms: outcome.ms, modelo: outcome.modelo },
      { status: outcome.status, outputTokens: outcome.outputTokens, ms: outcome.ms, modelo: outcome.modelo },
    );
    // 6 nov 2026 (bloque B): en vez de pedir que lo intente otra vez, se guarda un trabajo pendiente (KV, 48 h
    // máximo) que /api/cv-process-pending reintenta; el análisis llega por correo. Si no se puede guardar, se cae
    // al mensaje de error de antes.
    // 6 nov 2026: un rechazo de seguridad no se encola (se volvería a rechazar); va directo al mensaje genérico.
    if (limitsKV && outcome.status !== 'refusal') {
      try {
        await saveCvJob(
          limitsKV,
          jobKey,
          newCvJob({
            lastStatus: outcome.status,
            attemptKey,
            attemptTs,
            intento: attemptTag,
            cv,
            rolObjetivo,
            origen,
            paginas,
            email,
            country,
            marketing,
            consentTs: attemptTs,
            ip,
            ipCountry,
            utms,
            referrer,
            attr,
          }),
        );
        await saveAttempt({ ...attemptBase, status: 'pending', lastError: outcome.status }, { status: 'pending', intentoN: 1 });
        return jsonResponse(
          {
            pending: true,
            message: CV_PENDING_MSG,
          },
          202,
        );
      } catch (err) {
        console.error('cv-review: no se pudo guardar el trabajo pendiente', err);
      }
    }
    const fallback: Record<typeof outcome.status, { status: number; message: string }> = {
      llm_error: { status: 502, message: 'No pudimos completar el análisis en este momento. Intenta de nuevo en un minuto.' },
      refusal: { status: 502, message: 'No pudimos completar el análisis en este momento. Intenta de nuevo en un minuto.' },
      parse_error: { status: 500, message: 'Recibimos una respuesta inesperada. Intenta de nuevo o pega el CV con saltos de línea limpios.' },
      incomplete_result: { status: 500, message: 'El análisis quedó incompleto. Intenta de nuevo; si persiste, asegúrate de pegar el CV completo.' },
    };
    return jsonResponse({ error: outcome.status, message: fallback[outcome.status].message }, fallback[outcome.status].status);
  }

  const parsed = outcome.result;
  await saveAttempt(
    {
      ...attemptBase,
      status: 'ok',
      outputTokens: outcome.outputTokens,
      ms: outcome.ms,
      parcial: outcome.parcial,
      nPrioritario: outcome.conteos.prioritario,
      nMejorable: outcome.conteos.mejorable,
      nSolido: outcome.conteos.solido,
      nNoEvaluable: outcome.conteos.no_evaluable,
      nAjustes: outcome.nAjustes,
      modelo: outcome.modelo,
    },
    {
      status: 'ok',
      modelo: outcome.modelo,
      outputTokens: outcome.outputTokens,
      ms: outcome.ms,
      parcial: outcome.parcial,
      conteos: outcome.conteos,
      nAjustes: outcome.nAjustes,
    },
  ).catch((err) => console.error('saveAttempt failed', err));

  // Si quedaba un pendiente de un intento anterior de este correo, ya no hace falta (y lleva texto de un CV).
  // Primero la marca cvdone (unos minutos): si el cron está a media corrida con ese trabajo, al releer la ve y no
  // manda otro correo, no registra otro lead, no cuenta dos veces ni reescribe el CV viejo (lib/cv-pending.ts).
  if (limitsKV) {
    await markCvDone(limitsKV, jobKey).catch((err) => console.error('markCvDone failed', err));
    await limitsKV.delete(jobKey).catch(() => {});
  }

  // Lead, consentimiento, welcome comercial (solo con casilla), contador y correo con el análisis. Todo con
  // await (ctx.waitUntil no ejecuta en Astro sobre Workers). Una falla del correo no cambia la respuesta.
  const { emailSent } = await finalizeCvSuccess(
    env,
    { email, country, ip, utms, referrer, attr, marketing, ipCountry },
    parsed,
    { rolFormulario: rolObjetivo, reintento: false },
  ).catch((err) => {
    console.error('finalizeCvSuccess failed', err);
    return { emailSent: false };
  });
  if (!emailSent) console.warn('cv-review: el correo con el análisis no salió');

  return jsonResponse({ ...parsed, parcial: outcome.parcial, correo_enviado: emailSent, usage: outcome.usage }, 200);
};
