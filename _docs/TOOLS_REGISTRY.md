# Solca · Registro de herramientas

> **Propósito:** documento de referencia para que cualquier sesión nueva con Claude (o cualquier colaborador) tenga el inventario completo de herramientas operativas que existen en el ecosistema Solca, qué hace cada una, dónde vive el código, y cómo se usa o se replica.
>
> **Cómo usarlo:** abre este archivo al inicio de cada sesión nueva si vas a trabajar con cualquiera de estas herramientas. Está pensado para sobrevivir pérdidas de contexto.
>
> **Última actualización:** 25 may 2026.

---

## Tabla de contenidos

1. Herramientas web públicas (solcaciencia.com)
2. App interna (app.solcalegal.com)
3. Apps Script CRM_Solca
4. Pipeline de análisis de vacantes
5. Generadores de imagen (portadas + banner)
6. Trackers operativos
7. Reglas editoriales transversales

---

## 1 · Herramientas web públicas (solcaciencia.com)

Sitio en Astro 5 + Cloudflare Workers. Código en `/Users/oscar/Downloads/solca/website/`.

### 1.1 · `/revisar-cv` · Revisión de CV gratuita

- **Página:** `src/pages/revisar-cv.astro`
- **Función:** el usuario sube su CV en PDF, responde un mini-survey opcional (etapa de carrera, área, país), y recibe en pantalla un análisis tipo "primer paso" con feedback de estructura, headline y tres recomendaciones operativas.
- **Genera:** PDF descargable con el análisis (vía jsPDF en el cliente).
- **API endpoints relacionados:**
  - `POST /api/cv-review` — recibe el CV, llama al modelo, devuelve el análisis estructurado.
  - `POST /api/cv-survey` — guarda las respuestas anónimas del survey en KV `CV_METRICS`.
  - `GET  /api/cv-stats?key=…` — devuelve métricas agregadas (per-question response rate, cross-tabs vs stage). Requiere `STATS_KEY` env var.
  - `GET  /api/cv-export?key=…` — exporta el dataset crudo.
- **KV binding:** `CV_METRICS` en Cloudflare.
- **CTA principal:** menciónado en banners, newsletters y outreach LinkedIn (`solcaciencia.com/revisar-cv`).
- **Uso editorial:** se referencia en cada artículo de la serie miércoles "Lo que dicen las vacantes".

### 1.2 · `/quiz-rol` · Quiz de rol pharma

- **Página:** `src/pages/quiz-rol.astro`
- **Función:** quiz interactivo que sugiere qué rol pharma se ajusta más al perfil del usuario (MSL, CRA, Medical Affairs, HEOR, Regulatory, etc.).
- **API endpoints:**
  - `POST /api/quiz-subscribe` — suscribe el email a MailerLite con grupo según resultado del quiz.
  - `GET  /api/quiz-stats?key=…` — métricas agregadas.
  - `GET  /api/quiz-export?key=…` — dataset crudo.
- **KV binding:** `QUIZ_METRICS`.
- **Uso editorial:** próximo ciclo de outreach LinkedIn (después del de revisar-cv) — pendiente de programación.

### 1.3 · `/contacto`

- **Página:** `src/pages/contacto.astro`
- **API:** `POST /api/contact` — envía el mensaje vía MailerLite o reenvío a `hello@solcaciencia.com`.
- **Fallback declarado en pantalla:** si el formulario falla, instruye al usuario a escribir directo a `hello@solcaciencia.com`.

### 1.4 · `/blog` · Blog SEO (NUEVO · 25 may 2026)

- **Páginas:**
  - `/blog` — índice agrupado por categoría, ordenado más reciente primero.
  - `/blog/<slug>` — post individual, prerenderizado a HTML estático (SEO óptimo).
  - `/rss.xml` — feed RSS automático.
  - `/sitemap-index.xml` + `/sitemap-0.xml` — sitemaps automáticos vía `@astrojs/sitemap`.
- **Stack:** Astro Content Collections con Zod schema validation. Posts en markdown en `src/content/blog/*.md`.
- **Layouts:** `BlogPostLayout.astro` (extiende `BaseLayout` con JSON-LD Article schema, hero image, byline, tags, CTA box). Estilo consistente con paleta Solca.
- **Categorías** (decisión editorial 25 may 2026):
  - `carreras-pharma` — posts pharma puro, también cross-posteados a LinkedIn (versión adaptada).
  - `academia` — ángulo académico (PhD, papers, posgrados) **siempre cerrando con "y cómo esto te sirve para X rol en pharma"**. Solo blog, no LinkedIn.
