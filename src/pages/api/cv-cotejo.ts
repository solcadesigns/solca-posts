/**
 * POST /api/cv-cotejo · comparación gratis del CV con una vacante (10 nov 2026).
 * Lógica en src/lib/cv-cotejo.ts; especificación en ../consultoria/investigacion/2026-12-spec-recorrido-revisor-cv-medida.md
 *
 * Interna hasta el lanzamiento de diciembre: solo responde con la bandera de tráfico propio (`interno: true`, que
 * BaseLayout manda tras abrir el sitio con ?interno=1) o con x-stats-key. Para abrirla al público:
 *   npx wrangler kv key put --binding=CV_LIMITS cotejo_publico 1 --remote
 *
 * Body: { cv, vacante? | vacanteId?, email, consent: true, ref?, aid/ft/lt/interno, utm_* }
 *   vacanteId: id de la tabla `vacantes` (buscador); el texto sale de D1, nunca del cliente ni de la URL.
 * Respuesta: { ok, puesto, empresa, rol, indispensables, deseables, requisitos[{requisito, prioridad, estado}] }
 *   Sin la evidencia del CV (no hace falta en pantalla y evita devolver texto del CV).
 *
 * Costo y abuso: kill switch `anthropic_paused`, 5 comparaciones por correo al día, 10 por IP al día, tope global
 * de 100 al día. La clasificación de cada vacante se guarda 30 días en KV (una vacante del buscador se clasifica una
 * sola vez para todos).
 */
