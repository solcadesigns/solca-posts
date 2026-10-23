# Buscador de vacantes · solcaciencia.com/vacantes

Arranque: 22 oct 2026. Lanzamiento parcial: vie 30 oct 2026 (newsletter de vacantes). Lanzamiento completo: vie 27 nov 2026.

## Qué es

Un buscador de vacantes de industria farmacéutica, CROs y medtech en México, Brasil, Argentina, Colombia, Chile, Perú y España. Se actualiza cada día desde los portales oficiales de empleo de cada empresa.

Cada vacante enlaza a la oferta original. Según el rol, también lleva al Simulador de Entrevistas, con el módulo del rol ya elegido, y al analizador de CV.

Reemplaza la captura mensual manual de vacantes ([[vacantes-workflow-v2]] en la memoria de Claude). La tabla diaria acumula el historial que antes se capturaba a mano para el análisis semestral.

Inspiración: https://bertamunoz02.github.io/busqueda_empleo/. Su repositorio no tiene licencia, así que se tomó la idea y el código es propio.

## Piezas

| Pieza | Archivo |
|---|---|
| Fuentes (15 en la v1, todas Workday) | `src/lib/vacantes-fuentes.ts` |
| Clasificación por rol y nivel (reglas sobre el título, sin IA) | `src/lib/vacantes-clasificar.ts` |
| Lector diario (worker `solca-vacantes`, cron 11:00 UTC) | `workers/vacantes/index.ts`, `workers/vacantes/wrangler.jsonc` |
| Tablas D1 `vacantes`, `vacantes_corridas`, `vacantes_eventos` | `migrations/0004_vacantes.sql` |
| Página | `src/pages/vacantes.astro` |
| Medición | `src/pages/api/vacantes-evento.ts`, `page_viewed` con `page='vacantes'`, sección `vacantes` de `/api/weekly-report` |

## Fuentes evaluadas (23 oct 2026)

Lista tomada de la herramienta de referencia. Para cada empresa se revisó si su portal oficial se puede leer (`robots.txt`) y si tiene vacantes en los 7 países.

| Empresa | Plataforma | Estado | Vacantes en los 7 países (23 oct) |
|---|---|---|---|
| IQVIA, ICON, Fortrea, Pfizer, MSD, Novartis, AstraZeneca, Sanofi, Roche, GSK, Amgen, Viatris, BMS, Almirall, Medtronic | Workday | Activas desde el 22 oct | Ver `vacantes_diario` |
| Eli Lilly | Workday (detrás de su portal Phenom) | Agregada | 19 |
| Merck KGaA (EMD) | Phenom | Agregada | 54 |
| Thermo Fisher (PPD) | Phenom | Agregada. Su sitio Workday prohíbe la lectura en `robots.txt`; su portal público la permite. | ~360 en el listado |
| Gilead, Rovi, Regeneron, Ipsen, Lonza, Sartorius | Workday | Agregadas | 2, 25, 10, 13, 6, 5 |
| Evotec, Ferring | Workday | Sin vacantes en los 7 países; se pueden sumar si abren | 0 |
| Labcorp | Phenom | Sin vacantes en los 7 países | 0 |
| Parexel, Takeda | Radancy | **Excluidas:** su `robots.txt` prohíbe `/search-jobs/` | — |
| Medpace | API JSON propia | Pendiente: requiere un lector propio; el acceso está permitido | Por medir |
| BioMarin | Jobvite | Pendiente: presencia en la región por verificar | Por medir |

**Regla:** el lector revisa el `robots.txt` de cada fuente en cada corrida. Si una fuente lo prohíbe, se salta y queda registrada con error en `vacantes_corridas`.

**Fichas de Phenom:** se piden de una en una, con pausa de 400 ms y un reintento, porque el portal responde 410 si se le pide rápido.

## Reglas

- **Solo portales oficiales de las empresas.** Nunca LinkedIn ni agregadores: leerlos de forma automática viola sus condiciones.
- **Sin IA en la actualización diaria:** cero tokens. El costo es tiempo de Cloudflare dentro del plan Workers Paid; en el estimado de arranque, el consumo queda dentro de lo incluido. Se confirma con la primera semana de uso.
- **Una fuente que falla no cierra vacantes.** Las vacantes solo se marcan como cerradas cuando la lectura de esa fuente fue completa (`estado='ok'` en `vacantes_corridas`).
- **Ritmo:** una fuente a la vez y 5 consultas en paralelo como máximo, una vez al día. El `robots.txt` de myworkdayjobs.com no bloquea la API `/wday/cxs/`.
- **Clasificación:** el rol y el nivel son una estimación a partir del título. La página lo dice. Al cambiar reglas, sube `CLASIFICACION_VERSION`.
- **Cobertura:** una vacante entra si al menos una de sus ubicaciones es de un país objetivo. `pais` es el principal y `paises` incluye todos.