- **Frontmatter requerido** (Zod schema en `src/content.config.ts`):
  - `title`, `description` (40-180 chars), `pubDate` (ISO), `heroImage` (path en /public), `category`, `tags[]`
  - Opcionales: `updatedDate`, `series`, `seriesIndex`, `readingMinutes`, `canonical`, `draft`
- **SEO automático:**
  - canonical default = URL del propio post en solcaciencia.com (refuerza que blog es autoritativo vs LinkedIn newsletter)
  - JSON-LD Article schema con datePublished, author, publisher, articleSection, keywords
  - OG type `article` (no `website`) para previews enriquecidos
  - sitemap excluye `/api/*` y rutas internas
- **Posts migrados (3 iniciales):**
  - `despues-del-cv.md` — Newsletter 22 may (LinkedIn checkpoints)
  - `clinical-ops-40-pharma-latam.md` — Miércoles 27 may (data drop)
  - `msl-vs-visitador-vs-medical-director.md` — Newsletter 12 jun
- **Flow editorial pivotado (a partir de 25 may 2026):**
  1. **Blog primero.** Newsletter/miércoles se escribe primero como post de blog (largo, SEO-optimizado).
  2. **LinkedIn después.** Versión corta adaptada para feed, con link al post completo.
  3. Esto asegura que Google ve TU URL como original.
- **Cómo crear un post nuevo:**
  1. Crear `src/content/blog/<slug>.md` con frontmatter del schema.
  2. Subir hero image a `public/blog/<slug>.png` (1280×720 estándar Solca).
  3. `git commit && git push` (o `npm run deploy`).
  4. Verificar canonical y JSON-LD en el HTML rendered.
- **Build limpio verificado 25 may 2026** con `npm run build`. Output:
  - 3 posts prerenderizados a HTML estático.
  - sitemap-index.xml + sitemap-0.xml con 8 URLs.
  - rss.xml con los 3 posts ordenados.
- **Horizonte SEO esperado:** Google tarda 3-6 meses en indexar bien dominios nuevos para blog. Tráfico orgánico relevante esperado a partir del mes 4-6 si se mantiene cadencia de 1-2 posts/semana con keywords investigadas.

### 1.5 · `/privacidad`

- **Página:** `src/pages/privacidad.astro`
- **Contiene:** aviso completo LFPDPPP/GDPR. Designa a `hello@solcaciencia.com` como buzón para ejercer derechos ARCO. Plazo de respuesta declarado: 20 días hábiles.

### Email del dominio · configuración

- MX: Cloudflare Email Routing (`route1/2/3.mx.cloudflare.net`).
- Dirección oficial publicada: `hello@solcaciencia.com` (única dirección publicada en privacidad + contacto + footer de PDFs de `/revisar-cv`).
- **Catch-all activo** (habilitado 25 may 2026): cualquier dirección `*@solcaciencia.com` → `solcadesigns@gmail.com`. Si en el futuro se publica una nueva dirección de marketing/operativa, basta con que llegue como catch-all; no requiere crear regla específica salvo que quieras routing diferente por dirección.
- Forwarding destination: `solcadesigns@gmail.com` (pre-aprobado por ser owner de la cuenta Cloudflare).
- SPF: `v=spf1 include:_spf.mlsend.com include:_spf.mx.cloudflare.net ~all` (no duplicar — ya mergeado con MailerLite).
- DMARC: **publicado 25 may 2026 en modo monitoreo.** `v=DMARC1; p=none; rua=mailto:hello@solcaciencia.com; aspf=r; adkim=r; pct=100`. No bloquea ni cuarentena — solo recibe reportes agregados diarios en XML de Gmail/Yahoo/Microsoft. Plan: revisar reportes en 2-4 semanas y considerar endurecer a `p=quarantine` si el flujo está limpio (ningún sender legítimo failing alignment).
- MailerLite verificación: `mailerlite-domain-verification=7735f213cc916f7a0e83fea5449301bca894c6b3`.
- **Gotcha conocido:** ocasionalmente Cloudflare reporta "Delivery Failed" con error de TLS contra `gmail-smtp-in.l.google.com`. Suele ser transitorio (path Cloudflare → Google). Reintentar antes de escalar; Cloudflare reintenta automáticamente.
- **Automatización bloqueada:** Claude in Chrome **no puede interactuar** con `dash.cloudflare.com` por política de seguridad de la extensión (host bloqueado, igual que AWS/Stripe). Cualquier cambio en Email Routing requiere ejecución manual de Oscar.
- **MTA-STS · pospuesto deliberadamente (25 may 2026).** Cloudflare no surfacea MTA-STS como toggle automático en este cluster/cuenta; el setup manual requiere un Cloudflare Worker chico + 3 registros DNS (CNAME `mta-sts.solcaciencia.com` + TXT `_mta-sts` + TXT `_smtp._tls` para reportes TLS-RPT). Decisión consciente de saltarlo por marginal costo/beneficio dado el volumen actual de Solca. **Detonantes para retomar:** (a) un cliente o partner enterprise audita y lo exige; (b) el newsletter cruza 5k envíos/día (mínimo Gmail/Yahoo 2024+); (c) aparece evidencia de ataque TLS downgrade en algún proveedor. Mientras tanto, SPF + DKIM + DMARC + catch-all cubren ~95% del valor.
- **Reportes DMARC en Gmail:** filtro creado (25 may 2026) que matchea `subject:(Report-ID OR "Report domain" OR "DMARC Aggregate Report") to:hello@solcaciencia.com`, skip inbox, label `DMARC Reports`. Revisar la etiqueta cada 2-4 semanas y considerar endurecer DMARC a `p=quarantine` si todos los senders legítimos están alineando.

