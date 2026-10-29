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
cd /Users/oscar/proyectos/solca-ciencia/solca/website
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

### 4.4 · Programación automatizada desde Claude in Chrome (probado 14 oct 2026, semana W42)

Las 4 piezas de una semana (3 posts de feed + 1 artículo de Solca Insight) se programan sin intervención manual salvo el OK de Oscar. Requisitos: extensión Claude in Chrome con sesión iniciada y sesión de LinkedIn abierta.

1. **Post de texto:** feed → "Crear publicación" → clic en el editor → escribir el texto → reloj (abajo, junto a Publicar) → fecha `dd/mm/aaaa` y elegir el día en el calendario → hora: escribir `09:00` y elegir la opción de la lista → Siguiente → Programar. La zona horaria es la de la cuenta (hora estándar central).
2. **Imagen o PDF (carrusel):** el modal vive en shadow DOM y su `input[type=file]` no aparece en el árbol de accesibilidad. Truco: crear con JS un `<input type=file>` visible en `document.body`, cargarle el archivo con `file_upload`, y copiar `files` al input real (buscado recorriendo `shadowRoot`, `#media-editor-file-selector__file-input` para imagen o `input[accept*=pdf]` para documento) con `DataTransfer` + evento `change`. El documento pide título antes de "Hecho".
3. **Artículo de newsletter (`/article/new/`):** ya sale ligado a Solca Insight. La portada no tiene input en el DOM hasta el clic: parchar `HTMLInputElement.prototype.click` para que, cuando LinkedIn cree el input y llame `click()`, reciba el archivo del input proxy. El cuerpo se pega como HTML con un `ClipboardEvent('paste')` sobre `.ProseMirror` (los `h2` quedan como `h3`, listas y enlaces se conservan). Siguiente → texto para el feed → reloj → fecha y hora → Programar. El texto del feed se borra al volver del diálogo de fecha: escribirlo después.
4. **Verificación:** composer → reloj → "Ver todas las publicaciones programadas" y bajar con scroll real (lazy load).

Cuidado: esperar a que cargue la página antes de cada clic por coordenadas; un clic sobre el feed sin cargar abre perfiles ajenos.

Aprendizajes W43-W44 (14 oct 2026):
- Límite de 3000 caracteres por post: medir antes de escribir.
- En artículos, el texto del enlace debe ser descriptivo; si parece URL, LinkedIn lo autoenlaza sin la query string (se pierden los UTM).
- LinkedIn descarta en el paste los `href` con `|` sin codificar: en enlaces a Hotmart usar `sck=li%7C<campaña>`.
- Si el post lleva URL, la tarjeta de vista previa oculta la barra de adjuntos: cerrar la tarjeta (X) antes de adjuntar el PDF.
- En el diálogo de fecha, si se encoge al elegir la hora, "Siguiente" queda en y≈322; un clic en la posición vieja abre "Guardar como borrador" (cerrar con X).

Aprendizajes W45 (29 oct 2026):
- El navegador interno de la app no puede leer archivos locales ni descargarlos desde otro sitio (LinkedIn bloquea por CSP): sirve para posts de solo texto. Imagen, PDF y portada se suben desde Claude in Chrome.
- El composer de posts ya no usa calendario: fecha y hora son campos de texto (`dd/mm/aaaa`, Tab, luego hora y elegir la opción). El de artículos sigue con calendario.
- Para el documento (PDF) el input no existe hasta el clic en "Seleccionar archivo": usar el parche de `HTMLInputElement.prototype.click` también ahí.
- Etiquetar empresas: escribir `@Nombre` y elegir la página en la lista. La mención inserta el nombre completo (p. ej. "Eli Lilly and Company") y suma caracteres: medir contra el límite de 3000 después de etiquetar.
- El HTML del artículo con UTM se pasa en base64 al `ClipboardEvent('paste')`: la herramienta de JS bloquea salidas con query strings.

### 4.5 · Semana de vacantes (workflow v2, en construcción desde el 14 oct 2026)

Al planear un sprint, la semana de vacantes se aparta primero (lun-vie que termina en el viernes de vacantes según `NEWSLETTER_TOPICS_REGISTRY.md`). Ninguna otra semana del sprint se programa en ese espacio.

