#!/usr/bin/env node
/**
 * scripts/generate-beta-codes.mjs · Fase 1.5.E · 19 jun 2026
 *
 * Genera códigos beta del Simulador en lote y los escribe a KV
 * SIMULATOR_BETA_CODES vía wrangler. Imprime CSV con columnas
 * (nombre, codigo, url) en stdout, listo para mail merge.
 *
 * Uso:
 *   node scripts/generate-beta-codes.mjs <archivo.json> [--dry-run] [--max-sessions=N] [--expires-iso=YYYY-MM-DD] [--cohort=nombre]
 *
 * Formato del archivo de input (JSON array):
 *   [
 *     { "nombre_pila": "Andrea", "cohort": "beta-1" },
 *     { "nombre_pila": "Roberto" }
 *   ]
 *
 * cohort por entrada es opcional; si falta usa --cohort o "beta-1".
 *
 * Defaults:
 *   --max-sessions=3
 *   --expires-iso=2026-08-31  (3 meses por default)
 *   --cohort=beta-1
 *   --dry-run=false  (escribe a KV remoto)
 *
 * Ejemplo:
 *   node scripts/generate-beta-codes.mjs invitados.json --dry-run > preview.csv
 *   node scripts/generate-beta-codes.mjs invitados.json --max-sessions=5 > codes.csv
 *
 * IMPORTANTE: requiere wrangler instalado y autenticado (npx wrangler whoami).
 * El binding SIMULATOR_BETA_CODES debe existir en wrangler.jsonc (ya está).
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const BASE_URL = 'https://solcaciencia.com/simulador-entrevistas-beta';
const KV_BINDING = 'SIMULATOR_BETA_CODES';

function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--')) {
      const [k, ...rest] = a.slice(2).split('=');
      args.flags[k] = rest.length ? rest.join('=') : true;
    } else {
      args.positional.push(a);
    }
  }
  return args;
}

function generateCode(length = 8) {
  // Alfanumérico legible (sin 0/O/1/I/l) para reducir errores al teclear
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function putKvKey(code, value, dryRun) {
  const payload = JSON.stringify(value);
  if (dryRun) {
    console.error(`[dry-run] would PUT beta:${code} → ${payload}`);
    return;
  }
  const cmd = [
    'npx', 'wrangler', 'kv', 'key', 'put',
    `--binding=${KV_BINDING}`,
    '--remote',
    `'beta:${code}'`,
    `'${payload.replace(/'/g, "'\\''")}'`,
  ].join(' ');
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.error(`  written: beta:${code}`);
  } catch (err) {
    console.error(`  FAILED beta:${code}: ${err.message}`);
    throw err;
  }
}

function main() {
  const { positional, flags } = parseArgs(process.argv);
  if (positional.length === 0) {
    console.error('Usage: node scripts/generate-beta-codes.mjs <archivo.json> [flags]');
    console.error('Run with --help for full options.');
    process.exit(1);
  }
  if (flags.help) {
    console.error('See header comment of this file for full docs.');
    process.exit(0);
  }

  const inputPath = positional[0];
  const dryRun = Boolean(flags['dry-run']);
  const maxSessions = parseInt(flags['max-sessions'] ?? '3', 10);
  const expiresIso = (flags['expires-iso'] ?? '2026-08-31') + 'T23:59:59Z';
  const defaultCohort = flags['cohort'] ?? 'beta-1';

  let invitees;
  try {
    invitees = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    console.error(`Could not parse ${inputPath} as JSON: ${err.message}`);
    process.exit(2);
  }
  if (!Array.isArray(invitees)) {
    console.error('Input file must be a JSON array of invitee objects.');
    process.exit(2);
  }

  console.error(`[generate-beta-codes] ${invitees.length} invitados · max_sessions=${maxSessions} · expires=${expiresIso} · cohort=${defaultCohort} · dry-run=${dryRun}`);
  console.error('');

  // CSV header
  console.log(['nombre', 'codigo', 'url', 'cohort'].join(','));

  const grantedAt = new Date().toISOString();
  let i = 0;
  for (const invitee of invitees) {
    i++;
    const nombre = invitee.nombre_pila || invitee.nombre || `Invitado_${i}`;
    const cohort = invitee.cohort || defaultCohort;
    const code = generateCode(8);

    const value = {
      nombre_pila: nombre,
      max_sessions: maxSessions,
      sessions_used: 0,
      granted_at: grantedAt,
      expires_at: expiresIso,
      cohort,
    };

    try {
      putKvKey(code, value, dryRun);
    } catch {
      // Si KV falla, igual emitimos la línea CSV para que Oscar vea qué pasó
      console.log([csvEscape(nombre), code, '(FAILED)', cohort].join(','));
      continue;
    }

    const url = `${BASE_URL}?codigo=${code}`;
    console.log([csvEscape(nombre), code, url, cohort].join(','));
  }

  console.error('');
  console.error(`[generate-beta-codes] Done · ${i} códigos${dryRun ? ' (dry-run, sin escribir a KV)' : ' escritos a KV'}.`);
  if (!dryRun) {
    console.error('[generate-beta-codes] Verifica con: npx wrangler kv key list --binding=SIMULATOR_BETA_CODES --remote --prefix=beta:');
  }
}

main();
