/**
 * Atribución de leads y ventas para /api/weekly-report · 30 oct 2026 (P2, P1, P3, P6 del diagnóstico).
 *
 * Entrada: los registros de leads de KV EMAILS (email:, quiz:, sim:) que el reporte ya recorre, y D1
 * (`ventas` de Stripe y `hotmart_eventos`). Salida: solo agregados; ningún correo ni hash sale del Worker.
 *
 * Definiciones:
 *   - Lead = correo único. Su "alta" es su primera aparición en cualquier prefijo (email:, quiz:, sim:).
 *   - Puerta = prefijo de esa primera aparición (cv, quiz, simulador).
 *   - Fuente del lead = primera fuente conocida entre sus registros, en este orden:
 *       ft.utm_source (primer toque persistente) > utm_source de la sesión > ft.ref_host > host del referrer.
 *   - Interno = algún registro del correo trae interno=true (?interno=1). Se excluye de todo y se cuenta aparte.
 *   - Valor del lead a 60 días = neto de ventas a ≤60 días del alta / leads de la cohorte. Solo se calcula
 *     con ≥30 leads en la cohorte y la ventana de 60 días cerrada (regla de union-ventas-leads.md).
 */

import { emailHashFull, sanitizeHost } from './attribution';

export interface LeadRecInput {
  key: string;
  email?: string;
  ts?: string;
  country?: string;
  utm_source?: string;
  utm_campaign?: string;
  referrer?: string;
  interno?: boolean;
  aid?: string;
  ft?: { utm_source?: string; utm_campaign?: string; ref_host?: string };
}

interface Lead {
  email: string;
  firstMs: number;
  puerta: string;
  pais: string;
  fuente: string | null;
  fuenteTipo: 'ft' | 'utm' | 'ft_ref' | 'referrer' | null;
  campania: string | null;
  conAid: boolean;
  interno: boolean;
}

const DAY = 86_400_000;

function puertaDe(key: string): string | null {
  if (key.startsWith('email:')) return 'cv';
  if (key.startsWith('quiz:')) return 'quiz';
  if (key.startsWith('sim:')) return 'simulador';
  return null;
}

function hostDeReferrer(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  try {
    return sanitizeHost(new URL(ref).hostname);
  } catch {
    return undefined;
  }
}

/** Acumula registros de leads. Llamar `add` por cada registro de EMAILS; luego `build`. */
export class LeadAttribution {
  private leads = new Map<string, Lead>();

  add(rec: LeadRecInput): void {
    const puerta = puertaDe(rec.key);
    if (!puerta) return;
    const email = (rec.email ?? '').toLowerCase().trim();
    const ms = rec.ts ? Date.parse(rec.ts) : NaN;
    if (!email || Number.isNaN(ms)) return;

    let fuente: string | null = null;
    let tipo: Lead['fuenteTipo'] = null;
    if (rec.ft?.utm_source) { fuente = rec.ft.utm_source; tipo = 'ft'; }
    else if (rec.utm_source) { fuente = rec.utm_source; tipo = 'utm'; }
    else if (rec.ft?.ref_host) { fuente = rec.ft.ref_host; tipo = 'ft_ref'; }
    else {
      const h = hostDeReferrer(rec.referrer);
      if (h) { fuente = h; tipo = 'referrer'; }
    }
    const campania = rec.ft?.utm_campaign ?? rec.utm_campaign ?? null;

    const prev = this.leads.get(email);
    if (!prev) {
      this.leads.set(email, {
        email, firstMs: ms, puerta, pais: (rec.country ?? 'sin_dato').toLowerCase().slice(0, 20),
        fuente, fuenteTipo: tipo, campania, conAid: !!rec.aid, interno: rec.interno === true,
      });
      return;
    }
    // Un registro anterior redefine la puerta y el alta; la fuente se queda con la primera conocida.
    if (ms < prev.firstMs) {
      prev.firstMs = ms;
      prev.puerta = puerta;
      if (rec.country) prev.pais = rec.country.toLowerCase().slice(0, 20);
      if (fuente) { prev.fuente = fuente; prev.fuenteTipo = tipo; prev.campania = campania; }
    } else if (!prev.fuente && fuente) {
      prev.fuente = fuente; prev.fuenteTipo = tipo; prev.campania = campania;
    }
    if (rec.aid) prev.conAid = true;
    if (rec.interno === true) prev.interno = true;
  }

