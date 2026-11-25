/**
 * Pruebas offline de la comparación CV ↔ vacante (src/lib/cv-cotejo.ts) · 10 nov 2026.
 * Uso: node scripts/test-cv-cotejo.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  prioridadPorMarca,
  validarVacante,
  unirEvaluacion,
  claveVacante,
  mensajeEvaluacion,
  vacanteClasificada,
  COTEJO_VACANTE_PROMPT,
  COTEJO_CV_PROMPT,
  COTEJO_VERSION,
  COTEJO_CLASIFICACION_VERSION,
} from '../src/lib/cv-cotejo.ts';

let n = 0;
async function prueba(nombre, fn) {
  try {
    await fn();
    n++;
  } catch (e) {
    console.error(`FALLÓ: ${nombre}\n`, e);
    process.exit(1);
  }
}

const VAC = `Graduate Pharmacovigilance Associate
Responsibilities
• Supporting the collection, review and processing of adverse event data.
Required qualifications and experience:
• Bachelor's degree in pharmacy, life sciences, or a related field.
• Basic understanding of pharmacovigilance principles and regulatory guidelines is desirable but not required; relevant training will be provided.
• Willingness to travel as required (approximately 10%)
What We're Looking For
• Advanced proficiency in English, with the ability to communicate complex ideas effectively.
• 1-4 years of business experience. Consulting background preferred.
This role typically requires 0 - 2 years of prior relevant experience.`;

const CV = `María Ejemplo
Química Farmacéutico Bióloga, Universidad Nacional, 2019.
Analista de control de calidad, Laboratorio X, 2020-2023: liberación de lotes y estudios de estabilidad por HPLC.
Inglés avanzado (C1).`;

await prueba('prioridad: obligación en la marca → indispensable; sin señal (sin marca o "What we are looking for") → sin_indicar', () => {
  assert.equal(prioridadPorMarca("Bachelor's degree in pharmacy", 'Required qualifications and experience:'), 'indispensable');
  assert.equal(prioridadPorMarca('Advanced proficiency in English', "What We're Looking For"), 'sin_indicar');
  assert.equal(prioridadPorMarca('Licenciatura en Química', 'Requisitos:'), 'indispensable');
  assert.equal(prioridadPorMarca('Inglés avanzado', ''), 'sin_indicar');
  assert.equal(prioridadPorMarca('Experiencia en HPLC', 'Deseable'), 'deseable');
  assert.equal(prioridadPorMarca('Experiencia en HPLC', 'Excluyente'), 'indispensable');
});

await prueba('prioridad: la preferencia del propio requisito gana sobre la sección', () => {
  assert.equal(prioridadPorMarca('Basic understanding of pharmacovigilance principles is desirable but not required', 'Required qualifications and experience:'), 'deseable');
  assert.equal(prioridadPorMarca('Consulting background preferred', 'Requirements'), 'deseable');
  assert.equal(prioridadPorMarca('Maestría (es un plus)', 'Requisitos'), 'deseable');
  // "plus" como conjunción no es preferencia.
  assert.equal(prioridadPorMarca('Strong analytical skills plus communication skills', 'Requirements'), 'indispensable');
});

await prueba('prioridad: obligación en la cita sin marca; "as required" no cuenta', () => {
  assert.equal(prioridadPorMarca('This role typically requires 0 - 2 years of prior relevant experience', ''), 'indispensable');
  assert.equal(prioridadPorMarca('Willingness to travel as required (approximately 10%)', ''), 'sin_indicar');
});

await prueba('validarVacante: descarta citas que no están en la vacante y marcas inventadas', () => {
  const salida = {
    puesto: 'Graduate Pharmacovigilance Associate',
    empresa: '',
    rol: 'Pharmacovigilance',
    requisitos: [
      { requisito: "Bachelor's degree", cita: "Bachelor's degree in pharmacy, life sciences, or a related field.", marca: 'Required qualifications and experience:' },
      { requisito: 'Inglés avanzado', cita: 'Advanced proficiency in English', marca: 'Required qualifications' /* no está literal sola… */ },
      { requisito: 'GCP', cita: 'Good Clinical Practice certification mandatory', marca: 'Required' }, // no está en la vacante
      { requisito: "Bachelor's degree", cita: "Bachelor's degree in pharmacy", marca: '' }, // duplicado
      { requisito: 'Experiencia', cita: 'This role typically requires 0 - 2 years of prior relevant experience', marca: 'This role typically requires' },
      { requisito: 'Inventada', cita: 'x', marca: 'Required' },
    ],
  };
  const v = validarVacante(salida, VAC);
  assert.ok(v);
  assert.equal(v.version, COTEJO_CLASIFICACION_VERSION);
  assert.equal(v.rol, 'Pharmacovigilance');
  assert.deepEqual(v.requisitos.map((r) => [r.requisito, r.prioridad]), [
    ["Bachelor's degree", 'indispensable'],
    ['Inglés avanzado', 'sin_indicar'], // "Required qualifications" está antes, pero "What We're Looking For" abre otra sección
    ['Experiencia', 'indispensable'],
  ]);
  assert.equal(v.descartados, 3);
});

