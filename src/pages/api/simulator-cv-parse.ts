/**
 * Endpoint de extracción estructurada de CV para el Simulador.
 * Fase 1.3 · 16 jun 2026.
 *
 * Recibe: { cvText: string } · el texto plano del CV (cliente lo extrajo con PDF.js)
 * Devuelve: { ok: true, cvSummary: CvSummary } o { ok: false, error }
 *
 * Modelo: Haiku 5.5 desde el 6 nov 2026 (antes Haiku 4.5), con respaldo temporal a 4.5 en lib/anthropic.ts.
 *
 * Privacidad:
 *  - El CV completo NUNCA se guarda en KV.
 *  - Solo el resumen estructurado se devuelve al cliente.
 *  - El cliente decide qué hacer con el resumen (típicamente lo pasa al init de la sesión).
 */

import type { APIRoute } from 'astro';
import { chatCompletion, extractText, AnthropicError, AnthropicRefusalError, HAIKU } from '../../lib/anthropic';
import { CV_PARSE_SYSTEM_PROMPT, buildCvParseUserMessage } from '../../lib/cv-parse-prompt';
import type { CvSummary } from '../../lib/simulator-types';
import { registrarModeloD1 } from '../../lib/eventos-d1';
import { esBanderaInterna } from '../../lib/simulator-test-sessions';

export const prerender = false;

// 6 nov 2026: Haiku 4.5 → Haiku 5.5. Extracción simple: pensamiento apagado (disabled, válido con effort low)
// para no sumar latencia al inicio de la sesión. Sin temperature (400 en 5.5); el JSON lo fija el esquema.
// max_tokens 2000 → 2600 por el tokenizer nuevo (~30% más tokens; sin pensamiento no hace falta más).
const MODEL = HAIKU;
const TEMPERATURE = 0.1; // solo para el respaldo a Haiku 4.5 (determinista para extracción)
const MAX_TOKENS = 2600;
const MAX_TOKENS_RESPALDO = 2000;

const listaDeTexto = { type: 'array', items: { type: 'string' } };
/** Esquema de salidas estructuradas con la forma que pide CV_PARSE_SYSTEM_PROMPT (6 nov 2026). */
const CV_PARSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'formacion',
    'experiencia',
    'tecnicas',
    'areas_tematicas',
    'publicaciones_count',
    'idiomas_declarados',
    'gaps_visibles',
    'fortalezas_pharma_evidentes',
  ],
  properties: {
    formacion: { type: 'string' },
    experiencia: listaDeTexto,
    tecnicas: listaDeTexto,
    areas_tematicas: listaDeTexto,
    publicaciones_count: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    idiomas_declarados: listaDeTexto,
    gaps_visibles: listaDeTexto,
    fortalezas_pharma_evidentes: listaDeTexto,
  },
};

interface ParseRequest {
  cvText: string;
  // 6 nov 2026: bandera interna (?interno=1) para marcar el evento llm_modelo como prueba.
  interno?: boolean;
}

interface ParseResponse {
  ok: boolean;
  cvSummary?: CvSummary;
  error?: string;
}

function jsonResponse(data: ParseResponse, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * Extrae el primer JSON válido del texto de respuesta del modelo.
 * Haiku a veces puede agregar texto antes/después aunque le pidamos no hacerlo.
 */
function extractJsonFromText(text: string): unknown | null {
  // Busca el primer { y el último } balanceado
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  const jsonStr = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Normaliza el JSON extraído al shape CvSummary.
 * Si algún campo no viene, le da defaults seguros.
 */
function normalizeCvSummary(raw: Record<string, unknown>): CvSummary {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  return {
    formacion: typeof raw.formacion === 'string' ? raw.formacion : '',
    experiencia: arr(raw.experiencia),
    tecnicas: arr(raw.tecnicas),
    areasTematicas: arr(raw.areas_tematicas ?? raw.areasTematicas),
    publicacionesCount:
      typeof raw.publicaciones_count === 'number'
        ? raw.publicaciones_count
        : typeof raw.publicacionesCount === 'number'
          ? raw.publicacionesCount
          : null,
    idiomasDeclarados: arr(raw.idiomas_declarados ?? raw.idiomasDeclarados),
    gapsVisibles: arr(raw.gaps_visibles ?? raw.gapsVisibles),
    fortalezasPharmaEvidentes: arr(
      raw.fortalezas_pharma_evidentes ?? raw.fortalezasPharmaEvidentes,
    ),
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime;
  const env = runtime?.env ?? {};
  const apiKey = env.ANTHROPIC_API_KEY as string | undefined;

  if (!apiKey) {
    return jsonResponse(
      { ok: false, error: 'ANTHROPIC_API_KEY no configurada' },
      500,
    );
  }

  let body: ParseRequest;
  try {
    body = (await request.json()) as ParseRequest;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const cvText = (body.cvText || '').trim();
  if (cvText.length < 50) {
    return jsonResponse(
      { ok: false, error: 'CV demasiado corto. Sube un PDF con al menos 50 caracteres de texto.' },
      400,
    );
  }
  if (cvText.length > 50000) {
    return jsonResponse(
      { ok: false, error: 'CV demasiado largo. Sube un PDF de hasta 50000 caracteres.' },
      400,
    );
  }

  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  const t0 = Date.now();
  try {
    const response = await chatCompletion({
      apiKey,
      model: MODEL,
      system: CV_PARSE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildCvParseUserMessage(cvText) }],
      effort: 'low',
      thinking: 'disabled',
      jsonSchema: CV_PARSE_JSON_SCHEMA,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      maxTokensRespaldo: MAX_TOKENS_RESPALDO,
    });
    if (response.respaldo) console.warn('[simulator-cv-parse] respondió el respaldo', response.model);
    // 6 nov 2026: evento llm_modelo en D1 (sin texto del CV).
    await registrarModeloD1(db, {
      ruta: 'cv_parse',
      esPrueba: esBanderaInterna(body.interno),
      ok: true,
      modeloPedido: MODEL,
      modelo: response.model,
      respaldo: Boolean(response.respaldo),
      statusRespaldo: response.statusRespaldo,
      outputTokens: response.usage?.output_tokens,
      ms: Date.now() - t0,
    });

    const rawText = extractText(response);
    const parsedJson = extractJsonFromText(rawText);
    if (!parsedJson || typeof parsedJson !== 'object') {
      console.error('No JSON in CV parse response. Raw:', rawText.slice(0, 500));
      return jsonResponse(
        { ok: false, error: 'No se pudo extraer JSON del CV. Intenta de nuevo.' },
        500,
      );
    }

    const cvSummary = normalizeCvSummary(parsedJson as Record<string, unknown>);
    return jsonResponse({ ok: true, cvSummary });
  } catch (err) {
    if (err instanceof AnthropicError) {
      await registrarModeloD1(db, {
        ruta: 'cv_parse',
      esPrueba: esBanderaInterna(body.interno),
        ok: false,
        modeloPedido: MODEL,
        error: err instanceof AnthropicRefusalError ? 'refusal' : err.status,
        ms: Date.now() - t0,
      });
    }
    if (err instanceof AnthropicRefusalError) {
      console.error('Anthropic refusal in cv-parse:', err.body);
      return jsonResponse({ ok: false, error: 'No se pudo analizar el CV. Intenta de nuevo.' }, 502);
    }
    if (err instanceof AnthropicError) {
      console.error('Anthropic error in cv-parse:', err.status, err.body);
      return jsonResponse({ ok: false, error: `Anthropic API error ${err.status}` }, 502);
    }
    console.error('simulator-cv-parse error:', err);
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500);
  }
};
