/**
 * Copia permanente de eventos en D1 (tabla `eventos`, migrations/0011_eventos_y_reportes.sql) · 30 oct 2026.
 *
 * KV `evt:` caduca a 90 días; esta tabla no. Best-effort: nunca lanza (si D1 o la migración faltan, el
 * evento queda igual en KV). Sin datos personales: el referrer se reduce a host; nada de correo ni IP.
 * El mapeo de campos es el mismo que usa scripts/backfill-eventos-d1.mjs; si cambias uno, cambia el otro.
 */

interface TouchLike {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  ref_host?: string;
  landing_path?: string;
}

export interface EventoD1 {
  ts: string;
  event: string;
  page?: string;
  path?: string;
  product?: string;
  tag?: string;
  plan?: string;
  cta?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  country?: string;
  aid?: string;
  ft?: TouchLike;
  lt?: TouchLike;
  interno?: boolean;
  extra?: Record<string, string | number | boolean | null | undefined>;
}

const t = (v: unknown, max = 200): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null);

export function referrerHost(ref: unknown): string | null {
  if (typeof ref !== 'string' || !ref) return null;
  try {
    return new URL(ref).hostname.toLowerCase().replace(/^www\./, '').slice(0, 100) || null;
  } catch {
    return null;
  }
}

export async function guardarEventoD1(
  db: D1Database | undefined,
  id: string,
  r: EventoD1,
  origen: 'vivo' | 'backfill' = 'vivo',
): Promise<void> {
  if (!db) return;
  try {
    const extra = r.extra ? JSON.stringify(r.extra).slice(0, 1000) : null;
    await db
      .prepare(
        `INSERT OR IGNORE INTO eventos
          (id, ts, dia, evento, page, path, product, tag, plan, cta,
           utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer_host, country, aid,
           ft_source, ft_medium, ft_campaign, ft_content, ft_ref_host, ft_landing,
           lt_source, lt_medium, lt_campaign, lt_content, lt_ref_host, interno, extra, origen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id.slice(0, 200), r.ts, r.ts.slice(0, 10), t(r.event, 50),
        t(r.page, 30), t(r.path), t(r.product), t(r.tag, 100), t(r.plan, 20), t(r.cta, 20),
        t(r.utm_source), t(r.utm_medium), t(r.utm_campaign), t(r.utm_content), t(r.utm_term),
        referrerHost(r.referrer), t(r.country, 2), t(r.aid, 36),
        t(r.ft?.utm_source), t(r.ft?.utm_medium), t(r.ft?.utm_campaign), t(r.ft?.utm_content), t(r.ft?.ref_host), t(r.ft?.landing_path),
        t(r.lt?.utm_source), t(r.lt?.utm_medium), t(r.lt?.utm_campaign), t(r.lt?.utm_content), t(r.lt?.ref_host),
        r.interno === true ? 1 : 0, extra, origen,
      )
      .run();
  } catch (err) {
    console.warn('eventos-d1: insert failed (el evento sigue en KV)', String((err as Error)?.message ?? err).slice(0, 200));
  }
}

/**
 * Evento `llm_modelo` (6 nov 2026): qué modelo respondió cada llamada del simulador (chunks, reporte sync,
 * cv-parse con Haiku; init y next-question con Sonnet) y si entró el respaldo (Haiku 5.5 → 4.5 o
 * Sonnet 5.5 → 4.5). Un evento por llamada, también las exitosas sin respaldo, para tener la proporción. Sirve para decidir cuándo quitar el respaldo. Sin datos
 * personales: solo la ruta, el modelo, el status y el id aleatorio de la sesión si lo hay. Nunca lanza.
 */
export async function registrarModeloD1(
  db: D1Database | undefined,
  r: {
    ruta: 'chunk_summary' | 'chunk_breakdown' | 'sync_report' | 'cv_parse' | 'init' | 'next_question';
    ok: boolean;
    /** Modelo que se pidió (p. ej. claude-sonnet-5-5). */
    modeloPedido?: string;
    /** Modelo que respondió según la API. */
    modelo?: string;
    respaldo?: boolean;
    /** Status HTTP del modelo pedido que activó el respaldo. */
    statusRespaldo?: number;
    outputTokens?: number;
    ms?: number;
    /** Status HTTP o 'refusal' cuando falló. */
    error?: string | number;
    sessionId?: string;
    esPrueba?: boolean;
  },
): Promise<void> {
  const ts = new Date().toISOString();
  await guardarEventoD1(db, `llmm:${ts}:${r.ruta}:${crypto.randomUUID().slice(0, 8)}`, {
    ts,
    event: 'llm_modelo',
    product: 'simulador',
    interno: r.esPrueba || undefined,
    extra: {
      ruta: r.ruta,
      ok: r.ok ? 1 : 0,
      modelo_pedido: r.modeloPedido ? r.modeloPedido.slice(0, 40) : undefined,
      modelo: r.modelo ? r.modelo.slice(0, 40) : undefined,
      respaldo: r.respaldo === undefined ? undefined : r.respaldo ? 1 : 0,
      status_respaldo: r.statusRespaldo,
      output_tokens: r.outputTokens,
      ms: r.ms,
      error: r.error === undefined ? undefined : String(r.error).slice(0, 30),
      session_id: r.sessionId ? r.sessionId.slice(0, 40) : undefined,
    },
  }).catch(() => {});
}
