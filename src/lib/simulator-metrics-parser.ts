/**
 * Parser robusto del texto que Claude devuelve al cierre de la sesión.
 * Fase 1.4.1 · 16 jun 2026.
 *
 * Claude devuelve DOS bloques JSON al cierre (per system prompt v0.7):
 *  1. Reporte expandido con summary + questions_breakdown + cta
 *  2. Métricas anónimas con shape MetricsAnonymous
 *
 * Esta función extrae ambos y los normaliza.
 */

import type { FinalReport, MetricsAnonymous } from './simulator-types';

export interface ParsedFinalOutput {
  finalReport: FinalReport | null;
  metricsAnonymous: MetricsAnonymous | null;
  rawText: string;
}

/**
 * Extrae todos los bloques JSON balanceados del texto, en orden de aparición.
 * Robusto a markdown fences (```json), texto previo y posterior.
 */
function extractAllJsonBlocks(text: string): unknown[] {
  const blocks: unknown[] = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('{', i);
    if (start === -1) break;
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;
    for (let j = start; j < text.length; j++) {
      const ch = text[j];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) break;
    const jsonStr = text.slice(start, end + 1);
    try {
      blocks.push(JSON.parse(jsonStr));
    } catch {
      // Skip invalid blocks, continue searching after the failed start
    }
    i = end + 1;
  }
  return blocks;
}

/**
 * Detecta si un objeto JSON parece ser un reporte final.
 */
function looksLikeFinalReport(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.session_id === 'string' ||
    (typeof o.rol === 'string' && typeof o.n_questions === 'number') ||
    (typeof o.summary === 'object' && o.summary !== null) ||
    Array.isArray(o.questions_breakdown)
  );
}

/**
 * Detecta si un objeto JSON parece ser métricas anónimas.
 */
function looksLikeMetrics(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (o.metrics_anonymous && typeof o.metrics_anonymous === 'object') return true;
  return (
    typeof o.area_formacion === 'string' &&
    typeof o.rol_apuntado === 'string' &&
    Array.isArray(o.vocabulario_pharma_ausente)
  );
}

/**
 * Normaliza el snake_case → camelCase del JSON de Claude al FinalReport.
 * Si falta algún campo, le da default seguro.
 */
function normalizeFinalReport(raw: unknown): FinalReport {
  const o = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const summary = (o.summary && typeof o.summary === 'object') ? (o.summary as Record<string, unknown>) : {};
  const summaryScores = (summary.scores && typeof summary.scores === 'object') ? (summary.scores as Record<string, unknown>) : {};
  const breakdownRaw = Array.isArray(o.questions_breakdown) ? o.questions_breakdown : [];
  const ctaRaw = (o.cta && typeof o.cta === 'object') ? (o.cta as Record<string, unknown>) : {};

  const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  const num = (v: unknown, def: number): number => typeof v === 'number' ? v : def;
  const str = (v: unknown, def: string): string => typeof v === 'string' ? v : def;

  return {
    sessionId: str(o.session_id, ''),
    rol: str(o.rol, 'No especificado'),
    nQuestions: num(o.n_questions, 0),
    summary: {
      scores: {
        tecnico: num(summaryScores.tecnico, 0),
        estructura: num(summaryScores.estructura, 0),
        especificidad: num(summaryScores.especificidad, 0),
        alertasCount: num(summaryScores.alertas_count ?? summaryScores.alertasCount, 0),
      },
      fortalezas: arr(summary.fortalezas),
      areasDeMejora: arr(summary.areas_de_mejora ?? summary.areasDeMejora),
      vocabularioAIncorporar: arr(summary.vocabulario_a_incorporar ?? summary.vocabularioAIncorporar),
      recomendacionFinal: str(summary.recomendacion_final ?? summary.recomendacionFinal, ''),
    },
    questionsBreakdown: breakdownRaw.map((entry) => {
      const e = (entry && typeof entry === 'object') ? (entry as Record<string, unknown>) : {};
      const es = (e.scores && typeof e.scores === 'object') ? (e.scores as Record<string, unknown>) : {};
      return {
        questionNumber: num(e.question_number ?? e.questionNumber, 0),
        questionText: str(e.question_text ?? e.questionText, ''),
        userAnswer: str(e.user_answer ?? e.userAnswer, ''),
        scores: {
          tecnico: num(es.tecnico, 0),
          estructura: num(es.estructura, 0),
          especificidad: num(es.especificidad, 0),
          alertas: str(es.alertas, 'sin alertas'),
        },
        angleUsed: (str(e.angle_used ?? e.angleUsed, 'A') as 'A' | 'C' | 'D' | 'E'),
        whatWorked: str(e.what_worked ?? e.whatWorked, ''),
        whatToImprove: str(e.what_to_improve ?? e.whatToImprove, ''),
        modelPhrase: str(e.model_phrase ?? e.modelPhrase, ''),
      };
    }),
    cta: {
      type: (str(ctaRaw.type, 'recurso_gratuito') as 'libro' | 'recurso_gratuito'),
      title: str(ctaRaw.title, ''),
      description: str(ctaRaw.description, ''),
      url: str(ctaRaw.url, '/revisar-cv'),
    },
  };
}