  async build(db: D1Database | undefined, now: number): Promise<AtribucionReport> {
    const weekAgo = now - 7 * DAY;
    const twoWeeksAgo = now - 14 * DAY;
    const externos = [...this.leads.values()].filter((l) => !l.interno);
    const internos = this.leads.size - externos.length;

    const sem = externos.filter((l) => l.firstMs >= weekAgo && l.firstMs <= now);
    const ant = externos.filter((l) => l.firstMs >= twoWeeksAgo && l.firstMs < weekAgo);
    const acumHoy = externos.filter((l) => l.firstMs <= now).length;
    const acumHace7 = externos.filter((l) => l.firstMs < weekAgo).length;

    const cuenta = <X,>(arr: X[], f: (l: X) => string): Record<string, number> => {
      const o: Record<string, number> = {};
      for (const l of arr) o[f(l)] = (o[f(l)] ?? 0) + 1;
      return o;
    };
    const pct = (a: number, b: number) => (b > 0 ? +((a / b) * 100).toFixed(1) : null);
    const conFuente = (arr: Lead[]) => arr.filter((l) => l.fuente).length;

    // Hash de cada lead (sha256 completo) para unir con ventas. Se calcula aquí; no se guarda ni se devuelve.
    const porHash = new Map<string, Lead>();
    for (const l of externos) porHash.set(await emailHashFull(l.email), l);

    const ventas = db ? await leerVentas(db) : { filas: [], notas: ['sin D1'] };

    // Ventas de la semana (Stripe + Hotmart), con fuente y unión a lead.
    const v7 = ventas.filas.filter((v) => v.ms >= weekAgo && v.ms <= now);
    const unidas7 = v7.filter((v) => v.hash && porHash.has(v.hash));
    const stripe7 = v7.filter((v) => v.pasarela === 'stripe');
    const netoPorMoneda = (arr: Venta[]) => {
      const o: Record<string, number> = {};
      for (const v of arr) if (v.neto !== null) o[v.moneda ?? 'sin_moneda'] = +((o[v.moneda ?? 'sin_moneda'] ?? 0) + v.neto).toFixed(2);
      return o;
    };

    // Cohortes por mes de alta × puerta × fuente × país, con compras a 30 y 60 días.
    type Coh = { leads: number; c30: Set<string>; c60: Set<string>; v60: number; neto60: Record<string, number> };
    const coh = new Map<string, Coh>();
    const claveDe = (l: Lead) => [new Date(l.firstMs).toISOString().slice(0, 7), l.puerta, l.fuente ?? 'sin_fuente', l.pais].join('|');
    for (const l of externos) {
      const k = claveDe(l);
      const c = coh.get(k) ?? { leads: 0, c30: new Set(), c60: new Set(), v60: 0, neto60: {} };
      c.leads++;
      coh.set(k, c);
    }
    let sinLead = 0;
    let antesDelLead = 0;
    for (const v of ventas.filas) {
      const l = v.hash ? porHash.get(v.hash) : undefined;
      if (!l) { sinLead++; continue; }
      if (v.ms < l.firstMs) { antesDelLead++; continue; }
      const dias = (v.ms - l.firstMs) / DAY;
      const c = coh.get(claveDe(l))!;
      if (dias <= 30) c.c30.add(v.hash!);
      if (dias <= 60) {
        c.c60.add(v.hash!);
        c.v60++;
        if (v.neto !== null) c.neto60[v.moneda ?? 'sin_moneda'] = +((c.neto60[v.moneda ?? 'sin_moneda'] ?? 0) + v.neto).toFixed(2);
      }
    }
    const cohortes = [...coh.entries()]
      .map(([k, c]) => {
        const [mes, puerta, fuente, pais] = k.split('|');
        const finMes = Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 1); // primer día del mes siguiente
        const cerrada = now >= finMes + 60 * DAY;
        const mxn = c.neto60.MXN ?? 0;
        return {
          cohorte_mes: mes, puerta, fuente, pais,
          leads_n: c.leads,
          compradores_30d: c.c30.size,
          compradores_60d: c.c60.size,
          ventas_60d: c.v60,
          neto_60d_por_moneda: c.neto60,
          // Solo con n≥30 y ventana cerrada; si no, null (leer conteos).
          valor_lead_60d_mxn: c.leads >= 30 && cerrada ? +(mxn / c.leads).toFixed(2) : null,
          ventana_cerrada: cerrada,
        };
      })
      .sort((a, b) => (a.cohorte_mes < b.cohorte_mes ? 1 : a.cohorte_mes > b.cohorte_mes ? -1 : b.leads_n - a.leads_n));

