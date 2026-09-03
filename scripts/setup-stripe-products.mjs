#!/usr/bin/env node
/**
 * scripts/setup-stripe-products.mjs · crea products+prices del Simulador en Stripe.
 *
 * Contexto: paywall del simulador (2 sept 2026). Dos planes one-shot en MXN:
 *   - Básico:  $149 MXN · 3 sesiones · 240 días vigencia
 *   - Premium: $299 MXN · 8 sesiones · 240 días vigencia
 *
 * Ver `_docs/PAYWALL_SIMULADOR.md` para el schema completo.
 *
 * Uso (desde website/):
 *   STRIPE_SECRET_KEY=sk_test_...  node scripts/setup-stripe-products.mjs
 *   STRIPE_SECRET_KEY=sk_live_...  node scripts/setup-stripe-products.mjs --live
 *
 * Idempotencia: usa metadata.solca_plan_id como lookup. Si ya existe un product
 * con ese id, actualiza el precio en vez de crear duplicados.
 *
 * Output al final: dos líneas listas para pegar como wrangler secret:
 *   STRIPE_PRICE_ID_BASICO=price_...
 *   STRIPE_PRICE_ID_PREMIUM=price_...
 *
 * Requisitos: Node 18+ (fetch nativo). Sin dependencias npm adicionales.
 */

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const IS_LIVE = process.argv.includes('--live');

if (!STRIPE_KEY) {
  console.error('ERROR: Falta STRIPE_SECRET_KEY en env.');
  console.error('Uso: STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.mjs');
  process.exit(1);
}

if (IS_LIVE && !STRIPE_KEY.startsWith('sk_live_')) {
  console.error('ERROR: --live requiere STRIPE_SECRET_KEY que empiece con sk_live_');
  process.exit(1);
}
if (!IS_LIVE && !STRIPE_KEY.startsWith('sk_test_')) {
  console.error('ERROR: sin --live la key debe empezar con sk_test_');
  console.error('Si quieres correr en modo live, pasa --live explícitamente.');
  process.exit(1);
}

// ── Config declarativa. Cambios de pricing pasan por aquí. ─────────────
const PLANS = [
  {
    id: 'solca_simulator_basico_v1',
    name: 'Simulador de Entrevistas Pharma · Básico',
    description:
      '3 sesiones de simulador de entrevistas pharma. Elige cualquier etapa (llamada inicial, técnica o panel). Sube tu CV y practica con feedback estructurado. Vigencia 240 días desde la compra.',
    priceMxnCents: 14900, // Stripe usa cents (mínima unidad monetaria)
    envVarName: 'STRIPE_PRICE_ID_BASICO',
  },
  {
    id: 'solca_simulator_premium_v1',
    name: 'Simulador de Entrevistas Pharma · Premium',
    description:
      '8 sesiones de simulador de entrevistas pharma. Todas las etapas + 3 niveles de dificultad. Historial personal para practicar diferentes CVs y vacantes en paralelo. Reporte final con leyenda extendida (rúbrica visible + tips por dimensión). Vigencia 240 días desde la compra.',
    priceMxnCents: 29900,
    envVarName: 'STRIPE_PRICE_ID_PREMIUM',
  },
];

// ── Helpers Stripe API ─────────────────────────────────────────────────
async function stripe(path, method = 'GET', bodyObj = null) {
  const url = `https://api.stripe.com/v1/${path}`;
  const body = bodyObj ? new URLSearchParams(flattenForStripe(bodyObj)).toString() : undefined;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = json?.error?.message || JSON.stringify(json);
    throw new Error(`Stripe ${method} /${path} → ${res.status}: ${err}`);
  }
  return json;
}

// Stripe requiere metadata[key]=value en form-encoded. Aplanamos.
function flattenForStripe(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenForStripe(v, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

async function findOrCreateProduct(plan) {
  // Busca producto existente por metadata.solca_plan_id (lookup idempotente).
  const search = await stripe(
    `products/search?query=${encodeURIComponent(`metadata['solca_plan_id']:'${plan.id}'`)}`,
  );
  if (search.data?.length > 0) {
    console.log(`  · producto existente: ${search.data[0].id}`);
    return search.data[0];
  }
  console.log(`  · creando producto nuevo…`);
  const created = await stripe('products', 'POST', {
    name: plan.name,
    description: plan.description,
    metadata: { solca_plan_id: plan.id },
    active: 'true',
  });
  console.log(`  · producto creado: ${created.id}`);
  return created;
}

async function findOrCreatePrice(product, plan) {
  // Busca price activo con mismo product y unit_amount. Lista precios del producto.
  const prices = await stripe(`prices?product=${product.id}&active=true&limit=100`);
  const existing = prices.data?.find(
    (p) => p.currency === 'mxn' && p.unit_amount === plan.priceMxnCents && p.type === 'one_time',
  );
  if (existing) {
    console.log(`  · precio existente: ${existing.id} · $${(existing.unit_amount / 100).toFixed(2)} MXN`);
    return existing;
  }
  console.log(`  · creando precio nuevo…`);
  const created = await stripe('prices', 'POST', {
    product: product.id,
    unit_amount: plan.priceMxnCents,
    currency: 'mxn',
    metadata: { solca_plan_id: plan.id },
  });
  console.log(`  · precio creado: ${created.id} · $${(created.unit_amount / 100).toFixed(2)} MXN`);
  return created;
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  const mode = IS_LIVE ? 'LIVE' : 'TEST';
  console.log(`\n== Stripe setup Solca Simulador · modo ${mode} ==\n`);

  const results = [];
  for (const plan of PLANS) {
    console.log(`Plan: ${plan.name}`);
    const product = await findOrCreateProduct(plan);
    const price = await findOrCreatePrice(product, plan);
    results.push({ plan, product, price });
    console.log('');
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log('COMPLETADO. Copia estas líneas a wrangler secrets:');
  console.log('══════════════════════════════════════════════════════════');
  for (const { plan, price } of results) {
    console.log(`${plan.envVarName}=${price.id}`);
  }
  console.log('');
  console.log('Comandos wrangler (correr uno por línea):');
  for (const { plan, price } of results) {
    console.log(`  echo -n "${price.id}" | npx wrangler secret put ${plan.envVarName}`);
  }
  console.log('');
  console.log(`También necesitas configurar el webhook secret una vez que crees el endpoint`);
  console.log(`en Stripe Dashboard → Developers → Webhooks:`);
  console.log(`  URL: https://solcaciencia.com/api/simulator-stripe-webhook`);
  console.log(`  Evento: checkout.session.completed`);
  console.log(`  Luego: echo -n "whsec_..." | npx wrangler secret put STRIPE_WEBHOOK_SECRET`);
  console.log('');
}

main().catch((err) => {
  console.error('\nERROR fatal:', err.message);
  process.exit(1);
});