---

## 2 · App interna (app.solcalegal.com · solca_app 2)

Repo en `/Users/oscar/Downloads/solca_app 2/`. Next.js 14 App Router + NextAuth Google sign-in. Sirve a la operación legal/inmobiliaria de la familia.

### 2.1 · `/registro` · Formulario de leads y propiedades

- **Función:** captura leads + alta de propiedades. Escribe a Google Sheets vía service account.
- **Módulos backend en `lib/`:**
  - `leads-sheet.js` — escritura a hoja "Base limpia" del CRM_Solca.
  - `inmuebles-sheet.js` — fichas técnicas → hoja "Descripción" del sheet Inmuebles (ID `1Prlo26uW0hXy-yAEtmR_BbPB-6CwuIZvJP2pmDRtjWE`).
  - `recibos-sheet.js`, `opinion-valor-sheet.js` — recibos y opiniones de valor.
  - `google-auth.js` — service account auth.

### 2.2 · Inmuebles · ficha técnica

- **Archivo clave:** `lib/inmuebles-sheet.js`.
- **Sheet ID:** env var `INMUEBLES_SHEET_ID` (= `1Prlo26uW0hXy-yAEtmR_BbPB-6CwuIZvJP2pmDRtjWE`).
- **Tab destino:** `Descripción` (no `Autocrat` — el flujo viejo de Autocrat fue migrado).
- **Columnas A–AA (27):** definidas en const `COL`. La app escribe A:AA. Columnas AB–AE son gestionadas externamente (no sobrescribir).
- **Funciones exportadas:**
  - `getNextCodigo()` / `getNextCodigoNumber()` — sugiere el siguiente código `00 N`. Respeta floor `FICHA_NEXT_CODIGO_FLOOR` (env var).
  - `appendFichaRow(data)` — agrega nueva fila.
  - `listProperties()` — lista todas las propiedades existentes (para el picker).
  - `getPropertyByCodigo(codigo)` — devuelve la fila como objeto para precargar el form en modo edición.
  - `updateFichaRow(data)` — actualiza in-place. Si no encuentra el código, hace append (fallback de no-pérdida).
- **Generadores asociados:**
  - `lib/ficha-doc-generator.js` — DOCX de ficha técnica.
  - `lib/opinion-valor-doc-generator.js` + `opinion-valor-pdf-generator.js` — opinión de valor.
  - `lib/recibo-pdf-generator.js` — recibos.

---

## 3 · Apps Script CRM_Solca

