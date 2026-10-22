-- Descriptores de cada vacante extraídos de la descripción (22 oct 2026).
-- Reglas en src/lib/vacantes-descriptores.ts; se recalculan si cambia descriptores_version.
ALTER TABLE vacantes ADD COLUMN idioma_anuncio TEXT;        -- es | en | pt
ALTER TABLE vacantes ADD COLUMN ingles TEXT;                -- no_mencionado | mencionado | basico | intermedio | avanzado | nativo
ALTER TABLE vacantes ADD COLUMN grado_min TEXT;             -- licenciatura | maestria | doctorado (el más bajo que acepta)
ALTER TABLE vacantes ADD COLUMN anios_min INTEGER;          -- años mínimos de experiencia mencionados
ALTER TABLE vacantes ADD COLUMN contrato TEXT;              -- temporal | freelance | practicas | NULL (no lo dice)
ALTER TABLE vacantes ADD COLUMN sponsor_dedicado INTEGER;   -- CRO: dedicado a un solo cliente / FSP
ALTER TABLE vacantes ADD COLUMN inclusion INTEGER;          -- convocatoria de inclusión (PcD, diversidad)
ALTER TABLE vacantes ADD COLUMN descriptores_version TEXT;

-- Etiquetas múltiples por vacante: idiomas, grados, áreas terapéuticas y herramientas.
CREATE TABLE IF NOT EXISTS vacantes_etiquetas (
  vacante_id TEXT NOT NULL,
  tipo TEXT NOT NULL,     -- idioma | grado | area_terapeutica | herramienta
  valor TEXT NOT NULL,
  PRIMARY KEY (vacante_id, tipo, valor)
);
CREATE INDEX IF NOT EXISTS idx_vac_etiquetas_tipo ON vacantes_etiquetas (tipo, valor);