await prueba('validarVacante: una marca que aparece después del requisito no lo califica', () => {
  const v = validarVacante(
    {
      puesto: 'X', empresa: '', rol: 'Other',
      requisitos: [
        { requisito: 'Responsabilidad', cita: 'Supporting the collection, review and processing of adverse event data', marca: 'Required qualifications and experience:' },
        { requisito: 'Inglés', cita: 'Advanced proficiency in English', marca: "What We're Looking For" },
      ],
    },
    VAC,
  );
  assert.equal(v.requisitos[0].marca, '');
  assert.equal(v.requisitos[0].prioridad, 'sin_indicar');
});

await prueba('validarVacante: marca que no está en la vacante se ignora; rol desconocido → Other; <2 requisitos → null', () => {
  const v = validarVacante(
    {
      puesto: 'X',
      empresa: '',
      rol: 'Astronauta',
      requisitos: [
        { requisito: 'Inglés', cita: 'Advanced proficiency in English', marca: 'Mandatory requirements' },
        { requisito: 'Viajar', cita: 'Willingness to travel as required', marca: '' },
      ],
    },
    VAC,
  );
  assert.equal(v.rol, 'Other');
  assert.equal(v.requisitos[0].marca, '');
  assert.equal(v.requisitos[0].prioridad, 'sin_indicar');
  assert.equal(validarVacante({ requisitos: [] }, VAC), null);
  assert.equal(validarVacante(null, VAC), null);
});

const VACC = {
  version: COTEJO_CLASIFICACION_VERSION,
  puesto: 'QC Analyst',
  empresa: 'Acme',
  rol: 'Other',
  idioma: 'en',
  descartados: 0,
  requisitos: [
    { requisito: 'Licenciatura en química', prioridad: 'indispensable', cita: 'a', marca: 'Requisitos' },
    { requisito: 'HPLC', prioridad: 'indispensable', cita: 'b', marca: 'Requisitos' },
    { requisito: 'SAP QM', prioridad: 'indispensable', cita: 'c', marca: 'Requisitos' },
    { requisito: 'Inglés avanzado', prioridad: 'deseable', cita: 'd', marca: '' },
    { requisito: 'Maestría', prioridad: 'deseable', cita: 'e', marca: 'Deseable' },
  ],
};

await prueba('unirEvaluacion: evidencia literal cuenta; evidencia inventada o faltante → no_aparece; orden y conteos', () => {
  const salida = {
    evaluacion: [
      { n: 4, estado: 'cumple', evidencia: 'Inglés avanzado (C1)' },
      { n: 1, estado: 'cumple', evidencia: 'Química Farmacéutico Bióloga, Universidad Nacional' },
      { n: 2, estado: 'parcial', evidencia: 'estudios de estabilidad por HPLC' },
      { n: 3, estado: 'cumple', evidencia: 'Manejo avanzado de SAP QM' }, // no está en el CV
      { n: 1, estado: 'no_aparece', evidencia: '' }, // duplicado: gana el primero
    ],
  };
  const r = unirEvaluacion(salida, VACC, CV);
  assert.deepEqual(r.requisitos.map((q) => [q.requisito, q.estado]), [
    ['Licenciatura en química', 'cumple'],
    ['HPLC', 'parcial'],
    ['SAP QM', 'no_aparece'],
    ['Inglés avanzado', 'cumple'],
    ['Maestría', 'no_aparece'],
  ]);
  assert.deepEqual(r.indispensables, { total: 3, cumple: 1, parcial: 1, no_aparece: 1 });
  assert.deepEqual(r.deseables, { total: 2, cumple: 1, parcial: 0, no_aparece: 1 });
  assert.equal(r.evidenciasDescartadas, 1);
  assert.equal(unirEvaluacion(null, VACC, CV).indispensables.no_aparece, 3);
});

await prueba('claveVacante: misma vacante con otro formato → misma llave; otra vacante → otra llave', async () => {
  const a = await claveVacante(VAC);
  const b = await claveVacante(VAC.replace(/\n/g, '\n\n  ').toUpperCase());
  const c = await claveVacante(VAC + ' Mexico City');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a.startsWith(`cotejo:vac:${COTEJO_CLASIFICACION_VERSION}:`));
});

await prueba('vacanteClasificada: usa la caché sin llamar al modelo', async () => {
  const kv = new Map();
  const clave = await claveVacante(VAC);
  kv.set(clave, JSON.stringify(VACC));
  const r = await vacanteClasificada('sin-llave', { get: async (k) => kv.get(k) ?? null, put: async (k, v) => kv.set(k, v) }, VAC);
  assert.equal(r.ok, true);
  assert.equal(r.cache, true);
  assert.equal(r.valor.puesto, 'QC Analyst');
});

await prueba('prompts: sin consejos de redacción; el modelo copia la marca, no decide la prioridad', () => {
  assert.ok(COTEJO_VACANTE_PROMPT.includes('No juzgues si es obligatorio'));
  assert.ok(COTEJO_VACANTE_PROMPT.includes('sepáralas en dos'));
  assert.ok(COTEJO_CV_PROMPT.includes('LITERAL del CV'));
  assert.ok(!/prioridad/i.test(COTEJO_VACANTE_PROMPT));
  const m = mensajeEvaluacion(CV, VACC.requisitos);
  assert.ok(m.startsWith('<requisitos>\n1. Licenciatura en química'));
});

