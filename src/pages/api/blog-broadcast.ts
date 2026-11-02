import type { APIRoute } from 'astro';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { getCollection } from 'astro:content';
import { decideMarketing, legacyPolicy, type LegacyPolicy } from '../../lib/consent';
import {
  KV_OP_BUDGET,
  alertOscar,
  collectLeadBase,
  hasNewsletterUnsub,
  isBroadcastAuthorized,
  isTooOld,
  legacySpainCheck,
  type Lead,
} from '../../lib/broadcast-audience';

export const prerender = false;

/**
 * Broadcast semanal del blog más reciente a los suscriptores KV EMAILS.
 * Triggered por cron Vie 8am CDMX (14:00 UTC · `0 14 * * 5`).
 *
 * Audiencia (2 nov 2026):
 * - Suscriptores = llaves con prefijo `email:` (CV entregado), `quiz:` (quiz-rol) y
 *   `sim:` (registro freemium del Simulador). Las tres piden consentimiento de correo.
 *   NO entran `attempt:` (intentos de CV, incluso fallidos), `drip:`, `unsub:`,
 *   `broadcast-report:` ni nada más del namespace. `contact.ts` escribe en CONTACTS, no aquí.
 * - El correo y la fecha de opt-in salen del nombre de la llave
 *   (`<prefijo>:<ISO ts>:<email>`), sin `get` por registro. Se deduplica por correo.
 * - Listado paginado con cursor hasta `list_complete` (antes cortaba en 1,000 llaves).
 *
 * Bajas (qué cubre cada vía):
 * - Postmark, stream `broadcast`: el `{{{ pm:unsubscribe }}}` del template, rebotes duros y
 *   quejas de spam quedan en su lista de supresiones. Se descarga antes de enviar
 *   (`/message-streams/broadcast/suppressions/dump`) y se excluye. Postmark además
 *   rechaza el envío a esas direcciones (ErrorCode 406), así que si la descarga falla
 *   el envío sigue: se marca en el reporte y se avisa a hello@.
 * - Postmark, stream `outbound`: rebotes duros y quejas del transaccional también se
 *   excluyen (Postmark no los comparte entre streams).
 * - KV `unsub:<email>:newsletter` | `:comercial` | `:all`: baja desde la página de
 *   `drip-unsubscribe` ("salir también del newsletter") o puesta a mano cuando alguien
 *   contesta "unsub". `unsub:<email>:drip` NO saca del newsletter (la página lo promete).
 *
 * Consentimiento comercial (2 nov 2026, src/lib/consent.ts): el newsletter solo va a correos con la casilla
 * comercial marcada en algún formulario (metadata `{cv, mk}` de la llave, sin `get`), o a correos que solo
 * tienen registros legado (sin versión de consentimiento) si MARKETING_LEGACY_POLICY lo permite
 * (`permitir_sin_es`: pasan salvo país España; para eso se lee el registro `email:`/`quiz:` legado con `get`,
 * dentro de un tope de operaciones KV; lo que no alcanza a leerse sale como `legacy_unread`, no se envía).
 * Motivos nuevos en `excluded`: no_marketing_optin, legacy_es, legacy_bloqueado, legacy_unread. Se evalúan
 * al final, después de los motivos anteriores, para que esas cuentas sigan siendo comparables.
 *
 * Idempotencia: `broadcast-lock:<slug>` se escribe antes del primer envío; una segunda
 * corrida del mismo post se salta salvo `?force=1`. `?dry_run=1` calcula la audiencia y
 * las exclusiones sin enviar ni escribir nada.
 *
 * NO importa listas externas. Solo usa KV EMAILS que crece por opt-in nativo.
 *
 * Helpers de audiencia (listado, dedup, bajas, supresiones) en src/lib/broadcast-audience.ts desde el 2 nov 2026,
 * compartidos con /api/aviso-privacidad-2026-11. El comportamiento de este endpoint no cambió.
 */

