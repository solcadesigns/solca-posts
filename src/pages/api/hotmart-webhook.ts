/**
 * Webhook de Hotmart (versión 2.0.0) · ventas de los libros, 28 oct 2026.
 *
 * Hotmart manda cada evento de compra (aprobada, completa, reembolso, contracargo...) con el token de la
 * cuenta en el header X-HOTMART-HOTTOK. Se valida contra el secret HOTMART_HOTTOK y se guarda una fila por
 * evento en D1 (tabla hotmart_eventos, migrations/0008_hotmart_ventas.sql). El reporte semanal lee de ahí
 * las ventas por libro, por origen (sck) y por afiliado.
 *
 * No guarda datos del comprador (nombre, email, documento, dirección), salvo un hash seudónimo del correo
 * (comprador_hash = sha256(lower(trim(email))), 30 oct 2026, migrations/0010) para unir la venta con el lead.
 * El correo se usa solo en memoria para calcular el hash y se descarta.
 * Docs: https://developers.hotmart.com/docs/en/2.0.0/webhook/purchase-webhook/
 */

import type { APIRoute } from 'astro';
import { emailHashFull } from '../../lib/attribution';

export const prerender = false;

interface Comision {
  value?: number;
  source?: string;
  currency_value?: string;
}

interface HotmartEvento {
  id?: string;
  creation_date?: number;
  event?: string;
  data?: {
    product?: { id?: number; name?: string };
    buyer?: { email?: string }; // solo para el hash; nunca se guarda en claro
    affiliates?: Array<{ affiliate_code?: string; name?: string }>;
    commissions?: Comision[];
    purchase?: {
      transaction?: string;
      status?: string;
      approved_date?: number;
      price?: { value?: number; currency_value?: string };
      full_price?: { value?: number; currency_value?: string };
      checkout_country?: { iso?: string };
      origin?: { sck?: string; src?: string; xcod?: string };
    };
  };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const texto = (v: unknown, max = 200): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null);
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  const esperado = env.HOTMART_HOTTOK as string | undefined;
  const db = env.SIMULATOR_METRICS_DB as D1Database | undefined;
  if (!esperado || !db) return new Response('not configured', { status: 503 });

  const hottok = request.headers.get('x-hotmart-hottok') ?? '';
  if (!timingSafeEqualStr(hottok, esperado)) return new Response('unauthorized', { status: 401 });

  let ev: HotmartEvento;
  try {
    ev = await request.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const p = ev.data?.purchase;
  if (!ev.id || !ev.event) return new Response('missing fields', { status: 400 });
  // Eventos sin compra (abandono de carrito, suscripciones, club): se aceptan con 200 para que Hotmart no reintente.
  if (!p?.transaction) return new Response('ignored', { status: 200 });
  // Las pruebas del panel de Hotmart llegan con el token real y un producto ficticio: se confirman sin guardarse
  // para que no entren al reporte (el resultado se ve en Hotmart > Webhook > Historial).
  if (p.transaction === 'HP16015479281022' || /test postback/i.test(ev.data?.product?.name ?? '')) {
    return new Response('test ok', { status: 200 });
  }

  const comisiones = ev.data?.commissions ?? [];
  const comision = (fuente: string) => numero(comisiones.find((c) => c.source === fuente)?.value);
  const afiliado = ev.data?.affiliates?.[0];
  const buyerEmail = ev.data?.buyer?.email;
  const compradorHash =
    typeof buyerEmail === 'string' && buyerEmail.includes('@') ? await emailHashFull(buyerEmail) : null;

  // Si Hotmart reintenta el mismo evento, INSERT OR IGNORE evita duplicarlo.
  const valores = [
    texto(ev.id, 100),
    texto(p.transaction, 100),
    texto(ev.event, 50),
    texto(p.status, 50),
    numero(ev.creation_date) ?? Date.now(),
    numero(p.approved_date),
    numero(ev.data?.product?.id),
    texto(ev.data?.product?.name),
    numero(p.price?.value),
    texto(p.price?.currency_value, 3),
    numero(p.full_price?.value),
    texto(p.full_price?.currency_value, 3),
    texto(p.checkout_country?.iso, 2),
    texto(p.origin?.sck, 100),
    texto(p.origin?.src, 100),
    texto(p.origin?.xcod, 100),
    texto(afiliado?.affiliate_code, 100),
    texto(afiliado?.name),
    comision('AFFILIATE'),
    texto(comisiones.find((c) => c.source === 'AFFILIATE')?.currency_value, 3),
    comision('PRODUCER'),
    texto(comisiones.find((c) => c.source === 'PRODUCER')?.currency_value, 3),
    new Date().toISOString(),
  ];
  const columnas = `id, transaccion, evento, estado, creado_ms, aprobado_ms, producto_id, producto, precio, moneda, pagado,
         moneda_pagado, pais_checkout, sck, src, xcod, afiliado_codigo, afiliado, comision_afiliado,
         moneda_comision_afiliado, comision_productor, moneda_comision, recibido`;
  const marcas = (n: number) => Array(n).fill('?').join(', ');
  try {
    await db
      .prepare(`INSERT OR IGNORE INTO hotmart_eventos (${columnas}, comprador_hash) VALUES (${marcas(valores.length + 1)})`)
      .bind(...valores, compradorHash)
      .run();
  } catch (err) {
    // Si la migración 0010 (comprador_hash) aún no está aplicada, la venta se guarda igual sin el hash.
    if (!/comprador_hash/i.test(String((err as Error)?.message ?? err))) throw err;
    console.warn('hotmart-webhook: falta la columna comprador_hash (aplicar migrations/0010); se guarda sin hash');
    await db
      .prepare(`INSERT OR IGNORE INTO hotmart_eventos (${columnas}) VALUES (${marcas(valores.length)})`)
      .bind(...valores)
      .run();
  }

  return new Response('ok', { status: 200 });
};
