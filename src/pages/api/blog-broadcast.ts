import type { APIRoute } from 'astro';
import { sendEmailWithTemplate, PostmarkError } from '../../lib/postmark';
import { getCollection } from 'astro:content';

export const prerender = false;

/**
 * Broadcast semanal del blog más reciente a los suscriptores KV EMAILS.
 * Triggered por cron Vie 8am CDMX (14:00 UTC · `0 14 * * 5`).
 *
 * Diseño defensivo:
 * 1. Solo se ejecuta si el request viene del scheduled handler (auth vía secret) o del cron oficial.
 * 2. Solo envía si hay un blog publicado en los últimos 7 días.
 * 3. Rate limit: ~10 emails por segundo max, con throttling entre envíos.
 * 4. Excluye emails ya marcados como suppressed (bounces) o unsubscribed.
 * 5. Log agregado (enviados/skipped/failed) a KV para métrica semanal.
 *
 * NO importa listas externas. Solo usa KV EMAILS que crece por opt-in nativo.
 */

interface EmailRecord {
  email: string;
  ts: string; // ISO timestamp de opt-in
  country?: string;
  optedInAt?: string; // alias de ts para claridad
  suppressed?: boolean; // hard bounce o queja spam
  unsubscribedAt?: string; // click en unsubscribe
}

interface BroadcastReport {
  blog_slug: string;
  blog_title: string;
  candidates: number;
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  started_at: string;
  finished_at: string;
}

const THROTTLE_MS = 100; // ~10 emails/segundo — bajo el límite Postmark
const MAX_AGE_DAYS = 730; // 2 años · alineado con política Brevo aprendida

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * Auth: verifica que el request tiene el header X-Broadcast-Secret que coincide con
 * el secret BROADCAST_SECRET. Impide que endpoint sea llamado desde fuera del cron.
 */
function isAuthorized(request: Request, env: Record<string, unknown>): boolean {
  const provided = request.headers.get('x-broadcast-secret');
  const expected = env.BROADCAST_SECRET as string | undefined;
  if (!expected) return false;
  return provided === expected;
}

/**
 * Determina si un contacto es elegible para broadcast:
 * - No suppressed (hard bounce previo)
 * - No unsubscribed
 * - Opt-in dentro de últimos 2 años (política anti-lista-vieja)
 */
function isEligible(rec: EmailRecord, nowMs: number): boolean {
  if (rec.suppressed) return false;
  if (rec.unsubscribedAt) return false;
  const optInMs = new Date(rec.optedInAt ?? rec.ts).getTime();
  if (isNaN(optInMs)) return false;
  const ageDays = (nowMs - optInMs) / (1000 * 60 * 60 * 24);
  return ageDays <= MAX_AGE_DAYS;
}

/**
 * Obtiene el blog más reciente publicado en los últimos 7 días.
 * Si no hay ninguno reciente, retorna null y el broadcast se salta.
 */
async function getLatestBlog() {
  const posts = await getCollection('blog');
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recent = posts
    .filter((p) => p.data.pubDate.getTime() >= sevenDaysAgo && p.data.pubDate.getTime() <= now)
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  return recent[0] ?? null;
}

/**
 * Envía UN email vía Postmark template blog-broadcast-weekly.
 * TemplateModel: { first_name, blog_title, blog_hook, blog_url, blog_image_url }
 */
