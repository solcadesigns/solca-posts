# Backlog · Blog semanal solcaciencia.com

> Backlog rotativo. Cada lunes tomo el siguiente item de "Pendientes",
> transformo la fuente LinkedIn en blog SEO-optimizado, y muevo el item a "En review"
> al abrir el PR, luego a "Publicados" al merge.

---

## Pendientes (siguiente semana → cuatro semanas)

| Semana | Fecha objetivo | Fuente LinkedIn | Keyword primary tentativa | Slug propuesto |
|---|---|---|---|---|

_Refrescado 1 sep 2026._ El sprint LinkedIn sept 2026 aporta 3 items derivados de los newsletters #18, #19 y #20 (viernes 4, 11 y 18 sept). Se transforman a blog con optimización GEO/AEO (TL;DR blockquote, FAQ estructurada con preguntas naturales, tabla comparativa, definiciones inline de siglas). Rotación de CTAs: revisar-cv, simulador, libro PM + revisar-cv.

| Semana | Fecha objetivo | Fuente LinkedIn | Keyword primary tentativa | Slug propuesto |
|---|---|---|---|---|
| Sem 2 | Vie 11 sep 2026 | Vie 4 sep · Insight #18 "Filtros silenciosos" | requisitos ocultos vacantes pharma | requisitos-ocultos-vacantes-pharma-linkedin-como-leerlas |
| Sem 3 | Vie 18 sep 2026 | Vie 11 sep · Insight #19 "Preparar entrevista" | preparar entrevista pharma checklist | preparar-entrevista-pharma-antes-checklist-5-piezas |
| Sem 4 | Vie 25 sep 2026 | Vie 18 sep · Insight #20 "Habilidades PM" | habilidades project management cv pharma | habilidades-project-management-cv-pharma-traducir-academia |

Los 3 drafts ya están escritos y en `src/content/blog/` con pubDate correcto. Pendiente: (a) generar los 3 covers con `scripts/generate-blog-cover.py`; (b) agente revisor (regla 15) sobre los 3 antes de merge; (c) Oscar hace review/PR.

---

## Notas de priorización

**Regla de rotación:** primer y último blog del backlog derivan de un Vie (Solca Insight), los dos intermedios de un Mié (serie vacantes). Mantiene alternancia y no satura de un tipo.

