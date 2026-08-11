#!/usr/bin/env node
/**
 * scripts/prune-test-emails.mjs · 6 ago 2026
 *
 * Borra records de KV EMAILS de leads cuyo email matchea un patrón de
 * "cuenta de prueba", para que el drip no siga enviándoles emails futuros
 * (ni los cuente en métricas del weekly report).
 *
 * Patrón por defecto: solcadesigns@gmail.com y sus aliases (solcadesigns+X@gmail.com).
 *
 * Uso:
 *   node scripts/prune-test-emails.mjs [--dry]
 *
 * Con --dry solo reporta qué borraría, no toca nada.
 * Sin --dry ejecuta los deletes en el KV remoto (producción).
 *
 * Cuatro passes:
 *   1. email:*  (leads de CV Review)
 *   2. quiz:*   (leads del Quiz)
 *   3. drip:solcadesigns*  (dedupe marks del drip por lead)
 *   4. unsub:solcadesigns* (kill-switch flags si los hubiera)
 */

import { execSync } from 'node:child_process';

const DRY = process.argv.includes('--dry');

// Usamos --namespace-id (no --binding) porque `wrangler kv key list --binding=EMAILS`
// falla con Authentication error [code 10000] en la config actual (verificado
// 10 ago 2026). El binding CV_METRICS sí resuelve; EMAILS no. Con namespace-id
// directo funciona sin problema. El ID viene de wrangler.jsonc líneas 47-50.
const KV_NAMESPACE_ID = 'a4f0b989694a4872a3546beda9644846';

// Cambia PATTERN aquí si quieres apuntar a otras cuentas de prueba.
// La regex es case-insensitive y cubre aliases con "+".
const PATTERN = /^solcadesigns(\+[^@]+)?@gmail\.com$/i;
const KEY_PREFIX_MATCH = 'solcadesigns'; // para prefixes drip:/unsub:

function log(...args) {
  console.log(...args);
}

function runJson(cmd) {
  const out = execSync(cmd, { encoding: 'utf8' });
  return JSON.parse(out);
}

function runText(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}

function listKeys(prefix) {
  return runJson(
    `npx wrangler kv key list --namespace-id=${KV_NAMESPACE_ID} --remote --prefix="${prefix}"`,
  );
}

function getValue(keyName) {
  try {
    const raw = runText(
      `npx wrangler kv key get "${keyName}" --namespace-id=${KV_NAMESPACE_ID} --remote`,
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function deleteKey(keyName) {
  // wrangler kv key delete pide confirmación interactiva ("y/N"). En v4.90 el
  // flag --force ya no existe; pipeamos "y\n" al stdin para responder al prompt.
  execSync(
    `npx wrangler kv key delete "${keyName}" --namespace-id=${KV_NAMESPACE_ID} --remote`,
    { encoding: 'utf8', input: 'y\n' },
  );
}

// Pass A: leer value, matchear rec.email contra PATTERN, borrar.
function pruneByValueMatch(prefix) {
  log(`\n[pass] Escaneando prefix "${prefix}"...`);
  const keys = listKeys(prefix);
  log(`  Total keys: ${keys.length}`);

  let matched = 0;
  let deleted = 0;
  let errors = 0;

  for (const k of keys) {
    const rec = getValue(k.name);
    if (!rec || typeof rec.email !== 'string') continue;
    if (!PATTERN.test(rec.email)) continue;
    matched++;
    log(`  MATCH ${k.name} → ${rec.email}`);
    if (!DRY) {
      try {
        deleteKey(k.name);
        deleted++;
      } catch (err) {
        log(`    ERROR delete: ${err.message}`);
        errors++;
      }
    }
  }

  log(`  ${DRY ? 'Would delete' : 'Deleted'}: ${matched} · errors: ${errors}`);
  return { matched, deleted, errors };
}

// Pass B: prefix contiene el email ya (drip:{email}:track:step, unsub:{email}:drip),
// no hay que leer value.
function pruneByKeyPrefix(prefix) {
  log(`\n[pass] Escaneando prefix "${prefix}"...`);
  const keys = listKeys(prefix);
  log(`  Total keys: ${keys.length}`);

  let deleted = 0;
  let errors = 0;

  for (const k of keys) {
    log(`  MATCH ${k.name}`);
    if (!DRY) {
      try {
        deleteKey(k.name);
        deleted++;
      } catch (err) {
        log(`    ERROR delete: ${err.message}`);
        errors++;
      }
    }
  }

  log(`  ${DRY ? 'Would delete' : 'Deleted'}: ${keys.length} · errors: ${errors}`);
  return { matched: keys.length, deleted, errors };
}

function main() {
  log(`prune-test-emails.mjs · ${DRY ? 'DRY RUN' : 'LIVE'}`);
  log(`Pattern (email localpart + gmail.com): ${PATTERN}`);
  log(`Key-prefix match (drip:/unsub:): ${KEY_PREFIX_MATCH}`);

  const r1 = pruneByValueMatch('email:');
  const r2 = pruneByValueMatch('quiz:');
  const r3 = pruneByKeyPrefix(`drip:${KEY_PREFIX_MATCH}`);
  const r4 = pruneByKeyPrefix(`unsub:${KEY_PREFIX_MATCH}`);

  log('\n===== RESUMEN =====');
  log(`email:*  ${DRY ? 'would delete' : 'deleted'}: ${r1.matched}`);
  log(`quiz:*   ${DRY ? 'would delete' : 'deleted'}: ${r2.matched}`);
  log(`drip:*   ${DRY ? 'would delete' : 'deleted'}: ${r3.matched}`);
  log(`unsub:*  ${DRY ? 'would delete' : 'deleted'}: ${r4.matched}`);
  log(`TOTAL    ${DRY ? 'would delete' : 'deleted'}: ${r1.matched + r2.matched + r3.matched + r4.matched}`);

  if (DRY) {
    log('\nDry run · nada se borró. Corre sin --dry para aplicar en KV remoto.');
  } else {
    log('\nLive · cambios aplicados en KV remoto (producción).');
  }
}

main();
