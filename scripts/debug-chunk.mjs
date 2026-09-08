#!/usr/bin/env node
/**
 * debug-chunk.mjs · diagnóstico local del generador de chunks del reporte.
 *
 * Post-mortem 8 sept 2026: los chunks del cron fallaban silenciosamente
 * (JSON parse errors) y consumían tokens en reintentos. Este script hace UN
 * request controlado a Anthropic con el prompt del breakdown chunk, imprime
 * el output CRUDO tal como llega, e intenta parsearlo mostrando dónde falla.
 *
 * NO usa datos reales de sesión — usa una muestra fija de state.turns para
 * mantener el costo controlado (<$0.05 por corrida).
 *
 * Uso:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/debug-chunk.mjs [model]
 *
 * Modelos válidos:
 *   claude-haiku-4-5       (default · ~$0.02 por corrida)
 *   claude-sonnet-4-5      (~$0.05 por corrida)
 *
 * Sin ANTHROPIC_API_KEY el script no gasta nada — solo imprime el prompt.
 */

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.argv[2] ?? 'claude-haiku-4-5';

// ── Mock state con 3 preguntas (mínimo para test de breakdown) ──
const mockTurns = [
  {
    questionText:
      '¿Puedes contarme cómo estructuras el plan de un ensayo clínico Fase III desde la aprobación regulatoria hasta el primer paciente enrolado?',
    userAnswer:
      'Empiezo revisando el protocolo aprobado por regulatorio, luego mapeo los sitios candidatos y su feasibility. Coordino con CROs para site initiation visits, negocio contratos, y establezco los cronogramas de start-up. En paralelo trabajo con IRB/comités éticos locales. Métricas clave son time-to-first-patient-in y activation rate por región.',
    userAnswerSeconds: 82,
  },
  {
    questionText:
      'Describe una situación donde tuviste que negociar con un investigador principal sobre timelines apretados.',
    userAnswer:
      'En un estudio de oncología en México el PI se resistía a nuestro cronograma porque su equipo estaba saturado. Le propuse dividir el enrollment target entre 2 sitios de su red hospitalaria y ofrecí soporte adicional de CRA para reducir su carga administrativa. Cerramos con 60% del target original en su sitio principal y activamos el segundo en 4 semanas.',
    userAnswerSeconds: 95,
  },
  {
    questionText:
      'What KPIs do you track in a Phase III oncology trial and how do you escalate delays?',
    userAnswer:
      "Main KPIs: enrollment rate per site per month, protocol deviations count, query resolution time, and monitoring visit compliance. I use a weekly dashboard reviewed with the study manager. Delays escalate via a RAG status — red goes to global study lead within 24h, amber gets a mitigation plan in the next weekly call, green is BAU. For enrollment gaps I typically propose site-level interventions or additional site activations.",
    userAnswerSeconds: 110,
  },
];

// ── Prompt: reproducimos la esencia del breakdown chunk prompt ──
const systemPrompt = `Eres un simulador de entrevistas pharma que evalúa las respuestas del candidato.

═══════════════════════════════════════════════════════════════
CHUNK BREAKDOWN · preguntas 1 a 3 (test local)
═══════════════════════════════════════════════════════════════
En este turno devuelves SOLO el breakdown de las preguntas 1 a 3. NO devuelves summary. NO devuelves CTA. NO devuelves metrics_anonymous.

Formato JSON:
\`\`\`json
{
  "questions_breakdown": [
    {
      "question_number": 1,
      "question_text": "{texto exacto de la pregunta}",
      "user_answer": "{cita textual, ≤200 palabras}",
      "scores": {
        "tecnico": 3.5,
        "estructura": 3.0,
        "especificidad": 4.0,
        "alertas": "sin alertas | descripción específica"
      },
      "angle_used": "A | C | D | E",
      "what_worked": "1-2 frases concretas",
      "what_to_improve": "1-2 frases con sugerencia accionable",
      "model_phrase": "frase modelo del contenido literal, ≤30 palabras"
    }
  ]
}
\`\`\`

REGLAS:
- UNA entrada por cada pregunta del 1 al 3 (inclusive).
- "user_answer" es CITA TEXTUAL. Si fue muy largo, trunca con "..." al final pero conserva el inicio.
- "angle_used" rota A, C, D, E sin repetir dos veces seguidas.

Devuelve SOLO el JSON, sin texto adicional.`;

