-- Buscador de vacantes LATAM/España (22 oct 2026).
-- Lo llena el worker solca-vacantes (workers/vacantes) una vez al día desde los
-- portales oficiales de empleo de cada empresa. Diseño: _docs/VACANTES_BUSCADOR.md.
CREATE TABLE IF NOT EXISTS vacantes (
  id TEXT PRIMARY KEY,              -- fuente:requisición
  fuente TEXT NOT NULL,             -- id de la fuente (src/lib/vacantes-fuentes.ts)
  empresa TEXT NOT NULL,
  tipo_empresa TEXT NOT NULL,       -- farma | cro | medtech
  titulo TEXT NOT NULL,
  url TEXT NOT NULL,
  pais TEXT,                        -- país principal (mx, br, ar, co, cl, pe, es)
  paises TEXT,                      -- todos los países objetivo, separados por coma
  ubicacion TEXT,                   -- texto de ubicación del portal
  modalidad TEXT,                   -- presencial | hibrido | remoto | NULL
  rol TEXT NOT NULL,                -- catálogo de roles (src/lib/vacantes-clasificar.ts)
  nivel TEXT NOT NULL,              -- practicas | entrada | senior | gerencia | no_especificado
  fecha_publicacion TEXT,           -- fecha que da el portal (YYYY-MM-DD)
  primera_vez TEXT NOT NULL,        -- primera vez que la vimos (ISO)
  ultima_vez TEXT NOT NULL,         -- última vez que la vimos (ISO)
  activa INTEGER NOT NULL DEFAULT 1,
  fecha_cierre TEXT,                -- día en que dejó de aparecer
  descripcion TEXT,                 -- texto plano de la descripción (para el análisis semestral)
  clasificacion_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vacantes_activa_pais ON vacantes (activa, pais);
CREATE INDEX IF NOT EXISTS idx_vacantes_activa_rol ON vacantes (activa, rol);
CREATE INDEX IF NOT EXISTS idx_vacantes_fecha ON vacantes (fecha_publicacion);
CREATE INDEX IF NOT EXISTS idx_vacantes_fuente ON vacantes (fuente, activa);

-- Bitácora de cada corrida por fuente: si una fuente falla, se ve aquí y no se cierran sus vacantes.
CREATE TABLE IF NOT EXISTS vacantes_corridas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  fuente TEXT NOT NULL,
  estado TEXT NOT NULL,             -- ok | error | parcial
  vistas INTEGER NOT NULL DEFAULT 0,
  nuevas INTEGER NOT NULL DEFAULT 0,
  cerradas INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_vac_corridas_ts ON vacantes_corridas (ts);

-- Eventos de uso del buscador (búsquedas, filtros, clics a vacantes, paso a herramientas).
-- Sin correo ni IP; aid = identificador anónimo del navegador (el mismo de la encuesta de mercado).
CREATE TABLE IF NOT EXISTS vacantes_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  evento TEXT NOT NULL,             -- vacantes_viewed | vacantes_filtered | vacancy_clicked | tool_clicked
  aid TEXT,
  vacante_id TEXT,
  rol TEXT, pais TEXT, empresa TEXT, nivel TEXT, tipo_empresa TEXT,
  filtros TEXT,                     -- JSON con los filtros activos
  herramienta TEXT,                 -- simulador | cv | quiz (tool_clicked)
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  referrer_host TEXT,
  pais_visitante TEXT               -- cf-ipcountry
);
CREATE INDEX IF NOT EXISTS idx_vac_eventos ON vacantes_eventos (evento, ts);
