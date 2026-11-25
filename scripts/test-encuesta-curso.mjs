/**
 * Pruebas offline de las encuestas del curso V2.0 (src/lib/encuesta-curso.ts) · 24 nov 2026.
 * Uso: node scripts/test-encuesta-curso.mjs
 * Incluye una comparación del catálogo contra el texto fuente (06-encuestas-y-correos.md) si el archivo existe.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  ENCUESTAS, TIPOS, ROLES, validarRespuestas, programarSeguimiento, puedeProgramar, seguimientosVencidos, renderSeguimiento, urlEncuesta,
  PREFIJO_SEGUIMIENTO,
} from '../src/lib/encuesta-curso.ts';

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
const T0 = Date.parse('2026-12-01T16:00:00Z');
const DIA = 864e5;

const INICIO_OK = {
  correo: ' Ana@Ejemplo.MX ', situacion: 'licenciatura_en_curso', situacion_anio: '2027', formacion: 'qfb', grado: 'lic_en_curso',
  rol_objetivo: 'otro', rol_objetivo_otro: 'Medical writer', por_que_rol: 'Me gusta escribir.', pais: 'mx', tiempo_buscando: 'no_empiezo',
  postulaciones_4sem: '0', entrevistas_4sem: 0, claridad: '3', canal: 'linkedin', ajena: 'se ignora',
};

await prueba('número de preguntas por encuesta igual al documento (12, 12, 7, 7)', () => {
  assert.deepEqual(TIPOS.map((t) => ENCUESTAS[t].preguntas.length), [12, 12, 7, 7]);
  assert.equal(ROLES.length, 14);
});

await prueba('inicio válido: normaliza correo, convierte números, guarda extras e ignora llaves ajenas', () => {
  const r = validarRespuestas('inicio', INICIO_OK);
  assert.equal(r.ok, true);
  assert.equal(r.email, 'ana@ejemplo.mx');
  assert.equal(r.respuestas.situacion_anio, 2027);
  assert.equal(r.respuestas.rol_objetivo_otro, 'Medical writer');
  assert.equal(r.respuestas.entrevistas_4sem, 0);
  assert.equal(r.respuestas.claridad, 3);
  assert.ok(!('ajena' in r.respuestas));
  assert.ok(!('correo' in r.respuestas), 'el correo va en su columna, no en el JSON');
});

await prueba('inicio: errores adversarios', () => {
  const casos = [
    [{ ...INICIO_OK, correo: 'sin-arroba' }, 'correo', 'correo_invalido'],
    [{ ...INICIO_OK, situacion: 'inventada' }, 'situacion', 'opcion_invalida'],
    [{ ...INICIO_OK, situacion_anio: '27' }, 'situacion', 'anio_invalido'],
    [{ ...INICIO_OK, rol_objetivo_otro: '   ' }, 'rol_objetivo', 'falta_texto'],
    [{ ...INICIO_OK, claridad: '6' }, 'claridad', 'numero_invalido'],
    [{ ...INICIO_OK, postulaciones_4sem: '-1' }, 'postulaciones_4sem', 'numero_invalido'],
    [{ ...INICIO_OK, postulaciones_4sem: '2.5' }, 'postulaciones_4sem', 'numero_invalido'],
    [{ ...INICIO_OK, por_que_rol: '' }, 'por_que_rol', 'requerida'],
    [{ ...INICIO_OK, canal: ['linkedin'] }, 'canal', 'opcion_invalida'],
  ];
  for (const [entrada, pregunta, error] of casos) {
    const r = validarRespuestas('inicio', entrada);
    assert.deepEqual([r.ok, r.pregunta, r.error], [false, pregunta, error], JSON.stringify(entrada));
  }
  assert.equal(validarRespuestas('inicio', null).ok, false);
  assert.equal(validarRespuestas('inicio', 'texto').ok, false);
});

await prueba('cierre: varias opciones en orden del catálogo, sin duplicados; ninguna marcada es válida; NPS 0-10', () => {
  const base = {
    correo: 'a@b.co', ruta: 'guia_una_pagina', entregables: ['cv_industria', 'punto_partida', 'cv_industria'], claridad: 4,
    leccion_util_num: '3.11', leccion_util_frase: 'La del CV.', atoro: 'LinkedIn', duracion: '1_2sem', recomendacion: '0',
    cambiarias: 'Nada', testimonio: 'si_anonimo', freno: 'idioma', minutos_1_2_1_4: '45',
  };
  const r = validarRespuestas('cierre', base);
  assert.equal(r.ok, true);
  assert.deepEqual(r.respuestas.entregables, ['punto_partida', 'cv_industria']);
  assert.equal(r.respuestas.recomendacion, 0);
  assert.equal(validarRespuestas('cierre', { ...base, entregables: [] }).ok, true);
  assert.equal(validarRespuestas('cierre', { ...base, entregables: ['x'] }).error, 'opcion_invalida');
  assert.equal(validarRespuestas('cierre', { ...base, recomendacion: 11 }).error, 'numero_invalido');
  assert.equal(validarRespuestas('cierre', { ...base, leccion_util_num: '<script>' }).error, 'leccion_invalida');
  assert.equal(validarRespuestas('cierre', { ...base, leccion_util_num: '', leccion_util_frase: '' }).error, 'requerida');
  assert.equal(validarRespuestas('cierre', { ...base, ruta: 'no_decido' }).ok, true);
});

await prueba('30/90 días: rol del nuevo empleo y uso del curso son opcionales', () => {
  const r = validarRespuestas('30-dias', { correo: 'a@b.co', punto: 'sigo_buscando', postulaciones: 10, entrevistas: 1, ofertas: 0 });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.respuestas).sort(), ['entrevistas', 'ofertas', 'postulaciones', 'punto']);
  assert.equal(validarRespuestas('90-dias', { correo: 'a@b.co', punto: 'empece_empleo', postulaciones: 10, entrevistas: 3, ofertas: 1, rol_nuevo: 'msl' }).ok, true);
  assert.equal(validarRespuestas('90-dias', { correo: 'a@b.co', punto: 'sigo_buscando', postulaciones: 10, entrevistas: 3 }).error, 'requerida');
});

await prueba('seguimiento: dos envíos (30 y 90 días) que caducan 7 días después del envío', async () => {
  const kv = kvFalso();
  assert.equal(await programarSeguimiento(kv, { email: 'a@b.co', interno: false }, T0), 2);
  const pend = [...kv.m.keys()].filter((k) => k.startsWith(PREFIJO_SEGUIMIENTO)).sort();
  assert.equal(pend.length, 2);
  assert.ok(pend[0].startsWith(`${PREFIJO_SEGUIMIENTO}${new Date(T0 + 30 * DIA).toISOString()}:30-dias:`));
  assert.ok(pend[1].startsWith(`${PREFIJO_SEGUIMIENTO}${new Date(T0 + 90 * DIA).toISOString()}:90-dias:`));
  assert.equal(kv.m.get(pend[0]).o.expiration, Math.floor((T0 + 37 * DIA) / 1000));
  assert.equal(await programarSeguimiento(kv, { email: '', interno: false }, T0), 0);
});

await prueba('puedeProgramar: solo comprador con PURCHASE_APPROVED y primer cierre no interno; falla cerrado', async () => {
  const sql = new DatabaseSync(':memory:');
  for (const f of ['0008_hotmart_ventas.sql', '0010_hotmart_comprador_hash.sql', '0015_curso_encuestas.sql'])
    sql.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  const d1 = { prepare(q) { const st = sql.prepare(q); return { bind: (...a) => ({ first: async () => st.get(...a) ?? null }) }; } };
  const cierre = (id, h, interno = 0) => sql.prepare("INSERT INTO curso_encuestas (id,ts,dia,curso,tipo,version,email_hash,respuestas,interno) VALUES (?,'t','d','curso_cv_v2','cierre','v',?,'{}',?)").run(id, h, interno);
  sql.prepare("INSERT INTO hotmart_eventos (id,transaccion,evento,creado_ms,recibido,comprador_hash) VALUES ('e1','t1','PURCHASE_APPROVED',1,'x','comprador')").run();
  sql.prepare("INSERT INTO hotmart_eventos (id,transaccion,evento,creado_ms,recibido,comprador_hash) VALUES ('e2','t2','PURCHASE_REFUNDED',1,'x','reembolso')").run();
  cierre('1', 'comprador');
  cierre('i', 'comprador', 1); // un cierre interno no cuenta
  assert.deepEqual(await puedeProgramar(d1, 'comprador'), { ok: true, motivo: 'programar' });
  cierre('2', 'comprador');
  assert.equal((await puedeProgramar(d1, 'comprador')).motivo, 'duplicado');
  cierre('3', 'nadie');
  assert.equal((await puedeProgramar(d1, 'nadie')).motivo, 'sin_compra');
  assert.equal((await puedeProgramar(d1, 'reembolso')).motivo, 'sin_compra');
  const roto = { prepare() { throw new Error('sin tabla'); } };
  assert.deepEqual(await puedeProgramar(roto, 'comprador'), { ok: false, motivo: 'error' });
});

await prueba('vencidos: solo los de fecha pasada, en orden y con tope', async () => {
  const kv = kvFalso();
  await programarSeguimiento(kv, { email: 'a@b.co', interno: false }, T0);
  await programarSeguimiento(kv, { email: 'c@d.co', interno: false }, T0 + 10 * DIA);
  assert.equal((await seguimientosVencidos(kv, T0 + 29 * DIA)).length, 0);
  assert.equal((await seguimientosVencidos(kv, T0 + 30 * DIA)).length, 1);
  assert.equal((await seguimientosVencidos(kv, T0 + 40 * DIA)).length, 2);
  assert.equal((await seguimientosVencidos(kv, T0 + 100 * DIA)).length, 4);
  assert.equal((await seguimientosVencidos(kv, T0 + 100 * DIA, 3)).length, 3);
});

await prueba('correos: asunto y texto del documento, enlace con UTM, sin nombre → "Hola:"', () => {
  const r30 = renderSeguimiento('30-dias');
  assert.equal(r30.subject, '¿Cómo va tu búsqueda? Tres minutos');
  assert.ok(r30.text.startsWith('Hola:\n'));
  assert.ok(r30.text.includes('Hace un mes terminaste el curso De la ciencia a la industria.'));
  assert.ok(r30.text.includes('Si cambiaste de objetivo o pausaste la búsqueda, también nos sirve saberlo.'));
  assert.ok(r30.text.includes('https://solcaciencia.com/encuesta-curso/30-dias/?utm_source=email&utm_medium=curso&utm_campaign=curso-cv-v2&utm_content=30-dias-alumno'));
  assert.ok(!r30.text.includes('baja'), 'sin enlace de baja no hay pie');
  const r90 = renderSeguimiento('90-dias', { nombre: 'Ana <b>', bajaUrl: 'https://solcaciencia.com/api/drip-unsubscribe?email=a%40b.co&sig=x&scope=curso-encuestas' });
  assert.ok(r90.text.includes('Date de baja aquí: https://solcaciencia.com/api/drip-unsubscribe?email=a%40b.co&sig=x&scope=curso-encuestas'));
  assert.ok(r90.html.includes('sig=x&amp;scope=curso-encuestas'));
  assert.equal(r90.subject, 'Tres meses después: ¿qué pasó con tu búsqueda?');
  assert.ok(r90.text.startsWith('Hola, Ana <b>:'));
  assert.ok(r90.html.includes('Hola, Ana &lt;b&gt;:'), 'escapa HTML');
  assert.ok(r90.text.includes('Equipo de Solca Ciencia'));
  assert.equal(urlEncuesta('inicio', 'hotmart'), 'https://solcaciencia.com/encuesta-curso/inicio/?utm_source=hotmart&utm_medium=curso&utm_campaign=curso-cv-v2&utm_content=0-5-alumno');
});

// Texto fuente: cada pregunta y cada opción del catálogo aparece literal en 06-encuestas-y-correos.md.
const FUENTE = new URL('../../consultoria/curso-cv-v2/textos-finales/06-encuestas-y-correos.md', import.meta.url);
if (existsSync(FUENTE)) {
  await prueba('catálogo fiel al texto fuente', () => {
    const src = readFileSync(FUENTE, 'utf8');
    const faltan = [];
    for (const t of TIPOS) {
      const e = ENCUESTAS[t];
      if (e.intro && !src.includes(e.intro)) faltan.push(`${t}: intro`);
      for (const p of e.preguntas) {
        const q = p.id === 'correo' ? 'Tu correo' : p.texto;
        if (!src.includes(`**${q}`)) faltan.push(`${t}/${p.id}: "${q}"`);
        for (const o of p.opciones ?? []) {
          const txt = o.extra === 'texto' ? `${o.t}: [texto]` : o.extra === 'anio' ? `${o.t} [año]` : o.t;
          if (!src.includes(txt)) faltan.push(`${t}/${p.id}: opción "${txt}"`);
        }
      }
    }
    for (const tp of ['30-dias', '90-dias']) {
      const r = renderSeguimiento(tp);
      if (!src.includes(`**Asunto:** ${r.subject}`)) faltan.push(`${tp}: asunto`);
    }
    assert.deepEqual(faltan, []);
  });
} else {
  console.log('aviso: no se encontró el texto fuente; se omite la comparación');
}

console.log(`OK · ${n} pruebas`);
