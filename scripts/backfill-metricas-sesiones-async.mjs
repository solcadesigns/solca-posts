#!/usr/bin/env node
/**
 * Respaldo de una sola vez · llena en D1 `sessions` las métricas finales de sesiones del camino ASYNC
 * (reporte por chunks) que quedaron con la fila inicial y scores NULL antes del fix del 30 oct 2026.
 *
 * SOLO LECTURA de producción: 1 SELECT a D1 + lectura de KV SIMULATOR_SESSIONS (session:<id>, TTL 90 días)
 * en lotes de 100. Escribe un archivo SQL; no escribe en D1 ni en KV. El SQL lo aplica Oscar a mano.
 *
 * Sin duplicar reglas: el mapeo es buildAsyncFinalMetrics (src/lib/simulator-async-metrics.ts) y el SQL es
 * el que genera writeMetricsToD1 (src/lib/simulator-metrics-writer.ts), capturado con un D1 falso. Mismo
 * UPSERT por session_id y mismo DELETE + INSERT de session_tags → idempotente si se aplica dos veces.
 * Requiere Node >= 22.18 / 23.6 (importa .ts con type stripping).
 *
 * Sin datos personales: el state de KV (trae correo y respuestas) solo vive en memoria; al SQL van
 * únicamente session_id, scores, perfil anónimo y términos de vocabulario.
 *
 * Uso (desde website/):
 *   node scripts/backfill-metricas-sesiones-async.mjs --contar
 *       → 1 SELECT a D1 + 1 lectura de KV por sesión candidata; imprime recuperables / no recuperables.
 *   node scripts/backfill-metricas-sesiones-async.mjs
 *       → lo mismo y escribe scripts/out/backfill-metricas-sesiones-async.sql
 *   npx wrangler d1 execute simulator-metrics --remote --file scripts/out/backfill-metricas-sesiones-async.sql
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildAsyncFinalMetrics, hasAsyncSummary } from '../src/lib/simulator-async-metrics.ts';
import { writeMetricsToD1 } from '../src/lib/simulator-metrics-writer.ts';

const OUT = join(process.cwd(), 'scripts', 'out');
const OUT_FILE = join(OUT, 'backfill-metricas-sesiones-async.sql');
const args = new Set(process.argv.slice(2));

// Sesiones con métricas finales vacías: los 3 scores NULL (la fila inicial los deja así).
export const CANDIDATAS_SQL =
  'SELECT session_id, area_formacion, rol_apuntado, sesion_duracion_total_seg, respuesta_promedio_seg, numero_preguntas ' +
  'FROM sessions WHERE score_tecnico IS NULL AND score_estructura IS NULL AND score_especificidad IS NULL ORDER BY ts';

function wrangler(a) {
  return execFileSync('npx', ['wrangler', ...a], { encoding: 'utf8', stdio: 'pipe', maxBuffer: 256 * 1024 * 1024 });
}
// La salida de wrangler puede traer avisos antes del JSON: tomar desde la primera línea que empieza con
// el carácter de apertura hasta el último de cierre.
function parseJsonFrom(raw, open, close) {
  const lines = raw.split('\n');
  const i = lines.findIndex((l) => l.startsWith(open));
  if (i < 0) throw new Error(`salida de wrangler sin JSON: ${raw.slice(0, 200)}`);
  const body = lines.slice(i).join('\n');
  return JSON.parse(body.slice(0, body.lastIndexOf(close) + 1));
}

function d1Select(sql) {
  const res = parseJsonFrom(
    wrangler(['d1', 'execute', 'simulator-metrics', '--remote', '--json', '--command', sql]),
    '[',
    ']',
  );
  const r = res[0] ?? {};
  return { rows: r.results ?? [], rowsRead: r.meta?.rows_read ?? null };
}

function kvBulkGet(binding, keys) {
  mkdirSync(OUT, { recursive: true });
  const out = {};
  for (let i = 0; i < keys.length; i += 100) {
    const f = join(OUT, '.bulk-keys-sesiones.json');
    writeFileSync(f, JSON.stringify(keys.slice(i, i + 100)));
    try {
      const parsed = parseJsonFrom(wrangler(['kv', 'bulk', 'get', f, '--binding', binding, '--remote']), '{', '}');
      for (const [k, v] of Object.entries(parsed)) {
        const val = v && typeof v === 'object' && 'value' in v ? v.value : v;
        if (val !== null && val !== undefined) out[k] = typeof val === 'string' ? val : JSON.stringify(val);
      }
    } finally {
      rmSync(f, { force: true });
    }
    process.stderr.write(`  leídas ${Math.min(i + 100, keys.length)}/${keys.length}\n`);
  }
  return out;
}

// D1 falso: registra lo que writeMetricsToD1 ejecutaría y lo convierte en SQL literal.
function lit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}
function render(sql, params) {
  let n = 0;
  const text = sql.trim().replace(/;\s*$/, '').replace(/\?/g, () => lit(params[n++]));
  if (n !== params.length) throw new Error(`placeholders (${n}) != params (${params.length})`);
  return text.replace(/\n\s*/g, ' ') + ';';
}
function fakeDb(sink) {
  const stmt = (sql) => {
    const s = { sql, params: [] };
    s.bind = (...p) => { s.params = p; return s; };
    s.run = async () => { sink.push(render(s.sql, s.params)); return { success: true }; };
    return s;
  };
  return {
    prepare: stmt,
    batch: async (stmts) => { for (const s of stmts) sink.push(render(s.sql, s.params)); return []; },
  };
}

