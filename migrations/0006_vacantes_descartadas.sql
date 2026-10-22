-- Vacantes que el lector revisó y descartó (sin país objetivo en el detalle), para no
-- volver a pedir su detalle cada día (revisión independiente, 22 oct 2026).
CREATE TABLE IF NOT EXISTS vacantes_descartadas (
  id TEXT PRIMARY KEY,
  fuente TEXT NOT NULL,
  ts TEXT NOT NULL,
  motivo TEXT NOT NULL
);
