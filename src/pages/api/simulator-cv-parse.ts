/**
 * Endpoint de extracción estructurada de CV para el Simulador.
 * Fase 1.3 · 16 jun 2026.
 *
 * Recibe: { cvText: string } · el texto plano del CV (cliente lo extrajo con PDF.js)
 * Devuelve: { ok: true, cvSummary: CvSummary } o { ok: false, error }
 *
 * Modelo: Haiku 4.5 (más barato y suficiente para extracción).
 *
 * Privacidad:
 *  - El CV completo NUNCA se guarda en KV.
 *  - Solo el resumen estructurado se devuelve al cliente.
 *  - El cliente decide qué hacer con el resumen (típicamente lo pasa al init de la sesión).
 */

import type { APIRoute } from 'astro';
import { chatCompletion, extractText, AnthropicError } from '../../lib/anthropic';
import { CV_PARSE_SYSTEM_PROMPT, buildCvParseUserMessage } from '../../lib/cv-parse-prompt';
import type { CvSummary } from '../../lib/simulator-types';

export const prerender = false;

const MODEL = 'claude-haiku-4-5-20251001';
const TEMPERATURE = 0.1; // determinista para extracción
const MAX_TOKENS = 2000;

interface ParseRequest {
  cvText: string;
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

  try {
    const response = await chatCompletion({
      apiKey,
      model: MODEL,
      system: CV_PARSE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildCvParseUserMessage(cvText) }],
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
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
      console.error('Anthropic error in cv-parse:', err.status, err.body);
      return jsonResponse({ ok: false, error: `Anthropic API error ${err.status}` }, 502);
    }
    console.error('simulator-cv-parse error:', err);
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500);
  }
};
