-- Candados con vencimiento para tareas del worker solca-vacantes (25 nov 2026).
-- Evita que un reprocesar manual (/run?modo=reprocesar) corra a la vez que el cron diario.
-- El worker toma el candado con DELETE del vencido + INSERT OR IGNORE y lo suelta al terminar.
CREATE TABLE IF NOT EXISTS candados (
  nombre TEXT PRIMARY KEY,   -- tarea (ej. 'reprocesar')
  dueno TEXT NOT NULL,       -- id aleatorio de quien lo tomó
  hasta TEXT NOT NULL        -- vence (ISO); pasado este momento, otro lo puede tomar
);
