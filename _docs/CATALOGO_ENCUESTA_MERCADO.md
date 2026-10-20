# Catálogo de la encuesta de mercado · v1 (borrador, 20 oct 2026)

Estado: **aprobado e implementado el 20 oct 2026.** Código: `src/lib/market-catalog.ts`, `src/pages/api/market-survey.ts`, `src/components/MarketSurvey.astro`, `migrations/0003_mercado_respuestas.sql` y `scripts/backfill-mercado.mjs`.

## 1. Principios

1. **Dos capas.**
   - *Datos operativos*: lo que cada herramienta necesita para funcionar. No se tocan.
   - *Encuesta de mercado*: lo que queremos saber de la audiencia.
2. **Copia anonimizada de los datos operativos.** Cuando un dato operativo describe al mercado (país, formación, rol, grado), se copia anonimizado a la base de mercado. Nunca se copian correo, nombre, IP, texto del CV, empresa, texto de vacante ni campos de texto libre.
3. **La encuesta pregunta solo lo que la herramienta no sabe.** Máximo 3 preguntas, opcionales, después de entregar el resultado.
4. **Un catálogo único.** Las mismas preguntas, con los mismos valores, en todas las herramientas. Cada respuesta guarda el valor agrupado (`valor`) y, si existe, el valor fino de origen (`valor_detalle`).
5. **Uso: producto y reporte público** ("State of PhD Transition LATAM", 2027). Ninguna cifra se publica con menos de 50 respuestas por pregunta (regla de fabricación motivacional).

## 2. Identificador anónimo (`aid`)

- Es un UUID aleatorio que se genera en el navegador la primera vez que la persona usa cualquier herramienta. Se guarda en `localStorage` como `solca_aid`.
- **Solo viaja al endpoint de mercado.** Nunca se envía a los endpoints operativos que reciben correo (`cv-review`, `quiz-subscribe`, simulador), para que no se pueda unir con un correo ni en los logs.
- Sirve para tres cosas:
  - contar personas, no usos;
  - cruzar las respuestas de una persona que usa varias herramientas;
  - no volver a preguntar lo que ya contestó en otra herramienta.
- Si el navegador bloquea el almacenamiento, el registro se guarda sin `aid`.
- **Requiere actualizar el aviso de privacidad.** La sección 8 de `privacidad.astro` dice que no usamos identificadores de rastreo. Hay que agregar que existe un identificador aleatorio local, sin relación con datos personales, usado solo para métricas agregadas.

## 3. Preguntas del núcleo

### P1 · País (`pais`)

| valor | Etiqueta |
|---|---|
| `mx` | México |
| `br` | Brasil |
| `ar` | Argentina |
| `co` | Colombia |
| `cl` | Chile |
| `es` | España |
| `pe` | Perú |
| `ec` | Ecuador |
| `otro_latam` | Otro país de América Latina |
| `otro` | Otro |

Equivalencia de los valores actuales:
- La lista del analizador y del quiz (`México`, `Brasil`…) se traduce 1 a 1.
- El simulador solo infiere el país desde la vacante o el idioma, y 23 de 30 sesiones quedaron sin dato. Ese dato es otro concepto ("país de la vacante", no "dónde vives"), así que no se copia: en el simulador el país se pregunta en la encuesta.

### P2 · Etapa (`etapa`)

Pregunta: «¿En qué etapa de tu trayectoria estás?»

| valor | Etiqueta |
|---|---|
| `lic_maestria_cursando` | Estudio licenciatura o maestría |
| `lic_maestria_egresado` | Terminé licenciatura o maestría, en transición |
| `phd_en_curso` | PhD en curso |
| `phd_terminado` | PhD terminado, en transición |
| `postdoc` | Postdoc |
| `industria` | Ya trabajo en industria y busco moverme de rol |

Equivalencias:
- **Encuesta actual del analizador:**
  - `phd_1_2`, `phd_3_5` y `phd_writing` → `phd_en_curso` (el valor original queda en `valor_detalle`);
  - `post_phd` → `phd_terminado`;
  - `postdoc` → `postdoc`;
  - `in_industry` → `industria`.
