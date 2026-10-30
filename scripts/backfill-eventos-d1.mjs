#!/usr/bin/env node
/**
 * Backfill de una sola vez · copia a D1 `eventos` los `evt:` que siguen vivos en KV SIMULATOR_METRICS (≤90 días).
 * 30 oct 2026. Requiere la migración 0011 aplicada en remoto.
 *
 * SOLO LECTURA de producción: lista y lee KV, y escribe un archivo SQL. No escribe en D1 ni en KV.
 * El SQL lo aplica Oscar a mano. Las filas usan la misma llave del KV como id e INSERT OR IGNORE, así que
 * re-ejecutar o traslaparse con la escritura en vivo no duplica.
 * El mapeo de campos es el de src/lib/eventos-d1.ts (si cambias uno, cambia el otro).
 *
 * Uso (desde website/):
 *   node scripts/backfill-eventos-d1.mjs --contar
 *       → solo lista llaves (1 operación de listado de KV por cada 1,000 llaves) e imprime cuántas hay.
 *   node scripts/backfill-eventos-d1.mjs
 *       → lista + lee en lotes de 100 (wrangler kv bulk get) y escribe scripts/out/backfill-eventos.sql
 *   npx wrangler d1 execute simulator-metrics --remote --file scripts/out/backfill-eventos.sql
 *
 * Opcional, también de una vez: --agregados escribe además scripts/out/agregados-sin-ttl-<binding>.json con los
 * `digest:` (SIMULATOR_METRICS) y `broadcast-report:` (EMAILS) vivos, para volver a escribirlos SIN TTL:
 *   npx wrangler kv bulk put scripts/out/agregados-sin-ttl-SIMULATOR_METRICS.json --binding SIMULATOR_METRICS --remote
 *   npx wrangler kv bulk put scripts/out/agregados-sin-ttl-EMAILS.json --binding EMAILS --remote
 * (son agregados anónimos; una escritura de KV por llave).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'scripts', 'out');
const args = new Set(process.argv.slice(2));

function wrangler(a) {
  return execFileSync('npx', ['wrangler', ...a], { encoding: 'utf8', stdio: 'pipe', maxBuffer: 256 * 1024 * 1024 });
}
function kvList(binding, prefix) {
  return JSON.parse(wrangler(['kv', 'key', 'list', '--binding', binding, '--prefix', prefix, '--remote'])).map((k) => k.name);
}
// Lee en lotes de 100 llaves. Devuelve { llave: valor (string) }.
function kvBulkGet(binding, keys) {
  mkdirSync(OUT, { recursive: true });
  const out = {};
  for (let i = 0; i < keys.length; i += 100) {
    const f = join(OUT, '.bulk-keys.json');
    writeFileSync(f, JSON.stringify(keys.slice(i, i + 100)));
    const raw = wrangler(['kv', 'bulk', 'get', f, '--binding', binding, '--remote']);
    const parsed = JSON.parse(raw.slice(raw.indexOf('{')));
    for (const [k, v] of Object.entries(parsed)) {
      // La salida trae el valor como string o como { value, metadata } según la versión de wrangler.
      const val = v && typeof v === 'object' && 'value' in v ? v.value : v;
      if (val !== null && val !== undefined) out[k] = typeof val === 'string' ? val : JSON.stringify(val);
    }
    rmSync(f, { force: true });
    process.stderr.write(`  leídas ${Math.min(i + 100, keys.length)}/${keys.length}\n`);
  }
  return out;
}

const q = (v, max = 200) => (typeof v === 'string' && v ? `'${v.slice(0, max).replace(/'/g, "''")}'` : 'NULL');
function host(ref) {
  if (typeof ref !== 'string' || !ref) return null;
  try { return new URL(ref).hostname.toLowerCase().replace(/^www\./, '').slice(0, 100) || null; } catch { return null; }
}

const keys = kvList('SIMULATOR_METRICS', 'evt:');
console.error(`Llaves evt: vivas: ${keys.length} (listados de KV usados: ${Math.max(1, Math.ceil(keys.length / 1000))})`);
if (args.has('--contar')) process.exit(0);

const vals = kvBulkGet('SIMULATOR_METRICS', keys);
const lines = [];
let omitidas = 0;
for (const k of keys) {
  let r;
  try { r = JSON.parse(vals[k] ?? 'null'); } catch { r = null; }
  if (!r || typeof r.ts !== 'string' || typeof r.event !== 'string' || Number.isNaN(Date.parse(r.ts))) { omitidas++; continue; }
  const ft = r.ft ?? {};
  const lt = r.lt ?? {};
  lines.push(
    `INSERT OR IGNORE INTO eventos (id, ts, dia, evento, page, path, product, tag, plan, cta, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer_host, country, aid, ft_source, ft_medium, ft_campaign, ft_content, ft_ref_host, ft_landing, lt_source, lt_medium, lt_campaign, lt_content, lt_ref_host, interno, extra, origen) VALUES (` +
      [
        q(k), q(r.ts), q(r.ts.slice(0, 10)), q(r.event, 50), q(r.page, 30), q(r.path), q(r.product), q(r.tag, 100),
        q(r.plan, 20), q(r.cta, 20), q(r.utm_source), q(r.utm_medium), q(r.utm_campaign), q(r.utm_content), q(r.utm_term),
        q(host(r.referrer)), q(r.country, 2), q(r.aid, 36),
        q(ft.utm_source), q(ft.utm_medium), q(ft.utm_campaign), q(ft.utm_content), q(ft.ref_host), q(ft.landing_path),
        q(lt.utm_source), q(lt.utm_medium), q(lt.utm_campaign), q(lt.utm_content), q(lt.ref_host),
        r.interno === true ? 1 : 0, 'NULL', "'backfill'",
      ].join(', ') +
      ');',
  );
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'backfill-eventos.sql'), lines.join('\n') + '\n');
console.error(`Escrito scripts/out/backfill-eventos.sql: ${lines.length} filas (${omitidas} llaves vencidas o ilegibles omitidas).`);

if (args.has('--agregados')) {
  for (const [binding, prefix] of [['SIMULATOR_METRICS', 'digest:'], ['EMAILS', 'broadcast-report:']]) {
    const ks = kvList(binding, prefix);
    const vs = ks.length ? kvBulkGet(binding, ks) : {};
    const items = ks.filter((k) => vs[k]).map((k) => ({ key: k, value: vs[k] })); // sin expiration_ttl = permanente
    writeFileSync(join(OUT, `agregados-sin-ttl-${binding}.json`), JSON.stringify(items));
    console.error(`Escrito scripts/out/agregados-sin-ttl-${binding}.json: ${items.length} llaves ${prefix}`);
  }
}
