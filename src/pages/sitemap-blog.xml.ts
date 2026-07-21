// Dynamic sitemap for the blog. SSR so future-dated posts only appear when
// their pubDate has arrived. Submit this URL to Search Console alongside
// the auto-generated sitemap-index.xml.
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export const prerender = false;

export async function GET(context: APIContext) {
  const now = new Date();
  const posts = await getCollection(
    'blog',
    ({ data }) => !data.draft && data.pubDate.getTime() <= now.getTime(),
  );

  const site = context.site?.toString().replace(/\/$/, '') ?? 'https://solcaciencia.com';

  const urls = [
    { loc: `${site}/blog/`, lastmod: posts.length
        ? new Date(Math.max(...posts.map((p) => (p.data.updatedDate ?? p.data.pubDate).getTime()))).toISOString()
        : now.toISOString() },
    ...posts.map((post) => ({
      loc: `${site}/blog/${post.id}/`,
      lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString(),
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  });
}