    return {
      definicion:
        'Lead = correo único (email:, quiz:, sim:); alta = primera aparición; fuente = ft.utm_source > utm de sesión > ft.ref_host > referrer. Excluye interno=1. Ventas: Stripe pagadas en modo live (neto de la balance transaction; si no se leyó, monto bruto) + Hotmart con último evento de compra (neto = comisión del productor). Unión por sha256(lower(trim(email))).',
      leads: {
        altas_unicas_7d: sem.length,
        altas_unicas_semana_anterior: ant.length,
        acumulado_unico: acumHoy,
        // Control de dedupe (P6): debe dar 0. Si no, hay registros con fecha futura o rotos.
        control_dedupe: sem.length - (acumHoy - acumHace7),
        con_fuente_7d: conFuente(sem),
        pct_con_fuente_7d: pct(conFuente(sem), sem.length),
        pct_con_fuente_semana_anterior: pct(conFuente(ant), ant.length),
        pct_con_fuente_acumulado: pct(conFuente(externos), externos.length),
        fuente_por_tipo_7d: cuenta(sem, (l) => l.fuenteTipo ?? 'sin_fuente'),
        con_aid_7d: sem.filter((l) => l.conAid).length,
        por_puerta_7d: cuenta(sem, (l) => l.puerta),
        por_fuente_7d: cuenta(sem, (l) => l.fuente ?? 'sin_fuente'),
        por_campania_7d: cuenta(sem.filter((l) => l.campania), (l) => l.campania!),
        leads_internos_excluidos: internos,
      },
      ventas: {
        disponible: ventas.notas.length === 0,
        notas: ventas.notas,
        ventas_7d: v7.length,
        stripe_7d: stripe7.length,
        hotmart_7d: v7.length - stripe7.length,
        neto_7d_por_moneda: netoPorMoneda(v7),
        stripe_por_plan_7d: cuenta(stripe7, (v) => v.plan ?? 'sin_plan'),
        con_fuente_propia_7d: v7.filter((v) => v.fuente).length, // Stripe: ft/lt en metadata; Hotmart: sck
        unidas_a_lead_7d: unidas7.length,
        por_fuente_lead_7d: (() => {
          const o: Record<string, number> = {};
          for (const v of unidas7) { const f = porHash.get(v.hash!)!.fuente ?? 'sin_fuente'; o[f] = (o[f] ?? 0) + 1; }
          return o;
        })(),
        acumulado: ventas.filas.length,
        acumulado_sin_lead: sinLead,
        acumulado_antes_del_lead: antesDelLead,
      },
      cohortes,
    };
  }
}

interface Venta {
  pasarela: 'stripe' | 'hotmart';
  ms: number;
  hash: string | null;
  neto: number | null;
  moneda: string | null;
  plan: string | null;
  fuente: string | null;
}