await prueba('endpoint: interno hasta diciembre, sin evidencia del CV en la respuesta pública, IP solo como hash', () => {
  const src = readFileSync(new URL('../src/pages/api/cv-cotejo.ts', import.meta.url), 'utf8');
  assert.ok(src.includes("(await limitsKV.get('cotejo_publico')) === '1'"));
  assert.ok(src.includes("return json({ error: 'no_disponible'"));
  assert.ok(src.includes("anthropic_paused"));
  assert.ok(src.includes('nunca la IP'));
  // La respuesta pública lleva requisito, prioridad, estado y, si aplica, la sugerencia fija de idioma; nunca la evidencia.
  assert.ok(/requisitos: r\.requisitos\.map\(\(q\) => \(\{ requisito: q\.requisito, prioridad: q\.prioridad, estado: q\.estado, \.\.\.\(q\.sugerencia \? \{ sugerencia: q\.sugerencia \} : \{\}\) \}\)\)/.test(src));
  assert.ok(!/evidencia: q\.evidencia/.test(src.split('prueba:')[0]));
});

await prueba('idioma: sugerencia MCER solo si la vacante pide idioma y el CV no trae nivel ni examen', async () => {
  const { sugerenciaIdioma, SUGERENCIA_IDIOMA, unirEvaluacion } = await import('../src/lib/cv-cotejo.ts');
  assert.equal(sugerenciaIdioma('Inglés avanzado', 'Inglés avanzado indispensable', 'Idiomas: inglés profesional'), SUGERENCIA_IDIOMA);
  assert.equal(sugerenciaIdioma('Inglés avanzado', 'Advanced English', 'Idiomas: inglés C1'), '');
  assert.equal(sugerenciaIdioma('Fluent English', 'Fluent English required', 'English (IELTS 7.0)'), '');
  assert.equal(sugerenciaIdioma('Licenciatura en QFB', 'Licenciatura en QFB', 'inglés fluido'), '');
  assert.equal(sugerenciaIdioma('Portugués', 'Portugués deseable', 'Portugués intermedio'), SUGERENCIA_IDIOMA);
  // Falsos positivos (revisión independiente, 16 nov)
  assert.equal(sugerenciaIdioma('Programming languages', 'Programming languages (R, Python, SAS)', 'R y Python'), '');
  assert.equal(sugerenciaIdioma('Plain language summaries', 'Plain language summaries', 'Redacción'), '');
  assert.equal(sugerenciaIdioma('Redacción en español', 'Excelente redacción en idioma español', 'Español nativo'), '');
  // Falsos negativos: el nivel tiene que estar cerca del idioma pedido
  assert.equal(sugerenciaIdioma('Inglés', 'Inglés avanzado', 'Visa B1/B2 vigente. Idiomas: inglés avanzado'), SUGERENCIA_IDIOMA);
  assert.equal(sugerenciaIdioma('Portugués', 'Portugués deseable', 'Inglés C1. Experiencia en laboratorio, cultivo celular y documentación. Portugués intermedio'), SUGERENCIA_IDIOMA);
  assert.equal(sugerenciaIdioma('Inglés', 'Inglés avanzado', 'Idiomas: inglés (TOEFL iBT 100)'), '');
  // No aparece en el CV: variante "si manejas este idioma"
  const { SUGERENCIA_IDIOMA_AUSENTE } = await import('../src/lib/cv-cotejo.ts');
  assert.equal(sugerenciaIdioma('Inglés', 'Inglés avanzado', 'Licenciatura en QFB', 'no_aparece'), SUGERENCIA_IDIOMA_AUSENTE);
  const vac = { puesto: 'CRA', empresa: 'X', rol: 'CRA', requisitos: [
    { requisito: 'Inglés avanzado', cita: 'Inglés avanzado', prioridad: 'indispensable' },
    { requisito: 'Licenciatura en QFB', cita: 'Licenciatura en QFB', prioridad: 'indispensable' } ], descartados: 0 };
  const cv = 'Licenciatura en QFB por la Universidad Nacional. Idiomas: inglés avanzado para lectura y conversación técnica.';
  const r = unirEvaluacion({ evaluacion: [{ n: 1, estado: 'cumple', evidencia: 'inglés avanzado para lectura y conversación técnica' }, { n: 2, estado: 'cumple', evidencia: 'Licenciatura en QFB por la Universidad Nacional' }] }, vac, cv);
  assert.equal(r.requisitos[0].sugerencia, SUGERENCIA_IDIOMA);
  assert.equal(r.requisitos[0].estado, 'cumple');
  assert.equal(r.requisitos[1].sugerencia, undefined);
  // Una sola sugerencia por comparación aunque el modelo divida el requisito de idioma en dos.
  const vac2 = { ...vac, requisitos: [
    { requisito: 'Inglés escrito', cita: 'Inglés escrito avanzado', prioridad: 'indispensable' },
    { requisito: 'Inglés oral', cita: 'Inglés oral avanzado', prioridad: 'indispensable' } ] };
  const r2 = unirEvaluacion({ evaluacion: [] }, vac2, cv);
  assert.equal(r2.requisitos.filter((q) => q.sugerencia).length, 1);
});

