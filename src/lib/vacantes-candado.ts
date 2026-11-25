/**
 * Utilidades del worker solca-vacantes que no dependen del portal (25 nov 2026). Viven aquí para probarlas
 * sin Cloudflare (scripts/test-vacantes-clasificar.mjs).
 */

/** Lo mínimo de D1 que usan estas funciones. */
interface BD {
  prepare(sql: string): { bind(...v: unknown[]): unknown; run(): Promise<unknown> };
  batch(stmts: unknown[]): Promise<Array<{ meta?: { changes?: number } }>>;
}

/**
 * Candado con vencimiento, para que un reprocesar manual no corra a la vez que el cron.
 * DELETE del vencido + INSERT OR IGNORE en un solo batch: solo uno de los dos inserta.
 * Devuelve el id del dueño, o null si otro lo tiene.
 */
export const CANDADO_TTL_MS = 30 * 60 * 1000;
export async function tomarCandado(db: BD, nombre: string, ahora = new Date(), ttlMs = CANDADO_TTL_MS): Promise<string | null> {
  const dueno = crypto.randomUUID();
  // La migración 0015 crea la tabla; esto evita que un worker desplegado antes de aplicarla deje de reprocesar.
  await db.prepare('CREATE TABLE IF NOT EXISTS candados (nombre TEXT PRIMARY KEY, dueno TEXT NOT NULL, hasta TEXT NOT NULL)').run();
  const [, ins] = await db.batch([
    db.prepare('DELETE FROM candados WHERE nombre = ? AND hasta < ?').bind(nombre, ahora.toISOString()),
    db.prepare('INSERT OR IGNORE INTO candados (nombre, dueno, hasta) VALUES (?, ?, ?)')
      .bind(nombre, dueno, new Date(ahora.getTime() + ttlMs).toISOString()),
  ]);
  return (ins?.meta?.changes ?? 0) === 1 ? dueno : null;
}

export async function soltarCandado(db: BD, nombre: string, dueno: string): Promise<void> {
  await (db.prepare('DELETE FROM candados WHERE nombre = ? AND dueno = ?').bind(nombre, dueno) as { run(): Promise<unknown> }).run();
}

/**
 * Versión de reglas con que está la foto diaria: la más vieja entre las activas, no la vigente del código.
 * Mientras reprocesar avanza por lotes, la foto mezcla versiones y debe decirlo. Vacía o nula (título
 * cambiado, pendiente de reclasificar) cuenta como la más vieja y se etiqueta "sin".
 * Compara por número ("r10" es posterior a "r9"), no como texto.
 */
export function reglasMinimas(filas: Array<{ c: string | null; d: string | null }>, vigente: string): string {
  if (!filas.length) return vigente;
  const num = (v: string | null) => Number.parseInt((v ?? '').replace(/\D/g, ''), 10) || 0;
  const min = (xs: Array<string | null>) => xs.reduce((a, x) => (num(x) < num(a) ? x : a), xs[0]);
  return `${min(filas.map((f) => f.c)) || 'sin'}/${min(filas.map((f) => f.d)) || 'sin'}`;
}

/**
 * Condición SQL de "reglas pendientes": la fila no está con las reglas vigentes. Cuenta las de versión anterior
 * (r8 cuando rige r9), las vacías (título cambiado) y las nulas. Se usa en el reporte semanal.
 */
export const SQL_REGLAS_PENDIENTES = '(clasificacion_version IS NOT ? OR descriptores_version IS NOT ?)';
