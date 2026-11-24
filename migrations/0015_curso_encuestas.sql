-- 0015 · Encuestas del curso "De la ciencia a la industria" (curso V2.0), 24 nov 2026.
-- Cuatro encuestas: inicio (lección 0.5), cierre (C.1), 30 días y 90 días. Textos y opciones en
-- src/lib/encuesta-curso.ts (copia fiel de ../consultoria/curso-cv-v2/textos-finales/06-encuestas-y-correos.md).
--
-- Una fila por envío del formulario. Sin TTL (historia permanente).
-- Identificador del alumno: el correo de compra (lo escribe el alumno). email_hash = sha256(lower(trim(email))) en
-- hex completo, el mismo de hotmart_eventos.comprador_hash (0010) y de consentimientos (0013): une la respuesta con
-- la venta sin depender del correo en claro.
-- respuestas: JSON {id_pregunta: valor}; valores con código estable para comparar entre encuestas
-- (p. ej. $.claridad en inicio y cierre). Consultar con json_extract(respuestas, '$.claridad').
-- Si alguien responde dos veces la misma encuesta, quedan dos filas: el análisis toma la más reciente por
-- (email_hash, tipo).
--
-- Aplicar (Oscar):
--   npx wrangler d1 migrations apply SIMULATOR_METRICS_DB --remote

CREATE TABLE IF NOT EXISTS curso_encuestas (
  id TEXT PRIMARY KEY,               -- <tipo>:<ts>:<aleatorio>
  ts TEXT NOT NULL,                  -- ISO del envío
  dia TEXT NOT NULL,                 -- AAAA-MM-DD (UTC)
  curso TEXT NOT NULL,               -- etiqueta del curso: curso_cv_v2
  tipo TEXT NOT NULL,                -- inicio | cierre | 30-dias | 90-dias
  version TEXT NOT NULL,             -- versión del catálogo de preguntas (src/lib/encuesta-curso.ts)
  email TEXT NOT NULL,               -- correo de compra, en minúsculas
  email_hash TEXT NOT NULL,          -- sha256 hex de lower(trim(email))
  respuestas TEXT NOT NULL,          -- JSON
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
  referrer_host TEXT,
  aid TEXT,                          -- UUID anónimo del navegador (BaseLayout)
  alumno INTEGER NOT NULL DEFAULT 0, -- 1 si llegó con un enlace del curso (window.__alumno o esDesdeCurso)
  interno INTEGER NOT NULL DEFAULT 0,-- 1 = tráfico de Oscar (?interno=1); se excluye de los reportes
  country TEXT                       -- cf-ipcountry
);
CREATE INDEX IF NOT EXISTS idx_curso_enc_tipo_ts ON curso_encuestas (curso, tipo, ts);
CREATE INDEX IF NOT EXISTS idx_curso_enc_hash ON curso_encuestas (email_hash, tipo);