- **Sheet:** `1r9yBN5xLHASkwiwxxc0CoU8IWP4pyFp8eUQX3dvHSOU` (CRM_Solca).
- **Pestañas operativas:** `Leads de forms`, `Leads de página`, `Base limpia`, `Servicios`, `Legal`, `Inmobiliaria`, `Archivo`.
- **Funciones principales:**
  - `juntarLeads()` — consolida `Leads de forms` + `Leads de página` (+ `Leads de página 2` legacy) a `Base limpia`. Lee headers por nombre con `HEADER_ALIASES` (no por índice — soporta cambios de columnas).
  - `archivarCerradas()` — mueve filas con status "Cerrada" a `Archivo`, preservando fórmulas R1C1 del seguimiento.
  - `obtenerTareasVigentes_()` + `enviarMailTareas_()` — arma y envía el digest diario de tareas.
  - `actualizarClaves_()` — escribe la clave (L1, L2, ...) en columna correspondiente de cada tab. No usar ARRAYFORMULA (genera circular dependency).
  - `enviarTareasMatutino()` / `enviarTareasVespertino()` — entrega del digest a `DESTINATARIOS_MATUTINO` (4 buzones) y `DESTINATARIOS_VESPERTINO` (`ccvs1208@gmail.com` + `inmobiliariasolypuerto@…`).
  - `onOpen()` + `installTriggers()` — instala triggers: `juntarLeads` onChange + cada 5 min, `enviarTareasMatutino` 7:30 AM, `enviarTareasVespertino` 2:45 PM.
- **Constantes claves:**
  - `RESPONSABLES_NOMBRES`: CV → Clara Vázquez, SC → Suemi Canul, ESP → Ernesto Solís Puerto, OS → Oscar Solís, RS → Ramón Sansores, RM → Raúl Mendez.
  - `SEGUIMIENTO_HEADER_ROW = 2` (no 1 — la fila 1 es banner).
  - `CAPS`: truncado de texto para evitar el límite de 328KB de body de email.

---

## 4 · Pipeline de análisis de vacantes (serie miércoles)

Conjunto de scripts + datos para generar la serie "Lo que dicen las vacantes" cada mes.

### 4.1 · Input

- **PDF de origen:** Oscar reúne ~30 vacantes pharma LATAM de LinkedIn en un PDF (último: `Listado para claudia 19 may 2026 (1).pdf` en uploads).
- **Criterio de inclusión:** vacantes publicadas en últimos 30 días, países MEX/COL/CHL/ARG/BRA, áreas Clinical Ops / Medical Affairs / Regulatory / PV / HEOR / R&D.

### 4.2 · Procesamiento

- **Parseo:** PyMuPDF (`pip install pymupdf --break-system-packages`).
- **Split:** marcador `Acerca del empleo` o `About the job`.
- **Salida:** `vacantes_raw.txt` (texto plano) + `vacantes_analysis.json` (categorías, conteos, acrónimos).
- **Reglas operativas del análisis:**
  - Deduplicar (la misma vacante publicada en 2 países cuenta 1).
  - Etiquetar "trampas" (vacantes que aparecen en búsqueda pharma pero no son pharma: ej. IDIEM materiales, PwC ERP médico, Clase Azul tequila).
  - Categorizar por keyword en título + body inicial.
- **Categorías estándar:** Clinical Operations, Medical Affairs / MSL, Regulatory Affairs, HEOR / Consulting, R&D / Lab, Pharmacovigilance, Epidemiology, Other (trampas).
- **Datos contados (por mes):** distribución por categoría, frecuencia de acrónimos (ICH/GCP, SOPs, TMF/eTMF, CRO, HEOR, CTMS, eCRF, SAE, IRB/IEC, KOL, HCP, RWE, RBM), requisito de inglés (fluent/advanced/mention/none), educación mencionada (PhD/Master/Bachelor).

### 4.3 · Output editorial · serie miércoles

- **Cadencia:** 4 artículos consecutivos, uno cada miércoles, basados en el dataset del mes.
- **Frase de apertura común:** *"Mientras curaba el listado de vacantes pharma del mes, conté algo que vale la pena compartir."*
- **Estructura del post LinkedIn (~2700 chars):**
  1. Gancho con la tesis numérica.
  2. Metodología breve (N, periodo, países).
  3. Datos crudos.
  4. Interpretación / por qué importa.
  5. 2-3 acciones concretas.
  6. Promesa del próximo miércoles.
  7. CTA `solcaciencia.com/revisar-cv`.
  8. 5-6 hashtags.
- **Imagen:** 1280×720, paleta Solca, gráfica de barras o comparación. Convención de nombre: `mier_YYYY_MM_DD.png`.
- **MD canónico:** `MIERCOLES_YYYY_MM_DD.md` en `_docs/`, contiene cuerpo largo + versión LinkedIn + notas internas de audibilidad.
- **Cierre del ciclo:** el viernes posterior al cuarto miércoles cierra con el newsletter de vacantes del mes (cadencia separada cada 4 semanas).

### 4.4 · Ediciones publicadas en este ciclo

