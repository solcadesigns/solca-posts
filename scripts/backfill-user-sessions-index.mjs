#!/usr/bin/env node
/**
 * scripts/backfill-user-sessions-index.mjs
 *
 * Reconstruye el índice `user_sessions:{email_hash}` a partir de las sesiones
 * existentes en KV SIMULATOR_SESSIONS. Se usa una sola vez tras el rollout del
 * panel /mis-reportes (9 sept 2026) para que las sesiones creadas ANTES del
 * commit del índice aparezcan también.
 *
 * Estrategia:
 *   1. Lista todas las keys con prefijo "session:" en SIMULATOR_SESSIONS.
 *   2. Lee cada state y extrae emailHash.
 *   3. Agrupa por emailHash → arma array de sessionIds ordenados por startedAt.
 *   4. Escribe `user_sessions:{email_hash}` con TTL 240 días.
 *
 * NO borra el índice existente · MERGE: si ya hay sessionIds en el índice, se
 * respetan y solo se agregan los que faltan.
 *
 * Idempotente: correr el script dos veces produce el mismo resultado.
 *
 * Uso:
 *   cd website
 *   node scripts/backfill-user-sessions-index.mjs [--dry-run]
 *
 * Cero costo Anthropic. Solo KV reads/writes.
 *
 * Requiere: wrangler autenticado (npx wrangler whoami muestra la cuenta).
 */

import { execSync } from 'node:child_process';

const DRY_RUN = process.argv.includes('--dry-run');
const BINDING = 'SIMULATOR_SESSIONS';

// FIX (9 sept 2026): usar el mismo patrón que simulator-health.mjs (validado
// funcional). Antes usaba stdio: ['pipe', 'pipe', 'ignore'] que probablemente
// interfería con encoding y devolvía buffer en vez de string.
function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  } catch (err) {
    return err.stdout ?? '';
  }
}

function listKeys(prefix) {
  const cmd = `npx wrangler kv key list --binding=${BINDING} --remote --prefix "${prefix}"`;
  const raw = run(cmd);
  try {
    return JSON.parse(raw);
  } catch {
    const jsonStart = raw.indexOf('[');
    if (jsonStart < 0) return [];
    try {
      return JSON.parse(raw.slice(jsonStart));
    } catch {
      return [];
    }
  }
}

function getKey(key) {
  const cmd = `npx wrangler kv key get "${key}" --binding=${BINDING} --remote --text`;
  const raw = run(cmd);
  return raw.trim();
}

function putKey(key, value) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] would PUT ${key} · ${value.length} bytes`);
    return true;
  }
  // Wrangler 4.x usa --expiration en lugar de --expiration-ttl para put via CLI.
  // Aquí escribimos SIN TTL (permanent) porque el TTL puede o no ser soportado
  // según la versión. Los KV writes SIN TTL persisten hasta borrado manual.
  const escaped = value.replace(/'/g, "'\\''");
  const cmd = `npx wrangler kv key put "${key}" '${escaped}' --binding=${BINDING} --remote`;
  try {
    execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch (err) {
    console.error(`  ERROR escribiendo ${key}:`, err.message?.slice(0, 200) ?? err);
    return false;
  }
}

console.log(`\n== BACKFILL user_sessions index ==`);
console.log(`   Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}\n`);

// 1. Listar todas las sesiones
const sessionKeys = listKeys('session:');
console.log(`Sesiones encontradas en KV: ${sessionKeys.length}`);

if (sessionKeys.length === 0) {
  console.log('Nada que hacer.');
  process.exit(0);
}

// 2. Agrupar por emailHash
const byEmailHash = new Map(); // emailHash → [{sessionId, startedAt}]

let processedCount = 0;
let noEmailHashCount = 0;
let parseFailCount = 0;

for (const k of sessionKeys) {
  const sessionId = k.name.replace(/^session:/, '');
  const raw = getKey(k.name);
  if (!raw) { parseFailCount++; continue; }
  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    parseFailCount++;
    continue;
  }
  const emailHash = state.emailHash;
  if (!emailHash) {
    noEmailHashCount++;
    continue;
  }
  const startedAt = state.startedAt || new Date().toISOString();
  const bucket = byEmailHash.get(emailHash) ?? [];
  bucket.push({ sessionId, startedAt });
  byEmailHash.set(emailHash, bucket);
  processedCount++;
  if (processedCount % 10 === 0) {
    console.log(`  Procesadas ${processedCount}/${sessionKeys.length} sesiones...`);
  }
}

console.log(`\nResumen:`);
console.log(`  Sesiones válidas con emailHash: ${processedCount}`);
console.log(`  Sesiones sin emailHash (freemium legacy): ${noEmailHashCount}`);
console.log(`  Errores de parse: ${parseFailCount}`);
console.log(`  Usuarios únicos (email_hash): ${byEmailHash.size}\n`);

// 3. Para cada emailHash, hacer MERGE con el índice existente y escribir
let writesOk = 0;
let writesFail = 0;

for (const [emailHash, entries] of byEmailHash.entries()) {
  const indexKey = `user_sessions:${emailHash}`;
  // Leer índice existente si lo hay (merge, no overwrite ciego)
  const existingRaw = getKey(indexKey);
  let existingIds = [];
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw);
      if (Array.isArray(parsed)) existingIds = parsed;
    } catch { /* index corrupto · ignoramos y regeneramos */ }
  }
  // Ordenar entries por startedAt asc (más viejo primero) — el frontend hace el reverse al mostrar
  entries.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  const newIds = entries.map((e) => e.sessionId);
  // Merge: unir existingIds + newIds, preservando orden y sin duplicados
  const merged = [...new Set([...existingIds, ...newIds])];
  console.log(`\n[${emailHash}]`);
  console.log(`  existentes: ${existingIds.length} · nuevas: ${newIds.length} · merged: ${merged.length}`);
  const ok = putKey(indexKey, JSON.stringify(merged));
  if (ok) writesOk++; else writesFail++;
}

console.log(`\n═══════════════════════════════════════════`);
console.log(`Writes OK: ${writesOk} · Writes FAIL: ${writesFail}`);
console.log(`═══════════════════════════════════════════\n`);

if (DRY_RUN) {
  console.log('DRY-RUN completado. Correr sin --dry-run para aplicar cambios.');
}
