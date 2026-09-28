# Auditoría editorial · Libro Project Management (agosto 2026)

**Fuente auditada:** `/Users/oscar/Downloads/solca/libro/` — `frontmatter.md`, `modulo_01_draft.md`, `modulo_02_draft.md`, `modulo_03_draft.md`, `modulo_04_draft.md`, `modulo_05_draft.md`, `backmatter.md`. El `.docx` compilado no se auditó.

**Reglas aplicadas:** OSCAR_PROFILE.md · sin emoji, español LATAM, terminología pharma correcta (regla 16), no inventar cifras, sin palabras "genuinamente/honestamente/straightforward", sin placeholders, branding navy `#1B3A6B` / naranja `#E8743A` / off-white `#F7F5EE` / azul medio `#2A6BAC`.

**Conteo:** 12 bloqueantes · 20 importantes · 14 menores.

---

## 1. BLOQUEANTES

### B1 · Título nuevo del libro no está aplicado (frontmatter completo)

- **Archivos/líneas:** `frontmatter.md:1`, `:13`, `:25`; también en headers de `modulo_0*_draft.md` y en el diseño de portada.
- **Cita literal:**
  - Línea 1: `# Front matter — Solca · Project Manager en pharma`
  - Línea 13: `«PROJECT MANAGER EN PHARMA»` (título de portada)
  - Línea 25: `**Project Manager en pharma. Guía práctica para científicos de la salud · LATAM y España.**`
- **Diagnóstico:** el título aprobado por Oscar es **"Project Management · Guía práctica para científicos de la salud · LATAM y España"** (nombre de la disciplina, no del rol). El archivo mantiene "Project Manager en pharma" en portada, en la página de derechos y en el header. Inconsistente con el brief.
- **Fix:** reemplazar en portada y derechos: `«PROJECT MANAGEMENT»` como título principal y `«Guía práctica para científicos de la salud · LATAM y España»` como subtítulo. Actualizar el header del `frontmatter.md` también.

### B2 · Cifra Novartis 678M no coincide con la URL citada

