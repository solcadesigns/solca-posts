/**
 * Envío diario de los correos de 30 y 90 días del curso V2.0 (24 nov 2026). Lo llama el cron diario (0 15 * * *,
 * después de drip-tick y encuesta-resultado-tick) con `?key=<STATS_KEY>`.
 * Manual: `GET /api/encuesta-curso-tick?key=<STATS_KEY>&dry=1` solo cuenta los vencidos, no envía.
 * Los envíos se programan al recibir la encuesta de cierre (src/lib/encuesta-curso.ts, programarSeguimiento).
 * Máximo SEGUIMIENTO_MAX_POR_CORRIDA por corrida; cada pendiente se intenta hasta 3 veces y su correo se borra
 * en cuanto sale.
 *
 * Envío real SOLO si el host es solcaciencia.com o llega `&enviar=1` (el cron diario lo manda, porque llama por
 * https://internal.cron). En cualquier otro caso (wrangler dev, previews, pruebas) es simulación: no envía, no borra
 * ni registra eventos; solo cuenta.
 * Bajas: se salta (y se borra el pendiente) si existe `unsub:<email>:all` o `unsub:<email>:curso-encuestas` en KV
 * EMAILS. Cada correo lleva el enlace firmado de baja (/api/drip-unsubscribe?scope=curso-encuestas).
 */
import type { APIRoute } from 'astro';
import { sendEmail } from '../../lib/postmark';
import { buildUnsubUrl } from '../../lib/drip';
import {
  CURSO,
  CORREO_REMITENTE,
  renderSeguimiento,
  seguimientosVencidos,
  SEGUIMIENTO_MAX_INTENTOS,
  PREFIJO_SEGUIMIENTO,
  SCOPE_BAJA,
  type KvSeguimiento,
  type SeguimientoPendiente,
} from '../../lib/encuesta-curso';
import { guardarEventoD1 } from '../../lib/eventos-d1';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export const GET: APIRoute = async ({ request, locals }) => {
  const env = ((locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {}) as Record<string, unknown>;
  const statsKey = env.STATS_KEY as string | undefined;
  const url = new URL(request.url);
  if (!statsKey || url.searchParams.get('key') !== statsKey) return json({ ok: false, error: 'unauthorized' }, 401);
  const kv = env.CV_LIMITS as unknown as KvSeguimiento | undefined;
  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (!kv || !token) return json({ ok: false, error: 'config' }, 503);

  const llaves = await seguimientosVencidos(kv);
  if (url.searchParams.get('dry') === '1') return json({ ok: true, dry: true, vencidos: llaves.length });
  const real = url.hostname === 'solcaciencia.com' || url.searchParams.get('enviar') === '1';
  if (!real) return json({ ok: true, simulacion: true, vencidos: llaves.length });

  const emails = env.EMAILS as KVNamespace | undefined;
  const unsubSecret = (env.DRIP_UNSUB_SECRET as string | undefined) ?? '';
  // Sin la lista de bajas o sin la firma del enlace de baja no se envía nada (falla cerrado).
  if (!emails || !unsubSecret) return json({ ok: false, error: 'config_bajas' }, 503);

  let enviados = 0;
  let fallidos = 0;
  let bajas = 0;
  for (const llave of llaves) {
    const raw = await kv.get(llave);
    if (!raw) continue;
    let p: SeguimientoPendiente;
    try {
      p = JSON.parse(raw) as SeguimientoPendiente;
    } catch {
      await kv.delete(llave);
      continue;
    }
    const email = p.email.trim().toLowerCase();
    const [bajaTodo, bajaCurso] = await Promise.all([emails.get(`unsub:${email}:all`), emails.get(`unsub:${email}:${SCOPE_BAJA}`)]);
    if (bajaTodo || bajaCurso) {
      await kv.delete(llave); // dado de baja: el correo deja de guardarse y no se envía
      bajas++;
      await guardarEventoD1(db, `enc-curso-baja:${llave.slice(-36)}`, {
        ts: new Date().toISOString(),
        event: 'encuesta_curso_correo_omitido',
        product: CURSO,
        tag: p.tipo,
        interno: p.interno,
        extra: { motivo: bajaTodo ? 'unsub_all' : 'unsub_curso' },
      }).catch(() => {});
      continue;
    }
    const bajaUrl = `${await buildUnsubUrl(env, email, unsubSecret)}&scope=${SCOPE_BAJA}`;
    const r = renderSeguimiento(p.tipo, { bajaUrl });
    let ok = false;
    try {
      await sendEmail(token, {
        from: CORREO_REMITENTE,
        to: p.email,
        subject: r.subject,
        htmlBody: r.html,
        textBody: r.text,
        tag: `curso-cv-v2-${p.tipo}`,
        metadata: { producto: CURSO, encuesta: p.tipo },
        messageStream: 'outbound',
      });
      ok = true;
    } catch (err) {
      console.warn('encuesta-curso: envío falló', String(err).slice(0, 160));
    }
    if (ok || p.intentos + 1 >= SEGUIMIENTO_MAX_INTENTOS) {
      await kv.delete(llave); // el correo deja de guardarse en KV
    } else {
      // Se reintenta mañana sin extender la caducidad original (fecha de envío + 7 días).
      const venceMs = Date.parse(llave.slice(PREFIJO_SEGUIMIENTO.length, PREFIJO_SEGUIMIENTO.length + 24));
      await kv.put(llave, JSON.stringify({ ...p, intentos: p.intentos + 1 }), {
        expiration: Math.floor(((Number.isFinite(venceMs) ? venceMs : Date.now()) + 7 * 864e5) / 1000),
      });
    }
    if (ok) enviados++;
    else fallidos++;
    const ts = new Date().toISOString();
    await guardarEventoD1(db, `enc-curso-envio:${llave.slice(-36)}:${p.intentos + 1}`, {
      ts,
      event: ok ? 'encuesta_curso_correo_enviado' : 'encuesta_curso_correo_fallido',
      product: CURSO,
      tag: p.tipo,
      interno: p.interno,
      extra: { intento: p.intentos + 1, dias_desde_cierre: Math.round((Date.parse(ts) - Date.parse(p.cierre)) / 864e5) },
    }).catch(() => {});
  }
  return json({ ok: true, vencidos: llaves.length, enviados, fallidos, bajas });
};

export const POST = GET;
