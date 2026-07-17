// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://solcaciencia.com',
  trailingSlash: 'ignore',
  output: 'server',
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