await prueba('revisión: negaciones, marca saltada por otro encabezado, evidencia de palabras sueltas, numeración desde 0', async () => {
  const { marcaCalifica, evidenciaLiteral } = await import('../src/lib/cv-cotejo.ts');
  assert.equal(prioridadPorMarca('No se requiere experiencia previa', ''), 'deseable');
  assert.equal(prioridadPorMarca('Inglés no requerido', 'Requisitos'), 'deseable');
  assert.equal(prioridadPorMarca('No es necesario contar con maestría', ''), 'deseable');
  const v2 = 'Intro\nOur requirements for safety are strict.\nPreferred qualifications:\n• GCP certification\nRequisitos:\n• Licenciatura en química';
  assert.equal(marcaCalifica(v2, 'GCP certification', 'Our requirements for safety are strict'), false);
  assert.equal(marcaCalifica(v2, 'Licenciatura en química', 'Requisitos:'), true);
  assert.equal(marcaCalifica(v2, 'GCP certification', 'Requisitos:'), false); // la marca está después
  assert.equal(marcaCalifica(v2, 'certification GCP', 'Preferred qualifications:'), false); // cita no literal
  assert.equal(evidenciaLiteral('experiencia monitoreo clínico estudios hospital', 'experiencia en hospital; estudios de monitoreo clínico'), false);
  assert.equal(evidenciaLiteral('inglés', 'Inglés avanzado'), false);
  assert.equal(evidenciaLiteral('“Inglés avanzado (C1)”', CV), true);
  const r = unirEvaluacion({ evaluacion: [0, 1, 2, 3, 4].map((n) => ({ n, estado: n === 0 ? 'cumple' : 'no_aparece', evidencia: n === 0 ? 'Química Farmacéutico Bióloga, Universidad Nacional' : '' })) }, VACC, CV);
  assert.equal(r.requisitos[0].estado, 'cumple');
});

await prueba('c2: obligación en la frase con encabezado neutro; cita compartida por dos requisitos', () => {
  assert.equal(prioridadPorMarca('This role typically requires 0 - 2 years of prior relevant experience', 'Experience and skills'), 'indispensable');
  // c3 (24 nov 2026): el título exigido es indispensable aunque el encabezado sea neutro.
  assert.equal(prioridadPorMarca('Degree in scientific discipline or health care.', 'Experience and skills'), 'indispensable');
  assert.equal(prioridadPorMarca('Good knowledge of clinical research regulatory requirements', 'Experience and skills'), 'sin_indicar');
  assert.equal(prioridadPorMarca('Conocimiento de requisitos regulatorios', ''), 'sin_indicar');
  // Cita propia por parte: la obligatoria es indispensable y la preferida deseable; la cita mezclada es dudosa → deseable.
  assert.equal(prioridadPorMarca("Bachelor's degree in pharmacy", 'Requirements', { requisito: "Bachelor's degree" }), 'indispensable');
  assert.equal(prioridadPorMarca("Master's preferred", 'Requirements', { requisito: "Master's degree" }), 'deseable');
  assert.equal(prioridadPorMarca("Bachelor's degree in pharmacy (Master's preferred)", 'Requirements', { requisito: "Bachelor's degree" }), 'deseable');
});

await prueba('c2 revisión: negaciones y "required" como adjetivo de un tema', () => {
  const N = 'Experience and skills';
  for (const c of [
    'No es requisito indispensable el inglés',
    'Not mandatory but helpful: SAS',
  ]) assert.equal(prioridadPorMarca(c, N), 'deseable', c);
  // Sin señal de obligación ni de preferencia: sin_indicar (c3; antes, deseable). Lo que importa es que no sean indispensables.
  for (const c of [
    'Prepare documents required by regulatory authorities',
    'Understand what is required for SOP compliance',
    'Complete mandatory training',
    'Willingness to travel when required',
    'Support sites where required',
    'Good knowledge of clinical research regulatory requirements',
  ]) assert.equal(prioridadPorMarca(c, N), 'sin_indicar', c);
  for (const c of [
    'This role typically requires 0 - 2 years of prior relevant experience',
    'Candidates must hold a degree in life sciences',
    'Fluent English is required',
    'Inglés avanzado indispensable',
    'Se requiere licenciatura en química',
  ]) assert.equal(prioridadPorMarca(c, N), 'indispensable', c);
});

await prueba('preguntas: orden indispensable no aparece → en parte → deseables; máximo 5; nada si todo cumple', async () => {
  const { preguntasDeCotejo } = await import('../src/lib/cv-cotejo.ts');
  const rs = [
    { requisito: 'D-parcial', prioridad: 'deseable', estado: 'parcial' },
    { requisito: 'I-cumple', prioridad: 'indispensable', estado: 'cumple' },
    { requisito: 'I-parcial', prioridad: 'indispensable', estado: 'parcial' },
    { requisito: 'D-no', prioridad: 'deseable', estado: 'no_aparece' },
    { requisito: 'I-no-1', prioridad: 'indispensable', estado: 'no_aparece' },
    { requisito: 'I-no-2', prioridad: 'indispensable', estado: 'no_aparece' },
    { requisito: 'D-no-2', prioridad: 'deseable', estado: 'no_aparece' },
  ];
  assert.deepEqual(preguntasDeCotejo(rs).map((q) => q.requisito), ['I-no-1', 'I-no-2', 'I-parcial', 'D-no', 'D-no-2']);
  assert.deepEqual(preguntasDeCotejo([{ requisito: 'x', prioridad: 'indispensable', estado: 'cumple' }]), []);
});