// ── Construir messages desde turns (idéntico a buildMessagesFromState del cron) ──
const messages = [];
for (const turn of mockTurns) {
  messages.push({ role: 'assistant', content: turn.questionText });
  const withTiming = `${turn.userAnswer}\n\n(Tiempo de respuesta: ${turn.userAnswerSeconds} segundos)`;
  messages.push({ role: 'user', content: withTiming });
}
messages.push({
  role: 'user',
  content:
    'Devuelve el JSON del BREAKDOWN de las preguntas 1 a 3. Solo questions_breakdown. Nada más.',
});

// ── Salida temprana si no hay API key: mostrar el prompt y salir ──
if (!apiKey) {
  console.log('\n=== SIN ANTHROPIC_API_KEY · imprimo el prompt para inspección ===\n');
  console.log('SYSTEM:\n' + systemPrompt);
  console.log('\nMESSAGES:');
  for (const m of messages) {
    console.log(`\n[${m.role}]\n${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`);
  }
  console.log('\n\nPara ejecutar realmente:');
  console.log('  ANTHROPIC_API_KEY=sk-ant-... node scripts/debug-chunk.mjs [model]\n');
  process.exit(0);
}

// ── Llamar Anthropic ──
console.log(`\n=== CALL A ANTHROPIC · modelo: ${model} ===\n`);
const start = Date.now();
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model,
    system: systemPrompt,
    messages,
    temperature: 0.5,
    max_tokens: 2500,
  }),
});
const durationMs = Date.now() - start;

console.log(`HTTP status: ${res.status} · duración: ${(durationMs / 1000).toFixed(2)}s\n`);

const bodyText = await res.text();

if (!res.ok) {
  console.error('=== ERROR HTTP ===');
  console.error(bodyText);
  process.exit(1);
}

let body;
try {
  body = JSON.parse(bodyText);
} catch (e) {
  console.error('=== ERROR: body no es JSON ===');
  console.error(bodyText);
  process.exit(1);
}

console.log('=== USAGE ===');
console.log(JSON.stringify(body.usage, null, 2));
console.log('\n=== STOP_REASON ===');
console.log(body.stop_reason);

// Costo aproximado
const inputTokens = body.usage?.input_tokens ?? 0;
const outputTokens = body.usage?.output_tokens ?? 0;
const pricing = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-4-5': { in: 3, out: 15 },
};
const price = pricing[model] ?? { in: 3, out: 15 };
const costUsd = (inputTokens * price.in) / 1_000_000 + (outputTokens * price.out) / 1_000_000;
console.log(`\n=== COSTO estimado: $${costUsd.toFixed(4)} USD ===`);

// ── Extraer texto ──
const textBlocks = (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text);
const fullText = textBlocks.join('');

console.log('\n=== OUTPUT CRUDO (primeros 3000 chars) ===');
console.log(fullText.slice(0, 3000));
if (fullText.length > 3000) console.log(`\n... [truncado, total ${fullText.length} chars]`);

// ── Intento de parse igual al del cron ──
console.log('\n=== INTENTO DE PARSE (mismo regex del cron) ===');
const jsonMatch = fullText.match(/```json\s*([\s\S]+?)\s*```/) ?? fullText.match(/(\{[\s\S]+\})/);
if (!jsonMatch) {
  console.error('✗ FAIL: el regex NO capturó ningún JSON');
  console.error('  El prompt debe pedir explícitamente formato ```json o { ... }');
  process.exit(1);
}

const jsonStr = jsonMatch[1];
console.log(`Regex capturó ${jsonStr.length} chars`);
console.log('Preview capturado:');
console.log(jsonStr.slice(0, 400));

try {
  const parsed = JSON.parse(jsonStr);
  console.log('\n✓ PARSE OK');
  console.log('Keys top-level:', Object.keys(parsed));
  if (parsed.questions_breakdown) {
    console.log(`questions_breakdown tiene ${parsed.questions_breakdown.length} entradas`);
    console.log('Primera entrada keys:', Object.keys(parsed.questions_breakdown[0] ?? {}));
  }
} catch (e) {
  console.error('\n✗ PARSE FAIL:', e.message);
  // Encontrar la posición del error
  const match = e.message.match(/position (\d+)/);
  if (match) {
    const pos = parseInt(match[1], 10);
    console.error(`Contexto alrededor del error (posición ${pos}):`);
    console.error(jsonStr.slice(Math.max(0, pos - 100), pos + 100));
  }
}

console.log('\n=== FIN DEL DIAGNÓSTICO ===\n');
