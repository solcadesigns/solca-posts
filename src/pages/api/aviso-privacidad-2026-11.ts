import type { APIRoute } from 'astro';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { decideMarketing } from '../../lib/consent';
import { guardarEventoD1 } from '../../lib/eventos-d1';
import { emailHashFull } from '../../lib/attribution';
import { siteOrigin } from '../../lib/drip';
import {
  KV_OP_BUDGET,
  alertOscar,
  collectLeadBase,
  isBroadcastAuthorized,
  isTooOld,
  legacySpainCheck,
} from '../../lib/broadcast-audience';
import { AVISO_CAMPAIGN, AVISO_TAG, AVISO_TEMPLATE_ALIAS, buildConfirmUrl } from '../../lib/reconfirmacion';

export const prerender = false;

/**
 * Correo ÚNICO de aviso de privacidad y reconfirmación · 2 nov 2026 (aprobado por Oscar).
 *
 * POST, header `x-broadcast-secret` (= BROADCAST_SECRET, igual que blog-broadcast).
 * - `?dry_run=1`: arma la audiencia y cuenta, sin enviar ni escribir nada. Responde solo conteos.
 * - `?test_to=hello@solcaciencia.com[&es=1]`: UNA copia de prueba a esa dirección (la única permitida), versión
 *   normal o España. No lee la audiencia ni toca candado ni reporte. Tag `aviso-privacidad-2026-11-prueba`.
 * - `?resume=1`: retoma una corrida interrumpida o abortada (candado `sending` sin actualizar en 5 min o más) o
 *   reintenta los fallidos de una corrida `done_with_failures`.
 *
 * Audiencia: la misma lista única de blog-broadcast ANTES del filtro de consentimiento (src/lib/broadcast-audience.ts):
 * correos únicos `email:`/`quiz:`/`sim:`, menos opt-in de más de 730 días, menos CUALQUIER baja `unsub:<email>:*`
 * (incluida `drip`: es un correo masivo y quien pidió salir de algo no debe recibirlo), menos supresiones de
 * Postmark (broadcast completo; outbound HardBounce/SpamComplaint). Sin filtro de consentimiento comercial: es
 * un aviso, no una oferta.
 *
 * `es_espana`: el correo solo tiene registros legado (sin consent_version) y alguno es de España, con la misma
 * lógica de consent.ts (decideMarketing con `permitir_sin_es` + país del registro legado `email:`/`quiz:`), sin
 * importar la política vigente. Solo a ellos se les manda `confirm_url` firmado (/api/confirmar-correos).
 * Si el tope de operaciones KV no alcanza para verificar el país de todos, el envío real NO arranca (409).
 *
 * Una sola vez (candado `aviso-lock:<campaña>`, sin correos en claro):
 * - Se reclama en estado `sending` con un `run_id` ANTES de leer la audiencia; una segunda corrida lo ve y se
 *   detiene. Si la audiencia bloquea el envío, el candado se libera (corrida nueva) o se restaura (resume).
 * - Orden de envío por sha256 del correo. Progreso cada 25 envíos: `last_hash` (último procesado),
 *   `failed_hashes` (fallos que no son 406, para reintento con `?resume=1`) y totales acumulados `sent`/`sent_es`.
 * - 10 fallos seguidos que no sean 406 abortan la corrida: el candado queda en `sending` con `last_hash` = último
 *   envío exitoso, y se avisa a hello@.
 * Reporte sin caducidad por corrida `aviso-report:<campaña>:<ISO>` (conteos, sin correos), evento D1
 * `aviso_privacidad_enviado` en `eventos`. Aperturas y clics: tag Postmark `aviso-privacidad-2026-11`.
 */

const LOCK_KEY = `aviso-lock:${AVISO_CAMPAIGN}`;
const TEST_ADDRESS = 'hello@solcaciencia.com';
const THROTTLE_MS = 100;
const MAX_SENDS_PER_RUN = 2500;
const PROGRESS_EVERY = 25;
const MAX_CONSECUTIVE_FAILS = 10;
const RESUME_MIN_IDLE_MS = 5 * 60 * 1000;
// Operaciones KV reservadas fuera de la lectura de legado: get + reclamo + relectura del candado,
// puts de progreso, cierre, liberación/restauración y reporte.
const KV_RESERVED = 8 + Math.ceil(MAX_SENDS_PER_RUN / PROGRESS_EVERY);