await prueba('respuestas: lectura defensiva y texto para el pedido sin "No tengo esto"', async () => {
  const { leerRespuestas, respuestasATexto } = await import('../src/lib/cv-cotejo.ts');
  const r = leerRespuestas([
    { requisito: 'GCP', tipo: 'proyecto', detalle: 'Curso de 20 horas en 2024   y aplicado en mi tesis' },
    { requisito: 'gcp', tipo: 'empleo', detalle: 'duplicado' },
    { requisito: 'Viajar', tipo: 'no_tengo', detalle: 'no debería guardarse' },
    { requisito: 'SAS', tipo: 'inventado' },
    { requisito: 'Inglés', tipo: 'empleo', detalle: 'x'.repeat(900) },
    'basura',
  ]);
  assert.deepEqual(r.map((q) => [q.requisito, q.tipo, q.detalle.length]), [['GCP', 'proyecto', 48], ['Viajar', 'no_tengo', 0], ['Inglés', 'empleo', 300]]);
  const t = respuestasATexto(r);
  assert.ok(t.startsWith('Sobre "GCP": Sí, en un proyecto, tesis o curso. Curso de 20 horas en 2024 y aplicado en mi tesis'));
  assert.ok(!t.includes('Viajar'));
  // Sin cifras del requisito (redacción de la vacante, no dato de la persona).
  assert.equal(respuestasATexto([{ requisito: 'Mínimo 5 años de experiencia (2+)', tipo: 'empleo', detalle: '' }]), 'Sobre "Mínimo años de experiencia": Sí, en un empleo.');
  assert.equal(respuestasATexto([]), '');
  assert.deepEqual(leerRespuestas('x'), []);
});

await prueba('p5: la lista clasificada va al mensaje y fija la prioridad de COINCIDENCIA por nombre', async () => {
  const { mensajeUsuario, validarCvMedida, CVM_SYSTEM_PROMPT } = await import('../src/lib/cv-medida.ts');
  const m = mensajeUsuario({ cv: CV, vacante: VAC, textoLibre: '', idioma: 'es', requisitos: [{ requisito: 'Inglés avanzado', prioridad: 'indispensable' }] });
  assert.ok(m.includes('<requisitos_clasificados>\n- [indispensable] Inglés avanzado\n</requisitos_clasificados>'));
  assert.ok(!mensajeUsuario({ cv: CV, vacante: VAC, textoLibre: '', idioma: 'es' }).includes('requisitos_clasificados'));
  assert.ok(CVM_SYSTEM_PROMPT.includes('COINCIDENCIA usa EXACTAMENTE esos requisitos'));
  const salida = {
    puesto_vacante: 'QC', rol: 'Other',
    contacto: { nombre: 'María Ejemplo', titular: '', correo: '', telefono: '', ubicacion: '', linkedin: '' },
    resumen: 'Química farmacéutica con experiencia en control de calidad. Liberación de lotes y estudios de estabilidad por HPLC.',
    experiencia: [{ puesto: 'Analista de control de calidad', organizacion: 'Laboratorio X', inicio: '2020', fin: '2023', cita: 'Analista de control de calidad, Laboratorio X',
      vinetas: [{ texto: 'Liberé lotes y realicé estudios de estabilidad por HPLC.', fuente: 'cv', cita: 'liberación de lotes y estudios de estabilidad por HPLC' }] }],
    educacion: [], habilidades: [], certificaciones: [], publicaciones: [], idiomas: [],
    coincidencia: [
      { requisito: 'Licenciatura', prioridad: 'indispensable', estado: 'no_cumple', evidencia: '', comentario: '' },
      { requisito: 'inglés  avanzado', prioridad: 'deseable', estado: 'cumple', evidencia: 'Inglés avanzado (C1)', comentario: '' },
    ],
  };
  const CV2 = 'María Ejemplo\nQuímica Farmacéutico Bióloga, Universidad Nacional, 2019.\nAnalista de control de calidad, Laboratorio X, 2020-2023: liberación de lotes y estudios de estabilidad por HPLC.\nInglés avanzado (C1).';
  const v2 = validarCvMedida(salida, { cv: CV2, textoLibre: '', idioma: 'es', requisitos: [{ requisito: 'Inglés avanzado', prioridad: 'indispensable' }] });
  assert.ok(v2.ok, v2.motivo);
  // "Licenciatura" (modelo) está contenida en "Licenciatura en química o afín" (lista, deseable); "inglés avanzado" igual.
  const v3 = validarCvMedida(salida, { cv: CV2, textoLibre: '', idioma: 'es', requisitos: [{ requisito: 'Inglés avanzado (C1)', prioridad: 'indispensable' }, { requisito: 'Licenciatura en química o afín', prioridad: 'deseable' }] });
  assert.deepEqual(v3.cv.coincidencia.map((q) => [q.requisito, q.prioridad]), [['inglés avanzado', 'indispensable'], ['Licenciatura', 'deseable']]);
  assert.equal(v3.reporte.requisitos_fuera_de_lista, 0);
  // Sin coincidencia: se conserva la prioridad del modelo y se cuenta.
  assert.deepEqual(v2.cv.coincidencia.map((q) => [q.requisito, q.prioridad]), [['Licenciatura', 'indispensable'], ['inglés avanzado', 'indispensable']]);
  assert.equal(v2.reporte.requisitos_fuera_de_lista, 1);
});

