/**
 * /api/encuesta-curso · respuestas de las encuestas del curso V2.0 (inicio, cierre, 30 y 90 días) · 24 nov 2026.
 *
 * POST JSON { tipo, respuestas, utm_*?, referrer?, aid?, ft?, lt?, interno?, alumno? }
 *   - Valida contra el catálogo (src/lib/encuesta-curso.ts) y guarda una fila en D1 `curso_encuestas`
 *     (migrations/0015) con fecha, tipo, correo, hash del correo, UTMs y la etiqueta curso_cv_v2.
 *   - Evento `encuesta_curso_enviada` en D1 `eventos` (la vista la registra el navegador como page_viewed).
 *   - Si es la encuesta de cierre, programa los correos de 30 y 90 días (KV CV_LIMITS).
 *
 * Antispam: el mismo mecanismo de /api/simulator-events: user-agent de bot fuera y tope por IP en KV
 * (SIMULATOR_METRICS, llave `enc-curso-rl:<ip>`, 10 envíos por hora).
 * Tráfico interno (?interno=1 → `interno: true`): se guarda con interno=1 y no programa correos.
 */
import type { APIRoute } from 'astro';
import { CURSO, ENCUESTA_CURSO_VERSION, esTipo, validarRespuestas, MENSAJES_ERROR, programarSeguimiento, type KvSeguimiento } from '../../lib/encuesta-curso';
import { extractUtms } from '../../lib/utm';
import { extractAttribution, emailHashFull, isBotUserAgent } from '../../lib/attribution';
import { esDesdeCurso } from '../../lib/cv-review-rubric';
import { guardarEventoD1, referrerHost } from '../../lib/eventos-d1';

export const prerender = false;

const RL_MAX = 10;
const RL_VENTANA_S = 60 * 60;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'invalid_json' }, 400);
  if (!esTipo(body.tipo)) return json({ ok: false, error: 'tipo_invalido' }, 400);
  const tipo = body.tipo;

  if (isBotUserAgent(request.headers.get('user-agent'))) return json({ ok: false, error: 'rechazado' }, 403);

  const env = ((locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {}) as Record<string, unknown>;
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (!db) return json({ ok: false, error: 'config' }, 503);

  // Tope por IP (soft-fail si KV no responde, igual que simulator-events).
  const kvRl = env.SIMULATOR_METRICS as KVNamespace | undefined;
  const ip = clientAddress ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (kvRl) {
    try {
      const llave = `enc-curso-rl:${ip}`;
      const n = parseInt((await kvRl.get(llave)) ?? '0', 10) || 0;
      if (n >= RL_MAX) return json({ ok: false, error: 'rate_limited', message: 'Recibimos varios envíos desde tu conexión. Intenta de nuevo en una hora.' }, 429);
      await kvRl.put(llave, String(n + 1), { expirationTtl: RL_VENTANA_S });
    } catch {
      // seguimos
    }
  }

  const v = validarRespuestas(tipo, body.respuestas);
  if (!v.ok) return json({ ok: false, error: v.error, pregunta: v.pregunta, message: MENSAJES_ERROR[v.error] ?? 'Revisa tus respuestas.' }, 400);

  const utms = extractUtms(body);
  const attr = extractAttribution(body);
  const interno = attr.interno === true;
  const alumno = !interno && (body.alumno === true || esDesdeCurso(utms));
  const emailHash = await emailHashFull(v.email);
  const ts = new Date().toISOString();
  const id = `${tipo}:${ts}:${crypto.randomUUID().slice(0, 8)}`;
  const country = (request.headers.get('cf-ipcountry') ?? '').slice(0, 2) || null;
  const refHost = referrerHost(body.referrer);

  try {
    await db
      .prepare(
        `INSERT INTO curso_encuestas
          (id, ts, dia, curso, tipo, version, email, email_hash, respuestas,
           utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer_host, aid, alumno, interno, country)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, ts, ts.slice(0, 10), CURSO, tipo, ENCUESTA_CURSO_VERSION, v.email, emailHash, JSON.stringify(v.respuestas),
        utms.utm_source ?? null, utms.utm_medium ?? null, utms.utm_campaign ?? null, utms.utm_content ?? null, utms.utm_term ?? null,
        refHost, attr.aid ?? null, alumno ? 1 : 0, interno ? 1 : 0, country,
      )
      .run();
  } catch (err) {
    console.error('encuesta-curso: insert falló', String((err as Error)?.message ?? err).slice(0, 200));
    return json({ ok: false, error: 'db_error', message: 'No pudimos guardar tus respuestas. Intenta de nuevo en unos minutos.' }, 500);
  }

  // Programar 30 y 90 días al cerrar el curso (no para tráfico interno).
  let programados = 0;
  if (tipo === 'cierre' && !interno) {
    const kv = env.CV_LIMITS as unknown as KvSeguimiento | undefined;
    if (kv) programados = await programarSeguimiento(kv, { email: v.email, emailHash, interno });
  }

  // Evento de medición (sin correo). Misma tabla que el resto de los eventos del sitio.
  await guardarEventoD1(db, `enc-curso:${id}`, {
    ts,
    event: 'encuesta_curso_enviada',
    product: CURSO,
    tag: tipo,
    ...utms,
    referrer: typeof body.referrer === 'string' ? body.referrer : undefined,
    country: country ?? undefined,
    aid: attr.aid,
    ft: attr.ft,
    lt: attr.lt,
    interno,
    extra: { alumno: alumno ? 1 : 0, seguimiento_programado: programados },
  }).catch(() => {});

  return json({ ok: true });
};
