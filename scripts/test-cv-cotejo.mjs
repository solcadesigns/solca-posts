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

await prueba('prioridad: obligación en la marca → indispensable; sin marca o "What we are looking for" → deseable', () => {
  assert.equal(prioridadPorMarca("Bachelor's degree in pharmacy", 'Required qualifications and experience:'), 'indispensable');
  assert.equal(prioridadPorMarca('Advanced proficiency in English', "What We're Looking For"), 'deseable');
  assert.equal(prioridadPorMarca('Licenciatura en Química', 'Requisitos:'), 'indispensable');
  assert.equal(prioridadPorMarca('Inglés avanzado', ''), 'deseable');
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
  assert.equal(prioridadPorMarca('Willingness to travel as required (approximately 10%)', ''), 'deseable');
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
  assert.equal(v.version, COTEJO_VERSION);
  assert.equal(v.rol, 'Pharmacovigilance');
  assert.deepEqual(v.requisitos.map((r) => [r.requisito, r.prioridad]), [
    ["Bachelor's degree", 'indispensable'],
    ['Inglés avanzado', 'deseable'], // "Required qualifications" está antes, pero "What We're Looking For" abre otra sección
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
  assert.equal(v.requisitos[0].prioridad, 'deseable');
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
  assert.equal(v.requisitos[0].prioridad, 'deseable');
  assert.equal(validarVacante({ requisitos: [] }, VAC), null);
  assert.equal(validarVacante(null, VAC), null);
});

const VACC = {
  version: COTEJO_VERSION,
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
  assert.ok(a.startsWith(`cotejo:vac:${COTEJO_VERSION}:`));
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
  assert.ok(/requisitos: r\.requisitos\.map\(\(q\) => \(\{ requisito: q\.requisito, prioridad: q\.prioridad, estado: q\.estado \}\)\)/.test(src));
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

console.log(`${n} pruebas pasaron.`);
