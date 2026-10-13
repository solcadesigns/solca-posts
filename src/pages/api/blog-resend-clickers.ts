import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sendEmail, PostmarkError } from '../../lib/postmark';

/**
 * Reenvío único (oct 2026) a quienes hicieron clic en un blog-broadcast roto.
 *
 * Del 10 sep al 8 oct 2026 el botón del broadcast apuntó a /blog/undefined
 * (bug de post.slug, corregido en df7a1cf). Este endpoint:
 *   GET  ?key=STATS_KEY            → dry run: lista quién hizo clic y qué post recibiría.
 *   POST ?key=STATS_KEY&confirm=1  → envía un correo por persona con el/los enlaces correctos.
 *
 * Fuente: Postmark Clicks API (tag blog-broadcast, retención 45 días). El post se
 * identifica por el Subject del mensaje original (= título del post).
 * Idempotente: marca `resend-clicker:<email>` en SIMULATOR_METRICS; no reenvía dos veces.
 * Se puede borrar después de usarlo.
 */

const POSTMARK_BASE = 'https://api.postmarkapp.com';
const BROKEN_FRAGMENT = 'blog/undefined';
const SKIP = new Set(['solcadesigns@gmail.com']); // Oscar ya lo sabe
const THROTTLE_MS = 100;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function mask(email: string): string {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
}

async function pm<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${POSTMARK_BASE}${path}`, {
    headers: { Accept: 'application/json', 'X-Postmark-Server-Token': token },
  });
  if (!res.ok) throw new Error(`postmark ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

interface Click {
  Recipient: string;
  MessageID: string;
  OriginalLink: string;
  ReceivedAt: string;
}

type Post = { url: string; title: string };

async function buildPlan(token: string) {
  // 1. Clics del tag blog-broadcast (paginado de 500).
  const clicks: Click[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const page = await pm<{ TotalCount: number; Clicks: Click[] }>(
      token,
      `/messages/outbound/clicks?count=500&offset=${offset}&tag=blog-broadcast`,
    );
    clicks.push(...page.Clicks);
    if (clicks.length >= page.TotalCount || page.Clicks.length === 0) break;
  }

  // 2. Solo clics al enlace roto (botón o imagen), no al enlace a la home.
  const broken = clicks.filter((c) => c.OriginalLink?.includes(BROKEN_FRAGMENT));

  // 3. MessageID → Subject → post.
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const byTitle = new Map(posts.map((p) => [p.data.title.trim(), p]));
  const subjectCache = new Map<string, string>();
  const unmatched = new Set<string>();

  const plan = new Map<string, Map<string, Post>>();
  for (const c of broken) {
    const email = c.Recipient.toLowerCase().trim();
    if (SKIP.has(email)) continue;
    let subject = subjectCache.get(c.MessageID);
    if (subject === undefined) {
      const d = await pm<{ Subject: string }>(token, `/messages/outbound/${c.MessageID}/details`);
      subject = d.Subject.trim();
      subjectCache.set(c.MessageID, subject);
    }
    const post = byTitle.get(subject);
    if (!post) {
      unmatched.add(subject);
      continue;
    }
    const perPerson = plan.get(email) ?? new Map<string, Post>();
    perPerson.set(post.id, {
      url: `https://solcaciencia.com/blog/${post.id}/?utm_source=email&utm_medium=newsletter&utm_campaign=blog-resend-clickers-oct-2026`,
      title: post.data.title,
    });
    plan.set(email, perPerson);
  }

  return {
    total_clicks_tag: clicks.length,
    clicks_enlace_roto: broken.length,
    personas: plan.size,
    subjects_sin_post: [...unmatched],
    plan,
  };
}