import type { APIRoute } from 'astro';
import {
  vacanteClasificada,
  evaluarCv,
  COTEJO_MIN_CV,
  COTEJO_MAX_CV,
  COTEJO_MIN_VACANTE,
  COTEJO_MAX_VACANTE,
  COTEJO_MAX_VACANTE_BUSCADOR,
  COTEJO_VERSION,
} from '../../lib/cv-cotejo';
import { extractAttribution, emailHashFull } from '../../lib/attribution';
import { extractUtms } from '../../lib/utm';
import { registrarConsentimiento, CONSENT_MSG } from '../../lib/consent';
import { guardarEventoD1, registrarModeloD1 } from '../../lib/eventos-d1';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_POR_CORREO_DIA = 5;
const MAX_POR_IP_DIA = 10;
const TOPE_GLOBAL_DIA = 100;
const REFS = new Set(['cv', 'vacantes', 'linkedin', 'correo', 'directo']);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/** Suma uno al contador y devuelve el nuevo valor. Si ya rebasó el máximo no escribe (cuida la cuota de KV). */
async function contar(kv: KVNamespace | undefined, clave: string, max: number): Promise<number> {
  if (!kv) return 0;
  const n = (Number.parseInt((await kv.get(clave)) ?? '0', 10) || 0) + 1;
  if (n <= max) await kv.put(clave, String(n), { expirationTtl: 60 * 60 * 48 });
  return n;
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = ((locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {}) as Record<string, unknown>;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_json', message: 'Body inválido.' }, 400);
  }

  const attr = extractAttribution(body);
  const statsKey = env.STATS_KEY as string | undefined;
  const conLlave = Boolean(statsKey) && request.headers.get('x-stats-key') === statsKey;
  const limitsKV = env.CV_LIMITS as KVNamespace | undefined;
  const publico = limitsKV ? (await limitsKV.get('cotejo_publico')) === '1' : false;
  if (!publico && !attr.interno && !conLlave) return json({ error: 'no_disponible', message: 'Esta herramienta todavía no está disponible.' }, 404);
  const interno = attr.interno === true || conLlave;

  const cv = String(body.cv ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const ref = REFS.has(String(body.ref)) ? String(body.ref) : 'directo';
  if (body.consent !== true) return json({ error: 'consent_required', message: CONSENT_MSG.privacidad_requerida }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'invalid_email', message: 'Correo inválido.' }, 400);
  if (cv.length < COTEJO_MIN_CV) return json({ error: 'cv_too_short', message: `El CV es muy corto (mínimo ${COTEJO_MIN_CV} caracteres).` }, 400);
  if (cv.length > COTEJO_MAX_CV) return json({ error: 'cv_too_long', message: `El CV excede ${COTEJO_MAX_CV.toLocaleString('es-MX')} caracteres.` }, 400);

  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  let vacante = '';
  const vacanteId = typeof body.vacanteId === 'string' ? body.vacanteId.slice(0, 120) : '';
  if (vacanteId) {
    try {
      const row = db
        ? await db.prepare('SELECT descripcion, titulo, empresa FROM vacantes WHERE id = ? AND activa = 1').bind(vacanteId).first<{ descripcion: string | null; titulo: string; empresa: string }>()
        : null;
      if (row?.descripcion) vacante = `${row.titulo} · ${row.empresa}\n\n${row.descripcion}`.slice(0, COTEJO_MAX_VACANTE_BUSCADOR);
    } catch {
      /* cae al error de abajo */
    }
    if (!vacante) return json({ error: 'vacante_no_encontrada', message: 'Esta vacante ya no está activa o no tiene descripción. Pega el texto de la vacante.' }, 404);
  } else {
    vacante = String(body.vacante ?? '').trim();
    if (vacante.length < COTEJO_MIN_VACANTE) return json({ error: 'vacante_too_short', message: `La vacante es muy corta (mínimo ${COTEJO_MIN_VACANTE} caracteres). Pega el texto completo.` }, 400);
    if (vacante.length > COTEJO_MAX_VACANTE) return json({ error: 'vacante_too_long', message: `La vacante excede ${COTEJO_MAX_VACANTE.toLocaleString('es-MX')} caracteres. Quita beneficios y descripción de la empresa.` }, 400);
  }

  const apiKey = env.ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) return json({ error: 'config_error', message: 'El servicio está en mantenimiento. Intenta más tarde.' }, 503);
  const simKV = env.SIMULATOR_SESSIONS as KVNamespace | undefined;
  if (simKV && (await simKV.get('anthropic_paused'))) return json({ error: 'paused', message: 'La comparación está en pausa por mantenimiento. Intenta más tarde.' }, 503);

  const dia = new Date().toISOString().slice(0, 10);
  const emailHash = await emailHashFull(email);
  const ip = (await emailHashFull(clientAddress ?? request.headers.get('cf-connecting-ip') ?? 'sin-ip')).slice(0, 24); // solo el hash, nunca la IP
  if (!conLlave) {
    if ((await contar(limitsKV, `cotejo:lim:${emailHash.slice(0, 24)}:${dia}`, MAX_POR_CORREO_DIA)) > MAX_POR_CORREO_DIA)
      return json({ error: 'rate_limited', message: `Ya hiciste ${MAX_POR_CORREO_DIA} comparaciones hoy con este correo. Vuelve mañana.` }, 429);
    if ((await contar(limitsKV, `cotejo:ip:${ip}:${dia}`, MAX_POR_IP_DIA)) > MAX_POR_IP_DIA)
      return json({ error: 'rate_limited', message: 'Alcanzaste el límite de comparaciones de hoy. Vuelve mañana.' }, 429);
    if ((await contar(limitsKV, `cotejo:dia:${dia}`, TOPE_GLOBAL_DIA)) > TOPE_GLOBAL_DIA)
      return json({ error: 'daily_cap', message: 'Hoy alcanzamos el cupo diario de comparaciones. Vuelve mañana.' }, 503);
  }

  const ts = new Date().toISOString();
  const country = request.headers.get('cf-ipcountry');
  const utms = extractUtms(body);
  const tag = emailHash.slice(0, 12);
  const evento = (event: string, extra: Record<string, string | number | undefined>) =>
    guardarEventoD1(db, `cotejo:${ts}:${tag}:${event}`, {
      ts: new Date().toISOString(),
      event,
      product: 'cv-medida',
      country: country ?? undefined,
      ...utms,
      aid: attr.aid,
      ft: attr.ft,
      lt: attr.lt,
      interno,
      extra: { ref, version: COTEJO_VERSION, buscador: vacanteId ? 1 : 0, ...extra },
    }).catch(() => {});

  await registrarConsentimiento(db, { ts, emailHash, form: 'cotejo', marketing: false, attr: interno ? { ...attr, interno: true } : attr, utms, country });
  await evento('cvm_cotejo_inicio', { cv_len: cv.length, vac_len: vacante.length });

  const vac = await vacanteClasificada(apiKey, limitsKV, vacante);
  if (!vac.cache) {
    await registrarModeloD1(db, {
      ruta: 'cotejo_vacante', ok: vac.ok, modeloPedido: 'claude-haiku-5-5', modelo: vac.modelo, respaldo: vac.respaldo,
      outputTokens: vac.outputTokens, ms: vac.ms, error: vac.ok ? undefined : vac.status, esPrueba: interno,
    });
  }
  if (!vac.ok || !vac.valor) {
    await evento('cvm_cotejo_error', { paso: 'vacante', status: vac.status });
    const msg = vac.status === 'vacante_sin_requisitos'
      ? 'No encontramos requisitos claros en el texto de la vacante. Revisa que incluyas la sección de requisitos.'
      : 'No pudimos analizar la vacante. Intenta de nuevo en unos minutos.';
    return json({ error: vac.status, message: msg }, vac.status === 'vacante_sin_requisitos' ? 422 : 502);
  }

  const ev = await evaluarCv(apiKey, cv, vac.valor);
  await registrarModeloD1(db, {
    ruta: 'cotejo_cv', ok: ev.ok, modeloPedido: 'claude-haiku-5-5', modelo: ev.modelo, respaldo: ev.respaldo,
    outputTokens: ev.outputTokens, ms: ev.ms, error: ev.ok ? undefined : ev.status, esPrueba: interno,
  });
  if (!ev.ok || !ev.valor) {
    await evento('cvm_cotejo_error', { paso: 'cv', status: ev.status });
    return json({ error: ev.status, message: 'No pudimos comparar tu CV. Intenta de nuevo en unos minutos.' }, 502);
  }

  const r = ev.valor;
  await evento('cvm_cotejo_visto', {
    rol: r.rol,
    ind_total: r.indispensables.total,
    ind_cumple: r.indispensables.cumple,
    ind_parcial: r.indispensables.parcial,
    des_total: r.deseables.total,
    des_cumple: r.deseables.cumple,
    des_parcial: r.deseables.parcial,
    evid_descartadas: r.evidenciasDescartadas,
    cache: vac.cache ? 1 : 0,
    ms: (vac.ms ?? 0) + (ev.ms ?? 0),
  });

  return json({
    ok: true,
    puesto: r.puesto,
    empresa: r.empresa,
    rol: r.rol,
    indispensables: r.indispensables,
    deseables: r.deseables,
    requisitos: r.requisitos.map((q) => ({ requisito: q.requisito, prioridad: q.prioridad, estado: q.estado })),
    ...(conLlave ? { prueba: { requisitosVacante: vac.valor.requisitos, evidencias: r.requisitos.map((q) => q.evidencia), descartados: vac.valor.descartados, evidenciasDescartadas: r.evidenciasDescartadas, cache: vac.cache } } : {}),
  });
};
