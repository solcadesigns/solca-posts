#!/usr/bin/env node
/**
 * scripts/simulator-recover-report.mjs
 *
 * Recovery de reportes finales que fallaron en el Worker por Cloudflare 524
 * (gateway timeout). Corre en tu máquina local · sin límite de 100s.
 *
 * Contexto (2 sept 2026): sesión 27d9355c falló con 524 tras completar 10/10
 * respuestas. El retry también cayó en 524 (mismo tamaño de reporte).
 * Este script regenera el reporte usando el state persistido en KV.
 *
 * Uso:
 *   1. Extrae el state del KV (ojo: prefix "session:", no "state:"):
 *        cd ~/Downloads/solca/website
 *        npx wrangler kv key get "session:<sessionId>" \
 *          --binding=SIMULATOR_SESSIONS --remote > state.json
 *
 *   2. Genera el reporte:
 *        ANTHROPIC_API_KEY=sk-ant-... \
 *          node scripts/simulator-recover-report.mjs state.json > report.json
 *
 *   3. Revisa report.json. Contiene el JSON del reporte final tal como lo
 *      hubiera devuelto el Worker.
 *
 * Requisitos: Node 18+ (fetch nativo). Sin dependencias npm adicionales.
 *
 * IMPORTANTE: usa un system prompt de recovery MÍNIMO, no el prompt completo
 * de producción (que tiene 700 líneas). La calidad del reporte puede variar
 * ligeramente. Para 1-2 sesiones de recuperación esto es aceptable.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
// Default a un modelo con "latest" alias que no requiere fecha específica.
// Override con MODEL=... si tu cuenta tiene acceso a otro modelo.
const MODEL = process.env.MODEL ?? 'claude-sonnet-4-5';
const TIMEOUT_MS = 10 * 60 * 1000; // 10 min · lejos del límite Cloudflare

if (!ANTHROPIC_KEY) {
  console.error('ERROR: Falta ANTHROPIC_API_KEY en env.');
  console.error('Uso: ANTHROPIC_API_KEY=sk-ant-... node scripts/simulator-recover-report.mjs state.json');
  process.exit(1);
}

const statePath = process.argv[2];
if (!statePath) {
  console.error('ERROR: Falta path al state.json (arg 1).');
  process.exit(1);
}

let raw;
try {
  raw = readFileSync(statePath, 'utf-8');
} catch (err) {
  console.error(`ERROR: no pude leer ${statePath}: ${err.message}`);
  process.exit(1);
}

// wrangler kv key get envuelve el value en el propio JSON del KV, o lo saca
// como texto plano dependiendo de la versión. Intentamos ambos.
let state;
try {
  state = JSON.parse(raw);
  // Si el valor es a su vez un string JSON, unwrap.
  if (typeof state === 'string') {
    state = JSON.parse(state);
  }
} catch (err) {
  console.error(`ERROR: state.json no parseable: ${err.message}`);
  process.exit(1);
}

if (!state.sessionId || !state.turns || !Array.isArray(state.turns)) {
  console.error('ERROR: state.json no tiene sessionId o turns. Verifica que sea el JSON del KV.');
  process.exit(1);
}

const p = state.profile ?? {};
const numQuestions = state.turns.filter((t) => t.userAnswer).length;
const nRequested = p.questionCount ?? numQuestions;

console.error(`[recover] sessionId: ${state.sessionId}`);
console.error(`[recover] respuestas: ${numQuestions} · pedidas: ${nRequested}`);
console.error(`[recover] plan: ${state.plan} · rol: ${p.roleTitle ?? '(sin especificar)'} · etapa: ${p.interviewStage ?? '?'}`);
console.error('');

// ── System prompt mínimo de recovery ────────────────────────────────
const systemPrompt = `Eres el evaluador del Simulador de Entrevistas Pharma de Solca Ciencia.

La sesión de entrevista ya se completó (el candidato respondió las ${numQuestions} preguntas). Tu trabajo AHORA es únicamente generar el reporte final en JSON estructurado.

REGLAS DE MARCA:
- Cero emojis.
- Cero afirmaciones comparativas sin fuente ("top quartile", "vast majority", "arriba del promedio", "el X% de candidatos", cuartiles, rankings, frecuencias poblacionales).
- Feedback diagnóstico basado en LO QUE VISTE en las respuestas, no en promedios inventados.
- Español LATAM neutral. Si la sesión fue en inglés o bilingüe, respeta el idioma predominante de las respuestas.
- Definiciones inline de acrónimos pharma la primera vez que aparezcan (ICH-GCP, TMF, KOL, MLR, etc.).

CONTEXTO DEL PERFIL:
- Rol al que aplica: ${p.roleTitle ?? '(no especificado)'}
- Empresa: ${p.company ?? '(no especificada)'}
- Área de formación: ${p.formationArea ?? '(no especificada)'}
- Nivel académico: ${p.academicLevel ?? '(no declarado)'}
- Años de experiencia: ${p.experienceYears ?? '(no especificados)'}
- Especialidad: ${p.specialty ?? '(ninguna)'}
- Idioma: ${p.language ?? 'espanol'}
- Etapa: ${p.interviewStage ?? 'general_practice'}
- Dificultad: ${p.difficulty ?? 'moderado'}
- Plan: ${state.plan ?? 'gratis'}

DEVUELVES exactamente este JSON, sin texto adicional antes o después:

\`\`\`json
{
  "session_id": "${state.sessionId}",
  "rol": "${p.roleTitle ?? p.role ?? 'No especificado'}",
  "n_questions": ${numQuestions},
  "summary": {
    "scores": {
      "tecnico": <promedio 1-5>,
      "estructura": <promedio 1-5>,
      "especificidad": <promedio 1-5>,
      "alertas_count": <número entero>
    },
    "fortalezas": ["frase 1 rastreable a 1-2 preguntas", "frase 2", "frase 3"],
    "areas_de_mejora": ["frase 1 con acción concreta", "frase 2", "frase 3"],
    "vocabulario_a_incorporar": ["términos pharma específicos que faltaron"],
    "recomendacion_final": "Un párrafo de 3-4 frases con el siguiente paso operativo."
  },
  "questions_breakdown": [
    {
      "question_number": 1,
      "question_text": "<texto de la pregunta>",
      "user_answer": "<cita textual de la respuesta, ≤200 palabras · trunca con '...' si es más larga>",
      "scores": {
        "tecnico": <1-5>,
        "estructura": <1-5>,
        "especificidad": <1-5>,
        "alertas": "sin alertas | descripción específica"
      },
      "angle_used": "<A | C | D | E · rota sin repetir consecutivamente>",
      "what_worked": "<1-2 frases concretas>",
      "what_to_improve": "<1-2 frases con sugerencia accionable>",
      "model_phrase": "<frase modelo del contenido literal, ≤30 palabras>"
    }
    // ... una entrada por cada pregunta (1 a ${numQuestions})
  ],
  "cta": {
    "type": "libro | recurso_gratuito",
    "title": "<título>",
    "description": "<2-3 frases justificadas por el feedback acumulado>",
    "url": "<url>"
  }
}
\`\`\`

Bandas de scoring 1-5:
  1 = Vacía, vaga, o irrelevante.
  2 = Corta o parcial. Superficial. Falta estructura.
  3 = Adecuada. Contenido correcto pero genérico.
  4 = Sólida. Contenido preciso con vocabulario correcto. Estructura clara.
  5 = Excelente. Vocabulario fluido. Framework aplicado. Ejemplos verificables.

Los ángulos pedagógicos (A, C, D, E):
  A · "Lo que el reclutador piensa"
  C · "Lo que un senior te diría"
  D · "El siguiente paso accionable"
  E · "Evidencia que respaldaría tu respuesta"

Rotalos por pregunta sin repetir dos veces seguidas.

Para CTA:
  Plan gratis + rol PM/Clinical PM: libro "De doctorado a Project Manager" (https://go.hotmart.com/R105710415P)
  Plan gratis + rol MSL/Medical Affairs: libro MSL (https://go.hotmart.com/Y105718405Y)
  Plan gratis + rol CRA/Clinical Research: libro Clinical Research (https://go.hotmart.com/U105724060O)
  Otros roles o scores promedio ≤2.5: recurso "Revisa tu CV" (https://solcaciencia.com/revisar-cv)
`;

// ── Construcción de messages desde turns ────────────────────────────
const messages = [];
for (const turn of state.turns) {
  if (turn.questionText) {
    messages.push({ role: 'assistant', content: turn.questionText });
  }
  if (turn.userAnswer) {
    const answerWithTiming = turn.userAnswerSeconds
      ? `${turn.userAnswer}\n\n(Tiempo de respuesta: ${turn.userAnswerSeconds} segundos)`
      : turn.userAnswer;
    messages.push({ role: 'user', content: answerWithTiming });
  }
}

// Prompt final que dispara el reporte JSON
messages.push({
  role: 'user',
  content: `Ya respondí las ${numQuestions} preguntas de la sesión. Genera ahora el reporte final en el formato JSON descrito en las instrucciones. Devuelve SOLO el JSON, sin texto adicional antes ni después.`,
});

// ── Anthropic call con timeout largo ────────────────────────────────
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

console.error(`[recover] llamando Anthropic ${MODEL}... (timeout ${TIMEOUT_MS / 1000}s)`);
const startedAt = Date.now();

let response;
try {
  response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      temperature: 0.5,
      system: systemPrompt,
      messages,
    }),
    signal: controller.signal,
  });
} catch (err) {
  clearTimeout(timer);
  console.error(`[recover] fetch falló: ${err.message}`);
  process.exit(1);
}
clearTimeout(timer);

const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
console.error(`[recover] respuesta en ${elapsedSec}s · status ${response.status}`);

if (!response.ok) {
  const body = await response.text();
  console.error(`[recover] Anthropic error ${response.status}: ${body}`);
  process.exit(1);
}

const data = await response.json();
const text = data?.content?.[0]?.text ?? '';

if (!text) {
  console.error('[recover] respuesta sin texto. Body completo:');
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

console.error(`[recover] tokens · input ${data.usage?.input_tokens} · output ${data.usage?.output_tokens}`);
console.error(`[recover] stop_reason: ${data.stop_reason}`);
if (data.stop_reason === 'max_tokens') {
  console.error('[recover] WARNING: reporte posiblemente truncado (stop_reason=max_tokens)');
}
console.error('');

// Extraer el bloque JSON del texto (puede venir con ```json ... ```).
const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) ?? text.match(/(\{[\s\S]+\})/);
const jsonStr = jsonMatch ? jsonMatch[1] : text;

let parsed;
try {
  parsed = JSON.parse(jsonStr);
} catch (err) {
  console.error(`[recover] JSON no parseable: ${err.message}`);
  console.error('[recover] Texto crudo guardado en report-raw.txt para revisar manualmente.');
  writeFileSync('report-raw.txt', text);
  process.exit(1);
}

// Salida al stdout · JSON del reporte listo para consumir
process.stdout.write(JSON.stringify(parsed, null, 2) + '\n');
console.error('[recover] OK · reporte parseado correctamente.');
