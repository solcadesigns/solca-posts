#!/usr/bin/env node
/**
 * scripts/patch-cron-handler.mjs · Fase 1.4.E · 19 jun 2026
 * · v3 · 21 jul 2026 — rutea por cron pattern a múltiples endpoints
 * · v4 · 4 ago 2026  — añade drip diario 9am CDMX
 *
 * Inyecta un handler `scheduled` en el worker generado por @astrojs/cloudflare
 * para que Cloudflare Cron Triggers (configurados en wrangler.jsonc) puedan
 * disparar endpoints internos sin pasar por HTTP.
 *
 * Rutas actuales:
 *   "0 14 * * 1" (Lun 8am CDMX) → /api/simulator-weekly-cron
 *   "0 14 * * 5" (Vie 8am CDMX) → /api/blog-broadcast
 *   "0 15 * * *" (Diario 9am CDMX) → /api/drip-tick
 *   "*\/5 * * * *" (escrito con \/ para no cerrar este comentario) (cada 5 min) → /api/cv-process-pending (reintentos del revisor de CV; 6 nov 2026).
 *     Va por Cron Trigger y no por cron-job.org: un análisis tarda ~30 s y una conexión HTTP
 *     cortada a los 30 s cancelaría la invocación.
 *     v6 · 6 nov 2026: el mismo disparo llama después a /api/cv-medida-process (cola de CV a la medida).
 *     v7 · 11 nov 2026: el diario (0 15) llama también a /api/encuesta-resultado-tick, después de drip-tick.
 *     Sin trigger nuevo: la cuenta está en el tope de 5 Cron Triggers. Las dos llamadas van en serie y un
 *     fallo de la primera no impide la segunda.
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

const PATCH_MARKER = '/* SOLCA_CRON_PATCH_v7 */';

const PATCH = `
${PATCH_MARKER}
// Wrapper inyectado por scripts/patch-cron-handler.mjs (v7: el cron diario también envía la encuesta de 14 días).
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
    } else if (cronExpr === '0 15 * * *') {
      // Diario 9am CDMX · drip de bienvenida (tracks CV + Quiz, steps d3/d7/d12/d20) y, en serie (v7, 11 nov 2026),
      // la encuesta de resultado a 14 días del CV a la medida.
      const key = encodeURIComponent(env.STATS_KEY ?? '');
      const trig = encodeURIComponent(cronExpr);
      const rutas = [
        \`https://internal.cron/api/drip-tick?key=\${key}&trigger=\${trig}\`,
        \`https://internal.cron/api/encuesta-resultado-tick?key=\${key}&trigger=\${trig}\`,
      ];
      ctx.waitUntil((async () => {
        for (const u of rutas) {
          try {
            await __astrojsSsrVirtualEntry.fetch(new Request(u, {
              method: 'POST',
              headers: { 'X-Cron-Trigger': '1', 'Content-Type': 'application/json', 'Origin': 'https://solcaciencia.com' },
            }), env, ctx);
          } catch (err) {
            console.error('scheduled: falló', u.split('?')[0], String(err).slice(0, 200));
          }
        }
      })());
      return;
    } else if (cronExpr === '*/5 * * * *') {
      // Cada 5 min · reintentos del revisor de CV y, en serie, la cola de CV a la medida (v6).
      const key = encodeURIComponent(env.STATS_KEY ?? '');
      const trig = encodeURIComponent(cronExpr);
      const rutas = [
        \`https://internal.cron/api/cv-process-pending?key=\${key}&trigger=\${trig}\`,
        \`https://internal.cron/api/cv-medida-process?key=\${key}&trigger=\${trig}\`,
      ];
      ctx.waitUntil((async () => {
        for (const u of rutas) {
          try {
            await __astrojsSsrVirtualEntry.fetch(new Request(u, {
              method: 'POST',
              headers: { 'X-Cron-Trigger': '1', 'Content-Type': 'application/json', 'Origin': 'https://solcaciencia.com' },
            }), env, ctx);
          } catch (err) {
            console.error('scheduled: falló', u.split('?')[0], String(err).slice(0, 200));
          }
        }
      })());
      return;
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
