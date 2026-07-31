-- Solca · Simulador de Entrevistas
-- Migration 0002 · Tabla beta_feedback para encuesta post-reporte
-- 19 jun 2026 · Fase 1.5.H
--
-- Aplicar con:
--   npx wrangler d1 migrations apply SIMULATOR_METRICS_DB --remote

CREATE TABLE IF NOT EXISTS beta_feedback (
  -- Identidad
  session_id TEXT PRIMARY KEY,
  submitted_at INTEGER NOT NULL,  -- unix epoch ms

  -- Escalas 1-5 (NULL = no respondió esa pregunta · todas opcionales)
  realismo INTEGER,         -- "¿Qué tan realista..."
  utilidad INTEGER,         -- "¿El feedback fue útil..."
  facilidad INTEGER,        -- "¿Qué tan fácil fue usar la herramienta..."

  -- Texto libre (max 280 chars · NULL = no respondió)
  sorpresa TEXT,
  mejora TEXT,

  -- Disposición a pagar (enum semántico)
  -- Valores válidos: 'basico_149' | 'intensivo_349' | 'menos_de_99' | 'solo_gratis' | 'no_pagaria'
  -- NULL = no respondió
  pago_disposicion TEXT,

  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_submitted ON beta_feedback(submitted_at);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_pago ON beta_feedback(pago_disposicion);
