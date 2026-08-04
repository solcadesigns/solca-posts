# Auditoría de cifras sin fuente · blog solcaciencia.com

> **Fecha:** 3 ago 2026
> **Alcance:** 44 posts en `src/content/blog/`
> **Criterio:** párrafo que contiene cifra, porcentaje o tasa **sin URL de fuente en el mismo párrafo**
> **Resultado del barrido:** 87 párrafos en 34 posts
> **Estado:** reporte. No se modificó ningún archivo a partir de esta auditoría.

Clasificación en cuatro veredictos, aplicando el checklist pre-publicación (regla 6b de OSCAR_PROFILE.md):

| Veredicto | Qué significa | Acción | Casos |
|---|---|---|---|
| **OK** | Conteo auditable de dataset propio, ya acotado, o ejemplo ilustrativo | Ninguna | 24 |
| **FUENTE** | Cifra real de fuente nombrada pero sin URL inline | Agregar URL | 26 |
| **ACOTAR** | Afirmación defendible desde autoridad profesional pero redactada como dato de mercado | Reformular | 15 |
| **ELIMINAR** | Cifra que nadie mide y que no tiene fuente posible | Borrar la frase | 22 |

---

## ELIMINAR · 22 casos

Cifras que Solca no mide, que ninguna fuente publica, y que no se sostienen desde autoridad profesional porque son afirmaciones estadísticas, no juicios. Esta es la categoría que detonó la regla 6b.

### Tasas de respuesta a aplicaciones

Solca no da seguimiento a si un lector recibió respuesta. No hay fuente posible.

1. `academia-industria-farmaceutica-que-revisar.md` — "Una aplicación cuidada tiene 30-40% de posibilidad de respuesta. Una aplicación en masa tiene menos del 5%."
2. `posdoc-industria-farmaceutica-latam-que-revisar.md` — "La tasa de respuesta real en industria pharma para candidatos con perfil cuidado ronda 30-40%; para aplicaciones en masa cae bajo 5%."
3. `posdoc-industria-farmaceutica-latam-que-revisar.md` — resumen operativo que repite la cifra.
4. `de-investigacion-cientifica-a-msl-transicion-pharma.md` — "La tasa de respuesta para candidatos con perfil bien preparado ronda 30-40%; sin preparación cae bajo 10%."
5. `de-investigacion-cientifica-a-msl-transicion-pharma.md` — resumen operativo que repite la cifra.

**Sustitución posible:** la afirmación cualitativa sí se sostiene — una aplicación adaptada rinde más que una masiva. Se puede decir sin número.

### Tasa de conversión de networking en LinkedIn

Nadie mide cuántos MSL aceptan un mensaje frío. Aparece dos veces con el mismo número, lo que sugiere copy-paste, no medición.

6. `de-investigacion-cientifica-a-msl-transicion-pharma.md` — "La conversión suele ser 30-40%."
7. `preparar-entrevista-pharma-30-dias-checklist.md` — "La conversión suele ser 30-40%."

### Cobertura de preguntas de entrevista

No existe estudio de qué proporción de entrevistas pharma LATAM cubren seis preguntas dadas.

8. `entrevista-pharma-industrial-6-preguntas-prototipicas.md` — meta description: "Las 6 preguntas que aparecen en 80% de las entrevistas."
9. `entrevista-pharma-industrial-6-preguntas-prototipicas.md` — "Seis de esas preguntas cubren aproximadamente el 80% de las entrevistas conductuales."
10. `entrevista-pharma-industrial-6-preguntas-prototipicas.md` — resumen que repite el 80%.
11. `metodo-star-entrevistas-industria-farmaceutica.md` — "Con cinco historias interiorizadas cubres el 80-90% de preguntas de comportamiento."
12. `metodo-star-entrevistas-pharma.md` — "las preguntas behavioral copan el 60-70% del tiempo de entrevista."

**Sustitución posible:** "estas seis preguntas se repiten en los procesos de multinacional top y CRO" — afirmación de autoridad profesional, sin porcentaje.

### Porcentajes retóricos usados como dato

Números que suenan a medición pero solo dan énfasis. Son los más fáciles de borrar y los que más credibilidad cuestan si alguien pregunta la fuente.