interface Recipient {
  email: string;
  hash: string; // sha256 completo: orden de envío y progreso del candado
  esEspana: boolean;
}

type LockStatus = 'sending' | 'done' | 'done_with_failures';

interface AvisoLock {
  status: LockStatus;
  run_id: string;
  started_at: string; // primera corrida
  updated_at: string;
  eligible: number;
  sent: number; // acumulado de todas las corridas
  sent_es: number; // acumulado
  failed_inactive: number; // acumulado (406, no se reintentan)
  last_hash: string | null;
  failed_hashes: string[];
  runs: number;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const maxHash = (a: string | null, b: string | null): string | null => (a === null ? b : b === null ? a : a > b ? a : b);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SendResult = 'ok' | 'inactive' | 'failed';

async function sendAviso(
  token: string,
  to: string,
  model: { es_espana: boolean; confirm_url: string; privacidad_url: string },
  tag: string,
  metadata: Record<string, string>,
): Promise<SendResult> {
  try {
    await sendEmailWithTemplate(token, {
      from: 'Oscar Solís <hola@solcaciencia.com>',
      to,
      templateAlias: AVISO_TEMPLATE_ALIAS,
      templateModel: model,
      tag,
      messageStream: 'broadcast',
      metadata,
    });
    return 'ok';
  } catch (err) {
    if (err instanceof PostmarkError && (err.body as { ErrorCode?: number } | undefined)?.ErrorCode === 406) return 'inactive';
    console.error(`aviso:send-failed status=${err instanceof PostmarkError ? err.status : 'n/a'}`);
    return 'failed';
  }
}

export const POST: APIRoute = async ({ request, locals, url }) => {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  if (!isBroadcastAuthorized(request, env)) return jsonResponse({ error: 'unauthorized' }, 401);

  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!token) return jsonResponse({ error: 'no_postmark_token' }, 503);
  const kv = env.EMAILS as KVNamespace | undefined;
  if (!kv) return jsonResponse({ error: 'no_emails_kv' }, 503);
  const secret = (env.DRIP_UNSUB_SECRET as string | undefined) ?? '';
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  const privacidadUrl = `${siteOrigin(env)}/privacidad?utm_source=email&utm_medium=broadcast&utm_campaign=${AVISO_CAMPAIGN}`;

  // ── Copia de prueba: una sola, a la única dirección permitida. Sin candado, sin reporte. ──
  const testTo = url.searchParams.get('test_to');
  if (testTo !== null) {
    if (testTo.trim().toLowerCase() !== TEST_ADDRESS) return jsonResponse({ error: 'test_to_not_allowed', allowed: TEST_ADDRESS }, 400);
    const es = url.searchParams.get('es') === '1';
    if (es && !secret) return jsonResponse({ error: 'no_drip_unsub_secret' }, 503);
    const r = await sendAviso(
      token,
      TEST_ADDRESS,
      { es_espana: es, confirm_url: es ? await buildConfirmUrl(env, TEST_ADDRESS, secret) : '', privacidad_url: privacidadUrl },
      `${AVISO_TAG}-prueba`,
      { source: AVISO_CAMPAIGN, es: es ? '1' : '0', prueba: '1' },
    );
    return jsonResponse({ test: true, to: TEST_ADDRESS, es_espana: es, result: r }, r === 'ok' ? 200 : 502);
  }

  const dryRun = url.searchParams.get('dry_run') === '1';
  const resume = url.searchParams.get('resume') === '1';
  const started = Date.now();
  const startedIso = new Date(started).toISOString();

