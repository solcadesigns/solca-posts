#!/usr/bin/env node
/**
 * Prueba offline del cuerpo de /v1/messages por modelo y del respaldo Haiku 5.5 → 4.5 · 6 nov 2026.
 * No llama a Anthropic: `fetch` se reemplaza por respuestas falsas.
 *
 * Uso: node scripts/test-anthropic-body.mjs   (Node 22.18+ o 24: importa el .ts sin compilar)
 */
import assert from 'node:assert/strict';
import {
  construirCuerpo,
  chatCompletion,
  retryableChatCompletion,
  debeUsarRespaldo,
  extractText,
  AnthropicError,
  AnthropicRefusalError,
  HAIKU,
  HAIKU_RESPALDO,
  RESPALDO_MIN_MS,
} from '../src/lib/anthropic.ts';
import { CV_REVIEW_JSON_SCHEMA, CRITERIOS } from '../src/lib/cv-review-rubric.ts';

let ok = 0;
const t = async (name, fn) => {
  await fn();
  ok++;
  console.log(`ok · ${name}`);
};

const SCHEMA = { type: 'object', additionalProperties: false, required: ['a'], properties: { a: { type: 'string' } } };
const base = {
  apiKey: 'test',
  model: HAIKU,
  system: 'sys',
  messages: [{ role: 'user', content: 'hola' }],
  temperature: 0.3,
  prefill: '{',
  maxTokens: 12000,
  maxTokensRespaldo: 7000,
  effort: 'low',
  thinking: 'adaptive',
  jsonSchema: SCHEMA,
};

// ── Cuerpo por modelo ───────────────────────────────────────────────────────────────────────────

await t('Haiku 5.5: sin temperature/top_p/top_k ni prefill; effort, thinking y esquema presentes', () => {
  const b = construirCuerpo(base);
  assert.equal(b.model, 'claude-haiku-5-5');
  for (const k of ['temperature', 'top_p', 'top_k']) assert.ok(!(k in b), `no debe llevar ${k}`);
  assert.equal(b.messages.length, 1);
  assert.equal(b.messages.at(-1).role, 'user');
  assert.deepEqual(b.thinking, { type: 'adaptive' });
  assert.equal(b.output_config.effort, 'low');
  assert.deepEqual(b.output_config.format, { type: 'json_schema', schema: SCHEMA });
  assert.equal(b.max_tokens, 12000);
});

await t('Haiku 5.5: thinking disabled y effort default low', () => {
  const b = construirCuerpo({ ...base, thinking: 'disabled', effort: undefined, jsonSchema: undefined });
  assert.deepEqual(b.thinking, { type: 'disabled' });
  assert.deepEqual(b.output_config, { effort: 'low' });
});

await t('Default sin model = Haiku 5.5', () => {
  const { model, ...sinModelo } = base;
  assert.equal(construirCuerpo(sinModelo).model, HAIKU);
});

await t('Respaldo Haiku 4.5: temperature y prefill de antes, max_tokens de antes, sin effort ni esquema', () => {
  const b = construirCuerpo(base, HAIKU_RESPALDO);
  assert.equal(b.model, 'claude-haiku-4-5');
  assert.equal(b.temperature, 0.3);
  assert.deepEqual(b.messages.at(-1), { role: 'assistant', content: '{' });
  assert.equal(b.max_tokens, 7000);
  assert.ok(!('output_config' in b) && !('thinking' in b));
});

await t('Sonnet 5.5 sin cambios: between_tools, sin temperature ni effort', () => {
  const b = construirCuerpo({ ...base, model: 'claude-sonnet-5-5', prefill: undefined, jsonSchema: undefined });
  assert.deepEqual(b.thinking, { type: 'between_tools' });
  assert.ok(!('temperature' in b) && !('output_config' in b));
  assert.equal(b.max_tokens, 12000);
});

await t('cacheSystem sigue armando el system con cache_control', () => {
  const b = construirCuerpo({ ...base, cacheSystem: true });
  assert.equal(b.system[0].cache_control.type, 'ephemeral');
});

// ── Respaldo y rechazos con fetch falso ─────────────────────────────────────────────────────────

const realFetch = globalThis.fetch;
const realWarn = console.warn;
function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const r = responses[calls.length - 1];
    return new Response(JSON.stringify(r.body), { status: r.status, statusText: String(r.status) });
  };
  return calls;
}
const okMsg = (model, content, extra = {}) => ({
  status: 200,
  body: { id: 'm', type: 'message', role: 'assistant', model, content, stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 2 }, ...extra },
});
const logs = [];
console.warn = (...a) => logs.push(a.join(' '));

