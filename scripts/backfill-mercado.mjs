#!/usr/bin/env node
/**
 * Carga histórica de la encuesta de mercado (catálogo v1, 20 oct 2026).
 *
 * Lee (solo lectura) las fuentes anteriores y escribe un archivo SQL con los
 * INSERT para la tabla `mercado_respuestas`. No escribe en producción: el SQL
 * se aplica a mano con wrangler.
 *
 *   - D1 `sessions` (simulador): formación, rol, etapa (si se puede), país inferido, edad, género
 *   - KV QUIZ_METRICS `m:` (quiz): país, rol que creía, rol resultado
 *   - KV CV_METRICS `s:` (encuesta anterior del analizador): núcleo traducido + preguntas retiradas (cv_v0)
 *
 * Los registros históricos van sin `aid`. Las equivalencias salen de src/lib/market-catalog.ts.
 *
 * Corte: solo se cargan registros anteriores a --corte (el momento en que el
 * endpoint nuevo quedó en producción). Lo posterior ya entra en vivo; cargarlo
 * aquí lo contaría dos veces.
 *
 * Las filas históricas llevan catalogo_version 'v1_hist' (núcleo traducido) o
 * 'cv_v0' (preguntas retiradas). Re-ejecutar borra solo esas versiones.
 *
 * El país inferido del simulador no se carga: lo infiere el modelo desde la
 * vacante o el idioma, no es "dónde vives". El rol 'Other' es el valor por
 * defecto de la plantilla, no una respuesta: tampoco se carga.
 *
 * Uso (desde website/):
 *   node scripts/backfill-mercado.mjs --corte 2026-10-20T21:30:00Z   → escribe scripts/out/backfill-mercado.sql
 *   npx wrangler d1 execute simulator-metrics --remote --file scripts/out/backfill-mercado.sql
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  isValidValue,
  mapPais,
  mapEtapaSimulador,
  mapFormacionSimulador,
  mapRolSimulador,
  mapRolQuiz,
  mapCvV0,
} from '../src/lib/market-catalog.ts';

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}
function kvList(binding, prefix) {
  return JSON.parse(wrangler(['kv', 'key', 'list', '--binding', binding, '--prefix', prefix, '--remote'])).map((k) => k.name);
}
function kvGet(binding, key) {
  return JSON.parse(wrangler(['kv', 'key', 'get', key, '--binding', binding, '--remote']));
}
function q(v) {
  return v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
}

const corteArg = process.argv.indexOf('--corte');
const corteDate = corteArg > -1 ? new Date(process.argv[corteArg + 1]) : null;
if (!corteDate || Number.isNaN(corteDate.getTime())) {
  console.error('Falta --corte <ISO>: el momento en que el endpoint de mercado quedó en producción.');
  process.exit(1);
}
const CORTE = corteDate.toISOString();
const HIST = 'v1_hist';
const rows = [];
function add(origen, tipo, a, ts, version = HIST) {
  if (!a || !ts || ts >= CORTE) return;
  if (version === HIST && !isValidValue(a.pregunta, a.valor)) return;
  rows.push({ origen, tipo, ...a, ts, version });
}

// 1. Simulador (D1)
const sim = JSON.parse(
  wrangler([
    'd1', 'execute', 'simulator-metrics', '--remote', '--json', '--command',
    'SELECT ts, area_formacion, anios_experiencia, rol_apuntado, edad_rango, genero FROM sessions',
  ]),
)[0].results;
for (const r of sim) {
  const ts = new Date(Number(r.ts)).toISOString();
  add('simulador', 'derivado', mapEtapaSimulador(undefined, r.anios_experiencia, r.area_formacion), ts);
  add('simulador', 'derivado', mapFormacionSimulador(r.area_formacion), ts);
  if (r.rol_apuntado && r.rol_apuntado !== 'Other') add('simulador', 'derivado', mapRolSimulador(r.rol_apuntado), ts);
  if (r.edad_rango) add('simulador', 'derivado', { pregunta: 'edad', valor: r.edad_rango }, ts);
  if (r.genero) add('simulador', 'derivado', { pregunta: 'genero', valor: r.genero }, ts);
}
console.log(`simulador: ${sim.length} sesiones`);

// 2. Quiz (KV)
const quizKeys = kvList('QUIZ_METRICS', 'm:');
for (const k of quizKeys) {
  const r = kvGet('QUIZ_METRICS', k);
  const ts = r.ts ?? k.slice(2, 26);
  add('quiz', 'derivado', mapPais(r.country), ts);
  add('quiz', 'derivado', mapRolQuiz(r.selfMatch, 'rol_interes'), ts);
  add('quiz', 'derivado', mapRolQuiz(r.role, 'rol_resultado_quiz'), ts);
}
console.log(`quiz: ${quizKeys.length} completados`);

// 3. Encuesta anterior del analizador (KV)
const cvKeys = kvList('CV_METRICS', 's:');
for (const k of cvKeys) {
  const r = kvGet('CV_METRICS', k);
  const ts = r.ts ?? k.slice(2, 26);
  if (r.country) add('cv', 'derivado', mapPais(r.country), ts);
  for (const [question, ans] of Object.entries(r.answers ?? {})) {
    for (const value of Array.isArray(ans) ? ans : [ans]) {
      const m = mapCvV0(question, String(value));
      if (!m) continue;
      if (m.legacy) add('cv', 'encuesta', { pregunta: m.pregunta, valor: m.valor }, ts, 'cv_v0');
      else add('cv', 'encuesta', m, ts);
    }
  }
}
console.log(`cv: ${cvKeys.length} encuestas`);

const sql = [
  '-- Carga histórica de mercado_respuestas (generado por scripts/backfill-mercado.mjs).',
  `-- Corte: ${CORTE}. Idempotente: borra solo filas históricas (v1_hist, cv_v0).`,
  "DELETE FROM mercado_respuestas WHERE catalogo_version IN ('v1_hist', 'cv_v0');",
  ...rows.map(
    (r) =>
      `INSERT INTO mercado_respuestas (aid, origen, tipo, pregunta, valor, valor_detalle, ts, catalogo_version) VALUES (NULL, ${q(r.origen)}, ${q(r.tipo)}, ${q(r.pregunta)}, ${q(r.valor)}, ${q(r.valor_detalle)}, ${q(r.ts)}, ${q(r.version)});`,
  ),
].join('\n');

mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/backfill-mercado.sql', import.meta.url), sql + '\n');
console.log(`filas: ${rows.length} → scripts/out/backfill-mercado.sql`);
