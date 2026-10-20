/**
 * /api/market-survey · encuesta de mercado unificada (catálogo v1, 20 oct 2026).
 *
 * POST { mode, aid?, origen, raw?, answers?, utm_*?, referrerHost? }
 *   - mode 'start': guarda la copia anonimizada de los datos operativos (`raw`)
 *     y devuelve qué preguntas mostrar (`ask`, máximo 3).
 *   - mode 'answers': guarda las respuestas de la encuesta (`answers`) y, si viene, `raw`.
 *
 * Privacidad: este endpoint nunca recibe correo, nombre, CV ni texto libre. El `aid`
 * es aleatorio y solo viaja aquí; los endpoints operativos no lo reciben.
 * Diseño: _docs/CATALOGO_ENCUESTA_MERCADO.md.
 */
import type { APIRoute } from 'astro';
import {
  CATALOGO_VERSION,
  ORIGENES,
  isQuestion,
  isValidValue,
  pickQuestions,
  mapPais,
  mapEtapaSimulador,
  mapFormacionSimulador,
  mapRolSimulador,
  mapRolQuiz,
  type MappedAnswer,
  type Origen,
} from '../../lib/market-catalog';
import { extractUtms } from '../../lib/utm';

export const prerender = false;

const AID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KNOWN_WINDOW_DAYS = 90;
const MAX_ANSWERS = 10;

interface RawOperational {
  pais_label?: string;
  sim_academicLevel?: string;
  sim_experienceYears?: string;
  sim_formationArea?: string;
  sim_roleGeneric?: string;
  sim_mode?: string;
  quiz_selfMatch?: string;
  quiz_role?: string;
  edad?: string;
  genero?: string;
}

interface MarketRequest {
  mode?: 'start' | 'answers';
  aid?: string;
  origen?: string;
  raw?: RawOperational;
  answers?: Record<string, string>;
  referrerHost?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function str(v: unknown, max = 60): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
}

function cleanHost(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase().slice(0, 100);
  return /^[a-z0-9.-]+$/.test(v) ? v : null;
}

/** Traduce los datos operativos de la herramienta a respuestas del catálogo. */
function deriveFromRaw(origen: Origen, raw: RawOperational | undefined): MappedAnswer[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: Array<MappedAnswer | null> = [];
  out.push(mapPais(str(raw.pais_label, 40)));
  if (origen === 'simulador') {
    const formation = str(raw.sim_formationArea);
    out.push(mapEtapaSimulador(str(raw.sim_academicLevel), str(raw.sim_experienceYears), formation));
    out.push(mapFormacionSimulador(formation));
    // En modo vacante (A) el rol es texto libre: no se copia.
    if (raw.sim_mode !== 'A') out.push(mapRolSimulador(typeof raw.sim_roleGeneric === 'string' ? raw.sim_roleGeneric : undefined));
  }
  if (origen === 'quiz') {
    out.push(mapRolQuiz(str(raw.quiz_selfMatch, 20), 'rol_interes'));
    out.push(mapRolQuiz(str(raw.quiz_role, 20), 'rol_resultado_quiz'));
  }
  const edad = str(raw.edad, 20);
  if (edad && isValidValue('edad', edad)) out.push({ pregunta: 'edad', valor: edad });
  const genero = str(raw.genero, 20);
  if (genero && isValidValue('genero', genero)) out.push({ pregunta: 'genero', valor: genero });
  return out.filter((a): a is MappedAnswer => a !== null && isValidValue(a.pregunta, a.valor));
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: MarketRequest;
  try {
    body = (await request.json()) as MarketRequest;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const origen = body.origen as Origen;
  if (!ORIGENES.includes(origen)) return json({ ok: false, error: 'invalid_origen' }, 400);
  const mode = body.mode === 'answers' ? 'answers' : 'start';
  const aid = typeof body.aid === 'string' && AID_RE.test(body.aid) ? body.aid : null;

  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const db = runtime?.env?.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (!db) return json({ ok: false, error: 'db_missing' }, 500);

  const utms = extractUtms(body as unknown as Record<string, unknown>);
  const referrerHost = cleanHost(body.referrerHost);
  const ts = new Date().toISOString();

  const rows: Array<{ tipo: 'derivado' | 'encuesta'; a: MappedAnswer }> = deriveFromRaw(origen, body.raw).map((a) => ({
    tipo: 'derivado',
    a,
  }));

  if (mode === 'answers' && body.answers && typeof body.answers === 'object') {
    for (const [q, v] of Object.entries(body.answers).slice(0, MAX_ANSWERS)) {
      if (!isQuestion(q) || typeof v !== 'string' || !isValidValue(q, v)) continue;
      rows.push({ tipo: 'encuesta', a: { pregunta: q, valor: v } });
    }
  }

  if (rows.length > 0) {
    const stmt = db.prepare(
      `INSERT INTO mercado_respuestas
        (aid, origen, tipo, pregunta, valor, valor_detalle, utm_source, utm_medium, utm_campaign, referrer_host, ts, catalogo_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    try {
      await db.batch(
        rows.map(({ tipo, a }) =>
          stmt.bind(
            aid, origen, tipo, a.pregunta, a.valor, a.valor_detalle ?? null,
            utms.utm_source ?? null, utms.utm_medium ?? null, utms.utm_campaign ?? null,
            referrerHost, ts, CATALOGO_VERSION,
          ),
        ),
      );
    } catch (err) {
      console.error('market-survey insert failed', err);
      return json({ ok: false, error: 'db_error' }, 500);
    }
  }

  if (mode === 'answers') return json({ ok: true, saved: rows.length });

  // mode 'start': lo que ya sabemos de esta persona (este uso + últimos 90 días del aid).
  const known = new Set(rows.map((r) => r.a.pregunta));
  if (aid) {
    const since = new Date(Date.now() - KNOWN_WINDOW_DAYS * 86400000).toISOString();
    try {
      const res = await db
        .prepare('SELECT DISTINCT pregunta FROM mercado_respuestas WHERE aid = ? AND ts >= ?')
        .bind(aid, since)
        .all<{ pregunta: string }>();
      for (const r of res.results ?? []) known.add(r.pregunta);
    } catch (err) {
      console.error('market-survey known query failed', err);
    }
  }
  const ask = pickQuestions(origen, known, Math.floor(Math.random() * 1000));
  return json({ ok: true, ask });
};
