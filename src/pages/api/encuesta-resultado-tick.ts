/**
 * Envío diario de la encuesta de resultado a 14 días (11 nov 2026). Lo llama el cron diario (0 15 * * *, después
 * de drip-tick) con `?key=<STATS_KEY>`. Manual: `GET /api/encuesta-resultado-tick?key=<STATS_KEY>&dry=1` (solo cuenta).
 * Lógica en src/lib/encuesta-resultado.ts. Máximo 50 correos por corrida; cada pendiente se intenta hasta 3 veces y
 * su correo se borra en cuanto sale.
 */
import type { APIRoute } from 'astro';
import { sendEmail } from '../../lib/postmark';
import { CVM_EMAIL_FROM } from '../../lib/cv-medida-email';
import {
  pendientesVencidas,
  renderEncuesta,
  tokenDeLlave,
  ENCUESTA_MAX_INTENTOS,
  type EncuestaPendiente,
  type KvEncuesta,
} from '../../lib/encuesta-resultado';
import { guardarEventoD1 } from '../../lib/eventos-d1';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export const GET: APIRoute = async ({ request, locals }) => {
  const env = ((locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {}) as Record<string, unknown>;
  const statsKey = env.STATS_KEY as string | undefined;
  const url = new URL(request.url);
  if (!statsKey || url.searchParams.get('key') !== statsKey) return json({ ok: false, error: 'unauthorized' }, 401);
  const kv = env.CV_LIMITS as unknown as KvEncuesta | undefined;
  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (!kv || !token) return json({ ok: false, error: 'config' }, 503);

  const llaves = await pendientesVencidas(kv);
  if (url.searchParams.get('dry') === '1') return json({ ok: true, dry: true, vencidas: llaves.length });

  let enviados = 0;
  let fallidos = 0;
  for (const llave of llaves) {
    const raw = await kv.get(llave);
    if (!raw) continue;
    let p: EncuestaPendiente;
    try {
      p = JSON.parse(raw) as EncuestaPendiente;
    } catch {
      await kv.delete(llave);
      continue;
    }
    const t = tokenDeLlave(llave);
    const r = renderEncuesta({ puesto: p.puesto }, t);
    let ok = false;
    try {
      await sendEmail(token, {
        from: CVM_EMAIL_FROM,
        to: p.email,
        subject: r.subject,
        htmlBody: r.html,
        textBody: r.text,
        tag: 'encuesta-resultado',
        metadata: { producto: 'cv-medida' },
        messageStream: 'outbound',
      });
      ok = true;
    } catch (err) {
      console.warn('encuesta: envío falló', String(err).slice(0, 160));
    }
    if (ok || p.intentos + 1 >= ENCUESTA_MAX_INTENTOS) {
      await kv.delete(llave); // el correo deja de guardarse
    } else {
      // Se reintenta mañana; la caducidad absoluta (21 días) no se extiende.
      await kv.put(llave, JSON.stringify({ ...p, intentos: p.intentos + 1 }), { expiration: Math.floor((Date.parse(p.entregado) + 21 * 864e5) / 1000) });
    }
    if (ok) enviados++;
    else fallidos++;
    const ts = new Date().toISOString();
    await guardarEventoD1(db, `encuesta-envio:${t}:${p.intentos + 1}`, {
      ts,
      event: ok ? 'encuesta_enviada' : 'encuesta_envio_fallido',
      product: 'cv-medida',
      interno: p.interno,
      extra: { rol: p.rol, idioma: p.idioma, intento: p.intentos + 1 },
    }).catch(() => {});
  }
  return json({ ok: true, vencidas: llaves.length, enviados, fallidos });
};

export const POST = GET;
