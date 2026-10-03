# Auditoría editorial · libro CR (Clinical Research) · agosto 2026

**Alcance:** archivos fuente `.md` en `/Users/oscar/proyectos/solca-ciencia/solca/libro3/` (frontmatter, modulo_01–05, backmatter).
**Metodología:** revisión línea por línea de los 7 archivos; extracción de las 84 URLs únicas; verificación con WebFetch de las URLs regulatorias críticas (FDA E6(R3), FDA AI draft, EMA E6(R3), EMA Reflection Paper, Invest in Spain/AEMPS, FDA PCCP, McKinsey-Merck).
**No auditado:** el `.docx` compilado (artefacto derivado), ni los `.md` de trabajo `00_transformation_plan.md`, `01_ai_clinical_research_dossier.md`, `_combined.md`, `README.md`, `STYLE_BRIEF.md`.

Resumen ejecutivo:
- Portada, frontmatter y backmatter usan correctamente "colección en expansión" (no trilogía cerrada).
- Cero emojis. Cero placeholders tipo `TODO`, `TBD`, `Lorem ipsum`, `[cita]`, `[verificar]`. Cero uso de "genuinamente/honestamente/straightforward". Cero "pharmacovigilancia" (siempre "farmacovigilancia").
- El bloque regulatorio (ICH E6(R3), CTIS, AEMPS, 21 CFR, LATAM) está mayormente sólido salvo una **contradicción interna dura** sobre el estado FDA de E6(R3) entre Módulo 2 y Módulo 5 — es el bloqueante principal.
- Marker de imagen 2.8 apunta a un `figure_2_8.png` que **no existe** en `images/` — bloqueante.
- Convención de citas `[REF: …]` inline en Módulos 4-5 es visualmente inconsistente con la de Módulos 1-3 (nota al pie numerada).

---

## 1. BLOQUEANTES

### B1 · Contradicción del estado FDA de ICH E6(R3): Módulo 2 dice "draft" y "adopción pendiente"; Módulo 5 dice "finalizó"

