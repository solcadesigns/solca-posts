/**
 * CV a la medida · ruta interna de prueba de calidad (10 nov 2026).
 *
 * Genera el CV a la medida con el mismo prompt, modelo y validación que la cola de producción, pero sin cobro,
 * sin correo y sin guardar el CV ni la vacante: responde el JSON validado, el reporte de filtros y el DOCX en base64.
 * Solo para Oscar y Claude al evaluar la herramienta con CVs y vacantes reales. Protegida con STATS_KEY
 * (encabezado x-stats-key) y registrada como prueba en `llm_modelo`.
 */
import type { APIRoute } from 'astro';
import { generarCvMedida } from '../../lib/cv-medida-run';
import { construirDocx, aBase64, nombreArchivo } from '../../lib/cv-medida-docx';
import { detectarIdioma, CVM_MAX_CV, CVM_MAX_VACANTE, CVM_MAX_TEXTO_LIBRE } from '../../lib/cv-medida';
import type { CvmJob } from '../../lib/cv-medida-queue';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  const key = env.STATS_KEY as string | undefined;
  if (!key || request.headers.get('x-stats-key') !== key) return json({ error: 'unauthorized' }, 401);
  const apiKey = env.ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) return json({ error: 'no_api_key' }, 500);

  let body: { cv?: string; vacante?: string; textoLibre?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const cv = String(body.cv ?? '').slice(0, CVM_MAX_CV);
  const vacante = String(body.vacante ?? '').slice(0, CVM_MAX_VACANTE);
  const textoLibre = String(body.textoLibre ?? '').slice(0, CVM_MAX_TEXTO_LIBRE);
  if (cv.length < 200 || vacante.length < 200) return json({ error: 'muy_corto' }, 400);

  const id = `prueba-${crypto.randomUUID()}`;
  const job = {
    id,
    cv,
    vacante,
    textoLibre,
    idioma: detectarIdioma(vacante),
    interno: true,
  } as unknown as CvmJob;
  const g = await generarCvMedida(apiKey, job, env.SIMULATOR_METRICS_DB as D1Database | undefined);
  if (!g.ok || !g.cv) return json({ ok: false, status: g.status, ms: g.ms, outputTokens: g.outputTokens, modelo: g.modelo }, 502);
  const docx = await construirDocx(g.cv);
  return json({
    ok: true,
    ms: g.ms,
    outputTokens: g.outputTokens,
    modelo: g.modelo,
    archivo: nombreArchivo(g.cv),
    cv: g.cv,
    reporte: g.reporte,
    docxBase64: aBase64(docx),
  });
};
