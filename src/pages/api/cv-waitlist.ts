/**
 * Endpoint · "Avísame cuando esté disponible" del revisor de CV · 6 nov 2026.
 *
 * Guarda el interés de una persona en el CV adaptado a una vacante (producto en construcción; plan en
 * ../consultoria/investigacion/2026-11-plan-revisor-cv.md, fase 4) para avisarle una sola vez cuando exista.
 *
 * Storage: KV `EMAILS`, llave `waitlist:cv-medida:{sha256(email)}` (una por persona; repetir el clic no
 * duplica). El prefijo `waitlist:` no está en SUBSCRIBER_PREFIXES (lib/broadcast-audience.ts), así que nunca
 * entra a newsletters ni drips. Sin TTL: el registro se usa el día del lanzamiento y se marca `avisado_at`.
 *
 * Consentimiento (src/lib/consent.ts): este registro NO es un opt-in comercial y no cambia `marketing_optin`.
 * La base es la solicitud explícita de la persona: hizo clic en "Avísame cuando esté disponible" junto a un
 * texto que dice que se le escribirá una sola vez al correo que dio para su análisis. Un aviso único sobre
 * el producto que pidió es respuesta a su solicitud, no publicidad general; por eso se acepta aunque no haya
 * marcado la casilla comercial. Límites que debe respetar quien mande el aviso (bloque B):
 *   - un solo correo, sobre ese producto, y con enlace de baja;
 *   - antes de enviar, revisar bajas `unsub:<email>:comercial|all` y supresiones de Postmark (ganan siempre);
 *   - no reutilizar esta lista para otra cosa sin un opt-in comercial.
 * Se guarda el texto exacto del botón y de la nota (`texto_aceptado`, versión WAITLIST_TEXT_VERSION).
 *
 * Abuso: tope de 10 llamadas por IP al día; solo se guarda un correo que hizo un análisis en los últimos 30 días (existe su contador
 * `cv-submit:{hash24}` en KV CV_LIMITS, el mismo de lib/rate-limit.ts). Así nadie puede apuntar correos ajenos.
 *
 * Sin ctx.waitUntil: todo con await (no funciona en Astro sobre Workers).
 */

import type { APIRoute } from 'astro';
import { emailHashFull } from '../../lib/attribution';
import { checkCvSubmitLimit } from '../../lib/rate-limit';
import { readRolObjetivo, WAITLIST_TEXT, WAITLIST_TEXT_VERSION } from '../../lib/cv-review-rubric';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRODUCTOS = new Set(['cv-medida']);
const ORIGENES = new Set(['pantalla', 'pdf']);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Tope por IP (contador en CV_LIMITS, 1 día) para que nadie genere escrituras sin límite.
const IP_MAX_DIA = 10;

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const producto = String(body.producto ?? 'cv-medida');
  const origen = ORIGENES.has(String(body.origen)) ? String(body.origen) : 'pantalla';
  if (!EMAIL_RE.test(email) || email.length > 200) return json({ error: 'invalid_email' }, 400);
  if (!PRODUCTOS.has(producto)) return json({ error: 'invalid_product' }, 400);

  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  const limits = env.CV_LIMITS as KVNamespace | undefined;
  const kv = env.EMAILS as KVNamespace | undefined;

  if (limits) {
    const ip = request.headers.get('cf-connecting-ip') ?? clientAddress ?? 'unknown';
    const ipKey = `wl-ip:${ip}`;
    try {
      const n = parseInt((await limits.get(ipKey)) ?? '0', 10) || 0;
      if (n >= IP_MAX_DIA) return json({ ok: true });
      await limits.put(ipKey, String(n + 1), { expirationTtl: 24 * 60 * 60 });
    } catch {
      // tope best-effort
    }
    // Prueba de que este correo hizo un análisis (contador vivo 30 días). Sin análisis la respuesta es la
    // misma que con éxito y no se guarda nada: así el endpoint no revela quién usó el revisor.
    const st = await checkCvSubmitLimit(limits, email);
    if (st.count < 1) return json({ ok: true });
  }

  const hash = await emailHashFull(email);
  const key = `waitlist:${producto}:${hash}`;
  const now = new Date().toISOString();
  if (!kv || typeof kv.put !== 'function') {
    console.log('cv-waitlist:no-kv', producto, hash.slice(0, 12));
    return json({ ok: true });
  }
  try {
    const prev = await kv.get(key);
    const prevRec = prev ? (JSON.parse(prev) as Record<string, unknown>) : null;
    // Clics repetidos dentro de una hora no reescriben el registro.
    if (prevRec && typeof prevRec.updated_at === 'string' && Date.now() - Date.parse(prevRec.updated_at) < 60 * 60 * 1000) {
      return json({ ok: true });
    }
    const record = {
      email,
      email_hash: hash,
      producto,
      ts: (prevRec?.ts as string | undefined) ?? now, // primer clic
      updated_at: now,
      clics: (typeof prevRec?.clics === 'number' ? prevRec.clics : 0) + 1,
      origen,
      rol_objetivo: readRolObjetivo(body.rol_objetivo),
      base: 'solicitud_explicita',
      alcance: 'un_aviso_de_disponibilidad',
      texto_aceptado: WAITLIST_TEXT,
      texto_version: WAITLIST_TEXT_VERSION,
      avisado_at: (prevRec?.avisado_at as string | null | undefined) ?? null,
    };
    await kv.put(key, JSON.stringify(record));
  } catch (err) {
    console.error('cv-waitlist:kv-failed', err);
    return json({ error: 'store_failed' }, 500);
  }
  return json({ ok: true });
};
