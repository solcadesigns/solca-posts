#!/usr/bin/env node
/**
 * scripts/simulator-lookup-email.mjs
 *
 * Cruza un betaCode (SIM-XXXXXXXX) con el KV EMAILS prefix `sim:` para
 * encontrar email + nombre del lead.
 *
 * Uso (desde website/):
 *   node scripts/simulator-lookup-email.mjs SIM-ABCD2345
 *
 * O extrayendo el betaCode desde state.json:
 *   node scripts/simulator-lookup-email.mjs "$(node -e 'console.log(JSON.parse(require(\"fs\").readFileSync(\"state.json\",\"utf8\")).betaCode)')"
 *
 * Requisitos: Node 18+, wrangler autenticado.
 */

import { execSync } from 'node:child_process';

const code = process.argv[2];
if (!code) {
  console.error('ERROR: pasa el betaCode como arg. Ejemplo:');
  console.error('  node scripts/simulator-lookup-email.mjs SIM-ABCD2345');
  process.exit(1);
}

console.error(`[lookup] buscando lead con code=${code}...`);

function wranglerKvList(binding, prefix) {
  const out = execSync(
    `npx wrangler kv key list --binding=${binding} --prefix=${prefix} --remote 2>/dev/null`,
    { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 },
  );
  return JSON.parse(out);
}
function wranglerKvGet(binding, key) {
  const out = execSync(
    `npx wrangler kv key get "${key}" --binding=${binding} --remote 2>/dev/null`,
    { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 },
  );
  return out.trim();
}

const keys = wranglerKvList('EMAILS', 'sim:');
console.error(`[lookup] ${keys.length} leads en KV EMAILS prefix "sim:"`);

let found = null;
for (const k of keys) {
  const raw = wranglerKvGet('EMAILS', k.name);
  let rec;
  try {
    rec = JSON.parse(raw);
  } catch {
    continue;
  }
  if (rec.code === code) {
    found = rec;
    break;
  }
}

if (!found) {
  console.error(`[lookup] NO se encontró ningún lead con code=${code}`);
  console.error('Verifica que el code sea correcto y que el lead haya pasado por /api/simulator-subscribe.');
  process.exit(2);
}

// Salida JSON al stdout · util para pipe a otro script
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
console.error(`[lookup] OK · email: ${found.email} · nombre: ${found.name ?? '(sin nombre)'}`);