**Cuándo se hace la búsqueda (regla de Oscar, 15 oct 2026, aplica a cada sprint mensual):** el jueves de la semana anterior a la publicación de vacantes. Si el sprint arranca la semana previa a la de vacantes, la búsqueda se hace al iniciar el sprint. Ejemplo: edición del vie 30 oct 2026 → búsqueda el jue 22 oct.

**Captura completa para el análisis semestral:** cada vacante se abre en su página (`linkedin.com/jobs/view/<id>`) el mismo día de la búsqueda (después cierran y desaparecen) y se guarda:
- vacante: título, empresa, ubicación, modalidad, jornada, antigüedad, enlace;
- descripción completa ("Acerca del empleo");
- datos de LinkedIn: clics o solicitudes, "evaluando solicitudes de forma activa", solicitud sencilla;
- solicitantes (sin Premium solo el grupo principal): nivel de responsabilidad (%) y nivel educativo (%);
- empresa: sector, tamaño, seguidores, empleados en LinkedIn, crecimiento de plantilla.
No se guardan nombres de reclutadores ni contactos. Ritmo: 10-15 s por vacante (80 vacantes ≈ 20 min) para no disparar límites de LinkedIn. Todo va a `vacantes/busquedas/<fecha>/` (JSON y CSV) y se acumula para el análisis de cada seis meses.

En pruebas del workflow se corre una muestra pequeña, no la búsqueda completa.

Reglas de Oscar (14 oct 2026):
1. **Búsqueda:** la hace Claude en LinkedIn Jobs (no Oscar). Mínimo 80 vacantes por edición, LATAM.
2. **Datos por vacante:** puesto, empresa, país y ciudad, modalidad, nivel, fecha de publicación, enlace y los datos de aplicantes que LinkedIn muestra en la vacante (nivel de experiencia de los aplicantes y los otros datos que aparezcan). Se registran tal cual los muestra LinkedIn; no se infieren.
3. **Verificación:** vacante cerrada o que no abre, sale.
4. **Newsletter:** tres vacantes curadas por país.
5. **Página de blog de vacantes:** contiene todas las vacantes encontradas (80+) con su enlace; se actualiza en cada sprint de vacantes y cierra con un CTA fijo al simulador.
6. **Dataset:** cada búsqueda se guarda con fecha en `vacantes/listados/` para el resumen semestral.

Medición (decidida 15 oct 2026, opción 1): el newsletter y los posts enlazan a la página de vacantes con UTM y ancla por vacante; en la página, cada enlace a LinkedIn dispara `vacancy_clicked` con `vacante_id`, `rol`, `pais`, `empresa`, `tipo_empresa`, `nivel`, `edicion` y la campaña de origen. Objetivo de reporte: cada semestre, qué roles interesan más al público (clics por rol) y, en segundo plano, país, empresa y tipo de empresa.

Método de búsqueda (prueba del 15 oct 2026):
- LinkedIn Jobs con búsqueda con IA: `keywords=<rol>&geoId=<país>&f_TPR=r604800` (filtro "Última semana": solo vacantes publicadas hace 7 días o menos; regla de Oscar, 15 oct 2026). La prueba del 15 oct usó el último mes (`r2592000`); no repetir. `location=` se ignora; usar geoId (MX 103323778 · BR 106057199 · AR 100446943 · CO 100876405 · CL 104621616 · PE 102927786).
- Recolector: `vacantes/scripts/linkedin_collector.js` (solo coincidencias exactas, antes de "Hemos encontrado más resultados relacionados"). Clasificador: `vacantes/scripts/clasificar_vacantes.py` → `vacantes/busquedas/<fecha>/vacantes.json|csv`.
- Datos por vacante disponibles sin Premium: antigüedad, clics o solicitudes ("Más de 100 personas han hecho clic"), modalidad, jornada, "evaluando solicitudes de forma activa", solicitud sencilla. La comparación de aplicantes (nivel de experiencia, educación) requiere LinkedIn Premium; la cuenta no lo tiene activo.
- El reparto por rol y país refleja los topes por consulta (6-8 vacantes por rol y país), no el mercado. El nivel se infiere del título.

Estado del sprint W42-W45 tras el ajuste: W42 CRA (19-23 oct) · vacantes (26-30 oct, aún sin subir) · W44 FV (2-6 nov) · W45 Consulting (9-13 nov). W43 Regulatory se movió a 16-20 nov (mismas horas y textos; los `utm_campaign` conservan el prefijo `oct-w4`).

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
