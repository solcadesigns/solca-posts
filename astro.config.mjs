// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://solcaciencia.com',
  trailingSlash: 'ignore',
  output: 'server',
  // Redirects permanentes.
  // /quiz → /quiz-rol (3 ago 2026): 13 posts del blog publicados entre may y
  // jul 2026 cerraban su CTA apuntando a /quiz, ruta que nunca existió (la
  // página siempre fue quiz-rol.astro). Los .md ya están corregidos; este 301
  // recupera el tráfico de los enlaces ya indexados por Google y de los
  // compartidos en LinkedIn, que no podemos reescribir.
  redirects: {
    '/quiz': {
      status: 301,
      destination: '/quiz-rol',
    },
  },
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [
    sitemap({
      filter: (page) =>
        // Exclude API routes, internal pages, /blog/* (handled by dynamic
        // sitemap-blog.xml), the simulator beta (private until launch), and
        // /ddm (QR redirect for the Solca Publishing book — not part of the site).
        !page.includes('/api/') &&
        !page.includes('/_') &&
        !page.includes('/blog') &&
        !page.includes('/simulador-entrevistas-beta') &&
        !page.includes('/ddm') &&
        // Añadido 21 sep 2026. sitemap-0.xml estaba publicando los paneles de
        // admin (/admin/beta-codes, /admin/simulator-metrics) y tres rutas de
        // la app del simulador. Los admin ya traen noindex en su propio <head>,
        // así que no había fuga de datos, pero una URL con noindex dentro de un
        // sitemap es señal contradictoria y gasta crawl budget. Las tres del
        // simulador sí se servían indexables (ver BaseLayout: la prop noindex
        // no existía). La landing /simulador-entrevistas/ NO se excluye: esa sí
        // es página de marketing y tiene que seguir en el sitemap.
        !page.includes('/admin') &&
        !page.includes('/simulador-entrevistas/sesion') &&
        !page.includes('/simulador-entrevistas/gracias') &&
        !page.includes('/simulador-entrevistas/mis-reportes'),
    }),
  ],
  vite: {
    build: {
      assetsInlineLimit: 4096,
    },
  },
});