| Fecha | Tesis | Cover |
|---|---|---|
| Mié 27 may 2026 | 33% son Clinical Ops · solo 10% MSL · 1 de 30 menciona PhD | `mier_2026_05_27.png` |
| Mié 3 jun 2026 | 13 acrónimos pharma que casi nadie con PhD usa en su CV | `mier_2026_06_03.png` |
| Mié 10 jun 2026 | 20 piden Bachelor mínimo · las tareas son de PhD | `mier_2026_06_10.png` |
| Mié 17 jun 2026 | 19 de 30 esperan inglés · filtro silencioso del CV en español | `mier_2026_06_17.png` |

---

## 5 · Generadores de imagen (PIL)

Todas las imágenes editoriales y de branding se generan con Pillow (`pip install pillow --break-system-packages` si no está). Mantienen la paleta y convenciones Solca para consistencia visual.

### 5.1 · Paleta canónica (RGB tuples)

```python
NAVY      = (31, 58, 95)     # fondo principal
NAVY_DARK = (24, 42, 68)     # acentos / cards
NAVY_DEEP = (18, 33, 56)     # depth bands
ORANGE    = (231, 124, 60)   # acento principal / wordmark
ORANGE_DIM= (212, 102, 39)   # acento secundario
CREAM     = (245, 240, 230)  # texto secundario
WHITE     = (255, 255, 255)  # texto principal
GRAY_BAR  = (210, 210, 215)  # datos suaves
```

### 5.2 · Portadas newsletter (Vie)

- **Dimensión:** 1280×720 (estándar LinkedIn newsletter cover).
- **Layout:** wordmark/título a la izquierda, layout de 3 cards a la derecha con números o conceptos clave del newsletter.
- **Nombre:** `newsletter_YYYY_MM_DD.png` en `_docs/`.

### 5.3 · Portadas miércoles (Lo que dicen las vacantes)

- **Dimensión:** 1280×720.
- **Layout:** kicker top-left ("LO QUE DICEN LAS VACANTES · #N"), título 2 líneas (blanco + naranja), subtítulo con la fuente del dato, gráfica de barras horizontales o comparación de columnas.
- **Footer:** `solcaciencia.com/revisar-cv` (naranja) + `Solca Insight` (crema).
- **Barra naranja inferior** a `H - 14` siempre.
- **Nombre:** `mier_YYYY_MM_DD.png`.

### 5.4 · Banner de perfil LinkedIn

- **Dimensión:** 1584×396 (estándar LinkedIn profile banner).
- **Safe zone:** la foto de perfil cubre roughly bottom-left ~280×200 → dejar vacío.
- **Layout final establecido:**
  - Bandas verticales de profundidad a la izquierda (NAVY_DEEP + NAVY_DARK).
  - Listón naranja vertical a `x=180`.
  - Wordmark "Solca" (96px bold) a `x=230, y=60`.
  - "Ciencia · Consultoría" (34px bold orange) abajo.
  - Bajada actual: *"Carreras en la industria farmacéutica para profesionales en ciencias biológicas y afines"*.
  - Esquina top-right: `SOLCA INSIGHT · NEWSLETTER SEMANAL`.
  - Esquina bottom-right: `hello@solcaciencia.com` + `www.solcaciencia.com` con dot naranja.
- **Archivo:** `solca_banner_linkedin.png` en `~/Downloads/`.

### 5.5 · Fuentes

- Por orden de fallback: DejaVu Sans Bold/Regular → Arial → Liberation Sans.
- Sistema en Linux box: `/usr/share/fonts/truetype/dejavu/DejaVuSans*.ttf` (siempre disponible).

---

## 6 · Trackers operativos

### 6.1 · LinkedIn outreach (warm DMs)

- **Archivo:** `_docs/LINKEDIN_OUTREACH_2026Q2.xlsx`.
- **Hojas:**
  - `Instrucciones` — reglas de outreach.
  - `Tracker` — log de envíos (Fecha, Hora, Nombre, Apellido, Headline, País, Sector, URL, Variante, Estado, Fecha respuesta, Click, Notas).
  - `Mensajes` — variantes V1W–V4W del mensaje warm (a 1st-degree).
  - `Resumen` — métricas calculadas (envíos por variante, tasa de respuesta).
- **Reglas operativas:**
  - Solo conexiones 1er grado con ≤4 mensajes previos.
  - Lunes a viernes, pausa 10 segundos entre envíos.
  - Rotación de 4 variantes (V1W–V4W).
  - Si no se puede personalizar el nombre, usar "Hola!".
  - Sin UTM (mensaje completo via Chrome MCP, no DM enlazado).
  - Cada persona recibe el mensaje 1 sola vez por ciclo (prevenir SPAM).
  - Siguiente ciclo: variante de `/quiz-rol`, no inmediatamente después.

