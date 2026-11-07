-- 0014 · CV a la medida (6 nov 2026): idioma de la vacante y rol en la venta, sin texto ni datos personales.
-- El webhook escribe `idioma` al confirmar el pago y el cron escribe `rol` al generar el documento.
-- Ambos UPDATE son best-effort: si esta migración no está aplicada, la venta se registra igual sin estas columnas.
-- Aplicar: npx wrangler d1 migrations apply SIMULATOR_METRICS_DB --remote
ALTER TABLE ventas ADD COLUMN idioma TEXT; -- es | en
ALTER TABLE ventas ADD COLUMN rol TEXT;    -- código de rol (src/lib/cv-medida.ts, CVM_ROLES)