  // ── Candado: se verifica y se reclama antes de leer la audiencia. ──
  let prevLock: AvisoLock | null = null;
  try {
    const raw = await kv.get(LOCK_KEY);
    prevLock = raw ? (JSON.parse(raw) as AvisoLock) : null;
  } catch {
    prevLock = null;
  }
  const runId = crypto.randomUUID();
  if (!dryRun) {
    if (prevLock?.status === 'done') return jsonResponse({ skipped: true, reason: 'already_sent', lock: prevLock });
    if (prevLock && !resume) return jsonResponse({ skipped: true, reason: 'in_progress_or_interrupted', hint: 'usa ?resume=1', lock: prevLock }, 409);
    if (!prevLock && resume) return jsonResponse({ skipped: true, reason: 'nothing_to_resume' }, 409);
    if (prevLock && prevLock.status === 'sending') {
      const idle = started - Date.parse(prevLock.updated_at);
      if (!(idle >= RESUME_MIN_IDLE_MS)) {
        return jsonResponse({ skipped: true, reason: 'lock_recently_updated', hint: 'otra corrida puede seguir viva; espera 5 min', lock: prevLock }, 409);
      }
    }
  }

  const writeLock = async (l: AvisoLock): Promise<boolean> => {
    try {
      await kv.put(LOCK_KEY, JSON.stringify(l));
      return true;
    } catch (err) {
      console.error('aviso:lock-put-failed', err);
      return false;
    }
  };
  const lockState: AvisoLock = {
    status: 'sending',
    run_id: runId,
    started_at: prevLock?.started_at ?? startedIso,
    updated_at: startedIso,
    eligible: prevLock?.eligible ?? 0,
    sent: prevLock?.sent ?? 0,
    sent_es: prevLock?.sent_es ?? 0,
    failed_inactive: prevLock?.failed_inactive ?? 0,
    last_hash: prevLock?.last_hash ?? null,
    failed_hashes: prevLock?.failed_hashes ?? [],
    runs: (prevLock?.runs ?? 0) + 1,
  };
  /** Si la corrida no envía nada: libera el candado (corrida nueva) o deja el anterior (resume). */
  const releaseClaim = async () => {
    try {
      if (prevLock) await kv.put(LOCK_KEY, JSON.stringify(prevLock));
      else await kv.delete(LOCK_KEY);
    } catch (err) {
      console.error('aviso:lock-release-failed', err);
    }
  };
  if (!dryRun) {
    if (!(await writeLock(lockState))) return jsonResponse({ skipped: true, reason: 'lock_put_failed' }, 503);
    // Relectura: si otra corrida reclamó a la vez y su escritura quedó, ésta se retira (KV es eventual: best-effort).
    try {
      const again = JSON.parse((await kv.get(LOCK_KEY)) ?? '{}') as Partial<AvisoLock>;
      if (again.run_id && again.run_id !== runId) return jsonResponse({ skipped: true, reason: 'lock_race', lock: again }, 409);
    } catch {
      // sin relectura legible: sigue con el reclamo propio
    }
  }

  // ── Audiencia base (misma de blog-broadcast, pasos 1-4). ──
  const base = await collectLeadBase(kv, token);
  const { counter } = base;
  const excluded = {
    duplicate: base.duplicate,
    unparsable_key: base.unparsableKey,
    attempt_only: base.attemptOnly,
    too_old: 0,
    unsub_kv: 0, // cualquier unsub:<email>:*
    unsub_drip_only: 0, // de los anteriores, solo tenían `drip` (blog-broadcast sí les manda el newsletter)
    suppressed_broadcast: 0,
    suppressed_outbound: 0,
    legacy_unread: 0, // legado sin verificar país por el tope de operaciones KV
  };
  const readBudget = KV_OP_BUDGET - KV_RESERVED;
  let legacyReads = 0;
  const recipients: Recipient[] = [];
  for (const lead of base.byEmail.values()) {
    if (isTooOld(lead, started)) {
      excluded.too_old++;
      continue;
    }
    const scopes = base.unsubScopesByEmail.get(lead.email);
    if (scopes && scopes.size > 0) {
      excluded.unsub_kv++;
      if (scopes.size === 1 && scopes.has('drip')) excluded.unsub_drip_only++;
      continue;
    }
    if (base.broadcastSupp.has(lead.email)) {
      excluded.suppressed_broadcast++;
      continue;
    }
    if (base.outboundSupp.has(lead.email)) {
      excluded.suppressed_outbound++;
      continue;
    }
    // España: solo legado (decideMarketing con permitir_sin_es da 'legacy') y país España en un registro legado.
    let esEspana = false;
    const decision = decideMarketing(base.signalsByEmail.get(lead.email) ?? [{}], 'permitir_sin_es');
    if (decision === 'legacy') {
      const es = await legacySpainCheck(kv, base.legacyKeysByEmail.get(lead.email) ?? [], counter, readBudget, () => {
        legacyReads++;
      });
      if (es === 'unread') {
        excluded.legacy_unread++;
        continue;
      }
      esEspana = es === 'es';
    }
    recipients.push({ email: lead.email, hash: await emailHashFull(lead.email), esEspana });
  }
  recipients.sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
  const eligibleEs = recipients.filter((r) => r.esEspana).length;