- **Simulador (derivado de nivel académico + años de experiencia):**
  - `licenciatura` o `maestria` con 4 o más años de experiencia → `industria`;
  - `licenciatura` o `maestria` con 0 a 3 años → `lic_maestria_egresado`;
  - `doctorado` → `phd_terminado`;
  - `postdoc` → `postdoc`.

  Es aproximado: el simulador no sabe si la persona aún estudia. Se marca con `tipo='derivado'`.

### P3 · Formación (`formacion`)

Pregunta: «¿Cuál es tu formación principal?»

| valor | Etiqueta | Valores finos del simulador (`valor_detalle`) |
|---|---|---|
| `biomedicas` | Ciencias biomédicas y biológicas | PhD_biomedicina, Biologo, Biotecnologo |
| `quimico_farma` | Ciencias químico-farmacéuticas | QFB, QFI, Farmaceutico_clinico |
| `clinicas_salud` | Ciencias clínicas y de la salud | Medico, Enfermero, Nutriologo, Veterinario |
| `datos` | Matemáticas, estadística y datos | Estadistica_bioestadistica, Matematicas_aplicadas, Ciencias_computacion_data, Actuaria |
| `negocios_salud_publica` | Administración, economía y salud pública | Administracion_MBA, Economia, Mercadotecnia, Salud_publica_health_mgmt |
| `otra` | Otra | Otro |

Notas:
- El simulador tiene `Postdoc` dentro de formación. Es un grado, no una formación. Para la copia de mercado se manda a `etapa=postdoc`, y la formación queda vacía.
- La pregunta "área científica" del analizador (inmunología, oncología…) es otro concepto. No entra al núcleo (ver §5).

### P4 · Rol de interés (`rol_interes`)

| valor | Etiqueta | Simulador | Quiz |
|---|---|---|---|
| `ventas` | Ventas / visitador médico | Visitador medico | — |
| `investigacion_clinica` | Investigación clínica (CRA, CRC) | Clinical Research Associate | CR |
| `msl` | Medical Science Liaison | Medical Science Liaison | MSL |
| `clinical_pm` | Project Manager clínico | Clinical Project Manager | PM |
| `consulting` | Consultoría | Healthcare Consultant | Consulting |
| `laboratorio_rd` | Laboratorio / R&D | Laboratory Scientist | — |
| `regulatorio` | Asuntos regulatorios | Regulatory Affairs Specialist | — |
| `farmacovigilancia` | Farmacovigilancia | Pharmacovigilance Associate | FV |
| `heor_analytics` | HEOR / Analytics | Healthcare Analyst · HEOR | — |
| `medical_affairs` | Medical Affairs | Medical Affairs | — |
| `otro` | Otro | Otro | — |
| `sin_decidir` | Aún no decido | (vacío) | — |

Notas:
- En el quiz, el rol que la persona cree que le encaja va a `rol_interes`.
- El rol que le asignó el quiz va como pregunta propia de la herramienta, `rol_resultado_quiz`. Así se puede medir el acuerdo entre lo que cree la persona y lo que le dio el quiz, en toda la base.

### P5 · Obstáculo principal (`obstaculo`)

Pregunta: «¿Qué te está frenando más para entrar o moverte en la industria?»

| valor | Etiqueta | Valor actual del analizador |
|---|---|---|
| `no_se_que_rol` | No sé qué rol específico me queda | no_role_clarity |
| `no_me_llaman` | Aplico pero no me llaman | no_callbacks |
| `entrevistas` | Llego a entrevistas pero no paso | (nuevo) |
| `ingles` | Mi inglés profesional | english |
| `networking` | Me falta red de contactos en industria | networking |
| `tiempo` | No tengo tiempo para prepararme | time |
| `otro` | Otro | other |

Se agrega `entrevistas` porque es la pregunta clave para el simulador.

### P6 · Urgencia (`urgencia`)

Pregunta: «¿Para cuándo quieres hacer el cambio?»

| valor | Etiqueta | Valor actual del analizador |
|---|---|---|
| `0_3m` | Lo antes posible (0-3 meses) | 0_3m |
| `3_6m` | 3-6 meses | 3_6m |
| `6_12m` | 6-12 meses | 6_12m |
| `mas_12m` | Más de un año | 1_2y |
| `explorando` | Solo estoy explorando | exploring |

### Campos automáticos (no se preguntan)

- `origen` (`simulador` | `quiz` | `cv`)
- `utm_source`, `utm_medium`, `utm_campaign`
- `referrer_host`
- `ts`
- `aid`
- `catalogo_version`