try {
  await t('5.5 responde bien: una sola llamada, texto leído por tipo (ignora thinking)', async () => {
    const calls = mockFetch([okMsg('claude-haiku-5-5', [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: '{"a":"b"}' }])]);
    const r = await chatCompletion(base);
    assert.equal(calls.length, 1);
    assert.equal(r.prefill, undefined);
    assert.equal(r.respaldo, undefined);
    assert.equal((r.prefill ?? '') + extractText(r), '{"a":"b"}');
  });

  await t('5.5 responde 400: respaldo a 4.5 con prefill, log [anthropic-fallback] y modelo registrado', async () => {
    logs.length = 0;
    const calls = mockFetch([
      { status: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'x' } } },
      okMsg('claude-haiku-4-5-20251001', [{ type: 'text', text: '"a":"b"}' }]),
    ]);
    const r = await chatCompletion(base);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].model, 'claude-haiku-4-5');
    assert.equal(calls[1].temperature, 0.3);
    assert.equal(calls[1].max_tokens, 7000);
    assert.equal(r.respaldo, true);
    assert.equal(r.model, 'claude-haiku-4-5-20251001');
    assert.equal(r.prefill + extractText(r), '{"a":"b"}');
    assert.equal(r.statusRespaldo, 400);
    assert.ok(logs.some((l) => l.includes('[anthropic-fallback]')));
  });

  await t('5.5 responde 529: también entra el respaldo', async () => {
    const calls = mockFetch([{ status: 529, body: 'overloaded' }, okMsg('claude-haiku-4-5', [{ type: 'text', text: 'x' }])]);
    await chatCompletion({ ...base, prefill: undefined });
    assert.equal(calls.length, 2);
  });

  await t('402 (saldo) no usa respaldo: el kill switch ve el status original', async () => {
    const calls = mockFetch([{ status: 402, body: {} }]);
    await assert.rejects(chatCompletion(base), (e) => e instanceof AnthropicError && e.status === 402);
    assert.equal(calls.length, 1);
  });

  await t('Si falla también el respaldo, se lanza su error', async () => {
    mockFetch([{ status: 500, body: {} }, { status: 503, body: {} }]);
    await assert.rejects(chatCompletion(base), (e) => e instanceof AnthropicError && e.status === 503);
  });

  await t('Sin tiempo restante no hay respaldo (mínimo 12 s)', () => {
    assert.equal(RESPALDO_MIN_MS, 12000);
    assert.equal(debeUsarRespaldo(base, new AnthropicError(524, 't', 'client_timeout'), 1000), false);
    assert.equal(debeUsarRespaldo(base, new AnthropicError(500, 't'), 11000), false);
    assert.equal(debeUsarRespaldo(base, new AnthropicError(500, 't'), 20000), true);
    assert.equal(debeUsarRespaldo({ ...base, model: 'claude-sonnet-5-5' }, new AnthropicError(500, 't'), 20000), false);
  });

  await t('stop_reason refusal: error AnthropicRefusalError (status 200), sin respaldo ni reintento', async () => {
    const calls = mockFetch([okMsg('claude-haiku-5-5', [], { stop_reason: 'refusal', stop_details: { category: 'general_harms' } })]);
    await assert.rejects(
      retryableChatCompletion(base, 'test', 3),
      (e) => e instanceof AnthropicRefusalError && e.status === 200 && e.codigo === 'refusal' && e.category === 'general_harms',
    );
    assert.equal(calls.length, 1);
  });

  await t('Sonnet 5.5 rechaza también se etiqueta como refusal', async () => {
    mockFetch([okMsg('claude-sonnet-5-5', [], { stop_reason: 'refusal' })]);
    await assert.rejects(
      retryableChatCompletion({ ...base, model: 'claude-sonnet-5-5' }, 'init', 1),
      (e) => e instanceof AnthropicRefusalError && !/API error/.test(e.message),
    );
  });

  await t('Sin respaldo a Sonnet 4.5 (11 nov 2026): un 400 de Sonnet 5.5 se propaga y no hay segunda llamada', async () => {
    const calls = mockFetch([{ status: 400, body: {} }, okMsg('claude-sonnet-4-5-20250929', [{ type: 'text', text: 'hola' }])]);
    await assert.rejects(retryableChatCompletion({ ...base, model: 'claude-sonnet-5-5', prefill: undefined, jsonSchema: undefined }, 'init', 1));
    assert.equal(calls.length, 1);
  });

  await t('Sonnet 5.5 sin respaldo: respaldo indefinido (se registra como false)', async () => {
    mockFetch([okMsg('claude-sonnet-5-5', [{ type: 'text', text: 'hola' }])]);
    const r = await retryableChatCompletion({ ...base, model: 'claude-sonnet-5-5', prefill: undefined, jsonSchema: undefined }, 'init', 1);
    assert.equal(Boolean(r.respaldo), false);
  });
} finally {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
}

// ── Esquema del revisor de CV ───────────────────────────────────────────────────────────────────

await t('CV_REVIEW_JSON_SCHEMA: additionalProperties false en todo objeto y sin restricciones no admitidas', () => {
  const prohibidas = ['minimum', 'maximum', 'multipleOf', 'minLength', 'maxLength', 'minItems', 'maxItems'];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === 'object') {
      assert.equal(n.additionalProperties, false);
      assert.deepEqual([...n.required].sort(), Object.keys(n.properties).sort());
    }
    for (const k of prohibidas) assert.ok(!(k in n), `no admitido: ${k}`);
    Object.values(n).forEach(walk);
  };
  walk(CV_REVIEW_JSON_SCHEMA);
  assert.deepEqual(Object.keys(CV_REVIEW_JSON_SCHEMA.properties).at(-2), 'observaciones');
  assert.ok(CRITERIOS.length > 0);
});

console.log(`\n${ok} pruebas OK`);
