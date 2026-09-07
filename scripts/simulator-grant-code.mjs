#!/usr/bin/env node
/**
 * simulator-grant-code.mjs · genera un código SIM-XXXXXXXX manualmente sin
 * pasar por Stripe. Útil para pruebas internas y para asignar códigos de
 * cortesía puntuales.
 *
 * Uso:
 *   node scripts/simulator-grant-code.mjs <email> <plan> [nombre]
 *
 * Ejemplos:
 *   node scripts/simulator-grant-code.mjs solcadesigns@gmail.com premium Oscar
 *   node scripts/simulator-grant-code.mjs test@example.com basico
 *
 * Planes:
 *   basico   → 3 sesiones · vigencia 240 días
 *   premium  → 8 sesiones · vigencia 240 días
 *   gratis   → 1 sesión   · vigencia 240 días (para pruebas de freemium)
 *
 * Escribe en dos KV:
 *   SIMULATOR_BETA_CODES · beta:SIM-XXX  (auth y plan)
 *   SIMULATOR_CREDITS    · credits:hash  (contador de sesiones)
 *
 * NO usa Stripe · útil cuando ya validamos el paywall y queremos ahorrar el
 * ida y vuelta de un checkout test.
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [, , emailArg, planArg, nombreArg] = process.argv;

if (!emailArg || !planArg) {
  console.error('Uso: node scripts/simulator-grant-code.mjs <email> <plan: gratis|basico|premium> [nombre]');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const plan = planArg.trim().toLowerCase();
const nombre = nombreArg?.trim();

const PLAN_CONFIG = {
  gratis: { sessions: 1, vigenciaDias: 240 },
  basico: { sessions: 3, vigenciaDias: 240 },
  premium: { sessions: 8, vigenciaDias: 240 },
};

if (!PLAN_CONFIG[plan]) {
  console.error(`Plan inválido: ${plan}. Opciones: gratis, basico, premium.`);
  process.exit(1);
}

const cfg = PLAN_CONFIG[plan];

// SHA-256 del email → primeros 16 hex (mismo formato que webhook)
const emailHash = createHash('sha256').update(email).digest('hex').slice(0, 16);

// Generar código SIM-XXXXXXXX (excluye O/0/I/1)
function generateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SIM-';
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

const accessCode = generateCode();
const nowIso = new Date().toISOString();
const expiresAt = new Date(Date.now() + cfg.vigenciaDias * 24 * 3600 * 1000).toISOString();
const ttl = cfg.vigenciaDias * 24 * 3600;

const betaRecord = {
  nombre_pila: nombre,
  email_hash: emailHash,
  max_sessions: cfg.sessions,
  sessions_used: 0,
  granted_at: nowIso,
  expires_at: expiresAt,
  cohort: 'paywall',
  plan,
};

const creditsRecord = {
  plan,
  remaining: cfg.sessions,
  purchasedAt: nowIso,
  expiresAt,
  history: [
    {
      at: nowIso,
      plan,
      sessionsAdded: cfg.sessions,
      stripeSessionId: `manual_grant_${nowIso}`,
    },
  ],
};

function wranglerPut(binding, key, value, ttlSec) {
  const cmd = `npx wrangler kv key put "${key}" '${value}' --binding=${binding} --remote --expiration-ttl=${ttlSec}`;
  console.log(`\n[wrangler] Escribiendo ${binding}/${key} (TTL ${ttlSec}s)`);
  try {
    const out = execSync(cmd, { encoding: 'utf8' });
    console.log(out.trim().split('\n').slice(-2).join('\n'));
  } catch (err) {
    console.error('  Falló:', err.message);
    process.exit(1);
  }
}

console.log('\n== GRANT MANUAL DE CÓDIGO ==');
console.log(`  email:       ${email}`);
console.log(`  email_hash:  ${emailHash}`);
console.log(`  plan:        ${plan}`);
console.log(`  sesiones:    ${cfg.sessions}`);
console.log(`  vigencia:    ${cfg.vigenciaDias} días · expira ${expiresAt.slice(0, 10)}`);
console.log(`  código:      ${accessCode}`);

wranglerPut('SIMULATOR_BETA_CODES', `beta:${accessCode}`, JSON.stringify(betaRecord), ttl);
wranglerPut('SIMULATOR_CREDITS', `credits:${emailHash}`, JSON.stringify(creditsRecord), ttl);

console.log('\n== LISTO ==');
console.log(`\nURL para el usuario:`);
console.log(`  https://solcaciencia.com/simulador-entrevistas/?codigo=${accessCode}\n`);
