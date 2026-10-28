-- Ventas de Hotmart recibidas por webhook (versión 2.0.0), 28 oct 2026.
-- Una fila por evento (compra aprobada, completa, reembolso, contracargo...). El estado vigente de una
-- transacción es el de su evento más reciente. Sin datos del comprador: solo producto, precio, origen
-- (sck/src/xcod), afiliado y comisiones. Ver src/pages/api/hotmart-webhook.ts.
CREATE TABLE IF NOT EXISTS hotmart_eventos (
  id TEXT PRIMARY KEY,               -- id del evento (Hotmart); reintentos del mismo evento no duplican
  transaccion TEXT NOT NULL,         -- purchase.transaction
  evento TEXT NOT NULL,              -- PURCHASE_APPROVED | PURCHASE_COMPLETE | PURCHASE_REFUNDED | ...
  estado TEXT,                       -- purchase.status
  creado_ms INTEGER NOT NULL,        -- creation_date del evento (ms)
  aprobado_ms INTEGER,               -- purchase.approved_date (ms)
  producto_id INTEGER,
  producto TEXT,
  precio REAL,                       -- purchase.price.value (oferta al momento de la compra)
  moneda TEXT,
  pagado REAL,                       -- purchase.full_price.value (con impuestos e intereses)
  moneda_pagado TEXT,
  pais_checkout TEXT,                -- purchase.checkout_country.iso
  sck TEXT,
  src TEXT,
  xcod TEXT,
  afiliado_codigo TEXT,              -- affiliates[0].affiliate_code
  afiliado TEXT,                     -- affiliates[0].name
  comision_afiliado REAL,            -- commissions[source=AFFILIATE].value
  moneda_comision_afiliado TEXT,
  comision_productor REAL,           -- commissions[source=PRODUCER].value
  moneda_comision TEXT,              -- moneda de la comisión del productor
  recibido TEXT NOT NULL             -- cuándo llegó a nuestro endpoint (ISO)
);
CREATE INDEX IF NOT EXISTS idx_hotmart_tx ON hotmart_eventos (transaccion, creado_ms);
CREATE INDEX IF NOT EXISTS idx_hotmart_aprobado ON hotmart_eventos (aprobado_ms);
CREATE INDEX IF NOT EXISTS idx_hotmart_creado ON hotmart_eventos (creado_ms);
