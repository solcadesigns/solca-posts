-- Solca · Simulador de Entrevistas
-- Migration 0001 · Schema inicial de métricas (D1)
-- 16 jun 2026 · Fase 1.4.1
--
-- Aplicar con:
--   npx wrangler d1 migrations apply SIMULATOR_METRICS_DB --remote
-- Después de crear el binding D1 con:
--   npx wrangler d1 create simulator-metrics

CREATE TABLE IF NOT EXISTS sessions (
  -- Identidad
  session_id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,  -- unix epoch ms

  -- Perfil profesional anónimo
  area_formacion TEXT NOT NULL,
  anios_experiencia TEXT NOT NULL,
  pais_inferido TEXT,
  rol_apuntado TEXT NOT NULL,

  -- Configuración elegida por el usuario
  idioma TEXT NOT NULL,
  etapa TEXT NOT NULL,
  numero_preguntas INTEGER NOT NULL,
  focus TEXT NOT NULL,

  -- Tiempos
  sesion_duracion_total_seg INTEGER,
  respuesta_promedio_seg INTEGER,

  -- Scores
  score_tecnico REAL,
  score_estructura REAL,
  score_especificidad REAL,
  alertas_count INTEGER,
  rol_y_match TEXT,

  -- Estado de la sesión
  completed INTEGER NOT NULL DEFAULT 0,  -- 0 = abandonada, 1 = completada
  has_cv_summary INTEGER NOT NULL DEFAULT 0,

  -- Demográficos opcionales (post-sesión · Fase 1.4.3)
  edad_rango TEXT,
  genero TEXT,
  demographics_submitted_at INTEGER
);

-- Tabla auxiliar para arrays multivaluados
-- (técnicas, vocabulario, gaps, preguntas reprobadas)
CREATE TABLE IF NOT EXISTS session_tags (
  session_id TEXT NOT NULL,
  tag_type TEXT NOT NULL,  -- 'tecnica' | 'vocab_uso_bien' | 'vocab_ausente' | 'gap' | 'pregunta_reprobada'
  tag_value TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Índices para queries comunes
CREATE INDEX IF NOT EXISTS idx_sessions_ts ON sessions(ts);
CREATE INDEX IF NOT EXISTS idx_sessions_rol ON sessions(rol_apuntado);
CREATE INDEX IF NOT EXISTS idx_sessions_area ON sessions(area_formacion);
CREATE INDEX IF NOT EXISTS idx_sessions_completed ON sessions(completed);
CREATE INDEX IF NOT EXISTS idx_session_tags_lookup ON session_tags(session_id, tag_type);
CREATE INDEX IF NOT EXISTS idx_session_tags_value ON session_tags(tag_type, tag_value);