**Archivos / líneas:**
- `modulo_02_draft.md:173` (imagen 2.4): `«SEPT 2025 · FDA DRAFT GUIDANCE»`
- `modulo_02_draft.md:197`: `**Septiembre 2025 · FDA draft guidance**. Publicación del draft de implementación en EE. UU. para consulta pública. La adopción final FDA queda pendiente al cierre de este libro.`
- `modulo_02_draft.md:524` (referencia #4): `FDA — U.S. Food and Drug Administration. (2025, septiembre). *Draft Guidance for Industry — E6(R3) Good Clinical Practice*.`
- vs. `modulo_05_draft.md:279`: `Lo que sí vincula es **ICH E6(R3) Step 4 Final**, adoptado el 6 enero 2025; FDA finalizó la adopción en septiembre 2025; la ventana de transición desde E6(R2) cerró el 11 junio 2025.`

**Diagnóstico:** verifiqué la página oficial FDA (https://www.fda.gov/regulatory-information/search-fda-guidance-documents/e6r3-good-clinical-practice-gcp, cerrado el 08/09/2025). El documento se publicó como **"Final Level 1 Guidance"** en septiembre 2025 (Docket FDA-2023-D-1955). No es draft. El Módulo 5 tiene razón; el Módulo 2 y su timeline están desactualizados.

**Fix:** en `modulo_02_draft.md:173` cambiar `«SEPT 2025 · FDA DRAFT GUIDANCE»` por `«SEPT 2025 · FDA FINAL GUIDANCE E6(R3)»`. En línea 197 reescribir: `**Septiembre 2025 · FDA final guidance E6(R3).** FDA publicó la guía final (Docket FDA-2023-D-1955) el 8 de septiembre de 2025.` En la referencia #4 línea 524 sustituir `Draft Guidance for Industry` por `Final Guidance for Industry`. Añadir URL: `https://www.fda.gov/regulatory-information/search-fda-guidance-documents/e6r3-good-clinical-practice-gcp`.

### B2 · Marker de imagen 2.8 sin archivo correspondiente

**Archivo / línea:** `modulo_02_draft.md:429` — `*[IMAGEN 2.8 — Heatmap 4:3. […] «DEMANDA DE ENSAYOS POR ÁREA TERAPÉUTICA · LATAM 5 + ESPAÑA» […]]*`

**Diagnóstico:** existen `figure_2_1.png` a `figure_2_7.png` en `images/`, pero **no existe `figure_2_8.png`**. La sección 2.8 (Áreas terapéuticas con mayor demanda LATAM y España) queda sin figura.

**Fix:** generar `figure_2_8.png` con `make_images_libro3.py` con la especificación del heatmap 6×6 descrita en el marker, o eliminar el marker si se decide dejar la sección sin figura.

### B3 · Cifras sin fuente en Sección 2.6 sobre España

**Archivo / línea:** `modulo_02_draft.md:313` — `Un tercio son ensayos fase temprana (fase I-II) —donde la actividad de CROs y sitios académicos es más densa— y aproximadamente el 40 % son oncológicos. El ecosistema incluye más de 300 sitios acreditados y presencia consolidada de las principales CROs y multinacionales pharma.`

**Diagnóstico:** la fuente citada (Invest in Spain con datos AEMPS, https://www.investinspain.org/en/noticias-main/2025/aemps) confirma sólo "37.6% oncología" (redondeable a 40 %). **No** dice "un tercio son fase I-II" ni cita "más de 300 sitios acreditados". Ambas cifras son huérfanas.

**Fix:** eliminar la afirmación de "un tercio fase I-II" salvo que se cite una fuente AEMPS o REec verificable. Sustituir "más de 300 sitios acreditados" por dato fuenteable (por ejemplo REec) o eliminar la aproximación. El "40 % oncológicos" puede ajustarse a "aproximadamente 38 % según AEMPS 2024" con el mismo enlace.

### B4 · Fecha "6 de enero de 2025" para E6(R3) atribuida a la guía completa (incluido Annex 2), pero Annex 2 se adoptó en 2026

**Archivos / líneas repetidas:** `frontmatter.md:37`, `modulo_01_draft.md:81`, `modulo_02_draft.md:133,179,193`, `modulo_04_draft.md:23,53,103,187,197`, `modulo_05_draft.md:213,279`, `backmatter.md:105,183`. El texto sostiene sistemáticamente que la R3 finalizada 6-ene-2025 incluye "dos anexos —el primero centrado en ensayos intervencionales tradicionales; el segundo, dedicado a diseños no tradicionales como descentralizados y pragmáticos" (`modulo_02_draft.md:81`).

**Diagnóstico:** verifiqué la página oficial EMA (https://www.ema.europa.eu/en/ich-e6-good-clinical-practice-scientific-guideline). En 6-ene-2025 sólo se adoptó **"Principles + Annex 1"**. **Annex 2 alcanzó Step 4 el 3 de junio de 2026** (adopción ICH) / 25 de junio de 2026 (CHMP), con entrada en vigor 15 de enero de 2027. La atribución uniforme al 6-ene-2025 confunde al lector operativo, especialmente porque ensayos descentralizados (Annex 2) son un tema del que se hace hincapié en el libro.

**Fix:** en Módulo 2, sección 2.4, sustituir la frase "cuerpo principal + dos anexos" por: "cuerpo principal de principios + Annex 1 finalizado el 6 de enero de 2025; **Annex 2 (ensayos descentralizados y pragmáticos) alcanzó Step 4 el 3 de junio de 2026 y entra en vigor el 15 de enero de 2027**." Ajustar en el timeline de imagen 2.4 el hito equivalente. Mantener el resto de referencias a 6-ene-2025 sólo cuando aludan a "principios + Annex 1".

### B5 · Referencia FDA PCCP con año "en 2025" en frontmatter contradice la referencia del Módulo 5 y la realidad (4 dic 2024)

**Archivo / línea:** `frontmatter.md:37` — `en 2025 la FDA finalizó su guía de Predetermined Change Control Plans` vs `modulo_05_draft.md:259` — `del **4 diciembre 2024**`.

**Diagnóstico:** la página FDA (https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence) confirma publicación FINAL en diciembre 2024 (Docket FDA-2022-D-2628). La versión FR Notice reprocessada en agosto 2025 es un artefacto de sistema, no una revisión. El frontmatter erra el año.

**Fix:** en `frontmatter.md:37` cambiar `en 2025 la FDA finalizó su guía de Predetermined Change Control Plans` por `en diciembre de 2024 la FDA finalizó su guía de Predetermined Change Control Plans`.

### B6 · Marker de imagen (portada) declara "Firma del autor en parte inferior" — verificar existencia

**Archivo / línea:** `frontmatter.md:5` marker de portada.

**Diagnóstico:** el marker prescribe "Firma del autor" que debe existir en `portada.png` real. No auditable por texto; añado como bloqueante de verificación visual porque una portada sin la firma prometida rompe la promesa de branding.

**Fix:** abrir `images/portada.png` y confirmar. Si falta la firma o los colores navy `#1B3A6B` / naranja `#E8743A` no se corresponden con la paleta oficial, regenerar con `make_portada.py`.

---

## 2. IMPORTANTES

### I1 · "*budgeting*" y "*contracting*" como espanglish innecesario

**Archivos / líneas:**
- `modulo_04_draft.md:137` — `*budgeting* de estudio`
- `modulo_04_draft.md:235` — `**A desarrollar**: negociación, *contracting*, KPIs comerciales, presupuestos, lectura financiera.`

**Diagnóstico:** existe traducción castellana directa ("presupuesto" / "presupuestación"; "contratación"). Ninguno es término operativo canónico exclusivo del oficio.

**Fix:** `budgeting de estudio` → `gestión de presupuesto de estudio`. `contracting` → `contratación con vendors`.

### I2 · "*framework*" usado como sustantivo suelto varias veces

**Archivos / líneas:**
- `modulo_04_draft.md:7` — `un *framework* formal con respaldo de literatura *peer-reviewed*`
- `modulo_04_draft.md:19` — `no es un *framework* propietario`
- `modulo_05_draft.md:9,205,285,293` — repetición de "framework".

**Diagnóstico:** "marco" es la traducción operativa castellana perfectamente clara y de uso frecuente en regulación LATAM. El uso de "framework" es un tic de espanglish que se puede reducir.

**Fix:** sustituir `framework` por `marco` en al menos 5 de las 6 apariciones (dejar una para intencionalidad estilística si se quiere).

### I3 · "*hype*" como sustantivo repetido (Módulo 5)

**Archivos / líneas:** `modulo_05_draft.md:7,9,65,67,97,107,109`; también en referencia #7 del módulo y en el título de una columna en imagen 5.2.

**Diagnóstico:** "hype" es intuitivo en discusiones tech, pero la voz Solca privilegia castellano operacional. "Sobreestimado", "exagerado", "efecto de moda", "sobre-promesa" son opciones que preservan el sentido.

**Fix:** reducir uso a 1-2 apariciones (marcadas en cursiva) donde sea inevitable; sustituir el resto por "sobreestimado" o "efecto de moda". Renombrar la columna de imagen 5.2: `HYPE · NOT YET ROUTINE` → `EFECTO DE MODA · SIN DESPLIEGUE REAL`.

### I4 · Convención `[REF: …]` inline en Módulos 4-5 rompe consistencia editorial con Módulos 1-3

**Archivos / líneas:** ~40 apariciones en `modulo_04_draft.md` y `modulo_05_draft.md`. Ejemplo: `modulo_04_draft.md:19` `[REF: Joint Task Force for Clinical Trial Competency, *Core Competency Framework*, MRCT Center · Harvard, versión 3.0]`.

**Diagnóstico:** en Módulos 1-3 las citas van en corchetes simples (`[Tufts CSDD, 2020]`, `[Invest in Spain / AEMPS, 2024]`). En Módulos 4-5 aparecen con prefijo `REF:` — visualmente marca borrador editorial, y en el `.docx` compilado quedará como texto literal `REF:`. Es consistencia interna, no falsedad.

**Fix:** eliminar el prefijo `REF:` en todas las citas inline de Módulos 4-5 (buscar-reemplazar `[REF: ` → `[`). Verificar que el build de `.docx` no rompa.

### I5 · Cifras "18 a 55 %" de fairness ML sin URL directa

**Archivo / línea:** `modulo_05_draft.md:231` — `Estudios sobre *fairness* muestran *underperformance* del orden de **18 a 55 %** contra poblaciones no occidentales según la tarea.`

**Diagnóstico:** el REF anterior es al scoping review PMC 2024-2025, pero el rango 18-55 % no aparece explicitado. El lector no puede triangular.

**Fix:** o bien añadir cita específica (paper de fairness con DOI/URL), o suavizar a: `Estudios sobre fairness reportan underperformance sustancial en poblaciones no occidentales; magnitudes varían por tarea y modelo. [Ver el scoping review PMC 2024-2025 para casos concretos]`. Sin la triangulación, mejor eliminar el rango específico.

### I6 · Cifra "83 % de reproducción de errores plantados" con referencia incompleta

**Archivo / línea:** `modulo_05_draft.md:225-226` — `reproducción de errores plantados en hasta el **83 %** de *prompts* adversariales sin mitigación [REF: *Nature Communications Medicine*, 2025].`

**Diagnóstico:** la revista se llama *Communications Medicine* (Nature portfolio), no *Nature Communications Medicine*. Además, ninguna URL o DOI. Verificación imposible para el lector.

**Fix:** corregir nombre de revista y añadir DOI o URL. Si no se localiza la fuente exacta, eliminar la cifra "83 %".

### I7 · Requisitos ACRP CCRA — "3,500 horas" — verificar contra fuente oficial

**Archivo / línea:** `modulo_04_draft.md:271` — `Para CCRA y CCRC, ACRP exige típicamente **3,500 horas de experiencia documentada** en el rol específico durante los dos años previos al examen`.

**Diagnóstico:** el requisito ACRP CCRA vigente combina categorías por título académico (típicamente 3,000 h como base + 1,500 h "essential duties" en 2 años recientes para candidatos con licenciatura). "3,500 horas" no es la formulación oficial. También en `modulo_04_draft.md:283` para SOCRA — "3,500 horas" — necesita revalidación.

**Fix:** cargar las páginas oficiales `https://acrpnet.org/certifications/ccra/` y `https://www.socra.org/certification/` antes de imprimir; sustituir por la formulación textual actual de cada certificadora. Añadir URL directa a las referencias del módulo.

### I8 · Cifra de "$62 mil millones para 2025" del mercado CRO citada dos veces con la misma redacción

**Archivos / líneas:**
- `modulo_01_draft.md:101` — `alrededor de 62 mil millones de dólares hacia 2025 con un crecimiento anual compuesto cercano al 6,6 % [IQVIA Institute / Grand View Research, 2024]`
- `modulo_03_draft.md:29` — `USD 62 mil millones para 2025 con CAGR ~6.6 % [Grand View Research, *CRO Market Report 2024-2030*]`

**Diagnóstico:** el libro cierra en agosto 2026. Una cifra proyectada "para 2025" ya es dato histórico observado, no proyección. Además, la fuente Grand View Research está detrás de paywall/registro; el lector no puede validar. IQVIA Institute no ha publicado un informe primario con ese dato exacto.

**Fix:** revisar si Grand View publicó cifra realizada 2025; sustituir "para 2025" por "estimado en 2025" con el reporte específico y URL. Si el sample sigue siendo estimado, añadir disclaimer `estimación de proveedor comercial detrás de paywall`.

### I9 · Contradicción menor de tono: "sponsor" en cursiva y sin cursiva alternado

**Archivos / líneas:** múltiples. Ejemplo `modulo_04_draft.md:17,44,45` alternan `sponsor` / `*sponsor*`; también CROs a veces en cursiva a veces no.

**Diagnóstico:** el glosario declara "Sponsor" como término mantenido en inglés (jerga industria). Debe usarse **sin cursiva** cuando ya es término operativo canónico y **en cursiva sólo en su primera aparición** por sección. Actualmente hay ~60 apariciones inconsistentes.

**Fix:** una pasada de estilo: quitar cursiva a `sponsor`, `CRO`, `PI`, `CRA`, `CRS`, `EDC`, `eCRF`, `TMF`, `SDV`, `IRB`, `CEIm` — son términos operativos canónicos que aparecen ya en el glosario. Mantener cursiva sólo para expresiones que no son términos de glosario (*primary endpoint*, *risk-based monitoring*, *shortlist*).

### I10 · Conversiones USD "spot 2025" desactualizadas para libro con cierre agosto 2026

**Archivo / línea:** `modulo_03_draft.md:114` — `Conversiones USD spot 2025: USD/MXN ≈ 17, USD/BRL ≈ 5.5, USD/COP ≈ 4 100, USD/CLP ≈ 950 (Argentina caveat aparte).`

**Diagnóstico:** las cifras son coherentes para punto medio 2025 pero, con cierre agosto 2026, el libro debería declarar "spot al cierre editorial ago-2026" con las paridades vigentes. Si se mantiene "spot 2025" el lector pensará que las tablas MXN/BRL/COP/CLP están recalculadas contra 2025, cuando en realidad las bandas salariales son bandas 2025-2026 (línea 108 tabla y línea 187 síntesis).

**Fix:** actualizar la fecha del spot a "spot promedio 12 meses julio 2025 – julio 2026" con las paridades reales que se estén usando para las conversiones USD ≈ paréntesis en cada país. Añadir caveat: "el lector debe recalcular con la paridad vigente al momento de negociar".

### I11 · Data "1,350 dispositivos" con IA autorizados por FDA (Módulo 5.5)

**Archivo / línea:** `modulo_05_draft.md:259` — `Ya respalda más de **mil trescientos cincuenta dispositivos** con IA/ML autorizados acumuladamente [REF: FDA, *PCCP for AI-Enabled Device Software Functions*, FINAL, 4 diciembre 2024].`

**Diagnóstico:** la cifra proviene del listado FDA "AI/ML-Enabled Medical Devices" (actualizado periódicamente), no del documento PCCP. La cita cruzada es incorrecta.

**Fix:** añadir cita a `https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-and-machine-learning-aiml-enabled-medical-devices` con la cifra vigente al cierre editorial. Actualizar la referencia (número podría haber crecido en 2025-2026).

### I12 · Certificación SOCRA — glosario afirma cambio de examen "desde 1 enero 2026" sin fuente

**Archivo / línea:** `backmatter.md:163` — `**SOCRA.** *Society of Clinical Research Associates*. […] El contenido del examen refleja ICH E6(R3) desde el 1 enero 2026.`

**Diagnóstico:** afirmación específica de fecha, sin cita. No verificable por el lector.

**Fix:** añadir URL de comunicado SOCRA que confirme la fecha, o suavizar a "SOCRA ha anunciado incorporación del contenido E6(R3) tras su adopción por FDA (verificar fecha vigente en socra.org)".

### I13 · Módulo 2 sección 2.4 declara "23 julio 2025 · Implementación EU" en el timeline pero el texto (línea 195) también dice "julio 2025"; verificar formato

**Archivo / línea:** `modulo_02_draft.md:195` — `**23 julio 2025 · Implementación EU**. Empieza a aplicarse en la Unión Europea tras adopción del CHMP/EMA.`

**Diagnóstico:** verificado contra EMA (correcta la fecha 23 julio 2025 para Principios + Annex 1). Debería añadirse que Annex 2 tiene fecha efectiva **15 enero 2027** — hoy ausente del timeline (imagen 2.4) y del texto de la sección. Es información operativa importante para CRA/CRS que trabaja en ensayos descentralizados.

**Fix:** agregar en el timeline "15 ENERO 2027 · IMPLEMENTACIÓN EU ANNEX 2 (DCT + pragmáticos)"; añadir párrafo corto en la sección 2.4 mencionando la fecha Annex 2.

### I14 · Módulo 2 sección 2.7 lista de reguladores omite Puerto Rico / USVI y otros

**Archivo / línea:** `modulo_02_draft.md:107` — sección 1.4 (equivalente) y 2.5 listan reguladores LATAM sin caveats sobre países que no tienen framework CTIS-like (Perú DIGEMID, Costa Rica CCSS, Uruguay MSP, Panamá MINSA).

**Diagnóstico:** el libro asume "LATAM 5" (México, Argentina, Colombia, Chile, Brasil) sin decir explícitamente que Perú, Uruguay, Costa Rica, Panamá y Ecuador quedan fuera de scope. Un lector peruano o costarricense se siente ignorado.

**Fix:** añadir párrafo introductorio en 2.5 explicando por qué "LATAM 5" y qué reguladores quedan fuera (DIGEMID en Perú, ARCSA en Ecuador, MSP en Uruguay, etc.) con referencia genérica a sus autoridades sanitarias para lectores fuera del top 5.

### I15 · Módulo 3.4 tabla de comparación España vs LATAM: fila "Idioma expediente" dice "Inglés + español (Parte II)"

**Archivo / línea:** `modulo_03_draft.md:301` en tabla comparativa (`modulo_02_draft.md:349`).

**Diagnóstico:** correcto operativamente pero elidido: CTIS acepta el expediente Parte I en inglés y los CEIm españoles pueden aceptar en inglés + resumen ejecutivo español. El texto simplificado puede llevar a un CRA/CRS junior a pensar que TODA la Parte I es en español.

**Fix:** matizar a "Inglés (Parte I y protocolo); español (Parte II y documentos con paciente: ICF, cartas al participante)".

### I16 · Módulo 4.6 tabla ACRP CCRP vs CCRA menciona "CCRP en algunos contextos para profesionales de proyecto"

**Archivo / línea:** `modulo_04_draft.md:269` — `**CCRP** —no confundir con la de SOCRA— en algunos contextos para profesionales de proyecto.`

**Diagnóstico:** ACRP **no emite** una certificación llamada CCRP. Emite CCRA, CCRC y CPI. La afirmación introduce confusión y contradice el propio glosario del libro (`backmatter.md:53`).

**Fix:** eliminar la frase "CCRP —no confundir con la de SOCRA—". Dejar sólo CCRA, CCRC y CPI para ACRP; CCRP para SOCRA. En glosario `backmatter.md:47`, corregir `Emite las certificaciones CCRA, CCRC y CCRP.` → `Emite las certificaciones CCRA, CCRC y CPI (Certified Principal Investigator).`

### I17 · "*Real deployed*" vs "*real deployed*" — inconsistencia de mayúsculas en Módulo 5

**Archivos / líneas:** imagen 5.2 usa mayúsculas (`REAL · DEPLOYED`), texto de sección 5.2 alterna (`### *Real deployed*` vs `Hablar como si todo fuera *hype*`), la máxima de línea 109 usa minúsculas.

**Fix:** unificar. Recomendación: subtítulos capitalizados (`Real deployed`), texto cuerpo en minúsculas cursiva (`real deployed`).

### I18 · "13,000 miembros" con coma anglosajona como separador de miles

**Archivos / líneas:** `modulo_04_draft.md:267` (`13,000 miembros en 70 países`), `modulo_04_draft.md:271` (`3,500 horas`), etc. En contraste `modulo_03_draft.md:438` usa `13 000 miembros` (formato español correcto con espacio fino).

**Diagnóstico:** el estándar en español (RAE, tipografía LATAM/España) es espacio fino o punto (13.000 / 13 000). El libro es inconsistente. Módulo 3 lo hace bien, Módulo 4 usa coma inglesa.

**Fix:** unificar a `13 000`, `3 500` (con espacio). Revisar todo el Módulo 4 y Módulo 5.

### I19 · Cifras Tufts CSDD "22 % implementación parcial, 11 % implementación plena" (Módulo 5.4)

**Archivo / línea:** `modulo_05_draft.md:41` — `Tufts CSDD reporta una reducción media de tiempos de ciclo del **18 %** en los treinta y seis casos del estudio 2024, con solo el **11 %** de las compañías en implementación plena y **22 %** en parcial.`

**Diagnóstico:** las cifras están citadas con `[REF: Tufts CSDD / TransCelerate, *AI/ML adoption survey*, 2024, n = 302, 79 sponsor / CRO companies]` en línea 23 pero la fuente primaria Tufts CSDD suele ser un informe de suscripción. El resumen público en Applied Clinical Trials (`https://www.appliedclinicaltrialsonline.com/view/new-insights-on-the-impact-of-ai-enabled-solutions`) confirma la existencia del survey pero no siempre incluye estos porcentajes específicos.

**Fix:** verificar que las cifras 18 %, 11 %, 22 % están efectivamente en el resumen público de Applied Clinical Trials. Si no, añadir "resumen público disponible; cifras específicas requieren acceso al reporte Tufts CSDD/TransCelerate".

### I20 · Módulo 3.2 lista "14 multinacionales" con nombres sin URL individual

**Archivo / línea:** `modulo_03_draft.md:65` — `Las **14 multinacionales** […] Roche, Novartis, Pfizer, MSD, AstraZeneca, BMS, Eli Lilly, Bayer, GSK, Sanofi, Boehringer Ingelheim, AbbVie, Janssen/J&J, Takeda […] más Amgen y Merck KGaA/EMD Serono operan equipos clínicos locales [Access to Medicine Foundation, *2024 Index Ranking*].`

**Diagnóstico:** cita AtMF pero AtMF Index no cataloga presencia LATAM por país. El texto atribuye a AtMF una afirmación que la fuente no sostiene. Además, el mismo párrafo confunde ("las 14 multinacionales", pero luego enumera 14 + 2 = 16).

**Fix:** cambiar cifra a "Las principales multinacionales" (o clarificar "13 empresas del ranking AtMF + 2 no rankeadas"). Añadir caveat: "Presencia LATAM y España verificada vía páginas corporativas oficiales en 2026; AtMF Index se usa como referencia de las mayores 20 empresas farmacéuticas por acceso a medicamentos".

### I21 · Módulo 2 sección 2.5.4 sobre Chile — "DS N°114 de 2011" con leyes específicas

**Archivo / línea:** `modulo_02_draft.md:267` — `**Regulación principal.** **DS N°3 de 2010** sobre control de productos farmacéuticos, **Ley N°20.120 de 2006** sobre investigación en el ser humano y su genoma, y **DS N°114 de 2011** que reglamenta ensayos clínicos farmacéuticos.`

**Diagnóstico:** el DS N°114/2011 fue derogado/actualizado por el DS 3/2010 y por la Norma Técnica N°57 del ISP posteriores. El libro debería declarar caveat "verificar vigencia" (ya declarado genéricamente en línea 291, pero no específicamente para Chile).

**Fix:** actualizar a "DS N°3/2010, Ley N°20.120/2006 y normas técnicas ISP posteriores (verificar vigencia en www.ispch.cl/anamed antes de operar)".

---

## 3. MENORES

### M1 · Frontmatter — "el compromiso de la serie" apunta a "serie" cuando se declara "colección en expansión"

`frontmatter.md:37` — "El compromiso de la serie es la verificabilidad". Mezcla "serie" y "colección". Homogeneizar a "colección" para reforzar apertura.

### M2 · Módulo 1 sección 1.7 — habilidades transferibles en escala 0-5 con "0" implica ausencia total

`modulo_01_draft.md:218` — cambiar escala a 1-5 (5 puntos, no 6) para evitar auto-flagelación innecesaria del lector con nota 0.

### M3 · Módulo 2 — repetición "el más denso del libro" / "el más operativo"

`modulo_02_draft.md:7` afirma "Es el módulo más denso del libro"; `backmatter.md` y otros lugares afirman variantes. Alinear.

### M4 · Módulo 2 sección 2.2 — "ratio CRA / sitios" en preguntas al entrevistador es genial pero se repite en 3.8 preg #587

`modulo_03_draft.md:587` — considerar diferenciar la formulación.

### M5 · Módulo 3 sección 3.3 — Argentina "Estatus: GAP"

`modulo_03_draft.md:155` — bien declarada la falta de datos. Añadir sugerencia concreta: "Fuente informal alternativa: encuesta anual de Cámara de Especialidades Medicinales (CAEME) — no publicada, requiere contacto interno".

### M6 · Módulo 3.4 — "Kern Pharma y otros genéricos con incursiones en desarrollo biosimilar"

`modulo_03_draft.md:255` — dejar a Kern Pharma o quitar y consolidar. Actualmente el listado local termina con genérico.

### M7 · Módulo 4.2 patrón 3 — "distancia excesiva" vs "excesiva familiaridad"

`modulo_04_draft.md:85` — párrafo bien construido pero muy largo. Considerar sub-bulletar para escaneabilidad.

### M8 · Módulo 5 sección 5.3 prompt 9 — mezcla "IRB/EC" con "EC local" sin definir

`modulo_05_draft.md:183` — usar `IRB / CEIm / CEP` consistente con el resto del libro.

### M9 · Módulo 5.4 — referencia a "*npj Digital Medicine*" cifras específicas (1,47 % alucinación)

`modulo_05_draft.md:225` — verificar el DOI y añadir URL directa al artículo (no solo el número de artículo).

### M10 · Backmatter — Glosario define "CCRP" tanto para ACRP como SOCRA en la misma entrada `CCRA / CCRC / CCRP`

`backmatter.md:53` — separar. Ver bloqueo I16.

### M11 · Backmatter referencias — orden mezclado (ICH, WMA, HHS, CIOMS, FDA, EMA, IQVIA, Tufts, McKinsey, ANVISA, COFEPRIS, ANMAT, INVIMA, ISP, npj, JMIR, PMC, PM, MSL, "Todo lo que tienes que saber…", AEMPS, Reglamento, RD, CTIS, Invest in Spain, EPM, 21 CFR, Form FDA 1572, Diversity Action Plans)

Considerar reorganizar por bloques (Regulatorios internacionales — Regulatorios LATAM/España — Industria/Consultoras — Papers académicos — Libros propios).

### M12 · Frontmatter índice de contenido enumera "Módulo 4.6 Certificaciones · ACRP, SOCRA, SCT"

`frontmatter.md:95` — el título real del Módulo es "ACRP, SOCRA, DIA, SCT" (línea 255 modulo_04). Alinear el índice.

### M13 · Backmatter referencia #27 — "Todo lo que tienes que saber para iniciar en investigación clínica · Enfoque Latinoamérica" (2022)

`backmatter.md:235` — reconocer explícitamente como versión previa/base. Bien hecho. Considerar añadir "descontinuada; este libro la reemplaza" para evitar confusión sobre stock viejo circulando.

### M14 · Módulo 3.5 uso de "elevator pitch" — mantener

Está bien como jerga aceptada en industria. Ok.

### M15 · Módulo 4.3 — el título de la sección dice "CRA → Director Operations" (línea 107) pero el texto y el escalón 6 dicen "Director Clinical Operations" (línea 145)

Alinear título con contenido.

### M16 · Módulo 4.5 mención al Libro 2 MSL

`modulo_04_draft.md:227` — buena referencia cruzada, mantener.

### M17 · Módulo 5.5 timeline "Hito 5: MID-2026 (esperado) · EU GMP Annex 22"

`modulo_05_draft.md:251,273` — con cutoff ago-2026, "mediados de 2026 esperado" ya es vencido. Actualizar a "sin fecha primaria publicada al cierre editorial ago-2026; verificar en la sección de consulta pública de la Comisión Europea".

### M18 · Módulo 2 sección 2.4 imagen 2.4 timeline "1964 · DECLARACIÓN DE HELSINKI"

`modulo_02_draft.md:173` — perfecto en cronología, pero considerar añadir hito "2013 · Fortaleza · última gran revisión Helsinki" para reforzar que Helsinki es documento vivo.

### M19 · Módulo 5 prompt 9 — "back-translation según SOP del sponsor"

`modulo_05_draft.md:185` — mantener; correcto operativamente.

### M20 · Módulo 3.4 — Bandas salariales España EUR "€28 000 – €38 000/año"

`modulo_03_draft.md:263` — verificar consistencia de espacios finos vs comas. Todo el libro debería alinear.

### M21 · Backmatter conclusión — "Las puertas de Solca están abiertas"

`backmatter.md:29` — buena línea de cierre. Preservar.

### M22 · Módulo 3.7 recruiter list — "QDQ Selección Farmacéutica"

`modulo_03_draft.md:468` — verificar existencia real de "QDQ Selección Farmacéutica" como boutique de recruiting. Puede ser confusión con QDQ Media (directorios).

### M23 · Módulo 5 referencia #6 URL de Applied Clinical Trials

`modulo_05_draft.md:354` — buena. Mantener.

### M24 · Cifra "cinco a diez CRAs" (`modulo_04_draft.md:137`) vs "diez y quince sitios" (`modulo_04_draft.md:129`)

Alinear numerales cardinales vs cifras (recomendación de estilo: cardinales para 0-9, cifras para ≥10 y siempre para rangos con dos números; unificar).

### M25 · Módulo 3.8 preguntas #7 y #8 (líneas 560-561) — "Cita el 6 de enero de 2025"

Ya cubierto. Recordar que el libro debe reflejar que la R3 comprende Principios+Annex 1 finalizados 6-ene-2025 (ver B4).

---

## Notas de verificación (URLs críticas revisadas)

| URL | Estado | Sostiene lo declarado |
|---|---|---|
| investinspain.org/…/aemps.html | 200 OK | ✓ 930 ensayos, #1 Europa; ✗ no dice "un tercio fase I-II" ni "300 sitios" |
| database.ich.org/…/E6(R3)_Step4_FinalGuideline_2025_0106.pdf | 200 OK (PDF grande) | ✓ ICH E6(R3) Step 4 Final, 6 enero 2025 (Principles + Annex 1) |
| fda.gov/…/e6r3-good-clinical-practice-gcp | 200 OK | ✓ FDA E6(R3) **FINAL** en sept 2025 → contradice Módulo 2 |
| fda.gov/…/considerations-use-artificial-intelligence-support-regulatory-decision-making | 200 OK | ✓ DRAFT en enero 2025 |
| fda.gov/…/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence | 200 OK | ✓ FINAL, docket original diciembre 2024 |
| ema.europa.eu/en/ich-e6-good-clinical-practice-scientific-guideline | 200 OK | ✓ EU: Principles+Annex 1 efectivo 23-jul-2025; Annex 2 efectivo 15-ene-2027 |
| ema.europa.eu/…/reflection-paper-use-artificial-intelligence-ai-medicinal-product-lifecycle_en.pdf | 200 OK (PDF) | ✓ Final adoptado 9-sep-2024 |
| mckinsey.com/…/with-gen-ai-merck-and-mckinsey-transform-clinical-authoring | 200 OK | ✓ 180h → 80h para CSR; consistente con "dos-tres semanas → tres-cuatro días" |

URLs no verificadas individualmente en esta pasada (asumen 200 OK y contenido consistente): backmatter references de sitios de gobierno LATAM (gob.mx/cofepris, gov.br/anvisa, argentina.gob.ar/anmat, invima.gov.co, ispch.cl/anamed, boe.es, eur-lex.europa.eu, aemps.gob.es). Recomendable pasada rápida antes de imprimir para confirmar redirecciones o cambios estructurales.

---

**Cierre.** El libro está mayoritariamente sólido, con narrativa consistente en la voz Solca, un aparato de referencias explícito y un compromiso editorial claro con "cita fecha y estado, no titulares". Los bloqueantes están concentrados en cuatro frentes: la contradicción FDA E6(R3) entre módulos, la figura 2.8 ausente, las cifras huérfanas de España en 2.6, y la atribución uniforme al 6-ene-2025 que oscurece la fecha real de Annex 2. Los importantes son mayoritariamente estilo (espanglish reducible, `[REF:]` inconsistente, tipografía numérica). El grueso de menores son detalles de pulido pre-imprenta.

Recomendación operativa: resolver los 6 bloqueantes + I1–I5 antes de subir versión a Hotmart; los restantes importantes y menores pueden ir al backlog editorial de segunda revisión.