## Operación

- **Despliegue del worker** (Oscar): `cd website/workers/vacantes && npx wrangler deploy`
- **Llave para la carga manual** (una vez): `npx wrangler secret put RUN_KEY`
- **Carga manual** (primera carga o pruebas): `https://solca-vacantes.<subdominio>.workers.dev/run?key=<RUN_KEY>[&fuente=iqvia]`
- **Fallas:** `SELECT * FROM vacantes_corridas WHERE estado != 'ok' ORDER BY ts DESC`
- **Agregar fuente Workday:** una línea en `vacantes-fuentes.ts`, con host, tenant y site tomados de la URL del portal.

## Descriptores para análisis de contenido (desde 22 oct 2026)

Se extraen de la descripción con reglas, sin IA (`src/lib/vacantes-descriptores.ts`, versión en `DESCRIPTORES_VERSION`). La descripción completa se guarda, así que todo se puede volver a extraer: al cambiar reglas, sube la versión y corre `/run?key=…&modo=reprocesar` (el cron también reprocesa un lote cada día).

- **Columnas en `vacantes`:**
  - `idioma_anuncio` (es, en, pt);
  - `ingles` (no_mencionado, mencionado, basico, intermedio, avanzado, nativo);
  - `grado_min` (el grado más bajo que acepta la vacante);
  - `anios_min` (años mínimos de experiencia mencionados);
  - `contrato` (temporal, freelance, practicas; vacío si no lo dice);
  - `sponsor_dedicado` (CRO dedicada a un solo cliente o modelo FSP);
  - `inclusion` (convocatoria para personas con discapacidad o de diversidad).
- **Tabla `vacantes_etiquetas`** (`tipo`, `valor`): idiomas, grados aceptados, áreas terapéuticas y herramientas o normas (GCP/ICH, GMP, SAS, Python, SQL, Power BI, Excel, Veeva, Medidata, CTMS, EDC…).
- **Lo que no se extrae:** salario. Casi nunca viene en las vacantes de la región, y las coincidencias de texto salen de párrafos genéricos de beneficios.

**Prueba sobre 1,066 vacantes (22 oct 2026):**
- 53 % menciona inglés; de las que lo mencionan, la mayoría pide nivel avanzado.
- 50 % menciona años de experiencia mínimos.
- 20 % menciona GCP o ICH.
- 86 % de los anuncios está en inglés.

Son resultados de reglas: antes de publicar una cifra, valida una muestra a mano.

### Reglas para que el dato sea defendible

- **Qué es el dato.** Es un censo de lo que publican estas empresas en sus portales, no del mercado laboral completo. El contenido tiene que decirlo así.
- **Panel fijo para tendencias.** Cada fuente tiene fecha de `alta` en `vacantes-fuentes.ts`. Al comparar periodos, usa solo las fuentes con alta anterior al primer periodo; sumar fuentes infla las cifras sin que el mercado cambie.
- **Métricas por periodo (mes, trimestre, año), cortadas por país, rol, nivel, empresa y tipo de empresa:**
  - vacantes abiertas al cierre del periodo (de `primera_vez` y `fecha_cierre`);
  - nuevas y cerradas;
  - días publicada (mediana, de `fecha_cierre` menos `primera_vez`);
  - porcentaje de puestos de entrada, de remotos, de los que piden inglés avanzado y de los que piden doctorado;
  - herramientas y áreas terapéuticas más pedidas;
  - cambio contra el periodo anterior y contra el mismo periodo del año previo.

## Auditoría independiente de datos (22 oct 2026) y controles

**Resultado de la auditoría** (copia del 22 oct, reglas r5/d1):
- **Guardado:** fiel. 244 de 244 vacantes coinciden con el portal en título, fecha y descripción.
- **Rol:** alrededor de 85 % de acierto, ponderado.
- **Nivel:** casi siempre correcto cuando se asigna, pero 40 % queda sin nivel.
- **Descriptores:** cerca de 95 % de acierto en "menciona inglés" y cerca de 90 % en herramientas. Los puntos débiles eran "inglés nativo", grado mínimo, años de experiencia y áreas terapéuticas.

