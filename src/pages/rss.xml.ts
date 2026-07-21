// RSS feed for the Solca blog at /rss.xml
// SSR so the pubDate filter runs per request — future-dated posts stay out of the
// feed until their day arrives.
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export const prerender = false;

export async function GET(context: APIContext) {
  const now = new Date();
  const posts = await getCollection(
    'blog',
    ({ data }) => !data.draft && data.pubDate.getTime() <= now.getTime(),
  );
  const sorted = posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  return rss({
    title: 'Solca · Ciencia y Consultoría',
    description:
      'Carreras en la industria farmacéutica para profesionales en ciencias biológicas y afines. Análisis de vacantes, guías y reflexiones desde academia hacia pharma.',
    site: context.site!,
    items: sorted.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
      categories: [post.data.category, ...post.data.tags],
      author: 'hello@solcaciencia.com (Oscar Solís Castro)',
    })),
    customData: '<language>es-ES</language>',
  });
}