interface Exclusions {
  attempt_only: number; // correos con `attempt:` y sin registro de suscriptor (antes sí recibían)
  duplicate: number; // registros extra del mismo correo
  too_old: number; // opt-in > MAX_AGE_DAYS
  unsub_kv: number; // unsub:<email>:newsletter|comercial|all
  suppressed_broadcast: number; // lista de supresiones Postmark, stream broadcast
  suppressed_outbound: number; // rebote duro / queja en el stream transaccional
  over_cap: number; // no enviados por tope de la corrida
  unparsable_key: number; // llave de suscriptor con formato inesperado y sin registro legible
  // 2 nov 2026 · consentimiento comercial (src/lib/consent.ts)
  no_marketing_optin: number; // solo registros nuevos y ninguno con la casilla comercial marcada
  legacy_es: number; // solo legado y país España (política permitir_sin_es)
  legacy_bloqueado: number; // solo legado y la política es bloquear o reconfirmar
  legacy_unread: number; // legado sin leer por el tope de operaciones KV (no se envía sin verificar)
}

interface ConsentStats {
  policy: LegacyPolicy;
  optin: number; // elegibles por casilla comercial marcada
  legacy_allowed: number; // elegibles por regla legado
  legacy_reads: number; // `get` de registros legado para el filtro España
}

interface BroadcastReport {
  blog_slug: string;
  blog_title: string;
  candidates: number; // registros de suscriptor (email:/quiz:/sim:) leídos
  candidates_by_prefix: Record<string, number>;
  unique_emails: number;
  eligible: number;
  sent: number;
  failed: number;
  failed_inactive: number; // Postmark 406: destinatario suprimido que no venía en el dump
  skipped: number; // candidates - eligible (compatibilidad con el reporte anterior)
  excluded: Exclusions;
  consent: ConsentStats;
  drip_unsub_still_sent: number; // solo dejaron el drip; siguen en el newsletter
  suppression_check: 'ok' | 'failed';
  suppression_errors: string[];
  suppression_maybe_truncated: boolean;
  kv_list_calls: number;
  kv_list_truncated: boolean;
  forced: boolean;
  duration_ms: number;
  started_at: string;
  finished_at: string;
}

const THROTTLE_MS = 100; // ~10 emails/segundo — bajo el límite Postmark
// Envío secuencial ~0.3 s por correo: 2,500 caben en el límite de 15 min del cron y
// quedan muy debajo de 10,000 subrequests. Si se rebasa, se avisa (no se corta en silencio).
const MAX_SENDS_PER_RUN = 2500;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

interface Audience {
  eligible: Lead[];
  candidates: number;
  candidatesByPrefix: Record<string, number>;
  uniqueEmails: number;
  excluded: Exclusions;
  consent: ConsentStats;
  dripUnsubStillSent: number;
  suppressionCheck: 'ok' | 'failed';
  suppressionErrors: string[];
  suppressionMaybeTruncated: boolean;
  kvListCalls: number;
  kvListTruncated: boolean;
}

