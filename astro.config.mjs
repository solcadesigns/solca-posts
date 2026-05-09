// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://solca.science',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  // Serve / cache assets aggressively in prod
  vite: {
    build: {
      assetsInlineLimit: 4096,
    },
  },
});
