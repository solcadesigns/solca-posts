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
  cursoLead,
} from '../src/lib/cv-review-rubric.ts';
import { renderCvAnalysisEmail, renderCvApologyEmail, nextStepEmail, cvEmailFooter } from '../src/lib/cv-review-email.ts';
import { processCvPendingOnce, markCvDone, saveCvJob, CV_MAX_SEND_ATTEMPTS } from '../src/lib/cv-pending.ts';

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
async function test(name, fn) {
  await fn();
  n++;
  console.log(`ok ${n} - ${name}`);
}

// 1. Salida completa y correcta
await test('salida buena: estructura, versión, grupos y evidencia', () => {
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

await test('frases prohibidas: se quitan de la retroalimentación', () => {
  const r = validateCvReview(BUENA, ctxPdf).result;
  assert.ok(!/segundos/.test(r.retroalimentacion));
  assert.ok(!/En mi experiencia/i.test(r.retroalimentacion));
  assert.ok(/Falta un resumen/.test(r.retroalimentacion));
});

// 2. Reescrituras con "antes" inventado o cifras inventadas
await test('reescritura no literal y cifra inventada se descartan', () => {
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
await test('texto pegado: extensión, viñetas y columnas quedan no_evaluable', () => {
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
await test('parcial: faltan reescrituras y resumen; ids por nombre; estado con acento', () => {
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

await test('prioridades: apuntan a sólido o no_evaluable o repetidas se descartan', () => {
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

await test('nada útil: devuelve null', () => {
  assert.equal(validateCvReview({ candidateName: 'X', retroalimentacion: 'algo' }, ctxPdf), null);
  assert.equal(validateCvReview('texto', ctxPdf), null);
});

// 5. JSON truncado por max_tokens
await test('JSON truncado se repara hasta el último objeto completo', () => {
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
await test('conteos, grupos y grupo con más ▲', () => {
  const r = validateCvReview(BUENA, ctxPdf).result;
  const c = countByEstado(r.observaciones);
  assert.deepEqual(c, { prioritario: 3, mejorable: 14, solido: 3, no_evaluable: 0 });
  const g = groupObservaciones(r.observaciones);
  assert.equal(g.length, 6);
  assert.equal(g.reduce((a, x) => a + x.items.length, 0), 20);
  assert.equal(topGrupo(r.observaciones), 'posicionamiento');
});

await test('siguiente paso elegido en código', () => {
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

await test('rol elegido en el formulario: nunca quiz; simulador o curso según el hallazgo principal', () => {
  const base = validateCvReview(BUENA, ctxPdf).result;
  const posicionamiento = { ...base, prioridades: [{ id_observacion: 2, accion: 'x', por_que: '', esfuerzo: '' }] };
  // Sin rol elegido, lo más débil en posicionamiento sigue llevando al quiz.
  assert.equal(pickNextStep(posicionamiento), 'quiz');
  assert.equal(pickNextStep(posicionamiento, 'no_seguro'), 'quiz', '"Aún no lo decido" no cuenta como rol elegido');
  // Con rol elegido: curso, y el texto nombra el rol en vez de "si todavía dudas entre roles".
  assert.equal(pickNextStep(posicionamiento, 'MSL'), 'curso');
  assert.match(cursoLead(posicionamiento, 'MSL'), /apuntas a Medical Science Liaison \(MSL\)/);
  assert.equal(pickNextStep({ ...base, perfil: { ...base.perfil, rol_objetivo: null } }, 'CRA'), 'curso', 'aunque el modelo no distinga rol');
  // Con rol elegido y sin prioritarios: simulador.
  const sinRojo = base.observaciones.map((o) => ({ ...o, estado: o.estado === 'prioritario' ? 'mejorable' : o.estado }));
  assert.equal(pickNextStep({ ...posicionamiento, observaciones: sinRojo }, 'MSL'), 'simulador');
  for (const rol of ['CRA', 'MSL', 'Clinical_PM', 'Regulatory']) {
    for (const res of [base, posicionamiento, { ...posicionamiento, observaciones: sinRojo }]) {
      assert.notEqual(pickNextStep(res, rol), 'quiz');
    }
  }
});

await test('correo con el análisis: contenido, UTM, src y sin "gratis"', () => {
  const r = validateCvReview(BUENA, ctxPdf).result;
  const e = renderCvAnalysisEmail(r, { rolFormulario: 'MSL', marketing: true });
  assert.match(e.text, /Perfil científico sólido/);
  assert.match(e.text, /Prioritario: 3 · Mejorable: 14 · Sólido: 3 · No evaluable: 0/);
  assert.match(e.text, /QUÉ CAMBIAR PRIMERO\n1\. Reescribe tus viñetas como logros\./);
  assert.match(e.text, /Antes: "Responsable de los experimentos/);
  assert.match(e.html, /Así se vería/);
  for (const body of [e.text, e.html]) {
    assert.ok(!/gratis|gratuit/i.test(body), 'sin "gratis" en correos');
    for (const url of body.match(/https:\/\/[^\s"<]+/g)) {
      if (url.includes('solcaciencia.com')) assert.match(url, /utm_source=email&(amp;)?utm_medium=cv-report/, url);
      if (url.includes('hotmart.com')) assert.match(url, /[?&]src=/, url);
    }
  }
  assert.match(e.html, /go\.hotmart\.com\/B104495115T\?src=email-cv-report/, 'curso con casilla comercial');
  assert.ok(!/DETALLE/.test(e.text), 'sin detalle cuando ya se vio en pantalla');
  assert.ok(!/<script/i.test(e.html));
});

await test('correo: sin casilla comercial no hay curso; reintento trae detalle; HTML escapado', () => {
  const r = validateCvReview(BUENA, ctxPdf).result;
  assert.equal(nextStepEmail(r, 'MSL', false), null);
  const e = renderCvAnalysisEmail(r, { rolFormulario: 'MSL', marketing: false, reintento: true });
  assert.ok(!/hotmart/i.test(e.html));
  assert.match(e.subject, /listo/);
  assert.match(e.text, /DETALLE: LO QUE CONVIENE AJUSTAR/);
  assert.match(e.text, /utm_campaign=revisar-cv-reintento/);
  const x = structuredClone(r);
  x.resumen.una_linea = '<img src=x onerror=alert(1)> & "comillas"';
  const ex = renderCvAnalysisEmail(x, { marketing: false });
  assert.ok(!ex.html.includes('<img src=x'));
  assert.ok(ex.html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;comillas&quot;'));
  // Sin rol elegido y posicionamiento como lo más débil: quiz (enlace con UTM, sin consentimiento comercial).
  const q = renderCvAnalysisEmail({ ...r, prioridades: [{ id_observacion: 2, accion: 'x', por_que: '', esfuerzo: '' }] }, { marketing: false });
  assert.match(q.html, /quiz-rol\?utm_source=email&amp;utm_medium=cv-report/);
  const a = renderCvApologyEmail();
  assert.ok(!/gratis|gratuit/i.test(a.text + a.html));
  assert.match(a.text, /no cuenta para tu límite/);
});

await test('pie del correo: con casilla comercial no dice "no te suscribe a nada"', () => {
  const r = validateCvReview(BUENA, ctxPdf).result;
  assert.match(cvEmailFooter(false), /no te suscribe a nada/);
  assert.ok(!/no te suscribe/.test(cvEmailFooter(true)));
  assert.ok(!/no te suscribe/.test(renderCvAnalysisEmail(r, { marketing: true }).html));
  assert.match(renderCvAnalysisEmail(r, { marketing: false }).text, /no te suscribe a nada/);
  assert.ok(!/no tiene costo/.test(renderCvAnalysisEmail({ ...r, observaciones: r.observaciones.map((o) => ({ ...o, estado: o.estado === 'prioritario' ? 'mejorable' : o.estado })) }, { rolFormulario: 'MSL', marketing: false }).text));
});

// ── Procesador de pendientes (cv-pending.ts) con KV en memoria ─────────────────────────────────
function memKv() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }; },
  };
}
const JOB_KEY = 'cvjob:abc123abc123abc123abc123';
function baseJob(t0, over = {}) {
  return {
    v: 1, state: 'pending', createdAt: new Date(t0 - 10 * 60_000).toISOString(), attempts: 1, nextAt: new Date(t0 - 1000).toISOString(),
    lastStatus: 'llm_error', attemptKey: 'attempt:x', attemptTs: new Date(t0).toISOString(), intento: 'abc123abc123',
    cv: CV, cvLength: CV.length, rolObjetivo: 'MSL', origen: 'pdf', paginas: 2, email: 'p@x.com', privacidad: true,
    marketing: false, consentVersion: 'v3-2026-11', consentTs: new Date(t0).toISOString(), ip: null, utms: {}, attr: {}, ...over,
  };
}
async function harness({ analyze, sendOk = () => true, alertOk = () => true } = {}) {
  const kv = memKv();
  let t = Date.parse('2026-11-07T12:00:00Z');
  const log = [];
  let id = 0;
  const RESULT = validateCvReview(BUENA, ctxPdf).result;
  const deps = {
    kv, paused: false, now: () => t, newId: () => `claim-${++id}`,
    analyze: analyze ? (job) => analyze(job, { kv, t: () => t }) : async () => ({ ok: true, result: RESULT, parcial: false, ms: 1 }),
    sendAnalysis: async (job) => { log.push(`send:${job.cv === '' ? 'sin_cv' : 'con_cv'}`); return sendOk(); },
    finalize: async () => { log.push('finalize'); },
    sendApology: async () => { log.push('apology'); return true; },
    alert: async (job, motivo) => { log.push(`alert:${motivo}`); return alertOk(); },
    record: async (job, status) => { log.push(`record:${status}`); },
  };
  await saveCvJob(kv, JOB_KEY, baseJob(t), t);
  return { kv, deps, log, adv: (ms) => (t += ms), RESULT };
}

await test('reintento: el correo sale ANTES de contar el análisis', async () => {
  const h = await harness();
  const r = await processCvPendingOnce(h.deps);
  assert.equal(r.status, 'retry_ok');
  assert.deepEqual(h.log, ['send:sin_cv', 'finalize', 'record:retry_ok'], 'el CV se borra antes de enviar; conteo después del correo');
  assert.equal(await h.kv.get(JOB_KEY), null);
});

await test('reintento: si el correo falla se guarda solo el resultado, se reintenta y al final se cierra sin contar', async () => {
  const h = await harness({ sendOk: () => false });
  let r = await processCvPendingOnce(h.deps);
  assert.match(r.status, /correo_reprogramado/);
  const job = JSON.parse(await h.kv.get(JOB_KEY));
  assert.equal(job.state, 'send');
  assert.equal(job.cv, '', 'sin texto del CV');
  assert.ok(job.result, 'queda el resultado');
  for (let i = 1; i < CV_MAX_SEND_ATTEMPTS; i++) {
    h.adv(5 * 60_000);
    r = await processCvPendingOnce(h.deps);
  }
  assert.match(r.status, /retry_failed · correo/);
  assert.ok(!h.log.includes('finalize'), 'no se cuenta ni se registra el lead');
  assert.ok(h.log.includes('apology') && h.log.includes('alert:correo') && h.log.includes('record:retry_failed'));
  assert.equal(h.log.filter((x) => x.startsWith('send')).length, CV_MAX_SEND_ATTEMPTS);
  assert.equal(await h.kv.get(JOB_KEY), null);
});

await test('carrera: a la persona le sale en la página mientras el cron analiza (borrado + cvdone)', async () => {
  const h = await harness({
    analyze: async (job, { kv, t }) => {
      await markCvDone(kv, JOB_KEY, t());
      await kv.delete(JOB_KEY);
      return { ok: true, result: validateCvReview(BUENA, ctxPdf).result, parcial: false, ms: 1 };
    },
  });
  const r = await processCvPendingOnce(h.deps);
  assert.equal(r.status, 'abortado_reclamo');
  assert.deepEqual(h.log, [], 'ni correo, ni lead, ni conteo');
  assert.equal(await h.kv.get(JOB_KEY), null, 'no se reescribe el trabajo con el CV viejo');
});

await test('carrera: KV todavía muestra el trabajo pero existe cvdone → aborta y luego se descarta', async () => {
  const h = await harness({
    analyze: async (job, { kv, t }) => {
      await markCvDone(kv, JOB_KEY, t());
      return { ok: true, result: validateCvReview(BUENA, ctxPdf).result, parcial: false, ms: 1 };
    },
  });
  let r = await processCvPendingOnce(h.deps);
  assert.equal(r.status, 'abortado_reclamo');
  assert.equal(JSON.parse(await h.kv.get(JOB_KEY)).cv, CV, 'no se escribió nada nuevo');
  h.adv(60_000);
  r = await processCvPendingOnce(h.deps);
  assert.equal(r.status, 'superseded');
  assert.deepEqual(h.log, ['record:retry_superseded']);
  assert.equal(await h.kv.get(JOB_KEY), null);
});

await test('carrera: la persona crea un trabajo nuevo durante el análisis → el cron no lo pisa', async () => {
  const h = await harness({
    analyze: async (job, { kv, t }) => {
      await saveCvJob(kv, JOB_KEY, baseJob(t() + 20 * 60_000, { cv: CV + ' NUEVO', attempts: 1 }), t());
      return { ok: false, status: 'llm_error', ms: 1 };
    },
  });
  const r = await processCvPendingOnce(h.deps);
  assert.equal(r.status, 'abortado_reclamo');
  const job = JSON.parse(await h.kv.get(JOB_KEY));
  assert.ok(job.cv.endsWith('NUEVO'));
  assert.equal(job.attempts, 1);
});

await test('cierre: si la alerta falla, la siguiente corrida termina sin repetir la disculpa', async () => {
  let alertOk = false;
  const h = await harness({ analyze: async () => ({ ok: false, status: 'llm_error', ms: 1 }), alertOk: () => alertOk });
  await processCvPendingOnce(h.deps); // intento 2 falla → reprogramado
  h.adv(15 * 60_000);
  let r = await processCvPendingOnce(h.deps); // intento 3 falla → cierre, alerta falla
  assert.equal(r.status, 'closing_incompleto');
  const job = JSON.parse(await h.kv.get(JOB_KEY));
  assert.equal(job.state, 'closing');
  assert.equal(job.cv, '', 'el CV se borra antes de avisar');
  alertOk = true;
  r = await processCvPendingOnce(h.deps);
  assert.match(r.status, /retry_failed · analisis/);
  assert.equal(h.log.filter((x) => x === 'apology').length, 1);
  assert.equal(await h.kv.get(JOB_KEY), null);
});

await test('rol del formulario: solo valores del catálogo', () => {
  assert.equal(readRolObjetivo('CRA'), 'CRA');
  assert.equal(readRolObjetivo('no_seguro'), 'no_seguro');
  assert.equal(readRolObjetivo('Other'), undefined);
  assert.equal(readRolObjetivo('<script>'), undefined);
  assert.equal(readRolObjetivo('toString'), undefined);
});

await test('scrubBanned conserva oraciones limpias', () => {
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