  const audienceSummary = {
    campaign: AVISO_CAMPAIGN,
    candidates: base.candidates,
    candidates_by_prefix: base.candidatesByPrefix,
    unique_emails: base.byEmail.size,
    eligible: recipients.length,
    eligible_es: eligibleEs,
    excluded,
    legacy_reads: legacyReads,
    suppression_check: base.suppressionErrors.length ? 'failed' : 'ok',
    suppression_errors: base.suppressionErrors,
    suppression_maybe_truncated: base.suppressionMaybeTruncated,
    kv_list_calls: counter.calls,
    kv_gets: counter.gets,
    kv_list_truncated: counter.truncated,
  };

  const blockers: string[] = [];
  if (excluded.legacy_unread > 0) blockers.push(`legacy_unread=${excluded.legacy_unread}: no se pudo verificar el país de todos los legado (tope KV). Hace falta backfill del país en la metadata.`);
  if (recipients.length > MAX_SENDS_PER_RUN) blockers.push(`eligible=${recipients.length} rebasa el tope de ${MAX_SENDS_PER_RUN} por corrida.`);
  if (counter.truncated) blockers.push('El listado de KV EMAILS llegó al tope de páginas.');
  if (eligibleEs > 0 && !secret) blockers.push('Falta DRIP_UNSUB_SECRET: no se puede firmar confirm_url.');

  if (dryRun) {
    return jsonResponse({
      dry_run: true,
      already_sent: prevLock?.status === 'done',
      lock_status: prevLock?.status ?? null,
      lock_sent: prevLock?.sent ?? null,
      lock_failed_pending: prevLock?.failed_hashes.length ?? null,
      blockers,
      ...audienceSummary,
    });
  }
  if (blockers.length) {
    await releaseClaim();
    return jsonResponse({ skipped: true, reason: 'blocked', blockers, ...audienceSummary }, 409);
  }

  // ── Qué se envía: todo en la corrida nueva; al retomar, lo posterior a last_hash más los fallidos guardados. ──
  const resumeFrom = resume ? prevLock?.last_hash ?? null : null;
  const retrySet = new Set(resume ? prevLock?.failed_hashes ?? [] : []);
  const toSend = resume
    ? recipients.filter((r) => resumeFrom === null || r.hash > resumeFrom || retrySet.has(r.hash))
    : recipients;
  const skippedAlreadySent = recipients.length - toSend.length;
  if (!resume) lockState.eligible = recipients.length;

