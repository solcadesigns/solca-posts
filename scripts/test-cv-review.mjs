#!/usr/bin/env node
/**
 * Prueba offline de la validación del revisor de CV (rúbrica v2-2026-11) · 6 nov 2026.
 * No llama al modelo ni a ningún endpoint: pasa salidas de ejemplo (buenas, malas y truncadas) por
 * src/lib/cv-review-rubric.ts y revisa lo que el endpoint devolvería y lo que la página mostraría.
 *
 * Uso: node scripts/test-cv-review.mjs   (Node 22.18+ o 24: importa el .ts sin compilar)
 */
import assert from 'node:assert/strict';
import {
  CRITERIOS,
  RUBRIC_VERSION,
  validateCvReview,
  parseJsonLenient,
  countByEstado,
  groupObservaciones,
  pickNextStep,
  topGrupo,
  readRolObjetivo,
  inventedNumbers,
  normalizeForMatch,
  scrubBanned,
} from '../src/lib/cv-review-rubric.ts';

const CV = `María López Ruiz, PhD
maria.lopez@correo.com · +52 55 0000 0000 · linkedin.com/in/marialopez

EXPERIENCIA
Investigadora posdoctoral, Instituto de Biotecnología (2021-2024)
• Responsable de los experimentos de expresión de proteínas del laboratorio.
• Participé en la escritura de 3 artículos científicos.
• Apoyé en la coordinación de estudiantes de maestría.

Asistente de investigación, Universidad Nacional (2016-2021)
• Realicé ensayos de cultivo celular y Western blot.
• Presenté resultados en congresos nacionales.

EDUCACIÓN
Doctorado en Ciencias Bioquímicas, Universidad Nacional (2021)

PUBLICACIONES
1. López M, et al. (2023) Journal of Proteins 12:44-51.
2. López M, et al. (2022) Cell Methods 8:100-110.
3. Ruiz A, López M. (2020) Biochem Rep 4:1-9.`;

const ctxPdf = { cv: CV, origen: 'pdf', paginas: 2, rolObjetivo: 'MSL' };
const ctxPegado = { cv: CV.replace(/\n/g, ' '), origen: 'pegado', paginas: null, rolObjetivo: undefined };

function obsCompletas(estadoPorId = {}) {
  return CRITERIOS.map((c) => ({
    id: c.id,
    estado: estadoPorId[c.id] ?? 'mejorable',
    evaluacion: `Evaluación del criterio ${c.id}.`,
    recomendacion: `Ajusta el criterio ${c.id}.`,
    evidencia: c.id === 5 ? 'Responsable de los experimentos de expresión de proteínas del laboratorio.' : c.id === 6 ? 'Esta frase no está en el CV y debe caer' : null,
  }));
}

const BUENA = {
  candidateName: 'María López Ruiz',
  resumen: { una_linea: 'Perfil científico sólido; falta decir a qué rol apuntas y mostrar resultados.' },
  perfil: { nivel: 'Posgrado o investigación académica', rol_objetivo: 'Investigación' },
  prioridades: [
    { id_observacion: 5, accion: 'Reescribe tus viñetas como logros.', por_que: 'Hoy describen funciones.', esfuerzo: '1 h' },
    { id_observacion: 2, accion: 'Agrega un resumen de 3 frases.', por_que: 'No hay resumen.', esfuerzo: '15 min' },
    { id_observacion: 16, accion: 'Resume tus publicaciones.', por_que: 'Ocupa espacio.', esfuerzo: '15 min' },
  ],
  reescrituras: [
    {
      antes: '• Responsable de los experimentos de expresión de proteínas del laboratorio.',
      despues: 'Diseñé y ejecuté [n] experimentos de expresión de proteínas que redujeron el tiempo de purificación en [% de reducción].',
      principio: 'Verbo + qué + cómo + resultado',
    },
    {
      antes: 'Participé en la escritura de 3 artículos científicos.',
      despues: 'Coescribí 3 artículos publicados en revistas con revisión por pares.',
      principio: 'Autoría propia',
    },
  ],
  observaciones: obsCompletas({ 1: 'prioritario', 2: 'prioritario', 5: 'prioritario', 14: 'solido', 19: 'solido', 20: 'solido' }),
  retroalimentacion: 'Tu formación es clara. En mi experiencia, los reclutadores leen un CV en 6 segundos. Falta un resumen que conecte con el rol.',
};

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log(`ok ${n} - ${name}`);
}

