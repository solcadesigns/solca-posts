-- Sesiones de prueba del simulador, 2 nov 2026.
-- es_prueba: 0 = real, 1 = prueba confirmada, 2 = dudosa. Las estadísticas cuentan solo es_prueba = 0
-- y reportan aparte las excluidas (sesiones_prueba_excluidas). Lista de origen (sin correos):
-- ../consultoria/2026-10-30/sesiones-prueba-simulador.md
-- Sesiones nuevas: simulator-session.ts escribe es_prueba = 1 si el navegador trae la bandera interna
-- (?interno=1) o el correo es de prueba (mailinator, +test, cuentas de Oscar). El correo no se guarda.
--
-- Aplicar:
--   npx wrangler d1 migrations apply SIMULATOR_METRICS_DB --remote

ALTER TABLE sessions ADD COLUMN es_prueba INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_sessions_es_prueba ON sessions(es_prueba);

-- Pruebas internas (11)
UPDATE sessions SET es_prueba = 1 WHERE session_id IN (
  '0165f0f7-8598-4b16-b1e0-7bea2a526f9a',
  '5a6fd3e8-23c3-46c2-823a-d726e160800b',
  'a3a4a591-f716-4ad3-ba15-2a5382ba25e0',
  'c1cc72a6-c1bf-448e-8744-7849e0d006cc',
  '13624943-6943-4835-9222-7853eb9fcad1',
  'c9ca9cb5-f595-49c6-8c46-4e914e926a8c',
  '19277017-2c1f-43ec-ba32-db98937e1fd6',
  'c769c372-3e13-41ea-b419-6dc47b3e524c',
  '827c6244-54d8-492d-a8c5-5b359dba36ed',
  'd7a8cdae-04ba-4277-802b-7a9bdab6df99',
  '582c70e0-5faf-418f-a64b-85ef73288c2a'
);

-- Sin correo guardado, decide Oscar (5)
UPDATE sessions SET es_prueba = 2 WHERE session_id IN (
  'c589ec90-6ef6-4899-8f86-253e454f8e62',
  '87e98ae2-821d-405d-8cbe-3fb18c427f91',
  '0fbae7b6-f702-46f2-86ba-4b89a60d6233',
  'a1b4066a-8bd8-4c91-be03-c1769d50a0f7',
  'b662aaa9-4d21-48d0-89a8-dd4a64ef29f9'
);
