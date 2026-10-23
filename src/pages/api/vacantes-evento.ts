/**
 * /api/vacantes-evento · medición del buscador de vacantes (22 oct 2026).
 *
 * Guarda en D1 `vacantes_eventos`: vistas, filtros, clics a vacantes y paso a
 * herramientas. Los datos de la vacante (rol, país, empresa, nivel) se leen de la
 * tabla `vacantes`, no del cliente. Sin correo ni IP.
 */
import type { APIRoute } from 'astro';
import { extractUtms } from '../../lib/utm';

export const prerender = false;

const EVENTOS = new Set(['vacantes_viewed', 'vacantes_filtered', 'vacancy_clicked', 'tool_clicked']);
const HERRAMIENTAS = new Set(['simulador', 'cv', 'quiz', 'libro']);
const AID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FILTRO_KEYS = ['q', 'pais', 'rol', 'nivel', 'empresa', 'dias'];

function ok(): Response {
  return new Response(null, { status: 204 });
}

function filtrosLimpios(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 600) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const k of FILTRO_KEYS) if (typeof o[k] === 'string' && o[k]) out[k] = (o[k] as string).slice(0, 80);
    return Object.keys(out).length ? JSON.stringify(out) : null;
  } catch {
    return null;
  }
}

// Límite simple por IP (60 eventos por minuto), igual que /api/simulator-events. La IP solo se usa
// como llave temporal del contador (1 minuto) y no se guarda con el evento.
const RL_MAX = 60;
const ORIGENES = /^https:\/\/(www\.)?solcaciencia\.com$/;

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const origin = request.headers.get('origin');
  if (origin && !ORIGENES.test(origin)) return new Response('forbidden', { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response('invalid_json', { status: 400 });
  }
  const evento = typeof body.evento === 'string' ? body.evento : '';
  if (!EVENTOS.has(evento)) return new Response('invalid_event', { status: 400 });

  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (!db) return ok();

  const kv = env.SIMULATOR_METRICS as KVNamespace | undefined;
  if (kv) {
    try {
      const ip = clientAddress ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
      const rlKey = `vac-rl:${ip}`;
      const count = Number.parseInt((await kv.get(rlKey)) ?? '0', 10) || 0;
      if (count >= RL_MAX) return new Response('rate_limited', { status: 429 });
      await kv.put(rlKey, String(count + 1), { expirationTtl: 60 });
    } catch {
      /* el límite falla en suave */
    }
  }

  const vacanteId = typeof body.vacante_id === 'string' ? body.vacante_id.slice(0, 200) : null;
  let vac: { rol?: string; pais?: string; empresa?: string; nivel?: string; tipo_empresa?: string } | null = null;
  if (vacanteId) {
    vac = await db
      .prepare('SELECT rol, pais, empresa, nivel, tipo_empresa FROM vacantes WHERE id = ?')
      .bind(vacanteId)
      .first();
  }
  const utms = extractUtms(body);
  const referrerHost =
    typeof body.referrerHost === 'string' && /^[a-z0-9.-]{1,100}$/i.test(body.referrerHost) ? body.referrerHost.toLowerCase() : null;
  const herramienta = typeof body.herramienta === 'string' && HERRAMIENTAS.has(body.herramienta) ? body.herramienta : null;

  try {
    await db
      .prepare(
        `INSERT INTO vacantes_eventos (ts, evento, aid, vacante_id, rol, pais, empresa, nivel, tipo_empresa, filtros, herramienta,
           utm_source, utm_medium, utm_campaign, referrer_host, pais_visitante)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        new Date().toISOString(),
        evento,
        typeof body.aid === 'string' && AID_RE.test(body.aid) ? body.aid : null,
        vac ? vacanteId : null,
        vac?.rol ?? null, vac?.pais ?? null, vac?.empresa ?? null, vac?.nivel ?? null, vac?.tipo_empresa ?? null,
        filtrosLimpios(body.filtros),
        herramienta,
        utms.utm_source ?? null, utms.utm_medium ?? null, utms.utm_campaign ?? null,
        referrerHost,
        request.headers.get('cf-ipcountry'),
      )
      .run();
  } catch (err) {
    console.error('vacantes-evento insert failed', err);
  }
  return ok();
};