13. `el-error-mas-comun-cv-phd-pharma.md` — meta description: "descalifica el 90% de los CVs PhD que aplican a pharma."
14. `entrevista-pharma-industrial-6-preguntas-prototipicas.md` — "industria pharma donde el 90% de decisiones se toman así."
15. `de-investigacion-cientifica-a-msl-transicion-pharma.md` — "Esa capacidad es el 40-50% del valor de un MSL."
16. `preparar-entrevista-pharma-30-dias-checklist.md` — "puedes cerrar el 80% del gap de preparación."
17. `preparar-entrevista-pharma-30-dias-checklist.md` — "40% del éxito es responder a lo que realmente están preguntando."
18. `preparar-entrevista-pharma-30-dias-checklist.md` — "cerebro descansado con 90% de preparación."
19. `academia-industria-farmaceutica-que-revisar.md` — "Cuando el CV llega con vocabulario 100% académico."
20. `vacante-en-ingles-no-significa-requisito-ingles.md` — "vacantes publicadas en inglés cuyo día a día es 80% español."

### Muestras internas inexistentes

21. `academia-industria-farmaceutica-que-revisar.md` — "En la muestra de submissions al survey de nuestra herramienta de revisión de CV, uno de cada cinco candidatos declaró expresamente 'no tengo claridad de qué rol atacar'."

**Nota metodológica importante:** el survey de `/revisar-cv` **sí** tiene esa pregunta (`obstacle` → `no_role_clarity`, "No sé qué rol específico me queda"). Pero el formulario muestra la pregunta central más **dos preguntas tomadas al azar de un pool**. Eso significa que solo una fracción de los respondentes ve la pregunta de obstáculo, y calcular "uno de cada cinco" sobre el total de submissions da un número incorrecto por diseño. Si quieres conservar el dato, hay que calcularlo sobre quienes efectivamente vieron la pregunta, y decirlo así.

**Cierre 4 ago 2026.** Cálculo corrido con `wrangler kv key list --binding=CV_METRICS --remote --prefix="s:"`. Total submissions: 13. Expuestos a `obstacle` (probabilidad 2/9 = 22%): 2. Eligieron `no_role_clarity`: 1. n=2 exposiciones es ruido puro; cualquier proporción sobre esa base no es defendible. La frase permanece eliminada del post. Reabrir cuando `EXPOSED ≥ 20`, lo que requiere ~90 submissions al survey. Sugerencia operativa: sumar al `/api/weekly-report` un desglose del survey por pregunta (exposición y respuestas) para detectar cuándo la muestra madura.

22. `de-investigacion-cientifica-a-msl-transicion-pharma.md` — **ya eliminado el 3 ago 2026.** Sección "Un dato de contexto" que atribuía al Quiz Match y al simulador una comparación de tasas de conversión a proceso avanzado por área terapéutica, publicaciones y meses de preparación. El quiz guarda nombre, email, país, consentimiento y respuestas; no hay seguimiento del candidato. El dato no podía existir. Texto original recuperable en el historial de git.

---

## ACOTAR · 15 casos

Afirmaciones defendibles desde tu autoridad profesional, pero escritas como si fueran estadística de mercado. La regla del estándar de evidencia permite sentenciar desde autoridad; lo que no permite es disfrazar juicio de medición. La corrección es de redacción, no de contenido.

### Porcentajes de viaje por rol

Aparecen como dato duro repetido en seis posts. Vienen de lo que declaran los postings y de tu lectura del rol, no de una encuesta.

1. `como-ser-cra-en-mexico-perfil-formacion-ruta.md` — "30-50% del tiempo en viaje" (4 apariciones en el mismo post).
2. `como-ser-msl-en-mexico-perfil-formacion-ruta.md` — "viajar 40-60% del tiempo" (2 apariciones).
3. `de-investigacion-cientifica-a-msl-transicion-pharma.md` — "MSL de campo viaja 40-60% del tiempo."
4. `msl-cra-pm-heor-diferencia-rol-pharma.md` — tabla comparativa con "40-60% / 30-50% / 20-30% / 10-20%".
5. `msl-cra-pm-heor-diferencia-rol-pharma.md` — "viajes de 30-50% del tiempo según la CRO y el estudio."
6. `msl-cra-pm-heor-diferencia-rol-pharma.md` — "Si viajar 40-60% del tiempo te desgasta, descarta MSL."
7. `qfb-recien-egresado-caminos-industria-farmaceutica.md` — "Disposición a viajar 30-50% del tiempo."
8. `trabajar-industria-farmaceutica-sin-experiencia-latam.md` — "Disposición a viajar 30-50% del tiempo."

