/**
 * Mapeo de métricas finales del camino ASYNC (reporte por chunks) → MetricsAnonymous.
 * 30 oct 2026.
 *
 * Usado por:
 *  - /api/simulator-process-pending.ts (al terminar el merge de chunks)
 *  - scripts/backfill-metricas-sesiones-async.mjs (respaldo de una sola vez)
 *
 * Función pura: no toca D1 ni KV. Solo `import type` para que Node pueda
 * importarla directo desde un .mjs (type stripping).
 *
 * Reglas (el chunk summary NO trae metrics_anonymous):
 *  - scores y alertas_count: del summary crudo; si faltan o no son número → NULL
 *    (no 0, para no sesgar promedios).
 *  - vocab_ausente: summary.vocabulario_a_incorporar (equivalente semántico).
 *  - rol_y_match, técnicas, vocab_uso_bien, gaps, preguntas reprobadas: no
 *    existen en async → NULL / sin tags.
 *  - tiempos, área y rol: se conservan los de la fila inicial de D1. Recalcular
 *    con Date.now() inflaría la duración con el tiempo en cola del cron.
 */

import type { MetricsAnonymous, SessionState } from './simulator-types';

/** Columnas de la fila inicial que se conservan. */
export interface ExistingSessionRow {
  area_formacion: string | null;
  rol_apuntado: string | null;
  sesion_duracion_total_seg: number | null;
  respuesta_promedio_seg: number | null;
}

export const EXISTING_SESSION_ROW_SQL =
  'SELECT area_formacion, rol_apuntado, sesion_duracion_total_seg, respuesta_promedio_seg FROM sessions WHERE session_id = ?';

/** true si el state trae un summary async utilizable. */
export function hasAsyncSummary(state: SessionState | null | undefined): boolean {
  const s = state?.finalReportChunks?.summary as unknown as { summary?: { scores?: unknown } } | undefined;
  return Boolean(s && s.summary && s.summary.scores && typeof s.summary.scores === 'object');
}

export function buildAsyncFinalMetrics(
  state: SessionState,
  existing: ExistingSessionRow | null,
): MetricsAnonymous {
  const raw = (state.finalReportChunks?.summary ?? {}) as unknown as {
    summary?: {
      scores?: Record<string, unknown>;
      vocabulario_a_incorporar?: unknown;
    };
  };
  const scores = raw.summary?.scores ?? {};
  const numOrNull = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const alertas = numOrNull(scores.alertas_count);
  const vocabRaw = raw.summary?.vocabulario_a_incorporar;
  const vocabAusente = Array.isArray(vocabRaw)
    ? vocabRaw
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter((x) => x.length > 0 && x.length <= 120)
        .slice(0, 30)
    : [];

  const profile = state.profile;
  const timings = (state.turns ?? [])
    .map((t) => t.userAnswerSeconds)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const respuestaPromedioFallback =
    timings.length > 0 ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : null;

  // Campos que la tabla/el writer aceptan como NULL aunque el tipo diga number/string.
  return {
    ts: state.startedAt,
    areaFormacion: existing?.area_formacion ?? profile.formationArea ?? '',
    aniosExperiencia: profile.experienceYears ?? '',
    paisInferido: null,
    rolApuntado: existing?.rol_apuntado ?? profile.role ?? 'Other',
    idioma: profile.language,
    etapa: profile.interviewStage ?? 'panel',
    numeroPreguntas: profile.questionCount,
    focus: profile.focus,
    sesionDuracionTotalSeg: existing ? existing.sesion_duracion_total_seg : null,
    respuestaPromedioSeg: existing ? existing.respuesta_promedio_seg : respuestaPromedioFallback,
    tecnicasAcademicasMencionadas: [],
    vocabularioPharmaQueUsoBien: [],
    vocabularioPharmaAusente: vocabAusente,
    gapsDetectados: [],
    scorePromedioPorDimension: {
      tecnico: numOrNull(scores.tecnico),
      estructura: numOrNull(scores.estructura),
      especificidad: numOrNull(scores.especificidad),
    },
    alertasCount: alertas === null ? null : Math.round(alertas),
    rolYMatch: null,
    preguntasQueReprobaron: [],
  } as unknown as MetricsAnonymous;
}
