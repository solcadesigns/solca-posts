/**
 * Writer compartido a D1 para métricas del simulador.
 * Fase 1.4.1 · 16 jun 2026.
 *
 * Usado por:
 *  - /api/simulator-session.ts (al cierre de sesión, escritura automática)
 *  - /api/simulator-metrics.ts (escritura desde cliente, p. ej. demográficos posteriores)
 *
 * Tabla principal: sessions (un row por session_id)
 * Tabla auxiliar: session_tags (multivaluados: técnicas, vocab, gaps, preguntas reprobadas)
 *
 * Operación idempotente: ON CONFLICT actualiza, y los tags se borran-reinsertan.
 */

import type { MetricsAnonymous } from './simulator-types';

export interface WriteMetricsInput {
  sessionId: string;
  metrics: MetricsAnonymous;
  hasCvSummary?: boolean;
  // Demográficos opcionales · típicamente vienen en una segunda llamada
  edadRango?: string | null;
  genero?: string | null;
}

export async function writeMetricsToD1(
  db: D1Database,
  body: WriteMetricsInput,
): Promise<void> {
  const m = body.metrics;
  const tsEpoch = new Date(m.ts).getTime();

  const upsert = `
    INSERT INTO sessions (
      session_id, ts,
      area_formacion, anios_experiencia, pais_inferido, rol_apuntado,
      idioma, etapa, numero_preguntas, focus,
      sesion_duracion_total_seg, respuesta_promedio_seg,
      score_tecnico, score_estructura, score_especificidad,
      alertas_count, rol_y_match,
      completed, has_cv_summary,
      edad_rango, genero, demographics_submitted_at
    ) VALUES (
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      1, ?,
      ?, ?, ?
    )
    ON CONFLICT(session_id) DO UPDATE SET
      area_formacion=excluded.area_formacion,
      rol_apuntado=excluded.rol_apuntado,
      score_tecnico=excluded.score_tecnico,
      score_estructura=excluded.score_estructura,
      score_especificidad=excluded.score_especificidad,
      alertas_count=excluded.alertas_count,
      rol_y_match=excluded.rol_y_match,
      sesion_duracion_total_seg=excluded.sesion_duracion_total_seg,
      respuesta_promedio_seg=excluded.respuesta_promedio_seg,
      completed=1,
      has_cv_summary=excluded.has_cv_summary,
      edad_rango=COALESCE(excluded.edad_rango, edad_rango),
      genero=COALESCE(excluded.genero, genero),
      demographics_submitted_at=COALESCE(excluded.demographics_submitted_at, demographics_submitted_at);
  `;

  const demographicsSubmittedAt =
    body.edadRango || body.genero ? Date.now() : null;

  await db
    .prepare(upsert)
    .bind(
      body.sessionId,
      tsEpoch,
      m.areaFormacion,
      m.aniosExperiencia,
      m.paisInferido,
      m.rolApuntado,
      m.idioma,
      m.etapa,
      m.numeroPreguntas,
      m.focus,
      m.sesionDuracionTotalSeg,
      m.respuestaPromedioSeg,
      m.scorePromedioPorDimension.tecnico,
      m.scorePromedioPorDimension.estructura,
      m.scorePromedioPorDimension.especificidad,
      m.alertasCount,
      m.rolYMatch,
      body.hasCvSummary ? 1 : 0,
      body.edadRango ?? null,
      body.genero ?? null,
      demographicsSubmittedAt,
    )
    .run();

  // Tags multivaluados: borrar previos y reinsertar (idempotente)
  await db
    .prepare('DELETE FROM session_tags WHERE session_id = ?')
    .bind(body.sessionId)
    .run();

  const tagInserts: Array<{ type: string; values: string[] }> = [
    { type: 'tecnica', values: m.tecnicasAcademicasMencionadas },
    { type: 'vocab_uso_bien', values: m.vocabularioPharmaQueUsoBien },
    { type: 'vocab_ausente', values: m.vocabularioPharmaAusente },
    { type: 'gap', values: m.gapsDetectados },
    { type: 'pregunta_reprobada', values: m.preguntasQueReprobaron },
  ];

  const stmts: D1PreparedStatement[] = [];
  const tagInsertSql =
    'INSERT INTO session_tags (session_id, tag_type, tag_value) VALUES (?, ?, ?)';
  for (const { type, values } of tagInserts) {
    for (const value of values) {
      if (!value || typeof value !== 'string') continue;
      stmts.push(db.prepare(tagInsertSql).bind(body.sessionId, type, value));
    }
  }

  if (stmts.length > 0) {
    await db.batch(stmts);
  }
}

/**
 * Update parcial: solo demográficos. Asume que la sesión ya existe en D1.
 * Usado por el flow de micro-encuesta post-feedback (Fase 1.4.3).
 */
export async function updateDemographicsInD1(
  db: D1Database,
  sessionId: string,
  edadRango: string | null,
  genero: string | null,
): Promise<void> {
  if (!edadRango && !genero) return;

  await db
    .prepare(
      `UPDATE sessions
       SET edad_rango = COALESCE(?, edad_rango),
           genero = COALESCE(?, genero),
           demographics_submitted_at = COALESCE(demographics_submitted_at, ?)
       WHERE session_id = ?`,
    )
    .bind(edadRango, genero, Date.now(), sessionId)
    .run();
}
