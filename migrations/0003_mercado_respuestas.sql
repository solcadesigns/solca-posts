-- Encuesta de mercado unificada · catálogo v1 (20 oct 2026).
-- Una fila por respuesta. Sin correo, nombre, IP ni texto libre.
-- Diseño: _docs/CATALOGO_ENCUESTA_MERCADO.md · catálogo: src/lib/market-catalog.ts.
CREATE TABLE IF NOT EXISTS mercado_respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aid TEXT,
  origen TEXT NOT NULL,
  tipo TEXT NOT NULL,
  pregunta TEXT NOT NULL,
  valor TEXT NOT NULL,
  valor_detalle TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer_host TEXT,
  ts TEXT NOT NULL,
  catalogo_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mercado_aid_ts ON mercado_respuestas (aid, ts);
CREATE INDEX IF NOT EXISTS idx_mercado_pregunta ON mercado_respuestas (pregunta, valor);
CREATE INDEX IF NOT EXISTS idx_mercado_origen_ts ON mercado_respuestas (origen, ts);