### 6.2 · Newsletter Topics Registry

- **Archivo:** `_docs/NEWSLETTER_TOPICS_REGISTRY.md`.
- **Función:** memoria compartida del ciclo editorial. Lista temas ya usados, pool de temas pendientes, reglas operativas refinadas, próximos pasos.
- **Cuándo abrirlo:** al iniciar cualquier sesión de redacción editorial. Pegar referencia en el chat con Claude para retomar contexto en frío.

### 6.3 · Reschedule Plan

- **Archivo:** `_docs/NEWSLETTER_RESCHEDULE_PLAN.md`.
- **Función:** plan maestro de cadencia (Lunes teaser → Viernes newsletter), reglas de re-publicación si se mueve algo.

---

## 7 · Reglas editoriales transversales

Estas reglas aplican a todo contenido público que sale bajo la marca Solca, independientemente del canal.

### 7.1 · Regla de traducción

Cualquier término técnico pharma debe tener un puente en lenguaje cotidiano en la primera mención. Ejemplo: "MSL (Medical Science Liaison, el rol que traduce ciencia entre médicos y la farmacéutica)".

### 7.2 · Ancla de audiencia

Cada pieza identifica explícitamente al lector ideal en las primeras 3 líneas. Audiencia base: profesionales con doctorado (o en vías) en ciencias biológicas y afines, en transición a industria farmacéutica.

### 7.3 · Test entry-level

Antes de publicar, preguntar: "¿alguien con licenciatura recién egresada entendería esto?" Si no, simplificar.

### 7.4 · Sin emoji

Política de marca. La excepción es el cierre de algunos newsletters con un símbolo único si lo amerita el momento, no como decoración.

### 7.5 · Referencias citadas

Cada dato numérico específico debe llevar referencia identificable.
- ❌ "Glassdoor reporta consistentemente que…"
- ✅ "Glassdoor LATAM Q1 2026 reporta una mediana de 65k MXN/año para CRA junior (n=12)…"
- Si la cifra no tiene fuente sólida → suavizar el claim o omitirlo.

### 7.6 · Honestidad sobre fabricación

Si en un draft hay cifras inventadas o asumidas, Claude las marca antes de cerrar. Reglas:
- Cifras específicas (números, %): verificar antes o no usar.
- Claims directional ("la mayoría", "frecuentemente"): aceptables si la dirección es clara.
- Detalles específicos de productos propios (ej. "12 preguntas del libro 3"): verificar contra los archivos del libro, no asumir.

### 7.7 · CTA rotación

Para evitar fatiga de la audiencia:
- Edición vacantes (cada 4 sem): `revisar-cv` o web.
- Edición con tema CRA: libro 3.
- Edición con tema MSL: libro 2.
- Edición con tema PM: libro 1.
- Tema cross-cutting (entrevista, networking): rota.

### 7.8 · Hashtags

- **Posts LinkedIn (Lunes/Miércoles):** 5-6 hashtags al final.
- **Newsletters viernes (desde 19 jun 2026):** 3-5 hashtags al final del cuerpo.
- **Patrón base:** `#PharmaLATAM #PhDtransition` + 2-3 específicos del tema (#ICHGCP, #ClinicalResearch, #MSL, #CV, etc.).

### 7.9 · Lun teaser ≠ Lun followup

- **Teaser** (Lun previo a Vie newsletter): ~150 palabras, hook + promesa "el viernes desgloso…", **sin CTA al libro**.
- **Followup** (Lun posterior a Vie newsletter): ~250-300 palabras, profundiza un punto del newsletter, **con CTA al libro**.

### 7.10 · Manejo de copyright en lecturas

Cuando referencio papers, libros, o contenido publicado de terceros:
- Solo 1 cita corta (<15 palabras) por respuesta, entre comillas.
- Nunca reproducir letras de canciones (siempre).
- Nunca reproducir 20+ palabras de contenido copyright.
- Resumir en lenguaje propio, no parafrasear.

---

## Cómo retomar este registro

Si se pierde contexto y necesitas refrescar el estado de las herramientas, lee este archivo + `NEWSLETTER_TOPICS_REGISTRY.md` + `NEWSLETTER_RESCHEDULE_PLAN.md`. Eso reconstruye 90% del contexto operativo en 5 minutos.

— Solca · Ciencia y Consultoría