function buildEmail(items: Post[]) {
  const one = items.length === 1;
  const subject = one ? `El enlace correcto: ${items[0].title}` : 'Los enlaces correctos de Solca Insight';
  const intro = one
    ? 'En un correo reciente te compartí este artículo del blog y el botón "Leer el blog completo" no llevaba a ningún lado. Fue un error mío, ya está corregido. Aquí está el enlace correcto:'
    : 'En los últimos correos del blog, el botón "Leer el blog completo" no llevaba a ningún lado. Fue un error mío, ya está corregido. Estos son los artículos que intentaste abrir:';
  const listHtml = items
    .map((i) => `<p style="margin:16px 0;"><a href="${i.url}" style="color:#e77c3c;font-weight:600;">${i.title}</a></p>`)
    .join('');
  const listText = items.map((i) => `${i.title}\n${i.url}`).join('\n\n');
  const htmlBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;line-height:1.6;">
<p>${intro}</p>
${listHtml}
<p>Gracias por leer.</p>
<p style="font-size:14px;color:#6b7280;">Oscar<br>Solca Ciencia</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px 0;">
<p style="font-size:12px;color:#9ca3af;text-align:center;">Recibes este correo porque te suscribiste en solcaciencia.com.<br><a href="{{{ pm:unsubscribe }}}" style="color:#9ca3af;">Cancelar suscripción</a></p>
</div>`;
  const textBody = `${intro}\n\n${listText}\n\nGracias por leer.\n\n—\nOscar\nSolca Ciencia\n\n—\nRecibes este correo porque te suscribiste en solcaciencia.com.\nCancelar suscripción: {{{ pm:unsubscribe }}}`;
  return { subject, htmlBody, textBody };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function handle(url: URL, env: Record<string, unknown>, send: boolean) {
  const expectedKey = env.STATS_KEY as string | undefined;
  if (!expectedKey || url.searchParams.get('key') !== expectedKey) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const token = env.POSTMARK_SERVER_TOKEN as string | undefined;
  if (!token) return jsonResponse({ error: 'no_postmark_token' }, 503);
  const kv = env.SIMULATOR_METRICS as KVNamespace | undefined;
  if (!kv) return jsonResponse({ error: 'no_kv' }, 503);

  const { plan, ...summary } = await buildPlan(token);

  const rows: Array<{ email: string; posts: string[]; ya_enviado: boolean; resultado?: string }> = [];
  let sent = 0;
  let failed = 0;
  for (const [email, perPerson] of plan) {
    const items = [...perPerson.values()];
    const flagKey = `resend-clicker:${email}`;
    const already = (await kv.get(flagKey)) !== null;
    const row: (typeof rows)[number] = { email: mask(email), posts: items.map((i) => i.title), ya_enviado: already };
    if (send && !already) {
      const { subject, htmlBody, textBody } = buildEmail(items);
      try {
        await sendEmail(token, {
          from: 'Oscar Solís <hola@solcaciencia.com>',
          to: email,
          subject,
          htmlBody,
          textBody,
          tag: 'blog-resend-clickers',
          messageStream: 'broadcast',
          metadata: { source: 'blog-resend-clickers-oct-2026' },
        });
        await kv.put(flagKey, new Date().toISOString(), { expirationTtl: 60 * 60 * 24 * 90 });
        row.resultado = 'enviado';
        sent++;
      } catch (err) {
        row.resultado = err instanceof PostmarkError ? `error ${err.status}` : 'error';
        failed++;
      }
      await sleep(THROTTLE_MS);
    }
    rows.push(row);
  }

  return jsonResponse({
    modo: send ? 'envio' : 'dry-run',
    ...summary,
    ejemplo_correo: plan.size > 0 ? buildEmail([...[...plan.values()][0].values()]).subject : null,
    sent: send ? sent : undefined,
    failed: send ? failed : undefined,
    detalle: rows,
  });
}

export const GET: APIRoute = async ({ url, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  try {
    return await handle(url, env, false);
  } catch (err) {
    return jsonResponse({ error: 'internal', message: (err as Error).message }, 500);
  }
};

export const POST: APIRoute = async ({ url, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  if (url.searchParams.get('confirm') !== '1') {
    return jsonResponse({ error: 'falta confirm=1' }, 400);
  }
  try {
    return await handle(url, env, true);
  } catch (err) {
    return jsonResponse({ error: 'internal', message: (err as Error).message }, 500);
  }
};
