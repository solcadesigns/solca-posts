#!/usr/bin/env node
/**
 * scripts/backfill-kv-to-brevo.mjs · 13 jul 2026
 *
 * Backfill de contactos desde Cloudflare KV EMAILS a Brevo tras la migración de MailerLite.
 *
 * Contexto: la cuenta MailerLite fue terminada el 11 jul 2026. El sitio siguió capturando
 * emails en Cloudflare KV EMAILS pero las llamadas a MailerLite (fire-and-forget) fallaron
 * silenciosamente. Este script lee todos los keys de KV EMAILS, deduplica por email, verifica
 * cuáles ya están en Brevo (import CSV manual del 11-12 jul con ~41 activos), y agrega los
 * faltantes a la lista Newsletter con tag "origen:kv-backfill-jul-2026".
 *
 * Uso:
 *   BREVO_API_KEY=xxx BREVO_LIST_NEWSLETTER=N node scripts/backfill-kv-to-brevo.mjs --dry-run
 *   BREVO_API_KEY=xxx BREVO_LIST_NEWSLETTER=N node scripts/backfill-kv-to-brevo.mjs
 *
 * Flags:
 *   --dry-run       No escribe a Brevo. Solo imprime plan de acción.
 *   --limit=N       Procesar solo los primeros N emails únicos (útil para pruebas).
 *   --source=email  Filtrar por prefijo de key: email, quiz, o all (default all).
 *
 * IMPORTANTE: requiere wrangler autenticado (npx wrangler whoami) para leer KV.
 * NO es bulk masivo (batch chico ~20-30 emails). Rate limit conservador: 1 request/500ms.
 */

import { execSync } from 'node:child_process';

const KV_BINDING = 'EMAILS';
const BREVO_BASE = 'https://api.brevo.com/v3';

function parseArgs(argv) {
  const args = { dryRun: false, limit: Infinity, source: 'all' };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice(8), 10);
    else if (a.startsWith('--source=')) args.source = a.slice(9);
  }
  return args;
}