await prueba('evidencia: tramos de líneas separadas, Ph.D./PhD y guion al final de línea; sin palabras sueltas', async () => {
  const { evidenciaLiteral } = await import('../src/lib/cv-cotejo.ts');
  const cv = `Education\nUniversity of Sheffield, UK\n-PhD in Biomedical Science. (2019).\n-Master’s in Biomedical science.\nDistinction (2014).\nUTEL-Mexico\n-Master’s in Directive Management\nof health institutions (Jul 2020-\nPresent).\nUNAM-Mexico\n-B.Sc. Biology. Honours (2013).\nIQVIA (2022-2025)\nAssociate consultant and data analyst:`;
  assert.ok(evidenciaLiteral("Ph.D. in Biomedical Science (2019). Master's in Biomedical science. Distinction (2014). B.Sc. Biology. Honours (2013).", cv));
  assert.ok(evidenciaLiteral("Master's in Directive Management of health institutions (Jul 2020- Present).", cv));
  assert.ok(evidenciaLiteral('Associate consultant and data analyst: IQVIA (2022-2025)', cv));
  assert.equal(evidenciaLiteral('PhD in Molecular Medicine (2019). Master in Biomedical science.', cv), false); // un tramo inventado
  assert.equal(evidenciaLiteral('biomedical science sheffield degree', cv), false); // palabras sueltas
  assert.equal(evidenciaLiteral('Honours. Distinction.', cv), false); // ningún tramo de 3+ palabras
  for (const x of ['Associate consultant and data analyst: SAS.', 'PhD in Biomedical Science. Harvard. Oxford.', 'Associate consultant and data analyst | Novartis', 'Associate consultant and data analyst // SQL'])
    assert.equal(evidenciaLiteral(x, cv), false, x); // un tramo real no salva una palabra inventada
  assert.ok(evidenciaLiteral('IQVIA (2022-2025) – Associate consultant and data analyst', cv));
});

// ── c3 (24 nov 2026): encabezados neutros ("Qualifications", "What you bring") ─────────────────────────────
// Dos anuncios de ejemplo (redactados para la prueba). Se pasan por validarVacante, como saldrían del modelo, y la
// prioridad se comprueba por código requisito por requisito.
const VAC_NEUTRA_1 = `Clinical Data Coordinator
About the role
You will review and clean data from clinical studies.
Qualifications
• Bachelor's degree in life sciences, pharmacy or a related field.
• 2+ years of experience in clinical data management.
• Working knowledge of MedDRA coding.
• Experience with SAS is a plus.
• Strong attention to detail.
• Minimum B2 level of English.
• Familiarity with CDISC standards preferred.`;

const VAC_NEUTRA_2 = `Analista de Calidad
Lo que buscamos
• Título universitario en Química, QFB o carrera afín.
• Mínimo dos años de experiencia en control de calidad bajo BPF.
• Manejo de HPLC.
• Conocimiento de SAP QM, deseable.
• Disponibilidad para trabajar por turnos.
What you bring
• You must be able to work on site in Toluca.
• Experience in a regulated environment would be nice to have.
• Excellent communication skills.`;

function salidaDe(vac, pares) {
  return { puesto: vac.split('\n')[0], empresa: '', rol: 'Other', requisitos: pares.map(([requisito, cita, marca]) => ({ requisito, cita, marca })) };
}

await prueba('c3 anuncio 1 (Qualifications): títulos, años y "minimum" → indispensable; "a plus"/"preferred" → deseable; resto → sin_indicar', () => {
  const v = validarVacante(salidaDe(VAC_NEUTRA_1, [
    ["Bachelor's degree in life sciences", "Bachelor's degree in life sciences, pharmacy or a related field.", 'Qualifications'],
    ['2+ years in clinical data management', '2+ years of experience in clinical data management.', 'Qualifications'],
    ['MedDRA coding', 'Working knowledge of MedDRA coding.', 'Qualifications'],
    ['SAS', 'Experience with SAS is a plus.', 'Qualifications'],
    ['Attention to detail', 'Strong attention to detail.', 'Qualifications'],
    ['English B2', 'Minimum B2 level of English.', 'Qualifications'],
    ['CDISC standards', 'Familiarity with CDISC standards preferred.', 'Qualifications'],
  ]), VAC_NEUTRA_1);
  assert.ok(v, 'clasificación nula');
  assert.equal(v.requisitos.length, 7);
  assert.ok(v.requisitos.every((r) => r.marca === 'Qualifications'), 'la marca neutra debe calificar a todos');
  assert.deepEqual(v.requisitos.map((r) => [r.requisito, r.prioridad]), [
    ["Bachelor's degree in life sciences", 'indispensable'],
    ['2+ years in clinical data management', 'indispensable'],
    ['MedDRA coding', 'sin_indicar'],
    ['SAS', 'deseable'],
    ['Attention to detail', 'sin_indicar'],
    ['English B2', 'indispensable'],
    ['CDISC standards', 'deseable'],
  ]);
  // Ya no sale todo "deseable".
  assert.ok(v.requisitos.filter((r) => r.prioridad === 'deseable').length < v.requisitos.length);
});

