# Encuestas del curso V2.0 (24 nov 2026)

Curso "De la ciencia a la industria: CV, LinkedIn y entrevistas en farma y CRO". Textos: `../consultoria/curso-cv-v2/textos-finales/06-encuestas-y-correos.md`. Enlaces: `../consultoria/curso-cv-v2/recursos/enlaces-encuestas.txt`.

## Piezas

| Pieza | Archivo |
|---|---|
| Catálogo de preguntas, validación, correos 30/90 | `src/lib/encuesta-curso.ts` |
| Páginas `/encuesta-curso/{inicio,cierre,30-dias,90-dias}/` | `src/pages/encuesta-curso/[tipo].astro` |
| Envío del formulario | `src/pages/api/encuesta-curso.ts` |
| Correos de 30 y 90 días (cron diario 0 15, v8) | `src/pages/api/encuesta-curso-tick.ts`, `scripts/patch-cron-handler.mjs` |
| Tabla | `migrations/0015_curso_encuestas.sql` |
| Pruebas | `node scripts/test-encuesta-curso.mjs` |

Medición: vista = `page_viewed` con `page='encuesta-curso'` y `path=/encuesta-curso/<tipo>`; envío = `encuesta_curso_enviada` (`tag`=tipo); correos = `encuesta_curso_correo_enviado` / `_fallido`. Todo en D1 `eventos`. Antispam: user-agent de bot y 10 envíos por hora por IP (KV `SIMULATOR_METRICS`, `enc-curso-rl:`), como `/api/simulator-events`.

## Puesta en marcha (Oscar)

1. `npx wrangler d1 migrations apply SIMULATOR_METRICS_DB --remote` (aplica 0015; también 0014 si faltara).
2. Despliegue normal (`npm run deploy`).
3. Prueba: abrir `/encuesta-curso/cierre/?interno=1`, enviar con un correo propio y revisar la fila (`interno=1`, sin correos programados).
4. `GET /api/encuesta-curso-tick?key=<STATS_KEY>&dry=1` cuenta los envíos vencidos sin enviar.

## Consultas

```sql
-- Respuestas por encuesta (sin internos)
SELECT tipo, COUNT(*) n, COUNT(DISTINCT email_hash) alumnos FROM curso_encuestas
WHERE curso='curso_cv_v2' AND interno=0 GROUP BY tipo;

-- Autoevaluación inicio contra cierre (última respuesta de cada alumno)
WITH u AS (SELECT email_hash, tipo, json_extract(respuestas,'$.claridad') c,
           ROW_NUMBER() OVER (PARTITION BY email_hash, tipo ORDER BY ts DESC) r
           FROM curso_encuestas WHERE interno=0 AND tipo IN ('inicio','cierre'))
SELECT COUNT(*) n, AVG(c.c - i.c) cambio_promedio FROM u i JOIN u c USING (email_hash)
WHERE i.tipo='inicio' AND c.tipo='cierre' AND i.r=1 AND c.r=1;

-- % con al menos una entrevista a 90 días, solo entre quienes responden (reportar siempre con n)
SELECT COUNT(*) n, AVG(json_extract(respuestas,'$.entrevistas') >= 1) proporcion
FROM curso_encuestas WHERE interno=0 AND tipo='90-dias';

-- Respuestas unidas a una compra de Hotmart
SELECT e.tipo, COUNT(*) n, SUM(h.comprador_hash IS NOT NULL) con_compra FROM curso_encuestas e
LEFT JOIN (SELECT DISTINCT comprador_hash FROM hotmart_eventos WHERE evento='PURCHASE_APPROVED') h
  ON h.comprador_hash = e.email_hash WHERE e.interno=0 GROUP BY e.tipo;
```

## Lo que falta para los correos de 30 y 90 días

Hoy los correos se programan al recibir la encuesta de cierre (C.1) y cuentan desde esa fecha: es lo que dice el correo ("Hace un mes terminaste el curso"). Quien no responde el cierre no los recibe, porque no hay otro registro de su correo: el webhook de Hotmart solo guarda el hash del comprador y Hotmart no avisa cuándo alguien termina el curso.

Para cubrir también a quien no responde el cierre, haría falta una de estas dos piezas (no construidas):

- **A. Guardar el correo del comprador del curso en el webhook.** En `src/pages/api/hotmart-webhook.ts`, con `PURCHASE_APPROVED` y el id de producto del curso, guardar `{email, aprobado}` en KV (`curso-compra:<hash>`, sin caducidad o con 120 días) y programar 30/90 días desde la compra más una duración supuesta del curso. Cambia la política vigente ("el webhook no guarda datos del comprador") y la fecha ya no sería la de término: requiere decisión de Oscar y ajustar el texto del correo.
- **B. Carga manual.** Exportar compradores desde Hotmart y cargarlos con un script que llame a `programarSeguimiento`. Sin cambio de política, pero manual.

El saludo del documento es "Hola, [nombre]:". Ninguna encuesta pide el nombre y Hotmart no lo guarda, así que el correo dice "Hola:". `renderSeguimiento(tipo, nombre)` ya acepta un nombre si algún día existe.
