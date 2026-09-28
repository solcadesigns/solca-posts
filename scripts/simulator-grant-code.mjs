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
 * Planes (v3 · 11 sept 2026 · sincronizado con src/lib/simulator-types.ts):
 *   basico   → 3 sesiones · vigencia 240 días
 *   premium  → 5 sesiones · vigencia 240 días (era 8 en v2)
 *   gratis   → 1 sesión   · vigencia 10 días (era 240 en v2)
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

// v3 (11 sept 2026): sincronizado con PLAN_CONFIG en src/lib/simulator-types.ts.
// Si cambias planes en el schema, actualiza también este archivo.
const PLAN_CONFIG = {
  gratis: { sessions: 1, vigenciaDias: 10 },
  basico: { sessions: 3, vigenciaDias: 240 },
  premium: { sessions: 5, vigenciaDias: 240 },
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

const betaRecord = {
  nombre_pila: nombre,
  email, // Guardamos el email plano para que el cron pueda enviar el reporte
         // por Postmark cuando el async chunks completa. El email_hash sigue
         // usándose para tracking/dedup, pero el plano es necesario para envío.
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

function wranglerPut(binding, key, value) {
  // Wrangler 4.x cambió la sintaxis de --expiration-ttl. Escribimos sin TTL
  // (el key vive hasta que lo borres manualmente). Para pruebas manuales OK.
  const cmd = `npx wrangler kv key put "${key}" '${value}' --binding=${binding} --remote`;
  console.log(`\n[wrangler] Escribiendo ${binding}/${key}`);
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

wranglerPut('SIMULATOR_BETA_CODES', `beta:${accessCode}`, JSON.stringify(betaRecord));
wranglerPut('SIMULATOR_CREDITS', `credits:${emailHash}`, JSON.stringify(creditsRecord));

// 14 sept 2026: envío opcional del welcome email via Postmark si se pasa
// POSTMARK_SERVER_TOKEN en env. Si no está, imprime la URL y termina.
// Template alias: welcome-simulator-code (mismo que usa simulator-subscribe.ts).
async function sendWelcomeEmail() {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    console.log('\n[email] POSTMARK_SERVER_TOKEN no está en env · se omite envío.');
    console.log('        Para enviar automáticamente, exporta el token antes:');
    console.log('        export POSTMARK_SERVER_TOKEN=... && node scripts/simulator-grant-code.mjs ...');
    return;
  }

  const accessUrl = `https://solcaciencia.com/simulador-entrevistas/sesion?codigo=${accessCode}`;
  const firstName = nombre || email.split('@')[0];
  const expiresAtHuman = new Date(expiresAt).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const body = {
    From: 'Oscar Solís <hola@solcaciencia.com>',
    To: email,
    TemplateAlias: 'welcome-simulator-code',
    TemplateModel: {
      first_name: firstName,
      access_code: accessCode,
      access_url: accessUrl,
      expires_at_human: expiresAtHuman,
    },
    MessageStream: 'outbound',
    Tag: 'welcome-simulator-code',
    Metadata: { source: 'grant-code-cli', plan },
  };

  try {
    const res = await fetch('https://api.postmarkapp.com/email/withTemplate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`\n[email] Postmark falló: ${res.status} ${JSON.stringify(json)}`);
      return;
    }
    console.log(`\n[email] Enviado a ${email} · messageId ${json.MessageID}`);
  } catch (err) {
    console.error('\n[email] Error inesperado:', err.message);
  }
}

await sendWelcomeEmail();

console.log('\n== LISTO ==');
console.log(`\nURL para el usuario:`);
console.log(`  https://solcaciencia.com/simulador-entrevistas/?codigo=${accessCode}\n`);