  let sent = 0;
  let sentEs = 0;
  let failed = 0;
  let failedInactive = 0;
  let consecutiveFails = 0;
  let aborted = false;
  let lastSuccessHash: string | null = null;
  const failedNow: string[] = [];
  let i = 0;
  for (const r of toSend) {
    i++;
    retrySet.delete(r.hash);
    const res = await sendAviso(
      token,
      r.email,
      { es_espana: r.esEspana, confirm_url: r.esEspana ? await buildConfirmUrl(env, r.email, secret) : '', privacidad_url: privacidadUrl },
      AVISO_TAG,
      { source: AVISO_CAMPAIGN, es: r.esEspana ? '1' : '0' },
    );
    if (res === 'ok') {
      sent++;
      if (r.esEspana) sentEs++;
      consecutiveFails = 0;
      lastSuccessHash = r.hash;
    } else if (res === 'inactive') {
      failedInactive++;
      consecutiveFails = 0;
    } else {
      failed++;
      failedNow.push(r.hash);
      consecutiveFails++;
    }
    // last_hash nunca retrocede: los reintentos de fallidos previos van antes del punto de partida.
    lockState.last_hash = maxHash(lockState.last_hash, r.hash);
    if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
      aborted = true;
      // Último envío exitoso de esta corrida (o el punto de partida); los fallidos quedan en failed_hashes.
      lockState.last_hash = maxHash(resumeFrom, lastSuccessHash);
      break;
    }
    if (i % PROGRESS_EVERY === 0) {
      lockState.sent = (prevLock?.sent ?? 0) + sent;
      lockState.sent_es = (prevLock?.sent_es ?? 0) + sentEs;
      lockState.failed_inactive = (prevLock?.failed_inactive ?? 0) + failedInactive;
      lockState.failed_hashes = [...failedNow, ...retrySet];
      lockState.updated_at = new Date().toISOString();
      await writeLock(lockState);
    }
    await sleep(THROTTLE_MS);
  }

  const finished = Date.now();
  const finishedIso = new Date(finished).toISOString();
  lockState.sent = (prevLock?.sent ?? 0) + sent;
  lockState.sent_es = (prevLock?.sent_es ?? 0) + sentEs;
  lockState.failed_inactive = (prevLock?.failed_inactive ?? 0) + failedInactive;
  lockState.failed_hashes = [...failedNow, ...retrySet];
  lockState.status = aborted ? 'sending' : lockState.failed_hashes.length ? 'done_with_failures' : 'done';
  lockState.updated_at = finishedIso;
  const finalLockOk = await writeLock(lockState);

  const report = {
    ...audienceSummary,
    run_id: runId,
    sent,
    sent_es: sentEs,
    failed,
    failed_inactive: failedInactive,
    aborted,
    lock_status: lockState.status,
    failed_pending: lockState.failed_hashes.length,
    total_sent: lockState.sent,
    total_sent_es: lockState.sent_es,
    resumed: resume,
    skipped_already_sent: skippedAlreadySent,
    duration_ms: finished - started,
    started_at: startedIso,
    finished_at: finishedIso,
  };
  try {
    // Sin TTL: conteos de esta corrida, sin correos. El reporte semanal suma todas las corridas.
    await kv.put(`aviso-report:${AVISO_CAMPAIGN}:${startedIso}`, JSON.stringify(report));
  } catch (err) {
    console.error('aviso:report-persist-failed', err);
  }
  await guardarEventoD1(db, `aviso:${AVISO_CAMPAIGN}:${startedIso}`, {
    ts: finishedIso,
    event: 'aviso_privacidad_enviado',
    tag: AVISO_TAG,
    extra: {
      eligible: recipients.length,
      eligible_es: eligibleEs,
      sent,
      sent_es: sentEs,
      failed,
      failed_inactive: failedInactive,
      aborted,
      resumed: resume,
      skipped_already_sent: skippedAlreadySent,
    },
  });

  const problems: string[] = [];
  if (aborted) problems.push(`Corrida abortada tras ${MAX_CONSECUTIVE_FAILS} fallos seguidos (no 406). Candado en sending; revisa Postmark y retoma con ?resume=1 después de 5 min.`);
  if (base.suppressionErrors.length) problems.push(`No se pudo leer la lista de supresiones (${base.suppressionErrors.join('; ')}). Postmark rechaza a los suprimidos (failed_inactive=${failedInactive}).`);
  if (base.suppressionMaybeTruncated) problems.push('La lista de supresiones del stream broadcast trajo 500 o más registros: podría venir incompleta.');
  if (!finalLockOk) problems.push('No se pudo cerrar el candado: revisa aviso-lock antes de volver a correr.');
  if (failed > 0 && !aborted) problems.push(`${failed} envíos fallaron (ver logs aviso:send-failed). Quedan en el candado; se reintentan con ?resume=1.`);
  if (problems.length) {
    await alertOscar(token, `[aviso] Avisos del envío ${AVISO_CAMPAIGN}`, problems.join('\n\n') + `\n\nReporte: aviso-report:${AVISO_CAMPAIGN}:${startedIso}`, 'aviso-alert');
  }

  console.log('aviso:done', JSON.stringify(report));
  return jsonResponse(report, aborted ? 502 : 200);
};