Las correcciones están en las reglas r7/d3 y en la migración 0007.

**Columnas de calidad** (migración 0007):
- `pais_principal_iso`, `es_principal` y `n_ubicaciones`: 13 % de las vacantes tenían su ubicación principal fuera de los 7 países (Londres, Varsovia, EE. UU.) y entraron porque España o México eran una opción más. **Para cifras por país, usa solo `es_principal = 1`** y reporta aparte las regionales o multipaís.
- `cohorte_inicial`: lo que ya estaba publicado en la primera lectura de cada fuente. **Exclúyelo de "nuevas" y de "días publicada".**
- `tipo_publicacion`: separa los bancos de talento (`banco_talento`). Las vacantes "perpetuas" (más de 365 días desde `fecha_publicacion`) se excluyen en la consulta, no en la columna.
- `grupo_dup`: plazas múltiples de la misma oferta (por ejemplo, 6 "CRA" de ICON en São Paulo). Cuenta plazas, pero no las leas como 6 empleadores.
- `id_llave`: identifica los ids armados con la ruta en vez del número de requisición.
- `cerrada_en`: el momento en que el lector la cerró.
- Tabla `vacantes_ciclo`: historial de alta, cierre, reapertura y cambio de título, para reconstruir periodos pasados.
- Tabla `vacantes_diario`: foto diaria agregada (fuente, país, rol, nivel; activas y activas con país principal), con la versión de reglas del día.

**Controles automáticos en el lector:**
- Si una fuente cae a la mitad o menos de la mediana de sus últimas 7 corridas, la corrida queda `sospechosa` y no cierra nada.
- Lo mismo si pretende cerrar más del 30 % de las activas de una fuente en un día.
- Las lecturas incompletas quedan `parcial`.
- El reporte semanal muestra `vacantes.calidad` y las corridas sospechosas.

**Límites conocidos:**
- El rol se clasifica solo con el título. Por ejemplo, IQVIA tiene un "MSL" que en la descripción es delegado comercial.
- La modalidad solo existe en 5 fuentes: **no publiques "% remotos"** salvo con las fuentes que la reportan.
- BMS solo aporta 1 o 2 vacantes porque no tiene faceta de país; hay que configurarla.

### Protocolo antes de publicar una cifra

1. Congela el periodo: fecha, versión de reglas (`vacantes_diario.reglas`) y panel de fuentes con `alta` anterior al periodo.
2. Excluye la cohorte inicial, los bancos de talento y las perpetuas. Por país, usa solo `es_principal = 1`.
3. Por cada cifra, revisa a mano una muestra aleatoria de 30 vacantes del numerador y 30 del denominador. Publica solo si la precisión es de 90 % o más; si no, corrige la regla, reprocesa y repite.
4. Da el número absoluto junto al porcentaje. No publiques cortes con menos de 30 vacantes.
5. Di siempre "lo que publican estas N empresas en sus portales" y cuánto aporta la fuente más grande. Hoy IQVIA es alrededor de 27 %.
6. En comparaciones entre periodos, que un revisor independiente vuelva a correr la consulta desde la foto congelada.

## Medición

`vacantes_eventos` guarda cuatro eventos:
- `vacantes_viewed`
- `vacantes_filtered`
- `vacancy_clicked`, con rol, país, empresa y nivel tomados de la tabla, no del cliente
- `tool_clicked`, con la herramienta: simulador, cv o quiz

Cada evento lleva el identificador anónimo `aid`, los UTM y el dominio de origen. No guarda correo ni IP.

El reporte semanal lee la sección `vacantes`: vacantes activas, nuevas y cerradas, fuentes con error, eventos, personas únicas, clics por rol y país, paso a herramientas y campañas. Para el análisis semestral, cruza los clics por rol con `mercado_respuestas.rol_interes`.

## Pendiente para el 27 nov

- Sumar fuentes que no usan Workday: Parexel, Syneos, PPD (Thermo Fisher), Takeda, AbbVie, Novo Nordisk, Lilly y laboratorios locales (Liomont, Sanfer, Silanes, Eurofarma, EMS, Aché, Bagó, Tecnoquímicas, Procaps, Grifols, Esteve, Ferrer, Rovi).
- Revisar con datos reales la tasa de `otro` en la clasificación y ajustar reglas.
- Enlazar `/vacantes` desde la página principal y la navegación global.