function log(...msgs) {
  console.error('[backfill-kv-to-brevo]', ...msgs);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Lista todos los keys en KV EMAILS via wrangler. */
function listKvKeys() {
  log('Listando keys de KV EMAILS...');
  const raw = execSync(
    `npx wrangler kv key list --binding=${KV_BINDING} --remote`,
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  const keys = JSON.parse(raw);
  log(`Encontrados ${keys.length} keys en KV.`);
  return keys.map((k) => k.name);
}

/**
 * Extrae email único desde el key. Formatos observados:
 *   email:2026-05-16T18:07:19.082Z:solcadesigns@gmail.com
 *   quiz:2026-06-08T05:55:05.091Z:jessicabh76@gmail.com
 *
 * Devuelve { source, ts, email } o null si no puede parsear.
 */
function parseKvKey(key) {
  const parts = key.split(':');
  // key = source:2026-05-16T18:07:19.082Z:email
  // parts = ['email', '2026-05-16T18', '07', '19.082Z', 'user@domain.com']
  // Reconstruir ts y extraer email (siempre el último token)
  if (parts.length < 5) return null;
  const source = parts[0];
  const email = parts[parts.length - 1];
  const ts = parts.slice(1, -1).join(':');
  if (!email.includes('@')) return null;
  return { source, ts, email: email.toLowerCase().trim() };
}

/** Consulta Brevo por email. Devuelve el contact si existe, null si 404. */
async function getBrevoContact(apiKey, email) {
  const res = await fetch(
    `${BREVO_BASE}/contacts/${encodeURIComponent(email)}`,
    { headers: { 'api-key': apiKey, Accept: 'application/json' } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Brevo GET ${email} → ${res.status} ${res.statusText}`);
  return res.json();
}

/** Crea o actualiza contacto en Brevo con lista Newsletter + tag de origen. */
async function upsertBrevoContact(apiKey, email, listIds) {
  const body = {
    email,
    listIds,
    updateEnabled: true,
    attributes: {
      ORIGEN: 'kv-backfill-jul-2026',
    },
  };
  const res = await fetch(`${BREVO_BASE}/contacts`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (res.status === 201 || res.status === 204) return { created: res.status === 201 };
  const errBody = await res.json().catch(() => res.text());
  throw new Error(`Brevo POST ${email} → ${res.status}: ${JSON.stringify(errBody)}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const apiKey = process.env.BREVO_API_KEY;
  const listNewsletterId = parseInt(process.env.BREVO_LIST_NEWSLETTER ?? '', 10);

  if (!apiKey) {
    log('ERROR: falta env var BREVO_API_KEY');
    process.exit(1);
  }
  if (isNaN(listNewsletterId)) {
    log('ERROR: falta env var BREVO_LIST_NEWSLETTER (int)');
    process.exit(1);
  }

  log('Config:', {
    dryRun: args.dryRun,
    limit: args.limit,
    source: args.source,
    listNewsletterId,
  });

  const allKeys = listKvKeys();
  const parsed = allKeys.map(parseKvKey).filter((p) => p !== null);
  log(`Keys parseables: ${parsed.length}`);

  const filtered =
    args.source === 'all' ? parsed : parsed.filter((p) => p.source === args.source);
  log(`Después de filtro source=${args.source}: ${filtered.length}`);

  // Dedup por email · quedarse con el timestamp más reciente
  const uniqueByEmail = new Map();
  for (const rec of filtered) {
    const prev = uniqueByEmail.get(rec.email);
    if (!prev || rec.ts > prev.ts) {
      uniqueByEmail.set(rec.email, rec);
    }
  }
  const uniqueEmails = [...uniqueByEmail.values()];
  log(`Emails únicos: ${uniqueEmails.length}`);

  const toProcess = uniqueEmails.slice(0, args.limit);
  log(`A procesar (con limit): ${toProcess.length}`);

  // CSV header en stdout
  console.log(['email', 'source', 'ts_kv', 'brevo_status', 'action'].join(','));

  const stats = { alreadyInBrevo: 0, created: 0, updated: 0, failed: 0, skippedDryRun: 0 };

  for (const [i, rec] of toProcess.entries()) {
    const { email, source, ts } = rec;
    let status = 'unknown';
    let action = '';

    try {
      const existing = await getBrevoContact(apiKey, email);
      if (existing) {
        const inNewsletter = existing.listIds?.includes(listNewsletterId);
        status = inNewsletter ? 'in-newsletter' : 'in-brevo-not-newsletter';
        if (inNewsletter) {
          stats.alreadyInBrevo++;
          action = 'skip';
        } else if (args.dryRun) {
          stats.skippedDryRun++;
          action = 'dry-run:would-add-to-newsletter';
        } else {
          await upsertBrevoContact(apiKey, email, [listNewsletterId]);
          stats.updated++;
          action = 'added-to-newsletter';
        }
      } else {
        status = 'not-in-brevo';
        if (args.dryRun) {
          stats.skippedDryRun++;
          action = 'dry-run:would-create';
        } else {
          await upsertBrevoContact(apiKey, email, [listNewsletterId]);
          stats.created++;
          action = 'created';
        }
      }
    } catch (err) {
      stats.failed++;
      status = 'error';
      action = String(err?.message ?? err).slice(0, 120);
    }

    console.log([email, source, ts, status, action].join(','));

    // Rate limit conservador: 1 request cada 500ms para GET y otro para POST
    await sleep(500);

    if ((i + 1) % 10 === 0) log(`Progreso: ${i + 1}/${toProcess.length}`);
  }

  log('');
  log('Resumen final:', stats);
  log(args.dryRun ? '[dry-run] no se escribió a Brevo.' : 'Escritura a Brevo completada.');
}

main().catch((err) => {
  console.error('[backfill-kv-to-brevo] FATAL:', err);
  process.exit(2);
});