- **Archivo/línea:** `modulo_01_draft.md:132` y ref `:212`.
- **Cita literal:** *"Novartis acordó pagar USD 678 millones en el settlement con el Department of Justice... Fuente: DOJ Press Release (https://www.justice.gov/archives/opa/pr/novartis-pays-over-642-million-settle-allegations-improper-payments-patients-and-physicians)."*
- **Diagnóstico:** la URL del DOJ titula literalmente **"$642 million"**. Los $678M se obtienen agregando $591.4M kickbacks + $51.25M copay + $38.4M forfeiture + porción state Medicaid, según Bloomberg/Fierce Pharma. Un lector que abra el URL verá $642M y no podrá reconciliar. Es incumplimiento de regla 6 (referencias citadas).
- **Fix:** o bien (a) usar $642M para casar con la URL oficial DOJ, o (b) añadir una segunda cita para sustentar los $678M — por ejemplo Fierce Pharma (https://www.fiercepharma.com/pharma/novartis-former-sales-rep-gets-109m-for-blowing-whistle-doctor-kickbacks) o Bloomberg. El $109.4M al whistleblower Bilotta también requiere esa segunda fuente (el DOJ dice explícitamente que la cifra "has not yet been determined" al momento del press release).

### B3 · "BIO Industry Analysis (2024) reporta 6.7% overall" — fuente incorrecta

- **Archivo/línea:** `modulo_04_draft.md:80`; ref `:208` cita el reporte BIO 2011-2020.
- **Cita literal:** *"BIO Industry Analysis (2024) reporta 6.7% overall."*
- **Diagnóstico:** la cifra **6.7%** no proviene de BIO. Viene del análisis de **Citeline / Biomedtracker** (2024) publicado en pharmaphorum. El reporte BIO "Clinical Development Success Rates and Contributing Factors 2011-2020" reporta **7.9% overall**, no 6.7%. Misatribución de fuente + cifra incorrecta contra la fuente citada.
- **Fix:** dos opciones:
  - (a) cambiar la cita a *"Citeline/Biomedtracker (2024) reporta 6.7% overall"* con URL de pharmaphorum (https://pharmaphorum.com/rd/clinical-development-rates-are-falling-its-not-all-bad-news).
  - (b) mantener BIO y corregir la cifra a **7.9% overall** para 2011-2020, actualizando la ref bibliográfica al PDF oficial (https://go.bio.org/rs/490-EHZ-999/images/ClinicalDevelopmentSuccessRates2011_2020.pdf).

### B4 · Vacaciones legales España: cifra invertida contra el Estatuto de los Trabajadores

- **Archivo/línea:** `modulo_03_draft.md:263`.
- **Cita literal:** *"El mínimo legal es de 22 días laborables (equivalente a 30 días naturales) al año."*
- **Diagnóstico:** el Art. 38.1 del Estatuto de los Trabajadores establece el mínimo como **30 días naturales**, no 22 días laborables. La equivalencia "22 laborables ≈ 30 naturales" es una interpretación práctica común, pero el texto legal se expresa exclusivamente en días naturales. Presentar "22 laborables" como el mínimo legal es incorrecto.
- **Fix:** *"El mínimo legal es de 30 días naturales al año (equivalente a unos 22 días laborables), según el artículo 38 del Estatuto de los Trabajadores."*

### B5 · EPM Scientific Guide 2026 es guía de tarifas contract/freelance, no de salarios permanentes

- **Archivos/líneas:** `modulo_03_draft.md:243`, `:249`, `:253`; ref `:306`; `backmatter.md:145`.
- **Cita literal:** *"Los datos que siguen provienen de la guía EPM Scientific 'Europe Life Sciences Rates Guide 2026'... Rango orientativo EUR 45,000 – 65,000 anuales..."*
- **Diagnóstico:** la guía EPM Scientific verificada (https://www.epmscientific.com/en-us/industry-insights/compensation-guides/europe-life-sciences-rates-guide-2026) declara explícitamente: *"Hourly rates for 80+ high-demand roles"* y *"Benchmark contractor day rates across 13 European markets."* Es una guía de **contract rates** para consultores independientes, no salarios de puesto permanente. Además, la FAQ enumera CRA, CSV Engineer, QA Manager, Medical Monitor, Biostatistician, Regulatory Manager, Automation Engineer, Medical Director — **no menciona "Project Manager" explícitamente**. Los rangos anuales permanentes que cita el libro (EUR 45-65k, 60-85k, 80-120k) NO se derivan directamente de esta guía. Incumple regla 5 (referencias citadas).
- **Fix:** dos opciones:
  - (a) reservar la cita EPM SOLO para el párrafo de "contract rate de referencia" (EUR 64-86/hora), aclarando que aplica a consultoría/contract, y sustituir la triangulación de salario permanente por Glassdoor España + InfoJobs + LinkedIn Salary Insights, o por el guide anual de Michael Page / Hays / Randstad Pharma que sí cubren permanentes.
  - (b) aclarar en el propio texto que **EPM Scientific Guide 2026 es contract-only**, y que la triangulación para permanentes viene de Glassdoor + InfoJobs, sin sostener las cifras anuales en EPM.
- **Consecuencia adicional:** también debe corregirse el pie de la referencia 2 en `modulo_03_draft.md:306` y de la ref 14 en `backmatter.md:145` para clasificarla como "contract rates".

### B6 · "El ochenta por ciento de las oportunidades no se publica" — cifra sin fuente, mito refutado

- **Archivo/línea:** `modulo_03_draft.md:122`.
- **Cita literal:** *"El ochenta por ciento de las oportunidades no se publica. Si solo aplicas a vacantes públicas, accedes a menos del veinte por ciento del mercado real."*
- **Diagnóstico:** cifra clásica del "hidden job market" originada en un texto de Richard Bolles (1970s) sin dataset publicado. Diversos análisis modernos (LinkedIn, ADP, académicos de HRM) refutan el 80% como cifra medible. Regla 6 y 6b: cifras sin URL verificable no se afirman en tono absoluto.
- **Fix:** eliminar la cifra específica y afirmar cualitativamente: *"Muchas oportunidades no llegan al listado público; la referencia interna reduce el riesgo de mala contratación y los reclutadores prefieren candidatos ya vinculados a alguien en la empresa. Por eso el networking no es opcional."* (mantiene la lógica sin inventar %).

### B7 · "5 / 5 / 85 / 5" del esfuerzo por fase — cifra específica sin fuente

- **Archivo/línea:** `modulo_02_draft.md:9` (design de imagen 2.1); apoyada por texto en `:15` ("menos del diez por ciento") y `:41` ("más del ochenta por ciento").
- **Cita literal:** *"proporción aproximada del esfuerzo (5% / 5% / 85% / 5%)"*.
- **Diagnóstico:** proporción presentada como dato dentro de una figura, sin fuente. El PMBOK 7ª ed. no establece este split. Ninguna referencia sostiene la precisión "85%".
- **Fix:** cambiar la etiqueta del image spec a lenguaje cualitativo — *"Etapas breves de iniciación y planeación; ejecución concentra el grueso del esfuerzo; cierre corto pero explícito"*. Y en `:15` reemplazar "menos del diez por ciento" por "una fracción menor" o citar fuente. En `:41`, reemplazar "más del ochenta por ciento" por "el grueso del esfuerzo" o similar.

### B8 · "5-7 horas diarias en reuniones" + "menos del 20% del día en técnico" sin fuente

- **Archivo/línea:** `modulo_01_draft.md:39`.
- **Cita literal:** *"El PM promedio pasa entre cinco y siete horas diarias en reuniones, escritura y coordinación. Menos del 20% del día se dedica a trabajo técnico directo."*
- **Diagnóstico:** dos cifras cuantitativas sin URL, sin autor citado, presentadas en tono absoluto. No hay dataset propio que las sustente.
- **Fix:** dos opciones:
  - (a) reformular sin cifras: *"El PM promedio pasa la mayor parte del día en reuniones, escritura y coordinación. El tiempo dedicado a trabajo técnico directo es bajo. Saberlo antes te ahorra la sorpresa..."*
  - (b) si Oscar quiere mantener cifras, apoyarlas en un estudio verificable (por ejemplo PMI Pulse of the Profession) con URL.

### B9 · Título de la portada llama "PROJECT MANAGER EN PHARMA" con tipografía **Inter** en título principal

- **Archivo/línea:** `frontmatter.md:13`.
- **Cita literal:** *"Bloque 2 (título principal, off-white #F7F5EE, Inter weight 900, tamaño grande, dos líneas): «PROJECT MANAGER EN PHARMA»"*.
- **Diagnóstico:** inconsistencia con el style guide de la marca. En `modulo_01_draft.md:5` se define: *"Tipografía: Inter para sans-serif (cuerpo y data), **Space Grotesk** para etiquetas/labels (uppercase con letter-spacing)"*. El título principal en uppercase debería usar **Space Grotesk**, no Inter. Además, "Inter weight 900" no es un peso soportado por Inter (Inter llega a 900 solo en la variante variable — verificar que el pipeline lo tenga).
- **Fix:** cambiar a `Space Grotesk weight 700 uppercase con tracking amplio` para el título; conservar Inter solo para el subtítulo italic si se quiere el contraste. Alinea también con B1 (nuevo título).

### B10 · Placeholder implícito en design brief de imagen 1.2: "símbolo Solca"

- **Archivo/línea:** `modulo_01_draft.md:53`.
- **Cita literal:** *"Centro: símbolo Solca."*
- **Diagnóstico:** no hay definición de qué es "símbolo Solca". Instrucción vaga que un ilustrador no puede ejecutar sin más info. Similar a un placeholder no resuelto (regla 13).
- **Fix:** especificar (por ejemplo, "punto naranja `#E8743A` que aparece como marca en portada" o "iniciales SC en Space Grotesk"). Si el símbolo aún no existe, decidirlo antes de la impresión.

### B11 · "Novartis-Bilotta" — nombre de caso técnicamente incorrecto

- **Archivo/línea:** `modulo_01_draft.md:132`.
- **Cita literal:** *"un ejemplo verificable en industria pharma es el caso Novartis-Bilotta (Estados Unidos, cerrado en 2020)."*
- **Diagnóstico:** el caso se llama **United States ex rel. Bilotta v. Novartis Pharmaceuticals Corp.**, No. 11-Civ.-0071-PGG (S.D.N.Y.) (según el propio DOJ press release). "Novartis-Bilotta" como nombre de caso no es correcto. Puede confundir a un profesional que quiera buscarlo.
- **Fix:** *"un ejemplo verificable en industria pharma es el caso Bilotta v. Novartis (Estados Unidos, cerrado en 2020, US ex rel. Bilotta v. Novartis Pharmaceuticals Corp.)"*.

### B12 · "Reforma laboral española de 2022" imprecisa

- **Archivo/línea:** `modulo_03_draft.md:259`.
- **Cita literal:** *"La reforma laboral española de 2022 restringió significativamente el uso del contrato temporal."*
- **Diagnóstico:** la norma es el **Real Decreto-ley 32/2021, de 28 de diciembre**, con entrada en vigor mayoritariamente el 30 de marzo de 2022. Llamarla "reforma laboral de 2022" es la nomenclatura coloquial más común, aceptable, pero para un texto sobre marco legal que quiere ser preciso debería citar la norma. Además el listado de referencias (línea 314) dice "Real Decreto-ley 32/2021" — hay inconsistencia interna entre cuerpo y bibliografía.
- **Fix:** *"La reforma laboral (Real Decreto-ley 32/2021, en vigor desde marzo de 2022) restringió significativamente el uso del contrato temporal."*

---

## 2. IMPORTANTES

### I1 · Palabra prohibida "genuino" (2 ocurrencias)

- **Archivo/línea:** `modulo_03_draft.md:116`, `:211`.
- **Cita literal:** *"tu interés genuino"* (116) y *"Muestra entusiasmo genuino"* (211).
- **Diagnóstico:** OSCAR_PROFILE prohíbe "genuinamente/honestamente/straightforward"; "genuino" cae en la misma familia estilística y suena a filler.
- **Fix:** *"tu interés real"* y *"Muestra entusiasmo por la empresa, el equipo, la oportunidad"* (basta con el sustantivo entusiasmo sin adjetivo).

### I2 · Regla 16 — "compliance" en cuerpo cuando existe "cumplimiento normativo"

- **Archivo/línea:** `modulo_01_draft.md:132` ("*compliance*"), `modulo_02_draft.md:190` ("Compliance regulatorio estricto").
- **Diagnóstico:** hay traducción castellana obvia. La regla admite excepciones para nombres operativos; "compliance" como sustantivo autónomo se usa en industria pero "cumplimiento" (o "cumplimiento normativo") funciona en español. Se recomienda castellanizar salvo cuando refiere a departamento formal ("Compliance Department").
- **Fix:** en 132: *"los sistemas internos de cumplimiento normativo existen precisamente porque..."*. En 190: *"Cumplimiento regulatorio estricto que exige documentación..."*.

### I3 · Regla 16 — "footprint" cuando existe "presencia" o "huella"

- **Archivos/líneas:** `modulo_02_draft.md:286` ("footprint pharma europeo"), `modulo_03_draft.md:229` (H3 "Multinacionales con footprint Iberia").
- **Fix:** *"presencia pharma europea"* / *"Multinacionales con presencia consolidada en Iberia"*.

### I4 · Regla 16 — "hubs" / "hub" cuando existe "centro"

- **Archivos/líneas:** `modulo_02_draft.md:286` ("hubs regionales"); `modulo_03_draft.md:231`, `:273` ("hub español").
- **Fix:** "centros regionales", "centro español".

### I5 · Regla 16 — "cross-regional", "cross-functional"

- **Archivos/líneas:** `modulo_02_draft.md:300` ("lanzamientos cross-regional"); `modulo_03_draft.md:247` ("coordinación cross-functional"); `backmatter.md:45` ("alianzas cross-regional").
- **Fix:** "lanzamientos multi-región", "coordinación entre áreas", "alianzas entre regiones". Términos con calco anglosajón redundante en español.

### I6 · Regla 16 — "pipeline" en contexto no técnico farma

- **Archivo/línea:** `modulo_03_draft.md:203`.
- **Cita:** *"Métodos, proyectos en pipeline, valores corporativos"*.
- **Diagnóstico:** en pharma "pipeline" = cartera de productos en desarrollo, término legítimo. Pero aquí se usa en sentido genérico "proyectos en curso"; hay traducción obvia ("en curso" / "en cartera").
- **Fix:** *"Métodos, proyectos en curso, valores corporativos"*. Mantener "pipeline" solo cuando se refiera al pipeline farmacéutico.

### I7 · Regla 16 — "contract manufacturing"

- **Archivo/línea:** `modulo_03_draft.md:237`.
- **Cita:** *"presencia en heparinas y contract manufacturing"*.
- **Fix:** *"presencia en heparinas y fabricación por contrato (contract manufacturing)"* — glosar la primera vez, castellanizar después.

### I8 · Regla 16 — "daily standups", "sprint" en frases no formales

- **Archivo/línea:** `modulo_03_draft.md:108`.
- **Cita:** *"Sprints, daily standups, herramientas digitales"*.
- **Diagnóstico:** "sprint" es término formal de Scrum, se mantiene. "daily standups" tiene equivalente castellano habitual: "reuniones diarias" o "daily meeting" solo si es rótulo del ritual. En un párrafo descriptivo español, es preferible traducir.
- **Fix:** *"Sprints, reuniones diarias del equipo, herramientas digitales"*.

### I9 · Regla 16 — "submissions FDA"

- **Archivo/línea:** `backmatter.md:45`.
- **Cita:** *"rara vez ejecuta submissions FDA directas"*.
- **Fix:** *"rara vez ejecuta presentaciones (submissions) directas ante la FDA"*.

### I10 · "pharma" como adjetivo repetido — decidir criterio

- **Archivos/líneas:** múltiples (frontmatter `:25`; modulo 2 `:280-306`; modulo 3 `:225-281`).
- **Diagnóstico:** "pharma" se usa como adjetivo/sustantivo (industria pharma, PM pharma) con alta frecuencia. En español es más natural "farma" o "farmacéutica". El libro no aplica criterio uniforme (dice "PM pharma", "industria pharma", "empresas locales" sin "farma"). No es incorrecto pero rompe uniformidad si el resto del catálogo Solca usa "farma".
- **Fix:** decidir uno y aplicarlo global. Sugerencia: "farma" (con f, calco castellanizado ya asentado en LATAM) o "farmacéutica".

### I11 · "Bristol-Myers Squibb" con guión — rebranding 2020

- **Archivo/línea:** `modulo_03_draft.md:231`.
- **Diagnóstico:** desde 2020 la empresa se identifica como **"Bristol Myers Squibb"** (sin guión). La cara pública, tarjetas y web (bms.com) lo omiten. El guión es la forma histórica.
- **Fix:** actualizar a *"Bristol Myers Squibb"*.

### I12 · "PMI Salary Survey 14ª edición (2025)" — verificar edición y año

- **Archivos/líneas:** `modulo_03_draft.md:74`, `:78`, ref `:305`; `modulo_04_draft.md:118`; `backmatter.md:121`.
- **Diagnóstico:** el PMI *Earning Power* está en la **13ª edición** (publicada en 2023 para el ciclo 2021-2022) al momento de este análisis. La 14ª edición puede existir; se recomienda verificar la portada del PDF antes de fijar la cita en imprenta. La cifra específica "USD 26,500 anuales" (Brasil, línea 78) y "USD 48,000 para proyectos grandes" atribuida a PMI 14ª ed. no se verificó contra fuente primaria en esta auditoría — Oscar debe abrir el PDF del PMI y confirmar (o pedirme que lo verifique con el archivo local).
- **Fix:** confirmar edición y año exactos del PMI Salary Survey antes de imprenta y actualizar las tres referencias en bloque. Si es 13ª ed. (2023), cambiar todas. Si es 14ª ed. y salió efectivamente antes de ago/2026, verificar que las cifras específicas de Brasil citadas están en esa edición.

### I13 · Argentina — cifras cualitativas sin fuente

- **Archivo/línea:** `modulo_03_draft.md:84`.
- **Cita:** *"acceden a rangos cercanos a los de Brasil o Chile"* y `:94` en la tabla: "Argentina 12,000 – 25,000 · Entrada 8,000 · Senior 35,000+".
- **Diagnóstico:** Argentina no aparece en la lista de fuentes principales de la línea 74 con cifra específica argentina publicada. El texto dice que la volatilidad hace difícil dar cifras estables — pero luego la tabla da rangos que necesitan sustento.
- **Fix:** o citar fuente para la tabla (por ejemplo, Bumeran/Randstad Argentina 2025) o marcar "Argentina — rango orientativo, alta volatilidad. Estimación propia basada en publicaciones de agencias regionales; verificar al momento de aplicar."

### I14 · Reforma laboral España 2021/2022 · listado de contratos

- **Archivo/línea:** `modulo_03_draft.md:259`.
- **Cita:** *"Contratos temporales quedan reservados a situaciones específicas: sustitución, obra o servicio con causa acreditada, y algunas becas o contratos de formación en etapas muy tempranas de carrera."*
- **Diagnóstico:** el RD-ley 32/2021 **eliminó el contrato por "obra o servicio determinado"**. Los contratos temporales actuales son: (a) circunstancias de la producción, (b) sustitución de persona trabajadora, (c) formativos (formación en alternancia + práctica profesional). "Obra o servicio" es la nomenclatura anterior. Es imprecisión legal.
- **Fix:** *"quedan reservados a: sustitución de persona trabajadora, circunstancias de la producción con causa acreditada, y contratos formativos (formación en alternancia y práctica profesional)."*

### I15 · "La reforma laboral española de 2022 restringió significativamente" — verificar y matizar

- Ya cubierto en B12; se marca aquí también porque toca la misma cadena de párrafos legales que necesitan revisión conjunta.

### I16 · "IE, ESADE, IESE, EADA, Barcelona Health Hub" — el último no es escuela de posgrado

- **Archivo/línea:** `modulo_03_draft.md:277`.
- **Cita:** *"escuelas de negocio (IE, ESADE, IESE, EADA, Barcelona Health Hub, entre otras)"*.
- **Diagnóstico:** Barcelona Health Hub NO es escuela de negocios ni universidad. Es una asociación / hub sectorial que aloja startups de salud digital y organiza eventos. No emite másters oficiales. Mezclarlo con IE/ESADE/IESE/EADA confunde al lector.
- **Fix:** eliminar Barcelona Health Hub del listado o moverlo a otra sección ("comunidades y hubs sectoriales relevantes"). Añadir en su lugar, si se quiere ampliar oferta pharma: **CESIF** (Madrid), **UNAV** (Master en Farmacia Industrial), **UB / UAB** (Msc en Investigación Clínica) — todas con oferta reconocida en LATAM.

### I17 · Frontmatter — "pharmacovigilancia" NO aparece, pero conviene cerciorarse en el pipeline de figuras

- **Archivos/líneas:** revisar cualquier prompt de imagen que la make_images.py pueda tomar automáticamente. No se detectó "pharmacovigilancia" en los `.md` fuente (correcto), pero la regla 16 recuerda que el detonante fue precisamente ese calco. Reforzar en el pipeline `make_images.py` que use "farmacovigilancia".

### I18 · "Nature Communications 2025" · verificar mes de publicación

- **Archivo/línea:** `modulo_04_draft.md:80`.
- **Diagnóstico:** el paper Zhou et al. citado (PMC12572394) se publicó en octubre 2025. La cita queda validada, pero la referencia no incluye número de volumen ni DOI — buena práctica editorial es hacerlo.
- **Fix:** actualizar ref 2 en `modulo_04_draft.md:207` a: *"Zhou, Y. et al. 'Dynamic clinical trial success rates for drugs in the 21st century.' Nature Communications 16 (2025). https://www.nature.com/articles/s41467-025-64552-2"* (el título real del paper y URL a la revista, más fiable que solo el PMC mirror).

### I19 · Título del paper Zhou incorrecto en la referencia

- **Archivo/línea:** `modulo_04_draft.md:207`.
- **Cita:** *"'Clinical trial success rates and their determinants across therapeutic areas.'"*
- **Diagnóstico:** el título real del artículo es **"Dynamic clinical trial success rates for drugs in the 21st century"**. La cita del libro le adjudica un título distinto (posiblemente confusión con otro paper). Es dato bibliográfico erróneo — un lector no encontrará el artículo con ese título.
- **Fix:** aplicar el título real (ver I18).

### I20 · Refactor de "Iteración 4" — marca interna que no debe llegar a la versión final

- **Archivos/líneas:** `frontmatter.md:3`; `modulo_01_draft.md:3`, `:5`, `:217`; `modulo_02_draft.md:3`, `:346`; `modulo_03_draft.md:3`, `:318`; `modulo_04_draft.md:3`, `:214`; `modulo_05_draft.md:3`, `:185`; `backmatter.md:167`.
- **Cita:** *"> Iteración 4 · Reescritura..."* y *"> Fin del Módulo X · iteración 4."*
- **Diagnóstico:** son notas internas de versión que en la versión pública del libro no deben aparecer. Si el pipeline docx las suprime, ok; si no, quedan en el output.
- **Fix:** o eliminarlas de los `.md`, o marcarlas con un comentario HTML (`<!-- iteración 4 -->`) que el conversor descarte. Confirmar contra el `build_docx.py`.

---

## 3. MENORES

### m1 · "*settlement*" — término aceptable en el contexto legal, pero glosar la primera vez

- **Archivo/línea:** `modulo_01_draft.md:132`.
- **Fix:** *"acordó pagar USD 642 millones en el acuerdo (settlement) con el Department of Justice"* la primera vez.

### m2 · "*whistleblower*" — glosar la primera vez

- **Archivo/línea:** `modulo_01_draft.md:132`.
- **Fix:** *"el whistleblower (denunciante interno)"* la primera vez.

### m3 · "*out-of-pocket*" — glosar la primera vez

- **Archivo/línea:** `modulo_04_draft.md:78`.
- **Fix:** *"componente out-of-pocket (gasto directo, no capitalizado) de USD 1,395 millones"*.

### m4 · "USD 500,000" sin contexto de industria/año

- **Archivo/línea:** `modulo_03_draft.md:190`.
- **Cita:** *"Coordiné proyecto de investigación con financiamiento externo de USD 500,000; entregado en plazo"* (ejemplo).
- **Diagnóstico:** aunque es un ejemplo ilustrativo, la cifra puede leerse como norma. Añadir "por ejemplo" es suficiente.
- **Fix:** *"por ejemplo, 'Coordiné proyecto de investigación con financiamiento externo de aproximadamente USD 500,000...'"*.

### m5 · "Reunion / meeting" en glosario — verificar formalidad

- **Archivo/línea:** `backmatter.md:63`, `modulo_02_draft.md:122`.
- **Diagnóstico:** "kickoff meeting" está bien como término operativo. Glosario y cuerpo son consistentes; ok.

### m6 · Regla 16 — "*headline*" (LinkedIn)

- **Archivo/línea:** `modulo_03_draft.md:154`.
- **Diagnóstico:** "headline" es la etiqueta que LinkedIn usa en su UI en español ("Titular"). La UI de LinkedIn en español efectivamente lo llama "titular".
- **Fix:** *"Titular (headline)"* con glosa la primera vez, y luego "titular".

### m7 · "*resume*" — glosar y decidir criterio

- **Archivos/líneas:** `frontmatter.md:85`; `modulo_03_draft.md:120` (H2), `:188`, `:190`, `:199`; `modulo_03_draft.md:293`.
- **Diagnóstico:** en LATAM "CV" es el término dominante; "resume" es el término americano para el documento resumido de industria. El libro usa ambos y contrasta *"CV académico"* vs *"resume de industria"*. La distinción está bien pero un lector español (España) usa "currículum" u "hoja de vida" y puede sentir "resume" como innecesariamente anglófilo. Se recomienda glosar la primera vez la distinción o usar "currículum de industria" para no depender del anglicismo.
- **Fix:** *"currículum de industria (resume, en jerga americana)"* la primera vez; después "currículum" o "resume" consistentemente.

### m8 · "*bullets*" — traducir

- **Archivo/línea:** `modulo_03_draft.md:293`.
- **Fix:** *"traduce cada logro... a viñetas (bullets)"*.

### m9 · "*medtech*" — glosar la primera vez

- **Archivos/líneas:** `modulo_02_draft.md:242`, `modulo_03_draft.md:108`.
- **Fix:** *"medtech (tecnología médica)"* la primera aparición.

### m10 · "*digital health*" — glosar

- **Archivos/líneas:** varias apariciones. Es concepto de industria; se puede sostener en inglés dentro del glosario. Como aparece frecuentemente, considerar glosar la primera vez: *"digital health (salud digital)"*.

### m11 · Redundancia "sponsor / patrocinador" — decidir criterio uniforme

- **Diagnóstico:** el libro alterna entre "sponsor" y "patrocinador" en varios pasajes (ejemplos: `modulo_01_draft.md:15` "project sponsor"; `modulo_02_draft.md:53` "el patrocinador aprueba"). Ambas son válidas pero uniforma la voz.
- **Fix:** decidir. Sugerencia: "patrocinador" como default español; usar "sponsor" solo cuando refiera al rol técnico en ensayos clínicos ("sponsor del ensayo" es el término legal ICH-GCP).

### m12 · Design brief imagen 3.4 · pie "fuente y año" queda sin especificar

- **Archivo/línea:** `modulo_03_draft.md:72`.
- **Cita:** *"Pie: fuente y año."*
- **Diagnóstico:** instrucción vaga que el ilustrador rellenará por su cuenta. Debe fijarse la fuente específica del gráfico.
- **Fix:** *"Pie: 'Fuente: PMI Earning Power Salary Survey (2025); SalaryExpert (2025); EALDE (2025); WorldSalaries (2025). Rangos brutos anuales, USD equivalente al cierre editorial ago/2026'."*

### m13 · "más de diez años" para desarrollo de fármaco — cifra suelta

- **Archivo/línea:** `modulo_04_draft.md:76`.
- **Cita:** *"El desarrollo de un nuevo medicamento puede tomar más de diez años desde el descubrimiento hasta la aprobación regulatoria."*
- **Diagnóstico:** consenso operativo aceptado (10-15 años); acotable con fuente PhRMA o Tufts CSDD para hacerlo verificable.
- **Fix:** añadir en la misma frase: *"(PhRMA, 2024, phrma.org)"* o similar.

### m14 · "USA / UK" — decidir castellanización

- **Archivo/línea:** `modulo_02_draft.md:292`, `backmatter.md:45`.
- **Diagnóstico:** en un texto español pro-LATAM se prefiere "EE. UU." y "Reino Unido". "USA" y "UK" son abreviaciones americanas.
- **Fix:** *"trato constante con equipos de EE. UU. y Reino Unido"*.

---

## Notas finales

**Anclaje temporal (regla 11):** el libro cumple bien esta regla — declara "cierre editorial ago/2026" en frontmatter, `modulo_03:54`, `modulo_03:70`, `modulo_03:241`, `modulo_05:3`, `modulo_05:153`. No hay incumplimientos aquí.

**Sin emoji (regla 4):** verificado — no se detectó ningún emoji Unicode en los `.md` fuente.

**Sin las palabras "genuinamente / honestamente / straightforward":** verificado, no aparecen. Sí aparece "genuino" 2x (I1).

**Branding paleta (regla implícita):** los briefs de imagen usan navy `#1B3A6B`, naranja `#E8743A`, off-white `#F7F5EE`, azul medio `#2A6BAC` de forma consistente. La única inconsistencia detectada es I19/B9 (tipografía del título principal debería ser Space Grotesk, no Inter).

**URLs revisadas activamente:**
- `https://www.justice.gov/archives/opa/pr/novartis-pays-over-642-million-...` — responde, título dice $642M (ver B2).
- `https://pubmed.ncbi.nlm.nih.gov/26928437/` — responde, cifras DiMasi 2016 verificadas ($2,558M capitalizado, $1,395M out-of-pocket, 106 fármacos, 10 firmas).
- `https://pmc.ncbi.nlm.nih.gov/articles/PMC12572394/` — protegido por reCAPTCHA en fetch automático, pero el paper Zhou et al. está verificado vía búsqueda web (453,366 ensayos ✓, Fase II 32.4% ✓); título en la ref bibliográfica está mal (ver I19).
- `https://www.epmscientific.com/en-us/industry-insights/compensation-guides/europe-life-sciences-rates-guide-2026` — responde, la guía es contract-rates, no permanent-salary (ver B5).
- `https://www.glassdoor.es/Sueldos/senior-project-manager-sueldo-SRCH_KO0,22.htm` — responde, promedio España Senior PM 55k€ base (soporta orden de magnitud citado por libro, ok).

**URLs NO revisadas por la naturaleza dinámica o gated de la fuente:**
- `linkedin.com/salary` — requiere login.
- `salaryexpert.com`, `worldsalaries.com`, `ealde.es`, `talenbrium.com`, `infojobs.net` — no se abrieron individualmente; se recomienda que Oscar verifique las cifras específicas MXN 409k / COP 60M / CLP 30.4M contra la página fuente antes de imprenta, ya que la vida útil del dato es corta (cambia con divisa).
