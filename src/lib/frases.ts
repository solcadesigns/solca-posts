/**
 * Separadores de oraciones · 10 nov 2026 (corregidos tras la revisión independiente del mismo día).
 *
 * Dos funciones con riesgos distintos:
 *
 * - `partirFrases` (CV a la medida, resumen): para que un filtro que quita oraciones no deje el resumen truncado
 *   ("...an M. Sc. and a B."). Corta en . ! ? (con comillas o paréntesis de cierre opcionales) seguidos de espacio
 *   o fin, aunque lo siguiente empiece en minúscula. Excepción, solo con una lista explícita: "Ph. D.", "Ph.D.",
 *   "M. Sc.", "M.Sc.", "B. Sc.", "B.Sc.", "M. en C.", "Dr.", "Dra.", "Lic.", "Mtro.", "Mtra.", "et al.", "e.g.",
 *   "i.e.", "U.S.", "U.K." y "No." + cifra no cortan si lo siguiente empieza en minúscula o cifra. Los decimales no
 *   llevan espacio y nunca cortan. Sin heurística de iniciales: "J. K. Rowling" se parte (raro en un resumen).
 *
 * - `partirFrasesConservador` (revisor de CV, scrubBanned en producción): corta en CADA [.!?] seguido de espacio,
 *   como antes, salvo dentro de "Ph. D.", "M. Sc.", "B. Sc.", "Dr." y "Dra.". Cortar de más es seguro ahí: los
 *   fragmentos limpios se conservan y se vuelven a unir; cortar de menos podría borrar una oración limpia pegada
 *   a una con frase prohibida.
 *
 * Archivo puro, probado en scripts/test-cv-medida.mjs y scripts/test-cv-review.mjs.
 */

// Lista explícita (revisión 10 nov 2026: reglas simples en vez de heurísticas). Se comparan en minúsculas, sin
// espacios internos. Un punto de esta lista no corta solo si la palabra siguiente empieza en minúscula o cifra.
const PROTEGIDAS = new Set(['ph.d.', 'm.sc.', 'b.sc.', 'm.enc.', 'dr.', 'dra.', 'lic.', 'mtro.', 'mtra.', 'e.g.', 'i.e.', 'u.s.', 'u.k.']);

export function partirFrases(texto: string): string[] {
  const SENT = '\u0000';
  // Grados de varias piezas: el espacio interno no es fin de oración ("Ph. D.", "M. Sc.", "B. Sc.", "M. en C.").
  const t = (texto || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bPh\. (?=D\.)/g, `Ph.${SENT}`)
    .replace(/\b([MB])\. (?=Sc\.)/g, `$1.${SENT}`)
    .replace(/\bM\. en C\./g, `M.${SENT}en${SENT}C.`);
  if (!t) return [];
  const out: string[] = [];
  let ini = 0;
  const re = /([.!?]+)(["'”’)\]»]*)(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const fin = m.index + m[0].length;
    const resto = t.slice(fin).trimStart();
    if (resto && m[1] === '.' && !m[2]) {
      const crudo = t.slice(ini, fin).match(/(\S+)$/)?.[1] ?? '';
      const token = crudo.replace(/\u0000/g, '').toLowerCase();
      const previa = (t.slice(ini, fin - crudo.length).trim().split(' ').pop() ?? '').toLowerCase();
      const sigueMinusOCifra = /^[\p{Ll}\d]/u.test(resto);
      const protegida =
        PROTEGIDAS.has(token) || (token === 'al.' && previa === 'et') || (token === 'no.' && /^\d/.test(resto));
      if (protegida && sigueMinusOCifra) continue;
    }
    out.push(t.slice(ini, fin).replace(/\u0000/g, ' ').trim());
    ini = fin;
  }
  const cola = t.slice(ini).replace(/\u0000/g, ' ').trim();
  if (cola) out.push(cola);
  return out.filter((s) => s.length > 1);
}

/** Corte de siempre (cada [.!?] + espacio) salvo dentro de "Ph. D.", "M. Sc.", "B. Sc.", "Dr." y "Dra.". */
export function partirFrasesConservador(texto: string): string[] {
  const SENT = '\u0000';
  const protegido = (texto || '')
    .replace(/\bPh\.\s+(?=D\.)/g, `Ph.${SENT}`)
    .replace(/\b([MB])\.\s+(?=Sc\.)/g, `$1.${SENT}`)
    .replace(/\b(Dra?)\.\s+/g, `$1.${SENT}`);
  return protegido
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\u0000/g, ' '))
    .filter((s) => s.length > 0);
}
