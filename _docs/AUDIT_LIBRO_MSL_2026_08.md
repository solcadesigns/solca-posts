# Auditoría editorial · Libro MSL · agosto 2026

**Fecha:** 2026-08-12
**Auditor:** Claude (Opus 4.7) para Oscar Solís Castro
**Alcance:** archivos `.md` fuente en `/Users/oscar/proyectos/solca-ciencia/solca/libro2/` (frontmatter, backmatter, modulo_01 a modulo_05).
**Método:** lectura completa + grep dirigido + verificación de URLs críticas vía WebFetch.

Nota de proceso: PubMed / PMC bloqueó las verificaciones vía captcha, por lo que las cifras atribuidas a PMC 12030051, PMC 13081017 y PMC 11473552 no pudieron confirmarse contra la fuente primaria. Quedan como pendientes de verificación manual — no como bloqueantes por defecto, pero cualquiera de ellas puede pasar a bloqueante si al abrir el paper el porcentaje no coincide.

---

## 1 · BLOQUEANTES

### B1 · Palabra prohibida "genuinamente" en dos ubicaciones

- **`frontmatter.md` línea 55.** Cita: *"La data salarial de MSL en LATAM es genuinamente delgada."*
- **`modulo_03_draft.md` línea 193.** Cita: *"**Máxima:** La data salarial pública LATAM es genuinamente delgada. Triangula con dos recruiters y tres MSLs activos antes de aceptar."*

Diagnóstico: `STYLE_BRIEF.md` línea 157 y `OSCAR_PROFILE.md` prohíben explícitamente esta palabra. Aparece en el prólogo firmado por el autor y en una "Máxima" destacada del Módulo 3, es decir, en dos lugares de alta visibilidad.

Fix propuesto: reemplazar por **"notoriamente"** o **"realmente"** en ambos casos.
- Frontmatter: "La data salarial de MSL en LATAM es **notoriamente** delgada."
- Módulo 3 máxima: "La data salarial pública LATAM es **notoriamente** delgada."

---

### B2 · Cifras McKinsey (85 % / 47 % / 25 %) citan el artículo equivocado