**Sustitución posible:** "los postings de CRA declaran viaje frecuente, típicamente en el orden de la mitad del tiempo" o directamente citar una vacante que lo declare. Alternativa más limpia: dejar el rango pero atribuirlo — "según declaran las vacantes de CRO que reviso".

**Cierre 4 ago 2026.** Aplicada la sustitución con citas verificables de postings ICON en cuatro posts (los que tocan CRA y PM directamente): `como-ser-cra-en-mexico`, `qfb-recien-egresado`, `trabajar-industria-farmaceutica-sin-experiencia-latam` y `msl-cra-pm-heor-diferencia-rol` reciben inserción con referencia a ICON Senior CRA México City JR150438 (60% viaje, [careers.iconplc.com](https://careers.iconplc.com/job/senior-clinical-research-associate-in-mexico-mexico-city-jid-50315), vacante expirada, descripción publicada) y ICON CPM México City JR148851 (híbrido con presencia semanal, [careers.iconplc.com](https://careers.iconplc.com/job/clinical-project-manager-in-mexico-mexico-city-jid-50056), también expirada). Para MSL (`como-ser-msl-en-mexico`, `de-investigacion-cientifica-a-msl`) se mantiene el texto cualitativo actual: en la validación con Chrome MCP no se encontraron postings MSL México con porcentaje de viaje declarado en portal oficial vigente (Lilly no tenía MSL México activo, Workday de Biogen en mantenimiento, Indeed MX bloqueado por Cloudflare); los snippets de búsqueda inicial no eran reproducibles y por eso quedan fuera. Cuando aparezca un posting MSL México con % explícito, insertar cita análoga.

### Incrementos salariales por seniority

`salario-msl-mexico-area-terapeutica-seniority.md` construye una escalera completa de porcentajes sin fuente. Es el post de mayor riesgo del set: el lector lo va a usar para negociar.

9. "MSL Senior: incremento típicamente 30-45% sobre Junior."
10. "MSL Manager: incremento del 30-50% sobre Senior."
11. "Medical Advisor: típicamente 30-50% arriba de MSL Manager."
12. "Un MSL Senior en oncología puede ganar 20-30% arriba de un MSL Senior en área terapéutica madura."
13. "Bono variable: Junior 8-12%, Senior 12-18%, Manager 15-25%."
14. "Beneficios en especie pueden añadir 25-40% al valor total del paquete."
15. "MSL con data science declarado ganan primas de 10-15% sobre el promedio del mismo seniority."

**Nota:** el caso 15 además viola la sub-regla de fabricación comparativa — "sobre el promedio" requiere conocer el promedio.

**Sustitución posible:** este post necesita o fuentes tipo Glassdoor/SalaryExpert con URL (como sí hace `salario-msl-latam-por-pais-nivel.md`), o reescribirse en términos de dirección y no de magnitud: "el salto a Manager es el mayor de la escalera; el bono crece con el nivel".

---

## FUENTE · 26 casos

Cifras que vienen de fuente real y nombrada, pero sin URL en el párrafo. No son inventos: son citas incompletas. La corrección es agregar el enlace.

### Fuentes nombradas sin enlace

1. `despues-del-cv.md` — "LinkedIn (Talent Trends Report) reporta cerca del 70% de profesionales globales son passive candidates."
2. `onboarding-30-60-90-primer-rol-pharma.md` — "SHRM reporta que un onboarding estructurado mejora retención 82%" y "el rol con menor tenure en CROs es el CRA (BDO 2024)".
3. `argentina-usd-8b-investigacion-clinica-oportunidad-cra.md` — "en 2025 Argentina aprobó 290 nuevos estudios clínicos (+8% interanual), ~50.000 pacientes en ~1.000 estudios activos."
4. `ich-e6-r3-que-cambio-cra.md` — afirmaciones sobre R3 sin enlace al documento ICH en ese párrafo.

### Post de referidos · 6 párrafos

`referidos-mito-80-oculto-pharma-latam.md` cita Granovetter 1974, NYT 1980, SHRM, Jobvite y Ashby. Las fuentes están nombradas y el post entero existe para desmontar un mito, que es buen trabajo. Falta el enlace inline en los párrafos 55, 57, 58 y 59, incluido el "multiplicar por aproximadamente 4 la probabilidad de hire" y el "30-45% de contrataciones".

### Posts de salario · 12 párrafos

`salario-msl-latam-por-pais-nivel.md` y `salario-cra-junior-latam-2026.md` citan Glassdoor MX, SalaryExpert, WorldSalaries, y datos de turnover CRA 2022-2024. Están nombradas, varias con cifra exacta y hasta con n declarado ("con n=4 no defendible", que es honestidad correcta). Falta URL inline en los párrafos 60-71 del barrido.

**Observación:** estos dos posts son el mejor ejemplo del estándar que quieres. Declaran fuente, declaran n, distinguen mediana de promedio y advierten cuándo la muestra no aguanta. Sirven de plantilla para reescribir el post de seniority.

### Otros 4

Enlaces internos a `/blog/clinical-ops-40-pharma-latam` que citan "33% son Clinical Operations" en el texto del enlace, en `13-acronimos-pharma-cv-phd.md`, `cros-no-piden-phd-pero-hacen-trabajo-phd.md`, `despues-del-cv.md`, `ingles-fluent-filtro-silencioso-pharma.md`. La cifra es auditable contra el dataset; el enlace ya apunta al post que la sustenta. Riesgo bajo.

---

## OK · 24 casos

No requieren acción.

### Conteos de dataset propio, ya acotados

Cumplen la sub-regla de sesgo de muestra: la cifra aparece atada a la selección, no extrapolada al mercado.

- `entry-level-pharma-realidad-vacantes-latam.md` — "En la muestra revisada de 59 vacantes pharma LATAM, 3.4% son entry-level real."
- `vacante-en-ingles-no-significa-requisito-ingles.md` — "En la muestra revisada de 59 vacantes, dos de cada tres se publican en inglés." Además explica que la proporción refleja el flujo, no el requisito. Ejemplo modelo.
- `siete-empresas-pharma-latam-vacantes.md` — "En la muestra revisada de 59 vacantes de la última semana, siete empresas concentraron 38 vacantes."
- `tres-puertas-academia-pharma-latam.md` — "En la muestra revisada del último ciclo, 47% CRO, 25% big pharma, 27% farma local."
- `cro-vs-big-pharma-vs-farma-local-primer-rol.md` — desglose 28/15/16 vacantes con "en la muestra".
- `clinical-ops-40-pharma-latam.md` — título y H2 con 33% sobre 30 vacantes declaradas en la descripción.

**Una excepción dentro de este grupo:** `tres-puertas-academia-pharma-latam.md` dice después "Es el 47% del flujo de vacantes pharma LATAM", soltando la acotación. Ahí sí se extrapola al mercado. Corrección de una línea.

### Ejemplos ilustrativos y marcos didácticos

- `cv-pharma-cinco-ajustes-desde-phd.md` — el "30%" del bullet de PCR es un ejemplo de CV inventado a propósito para mostrar formato. No es dato de mercado.
- `metodo-star-entrevistas-pharma.md` — la proporción "Situación 10% / Tarea 10% / Acción 60% / Resultado 20%" es una recomendación de estructura, no una medición.
- `cra-i-a-director-trayectoria-cinco-saltos.md` — "+10% de salario" como ejemplo de un patrón de cambio de empresa.
- Resúmenes operativos que solo repiten cifras ya tratadas en su propio post.

---

## Prioridad sugerida

1. **Los 5 de tasa de respuesta y los 2 de conversión de networking.** Son los que un lector podría usar para calibrar expectativas y sentirse engañado. Borrado directo, la frase sobrevive sin el número.
2. **`salario-msl-mexico-area-terapeutica-seniority.md` completo.** Siete porcentajes sin fuente en un post que la gente usa para negociar sueldo.
3. **El "80% de las entrevistas" en meta descriptions.** Está en el snippet de Google, es lo primero que se ve.
4. **Los porcentajes retóricos.** Rápidos de borrar, cero pérdida de contenido.
5. **Agregar URLs a los 26 de categoría FUENTE.** Trabajo mecánico, sin decisiones editoriales.
6. **Los rangos de viaje.** Decisión tuya: atribuirlos a los postings o dejarlos como juicio profesional explícito.
