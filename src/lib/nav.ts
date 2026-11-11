/**
 * Menú del encabezado, igual en todas las páginas (11 nov 2026). Antes cada página tenía su propia lista y en el
 * celular, al abrir el menú, faltaban secciones según la página. Cada página pinta estos enlaces dentro de su
 * `<div class="nav-links">` (así conservan los estilos de esa página, p. ej. el fondo claro del simulador).
 * `inicio`: en la portada los enlaces a secciones van sin "/" para que el resaltado al hacer scroll los reconozca.
 */
export interface NavLink {
  href: string;
  texto: string;
}

const LINKS: NavLink[] = [
  { href: '/#libros', texto: 'Libros' },
  { href: '/vacantes', texto: 'Vacantes' },
  { href: '/#curso', texto: 'Curso' },
  { href: '/simulador-entrevistas', texto: 'Simulador' },
  { href: '/blog', texto: 'Blog' },
  { href: '/quiz-rol', texto: 'Quiz' },
  { href: '/revisar-cv', texto: 'Revisar CV' },
  { href: '/#sobre', texto: 'Sobre' },
  { href: '/contacto', texto: 'Contacto' },
];

export function navLinks(opts: { inicio?: boolean } = {}): NavLink[] {
  return opts.inicio ? LINKS.map((l) => ({ ...l, href: l.href.startsWith('/#') ? l.href.slice(1) : l.href })) : LINKS;
}

/** true si el enlace corresponde a la página actual (para aria-current). */
export function esActual(href: string, path: string): boolean {
  if (href.includes('#')) return false;
  const limpio = (p: string) => p.replace(/\/+$/, '') || '/';
  return limpio(path) === limpio(href) || limpio(path).startsWith(limpio(href) + '/');
}
