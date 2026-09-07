#!/usr/bin/env node
/**
 * simulator-health.mjs · reporte rápido del estado del simulador.
 *
 * Corre desde la carpeta website/:
 *   node scripts/simulator-health.mjs
 *
 * Muestra en <30 seg:
 *   - Pendings activos (deberían ser 0 o cerca)
 *   - Sesiones failed (cortadas por circuit breaker) en las últimas 48h
 *   - Cuántas sesiones en total hay guardadas
 *   - Últimas 5 alertas de circuit breaker (por sessionId)
 *
 * No consume tokens de Anthropic. Solo lee KV via wrangler.
 *
 * Prerequisito: estar autenticado con `npx wrangler whoami` (OAuth token).
 */

import { execSync } from 'node:child_process';

const BINDING = 'SIMULATOR_SESSIONS';
const KV_NAMESPACE_ID = 'ddb54cee43d74747b36c9e45e3b42107'; // hardcoded para no depender de wrangler.jsonc

function run(cmd, { silent = false } = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: silent ? 'pipe' : ['pipe', 'pipe', 'inherit'] });
  } catch (err) {
    return err.stdout ?? '';
  }
}

function listKeys(prefix) {
  const cmd = `npx wrangler kv key list --binding=${BINDING} --remote --prefix "${prefix}"`;
  const raw = run(cmd, { silent: true });
  try {
    return JSON.parse(raw);
  } catch {
    // wrangler a veces mete líneas de banner arriba
    const jsonStart = raw.indexOf('[');
    if (jsonStart < 0) return [];
    return JSON.parse(raw.slice(jsonStart));
  }
}

function getKey(key) {
  const cmd = `npx wrangler kv key get "${key}" --binding=${BINDING} --remote --text`;
  const raw = run(cmd, { silent: true });
  return raw.trim();
}

console.log('\nSIMULATOR · HEALTH CHECK\n' + '='.repeat(50));

// 1. Pendings activos
const pendings = listKeys('pending:');
console.log(`\nPendings activos: ${pendings.length}`);
if (pendings.length > 0) {
  console.log('  Ojo: si son >0 y aumentan entre corridas, hay algo que no está drenando.');
  for (const k of pendings.slice(0, 5)) {
    const val = getKey(k.name);
    try {
      const p = JSON.parse(val);
      console.log(`    ${k.name} · attempts=${p.attempts ?? 0} · error="${(p.errorMessage ?? '').slice(0, 60)}"`);
    } catch {
      console.log(`    ${k.name} · <no parseable>`);
    }
  }
}

// 2. Sesiones failed (revisar las últimas ~50 sesiones)
const sessions = listKeys('session:');
console.log(`\nSesiones guardadas (total): ${sessions.length}`);

const sample = sessions.slice(-50); // últimas 50
let failedCount = 0;
let readyCount = 0;
let inProgressCount = 0;
const failedList = [];

for (const k of sample) {
  const val = getKey(k.name);
  try {
    const s = JSON.parse(val);
    if (s.finalReportStatus === 'failed') {
      failedCount++;
      failedList.push({ sessionId: s.sessionId, error: s.finalReportError });
    } else if (s.finalReportStatus === 'ready' || s.finalReport) {
      readyCount++;
    } else {
      inProgressCount++;
    }
  } catch {
    /* skip */
  }
}

console.log(`\nMuestra de últimas ${sample.length} sesiones:`);
console.log(`  ready:       ${readyCount}`);
console.log(`  failed:      ${failedCount}  ${failedCount > 0 ? '← revisar abajo' : ''}`);
console.log(`  in_progress: ${inProgressCount}`);

if (failedList.length > 0) {
  console.log('\nSesiones failed (últimas 10):');
  for (const f of failedList.slice(-10)) {
    console.log(`  ${f.sessionId} · ${(f.error ?? '').slice(0, 80)}`);
  }
  console.log('\nRecuperación manual:');
  console.log(`  node scripts/simulator-recover-report.mjs <sessionId>`);
}

// 3. Ratio de éxito
if (readyCount + failedCount > 0) {
  const successRate = ((readyCount / (readyCount + failedCount)) * 100).toFixed(0);
  console.log(`\nSuccess rate (últimas sesiones): ${successRate}%`);
  if (successRate < 80) {
    console.log('  ALERTA: success rate bajo. Investiga antes de dejar corriendo el sitio.');
  }
}

console.log('\n' + '='.repeat(50));
console.log('Fin del reporte.\n');