- **`modulo_05_draft.md` líneas 71, 73, 75** (Sección 5.2). El texto atribuye tres cifras específicas —**85 % explorando/adoptando**, **47 % implementación cierre 2024**, **25 % implementación cierre 2023**— al artículo *"McKinsey, Generative AI in healthcare: Adoption trends and what's next, 2024"* (URL en referencia #2 del módulo, línea 380).

- La URL citada (`.../generative-ai-in-healthcare-adoption-trends-and-whats-next`) es el artículo de **julio 2024** basado en la encuesta **Q1 2024**. Ese artículo dice **"more than 70 percent"**, no 85 %, y no contiene ninguno de los tres porcentajes atribuidos.

- La cifra correcta de **85 %** proviene de un artículo distinto: *"Generative AI in healthcare: Current trends and future outlook 2025"* (McKinsey, marzo 2025), basado en la encuesta **Q4 2024** — que sí reporta textualmente: *"85 percent of respondents ... were exploring or had already adopted gen AI capabilities."* URL: https://www.mckinsey.com/industries/healthcare/our-insights/generative-ai-in-healthcare-current-trends-and-future-outlook-2025

Diagnóstico: la referencia bibliográfica apunta a un artículo que no sostiene las cifras que el texto le atribuye. Un lector que haga clic en el link no encontrará el 85 % ni el 47 %.

Fix propuesto:
1. Reemplazar la referencia #2 del Módulo 5 (línea 380) por el artículo de marzo 2025.
2. Actualizar el fraseo de la sección 5.2 para atribuir las cifras a la encuesta Q4 2024 reportada en el artículo de 2025.
3. La cifra específica de **25 % → 47 %** de implementación no aparece en el texto narrativo del artículo de 2025 (probablemente esté en la Exhibit 1, que es un gráfico SVGZ no legible desde la web); marcar como "según la Exhibit 1 del reporte" o eliminar los porcentajes exactos si no se puede verificar el gráfico.

---

### B3 · Marcadores `[REF: dossier sección 3.3]` sin resolver en Módulo 2

- **`modulo_02_draft.md` líneas 259, 267, 273, 279, 285, 291, 396.** El texto contiene referencias internas al documento de trabajo `01_source_dossier.md` que no existe en el libro final:
  - L259: `El marco LATAM tiene dos capas [REF: dossier sección 3.3]`
  - L267: `[REF: dossier sección 3.3; ICLG México, ...]`
  - L273: `[REF: dossier sección 3.3; ANMAT, ...]`
  - L279, L285, L291: idénticos
  - L396: `[REF: dossier sección 10]`

Diagnóstico: aunque el frontmatter de los módulos 4 y 5 promete "el script de build los limpia al final", el docx compilado sigue mostrando estos placeholders al lector, y el dossier no es una fuente pública. Si el build strippea `[REF: ...]`, el texto queda cojo (frases como "El marco LATAM tiene dos capas:" sin la fuente). Si no lo strippea, aparece un puntero a un dossier interno que el lector no puede consultar.

Fix propuesto: reemplazar las 7 apariciones por citas verificables. En cada caso ya existe una segunda fuente en el mismo `[REF: ...]` (por ejemplo, `ICLG México 2025-2026`, `ANMAT Pautas Éticas`, `MinSalud Colombia Resolución 1896`, `ISP Regulaciones`, `ANVISA RDC 96/2008`). Reemplazar `[REF: dossier sección 3.3; X]` por `[REF: X]` en las siete ubicaciones.

---

### B4 · Marcadores editoriales draft-scaffolding filtrados al libro publicado

- **`frontmatter.md` línea 3:** `> **Iteración 1 · Draft.** Portada, prólogo, índice, página de derechos.`
- **`modulo_04_draft.md` línea 3:** `> **Iteración 1 · Draft.** Paráfrasis original sobre [larga lista de fuentes]. Voz formal-pedagógica con tuteo... Marcadores [REF: ...] se preservan para verificación editorial; el script de build los limpia al final.`
- **`modulo_04_draft.md` línea 5:** bloque `> **Style guide para imágenes (heredado de los módulos previos).**` con paleta y tipografías.
- **`modulo_05_draft.md` líneas 3 y 5:** idénticos marcadores.
- **`modulo_04_draft.md` línea 449:** `> **Fin del Módulo 4 · draft iteración 1.**`
- **`modulo_05_draft.md` línea 400:** `> **Fin del Módulo 5 · draft iteración 1.**`
- **`backmatter.md` línea 213:** `> Fin del libro · iteración 1.`

Diagnóstico: son notas editoriales que solo tienen sentido en workflow interno. En el libro final aparecen como texto real (las líneas empiezan con `>` que las convierte en blockquotes visibles). Los módulos 1, 2 y 3 no las tienen — los 4 y 5 sí, por asimetría de sanitización.

Fix propuesto: borrar cada uno de estos bloques (7 líneas total).

---

### B5 · Numeración caótica de referencias en `backmatter.md`

- **`backmatter.md` líneas 189-209.** La lista "REFERENCIAS GENERALES" salta: 19 → 20 → **24 → 25 → 26 → 27 → 28 → 29 → 21 → 22 → 23**.

Diagnóstico: bloque de referencias españolas (24-29: AEMPS, EMA, RD 1416/1994, Farmaindustria, EPM Scientific, 21 CFR 202.1) fue insertado entre las referencias 20 y 21 sin renumerar. Además, la referencia 24 "Agencia Española de Medicamentos y Productos Sanitarios (AEMPS)" duplica de facto la 27 (Farmaindustria) — no, revisando: 24 es AEMPS/CIMA y 27 es Farmaindustria, no hay duplicación real, pero la 27 duplica el link de Farmaindustria del texto de la 20 (que ya menciona Farmaindustria en el listado de códigos industriales). Duplicidad menor.

Fix propuesto: renumerar 19-29 en orden secuencial. Sugerencia de orden coherente: 19 Reglamentos LATAM · 20 Códigos industriales LATAM+España · 21 AEMPS+CIMA · 22 EMA · 23 RD 1416/1994 · 24 Farmaindustria · 25 EPM Scientific · 26 21 CFR 202.1 · 27 Dyer MSL Career Guide · 28 ACMA Definitive Guide · 29 Solís Castro *Investigación clínica*.

---

### B6 · Ficha técnica de portada usa tipografía inconsistente con la marca

- **`frontmatter.md` línea 13:** *"Bloque 2 (título principal, off-white `#F7F5EE`, **Inter weight 900**, tamaño grande, dos líneas): «MEDICAL SCIENCE LIAISON»."*

Diagnóstico: `OSCAR_PROFILE.md` establece **Space Grotesk para encabezados**, Inter para cuerpo. El título principal del libro en portada es el mayor de todos los encabezados — usar Inter 900 rompe la regla de marca establecida en los libros de la serie. Los bloques 1 (etiqueta superior "SOLCA · CIENCIA Y CONSULTORÍA") y todos los encabezados dentro de los módulos ya usan Space Grotesk según lo indicado. La portada del libro está en directa contradicción con el sistema tipográfico.

Fix propuesto: cambiar "Inter weight 900" a "Space Grotesk weight 700" (o 900 si existe) en la especificación del bloque 2. Regenerar la portada con `make_portada.py` o `make_portada_ai.py`.

---

### B7 · Cifra "±30 %-40 % del tiempo" sin fuente

- **`modulo_02_draft.md` línea 37:** *"La colaboración interna ocupa entre el treinta y el cuarenta por ciento del tiempo de un MSL maduro y es invisible desde fuera."*

Diagnóstico: es una cifra específica presentada como hecho sin cita. Ni el position paper APPA/IFAPP/MAPS/MSLS 2021 ni el MAPS *Field Medical KPIs Guidance* 2022 (fuentes citadas antes y después de esta línea) reportan explícitamente esta partición temporal en abstracts públicos. Es exactamente el tipo de cifra suelta que el prólogo promete evitar.

Fix propuesto: (a) acotar como estimación operativa —"la colaboración interna típicamente ocupa una porción sustancial del tiempo de un MSL maduro (estimaciones operativas la ubican entre 30 % y 40 %; varía por compañía y área)"— o (b) eliminar los números y describir como "significativa fracción del tiempo".

---

### B8 · Cifra "60 / 40 presencial-remoto" sin fuente

- **`modulo_02_draft.md` línea 51:** *"Proporción típica en oncología/raras: **sesenta presencial / cuarenta remoto**; en cardiometabólicas se invierte."*

Diagnóstico: aunque el párrafo cierra con "Los números varían entre compañías", el texto sigue publicando un ratio específico sin fuente. Se propaga a `modulo_03_draft.md` línea 39 (con la misma fracción y remisión a "según M2").

Fix propuesto: reformular como "Los ratios presencial/remoto varían por área terapéutica y compañía; en TAs de KOL concentrado (oncología, raras) predomina el presencial, en TAs de red densa (cardiometabólicas) predomina el remoto." Sin cifras concretas.

---

### B9 · Cover del prólogo declara equipos "crecen 15-20 %/año" y "rol creció 300 % en una década"

- **`frontmatter.md` línea 55.** El prólogo menciona ambas cifras y las marca como consenso operativo no verificado — bien. Pero luego el texto del libro (modulo_02_draft.md líneas 386-388, modulo_03_draft.md línea 25) construye estimaciones específicas de mercado sobre esa base sin volver a marcar el estado epistémico.

Diagnóstico: la advertencia del prólogo se pierde a la hora de operativizar. El texto queda con una tensión entre "advertencia editorial" y "publicación de cifras con apariencia de dato".

Fix propuesto: mantener la advertencia del prólogo y no reintroducir sub-cifras derivadas de ese consenso sin nuevo caveat. Concretamente: revisar las cifras de "presencial/remoto", "porcentaje de tiempo por función" y "duración de progresión vertical" y marcar cada una como estimación con la misma disciplina que aplica en Sección 3.3.

---

## 2 · IMPORTANTES

### I1 · EPM Scientific Europe Rates Guide 2026 es contract, no permanente

- **`modulo_03_draft.md` líneas 495-501, 505.** El texto cita EPM Scientific 2026 como fuente para bandas salariales **permanentes** MSL España (EUR 38-50k / 55-75k / 80-115k).

- El sitio de EPM Scientific describe explícitamente la guía como **"Compensation Guide — contract rates"** para *"decision-makers and independent consultants... Whether you're hiring contractors or negotiating your next assignment"*. Los FAQs listan los roles cubiertos: *"Over 60 contract roles across clinical operations, clinical development, biometrics, quality assurance, regulatory affairs, validation, manufacturing, and R&D - including CRAs, Regulatory Managers, Automation Engineers, and Medical Directors."* **MSL no aparece explícitamente** en la lista pública de roles cubiertos.

Diagnóstico: la guía es (a) de contratistas, no de asalariados y (b) su lista pública de roles no incluye MSL. La cifra "EUR 80/hora" del contract rate (línea 505) es plausible pero no verificable desde la landing pública. Las bandas 38-50k / 55-75k / 80-115k se atribuyen implícitamente a triangulación con Glassdoor, LinkedIn Salary y "reportes públicos de industria" (línea 495), pero el peso de "EPM Scientific 2026" como validador queda inflado.

Fix propuesto:
1. En la línea 501, reformular "Para validación puntual, la fuente pagada más granular del segmento es la Europe Life Sciences Rates Guide 2026 de EPM Scientific" — aclarar que la guía cubre **contratistas** y que su listado público no confirma cobertura MSL específica. Reforzar Glassdoor España y LinkedIn Salary como fuentes primarias para permanentes.
2. En la línea 505, la cifra "EUR 80/hora en Europa incluyendo España" requiere fuente explícita — o descargar el reporte y citar la página exacta, o eliminar el número y reformular como "el mercado de contract MSL en Europa opera con day-rates que EPM Scientific y otros staffing agencies reportan tras solicitud del guide".

---

### I2 · Co-chairs MAPS LATAM Chapter — fecha de la fuente es 2022

- **`modulo_03_draft.md` línea 289, `modulo_04_draft.md` líneas 289 y 438.** El texto afirma como hecho presente que "MAPS LATAM Chapter" está "co-presidido por **José Borbolla (Eisai)** y **Augusto Grinspan (Merck KGaA)**".

- Verificación en https://medicalaffairs.org/medical-affairs-latin-america/: confirma ambos co-chairs con esas afiliaciones (José Borbolla, Eisai; Augusto Grinspan, Merck KGaA). La página está fechada en **abril 2022** (imagen `2022/04/jose-augusto-med-affairs-latam.png`) y menciona el "MAPS 2022 Global Annual Meeting". El copyright del footer dice © 2026 pero la nota editorial es de 2022. El libro se publica en 2026: cuatro años después de la única fuente pública.

Diagnóstico: los co-chairs pudieron rotar. Publicar sus nombres como estado actual sin verificar es riesgo de dato obsoleto — patrón típico de perfiles LinkedIn en profesiones móviles.

Fix propuesto: agregar disclaimer temporal — "co-presidido en su lanzamiento por José Borbolla (Eisai) y Augusto Grinspan (Merck KGaA); verificar composición actual en medicalaffairs.org antes de citar en entrevista". O contactar a MAPS antes del release.

---

### I3 · MAPS Americas "edición 2025 en Nueva Orleans"

- **`modulo_04_draft.md` línea 293:** *"MAPS Americas anual (edición 2025 en Nueva Orleans). La reunión más grande de Medical Affairs en Américas."*

- El menú actual del sitio MAPS destaca "Americas 2027 Meeting" (en Miami, según el slug `/miami27`). La ubicación 2025 en NOLA es probable pero se debe verificar; si el libro se publica en agosto 2026, ya pasó y quedaría como referencia histórica; conviene además señalar el próximo (Miami 2027) para dar valor operativo al lector.

Fix propuesto: cambiar a *"MAPS Americas anual (edición 2025 en Nueva Orleans; próxima edición Miami 2027)"* — más útil para un lector que aplica en H2 2026 o 2027.

---

### I4 · Ratios de bonus 15-25 % / 20-30 % sin fuente confirmable

- **`modulo_03_draft.md` líneas 47, 213.** Dos ubicaciones que publican bandas de bonus concretas: *"15-25 % de la base para MSL/Senior MSL, 20-30 % para MSL Manager"*.

- La atribución en línea 213 es *"composición sobre consenso de industria + MSL Society 2025 Global Survey, paywalled"*. Es decir, la fuente principal es una survey no auditable por el lector.

Diagnóstico: cifra tratada como hecho pero anclada en survey pagado + consenso operativo. Coherente con el marco editorial que la sección 3.3 aplica a los salarios base (etiqueta "Estatus: estimación"), pero aquí falta la etiqueta.

Fix propuesto: agregar caveat inline en línea 213 tipo *"Estatus: estimación; consenso operativo + MSL Society 2025 paywalled. Verificar en entrevista con hiring manager."*

---

### I5 · Cifra "1,100+ MSLs en 44 países" — dato paywalled

- **`modulo_03_draft.md` línea 119** y **`modulo_04_draft.md` línea 303.** Publica *"1,100+ MSLs en 44 países"* del MSL Society 2025 Global Survey.

Diagnóstico: cifra descriptiva del sample size que solo el que compra el reporte puede verificar. No es cifra sustantiva del rol, pero está publicada como hecho verificable.

Fix propuesto: reformular como *"según reporta la propia MSL Society, la encuesta 2025 cubre alrededor de 1,100 respondientes en 44 países (dato del sumario público del reporte)"*.

---

### I6 · "resumes" como spanglish reiterado — probablemente aceptable pero merece decisión editorial

- **`modulo_03_draft.md` líneas 313-368** usan "resume" y "MSL Resume" reiteradamente (~15 apariciones), incluyendo *"resumes por vacante"* en línea 323 (plural spanglish).

Diagnóstico: "MSL Resume" es término operativo de industria en inglés — funciona como nombre propio. El plural "resumes" (línea 323: *"el reclutador procesa un volumen alto de resumes por vacante"*) sí es spanglish evitable, con traducción castellana natural "currículos" o "CV".

Fix propuesto: mantener "MSL Resume" cuando refiere al documento estándar de industria (nombre propio); cambiar "resumes" plural genérico a "currículums" o "CVs" en línea 323.

---

### I7 · "hiring manager" traducible

- Aparece ~15 veces en modulo_03 y modulo_04 sin traducción. Existe en castellano el término "gerente de contratación" y en industria farmacéutica LATAM "responsable de selección" o "manager de talento".

Diagnóstico: no está en la whitelist del OSCAR_PROFILE.md, aunque es de uso frecuente en industria. Zona gris. La palabra "manager" sí es aceptable en construcciones tipo "MSL Manager" (nombre de rol), pero "hiring manager" es descriptivo genérico.

Fix propuesto: reemplazar por "manager de contratación" o "responsable de selección" en las 8-12 apariciones más visibles (Módulo 3 sección de entrevista y CV). Aceptable dejarlo en la sección del banco de 25 preguntas por concisión.

---

### I8 · Referencia PMC en `modulo_01_draft.md` línea 302 formato inconsistente

- L302: `1. APPA, IFAPP, MAPS & MSLS. (2021). *The Medical Science Liaison: Roles, Responsibilities, and Practices*. *Therapeutic Innovation & Regulatory Science*, position paper conjunto. **PMC 8492581**.`

- El backmatter (L153) formatea igual pero incluye URL: `https://pmc.ncbi.nlm.nih.gov/articles/PMC8492581/`

Diagnóstico: inconsistencia entre módulos y backmatter. Cada módulo debería enlazar directamente o remitir explícitamente al backmatter para las URLs.

Fix propuesto: en las listas de "Referencias del Módulo X", agregar la URL completa junto al PMC ID en todas las apariciones (M1 L302-309, M2 L474-491, M3 L620-639, M4 L432-445, M5 L378-397). O añadir una nota inicial *"URLs completas en Referencias Generales al cierre del libro"*.

---

### I9 · Módulo 3 sección 3.2 · lista de "catorce multinacionales" no coincide con enumeración

- **`modulo_03_draft.md` línea 25:** *"Las catorce multinacionales con presencia confirmada en los cinco mercados LATAM —Roche, Novartis, Pfizer, MSD, AstraZeneca, BMS, Lilly, Bayer, GSK, Sanofi, Boehringer Ingelheim, AbbVie, Janssen/J&J, Takeda, Amgen—"*.

- Contando: Roche, Novartis, Pfizer, MSD, AstraZeneca, BMS, Lilly, Bayer, GSK, Sanofi, Boehringer Ingelheim, AbbVie, Janssen/J&J, Takeda, Amgen = **15 nombres**, no 14.

- La numeración enumerada en L63-91 va de "1. Roche" a "14. Takeda", y luego "A esa lista conviene sumar Amgen" (línea 91), lo cual sugiere que Amgen no está entre las 14 sino como añadido. Pero el resumen en línea 25 y el figpie en línea 57 sí incluyen Amgen dentro del núcleo de 14.

Diagnóstico: contradicción interna sobre si Amgen es la 14ª (como sugiere el resumen) o adicional (como sugiere la enumeración numerada). Además, la Sección 3.1 factor 2 (línea 25) también lista "catorce" incluyendo Amgen.

Fix propuesto: decisión editorial — o (a) el núcleo son 15 y se declara así en todo el módulo, o (b) el núcleo son 14 (sin Amgen) y Amgen se mantiene como adicional en L91. La opción (a) es más limpia; la (b) obliga a corregir L25, L57 (pie del mapa) y toda instancia del "catorce".

---

### I10 · Modulo_05 · atribución de framing McKinsey queda coja tras corrección de B2

- **`modulo_05_draft.md` línea 79:** menciona "uplift de engagement de dos a tres veces" atribuido a McKinsey *Generative AI in the pharmaceutical industry: Moving from hype to reality*, 2024.

Diagnóstico: la sección 5.2 ya reconoce que "es el framing de McKinsey, no un estudio controlado, y no separa el efecto de la IA del de la inversión adicional en personalización". El caveat es correcto. Tras arreglar B2 (cambio de citación al artículo de 2025), este párrafo puede quedar como el único con atribución al artículo de 2024 — verificar consistencia.

Fix propuesto: mantener la cita al artículo 2024 solo aquí (donde sí corresponde) y aclarar en el propio párrafo que las tres cifras de la subsección anterior vienen del artículo de 2025.

---

### I11 · Referencia "IQVIA MSL white paper" del backmatter sin cita interna

- **`backmatter.md` línea 167:** referencia 8 lista *"IQVIA. Medical Science Liaisons: A key to driving patient access (white paper)"*.

Diagnóstico: aparece solo en la lista de referencias generales; grep muestra que no se cita en ningún módulo (`Grep "IQVIA.*white paper|driving patient access"` sobre los 5 módulos → 0 matches). Referencia huérfana.

Fix propuesto: o incorporar una cita al white paper en el texto (Módulo 1.5 o 1.6 son candidatos naturales), o eliminarla del backmatter.

---

### I12 · Referencia PMC 8378526 (España survey 2021) huérfana

- **`backmatter.md` línea 177:** referencia 13 *"PMC 8378526. The role of the Medical Science Liaison: a survey of healthcare professionals in Spain, 2021."*

Diagnóstico: no citada en ningún módulo (grep 0 matches). Referencia huérfana y particularmente relevante para la sección 3.8 (España) que carece de una fuente peer-reviewed para el estado del MSL en España.

Fix propuesto: incorporar cita en Sección 3.8 (Módulo 3, línea 479 o 481) — es fuente peer-reviewed sobre percepción MSL en España, valor operativo alto.

---

### I13 · Referencia PMC 10587308 huérfana

- **`backmatter.md` línea 179:** referencia 14 *"PMC 10587308. Value and Deliverables of Medical Affairs: An Affiliate Perspective, 2023."*

Diagnóstico: grep 0 matches en los 5 módulos.

Fix propuesto: incorporar cita en Módulo 1.4 o 1.6, o eliminar del backmatter.

---

### I14 · Rangos salariales sin ancla temporal explícita del tipo de cambio

- **`modulo_03_draft.md` línea 123:** *"Conversiones USD spot 2025: USD/MXN ≈ 17, USD/BRL ≈ 5.5, USD/ARS ≈ 1,000, USD/COP ≈ 4,100, USD/CLP ≈ 950. Ajusta a la fecha real."*

Diagnóstico: fecha "2025" es imprecisa (¿qué mes?). Para Argentina especialmente el peso vs USD osciló significativamente durante 2025. El caveat "ajusta a la fecha real" mitiga pero no elimina el problema.

Fix propuesto: sustituir "2025" por una fecha específica de cierre editorial (por ejemplo "spot agosto 2026") y actualizar las tasas al momento de compilación final.

---

### I15 · Ficha 5.6 · tres tendencias tratadas como consenso sin fuentes por tendencia

- **`modulo_05_draft.md` líneas 275-293.** Las tres tendencias del "MSL del futuro" (Virtual MSL, Omnichannel, RWE) están correctamente atribuidas al *McKinsey Vision Medical Affairs 2030* en el arranque (L273) — pero cada sub-sección introduce claims específicos ("cubría doce KOLs T1 en presencial ahora cubre los doce T1 en presencial más treinta T2/T3 en remoto"; "el HCP del 2026 no consume información en un canal; consume en cinco simultáneamente") sin fuente concreta.

Diagnóstico: las claims cuantitativas específicas están sin fuente, apoyándose en el framing genérico del reporte McKinsey citado al inicio.

Fix propuesto: reformular como ejemplos ilustrativos ("por ejemplo, una afiliada que...") en vez de "la afiliada que" con artículo definido que da apariencia de dato.

---

### I16 · "Chiesi España ... trasplante" — verificar TA

- **`modulo_03_draft.md` línea 485:** *"Chiesi España (Barcelona; respiratorio, neonatología, enfermedades raras y trasplante — multinacional italiana con Medical Affairs propio en Iberia y footprint creciente en raras)."*

Diagnóstico: Chiesi es italiana confirmado; su portafolio incluye respiratorio y neonatología históricamente, y raras recientes vía Chiesi Global Rare Diseases. "Trasplante" es más específico (Chiesi tiene Envarsus XR/Advagraf tacrolimus para trasplante). Aceptable pero verificar el listado exacto de TAs en Iberia.

Fix propuesto: verificar en chiesi.es antes de imprimir. Bajo riesgo.

---

### I17 · Frase técnica ambigua en 4.5

- **`modulo_04_draft.md` línea 205:** *"Algunas afiliadas exigen formación complementaria (liderazgo, BCMAS, people management interno)."*

Diagnóstico: BCMAS aquí aparece como "formación complementaria para MSL Manager", pero la Sección 4.7 lo posiciona como la certificación insignia para MSL en general (no específica de Manager). Inconsistencia menor de framing.

Fix propuesto: reformular como "algunas afiliadas exigen o reconocen formación complementaria (liderazgo, people management interno; BCMAS si aún no se tiene)".

---

### I18 · "backmatter" línea 191 · duplicidad implícita Farmaindustria

- **`backmatter.md` línea 191** lista Farmaindustria en el punto 20 (códigos industriales). La referencia 27 (línea 199) vuelve a listar *"Farmaindustria. Código de Buenas Prácticas de la Industria Farmacéutica. https://www.codigofarmaindustria.org"*.

Diagnóstico: dos entradas para la misma fuente. La 20 la agrupa con los códigos LATAM, la 27 es standalone. Además, el URL en 20 no aparece y en 27 sí.

Fix propuesto: eliminar duplicado (consolidar en una sola entrada con URL) al renumerar según B5.

---

## 3 · MENORES

### M1 · "footprint" spanglish frecuente

- Aparece en Módulo 3 título 3.2 ("footprint corporativo verificado"), y en varios sub-encabezados y prosa. Existe "presencia" en castellano. No blocker, pero rebajar la densidad ayuda al tono.

Fix: reemplazar 4-6 apariciones más visibles.

### M2 · "briefing" spanglish

- 8+ apariciones en Módulos 4 y 5. "Informe pre-visita" o "resumen ejecutivo" traducen bien.

Fix: opcional; el término está muy naturalizado en industria.

### M3 · "compliance" vs "cumplimiento normativo"

- El glosario (backmatter L73) traduce "compliance" como "cumplimiento normativo" y luego el texto de los módulos usa "compliance" casi siempre. Consistencia esperada — el glosario legitima la anglicización.

Fix: mantener.

### M4 · "case discussion" en título de Prompt 8 (M5 L193)

- "adaptación a paciente-tipo · *case discussion*" — término inglés que traduce como "discusión de caso" o "análisis de caso clínico".

Fix: opcional.

### M5 · Módulo 2 sección 2.4 sin figura numerada

- Todas las secciones 2.1-2.8 tienen imagen etiquetada IMAGEN 2.X. La sección 2.4 (advisory boards y congresos) no tiene bloque `> *[IMAGEN 2.X — ...]*`. Corta la simetría visual.

Fix: agregar figura, aunque sea diagrama de flujo de advisory board.

### M6 · Frontmatter L47 · "primera versión documentada del rol surge en los años setenta dentro de Upjohn"

- Claim histórico correcto y ampliamente citado; no requiere fuente formal en un prólogo. Nota: si algún lector lo desafía, el consenso público sitúa el origen en Upjohn ~1967 con The Upjohn Medical Science Liaison Program.

Fix: opcional. Añadir "(circa 1967)" al final si se quiere precisar.

### M7 · "según el consenso operativo en industria" — repetido literal 3 veces en Módulo 5

- L87, L257, L372. La expresión se justifica pero rendería mejor con variación mínima ("según el consenso operativo actual", "según la práctica reportada por MSLs senior LATAM", "según lo que reportan hoy afiliadas top-20").

Fix: opcional.

### M8 · "trade press" spanglish

- Repetido varias veces en Módulos 4 y 5. "Prensa especializada" traduce natural.

Fix: opcional; 4-5 apariciones.

### M9 · Módulo 3 L127 · WorldSalaries mencionado como fuente "notablemente más baja"

- Se cita como fuente secundaria pero se descarta implícitamente. Podría eliminarse el número específico "MXN 563,300" para no darle peso.

Fix: reformular como "otras fuentes secundarias (WorldSalaries) publican estimaciones notablemente más bajas; se recomienda triangular con recruiters locales".

### M10 · Módulo 3 L353 · verbo "aseguré" en ejemplo de bullet

- *"Aseguré beca [nombre] con tasa de aceptación X %..."*: el ejemplo es ilustrativo, pero "aseguré" en español latinoamericano suena ligeramente ajeno para "obtuve" o "gané".

Fix: sustituir por "obtuve" o "gané" en ejemplo modelo.

### M11 · Backmatter L145 · "*visitador médico*" con asterisco en la clave del glosario

- Todas las demás entradas del glosario tienen la clave sin cursiva. `***Visitador médico*.**` rompe el patrón visual.

Fix: `**Visitador médico.**` (sin asteriscos internos).

### M12 · Frontmatter L15 · "Guía práctica para científicos de la salud · LATAM y España"

- El punto medio "·" tras "salud" y antes de "LATAM" es correcto según el estilo Solca; consistencia con el resto de portadas de la serie. OK.

Fix: ninguno.

### M13 · Módulo 4 L15 · Timeline overlay "MES 3 · APORTAR" (semanas 9-12) contradice el título "30 / 60 / 90 días"

- La descripción divide en meses (1, 2, 3) y en semanas (1-4, 5-8, 9-12) simultáneamente. Consistente aritméticamente pero pesado de leer.

Fix: simplificar a solo semanas o solo meses.

### M14 · "Máxima" frase muy corta en Módulo 1.7 · "genialidad" es palabra rara

- L231: *"los cinco errores del primer año no son técnicos, son de hábito — se previenen con rituales, no con genialidad."* "Genialidad" pega, pero suena algo grandilocuente para una máxima operativa.

Fix: opcional, "no con inspiración" u otra alternativa más plana.

### M15 · "Módulo 2 L67" · "Total de referencia: cuarenta y cinco minutos; rango: treinta a sesenta."

- Puntuación con dos puntos + punto y coma seguidos en la misma oración. Estilo aceptable pero denso.

Fix: separar en dos oraciones.

### M16 · Módulo 3 L119 · "Advertencia metodológica"

- El párrafo mezcla tres tipos de fuentes (Glassdoor, SalaryExpert, MSL Society) sin jerarquizarlas visualmente. Un bullet list ayudaría.

Fix: opcional; formato aceptable como está.

### M17 · Módulo 5 L149 · "Microsoft Copilot Enterprise, ChatGPT Enterprise, Claude for Work o instancia interna"

- Lista de herramientas específicas — riesgo de envejecimiento del texto (nombres de productos cambian). Aceptable si se declara "cierre editorial ago 2026".

Fix: agregar "(a la fecha de cierre editorial)".

### M18 · Módulo 4 L291 · "MAPS ~10,000 miembros"

- Cifra vigente al cierre editorial. Verificar; el crecimiento MAPS en 2025-2026 podría haberlos llevado a 12,000+.

Fix: opcional; verificar en medicalaffairs.org.

### M19 · Módulo 2 L303 · "Real Decreto Legislativo 1/2015 (Ley de garantías) consolida el marco general"

- Falta año en la referencia inline. Está en el backmatter, pero el módulo debería incluir el año.

Fix: agregar "(BOE-A-2015-8343)" o similar.

### M20 · Formato bullet inconsistente en algunas secciones

- Módulo 4 sección 4.7 alterna entre `- ` y párrafos con **negrita** para lo que parece equivalente semántico (organizaciones enumeradas). Menor.

Fix: consistencia.

---

## Resumen

- **BLOQUEANTES:** 9 (dos usos de "genuinamente" en prólogo y máxima; cita McKinsey del artículo equivocado para las tres cifras clave del Módulo 5; siete `[REF: dossier sección X]` sin resolver; siete marcadores de draft-scaffolding en frontmatter/módulos 4-5/backmatter; numeración caótica de referencias generales; portada usa Inter en vez de Space Grotesk; cifra 30-40 % de tiempo sin fuente; cifra 60/40 presencial-remoto sin fuente; propagación de consenso operativo del prólogo a claims específicos sin caveat).
- **IMPORTANTES:** 18 (EPM Scientific mal-usado como fuente permanente MSL; co-chairs MAPS con dato 2022 tratado como presente; MAPS Americas 2025 sin ancla futura; ratios de bonus sin caveat; sample MSL Society sin caveat; "resumes"/"hiring manager" spanglish evitable; referencias PMC sin URL inline; discrepancia 14 vs 15 multinacionales; framing McKinsey a limpiar tras B2; tres referencias huérfanas en backmatter; tipos de cambio sin fecha; claims específicos en 5.6 sin fuente por tendencia; Chiesi TA verificar; BCMAS en 4.5 vs 4.7; duplicidad Farmaindustria).
- **MENORES:** 20 (spanglish suave, formato, estilo, verificaciones opcionales).

**Reporte guardado en /Users/oscar/proyectos/solca-ciencia/solca/website/_docs/AUDIT_LIBRO_MSL_2026_08.md, 9 bloqueantes, 18 importantes, 20 menores.**