async function buildAudience(
  kv: KVNamespace,
  token: string,
  nowMs: number,
  policy: LegacyPolicy,
): Promise<Audience> {
  // Pasos 1-4 (suscriptores, intentos, bajas, supresiones): src/lib/broadcast-audience.ts.
  const base = await collectLeadBase(kv, token);
  const { counter, byEmail, signalsByEmail, legacyKeysByEmail, broadcastSupp, outboundSupp } = base;
  const excluded: Exclusions = {
    attempt_only: base.attemptOnly,
    duplicate: base.duplicate,
    too_old: 0,
    unsub_kv: 0,
    suppressed_broadcast: 0,
    suppressed_outbound: 0,
    over_cap: 0,
    unparsable_key: base.unparsableKey,
    no_marketing_optin: 0,
    legacy_es: 0,
    legacy_bloqueado: 0,
    legacy_unread: 0,
  };
  const consent: ConsentStats = { policy, optin: 0, legacy_allowed: 0, legacy_reads: 0 };

  // 5. Filtro final. Cada correo cuenta en un solo motivo, en este orden.
  const eligible: Lead[] = [];
  let dripUnsubStillSent = 0;
  for (const lead of byEmail.values()) {
    if (isTooOld(lead, nowMs)) {
      excluded.too_old++;
      continue;
    }
    if (hasNewsletterUnsub(base, lead.email)) {
      excluded.unsub_kv++;
      continue;
    }
    if (broadcastSupp.has(lead.email)) {
      excluded.suppressed_broadcast++;
      continue;
    }
    if (outboundSupp.has(lead.email)) {
      excluded.suppressed_outbound++;
      continue;
    }
    // 2 nov 2026: consentimiento comercial.
    const sigs = signalsByEmail.get(lead.email) ?? [{}];
    let decision = decideMarketing(sigs, policy);
    if (decision === 'legacy') {
      // permitir_sin_es: falta saber si algún registro legado es de España. Se lee con `get` (con tope).
      const es = await legacySpainCheck(kv, legacyKeysByEmail.get(lead.email) ?? [], counter, KV_OP_BUDGET, () => {
        consent.legacy_reads++;
      });
      if (es === 'es') decision = 'legacy_es';
      else if (es === 'unread') {
        excluded.legacy_unread++;
        continue;
      }
    }
    if (decision === 'no_marketing_optin') {
      excluded.no_marketing_optin++;
      continue;
    }
    if (decision === 'legacy_es') {
      excluded.legacy_es++;
      continue;
    }
    if (decision === 'legacy_bloqueado') {
      excluded.legacy_bloqueado++;
      continue;
    }
    if (decision === 'optin') consent.optin++;
    else consent.legacy_allowed++;
    if (base.unsubScopesByEmail.get(lead.email)?.has('drip')) dripUnsubStillSent++;
    eligible.push(lead);
  }
  if (eligible.length > MAX_SENDS_PER_RUN) {
    excluded.over_cap = eligible.length - MAX_SENDS_PER_RUN;
    eligible.length = MAX_SENDS_PER_RUN;
  }

  return {
    eligible,
    candidates: base.candidates,
    candidatesByPrefix: base.candidatesByPrefix,
    uniqueEmails: byEmail.size,
    excluded,
    consent,
    dripUnsubStillSent,
    suppressionCheck: base.suppressionErrors.length ? 'failed' : 'ok',
    suppressionErrors: base.suppressionErrors,
    suppressionMaybeTruncated: base.suppressionMaybeTruncated,
    kvListCalls: counter.calls,
    kvListTruncated: counter.truncated,
  };
}

/**
 * Obtiene el blog más reciente publicado en los últimos 7 días.
 * Si no hay ninguno reciente, retorna null y el broadcast se salta.
 */
async function getLatestBlog() {
  const posts = await getCollection('blog');
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recent = posts
    .filter((p) => p.data.pubDate.getTime() >= sevenDaysAgo && p.data.pubDate.getTime() <= now)
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  return recent[0] ?? null;
}

/**
 * Envía UN email vía Postmark template blog-broadcast-weekly.
 * TemplateModel: { first_name, blog_title, blog_hook, blog_url, blog_image_url }
 */