await prueba('c3 anuncio 2 ("Lo que buscamos" / "What you bring"): título, mínimo de años y "must" → indispensable', () => {
  const v = validarVacante(salidaDe(VAC_NEUTRA_2, [
    ['Título en Química o QFB', 'Título universitario en Química, QFB o carrera afín.', 'Lo que buscamos'],
    ['Experiencia en control de calidad', 'Mínimo dos años de experiencia en control de calidad bajo BPF.', 'Lo que buscamos'],
    ['HPLC', 'Manejo de HPLC.', 'Lo que buscamos'],
    ['SAP QM', 'Conocimiento de SAP QM, deseable.', 'Lo que buscamos'],
    ['Turnos', 'Disponibilidad para trabajar por turnos.', 'Lo que buscamos'],
    ['Trabajo presencial', 'You must be able to work on site in Toluca.', 'What you bring'],
    ['Entorno regulado', 'Experience in a regulated environment would be nice to have.', 'What you bring'],
    ['Comunicación', 'Excellent communication skills.', 'What you bring'],
  ]), VAC_NEUTRA_2);
  assert.ok(v, 'clasificación nula');
  assert.deepEqual(v.requisitos.map((r) => r.prioridad), [
    'indispensable', 'indispensable', 'sin_indicar', 'deseable', 'sin_indicar', 'indispensable', 'deseable', 'sin_indicar',
  ]);
  // La marca "Lo que buscamos" no califica a lo que está bajo "What you bring" (otro encabezado en medio).
  assert.equal(v.requisitos[5].marca, 'What you bring');
});

await prueba('c3 exigencia implícita: casos adversarios', async () => {
  const { exigenciaImplicita } = await import('../src/lib/cv-cotejo.ts');
  const { normalizar } = await import('../src/lib/cv-medida.ts');
  const si = [
    '3+ years of experience in pharmacovigilance',
    '1-4 years of business experience',
    'At least two years in a CRO',
    'Al menos un año de experiencia en farmacovigilancia',
    'Experiencia comprobable de 2 años en monitoreo',
    "Master's degree in Public Health",
    'PhD or PharmD in a relevant discipline',
    'Licenciatura en Biología, Química o afín',
    'Required: fluent English',
    'Minimum of a bachelor degree',
    'Nivel de inglés mínimo B2',
  ];
  const no = [
    'A high degree of autonomy',
    'Ability to work with minimum supervision',
    'Strong communication skills',
    'No degree required for this internship',
    "No bachelor's degree needed",
    'Sin título universitario; aceptamos pasantes',
    'Not 5 years: we train you',
    'Sin título: aceptamos estudiantes de último semestre',
    'Willingness to travel up to 20% of the time',
    'Knowledge of ICH E6 guidelines',
    'Experience with master data management tools',
    'Our company has more than 100 employees',
  ];
  for (const c of si) assert.equal(exigenciaImplicita(normalizar(c)), true, c);
  for (const c of no) assert.equal(exigenciaImplicita(normalizar(c)), false, c);
  // La preferencia gana sobre años o título: "3+ years preferred" es deseable, no indispensable.
  assert.equal(prioridadPorMarca('3+ years of experience preferred', 'Qualifications'), 'deseable');
  assert.equal(prioridadPorMarca("PhD is a plus", 'Qualifications'), 'deseable');
  // Un encabezado de preferencia gana sobre años o título del propio requisito.
  assert.equal(prioridadPorMarca("Master's degree in statistics", 'Preferred qualifications'), 'deseable');
  assert.equal(prioridadPorMarca('5 years of experience', 'Nice to have'), 'deseable');
});

await prueba('c3 unirEvaluacion: conteo sin_indicar aparte y orden indispensable → deseable → sin indicar', () => {
  const vac = { version: COTEJO_CLASIFICACION_VERSION, puesto: 'X', empresa: '', rol: 'Other', idioma: 'en', descartados: 0, requisitos: [
    { requisito: 'MedDRA', prioridad: 'sin_indicar', cita: 'Working knowledge of MedDRA coding', marca: 'Qualifications' },
    { requisito: 'Degree', prioridad: 'indispensable', cita: "Bachelor's degree", marca: 'Qualifications' },
    { requisito: 'SAS', prioridad: 'deseable', cita: 'SAS is a plus', marca: 'Qualifications' },
    { requisito: 'Viejo', cita: 'sin prioridad en una caché vieja', marca: '' },
  ] };
  const r = unirEvaluacion({ evaluacion: [] }, vac, CV);
  assert.deepEqual(r.requisitos.map((q) => q.requisito), ['Degree', 'SAS', 'MedDRA', 'Viejo']);
  assert.equal(r.indispensables.total, 1);
  assert.equal(r.deseables.total, 1);
  assert.deepEqual(r.sin_indicar, { total: 2, cumple: 0, parcial: 0, no_aparece: 2 });
  assert.equal(r.indispensables.total + r.deseables.total + r.sin_indicar.total, vac.requisitos.length);
});

