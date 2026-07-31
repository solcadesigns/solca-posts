#!/usr/bin/env node
/**
 * scripts/patch-cron-handler.mjs · Fase 1.4.E · 19 jun 2026
 * · v3 · 21 jul 2026 — rutea por cron pattern a múltiples endpoints
 *
 * Inyecta un handler `scheduled` en el worker generado por @astrojs/cloudflare
 * para que Cloudflare Cron Triggers (configurados en wrangler.jsonc) puedan
 * disparar endpoints internos sin pasar por HTTP.
 *
 * Rutas actuales:
 *   "0 14 * * 1" (Lun 8am CDMX) → /api/simulator-weekly-cron
 *   "0 14 * * 5" (Vie 8am CDMX) → /api/blog-broadcast
 *
 * Por qué un patch post-build: el adapter de Astro solo expone `fetch`. No hay
 * forma documentada de añadir otros handlers (scheduled, queue, etc.) desde
 * astro.config. La alternativa de un wrapper a nivel raíz rompe el bundling
 * de wrangler porque dist/_worker.js/index.js usa imports dinámicos a chunks
 * locales que no resuelven cuando se re-bundlean desde fuera.
 *
 * Idempotente · si el patch ya está aplicado, no hace nada.
 *
 * Uso: se corre automáticamente desde npm run build (package.json scripts).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_INDEX = resolve(__dirname, '..', 'dist', '_worker.js', 'index.js');

const PATCH_MARKER = '/* SOLCA_CRON_PATCH_v3 */';

const PATCH = `
${PATCH_MARKER}
// Wrapper inyectado por scripts/patch-cron-handler.mjs (v3).
// Reemplaza el default export del Astro worker con un módulo que expone
// AMBOS handlers: fetch (delegado al original) y scheduled (rutea por cron
// pattern a endpoints internos, sin ir por HTTP externa).
const __solcaCronWrapper = {
  fetch(request, env, ctx) {
    return __astrojsSsrVirtualEntry.fetch(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    const cronExpr = event.cron ?? '';
    let url;
    let extraHeaders = {};

    // Rutear por cron pattern
    if (cronExpr === '0 14 * * 1') {
      // Lun 8am CDMX · digest simulador
      const key = env.STATS_KEY ?? '';
      url = \`https://internal.cron/api/simulator-weekly-cron?key=\${encodeURIComponent(key)}&trigger=\${encodeURIComponent(cronExpr)}\`;
    } else if (cronExpr === '0 14 * * 5') {
      // Vie 8am CDMX · blog broadcast
      url = 'https://internal.cron/api/blog-broadcast';
      extraHeaders['x-broadcast-secret'] = env.BROADCAST_SECRET ?? '';
    } else {
      console.warn('scheduled: no route for cron', cronExpr);
      return;
    }

    // Content-Type JSON evita el CSRF check de Astro 5 (que solo bloquea
    // form-encoded sin Origin). Origin explícito para doble seguridad.
    const cronRequest = new Request(url, {
      method: 'POST',
      headers: {
        'X-Cron-Trigger': '1',
        'Content-Type': 'application/json',
        'Origin': 'https://solcaciencia.com',
        ...extraHeaders,
      },
    });
    ctx.waitUntil(__astrojsSsrVirtualEntry.fetch(cronRequest, env, ctx));
  },
};
`;

const ORIGINAL_EXPORT = 'export { __astrojsSsrVirtualEntry as default, pageMap };';
const PATCHED_EXPORT = 'export { __solcaCronWrapper as default, pageMap };';

// Marcador de cualquier versión previa del patch (regex amplio)
const ANY_PATCH_MARKER_REGEX = /\/\* SOLCA_CRON_PATCH_v\d+ \*\/[\s\S]*?export \{ __solcaCronWrapper as default, pageMap \};/;

function main() {
  let source;
  try {
    source = readFileSync(WORKER_INDEX, 'utf8');
  } catch (err) {
    console.error(`[patch-cron] No pude leer ${WORKER_INDEX}.`);
    console.error('[patch-cron] ¿Corriste astro build primero?');
    console.error(err.message);
    process.exit(1);
  }

  if (source.includes(PATCH_MARKER)) {
    console.log('[patch-cron] Worker ya parcheado en esta versión · skip.');
    return;
  }

  // Si hay un patch de versión previa, lo reemplazamos con la versión actual
  if (ANY_PATCH_MARKER_REGEX.test(source)) {
    const patched = source.replace(ANY_PATCH_MARKER_REGEX, PATCH.trim() + '\n' + PATCHED_EXPORT);
    writeFileSync(WORKER_INDEX, patched, 'utf8');
    console.log('[patch-cron] OK · patch upgrade aplicado (versión previa reemplazada).');
    return;
  }

  // Caso normal: aplicar patch al worker recién generado por Astro
  if (!source.includes(ORIGINAL_EXPORT)) {
    console.error(`[patch-cron] No encontré la línea de export esperada:`);
    console.error(`  "${ORIGINAL_EXPORT}"`);
    console.error('[patch-cron] El formato del worker generado por Astro cambió.');
    console.error('[patch-cron] Revisa dist/_worker.js/index.js y ajusta este script.');
    process.exit(2);
  }

  const patched = source.replace(ORIGINAL_EXPORT, PATCH + '\n' + PATCHED_EXPORT);
  writeFileSync(WORKER_INDEX, patched, 'utf8');
  console.log('[patch-cron] OK · handler scheduled inyectado en dist/_worker.js/index.js');
}

main();