const { rows, rowsRead } = d1Select(CANDIDATAS_SQL);
console.error(`D1: ${rows.length} sesiones con scores NULL (1 consulta, filas leídas: ${rowsRead ?? 'n/d'})`);

const keys = rows.map((r) => `session:${r.session_id}`);
const vals = keys.length ? kvBulkGet('SIMULATOR_SESSIONS', keys) : {};
console.error(`KV: ${keys.length} lecturas (${Math.ceil(keys.length / 100)} llamadas bulk get)`);

const recuperables = [];
const sinEstado = [];
const sinSummary = [];
for (const r of rows) {
  let state = null;
  try { state = JSON.parse(vals[`session:${r.session_id}`] ?? 'null'); } catch { state = null; }
  if (!state || typeof state !== 'object' || !state.profile) { sinEstado.push(r); continue; }
  if (!hasAsyncSummary(state)) { sinSummary.push(r); continue; }
  recuperables.push({ row: r, state });
}

const porN = (list) =>
  Object.entries(list.reduce((acc, x) => { const n = (x.row ?? x).numero_preguntas; acc[n] = (acc[n] ?? 0) + 1; return acc; }, {}))
    .map(([n, c]) => `${n}q: ${c}`).join(', ') || '-';
const porStatus = Object.entries(recuperables.reduce((acc, x) => { const k = x.state.finalReportStatus ?? 'sin_status'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}))
  .map(([k, c]) => `${k}: ${c}`).join(', ') || '-';
console.error(`Recuperables (summary async en KV): ${recuperables.length} [${porN(recuperables)}] [${porStatus}]`);
console.error(`No recuperables · estado ya no está en KV: ${sinEstado.length} [${porN(sinEstado)}]`);
console.error(`No recuperables · estado sin summary async (sync fallido, en proceso o failed): ${sinSummary.length} [${porN(sinSummary)}]`);
if (args.has('--contar')) process.exit(0);

const sql = [];
let sinScores = 0;
for (const { row, state } of recuperables) {
  const metrics = buildAsyncFinalMetrics(state, {
    area_formacion: row.area_formacion,
    rol_apuntado: row.rol_apuntado,
    sesion_duracion_total_seg: row.sesion_duracion_total_seg,
    respuesta_promedio_seg: row.respuesta_promedio_seg,
  });
  const s = metrics.scorePromedioPorDimension;
  if (s.tecnico === null && s.estructura === null && s.especificidad === null) sinScores++;
  sql.push(`-- ${row.session_id}`);
  await writeMetricsToD1(fakeDb(sql), { sessionId: row.session_id, metrics, hasCvSummary: Boolean(state.cvSummary) });
}
mkdirSync(OUT, { recursive: true });
writeFileSync(OUT_FILE, sql.join('\n') + '\n');
console.error(`Escrito scripts/out/backfill-metricas-sesiones-async.sql: ${recuperables.length} sesiones (${sinScores} con summary pero sin scores numéricos: seguirán NULL).`);
