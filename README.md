# Solca · website

Sitio del proyecto **Solca · Ciencia y Consultoría** (Oscar Solís Castro).

Stack: [Astro 5](https://astro.build) (zero-JS estático) · CSS plano · deploy a Cloudflare Pages · DNS Cloudflare · email custom vía Cloudflare Email Routing · newsletter en Beehiiv.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:4321/

## Build de producción

```bash
npm run build
```

Output en `dist/`. Cloudflare Pages corre este comando automáticamente en cada push a `main`.

## Estructura

```
src/
├── pages/        rutas del sitio (cada .astro = una URL)
│   └── index.astro       landing actual (port del HTML legacy)
├── layouts/      layouts compartidos (head, body wrapping)
├── components/   componentes Astro reutilizables (Fase 2+)
├── content/      colecciones de contenido — blog, newsletter (Fase 2)
├── scripts/      JS del lado cliente
└── styles/       CSS global

public/           assets estáticos servidos tal cual (favicon, og-image, PDFs)
_legacy/          versión anterior en HTML/CSS plano · referencia, no se incluye en build
_docs/            estrategia, calendario, templates · referencia, no se incluye en build
```

## Roadmap

- **Fase 1 ·** init Astro + port de la landing (← estás aquí)
- **Fase 2 ·** páginas dedicadas por libro/curso, blog en Markdown, lead magnet PDF
- **Fase 3 ·** registro de `solca.science`, DNS, email custom (`oscar@solca.science`), Beehiiv para newsletter
- **Fase 4 ·** SEO técnico, schema.org, Search Console, internal linking

## Notas

- Las imágenes de portadas de libros van en `public/covers/portada_pm.png|portada_msl.png|portada_cr.png`.
- La foto del about va en `public/oscar.jpg`.
- El PDF de la guía gratis (lead magnet) va en `public/guia-pdf-28pp.pdf`.
- El placeholder `og-image.png` va en `public/og-image.png` (recomendado 1200×630 px).

— Oscar Solís Castro · Solca · Ciencia y Consultoría
