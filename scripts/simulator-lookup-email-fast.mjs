#!/usr/bin/env node
/**
 * scripts/simulator-lookup-email-fast.mjs
 *
 * Versión rápida de simulator-lookup-email.mjs: usa la API de Cloudflare
 * directa con fetch nativo + paralelismo (batches de 25 gets simultáneos).
 * Tiempo: ~5-10 seg para 100 leads vs 90+ seg con wrangler subprocess.
 *
 * Uso:
 *   CLOUDFLARE_API_TOKEN=... CF_ACCOUNT_ID=187219480b04d6f4afea8aa7e6231852 \
 *     node scripts/simulator-lookup-email-fast.mjs SIM-ABCD2345
 *
 * Requiere:
 *   - Token de Cloudflare con permiso "Account:Workers KV Storage:Read"
 *     Crear en https://dash.cloudflare.com/profile/api-tokens → Custom token
 *   - CF_ACCOUNT_ID (ya lo tienes de los errores wrangler: 187219480b04d6f4afea8aa7e6231852)
 *
 * Sin dependencias npm.
 */

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const NAMESPACE_NAME = process.env.CF_NAMESPACE_NAME ?? 'EMAILS';
const PARALLEL = 25;

if (!TOKEN || !ACCOUNT_ID) {
  console.error('ERROR: Falta CLOUDFLARE_API_TOKEN o CF_ACCOUNT_ID.');
  console.error('Uso:');
  console.error('  CLOUDFLARE_API_TOKEN=... CF_ACCOUNT_ID=... \\');
  console.error('    node scripts/simulator-lookup-email-fast.mjs SIM-ABCD2345');
  process.exit(1);
}

const code = process.argv[2];
if (!code) {
  console.error('ERROR: pasa el betaCode como arg 1.');
  process.exit(1);
}

const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces`;

async function cf(path) {
  const res = await fetch(`${CF_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudflare API ${res.status} · ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function cfText(path) {
  const res = await fetch(`${CF_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) return null;
  return res.text();
}

console.error(`[lookup-fast] buscando namespace ${NAMESPACE_NAME}...`);
const nsList = await cf(`?per_page=100`);
const namespace = nsList.result?.find((n) => n.title === NAMESPACE_NAME);
if (!namespace) {
  console.error(`ERROR: no encontré namespace ${NAMESPACE_NAME}. Disponibles:`);
  nsList.result?.forEach((n) => console.error(`  - ${n.title}`));
  process.exit(2);
}
const NS_ID = namespace.id;
console.error(`[lookup-fast] namespace id: ${NS_ID}`);

// Listar todas las keys con prefix "sim:" (paginado si hay >1000)
console.error('[lookup-fast] listando keys prefix "sim:"...');
let allKeys = [];
let cursor = '';
while (true) {
  const q = new URLSearchParams({ prefix: 'sim:', limit: '1000' });
  if (cursor) q.set('cursor', cursor);
  const page = await cf(`/${NS_ID}/keys?${q.toString()}`);
  allKeys.push(...(page.result ?? []));
  cursor = page.result_info?.cursor ?? '';
  if (!cursor || page.result_info?.count === 0) break;
}
console.error(`[lookup-fast] ${allKeys.length} keys · empezando gets paralelos (batches de ${PARALLEL})`);

// Gets paralelos con early-exit al encontrar el match
let found = null;
async function tryKey(key) {
  if (found) return;
  const raw = await cfText(`/${NS_ID}/values/${encodeURIComponent(key.name)}`);
  if (!raw) return;
  let rec;
  try {
    rec = JSON.parse(raw);
  } catch {
    return;
  }
  if (rec.code === code) {
    found = rec;
  }
}

for (let i = 0; i < allKeys.length && !found; i += PARALLEL) {
  const batch = allKeys.slice(i, i + PARALLEL);
  await Promise.all(batch.map(tryKey));
  process.stderr.write(`\r[lookup-fast] revisados ${Math.min(i + PARALLEL, allKeys.length)}/${allKeys.length}...`);
}
process.stderr.write('\n');

if (!found) {
  console.error(`[lookup-fast] NO se encontró lead con code=${code}`);
  process.exit(3);
}

process.stdout.write(
  JSON.stringify(
    {
      email: found.email,
      name: found.name,
      code: found.code,
      cohort: found.cohort,
      country: found.country,
      ts: found.ts,
    },
    null,
    2,
  ) + '\n',
);
console.error(`[lookup-fast] OK · email: ${found.email} · nombre: ${found.name ?? '(sin nombre)'}`);
