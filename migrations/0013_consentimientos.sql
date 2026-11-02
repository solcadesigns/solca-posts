-- Registro permanente de consentimientos, 2 nov 2026 (casilla separada para correos comerciales).
-- Propuesta: ../consultoria/2026-10-30/entregables/ventas/casilla-correos-comerciales.md §2.5
--
-- Prueba de qué texto (consent_version, textos en src/lib/consent.ts) aceptó quién y cuándo, sin depender de KV.
-- Sin correo: email_hash es el sha256 completo de lower(trim(email)), el mismo de emailHashFull (unión con ventas).
-- Sin TTL. Lo escriben simulator-subscribe (simulador), simulator-stripe-webhook (simulador-pago),
-- quiz-subscribe (quiz, solo stage=gate) y cv-review (cv). revocado_at lo llena drip-unsubscribe con baja del newsletter.
-- El evento de medición (lead_captured, marketing 0/1) va aparte en `eventos` (0011).
--
-- Aplicar:
--   npx wrangler d1 migrations apply SIMULATOR_METRICS_DB --remote

CREATE TABLE IF NOT EXISTS consentimientos (
  id TEXT PRIMARY KEY,            -- <form>:<ts>:<email_hash 12>
  ts TEXT NOT NULL,
  dia TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  form TEXT NOT NULL,             -- simulador | simulador-pago | quiz | cv
  consent_version TEXT NOT NULL,
  privacidad INTEGER NOT NULL,    -- siempre 1 (sin ella no hay registro)
  marketing INTEGER NOT NULL,     -- 0 | 1
  revocado_at TEXT,
  interno INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_consent_hash ON consentimientos (email_hash);
CREATE INDEX IF NOT EXISTS idx_consent_dia_form ON consentimientos (dia, form);
