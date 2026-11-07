/**
 * Ruteo de eventos de Stripe en /api/simulator-stripe-webhook (6 nov 2026, al sumar CV a la medida).
 * Un solo endpoint de webhook para los dos productos: decide por tipo de evento y por `metadata.producto`
 * de la Checkout Session. Archivo puro, probado con `node scripts/test-cv-medida.mjs`.
 *
 * Guardas que se conservan del simulador:
 *   - se entrega solo con el pago confirmado: `checkout.session.completed` con payment_status distinto de 'unpaid'
 *     (tarjeta, o total 0 con cupón), o `checkout.session.async_payment_succeeded` con 'paid' (OXXO);
 *   - la ficha OXXO sin pagar y `async_payment_failed` no entregan;
 *   - `charge.refunded` marca la venta como reembolsada, para cualquier producto.
 */

export type RutaStripe =
  | { ruta: 'reembolso' }
  | { ruta: 'cv-medida'; jobId: string }
  | { ruta: 'cv-medida-fallido'; jobId: string }
  | { ruta: 'simulador' }
  | { ruta: 'ignorar' };

export interface EventoStripeMin {
  type: string;
  data: { object: { payment_status?: string; metadata?: Record<string, string> | null } };
}

export function rutaStripe(event: EventoStripeMin): RutaStripe {
  if (event.type === 'charge.refunded') return { ruta: 'reembolso' };
  const s = event.data?.object ?? {};
  const producto = s.metadata?.producto;
  const entrega =
    (event.type === 'checkout.session.completed' && s.payment_status !== 'unpaid') ||
    (event.type === 'checkout.session.async_payment_succeeded' && s.payment_status === 'paid');
  if (producto === 'cv-medida') {
    const jobId = (s.metadata?.cvmd_job ?? '').slice(0, 64);
    if (entrega) return { ruta: 'cv-medida', jobId };
    // Vale OXXO vencido o pago rechazado: se borran los datos del pedido sin esperar los 4 días.
    if (event.type === 'checkout.session.async_payment_failed') return { ruta: 'cv-medida-fallido', jobId };
    return { ruta: 'ignorar' };
  }
  return entrega ? { ruta: 'simulador' } : { ruta: 'ignorar' };
}