async function sendOne(
  token: string,
  to: string,
  firstName: string | undefined,
  blogTitle: string,
  blogHook: string,
  blogUrl: string,
  blogImageUrl: string,
): Promise<boolean> {
  try {
    await sendEmailWithTemplate(token, {
      from: 'Oscar Solís <hola@solcaciencia.com>',
      to,
      templateAlias: 'blog-broadcast-weekly',
      templateModel: {
        first_name: firstName ?? '',
        blog_title: blogTitle,
        blog_hook: blogHook,
        blog_url: blogUrl,
        blog_image_url: blogImageUrl,
      },
      tag: 'blog-broadcast',
      messageStream: 'broadcast', // stream separado del transactional
      metadata: { source: 'blog-broadcast-weekly' },
    });
    return true;
  } catch (err) {
    if (err instanceof PostmarkError) {
      console.error(`broadcast:send-failed to=${to} status=${err.status}`, JSON.stringify(err.body));
    } else {
      console.error(`broadcast:send-failed to=${to}`, err);
    }
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};

  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!token) {
    return jsonResponse({ error: 'no_postmark_token' }, 503);
  }

  const emailsKv = env.EMAILS as KVNamespace | undefined;
  if (!emailsKv) {
    return jsonResponse({ error: 'no_emails_kv' }, 503);
  }

  const started = Date.now();
  const startedIso = new Date(started).toISOString();

  // 1. Buscar blog más reciente (últimos 7 días)
  const post = await getLatestBlog();
  if (!post) {
    console.log('broadcast:skipped no-recent-blog');
    return jsonResponse({ skipped: true, reason: 'no_recent_blog', started_at: startedIso });
  }

  const blogUrl = `https://solcaciencia.com/blog/${post.slug}`;
  const blogTitle = post.data.title;
  // Hook: primeras ~150 palabras del cuerpo (Postmark decide el rendering final vía template)
  const bodyText = post.body ?? '';
  const blogHook = bodyText.split(/\s+/).slice(0, 30).join(' ') + '…';
  // Hero image: heroImage del frontmatter viene como "/blog/slug.png"; agregamos el host absoluto
  // para que Postmark/clientes de correo puedan cargarla desde cualquier lado.
  const heroPath = (post.data as { heroImage?: string }).heroImage ?? `/blog/${post.slug}.png`;
  const blogImageUrl = heroPath.startsWith('http')
    ? heroPath
    : `https://solcaciencia.com${heroPath}`;

  // 2. Listar candidatos de KV EMAILS (todas las keys)
  const list = await emailsKv.list({ limit: 1000 });
  const candidates: EmailRecord[] = [];
  for (const key of list.keys) {
    const raw = await emailsKv.get(key.name);
    if (!raw) continue;
    try {
      candidates.push(JSON.parse(raw) as EmailRecord);
    } catch {
      // registro corrupto, skip
    }
  }

  // 3. Dedup por email + filtro de elegibilidad
  const nowMs = Date.now();
  const uniqueEligible = new Map<string, EmailRecord>();
  for (const rec of candidates) {
    const email = rec.email?.toLowerCase().trim();
    if (!email) continue;
    if (!isEligible(rec, nowMs)) continue;
    // conserva el registro más reciente por email
    const existing = uniqueEligible.get(email);
    if (!existing || new Date(rec.ts).getTime() > new Date(existing.ts).getTime()) {
      uniqueEligible.set(email, rec);
    }
  }

  const eligible = Array.from(uniqueEligible.values());
  let sent = 0;
  let failed = 0;

  // 4. Envío secuencial con throttling
  for (const rec of eligible) {
    const ok = await sendOne(token, rec.email, undefined, blogTitle, blogHook, blogUrl, blogImageUrl);
    if (ok) sent++;
    else failed++;
    await sleep(THROTTLE_MS);
  }

  const finished = Date.now();
  const report: BroadcastReport = {
    blog_slug: post.slug,
    blog_title: blogTitle,
    candidates: candidates.length,
    eligible: eligible.length,
    sent,
    failed,
    skipped: candidates.length - eligible.length,
    duration_ms: finished - started,
    started_at: startedIso,
    finished_at: new Date(finished).toISOString(),
  };

  // 5. Registrar reporte para métricas semanales
  try {
    await emailsKv.put(`broadcast-report:${startedIso}`, JSON.stringify(report), {
      expirationTtl: 60 * 60 * 24 * 90, // 90 días
    });
  } catch (err) {
    console.error('broadcast:report-persist-failed', err);
  }

  console.log('broadcast:done', JSON.stringify(report));
  return jsonResponse(report);
};
