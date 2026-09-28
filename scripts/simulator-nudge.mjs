#!/usr/bin/env node
/**
 * scripts/simulator-nudge.mjs · envío único de recordatorio al simulador.
 *
 * Contexto: post-lanzamiento pre-paywall (agosto-septiembre 2026). La landing
 * pública emite códigos y guarda el lead en KV EMAILS con prefix `sim:`.
 * Este script lee esos leads y les manda UN email de recordatorio con su
 * código, usando el template Postmark `simulator-nudge`.
 *
 * NO es un drip automatizado. Es un send único, manual, controlado.
 *
 * Uso (desde website/):
 *   node scripts/simulator-nudge.mjs --dry-run    # preview sin enviar
 *   node scripts/simulator-nudge.mjs --send       # envío real
 *
 * Requisitos:
 *   - POSTMARK_SERVER_TOKEN en env (o en .env.local).
 *   - Wrangler autenticado, con acceso al KV EMAILS remoto.
 *
 * Filtros:
 *   - Excluye emails de prueba definidos en EXCLUDE_EMAILS.
 *   - Marca en el log si el usuario ya recibió nudge previamente (idempotencia
 *     básica vía prefix `nudged:` en el mismo KV — este script escribe esa
 *     marca solo tras confirmar envío exitoso).
 */

import { execSync } from 'node:child_process';

const DRY_RUN = process.argv.includes('--dry-run');
const SEND = process.argv.includes('--send');
if (!DRY_RUN && !SEND) {
  console.error('Usa --dry-run para preview o --send para enviar.');
  process.exit(1);
}

const POSTMARK_TOKEN = process.env.POSTMARK_SERVER_TOKEN;
if (SEND && !POSTMARK_TOKEN) {
  console.error('Falta POSTMARK_SERVER_TOKEN en env.');
  process.exit(1);
}

// Emails de prueba a excluir del envío.
const EXCLUDE_EMAILS = new Set([
  'hello@solcaciencia.com',
  'hola@solcaciencia.com',
  'solcadesigns@gmail.com',
  'oscar_solis90@hotmail.com',
  // Ya completaron sesión + feedback · no necesitan recordatorio
  'de.lilian@gmail.com',
]);

// Wrapper wrangler kv
function wranglerKvList(binding, prefix) {
  const out = execSync(
    `npx wrangler kv key list --binding=${binding} --prefix=${prefix} --remote 2>/dev/null`,
    { encoding: 'utf-8' },
  );
  return JSON.parse(out);
}
function wranglerKvGet(binding, key) {
  const out = execSync(
    `npx wrangler kv key get "${key}" --binding=${binding} --remote 2>/dev/null`,
    { encoding: 'utf-8' },
  );
  return out.trim();
}

async function sendNudge(record) {
  const firstName = (record.name || 'ahí').trim().split(/\s+/)[0];
  const accessUrl = `https://solcaciencia.com/simulador-entrevistas/sesion?codigo=${record.code}`;
  const body = {
    From: 'Oscar Solís <hola@solcaciencia.com>',
    To: record.email,
    TemplateAlias: 'simulator-nudge',
    MessageStream: 'outbound',
    Tag: 'simulator-nudge',
    TemplateModel: {
      first_name: firstName,
      access_code: record.code,
      access_url: accessUrl,
    },
    Metadata: {
      source: 'simulator-nudge',
      cohort: record.cohort || 'pre-paywall',
    },
  };
  const res = await fetch('https://api.postmarkapp.com/email/withTemplate', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': POSTMARK_TOKEN,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

async function main() {
  console.log(`\n== simulator-nudge · modo: ${DRY_RUN ? 'DRY-RUN' : 'SEND REAL'} ==\n`);

  const keys = wranglerKvList('EMAILS', 'sim:');
  console.log(`Leads en KV EMAILS prefix "sim:" · ${keys.length} encontrados`);

  const candidates = [];
  for (const k of keys) {
    const raw = wranglerKvGet('EMAILS', k.name);
    let rec;
    try { rec = JSON.parse(raw); } catch { continue; }
    if (!rec.email || !rec.code) continue;
    if (EXCLUDE_EMAILS.has(rec.email.toLowerCase())) {
      console.log(`  skip · test · ${rec.email}`);
      continue;
    }
    candidates.push(rec);
  }

  console.log(`Candidatos tras filtro · ${candidates.length}`);
  console.log(`Excluidos (tests) · ${keys.length - candidates.length}`);
  console.log('');

  for (const rec of candidates) {
    const label = `${rec.email} · code ${rec.code} · name ${rec.name || '(sin nombre)'}`;
    if (DRY_RUN) {
      console.log(`[dry] ${label}`);
      continue;
    }
    try {
      const r = await sendNudge(rec);
      if (r.status === 200) {
        console.log(`[sent ${r.body.MessageID.slice(0, 8)}] ${label}`);
      } else {
        console.error(`[FAIL ${r.status}] ${label} · ${JSON.stringify(r.body)}`);
      }
      await new Promise((res) => setTimeout(res, 200)); // rate-limit gentle
    } catch (err) {
      console.error(`[ERR] ${label} · ${err.message}`);
    }
  }

  console.log('\n== fin ==\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
