# Plan SEO · 15 blogs pharma LATAM

**Fecha aprobación matriz:** 24 jun 2026 (Oscar aprobó matriz completa + diferenciar #5 y #12)
**CTA único:** `solcaciencia.com/revisar-cv` en todos
**Geo:** pan-LATAM, énfasis MX (prioridad 1), AR/CO (prioridad 2)
**Estructura Astro:** `src/content/blog/<slug>.md` con frontmatter completo
**Hero:** `/blog/<slug>.png` (1280×720) — los 10 del sprint reciclan covers existentes; los 5 backfill necesitan covers nuevos

---

## Convención frontmatter

```yaml
---
title: "<título SEO 50-65 chars>"
description: "<meta 130-155 chars con keyword principal>"
pubDate: YYYY-MM-DD
heroImage: "/blog/<slug>.png"
category: "carreras-pharma"
tags: [...]
series: "newsletter" | "lo-que-dicen-las-vacantes" | "guia-seo"
seriesIndex: N (solo para newsletter y vacantes)
readingMinutes: N
---
```

---

## Prioridad ALTA (5 blogs · escribir primero)

### B-A1 · Salarios CRA junior LATAM 2026
- **Slug:** `salario-cra-junior-latam-2026`
- **Source:** N#4 (Vie 29 may, backfill)
- **Primary kw:** salario CRA México
- **Title (61):** Salario CRA junior en LATAM: rangos reales por nivel y país (2026)
- **Meta (151):** Rangos salariales reales de CRA junior, II y Senior en México, Argentina y Colombia. Por qué Glassdoor te miente con la media. Datos 2026.
- **CTA:** revisar-cv
- **Series:** guia-seo

### B-A2 · Método STAR para entrevistas pharma
- **Slug:** `metodo-star-entrevistas-pharma`
- **Source:** B1 (nuevo, sprint)
- **Primary kw:** método STAR pharma
- **Title (60):** Método STAR para entrevistas pharma: la respuesta corta gana
- **Meta (152):** Cómo aplicar STAR a entrevistas de CRA, MSL y clinical operations. Un ejemplo por rol, tres errores que descalifican, y por qué soltar todo es peor.
- **CTA:** revisar-cv (luego upsell Hotmart)
- **Series:** guia-seo

### B-A3 · Salarios MSL LATAM por país y nivel
- **Slug:** `salario-msl-latam-por-pais-nivel`
- **Source:** N#7 (Vie 19 jun, backfill)
- **Primary kw:** salario MSL México
- **Title (59):** Salario MSL LATAM 2026: rangos por país y nivel real
- **Meta (149):** Rangos MSL junior, mid, senior en México, Argentina y Colombia. Bonos, variable, y la trampa de mirar solo la media de Glassdoor.
- **CTA:** revisar-cv
- **Series:** guia-seo

### B-A4 · ICH E6(R3) qué cambió y por qué importa al CRA
- **Slug:** `ich-e6-r3-que-cambio-cra`
- **Source:** N#5 (Vie 5 jun, backfill)
- **Primary kw:** ICH E6 R3
- **Title (62):** ICH E6(R3) explicada para CRAs: qué cambió desde julio 2025
- **Meta (155):** Cinco cambios clave de ICH E6(R3) frente a R2, traducidos al día a día del CRA: monitoreo basado en riesgo, calidad por diseño, datos electrónicos.
- **CTA:** revisar-cv
- **Series:** guia-seo

### B-A5 · Referidos pharma · desmontando el mito 80%
- **Slug:** `referidos-mito-80-oculto-pharma-latam`
- **Source:** N#11 (Vie 17 jul, sprint)
- **Primary kw:** mercado laboral oculto + referidos pharma
- **Title (64):** Referidos pharma LATAM: por qué el "80% mercado oculto" es mito
- **Meta (154):** El 80% del mercado oculto es un mito de 1980. Lo que sí mueven los referidos hoy en pharma LATAM, con datos SHRM, Jobvite y Ashby 2024.
- **CTA:** revisar-cv
- **Series:** newsletter
- **seriesIndex:** 11

---

## Prioridad MEDIA (7 blogs)

### B-M1 · Onboarding 30/60/90 primer rol pharma
- **Slug:** `onboarding-30-60-90-primer-rol-pharma`
- **Source:** N#10 (Vie 10 jul, sprint)
- **Primary kw:** plan 30 60 90 días pharma
- **Title (62):** Onboarding 30/60/90 en pharma: los primeros 90 días, sin caer
- **Meta (153):** Adaptación del framework de Watkins a clinical operations. Tres acciones por mes y la trampa más común de cada bloque. Datos SHRM y Pharm Tech 2025.
- **Series:** newsletter
- **seriesIndex:** 10

### B-M2 · CV pharma · cinco ajustes desde CV PhD
- **Slug:** `cv-pharma-cinco-ajustes-desde-phd`
- **Source:** N#12 (Vie 24 jul, sprint)
- **Primary kw:** CV pharma PhD
- **Title (63):** CV para industria farmacéutica: cinco ajustes desde un CV PhD
- **Meta (154):** Los cinco ajustes que convierten un CV académico en CV pharma listo para reclutador LATAM. Una página, sin papers en lista, con verbos de acción.
- **Series:** newsletter
- **seriesIndex:** 12

### B-M3 · CRO vs Big Pharma vs farma local
- **Slug:** `cro-vs-big-pharma-vs-farma-local-primer-rol`
- **Source:** M5 (Mié 1 jul, sprint)
- **Primary kw:** CRO vs big pharma
- **Title (63):** CRO, big pharma o farma local: cuál es mejor primer rol LATAM
- **Meta (152):** Diferencias reales entre CRO, big pharma y farma local para tu primer rol: ritmo, salario, aprendizaje, ruta de promoción. Cuál eligen los junior.
- **Series:** lo-que-dicen-las-vacantes
- **seriesIndex:** 5

### B-M4 · 7 empresas concentran 38 vacantes pharma LATAM
- **Slug:** `siete-empresas-pharma-latam-vacantes`
- **Source:** M6 (Mié 8 jul, sprint)
- **Primary kw:** empresas pharma LATAM contratando
- **Title (61):** 7 empresas concentran 64% de vacantes pharma LATAM (junio 2026)
- **Meta (155):** IQVIA, Syneos, PiSA, Pfizer, Thermo Fisher, Novartis, Medifarma. Cómo seguirlas directo y por qué LinkedIn search te muestra solo una fracción.
- **Series:** lo-que-dicen-las-vacantes
- **seriesIndex:** 6

### B-M5 · Vacante en inglés ≠ requisito de inglés nativo
- **Slug:** `vacante-en-ingles-no-significa-requisito-ingles`
- **Source:** M7 (Mié 15 jul, sprint)
- **Primary kw:** inglés industria farmacéutica
- **Title (63):** Vacante en inglés ≠ requisito de inglés nativo: cómo leerla bien
- **Meta (154):** El posting en inglés no siempre exige inglés nativo. Cómo distinguir cuándo sí y cuándo es solo el idioma corporativo. Tres claves de lectura.
- **Series:** lo-que-dicen-las-vacantes
- **seriesIndex:** 7

### B-M6 · Trayectoria CRA → Director en cinco saltos
- **Slug:** `cra-i-a-director-trayectoria-cinco-saltos`
- **Source:** N#9 (Vie 3 jul, sprint)
- **Primary kw:** trayectoria CRA
- **Title (63):** De CRA I a Director: la trayectoria real en cinco saltos clínicos
- **Meta (153):** Los cinco saltos reales CRA I → Director con barreras técnicas, operativas y de equipo. Datos BDO 2024, ACRP 2024-25, Tufts CSDD.
- **Series:** newsletter
- **seriesIndex:** 9

### B-M7 · Entry-level pharma · la realidad de las vacantes
- **Slug:** `entry-level-pharma-realidad-vacantes-latam`
- **Source:** M8 (Mié 22 jul, sprint)
- **Primary kw:** entry level pharma México
- **Title (62):** Entry-level pharma LATAM: solo 2 de 59 vacantes son realmente entry
- **Meta (153):** El "entry-level" pharma esconde requisitos junior-2-años. Qué piden realmente las 59 vacantes del mes y dónde están las 2 que sí abren la puerta.
- **Series:** lo-que-dicen-las-vacantes
- **seriesIndex:** 8

---

## Prioridad BAJA (3 blogs · escribir al final)

### B-B1 · IA en clinical research · ¿reemplaza al CRA?
- **Slug:** `ia-clinical-research-reemplaza-cra-latam`
- **Source:** N#8 (Vie 26 jun, sprint)
- **Primary kw:** IA clinical research
- **Title (62):** IA en clinical research LATAM: ¿reemplazo del CRA o nuevo CRA?
- **Meta (152):** Casos reales de IA desplegada en monitoreo clínico, qué automatiza ya y qué sigue siendo humano. Datos IQVIA y casos LATAM 2025-2026.
- **Series:** newsletter
- **seriesIndex:** 8

### B-B2 · Tres puertas a la industria pharma desde academia
- **Slug:** `tres-puertas-academia-pharma-latam`
- **Source:** N#1 (Vie 8 may, backfill)
- **Primary kw:** transición academia industria farmacéutica
- **Title (59):** Tres puertas a la industria pharma LATAM desde academia
- **Meta (151):** CRO, big pharma, farma local: tres rutas de entrada desde PhD o tesista. Pros y contras de cada una, perfil que mejor encaja y dónde aplicar.
- **Series:** newsletter
- **seriesIndex:** 1

### B-B3 · El error más común en CV PhD → pharma
- **Slug:** `el-error-mas-comun-cv-phd-pharma`
- **Source:** N#2 (Vie 15 may, backfill, REENFOCADO a UN error)
- **Primary kw:** errores CV PhD
- **Title (60):** El error más común en un CV PhD que busca pasar a pharma
- **Meta (152):** Hay un solo error que descalifica el 90% de los CVs PhD que aplican a pharma. Cuál es, por qué pasa, y cómo arreglarlo en 15 minutos.
- **Series:** newsletter
- **seriesIndex:** 2

---

## Stack de tags por blog (consistencia SEO)

Reutilizar estos clusters para reforzar topical authority:

- **Cluster CV:** CV, PhD, Pharma LATAM, Reclutamiento, Job Search
- **Cluster CRA:** CRA, Clinical Research, ICH GCP, Monitoreo Clínico
- **Cluster MSL:** MSL, Medical Affairs, Liderazgo Científico
- **Cluster carrera:** Pharma LATAM, Transición Académica, Carrera Farmacéutica, México, Argentina, Colombia
- **Cluster salarios:** Salarios, Compensación, Glassdoor, Negociación
- **Cluster vacantes:** Vacantes, Empleo Pharma, Búsqueda Activa

---

## Orden de redacción propuesto

**Batch 1 (esta sesión):** ALTA prioridad B-A1, B-A2, B-A3, B-A4, B-A5 (5 blogs)
**Batch 2:** MEDIA B-M1..M4 (4 blogs)
**Batch 3:** MEDIA B-M5..M7 (3 blogs)
**Batch 4:** BAJA B-B1, B-B2, B-B3 (3 blogs)

Total: 15 blogs. Tiempo estimado de redacción: ~6-8 horas espaciadas, no en una sesión.

---

## Paso editorial obligatorio (pre-commit, por blog)

Cada blog pasa este checklist antes de marcarlo como done. Si una afirmación falla, se sustituye o se elimina — no se suaviza.

### Bloque A · Honestidad factual

- [ ] **Cero números inventados.** Cada cifra tiene fuente clickeable. Si no se puede verificar, se elimina la frase, no se acota.
- [ ] **Cero predicciones.** Nada de "los próximos cinco años traerán…", "para 2030 vamos a…", "esto va a explotar". Solo datos publicados y consecuencias deducibles del dato actual.
- [ ] **Cero inferencias presentadas como hechos.** Si infiero, lo digo. Si lo digo, va con autoridad propia ("desde mi práctica acompañando a profesionales en transición…"), no con datos fabricados.
- [ ] **Cero generalizaciones sin sustento.** "La mayoría de los reclutadores…", "el 80% de las empresas…", "todos los CRAs…" — solo con fuente o se reformula a observación concreta.

### Bloque B · Autobiografía verificable

Frases prohibidas porque describen eventos que no existen en la realidad operativa de Oscar:

- [ ] "Esta semana en mi DM…" / "los DMs que recibo…" — **Oscar no tiene flujo de DMs masivos sobre estos temas.**
- [ ] "Cada vez que doy una charla en facultades…" / "cuando hablo con grupos universitarios…" — **Oscar no da charlas en facultades.**
- [ ] "En las consultorías que hago…" / "los clientes me cuentan…" — solo si se refiere a casos verificables y agregados. Sin inventar testimoniales.
- [ ] "He visto cientos de CVs…" — solo si el número es real o se sustituye por "decenas" verificable.
- [ ] **Sustituciones permitidas:** "en mi práctica acompañando profesionales en transición", "en los CVs que reviso con la herramienta de Solca", "lo que escucho en conversaciones 1-a-1 con lectores del newsletter" (cuando exista).
- [ ] **"Página de carrera"** → "página de vacantes" o "página de carreras" (siempre plural).

### Bloque C · Fuentes y citas

- [ ] **Cada cifra externa lleva link [Texto](URL)** a la fuente primaria. No a un blog que cita a otro blog.
- [ ] **Fuentes preferidas en este orden:** organismo regulatorio (ICH, FDA, EMA, COFEPRIS, ANMAT, INVIMA), instituto especializado (IQVIA Institute, Tufts CSDD), asociación profesional (ACRP, DIA, SHRM), encuesta industria (BDO, Pharm Tech, Jobvite, Ashby, Talenbrium), academia revisada por pares.
- [ ] **Fuentes a evitar a menos que se contextualice:** Glassdoor/Indeed (medias planas sin segmentación), portales de empleo como única fuente salarial.
- [ ] **Si una cifra no se encuentra:** se elimina la frase. No se escribe "se estima que" sin fuente.

### Bloque D · Sample bias (vacantes manualmente curadas)

Aplica solo a B-M3, B-M4, B-M5, B-M7 (basados en JSON `vacantes_junio_estructurado.json`):

- [ ] **No se hacen claims estadísticos de distribución de mercado** ("Brasil tiene cero vacantes pharma", "remoto no ganó"). La curación fue manual y selectiva — la muestra no representa el mercado.
- [ ] **Sí se hacen claims cualitativos de lo que aparece en la muestra** ("de las 59 vacantes que revisé, 7 empresas concentran 38"). Siempre con frase "en la muestra revisada" o equivalente.

### Bloque E · Voz Solca

- [ ] **Sin emoji.**
- [ ] **Español LATAM neutral.** Localismos suaves OK (México "vacantes", AR/CO "ofertas" — usar el término más universal o ambos).
- [ ] **Modo SENTENCIAR o SILENCIO.** Nada de "no encontré fuente concluyente", "es solo conjetura mía", "sin pretensión de cifras públicas". Si no se puede sentenciar con fuente o autoridad propia, se elimina la frase.
- [ ] **CTA único al final:** `solcaciencia.com/revisar-cv`. Nada de tres CTAs encadenados.

### Bloque F · SEO técnico

- [ ] **Title** entre 50-65 chars.
- [ ] **Meta description** entre 130-155 chars con keyword primary natural (no stuffing).
- [ ] **H1** en el archivo Astro = title (Astro lo renderiza desde frontmatter).
- [ ] **H2/H3** descriptivos con keyword secundaria cuando aplica, sin forzar.
- [ ] **Slug** kebab-case sin acentos ni eñes, máximo 60 chars.
- [ ] **Imagen hero** existe en `public/blog/<slug>.png` antes de commit. Si no existe, generar con script.
- [ ] **Tags** consistentes con los clusters definidos arriba.
- [ ] **readingMinutes** calculado como `palabras / 220` redondeado al entero más cercano.

### Bloque G · Validación cruzada

- [ ] **Releer en voz alta el primer párrafo y el último.** Si suena a IA genérica o a manual de RRHH, reescribir.
- [ ] **Buscar las frases prohibidas del Bloque B** con `grep -i "dm" "charla" "facultad" "página de carrera"` antes de commit.
- [ ] **`astro check`** pasa sin errores ni warnings de frontmatter.
- [ ] **Lectura final completa** antes de marcar el blog como done en la TaskList.

---

## Pendientes operativos

- [ ] Generar 5 covers nuevos para los backfill (Vie 8 may, 15 may, 29 may, 5 jun, 19 jun) → script `generate-newsletter-cover.py`
- [ ] Copiar covers a `public/blog/<slug>.png`
- [ ] Verificar redirect 301 si algún slug viejo cambia
- [ ] Sitemap.xml regenera solo (Astro)
- [ ] Confirmar `astro check` pasa antes de commit