## 4. Qué deriva y qué pregunta cada herramienta

| Pregunta | Simulador | Quiz | Analizador de CV |
|---|---|---|---|
| País | **pregunta** | derivado (entrada) | derivado (formulario) |
| Etapa | derivado (aprox.) | **pregunta** | **pregunta** |
| Formación | derivado | **pregunta** | rota como 3ª pregunta |
| Rol de interés | derivado | derivado | — |
| Obstáculo | **pregunta** | **pregunta** | **pregunta** |
| Urgencia | **pregunta** | — | rota como 3ª pregunta |
| **Total preguntado** | 3 | 3 | 3 |

Reglas:
- Si el `aid` ya contestó una pregunta del núcleo en los últimos 90 días, no se repite. Su lugar lo ocupa la siguiente pendiente.
- Así, quien usa las tres herramientas termina contestando todo el núcleo sin ver dos veces la misma pregunta.

## 5. Preguntas propias de cada herramienta

| Herramienta | Se quedan | Se retiran | Motivo |
|---|---|---|---|
| Analizador de CV | inglés, movilidad | motivación, confianza, intentos, fuentes, área científica | Fuentes ya la da el UTM. Las demás tienen 4 a 9 respuestas en 5 meses y no llegarán a 50 compitiendo con el núcleo. Las 37 respuestas históricas se conservan. |
| Quiz | `rol_resultado_quiz` (derivado) | — | — |
| Simulador | edad y género (pasan a la base de mercado, anónimos) | — | La evaluación de la sesión (realismo, utilidad, disposición a pagar) es retroalimentación de producto, no de mercado: se queda en `beta_feedback`. |

Inglés y movilidad aparecen en el analizador solo cuando el núcleo de ese `aid` ya está completo.

## 6. Almacén

Una tabla D1 en la base existente `simulator-metrics` (o una nueva `solca-mercado`, por decidir en la implementación):

```
mercado_respuestas(
  id INTEGER PRIMARY KEY,
  aid TEXT,                -- puede ser NULL (histórico o almacenamiento bloqueado)
  origen TEXT,             -- simulador | quiz | cv
  tipo TEXT,               -- encuesta | derivado
  pregunta TEXT,           -- pais | etapa | formacion | rol_interes | obstaculo | urgencia | ingles | movilidad | edad | genero | rol_resultado_quiz
  valor TEXT,              -- valor del catálogo
  valor_detalle TEXT,      -- valor fino de origen, si existe
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  referrer_host TEXT,
  ts TEXT,
  catalogo_version TEXT    -- 'v1'
)
```

- Es una fila por respuesta. Así se agrega con SQL simple y el reporte semanal la lee directo.
- El país también se repite en cada fila, para cruzar sin joins.

## 7. Carga histórica (con `aid` vacío)

| Fuente | Registros | Qué se carga |
|---|---|---|
| D1 `sessions` (simulador) | 30 | etapa (solo si se puede derivar), formación, rol (salvo `Other`), edad y género (6) |
| KV `QUIZ_METRICS` (`m:`) | 23 | país, rol de interés, rol resultado |
| KV `CV_METRICS` (`s:`) | 37 | etapa, obstáculo, urgencia, inglés, movilidad; el área científica va como `cv_v0` (es otro concepto que formación) |

- Las filas históricas llevan `catalogo_version='v1_hist'`. Las preguntas retiradas del analizador se cargan con `cv_v0`, para no perder el histórico. Re-ejecutar la carga borra solo esas dos versiones.
- La carga usa un corte (`--corte`, el momento en que el endpoint nuevo quedó en producción): lo posterior ya entra en vivo.
- No se cargan el país inferido del simulador ni su rol `Other`, que es el valor por defecto de la plantilla y no una respuesta.
- Para reportes, `v1` y `v1_hist` se suman.

## 8. Medición del propio sistema

En el reporte semanal:
- tasa de respuesta por herramienta (encuestas contestadas / usos);
- personas únicas por `aid`;
- avance de cada pregunta hacia 50 respuestas.

## 9. Pendientes antes de implementar

1. Oscar revisa etiquetas y valores de este catálogo.
2. Actualizar `privacidad.astro`: sección del identificador local y mención de que los datos de uso de las tres herramientas alimentan métricas agregadas.
3. Decidir si la tabla va en `simulator-metrics` o en una base nueva.
