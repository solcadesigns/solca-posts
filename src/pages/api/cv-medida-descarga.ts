/**
 * /api/cv-medida-descarga?id=<id> · descarga del DOCX de CV a la medida (6 nov 2026).
 *
 * El id es aleatorio (más de 150 bits) y llega solo en el correo de entrega. KV `cvmd_docx:<id>` guarda los bytes
 * 7 días; después el enlace responde 410. Registra `cvmedida_descarga` (idioma y rol, sin datos personales); las
 * descargas de previsualizadores y bots no cuentan.
 */

import type { APIRoute } from 'astro';
import { docxKey } from '../../lib/cv-medida-queue';
import { deBase64 } from '../../lib/cv-medida-docx';
import { registrarEventoCvm } from '../../lib/cv-medida-run';
import { isBotUserAgent } from '../../lib/attribution';

export const prerender = false;

function texto(status: number, msg: string): Response {
  return new Response(msg, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  const kv = env.CV_LIMITS as KVNamespace | undefined;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!kv || !/^[a-f0-9]{32,48}$/.test(id)) return texto(404, 'Enlace no válido.');
  const raw = await kv.get(docxKey(id));
  if (!raw) return texto(410, 'Este enlace ya venció (dura 7 días). Usa el documento adjunto en el correo o escríbenos a hello@solcaciencia.com.');
  let rec: { b64: string; nombre?: string; job?: string; idioma?: string; rol?: string; interno?: number };
  try {
    rec = JSON.parse(raw);
  } catch {
    return texto(500, 'No pudimos leer el documento. Escríbenos a hello@solcaciencia.com.');
  }
  if (!isBotUserAgent(request.headers.get('user-agent'))) {
    await registrarEventoCvm(env.SIMULATOR_METRICS_DB as D1Database | undefined, 'cvmedida_descarga', {
      jobId: rec.job ?? id,
      idioma: rec.idioma,
      rol: rec.rol,
      interno: rec.interno === 1,
      country: request.headers.get('cf-ipcountry'),
    });
  }
  const nombre = (rec.nombre ?? 'CV.docx').replace(/[^A-Za-z0-9._-]/g, '');
  return new Response(deBase64(rec.b64).buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
};