// 1. Salida completa y correcta
test('salida buena: estructura, versión, grupos y evidencia', () => {
  const v = validateCvReview(BUENA, ctxPdf);
  assert.ok(v);
  const r = v.result;
  assert.equal(r.rubric_version, RUBRIC_VERSION);
  assert.equal(r.observaciones.length, 20);
  assert.equal(r.observaciones[0].grupo, 'posicionamiento');
  assert.equal(r.observaciones.find((o) => o.id === 18).grupo, 'formato_ats');
  assert.equal(r.observaciones.find((o) => o.id === 5).evidencia !== null, true, 'evidencia literal se conserva');
  assert.equal(r.observaciones.find((o) => o.id === 6).evidencia, null, 'evidencia no literal se descarta');
  assert.equal(v.report.issues.evidencia_descartada, 1);
  assert.equal(r.perfil.rol_objetivo, 'Medical Science Liaison (MSL)', 'el rol del formulario gana');
  assert.equal(r.prioridades.length, 3);
  assert.equal(r.reescrituras.length, 2);
  assert.equal(r.reescrituras[0].antes.startsWith('•'), false, 'la viñeta se quita del antes');
  assert.equal(v.report.parcial, false);
});

test('frases prohibidas: se quitan de la retroalimentación', () => {
  const r = validateCvReview(BUENA, ctxPdf).result;
  assert.ok(!/segundos/.test(r.retroalimentacion));
  assert.ok(!/En mi experiencia/i.test(r.retroalimentacion));
  assert.ok(/Falta un resumen/.test(r.retroalimentacion));
});

// 2. Reescrituras con "antes" inventado o cifras inventadas
test('reescritura no literal y cifra inventada se descartan', () => {
  const mala = structuredClone(BUENA);
  mala.reescrituras = [
    { antes: 'Lideré un equipo de 10 personas en Pfizer.', despues: 'Coordiné un equipo de 10 personas.', principio: 'x' },
    { antes: 'Realicé ensayos de cultivo celular y Western blot.', despues: 'Ejecuté 250 ensayos de cultivo celular con 98% de reproducibilidad.', principio: 'x' },
    { antes: 'Presenté resultados en congresos nacionales.', despues: 'Presenté [n] resultados en [n] congresos nacionales.', principio: 'x' },
  ];
  const v = validateCvReview(mala, ctxPdf);
  assert.equal(v.result.reescrituras.length, 1);
  assert.equal(v.report.issues.reescritura_no_literal, 1);
  assert.equal(v.report.issues.reescritura_cifra_inventada, 1);
  assert.deepEqual(inventedNumbers('Coescribí 3 artículos en [n] revistas', normalizeForMatch(CV)), []);
  assert.deepEqual(inventedNumbers('Coordiné 5 proyectos', 'Doctorado (2025)'), ['5'], 'un 5 dentro de 2025 no cuenta');
});

// 3. Señales de formato: texto pegado y aplanado
test('texto pegado: extensión, viñetas y columnas quedan no_evaluable', () => {
  const v = validateCvReview(BUENA, ctxPegado);
  const by = Object.fromEntries(v.result.observaciones.map((o) => [o.id, o]));
  assert.equal(by[14].estado, 'no_evaluable');
  assert.equal(by[17].estado, 'no_evaluable');
  assert.equal(by[18].estado, 'no_evaluable');
  assert.equal(by[14].recomendacion, '');
  assert.ok(v.report.issues.formato_forzado >= 1);
  assert.equal(v.result.perfil.rol_objetivo, 'Investigación', 'sin rol en el formulario se usa el del modelo');
});

// 4. Parciales: faltan secciones, ids sin número, estados raros
test('parcial: faltan reescrituras y resumen; ids por nombre; estado con acento', () => {
  const p = {
    candidateName: '',
    observaciones: [
      { categoria: 'Rol objetivo visible', estado: 'Prioritario', evaluacion: 'No se ve el rol.', recomendacion: 'Agrega un titular.' },
      { id: 2, estado: 'sólido', evaluacion: 'Hay resumen.', recomendacion: '' },
      { id: 2, estado: 'mejorable', evaluacion: 'duplicado', recomendacion: 'x' },
      { id: 99, estado: 'mejorable', evaluacion: 'id fuera de rúbrica', recomendacion: 'x' },
      { id: 5, estado: 'raro', evaluacion: 'Funciones.', recomendacion: 'Escribe logros.' },
    ],
  };
  const v = validateCvReview(p, ctxPdf);
  assert.ok(v);
  assert.equal(v.result.candidateName, 'Candidato');
  assert.equal(v.result.observaciones.length, 3);
  assert.equal(v.result.observaciones[0].estado, 'prioritario');
  assert.equal(v.result.observaciones[1].estado, 'solido');
  assert.equal(v.result.observaciones[2].estado, 'mejorable');
  assert.equal(v.result.prioridades.length, 2, 'se rellenan desde observaciones accionables');
  assert.equal(v.result.prioridades[0].id_observacion, 1);
  assert.equal(v.result.resumen.una_linea, null);
  assert.equal(v.result.reescrituras.length, 0);
  assert.equal(v.report.parcial, true);
});

