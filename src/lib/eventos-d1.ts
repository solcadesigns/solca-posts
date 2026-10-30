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