await prueba('c3 preguntas y CV a la medida: sin_indicar va entre indispensables y deseables; a la medida viaja como deseable', async () => {
  const { preguntasDeCotejo, requisitosParaMedida } = await import('../src/lib/cv-cotejo.ts');
  const qs = preguntasDeCotejo([
    { requisito: 'D-no', prioridad: 'deseable', estado: 'no_aparece' },
    { requisito: 'S-no', prioridad: 'sin_indicar', estado: 'no_aparece' },
    { requisito: 'I-parcial', prioridad: 'indispensable', estado: 'parcial' },
    { requisito: 'S-parcial', prioridad: 'sin_indicar', estado: 'parcial' },
  ]);
  assert.deepEqual(qs.map((q) => q.requisito), ['I-parcial', 'S-no', 'S-parcial', 'D-no']);
  const m = requisitosParaMedida({ requisitos: [
    { requisito: 'A', prioridad: 'indispensable', cita: '', marca: '' },
    { requisito: 'B', prioridad: 'sin_indicar', cita: '', marca: '' },
    { requisito: 'C', prioridad: 'deseable', cita: '', marca: '' },
  ] });
  assert.deepEqual(m, [{ requisito: 'A', prioridad: 'indispensable' }, { requisito: 'B', prioridad: 'deseable' }, { requisito: 'C', prioridad: 'deseable' }]);
});

await prueba('revisión 1: rango de años desde 0 no es indispensable', async () => {
  const { exigenciaImplicita } = await import('../src/lib/cv-cotejo.ts');
  const { normalizar } = await import('../src/lib/cv-medida.ts');
  for (const c of ['0 to 2 years of experience in clinical research', '0-2 años de experiencia en farmacovigilancia', '0 - 1 year of experience'])
    assert.equal(exigenciaImplicita(normalizar(c)), false, c);
  assert.equal(prioridadPorMarca('0-2 años de experiencia en farmacovigilancia', 'Qualifications'), 'sin_indicar');
  assert.equal(exigenciaImplicita(normalizar('2-4 years of experience')), true);
  assert.equal(exigenciaImplicita(normalizar('10 years of experience')), true);
});

await prueba('revisión 2: "no menor a" no es negación; la negación no cruza ";" ni ","; todas las coincidencias', async () => {
  const { exigenciaImplicita } = await import('../src/lib/cv-cotejo.ts');
  const si = [
    'Experiencia no menor a 2 años en farmacovigilancia',
    'No less than 3 years of experience in clinical monitoring',
    'Not less than 2 years of relevant experience',
    'Experiencia no inferior a 3 años en estudios clínicos',
    'No relocation needed; 3+ years of experience in pharmacovigilance',
    'Sin viajes, licenciatura en Química',
    // Primera coincidencia negada, segunda no: cuenta la segunda.
    'No degree required for the internship; PhD required for the scientist track',
  ];
  for (const c of si) assert.equal(exigenciaImplicita(c), true, c);
  assert.equal(exigenciaImplicita('No degree required for this internship'), false);
  assert.equal(exigenciaImplicita('Sin título universitario; aceptamos pasantes'), false);
  assert.equal(prioridadPorMarca('Experiencia no menor a 2 años en farmacovigilancia', 'Perfil'), 'indispensable');
});

await prueba('revisión 3: título con experiencia equivalente como alternativa es sin_indicar', async () => {
  const { exigenciaImplicita } = await import('../src/lib/cv-cotejo.ts');
  const casos = [
    "Bachelor's degree in Life Sciences or equivalent experience",
    "Bachelor's degree in a scientific discipline, or equivalent relevant experience",
    'Licenciatura en Química y/o experiencia en control de calidad',
    'Licenciatura en Biología o experiencia equivalente',
  ];
  for (const c of casos) {
    assert.equal(exigenciaImplicita(c), false, c);
    assert.equal(prioridadPorMarca(c, 'Qualifications'), 'sin_indicar', c);
  }
  // Sin la alternativa, el título sigue exigiendo; y los años siguen contando aunque haya alternativa al título.
  assert.equal(exigenciaImplicita("Bachelor's degree in Life Sciences"), true);
  assert.equal(exigenciaImplicita('Minimum of a bachelor degree or equivalent experience'), false);
  assert.equal(exigenciaImplicita("Bachelor's degree or equivalent experience; 3+ years of experience in QA"), true);
});

await prueba('c3 interfaz y endpoint: sección "Sin indicar" y conteo en la respuesta', () => {
  const pag = readFileSync(new URL('../src/pages/comparar-cv.astro', import.meta.url), 'utf8');
  assert.ok(pag.includes('id="r-h-sin"') && pag.includes('id="r-sin"'));
  assert.ok(pag.includes("lista($('r-sin'), sinL)"));
  assert.ok(pag.includes("q.prioridad === 'deseable'"), 'deseables ya no es "todo lo que no es indispensable"');
  const api = readFileSync(new URL('../src/pages/api/cv-cotejo.ts', import.meta.url), 'utf8');
  assert.ok(api.includes('sin_indicar: r.sin_indicar'));
  for (const f of ['../src/pages/api/cv-medida-checkout.ts', '../src/pages/api/cv-medida-prueba.ts'])
    assert.ok(readFileSync(new URL(f, import.meta.url), 'utf8').includes('requisitosParaMedida(clasif)'), f);
  assert.equal(COTEJO_CLASIFICACION_VERSION, 'c3-2026-11');
  assert.equal(COTEJO_VERSION, 'c4-2026-11');
});

console.log(`${n} pruebas pasaron.`);