test('prioridades: apuntan a sólido o no_evaluable o repetidas se descartan', () => {
  const p = structuredClone(BUENA);
  p.prioridades = [
    { id_observacion: 14, accion: 'x', por_que: '', esfuerzo: '' },
    { id_observacion: 5, accion: 'Reescribe.', por_que: '', esfuerzo: '' },
    { id_observacion: 5, accion: 'Repetida.', por_que: '', esfuerzo: '' },
  ];
  const v = validateCvReview(p, ctxPdf);
  assert.equal(v.result.prioridades[0].id_observacion, 5);
  assert.equal(new Set(v.result.prioridades.map((x) => x.id_observacion)).size, v.result.prioridades.length);
  assert.equal(v.report.issues.prioridad_descartada, 2);
});

test('nada útil: devuelve null', () => {
  assert.equal(validateCvReview({ candidateName: 'X', retroalimentacion: 'algo' }, ctxPdf), null);
  assert.equal(validateCvReview('texto', ctxPdf), null);
});

// 5. JSON truncado por max_tokens
test('JSON truncado se repara hasta el último objeto completo', () => {
  const full = JSON.stringify(BUENA);
  const cut = full.slice(0, full.indexOf('"id":12') + 30); // se corta a media observación 12
  const p = parseJsonLenient(cut);
  assert.ok(p && p.repaired);
  const v = validateCvReview(p.value, ctxPdf);
  assert.ok(v);
  assert.equal(v.result.observaciones.length, 11);
  assert.equal(v.result.prioridades.length, 3);
  assert.equal(v.report.parcial, true);
  assert.equal(parseJsonLenient('{"a": "sin cerrar'), null);
});

// 6. Lógica del reporte: conteos, grupos y siguiente paso
test('conteos, grupos y grupo con más ▲', () => {
  const r = validateCvReview(BUENA, ctxPdf).result;
  const c = countByEstado(r.observaciones);
  assert.deepEqual(c, { prioritario: 3, mejorable: 14, solido: 3, no_evaluable: 0 });
  const g = groupObservaciones(r.observaciones);
  assert.equal(g.length, 6);
  assert.equal(g.reduce((a, x) => a + x.items.length, 0), 20);
  assert.equal(topGrupo(r.observaciones), 'posicionamiento');
});

test('siguiente paso elegido en código', () => {
  const base = validateCvReview(BUENA, ctxPdf).result;
  // prioridad 1 en logros con rol declarado → curso
  assert.equal(pickNextStep(base), 'curso');
  // sin rol → quiz
  assert.equal(pickNextStep({ ...base, perfil: { ...base.perfil, rol_objetivo: null } }), 'quiz');
  // prioridad 1 en posicionamiento → quiz
  assert.equal(pickNextStep({ ...base, prioridades: [{ id_observacion: 2, accion: 'x', por_que: '', esfuerzo: '' }] }), 'quiz');
  // sin prioritarios → simulador
  const sinRojo = base.observaciones.map((o) => ({ ...o, estado: o.estado === 'prioritario' ? 'mejorable' : o.estado }));
  assert.equal(pickNextStep({ ...base, observaciones: sinRojo, prioridades: [{ id_observacion: 5, accion: 'x', por_que: '', esfuerzo: '' }] }), 'simulador');
});

test('rol del formulario: solo valores del catálogo', () => {
  assert.equal(readRolObjetivo('CRA'), 'CRA');
  assert.equal(readRolObjetivo('no_seguro'), 'no_seguro');
  assert.equal(readRolObjetivo('Other'), undefined);
  assert.equal(readRolObjetivo('<script>'), undefined);
  assert.equal(readRolObjetivo('toString'), undefined);
});

test('scrubBanned conserva oraciones limpias', () => {
  assert.equal(scrubBanned('Bien. Conseguirás entrevistas rápido. Agrega LinkedIn.'), 'Bien. Agrega LinkedIn.');
});

console.log(`\n${n} pruebas OK`);

// Con CV_FIXTURES_DIR=<carpeta> escribe las respuestas validadas (como las devolvería /api/cv-review)
// para probar la página y el PDF con un servidor local que simule el endpoint.
if (process.env.CV_FIXTURES_DIR) {
  const fs = await import('node:fs');
  const out = (name, raw, ctx) => {
    const v = validateCvReview(raw, ctx);
    fs.writeFileSync(`${process.env.CV_FIXTURES_DIR}/${name}.json`, JSON.stringify({ ...v.result, parcial: v.report.parcial }, null, 2));
  };
  out('completo-pdf', BUENA, ctxPdf);
  out('pegado-sin-rol', BUENA, ctxPegado);
  const parcial = structuredClone(BUENA);
  parcial.reescrituras = [];
  parcial.observaciones = parcial.observaciones.slice(0, 9);
  parcial.retroalimentacion = '';
  out('parcial', parcial, ctxPdf);
  const solido = structuredClone(BUENA);
  solido.observaciones = solido.observaciones.map((o) => ({ ...o, estado: o.estado === 'prioritario' ? 'solido' : o.estado }));
  out('sin-prioritarios', solido, ctxPdf);
  console.log(`fixtures en ${process.env.CV_FIXTURES_DIR}`);
}
