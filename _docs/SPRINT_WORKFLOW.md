# Sprint Workflow · contenido pharma LATAM mensual

> **Última actualización:** 25 jun 2026, después de cerrar el sprint 26 jun → 24 jul 2026.
>
> Este archivo congela el flujo de trabajo que rindió 15 blogs SEO + 13 publicaciones LinkedIn programadas + reglas editoriales registradas en una sola tanda. Léelo antes de arrancar el próximo sprint mensual.

---

## Cadencia y volumen por sprint mensual

**Duración estándar:** 4 semanas calendario (Vie inicial + 4 semanas completas Lun/Mié/Vie).
**Publicaciones LinkedIn por sprint:** 13 total
- 4 Lun (teaser que prepara el viernes)
- 4 Mié (serie "Lo que dicen las vacantes")
- 5 Vie (Newsletter Solca Insight; #1 inicial + 4 semanales)

**Blogs SEO por sprint:** 10-15, en 4 batches de prioridad
- ALTA (5 blogs): mayor volumen de búsqueda, hueco competitivo claro
- MEDIA primera (4 blogs): demanda media, mapean a contenido LinkedIn
- MEDIA segunda (3 blogs): demanda media, completan la matriz
- BAJA (3 blogs): bajo volumen, alto intent o backfill

**Tiempo total estimado:** 8-10 horas de redacción + 2 horas de programación LinkedIn + 1 hora de validación, espaciadas según disponibilidad.

---

## Fase 1 · Research y plan (al inicio del sprint, día 0-1)

### 1.1 · Keyword research

**Inputs:**
- Lista de 10-15 temas seed (mezcla insight editorial + backfill de newsletters viejos sin blog)
- Acceso a Google Search Console (`sc-domain:solcaciencia.com`)

**Output:** `_docs/KEYWORD_RESEARCH_<MES>.md` con matriz de:
- 3-5 keywords primary por blog (con volumen cualitativo: ALTO/MEDIO/BAJO)
- 5-10 long-tail keywords reales (Autocomplete + foros)
- Nota de dificultad competitiva
- Matices por país (MX vs AR vs CO)

**Cómo correr:**
```
Agente general-purpose con prompt detallado, sin Ahrefs/Semrush:
- Google Trends LATAM por raíz
- Google Autocomplete via Chrome
- Reddit/Quora pharma LATAM
- Análisis competitivo de blogs existentes en /blog/
```

### 1.2 · Plan editorial

**Output:** `_docs/PLAN_BLOGS_<MES>.md` con:
- Slug, título SEO (50-65 chars), meta description (130-155 chars con keyword primary natural)
- Source markdown (newsletter o post LinkedIn ya redactado en `_docs/`)
- CTA único (revisar-cv por default, o libro según rotación)
- Series y seriesIndex de frontmatter Astro
- Tags clusterizados
- **Paso editorial obligatorio: checklist de 7 bloques** (copiar de PLAN_BLOGS.md anterior)
- Orden de redacción por batches

### 1.3 · Approve gate

Antes de redactar, Oscar revisa el plan y aprueba:
- Matriz completa OK
- Slugs y títulos OK
- CTA decidida
- Diferenciaciones de blogs solapados resueltas

---

## Fase 2 · Redacción y validación por batches

### 2.1 · Patrón de redacción por blog

**Estructura estable que rinde** (1000-1500 palabras):

1. **Hook (1 párrafo)** que aterriza el problema y promete el insight, incluye keyword primary en primera oración natural.
2. **Sección de contexto** con dato citado (cifra + URL fuente).
3. **3-5 secciones operativas** con H2/H3 descriptivos.
4. **Resumen operativo** que cierra acción concreta.
5. **CTA único** al final, en su propio párrafo separado por hr (`---`).

**Tono:** modo SENTENCIAR. Cero disclaimers de debilidad. Sin emoji.

### 2.2 · Frontmatter Astro

```yaml
---
title: "<50-65 chars con keyword>"
description: "<130-155 chars meta>"
pubDate: <YYYY-MM-DD, día del deploy a Cloudflare>
heroImage: "/blog/<slug>.png"
category: "carreras-pharma"  # o "academia"
tags: [<3-7 tags clusterizados>]
series: "guia-seo" | "newsletter" | "lo-que-dicen-las-vacantes"
seriesIndex: <N> # solo para newsletter o vacantes
readingMinutes: <palabras / 220 redondeado>
---
```

**Regla operativa importante (descubierta 25 jun 2026):** `pubDate = día del deploy`, NO día del newsletter LinkedIn. Los blogs con `pubDate` futura quedan ocultos por el filtro SSR de `/blog/[...slug].astro` línea 16 (`if (post.data.pubDate.getTime() > now.getTime()) return notFound()`) y `/blog/index.astro` línea 14. Esto romperá indexación SEO inmediata si se programa para futuro.

### 2.3 · Generación de covers

**Scripts persistentes** (NO regenerar cada vez):
- `scripts/generate-blog-cover.py` (covers blog SEO sin badge newsletter)
- `scripts/generate-newsletter-cover.py` (covers newsletter Vie con badge #NN)
- `scripts/generate-mier-cover.py` (covers Mié con gráfica de barras)

Layout y paleta canónica en `_docs/TOOLS_REGISTRY.md §5.1`. NO se renegocia.

**Output:** `public/blog/<slug>.png` (1280×720)

### 2.4 · Validación pre-commit por blog

**Bloque automático con bash:**
```bash
# Grep frases prohibidas (autobiografía falsa)
grep -iEn "\b(dms?|charlas?|facultad(es)?|p[aá]gina de carrera[^s]|cada vez que doy|he visto cientos|mis clientes)\b" src/content/blog/<slug>.md

# Frontmatter contra schema Zod
python3 -c "import yaml; ... validar title 8-120, desc 40-180, category enum, heroImage existe"
```

**Bloque manual de revisión** (checklist editorial de 7 bloques, en PLAN_BLOGS.md):
- A · honestidad factual (cero números inventados, cero predicciones)
- B · autobiografía verificable (frases prohibidas + sustituciones permitidas)
- C · fuentes citadas (jerarquía: regulatorio > instituto > asociación > encuesta > academia)
- D · sample bias (en blogs basados en vacantes curadas manualmente)
- E · voz Solca (sentenciar o silencio)
- F · SEO técnico (title, meta, slug, tags, readingMinutes)
- G · validación cruzada (releer primer + último párrafo, `astro check`)

---

## Fase 3 · Deploy (Oscar, fuera de sandbox)

**Comandos:**
```bash
cd /Users/oscar/Downloads/solca/website
npx astro check        # validación full en macOS (no funciona en sandbox por rollup ARM)
git add src/content/blog/*.md public/blog/*.png scripts/generate-blog-cover.py _docs/PLAN_BLOGS.md _docs/KEYWORD_RESEARCH_<MES>.md _docs/RESEARCH_*.md
git commit -m "feat(blog): sprint <mes> · <N> blogs SEO pharma LATAM"
git push origin main
npm run deploy         # Cloudflare Workers
```

**Verificación post-deploy:** `curl https://solcaciencia.com/blog/<slug>` debe responder con HTML válido, og:image en metadata, link al cover.

---

## Fase 4 · LinkedIn (después del deploy de blogs)

### 4.1 · Reglas editoriales · OSCAR_PROFILE.md §reglas transversales

**Sub-regla 7b · Link al blog ≠ CTA** (establecida 25 jun 2026)
- En newsletters/posts LinkedIn que tengan blog correspondiente en `solcaciencia.com/blog/<slug>`, el link va **dentro del cuerpo** como "versión completa en…" o "más fuentes en…"
- Es referencia/cita, no acción que se pide al lector
- El CTA único al final sigue siendo revisar-cv (o libro según rotación)
- Inserción a **media-altura del cuerpo**, no al cierre

**Sub-regla 7c · Excepción de 7b para ediciones con vacantes** (establecida 25 jun 2026)
- Las ediciones del Newsletter Solca Insight con sección de vacantes (cadencia cada 4 vie) **NO insertan link al blog editorial**
- Razón: la promesa de valor es la curación de vacantes, no el insight editorial
- El listado de vacantes ES el contenido principal

### 4.2 · Workflow LinkedIn óptimo (para evitar edición posterior)

**Cuando programes una publicación con blog ya deployado:**

1. Redacta el cuerpo del post/newsletter en `_docs/`
2. **Inserta el link al blog en el cuerpo desde la redacción**, no después
3. Programa en LinkedIn con el texto final
4. Cero edición posterior necesaria

**Si el blog se deploya DESPUÉS de programar la publicación LinkedIn:**

1. Abre LinkedIn → Crear publicación (modal "Crear publicación")
2. Click ícono reloj → "Ver todas las publicaciones programadas"
3. Para cada publicación con blog deployado:
   - Click "..." → "Editar publicación"
   - Insertar link a media-altura del cuerpo
   - Click "Programar" para guardar

**Trick técnico Chrome MCP:** el modal de LinkedIn vive en shadow DOM. JS para acceder:
```js
let shadowHost = null;
document.querySelectorAll('*').forEach(el => {
  if (el.shadowRoot && el.className && el.className.includes('theme--light')) shadowHost = el;
});
const sr = shadowHost.shadowRoot;
const items = sr.querySelectorAll('.share-post-list-view__item');
// scroll: sr.querySelector('.share-box-modal-content__container').scrollTop = N
```

### 4.3 · LinkedIn modal "Publicaciones programadas" usa lazy load

**Hallazgo 25 jun 2026 corregido:** LinkedIn **no limita el número** de publicaciones programadas en cuenta gratis. El modal "Publicaciones programadas" usa **lazy loading que solo se activa con scroll real**, no programático.

**Comportamiento observado:**
- Al abrir el modal, carga inicialmente 10 items.
- `scrollable.scrollTop = scrollHeight` via JS no dispara carga adicional.
- `mcp__Claude_in_Chrome__computer scroll` (wheel real) sí dispara lazy load. Aparecen items 11, 12, etc.
- Después de 2-3 scrolls reales con espera, se cargan todos los items.

**Implicación operativa para Chrome MCP:**
```js
// Forma INCORRECTA (no carga lazy):
scrollable.scrollTop = scrollable.scrollHeight;

// Forma CORRECTA (Chrome MCP wheel real, dispara lazy):
mcp__Claude_in_Chrome__computer scroll with scroll_amount=10
// repetir 2-3 veces con wait entre cada uno
```

**Programación operativa:** programa los 13 items del sprint al inicio en una sola sesión. LinkedIn los acepta todos. El error inicial fue creer en un límite que no existe — verificar siempre con scroll real antes de concluir.

---

## Fase 5 · Cierre y registro

### 5.1 · Actualización OSCAR_PROFILE.md

Si en el sprint emergió nueva regla editorial, registrarla bajo §reglas transversales con:
- Fecha de establecimiento
- Detonante (qué error o pregunta la generó)
- Aplicación operativa

### 5.2 · Actualización NEWSLETTER_RESCHEDULE_PLAN.md

Anotar la cadencia real (cada 4 viernes con vacantes: #1 = 22 may, #2 = 26 jun, #3 = 24 jul, #4 = 21 ago).

### 5.3 · Cierre TaskList

Marcar todas las tareas del sprint como completed con descripción que liste qué cambió.

---

## Anti-patrones detectados (no repetir)

1. **Programar pubDate del blog en el futuro** alineado con fecha del newsletter LinkedIn → el blog queda invisible hasta esa fecha. Solución: pubDate = día del deploy.

2. **Editar el texto del newsletter LinkedIn programado después de su creación inicial** → el modal a veces se interfiere con el texto previo y borra contenido. Solución: insertar todo desde la redacción original.

3. **Asumir que el JS programático scrolleó el modal "Publicaciones programadas"** → el lazy load solo se activa con scroll wheel real (Chrome MCP `computer scroll`), no con `scrollTop = scrollHeight`. Solución: hacer 2-3 scrolls reales con espera entre cada uno antes de contar items.

4. **Generar covers ad-hoc en chat con Pillow** → cada sesión se reconstruía el código. Solución: scripts commitidos en `scripts/`.

5. **No `git push` desde sandbox** → regla persistente. Oscar hace deploy manual en macOS local.

6. **Frases autobiográficas falsas** ("mis DMs preguntan", "en charlas en facultades") → grep automático antes de commit.

7. **Disclaimers de debilidad** ("no encontré fuente concluyente", "es solo conjetura") → modo SENTENCIAR o SILENCIO, sin zona gris.

8. **Sample bias estadístico en vacantes curadas manualmente** → reformular a observación cualitativa "en la muestra revisada".

9. **Inventar bonos, salarios o cifras de mercado** → cada cifra con URL fuente o se elimina la frase.

10. **Predicciones más allá del horizonte de la fuente** → cero predicciones propias, solo se citan proyecciones de fuentes externas.

---

## Métricas del sprint 26 jun → 24 jul 2026 (baseline para próximos)

- 15 blogs SEO redactados, validados y deployados
- ~18,000 palabras de contenido
- ~30 fuentes externas citadas
- 12 publicaciones LinkedIn programadas (Vie 26 jun → Mié 22 jul). Vie 24 jul N#12 quedó pendiente como STUB del PDF julio.
- 10 publicaciones LinkedIn con link al blog en cuerpo (sub-regla 7b)
- 2 publicaciones sin link por sub-regla 7c (Vie 26 jun N#8 con vacantes + Lun 20 jul teaser de vacantes #3)
- 0 frases prohibidas detectadas en grep final
- 0 cifras inventadas
- 0 predicciones propias
- 2 reglas editoriales nuevas registradas (7b y 7c)
- Tiempo total real: ~3 sesiones intensas en 2 días

**Próximo sprint:** alcance Lun 27 jul → Vie 21 ago (4 semanas + Vie inicial). Newsletter #4 con vacantes = Vie 21 ago.
