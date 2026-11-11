/**
 * Pruebas offline de la encuesta de resultado a 14 días (src/lib/encuesta-resultado.ts) · 11 nov 2026.
 * Uso: node scripts/test-encuesta.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  programarEncuesta, pendientesVencidas, renderEncuesta, tokenDeLlave, opcion, OPCIONES,
  PREFIJO_PENDIENTE, PREFIJO_TOKEN, ENCUESTA_DIAS,
} from '../src/lib/encuesta-resultado.ts';

let n = 0;
async function prueba(nombre, fn) {
  try { await fn(); n++; } catch (e) { console.error(`FALLÓ: ${nombre}\n`, e); process.exit(1); }
}
function kvFalso() {
  const m = new Map();
  return {
    m,
    get: async (k) => (m.has(k) ? m.get(k).v : null),
    put: async (k, v, o) => void m.set(k, { v, o }),
    delete: async (k) => void m.delete(k),
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })), list_complete: true }),
  };
}
const T0 = Date.parse('2026-11-11T16:00:00Z');
const DIA = 864e5;

await prueba('programar: token sin correo (45 días) y pendiente con correo que vence a los 14 días (caduca a los 21)', async () => {
  const kv = kvFalso();
  const tok = await programarEncuesta(kv, { email: 'a@b.mx', puesto: 'CRA I', rol: 'CRA', idioma: 'es', ind_cumple: 2, ind_total: 5, interno: false }, T0, '11111111-1111-1111-1111-111111111111');
  const llaves = [...kv.m.keys()];
  const pend = llaves.find((k) => k.startsWith(PREFIJO_PENDIENTE));
  const tk = llaves.find((k) => k.startsWith(PREFIJO_TOKEN));
  assert.equal(pend, `${PREFIJO_PENDIENTE}${new Date(T0 + ENCUESTA_DIAS * DIA).toISOString()}:${tok}`);
  assert.equal(tokenDeLlave(pend), tok);
  assert.ok(!kv.m.get(tk).v.includes('a@b.mx'), 'el token no guarda el correo');
  assert.ok(kv.m.get(pend).v.includes('a@b.mx'));
  assert.equal(kv.m.get(pend).o.expiration, Math.floor((T0 + 21 * DIA) / 1000));
  assert.equal(kv.m.get(tk).o.expiration, Math.floor((T0 + 45 * DIA) / 1000));
  assert.equal(await programarEncuesta(kv, { email: '', puesto: '', interno: false }, T0), null);
});

await prueba('vencidas: solo las de fecha pasada, en orden, con tope', async () => {
  const kv = kvFalso();
  for (const [d, t] of [[-20, 'a'], [-14, 'b'], [-1, 'c'], [0, 'd']])
    await programarEncuesta(kv, { email: `${t}@x.mx`, puesto: 'P', interno: false }, T0 + d * DIA, `${t.repeat(8)}-0000-0000-0000-000000000000`);
  const v = await pendientesVencidas(kv, T0);
  assert.deepEqual(v.map((k) => tokenDeLlave(k)[0]), ['a', 'b']);
  assert.equal((await pendientesVencidas(kv, T0, 1)).length, 1);
  assert.equal((await pendientesVencidas(kv, T0 + 14 * DIA)).length, 4);
});

await prueba('correo: 6 opciones con enlace, asunto con el puesto, sin datos de la persona', () => {
  const r = renderEncuesta({ puesto: 'Clinical Research Associate <I>' }, 'tok-1');
  assert.ok(r.subject.startsWith('¿Qué pasó con tu postulación a Clinical Research Associate'));
  for (const o of OPCIONES) {
    assert.ok(r.text.includes(`${o.texto}: https://solcaciencia.com/encuesta-resultado?t=tok-1&r=${o.code}`));
    assert.ok(r.html.includes(`r=${o.code}`));
  }
  assert.ok(r.html.includes('&lt;I&gt;') && !r.html.includes('<I>'));
  assert.ok(r.text.includes('Es el único correo que te enviaremos sobre esto.'));
  assert.equal(opcion('contratado').texto, 'Me contrataron');
  assert.equal(opcion('x'), null);
});

await prueba('integración: la cola programa la encuesta antes de borrar el pedido; la página confirma por POST', () => {
  const q = readFileSync(new URL('../src/lib/cv-medida-queue.ts', import.meta.url), 'utf8');
  assert.ok(q.indexOf('await d.programarEncuesta(job)') < q.indexOf('await borrarTodo(d.kv, job.id);\n  await d.registrar(\'cvmedida_entregado\''));
  const pg = readFileSync(new URL('../src/pages/encuesta-resultado.astro', import.meta.url), 'utf8');
  assert.ok(pg.includes("Astro.request.method === 'POST'") && pg.includes('<form method="post">'));
  const cron = readFileSync(new URL('./patch-cron-handler.mjs', import.meta.url), 'utf8');
  assert.ok(cron.includes('/api/encuesta-resultado-tick'));
});

console.log(`${n} pruebas pasaron.`);