/** Ventas vigentes (sin reembolso, sin internas, sin modo test). Tolera que falten las migraciones 0009/0010. */
async function leerVentas(db: D1Database): Promise<{ filas: Venta[]; notas: string[] }> {
  const filas: Venta[] = [];
  const notas: string[] = [];
  try {
    const r = await db
      .prepare(
        `SELECT creado, email_hash, COALESCE(neto, monto) AS neto, COALESCE(moneda_neto, moneda) AS moneda, plan,
                COALESCE(ft_source, lt_source, ft_ref_host, lt_ref_host) AS fuente
         FROM ventas WHERE estado = 'pagada' AND interno = 0 AND livemode = 1`,
      )
      .all<{ creado: string; email_hash: string | null; neto: number | null; moneda: string | null; plan: string | null; fuente: string | null }>();
    for (const f of r.results ?? []) {
      const ms = Date.parse(f.creado);
      if (!Number.isNaN(ms)) filas.push({ pasarela: 'stripe', ms, hash: f.email_hash, neto: f.neto, moneda: f.moneda, plan: f.plan, fuente: f.fuente });
    }
  } catch {
    notas.push('Tabla ventas no disponible (aplicar migrations/0009_ventas_stripe.sql).');
  }
  try {
    // Estado vigente por transacción = evento más reciente; la venta cuenta si ese evento es de compra.
    // Neto de Hotmart = comisión del productor (lo que recibe Oscar).
    const r = await db
      .prepare(
        `SELECT h.transaccion,
                (SELECT y.evento FROM hotmart_eventos y WHERE y.transaccion = h.transaccion
                  ORDER BY y.creado_ms DESC, y.recibido DESC LIMIT 1) AS ultimo,
                MIN(COALESCE(h.aprobado_ms, h.creado_ms)) AS ms,
                MAX(h.comision_productor) AS neto, MAX(h.moneda_comision) AS moneda, MAX(h.sck) AS sck,
                MAX(h.comprador_hash) AS hash
         FROM hotmart_eventos h GROUP BY h.transaccion`,
      )
      .all<{ transaccion: string; ultimo: string; ms: number; neto: number | null; moneda: string | null; sck: string | null; hash: string | null }>();
    for (const f of r.results ?? []) {
      if (f.ultimo !== 'PURCHASE_APPROVED' && f.ultimo !== 'PURCHASE_COMPLETE') continue;
      filas.push({ pasarela: 'hotmart', ms: f.ms, hash: f.hash, neto: f.neto, moneda: f.moneda, plan: null, fuente: f.sck });
    }
  } catch {
    notas.push('Columna comprador_hash no disponible (aplicar migrations/0010_hotmart_comprador_hash.sql).');
  }
  return { filas, notas };
}

export interface AtribucionReport {
  definicion: string;
  leads: {
    altas_unicas_7d: number;
    altas_unicas_semana_anterior: number;
    acumulado_unico: number;
    control_dedupe: number;
    con_fuente_7d: number;
    pct_con_fuente_7d: number | null;
    pct_con_fuente_semana_anterior: number | null;
    pct_con_fuente_acumulado: number | null;
    fuente_por_tipo_7d: Record<string, number>;
    con_aid_7d: number;
    por_puerta_7d: Record<string, number>;
    por_fuente_7d: Record<string, number>;
    por_campania_7d: Record<string, number>;
    leads_internos_excluidos: number;
  };
  ventas: {
    disponible: boolean;
    notas: string[];
    ventas_7d: number;
    stripe_7d: number;
    hotmart_7d: number;
    neto_7d_por_moneda: Record<string, number>;
    stripe_por_plan_7d: Record<string, number>;
    con_fuente_propia_7d: number;
    unidas_a_lead_7d: number;
    por_fuente_lead_7d: Record<string, number>;
    acumulado: number;
    acumulado_sin_lead: number;
    acumulado_antes_del_lead: number;
  };
  cohortes: Array<{
    cohorte_mes: string;
    puerta: string;
    fuente: string;
    pais: string;
    leads_n: number;
    compradores_30d: number;
    compradores_60d: number;
    ventas_60d: number;
    neto_60d_por_moneda: Record<string, number>;
    valor_lead_60d_mxn: number | null;
    ventana_cerrada: boolean;
  }>;
}
