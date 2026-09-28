// Middleware de normalización de URL · 21 sep 2026
//
// Problema que resuelve: `trailingSlash: 'ignore'` en astro.config hace que
// /blog/mi-post y /blog/mi-post/ devuelvan las dos un 200 con contenido
// idéntico. Search Console detectó ocho pares así, con los clicks repartidos
// entre las dos variantes en lugar de sumar en una.
//
// El <link rel="canonical"> ya apunta a la versión con slash (ver BaseLayout),
// pero el canonical es una sugerencia: Google puede ignorarlo. Un 301 no.
// Además consolida el link equity de los enlaces externos que apunten a la
// variante sin slash.
//
// Alcance deliberadamente estrecho. Solo redirige cuando se cumple TODO:
//   - método GET o HEAD (nunca POST: rompería los formularios del sitio)
//   - la ruta no termina en /
//   - la última porción de la ruta no contiene punto (no es archivo)
//   - no está bajo /api/ (los endpoints no llevan slash y algunos son POST)
//
// Si algo de esto se rompe en producción, borrar este archivo restaura el
// comportamiento anterior: el canonical de BaseLayout sigue siendo correcto
// por su cuenta.
import { defineMiddleware } from 'astro:middleware';

// Rutas que NO se normalizan, y por qué cada una:
//
//   /api/, /_          endpoints y assets internos de Astro.
//   /quiz              ya tiene un 301 a /quiz-rol en astro.config. Si el
//                      middleware lo convirtiera antes en /quiz/, se armaría
//                      una cadena de redirects o un 404, y se perdería la
//                      recuperación de los 13 posts que enlazaban a /quiz.
//   /ddm               redirect de QR del libro impreso. Un salto extra en un
//                      código ya impreso no se puede revertir.
//   /simulador-entrevistas/<algo>  rutas de la app del simulador (sesion,
//                      gracias, mis-reportes). Son producto de pago, no
//                      páginas indexables; no se tocan. La landing
//                      /simulador-entrevistas sí se normaliza: esa sí es
//                      página de marketing y sí aparece en búsqueda.
const SKIP_PREFIXES = ['/api/', '/_', '/simulador-entrevistas/'];

// Exactas, no prefijos: '/quiz' como prefijo se tragaría '/quiz-rol', que sí
// queremos normalizar.
const SKIP_EXACT = new Set(['/quiz', '/ddm']);

export const onRequest = defineMiddleware((context, next) => {
  const { request } = context;
  const method = request.method.toUpperCase();

  if (method !== 'GET' && method !== 'HEAD') return next();

  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === '/' || pathname.endsWith('/')) return next();
  if (SKIP_EXACT.has(pathname)) return next();
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return next();

  // Punto en la última porción = archivo estático o endpoint con extensión
  // (/rss.xml, /llms.txt, /robots.txt, /blog/foo.png). No llevan slash.
  const last = pathname.split('/').pop();
  if (!last || last.includes('.')) return next();

  url.pathname = `${pathname}/`;
  return context.redirect(url.toString(), 301);
});