/**
 * Normaliza las métricas anónimas. Acepta tanto el wrapper {metrics_anonymous: ...}
 * como el objeto directo.
 */
function normalizeMetrics(raw: unknown): MetricsAnonymous {
  const wrapper = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const m = (wrapper.metrics_anonymous && typeof wrapper.metrics_anonymous === 'object')
    ? (wrapper.metrics_anonymous as Record<string, unknown>)
    : wrapper;
  const scores = (m.score_promedio_por_dimension && typeof m.score_promedio_por_dimension === 'object')
    ? (m.score_promedio_por_dimension as Record<string, unknown>)
    : {};

  const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  const num = (v: unknown, def: number): number => typeof v === 'number' ? v : def;
  const str = (v: unknown, def: string): string => typeof v === 'string' ? v : def;

  return {
    ts: str(m.ts, new Date().toISOString()),
    areaFormacion: str(m.area_formacion ?? m.areaFormacion, ''),
    aniosExperiencia: str(m.anios_experiencia ?? m.aniosExperiencia, ''),
    paisInferido: (typeof m.pais_inferido === 'string' ? m.pais_inferido : null) as string | null,
    rolApuntado: str(m.rol_apuntado ?? m.rolApuntado, 'Other'),
    idioma: (str(m.idioma, 'bilingue') as 'espanol' | 'bilingue' | 'ingles'),
    etapa: (str(m.etapa, 'general_practice') as 'phone_screen' | 'technical_round' | 'panel_round' | 'general_practice'),
    numeroPreguntas: (num(m.numero_preguntas, 10) as 5 | 10 | 15),
    focus: (str(m.focus, 'mezcla') as 'tecnico' | 'conductual' | 'mezcla'),
    sesionDuracionTotalSeg: num(m.sesion_duracion_total_seg, 0),
    respuestaPromedioSeg: num(m.respuesta_promedio_seg, 0),
    tecnicasAcademicasMencionadas: arr(m.tecnicas_academicas_mencionadas ?? m.tecnicasAcademicasMencionadas),
    vocabularioPharmaQueUsoBien: arr(m.vocabulario_pharma_que_uso_bien ?? m.vocabularioPharmaQueUsoBien),
    vocabularioPharmaAusente: arr(m.vocabulario_pharma_ausente ?? m.vocabularioPharmaAusente),
    gapsDetectados: arr(m.gaps_detectados ?? m.gapsDetectados),
    scorePromedioPorDimension: {
      tecnico: num(scores.tecnico, 0),
      estructura: num(scores.estructura, 0),
      especificidad: num(scores.especificidad, 0),
    },
    alertasCount: num(m.alertas_count ?? m.alertasCount, 0),
    rolYMatch: (str(m.rol_y_match ?? m.rolYMatch, 'medio') as 'alto' | 'medio' | 'bajo'),
    preguntasQueReprobaron: arr(m.preguntas_que_reprobaron ?? m.preguntasQueReprobaron),
  };
}

/**
 * Función principal. Extrae los dos bloques JSON del texto de Claude.
 */
export function parseFinalOutput(rawText: string): ParsedFinalOutput {
  const blocks = extractAllJsonBlocks(rawText);
  let finalReport: FinalReport | null = null;
  let metricsAnonymous: MetricsAnonymous | null = null;

  for (const block of blocks) {
    if (!metricsAnonymous && looksLikeMetrics(block)) {
      metricsAnonymous = normalizeMetrics(block);
      continue;
    }
    if (!finalReport && looksLikeFinalReport(block)) {
      finalReport = normalizeFinalReport(block);
      continue;
    }
  }

  return { finalReport, metricsAnonymous, rawText };
}