**Vie 21 ago 2026** (Insight #16 "Cierre del mes") NO se transforma en blog. Es un post editorial de cierre, se aprovecha para el email broadcast de resumen mensual (fuera de cadencia semanal).

**Vie 7 ago 2026** (post dedicado simulador) NO se transforma. Es promoción de producto.

**Mié 30 jul 2026** (Serie #1 "El gap silencioso") — ~~comodín de semana 5~~ **CONSUMIDO** el 31 ago 2026 como fuente del blog `vacantes-pharma-piden-cinco-anos-experiencia-aplicar` (pubDate 4 sep 2026).

---

## En review (PR abiertos)

| Slug | Título final | Draft | pubDate | Fuente |
|---|---|---|---|---|
| entrevista-pharma-ingles-b2-c1-como-prepararla | "Entrevista pharma en inglés: cómo prepararla de B2 a C1" | Lun 27 jul 2026 | Vie 7 ago 2026 | Vie 31 jul · Insight #13 |
| farmacovigilancia-entry-level-trainee-cro-latam | "Farmacovigilancia entry-level: qué dicen los postings trainee" | Lun 3 ago 2026 | Vie 14 ago 2026 | Mié 6 ago · Serie #2 |
| cro-latam-entry-level-icon-iqvia-que-piden-en-realidad | "Trabajar en un CRO en LATAM sin experiencia: por dónde entrar" | Lun 10 ago 2026 | Vie 21 ago 2026 | Mié 13 ago · Serie #3 |
| calidad-regulatorio-practicas-entry-level-pharma-latam | "Calidad, regulatorio y prácticas: entrar a pharma LATAM" | Lun 17 ago 2026 | Vie 28 ago 2026 | Mié 20 ago · Serie #4 |
| vacantes-pharma-piden-cinco-anos-experiencia-aplicar | "Vacantes pharma que piden 5 años: cuándo aplicar y cuándo no" | Lun 31 ago 2026 | Vie 4 sep 2026 | Mié 30 jul · Serie #1 (comodín) |

Nota (31 ago 2026): fuente usada `_docs/SPRINT_AGO_2026_DRAFTS_v2.md`, sección "Mié 30 jul · Serie vacantes #1 · El gap silencioso" (v2 es la versión vigente; v1 descartada). "Pendientes" estaba vacío, así que se activó el comodín de semana 5 que ya estaba previsto en la nota del 17 ago. `SPRINT_LINKEDIN_SEP_2026.md` existe y es más reciente, pero (a) no coincide con el patrón `SPRINT_*_DRAFTS*.md` del workflow y (b) su propia cabecera declara que el blog SEO del lunes queda fuera de ese plan. No se usó como fuente. Desviaciones y decisiones tomadas sin consultar:

1. **Fecha.** pubDate 2026-09-04, verificado como viernes real (`date -d 2026-09-04 +%A` → Friday).
2. **Slug y keyword reorientados para no canibalizar.** El ángulo del post LinkedIn ("aplican sin experiencia") caía directo sobre `trabajar-industria-farmaceutica-sin-experiencia-latam` (13 jul, keyword "sin experiencia") y sobre `entry-level-pharma-realidad-vacantes-latam` (24 jun, keyword entry-level). La keyword se movió al lado del requisito —"vacantes pharma que piden 5 años de experiencia"— que es intención de búsqueda distinta (decidir si aplicar) y hueco real del corpus. Los dos posts en riesgo quedan linkeados inline, más el de CRO ICON/IQVIA y el comparativo MSL/CRA/PM/HEOR.
3. **Frame "gap silencioso" evitado.** El título del LinkedIn no rinde SEO (nadie busca "gap silencioso"). El blog usa "piden 5 años", que sí es lenguaje de búsqueda.
4. **Muestra sin N exacto.** El post LinkedIn dice "varias decenas de postings" sin conteo auditable. El blog no reproduce esa cifra vaga: describe el desajuste en tres tipos de vacante nombrados (CRA senior, asuntos regulatorios, coordinación de estudios clínicos) y ancla el dato auditable en el post publicado de las 59 vacantes de junio. Cero porcentajes.
5. **Serie y seriesIndex.** `lo-que-dicen-las-vacantes`, index 12 (el 11 es el post de calidad del 28 ago).

Fuentes externas verificadas abriendo la URL: [Burning Glass Institute · The Emerging Degree Reset](https://www.burningglassinstitute.org/research/the-emerging-degree-reset) (texto literal sobre el degree reset confirmado; se cita etiquetando que es EE. UU. y que el requisito es el título, no los años) y [ICON · Graduate Opportunities](https://careers.iconplc.com/graduate-opportunities) (página confirmada: programas de graduados, enlace a vacantes vigentes de esa categoría y recomendación de registrarse en alertas). La página de LinkedIn Help sobre applicant insights se intentó como tercera fuente pero está bloqueada para fetch y para el navegador; la afirmación se reformuló como observación propia acotada.

CTA: `/quiz-rol` (ruta verificada en `src/pages/quiz-rol.astro`: 8 preguntas, tres rutas PM / MSL / Clinical Research). El blog no trata un rol específico fuera del alcance del quiz, y el problema que plantea —aplicar a roles que no se distinguen— es exactamente lo que el quiz filtra. El texto declara explícitamente que el quiz no cubre farmacovigilancia, regulatorio ni market access. Rotación: el blog previo (28 ago) cerró con revisar-cv.

**Pendiente menor para Oscar:** el footer del cover lo hardcodea `scripts/generate-blog-cover.py` como "solcaciencia.com · revisar-cv" (línea 153), sin flag CLI. El cover de este blog dice revisar-cv aunque el CTA del post es quiz-rol. Mismo caso que el blog CRO del 21 ago. Si quieres que coincida, hay que agregar un `--cta` al script.

Agente revisor (regla 15) ejecutado: marcó once bloqueos (práctica de reclutamiento no observable desde postings, "casi nunca" como cuantificador sustituto, comparativa "la mayor parte del desperdicio" sin dataset y contradictoria con el resto del post, muestra sin N, umbral "tres años" inventado, cover inexistente, presente atemporal sobre la página de ICON, "CRO" sin definir inline, párrafo de reserva metodológica que resta autoridad, dos H2 que no entregaban su contrato, tres párrafos de relleno). Los once corregidos antes de entregar. También bajó `readingMinutes` de 7 a 5 para 997 palabras.

Nota (17 ago 2026): fuente usada `_docs/SPRINT_AGO_2026_DRAFTS_v2.md` (versión vigente; v1 descartada). Cinco desviaciones respecto del backlog original, todas deliberadas:

1. **Fecha.** El backlog decía "Vie 29 ago 2026", que es sábado. pubDate ajustado al viernes real 2026-08-28, consistente con las notas del 27 jul y del 10 ago.
2. **Slug y keyword.** El slug propuesto era `asuntos-regulatorios-calidad-practicas-entrada-pharma-latam` con keyword "asuntos regulatorios pharma sin experiencia". Encabezar con "asuntos regulatorios" canibalizaba a `regulatory-affairs-cofepris-perfil-real-declarado` (13 jul, keyword regulatory affairs México) y el "sin experiencia" chocaba con `trabajar-industria-farmaceutica-sin-experiencia-latam` (13 jul). Slug final `calidad-regulatorio-practicas-entry-level-pharma-latam`, keyword reorientada a calidad + entry-level, que es el hueco real del corpus (no hay ningún post de QA/QC). Los dos posts en riesgo quedan linkeados inline, más el de farmacovigilancia trainee.
3. **Frame "puertas" evitado.** El post LinkedIn se titula "Las tres puertas silenciosas", pero "puertas" ya lo ocupan `tres-puertas-academia-pharma-latam` y el post de las cinco puertas. El blog usa "rutas/entradas" en título y cuerpo para no competir en la misma SERP.
4. **Muestra fechada en julio, no en agosto.** La lista curada de 28 vacantes vive en la sección "Vie 24 jul · Solca Insight #12" del sprint, así que el blog fecha la selección el 24 jul 2026 en lugar de "este mes (ago)". El LinkedIn del Mié 20 ago dice "este mes"; el blog es más preciso porque vive años.
5. **Sun Pharma Perú omitido.** El post LinkedIn nombra "Sun Pharma Perú · Asistente Aseguramiento Calidad", pero ese posting no aparece en la lista curada de 28. Se excluyó. Los once postings nombrados en el blog sí están literalmente en la fuente.

Fuentes externas verificadas abriendo la URL: [21 CFR 211.22 en eCFR](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-C/part-211/subpart-B/section-211.22) (unidad de control de calidad, texto literal confirmado) y [Ley General de Salud cap. VII, arts. 257-261](https://mexico.justia.com/federales/leyes/ley-general-de-salud/titulo-decimo-segundo/capitulo-vii) (arts. 258, 259 y 260 literales). El PDF de diputados.gob.mx se intentó primero como fuente primaria pero la extracción se trunca antes del artículo citado, así que no se pudo verificar; pendiente sustituir el link por el oficial cuando se pueda abrir completo.

CTA: `/revisar-cv`. El quiz solo mapea Project Manager, MSL y Clinical Research; calidad, regulatorio y prácticas quedan fuera de sus tres rutas.

Agente revisor (regla 15) ejecutado: marcó seis bloqueos (superlativo de muestra, norma de EE. UU./México sosteniendo postings chilenos, sobrealcance del art. 258, patrón de carrera atribuido a postings de calidad que no la declaran, H2 prometiendo "químico industrial", cover inexistente). Los seis corregidos antes de entregar.

Nota (10 ago 2026): la fecha objetivo del backlog decía "Vie 22 ago 2026", pero el 22 de agosto de 2026 es sábado; pubDate ajustado al viernes real 2026-08-21 (consistente con la nota del 27 jul). Slug del backlog conservado — no colisiona con ningún post existente. La keyword "trabajar cro latam sin experiencia" es CRO-específica y no canibaliza a `trabajar-industria-farmaceutica-sin-experiencia-latam` (intención industria-general, 5 puertas); ese post, la guía CRA México y el blog de farmacovigilancia trainee quedan linkeados inline. Fuentes externas verificadas: ICON Graduate Opportunities, IQVIA CRA careers, curso GCP del NIDA. CTA: /quiz-rol (el tema CRA/clinical research está dentro de las tres rutas del quiz; los dos blogs previos en review usan /revisar-cv).

Nota (3 ago 2026): el slug propuesto en backlog ("farmacovigilancia-mexico-como-entrar-sin-experiencia") colisionaba con el blog ya publicado el 13 jul 2026 (`farmacovigilancia-mexico-empezar-sin-experiencia`, keyword "farmacovigilancia méxico sin experiencia"). Para evitar canibalización SEO, el draft cambió el ángulo al de la fuente LinkedIn (programas trainee/graduate en CROs), keyword primary "farmacovigilancia entry-level / programas trainee de farmacovigilancia", y linkea inline al blog existente como guía México.

Nota (27 jul 2026): la fecha objetivo del backlog decía "Vie 8 ago 2026", pero el 8 de agosto de 2026 es sábado. El viernes real es 7 ago — pubDate ajustado a 2026-08-07. Las fechas objetivo de los items restantes (15, 22, 29 ago) también caen sábado; corresponden a los viernes 14, 21 y 28 ago.

---

## Publicados

_ninguno aún_

---

## Comodines editoriales (fuera de cadencia LinkedIn)

Si el sprint LinkedIn del mes no produce material suficiente, o si aparece una tendencia emergente en el research semanal, hay temas de fondo aprobados que no dependen del sprint:

- **Salarios reales pharma LATAM por rol** — combina datos públicos (Glassdoor, Payscale, LinkedIn Salary Insights) con los pocos postings que sí muestran salario. Alto interés, baja competencia SEO.
- **Diferencias reales entre CRA, MSL y Regulatory Affairs para recién egresados** — long-tail keyword bien buscada según autocomplete.
- **Cómo son las entrevistas técnicas de laboratorio en pharma industrial** — cero contenido en español según research previo.
- **Cursos y certificaciones que sí valida un reclutador pharma en 2026** — reemplaza el ruido de contenido genérico sobre "los mejores cursos".

Estos comodines se activan solo cuando el backlog derivado del sprint LinkedIn se agota o cuando un tema emergente amerita interrupción.
