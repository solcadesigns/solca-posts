-- Calidad de datos del buscador de vacantes (auditoría independiente, 22 oct 2026).
-- Ver _docs/VACANTES_BUSCADOR.md, sección "Reglas para que el dato sea defendible".
ALTER TABLE vacantes ADD COLUMN pais_principal_iso TEXT;    -- país de la ubicación principal según el portal (ISO-2, minúsculas)
ALTER TABLE vacantes ADD COLUMN es_principal INTEGER;       -- 1 si la ubicación principal está en un país objetivo; 0 si solo una ubicación adicional
ALTER TABLE vacantes ADD COLUMN n_ubicaciones INTEGER;      -- ubicación principal + adicionales
ALTER TABLE vacantes ADD COLUMN cohorte_inicial INTEGER NOT NULL DEFAULT 0; -- 1 = ya estaba publicada en la primera lectura de su fuente
ALTER TABLE vacantes ADD COLUMN tipo_publicacion TEXT;      -- vacante | banco_talento
ALTER TABLE vacantes ADD COLUMN grupo_dup TEXT;             -- huella de fuente + título + descripción: plazas múltiples de la misma oferta
ALTER TABLE vacantes ADD COLUMN id_llave TEXT;              -- req (número de requisición) | ruta
ALTER TABLE vacantes ADD COLUMN cerrada_en TEXT;            -- momento (ISO) en que el lector la marcó cerrada

-- Todo lo cargado hasta hoy es la cohorte inicial: ya estaba publicado cuando empezamos a leer.
UPDATE vacantes SET cohorte_inicial = 1;
UPDATE vacantes SET id_llave = CASE WHEN id LIKE '%/job/%' THEN 'ruta' ELSE 'req' END;

-- Historial de cada vacante: alta, cierre, reapertura y cambio de título. Permite reconstruir
-- cualquier periodo pasado aunque una vacante se reabra o se reclasifique.
CREATE TABLE IF NOT EXISTS vacantes_ciclo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vacante_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  evento TEXT NOT NULL,   -- alta | cierre | reapertura | cambio_titulo
  valor TEXT
);
CREATE INDEX IF NOT EXISTS idx_vac_ciclo ON vacantes_ciclo (vacante_id, ts);
CREATE INDEX IF NOT EXISTS idx_vac_ciclo_evento ON vacantes_ciclo (evento, ts);

-- Foto diaria agregada (después de cada corrida). Congela lo que había cada día con la versión de reglas vigente.
CREATE TABLE IF NOT EXISTS vacantes_diario (
  fecha TEXT NOT NULL,
  fuente TEXT NOT NULL,
  pais TEXT NOT NULL,
  rol TEXT NOT NULL,
  nivel TEXT NOT NULL,
  activas INTEGER NOT NULL,
  activas_principal INTEGER NOT NULL,   -- solo con ubicación principal en ese país
  reglas TEXT NOT NULL,                 -- clasificacion_version/descriptores_version
  PRIMARY KEY (fecha, fuente, pais, rol, nivel)
);
