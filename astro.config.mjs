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
        !page.includes('/ddm'),
    }),
  ],
  vite: {
    build: {
      assetsInlineLimit: 4096,
    },
  },
});
