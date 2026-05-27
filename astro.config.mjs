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
        // Exclude API routes and internal pages from sitemap
        !page.includes('/api/') && !page.includes('/_'),
    }),
  ],
  vite: {
    build: {
      assetsInlineLimit: 4096,
    },
  },
});
