/**
 * Plazas múltiples de la misma oferta (`grupo_dup`) · r9, 24 nov 2026.
 *
 * Hasta r8, grupo_dup era la huella exacta de fuente + título + primeros 1,500 caracteres de la descripción.
 * Una diferencia mínima la rompía: un tabulador en lugar de un espacio (Thermo Fisher, "Safety Reporting
 * Specialist") o un subtítulo distinto al inicio ("Home Based - CDMX - Intake Case Exp." contra
 * "Home Based - Mexico" en ICON, "Graduate Pharmacovigilance Associate").
 *
 * Desde r9:
 * 1. La huella base es la misma de r8 (`grupoBase`), para que los grupos que ya existían conserven su id.
 * 2. Después de cada corrida, `agruparSimilares` une las vacantes de la misma fuente y el mismo título cuya
 *    descripción es casi igual: Jaccard de 0.9 o más sobre fragmentos de 3 palabras, sin distinguir espacios
 *    ni mayúsculas, tanto en los primeros 1,500 caracteres como en el texto completo (los requisitos que
 *    distinguen dos plazas suelen ir al final, como en ICON JR162256 y JR163401, "Clinical Trial Manager"). Dos plazas con el mismo título y descripciones distintas (otro patrocinador, otra área)
 *    siguen separadas. Calibrado el 24 nov 2026 con las 1,535 activas: 0.9 une las variantes de subtítulo o
 *    de espacios y deja fuera las de otra plantilla (0.85 ya uniría plazas de otro equipo).
 * El grupo toma la huella base de la vacante más antigua, así que no cambia cuando llegan plazas nuevas.
 */

export const DUP_UMBRAL = 0.9;
export const DUP_CARACTERES = 1500;

/** Huella corta (FNV-1a). */
export function huella(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const normalizar = (s: string | null | undefined): string => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export function tituloDup(titulo: string): string {
  return normalizar(titulo);
}

/** Huella de fuente + título normalizado + inicio de la descripción tal cual (fórmula de r8). */
export function grupoBase(fuente: string, titulo: string, descripcion: string | null | undefined): string {
  return huella(`${fuente}|${tituloDup(titulo)}|${(descripcion ?? '').slice(0, DUP_CARACTERES)}`);
}

/** Fragmentos de 3 palabras de la descripción completa (no solo del inicio: el puesto concreto suele ir al final). */
function fragmentos(descripcion: string | null | undefined): Set<string> {
  const p = normalizar(descripcion).split(' ').filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < p.length; i++) out.add(`${p[i]} ${p[i + 1]} ${p[i + 2]}`);
  return out;
}

function jaccard(fa: Set<string>, fb: Set<string>): number {
  if (!fa.size && !fb.size) return 1;
  let comunes = 0;
  for (const x of fa) if (fb.has(x)) comunes++;
  return comunes / (fa.size + fb.size - comunes);
}

/**
 * Similitud entre dos descripciones (0 a 1): la menor entre la del inicio (primeros 1,500 caracteres) y la del
 * texto completo. Así no basta con compartir la plantilla larga del final (beneficios, igualdad de oportunidades)
 * ni con compartir el arranque de la empresa: tienen que coincidir las dos partes.
 */
export function similitud(a: string | null | undefined, b: string | null | undefined): number {
  const inicio = jaccard(fragmentos((a ?? '').slice(0, DUP_CARACTERES)), fragmentos((b ?? '').slice(0, DUP_CARACTERES)));
  if (inicio === 0) return 0;
  return Math.min(inicio, jaccard(fragmentos(a), fragmentos(b)));
}

export interface FilaDup {
  id: string;
  fuente: string;
  titulo: string;
  descripcion: string | null;
  primera_vez: string;
}

/**
 * Agrupa filas de la misma fuente y el mismo título con descripciones casi iguales.
 * Devuelve id → grupo_dup para todas las filas recibidas.
 */
export function agruparSimilares(filas: FilaDup[], umbral = DUP_UMBRAL): Map<string, string> {
  const porTitulo = new Map<string, FilaDup[]>();
  for (const f of filas) {
    const k = `${f.fuente}|${tituloDup(f.titulo)}`;
    const l = porTitulo.get(k);
    if (l) l.push(f);
    else porTitulo.set(k, [f]);
  }
  const out = new Map<string, string>();
  for (const lista of porTitulo.values()) {
    // La más antigua primero: su huella nombra el grupo y no cambia al llegar plazas nuevas.
    lista.sort((a, b) => a.primera_vez.localeCompare(b.primera_vez) || a.id.localeCompare(b.id));
    const reps: Array<{ grupo: string; descripcion: string | null }> = [];
    for (const f of lista) {
      const base = grupoBase(f.fuente, f.titulo, f.descripcion);
      // La huella igual de r8 ya no basta: los primeros 1,500 caracteres pueden coincidir y el final no.
      const r = reps.find((x) => similitud(x.descripcion, f.descripcion) >= umbral);
      if (r) out.set(f.id, r.grupo);
      else {
        // Si otra plaza distinta ya usa esa huella (mismo inicio, otro final), el grupo nuevo lleva una propia.
        const grupo = reps.some((x) => x.grupo === base) ? huella(`${base}|${f.id}`) : base;
        reps.push({ grupo, descripcion: f.descripcion });
        out.set(f.id, grupo);
      }
    }
  }
  return out;
}
