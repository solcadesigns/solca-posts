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
