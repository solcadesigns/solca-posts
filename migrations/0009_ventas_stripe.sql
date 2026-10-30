-- Libro de ventas propio del Simulador (Stripe), 30 oct 2026 · P1 del diagnóstico de consultoría (EMB-1).
-- Una fila por Checkout Session pagada (id = cs_...). La escribe src/pages/api/simulator-stripe-webhook.ts
-- después de entregar las sesiones, con INSERT OR IGNORE: un reintento de Stripe no duplica.
-- Sin correo en claro: email_hash = sha256(lower(trim(email))) en hex completo (64 caracteres), la misma
-- llave que llevan los leads en KV EMAILS desde esta fecha. La fuente (aid, primer y último toque) llega
-- en la metadata del checkout (simulator-checkout.ts).
CREATE TABLE IF NOT EXISTS ventas (
  id TEXT PRIMARY KEY,                 -- Stripe checkout session id (cs_...)
  pasarela TEXT NOT NULL DEFAULT 'stripe',
  creado TEXT NOT NULL,                -- ISO, cuándo se entregó (pago confirmado; en OXXO, al pagar en tienda)
  producto TEXT NOT NULL,              -- 'simulador'
  plan TEXT,                           -- basico | premium
  monto REAL,                          -- amount_total / 100 (después de cupones)
  moneda TEXT,
  comision REAL,                       -- balance_transaction.fee / 100 (null si Stripe aún no lo tenía)
  neto REAL,                           -- balance_transaction.net / 100
  moneda_neto TEXT,                    -- moneda de liquidación de la balance transaction
  payment_intent TEXT,                 -- pi_..., para marcar reembolsos (charge.refunded)
  metodo TEXT,                         -- card | oxxo | ... (payment_method_types[0] si viene)
  email_hash TEXT,
  aid TEXT,
  ft_source TEXT, ft_medium TEXT, ft_campaign TEXT, ft_content TEXT, ft_ref_host TEXT, ft_landing TEXT, ft_ts TEXT,
  lt_source TEXT, lt_medium TEXT, lt_campaign TEXT, lt_content TEXT, lt_ref_host TEXT,
  pais TEXT,                           -- customer_details.address.country
  interno INTEGER NOT NULL DEFAULT 0,  -- 1 si el checkout salió de un navegador marcado con ?interno=1
  livemode INTEGER NOT NULL DEFAULT 1, -- 0 = compra en modo test
  estado TEXT NOT NULL DEFAULT 'pagada', -- pagada | reembolsada | reembolso_parcial
  monto_reembolsado REAL,
  actualizado TEXT
);
CREATE INDEX IF NOT EXISTS idx_ventas_creado ON ventas (creado);
CREATE INDEX IF NOT EXISTS idx_ventas_hash ON ventas (email_hash);
CREATE INDEX IF NOT EXISTS idx_ventas_pi ON ventas (payment_intent);
