-- Hash del correo del comprador en las ventas de Hotmart, 30 oct 2026 · P3 del diagnóstico (EMB-3).
-- comprador_hash = sha256(lower(trim(data.buyer.email))) en hex (64 caracteres). Nunca el correo en claro:
-- el webhook calcula el hash en memoria y descarta el correo. Sirve para unir la venta con el lead
-- (KV EMAILS lleva el mismo email_hash desde esta fecha). Las filas anteriores quedan en NULL.
ALTER TABLE hotmart_eventos ADD COLUMN comprador_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_hotmart_hash ON hotmart_eventos (comprador_hash);
