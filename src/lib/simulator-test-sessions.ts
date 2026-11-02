/**
 * Sesiones de prueba del simulador (2 nov 2026).
 *
 * Columna `sessions.es_prueba` (migración 0012): 0 = real, 1 = prueba confirmada, 2 = dudosa.
 * Toda estadística cuenta solo `es_prueba = 0`; las demás se reportan aparte.
 *
 * Tolerante a que la migración no esté aplicada: si la columna no existe, los filtros
 * quedan en `1=1` (se cuenta todo, como antes) y el conteo de excluidas sale null.
 */

/** Correos de prueba: mailinator, alias +test y cuentas de Oscar. Nunca se guarda el correo, solo la marca. */
const PATRON_CORREO_PRUEBA = /(mailinator|\+test[^@]*@|solisoscar|solcadesigns)/i;

export function esCorreoDePrueba(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  return PATRON_CORREO_PRUEBA.test(email.trim().toLowerCase());
}

/** Bandera interna del navegador (`window.__interno` → `interno: true` en el POST). */
export function esBanderaInterna(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true';
}

/** El error de D1 dice que la columna es_prueba no existe (migración 0012 sin aplicar). */
export function esErrorSinColumnaEsPrueba(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err ?? '');
  return /es_prueba/i.test(msg) && /(no such column|has no column named)/i.test(msg);
}

export interface FiltroSesionesReales {
  /** true si la columna existe y el filtro está activo. */
  activo: boolean;
  /** Condición para `FROM sessions` sin alias. */
  sesiones: string;
  /** Condición para `FROM sessions s` (alias s). */
  sesionesAlias: string;
  /** Condición para tablas ligadas por `session_id` (session_tags, beta_feedback) sin alias. */
  ligadas: string;
}

const SIN_FILTRO: FiltroSesionesReales = { activo: false, sesiones: '1=1', sesionesAlias: '1=1', ligadas: '1=1' };
const CON_FILTRO: FiltroSesionesReales = {
  activo: true,
  sesiones: 'es_prueba = 0',
  sesionesAlias: 's.es_prueba = 0',
  ligadas: '(session_id IS NULL OR session_id NOT IN (SELECT session_id FROM sessions WHERE es_prueba <> 0))',
};

/** Detecta si la columna existe. Si la consulta falla por cualquier motivo, no filtra (no tira la request). */
export async function filtroSesionesReales(db: D1Database): Promise<FiltroSesionesReales> {
  try {
    await db.prepare('SELECT es_prueba FROM sessions LIMIT 1').all();
    return CON_FILTRO;
  } catch (err) {
    if (!esErrorSinColumnaEsPrueba(err)) console.warn('[es_prueba] verificación de columna falló:', err);
    return SIN_FILTRO;
  }
}

export interface ConteoSesionesPrueba {
  total: number;
  confirmadas: number; // es_prueba = 1
  dudosas: number; // es_prueba = 2
}

/** Cuántas sesiones quedan fuera. Ventana opcional en epoch ms (ts >= desde, ts <= hasta). null si no hay columna. */
export async function contarSesionesPrueba(
  db: D1Database,
  filtro: FiltroSesionesReales,
  desdeMs?: number,
  hastaMs?: number,
): Promise<ConteoSesionesPrueba | null> {
  if (!filtro.activo) return null;
  try {
    const conds = ['es_prueba <> 0'];
    const binds: number[] = [];
    if (typeof desdeMs === 'number') { conds.push('ts >= ?'); binds.push(desdeMs); }
    if (typeof hastaMs === 'number') { conds.push('ts <= ?'); binds.push(hastaMs); }
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN es_prueba = 1 THEN 1 ELSE 0 END) AS confirmadas,
                SUM(CASE WHEN es_prueba = 2 THEN 1 ELSE 0 END) AS dudosas
         FROM sessions WHERE ${conds.join(' AND ')}`,
      )
      .bind(...binds)
      .first<{ total: number; confirmadas: number | null; dudosas: number | null }>();
    return {
      total: Number(row?.total ?? 0),
      confirmadas: Number(row?.confirmadas ?? 0),
      dudosas: Number(row?.dudosas ?? 0),
    };
  } catch (err) {
    console.warn('[es_prueba] conteo falló:', err);
    return null;
  }
}
