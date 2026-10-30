-- Historia permanente de métricas, 30 oct 2026 (requisito de Oscar: comparar toda la historia).
--
-- 1) eventos: copia permanente (sin TTL) de cada evento que entra a /api/simulator-events. KV SIMULATOR_METRICS
--    sigue con `evt:` a 90 días para que el reporte semanal no cambie. id = la misma llave del KV, así el backfill
--    (scripts/backfill-eventos-d1.mjs) y la escritura en vivo no se duplican (INSERT OR IGNORE).
--    También guarda eventos de servidor anónimos: cv_attempt (intentos del revisor de CV, sin correo).
--    Sin datos personales: ni correo, ni IP, ni URL completa del referrer (solo el host).
CREATE TABLE IF NOT EXISTS eventos (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,                 -- ISO
  dia TEXT NOT NULL,                -- AAAA-MM-DD (UTC), para agrupar sin funciones
  evento TEXT NOT NULL,
  page TEXT, path TEXT, product TEXT, tag TEXT, plan TEXT, cta TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
  referrer_host TEXT,
  country TEXT,
  aid TEXT,                         -- UUID anónimo del navegador
  ft_source TEXT, ft_medium TEXT, ft_campaign TEXT, ft_content TEXT, ft_ref_host TEXT, ft_landing TEXT,
  lt_source TEXT, lt_medium TEXT, lt_campaign TEXT, lt_content TEXT, lt_ref_host TEXT,
  interno INTEGER NOT NULL DEFAULT 0,
  extra TEXT,                       -- JSON corto con campos propios del evento (p. ej. status y largo del CV)
  origen TEXT NOT NULL DEFAULT 'vivo' -- vivo | backfill
);
CREATE INDEX IF NOT EXISTS idx_eventos_ts ON eventos (ts);
CREATE INDEX IF NOT EXISTS idx_eventos_evento_ts ON eventos (evento, ts);
CREATE INDEX IF NOT EXISTS idx_eventos_dia_evento ON eventos (dia, evento);
CREATE INDEX IF NOT EXISTS idx_eventos_aid ON eventos (aid);
CREATE INDEX IF NOT EXISTS idx_eventos_campaign ON eventos (utm_campaign);

-- 2) reportes_semanales: salida completa de cada corrida de /api/weekly-report (JSON agregado, incluye Postmark,
--    que Postmark solo conserva 45 días). Sin TTL. El JSON no trae correos ni IPs.
CREATE TABLE IF NOT EXISTS reportes_semanales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generado TEXT NOT NULL,           -- ISO de la corrida
  semana_inicio TEXT NOT NULL,
  semana_fin TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reportes_generado ON reportes_semanales (generado);
