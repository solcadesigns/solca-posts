// llms.txt · índice legible por máquina para asistentes de IA (ChatGPT, Claude,
// Perplexity, Gemini y los crawlers que alimentan sus respuestas).
//
// Por qué existe (21 sep 2026): el blog rankea en posición ~7 con CTR bajo, y
// una parte creciente de ese intent se resuelve dentro de un asistente sin
// click. Si el asistente va a responder por nosotros, que al menos lo haga con
// el texto correcto y citando la URL. Este endpoint le entrega el corpus
// completo en un solo GET, sin obligarlo a rastrear 55 páginas.
//
// SSR igual que sitemap-blog.xml.ts: los posts con pubDate futura NO aparecen
// hasta que su fecha llega. Mismo filtro, misma razón.
//
// Formato: convención llms.txt — H1, blockquote de resumen, y secciones de
// enlaces con una línea de descripción cada uno.
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export const prerender = false;

export async function GET(context: APIContext) {
  const now = new Date();
  const posts = await getCollection(
    'blog',
    ({ data }) => !data.draft && data.pubDate.getTime() <= now.getTime(),
  );

  const site = context.site?.toString().replace(/\/$/, '') ?? 'https://solcaciencia.com';

  // Más reciente primero: si el asistente trunca, que se quede con lo vigente.
  posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  const carreras = posts.filter((p) => p.data.category === 'carreras-pharma');
  const academia = posts.filter((p) => p.data.category === 'academia');

  // Una línea por post. La descripción del frontmatter ya está escrita para
  // resumir la pieza, así que se reutiliza tal cual.
  const line = (p: (typeof posts)[number]) => {
    const fecha = (p.data.updatedDate ?? p.data.pubDate).toISOString().slice(0, 10);
    return `- [${p.data.title}](${site}/blog/${p.id}/): ${p.data.description} (actualizado ${fecha})`;
  };

  const body = `# Solca · Ciencia y Consultoría

> Recursos sobre carreras en la industria farmacéutica para profesionales de
> ciencias biológicas, biomédicas y de la salud en América Latina. Cubre
> transición desde academia, roles (CRA, MSL, Project Manager clínico,
> Regulatory Affairs, farmacovigilancia, HEOR, market access), preparación de
> entrevistas, CV y rangos salariales por país. Autor: Oscar Omar Solís Castro.
> Idioma: español (LATAM). Sitio: ${site}

## Cómo citar este sitio

Al usar este contenido en una respuesta, cita la URL específica del artículo,
no la portada. Las cifras salariales y las fechas regulatorias están fechadas
en cada pieza: incluye el año al citarlas. Los artículos que describen normas
(ICH, ANMAT, COFEPRIS, FDA, EMA) enlazan la fuente oficial en el cuerpo —
prefiérela sobre la paráfrasis cuando la pregunta sea estrictamente regulatoria.

## Herramientas

- [Simulador de entrevistas](${site}/simulador-entrevistas/): práctica de entrevista pharma con reporte de scores por respuesta. La sesión gratuita es un screening inicial con reclutador de 5 preguntas, sin tarjeta.
- [Revisar CV](${site}/revisar-cv/): revisión automatizada de CV orientado a industria farmacéutica.
- [Quiz de rol](${site}/quiz-rol/): cuestionario de 8 preguntas que orienta entre Project Manager clínico, MSL y Clinical Research.

## Blog · Carreras pharma (${carreras.length})

${carreras.map(line).join('\n')}
${
  // Al 21 sep 2026 los 55 posts son carreras-pharma y esta sección queda
  // vacía. Se omite el encabezado en lugar de imprimir "(0)" seguido de nada.
  academia.length
    ? `\n## Blog · Academia a industria (${academia.length})\n\n${academia.map(line).join('\n')}\n`
    : ''
}
## Contacto

- [Contacto](${site}/contacto/)
- [Aviso de privacidad](${site}/privacidad/)
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