async function sendOne(
  token: string,
  to: string,
  firstName: string | undefined,
  blogTitle: string,
  blogHook: string,
  blogUrl: string,
  blogImageUrl: string,
): Promise<'ok' | 'inactive' | 'failed'> {
  try {
    await sendEmailWithTemplate(token, {
      from: 'Oscar Solís <hola@solcaciencia.com>',
      to,
      templateAlias: 'blog-broadcast-weekly',
      templateModel: {
        first_name: firstName ?? '',
        blog_title: blogTitle,
        blog_hook: blogHook,
        blog_url: blogUrl,
        blog_image_url: blogImageUrl,
      },
      tag: 'blog-broadcast',
      messageStream: 'broadcast', // stream separado del transactional
      metadata: { source: 'blog-broadcast-weekly' },
    });
    return 'ok';
  } catch (err) {
    if (err instanceof PostmarkError) {
      // 406 = destinatario inactivo (suprimido en Postmark): no es falla del envío.
      if ((err.body as { ErrorCode?: number } | undefined)?.ErrorCode === 406) return 'inactive';
      console.error(`broadcast:send-failed to=${to} status=${err.status}`, JSON.stringify(err.body));
    } else {
      console.error(`broadcast:send-failed to=${to}`, err);
    }
    return 'failed';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const POST: APIRoute = async ({ request, locals, url }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};

  if (!isBroadcastAuthorized(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!token) {
    return jsonResponse({ error: 'no_postmark_token' }, 503);
  }

  const emailsKv = env.EMAILS as KVNamespace | undefined;
  if (!emailsKv) {
    return jsonResponse({ error: 'no_emails_kv' }, 503);
  }

  const dryRun = url.searchParams.get('dry_run') === '1';
  const force = url.searchParams.get('force') === '1';
  const started = Date.now();
  const startedIso = new Date(started).toISOString();

  // 1. Buscar blog más reciente (últimos 7 días)
  const post = await getLatestBlog();

  // dry_run: audiencia y exclusiones sin enviar ni escribir (solo conteos, sin correos).
  if (dryRun) {
    const aud = await buildAudience(emailsKv, token, Date.now(), legacyPolicy(env));
    return jsonResponse({
      dry_run: true,
      blog_slug: post?.id ?? null,
      already_sent: post ? (await emailsKv.get(`broadcast-lock:${post.id}`)) !== null : null,
      candidates: aud.candidates,
      candidates_by_prefix: aud.candidatesByPrefix,
      unique_emails: aud.uniqueEmails,
      eligible: aud.eligible.length,
      excluded: aud.excluded,
      consent: aud.consent,
      drip_unsub_still_sent: aud.dripUnsubStillSent,
      suppression_check: aud.suppressionCheck,
      suppression_errors: aud.suppressionErrors,
      suppression_maybe_truncated: aud.suppressionMaybeTruncated,
      kv_list_calls: aud.kvListCalls,
      kv_list_truncated: aud.kvListTruncated,
    });
  }

  if (!post) {
    console.log('broadcast:skipped no-recent-blog');
    return jsonResponse({ skipped: true, reason: 'no_recent_blog', started_at: startedIso });
  }

  // Idempotencia: un post se envía una vez. Re-correr el cron o el POST manual no duplica.
  const lockKey = `broadcast-lock:${post.id}`;
  const existingLock = await emailsKv.get(lockKey);
  if (existingLock && !force) {
    console.log(`broadcast:skipped already-sent slug=${post.id}`);
    return jsonResponse({ skipped: true, reason: 'already_sent', blog_slug: post.id, lock: existingLock });
  }

  // UTM para atribuir las visitas de cada envío (26 oct 2026); sin ellas llegaban como tráfico directo.
  const blogUrl = `https://solcaciencia.com/blog/${post.id}/?utm_source=email&utm_medium=broadcast&utm_campaign=blog-${post.id}`;
  const blogTitle = post.data.title;
  // Hook: primeras ~150 palabras del cuerpo (Postmark decide el rendering final vía template)
  // Sin sintaxis markdown: el correo mostraba "> **Respuesta corta.**" literal.
  const bodyText = (post.body ?? '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(>|#{1,6})\s*/gm, '')
    .replace(/[*_`]/g, '')
    .trim();
  const blogHook = bodyText.split(/\s+/).slice(0, 30).join(' ') + '…';
  // Hero image: heroImage del frontmatter viene como "/blog/slug.png"; agregamos el host absoluto
  // para que Postmark/clientes de correo puedan cargarla desde cualquier lado.
  const heroPath = (post.data as { heroImage?: string }).heroImage ?? `/blog/${post.id}.png`;
  const blogImageUrl = heroPath.startsWith('http')
    ? heroPath
    : `https://solcaciencia.com${heroPath}`;

  // 2-3. Audiencia: suscriptores paginados, dedup, bajas KV y supresiones Postmark.
  const aud = await buildAudience(emailsKv, token, Date.now(), legacyPolicy(env));
  const eligible = aud.eligible;

  // Lock antes del primer envío: si la corrida muere a medias, NO se reintenta sola
  // (un duplicado cuesta más que un faltante); se re-lanza a mano con ?force=1.
  let lockFailed = false;
  try {
    await emailsKv.put(lockKey, JSON.stringify({ started_at: startedIso, eligible: eligible.length, forced: force }));
  } catch (err) {
    lockFailed = true;
    console.error('broadcast:lock-put-failed', err);
  }

  let sent = 0;
  let failed = 0;
  let failedInactive = 0;

  // 4. Envío secuencial con throttling
  for (const rec of eligible) {
    const r = await sendOne(token, rec.email, undefined, blogTitle, blogHook, blogUrl, blogImageUrl);
    if (r === 'ok') sent++;
    else if (r === 'inactive') failedInactive++;
    else failed++;
    await sleep(THROTTLE_MS);
  }

  const finished = Date.now();
  const report: BroadcastReport = {
    blog_slug: post.id,
    blog_title: blogTitle,
    candidates: aud.candidates,
    candidates_by_prefix: aud.candidatesByPrefix,
    unique_emails: aud.uniqueEmails,
    eligible: eligible.length,
    sent,
    failed,
    failed_inactive: failedInactive,
    skipped: aud.candidates - eligible.length,
    excluded: aud.excluded,
    consent: aud.consent,
    drip_unsub_still_sent: aud.dripUnsubStillSent,
    suppression_check: aud.suppressionCheck,
    suppression_errors: aud.suppressionErrors,
    suppression_maybe_truncated: aud.suppressionMaybeTruncated,
    kv_list_calls: aud.kvListCalls,
    kv_list_truncated: aud.kvListTruncated,
    forced: force,
    duration_ms: finished - started,
    started_at: startedIso,
    finished_at: new Date(finished).toISOString(),
  };

  // 5. Registrar reporte para métricas semanales
  try {
    // Sin TTL desde el 30 oct 2026 (antes 90 días): conteos del envío, sin correos. Se conserva la historia.
    await emailsKv.put(`broadcast-report:${startedIso}`, JSON.stringify(report));
  } catch (err) {
    console.error('broadcast:report-persist-failed', err);
  }

  // Aviso a hello@ si algo quedó fuera de lo normal (no frena el envío).
  const problems: string[] = [];
  if (aud.suppressionCheck === 'failed') {
    problems.push(`No se pudo leer la lista de supresiones de Postmark (${aud.suppressionErrors.join('; ')}). Se envió igual; Postmark rechaza a los suprimidos (failed_inactive=${failedInactive}).`);
  }
  if (aud.suppressionMaybeTruncated) problems.push('La lista de supresiones del stream broadcast trajo 500 o más registros: podría venir incompleta.');
  if (lockFailed) problems.push('No se pudo escribir el candado del envío: una segunda corrida manual de este post podría duplicarlo.');
  if (aud.kvListTruncated) problems.push('El listado de KV EMAILS llegó al tope de páginas: parte de la lista no se leyó.');
  if (aud.excluded.legacy_unread > 0) problems.push(`${aud.excluded.legacy_unread} correos legado no se enviaron porque se agotó el tope de ${KV_OP_BUDGET} operaciones KV antes de verificar su país. Toca guardar el país en la metadata de esas llaves (backfill) o cambiar la política.`);
  if (aud.excluded.over_cap > 0) problems.push(`${aud.excluded.over_cap} suscriptores quedaron fuera por el tope de ${MAX_SENDS_PER_RUN} envíos por corrida. Toca pasar a envío por lotes.`);
  if (failed > 0) problems.push(`${failed} envíos fallaron (ver logs broadcast:send-failed).`);
  if (problems.length) {
    await alertOscar(token, `[broadcast] Avisos del envío de ${post.id}`, problems.join('\n\n') + `\n\nReporte: broadcast-report:${startedIso}`);
  }

  console.log('broadcast:done', JSON.stringify(report));
  return jsonResponse(report);
};
