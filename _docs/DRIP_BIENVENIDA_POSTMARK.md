# Drip de bienvenida Postmark · runbook + copy

Fecha creación: 4 ago 2026. Referencia cruzada: `PLAN_VENTAS_MARKETING.md` § 3.4.

Secuencia post-registro de 4 emails (días 3, 7, 12, 20 desde el welcome) sobre
dos tracks:

- **Track `cv`**: leads que se registraron por `/revisar-cv`.
- **Track `quiz`**: leads que completaron `/quiz-rol` con rol asignado (PM, MSL,
  CR).

El welcome día 0 ya existe (endpoints `cv-review.ts` y `quiz-subscribe.ts`,
template `welcome-solca-insight`). El drip **no lo repite**.

## Arquitectura

Ver `src/pages/api/drip-tick.ts` (endpoint principal) y `src/lib/drip.ts`
(helpers). Trigger: Cloudflare Cron `"0 15 * * *"` = 9 AM CDMX diario.

- **Datos**: KV `EMAILS` con prefix `email:` (track cv) y `quiz:` (track quiz).
- **Dedupe**: KV `EMAILS` con key `drip:{email}:{track}:{step}` (sin TTL).
- **Kill switch**: KV `EMAILS` con key `unsub:{email}:drip`. Solo afecta el
  drip; no corta welcomes ni `blog-broadcast`.
- **Anti-fatiga**: skip si el lead recibió `blog-broadcast` en las últimas 48h
  (consulta Postmark Messages API por recipient + tag).
- **Ventana estricta**: se envía SOLO el día exacto (`age_days` ∈ {3,7,12,20}).
  Si el cron cae, ese email no se recupera. Es intencional para mantener la
  secuencia predecible.

## Setup one-shot (antes del primer deploy)

1. **Secret HMAC para links de baja:**
   ```
   cd /Users/oscar/Downloads/solca/website
   npx wrangler secret put DRIP_UNSUB_SECRET
   # Pega un valor random, e.g. `openssl rand -base64 32`
   ```

2. **Crear los 8 templates en Postmark** (dashboard → Templates → Add Template).
   Alias exactos y `templateModel` de cada uno abajo.

3. **Deploy**: `git push origin main`. Cloudflare Workers Builds despliega, el
   post-build `scripts/patch-cron-handler.mjs` v4 inyecta la ruta al drip.

4. **Verificar cron activo**: Cloudflare Dashboard → Workers & Pages → `solca`
   → Triggers → debe aparecer `"0 15 * * *"`.

5. **Smoke test dry-run** (no envía, retorna lo que enviaría):
   ```
   curl -s "https://solcaciencia.com/api/drip-tick?key=$STATS_KEY&dry=true" | jq
   ```
   Interpretar: `scanned` (records KV leídos), `candidates` (email × track
   únicos), `by_outcome` (desglose). Debería salir mayoría `skip_no_step_today`.

6. **Primer envío real**: el cron corre automáticamente al día siguiente. Para
   probar hoy con un lead cuya `age_days` coincida, disparar manualmente:
   ```
   curl -s "https://solcaciencia.com/api/drip-tick?key=$STATS_KEY" | jq
   ```

## templateModel esperado por Postmark

Todos los templates reciben el mismo objeto:

```json
{
  "first_name": "María",         // primer nombre (vacío si no está)
  "role_label": "Medical Science Liaison",  // solo track quiz, vacío en cv
  "role_slug":  "msl",           // solo track quiz, vacío en cv
  "site_origin": "https://solcaciencia.com",
  "unsub_url": "https://solcaciencia.com/api/drip-unsubscribe?email=...&sig=..."
}
```

**Footer obligatorio** en cada template (HTML y Text):

```
No quieres recibir más de estos: {{unsub_url}}
Sigues suscrito al newsletter Solca Insight aparte.
```

## Copy borradores · Track CV

### drip-cv-d3 · "El error #1 en CV PhD LATAM"

**Subject:** El error #1 en CV PhD LATAM

**Preheader:** Y qué probar en tu CV esta semana para corregirlo.

**Body (Text):**
```
Hola {{first_name}},

Tres días después de mandar tu CV a Solca Ciencia. Va una observación breve.

El error que más veo en CVs de PhD y posdoc que apuntan a industria pharma
LATAM: la sección de experiencia describe lo que hiciste como investigador,
pero no traduce el output a lo que la industria compra.

"Publiqué 3 artículos indexados" es dato de academia. Lo que industria pharma
lee es: "generé evidencia sobre X en Y personas y presenté los resultados en
formato de decisión ejecutiva a Z audiencias".

Esta semana, si tienes 20 minutos, agarra tu CV y reescribe una sola bala así.
Solo una. La diferencia es medible en la primera respuesta que recibas.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
Sigues suscrito al newsletter Solca Insight aparte.
```

### drip-cv-d7 · "Cómo pasar filtros ATS"

**Subject:** Cómo pasar filtros ATS sin trucos de keyword stuffing

**Preheader:** Cinco ajustes con evidencia, no palabras clave a fuerza.

**Body (Text):**
```
{{first_name}},

Una semana. Tu CV probablemente ya pasó por 1-2 filtros ATS. Estos filtros no
son mágicos, pero sí son literales: hacen match entre palabras del posting y
palabras del CV.

Cinco ajustes que sí mueven la aguja, sin caer en keyword stuffing (que las
reclutadoras ven a la primera):

1. Poner el título exacto de la vacante en tu headline si es honesto.
2. Sacrificar 2-3 responsibilities de bullet points para incluir la habilidad
   textual del posting.
3. Ordenar la experiencia por relevancia al rol, no por cronología pura, si
   la más reciente no es la más pertinente.
4. Reescribir tu formación en el idioma del posting (bilingüe puede ser CV
   en español con títulos técnicos en inglés).
5. Verificar que tu PDF sea seleccionable (no imagen escaneada). Los ATS
   no leen imágenes.

Escribí los cinco con más contexto y ejemplos aquí:
{{site_origin}}/blog/cv-pharma-cinco-ajustes-desde-phd

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

### drip-cv-d12 · Pitch curso CV

**Subject:** El curso de CV pharma existe, y lo hice porque me hartó ver el mismo error

**Preheader:** Precio de lanzamiento + garantía 30 días. Sin urgencia falsa.

**Body (Text):**
```
{{first_name}},

Doce días. Si estás aquí porque tu CV no está funcionando, y ya probaste los
ajustes de los emails anteriores sin ver cambio, es momento de considerar
trabajarlo con guía estructurada.

Hice un curso de CV pharma con:

- Framework paso a paso para reescribir un CV académico en formato industria.
- Diez ejemplos anonimizados de antes/después de candidatos LATAM reales.
- Plantilla ATS-friendly (Word, no template raro que se rompe al abrir).
- Sección sobre cover letter que sí se lee (la mayoría de guías la ignoran).

Precio de lanzamiento: MXN $999 (regular $1,499). Garantía 30 días completos:
si el curso no te sirve, te devuelvo el dinero sin preguntas.

{{site_origin}}/curso-cv

No es para todos. Si tu CV ya está funcionando y tienes 30% de respuestas o
más, no lo compres. Si estás por debajo de eso, probablemente sí te ayuda.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

### drip-cv-d20 · Por qué construí esto

**Subject:** Por qué construí Solca Ciencia (y qué sigue si el CV no es el bloqueo)

**Preheader:** Tres semanas de emails. El último.

**Body (Text):**
```
{{first_name}},

Veinte días. Este es el último email de la secuencia de bienvenida.

Construí Solca Ciencia porque, después de años entrevistando candidatos PhD
para industria pharma en LATAM, vi el mismo patrón: gente talentosa que se
quedaba fuera no por falta de fondo científico, sino por no saber traducir su
perfil al lenguaje que la industria compra.

Los recursos existían, pero fragmentados, mal etiquetados, escritos para gente
que ya está adentro. Solca Ciencia intenta cerrar esa brecha con contenido
directo, herramientas gratis (revisar CV, quiz de rol, simulador entrevistas)
y guías pagadas cuando quieres profundizar.

Si el CV no es tu bloqueo real, aquí lo que puede serlo y con qué recurso lo
atacas:

- No sabes qué rol te queda: {{site_origin}}/quiz-rol
- Sabes el rol pero no tienes práctica de entrevista:
  {{site_origin}}/simulador-entrevistas
- El bloqueo es de red / contactos: revisa los posts de LinkedIn en el blog
  ({{site_origin}}/blog/carreras-pharma).

Si algo de todo esto te ha servido, contéstame este email y dime qué. Leo
todas las respuestas.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

## Copy borradores · Track Quiz

Los cuatro reciben `role_label` (nombre humano) y `role_slug` (`pm`, `msl`,
`cr`) del rol asignado por el quiz.

### drip-quiz-d3 · Profundizar en el rol

**Subject:** Tu rol asignado por el quiz: {{role_label}}. Aquí más contexto.

**Preheader:** Qué hace en un día real, qué NO hace, y cómo verificar el fit.

**Body (Text):**
```
{{first_name}},

Tres días desde que hiciste el quiz. El rol que más se ajusta a tu perfil fue
{{role_label}}.

Un rol no es un título. Es una decisión diaria sobre en qué gastas tu tiempo.
{{role_label}} implica un tipo específico de trabajo que quizás no viste en la
descripción corta del resultado del quiz.

Escribí una guía detallada del rol pensada para gente que sale de academia y
está evaluando entrar: qué pide un posting real, qué NO se dice en el JD, y
cómo verificar si de verdad te queda antes de invertir semanas en la aplicación.

Léela aquí: {{site_origin}}/blog/como-ser-{{role_slug}}-en-mexico

Si después de leerla el rol no te queda tan bien como el quiz sugirió, es
información valiosa. El quiz es una hipótesis; la guía es el reality check.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

### drip-quiz-d7 · Rutas de entrada al rol

**Subject:** Cómo entrar a {{role_label}} desde donde estás hoy

**Preheader:** Tres rutas de entrada realistas, sin caminos de fantasía.

**Body (Text):**
```
{{first_name}},

Una semana. Asumo que ya leíste la guía del rol {{role_label}} y que sigues
con interés. La pregunta ahora es: cómo entrar desde donde estás hoy.

Hay tres rutas de entrada realistas a {{role_label}} en LATAM:

1. Directa · aplicar a vacantes junior o entry-level de {{role_label}} en
   empresas que sí contratan sin experiencia previa en industria (típicamente
   CROs multinacionales o farma local con programas de entrenamiento).
2. Adyacente · entrar primero a un rol vecino (Regulatory, Medical Affairs
   Coordinator, In-house CRA según el caso) y transicionar en 12-18 meses.
3. Vía posgrado · si la ruta directa no está funcionando, un MBA con enfoque
   salud o una maestría específica del rol puede desbloquear la ventana de
   entrada, pero es una inversión de tiempo y dinero que hay que justificar.

Qué ruta te queda depende de: tu formación, tu geografía, tu inglés, tu
tolerancia a viajar, y tu urgencia financiera. Ninguna es "la buena" en
abstracto.

Si quieres discutir cuál ruta te queda, contéstame este email con tu
contexto en 3-4 líneas y te doy mi lectura franca (gratis, no es un pitch).

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

### drip-quiz-d12 · Pitch libro del rol

**Subject:** El libro de {{role_label}} existe (y te ahorra 6 meses de research)

**Preheader:** Guía específica por rol, no un manual genérico de pharma.

**Body (Text):**
```
{{first_name}},

Doce días. Si {{role_label}} sigue en tu radar como opción real, y estás
juntando información para preparar aplicación o entrevista, tengo un recurso
específico para ti.

Hice un libro dedicado al rol {{role_label}} con:

- Radiografía completa del rol en LATAM (México, Argentina, Colombia, Chile).
- Bandas salariales por seniority con fuentes públicas verificables.
- Preguntas típicas de entrevista y cómo estructurar respuesta con marco STAR.
- Perfil de reclutador que suele contratar {{role_label}} y qué busca.
- Los cinco errores más frecuentes en aplicación al rol.

Precio de lanzamiento: MXN $799 (regular $999). En Hotmart, entrega
inmediata, garantía 30 días.

{{site_origin}}/libro-{{role_slug}}

Si el rol te queda pero prefieres el paquete completo, hay un bundle con los
tres libros (PM, MSL, CR) con descuento. Te lo pongo en el próximo email por
si vale la pena en tu caso.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

### drip-quiz-d20 · Bundle 3 libros

**Subject:** Bundle 3 libros pharma (por si aún estás decidiendo entre roles)

**Preheader:** Tres semanas de emails. El último.

**Body (Text):**
```
{{first_name}},

Veinte días. Este es el último email de la secuencia de bienvenida.

El quiz te asignó {{role_label}}, pero sé por conversaciones directas que
mucha gente en tu situación aún está evaluando entre dos o tres roles antes
de decidir dónde poner las semanas de aplicación.

Si ese es tu caso, el bundle de los tres libros (PM, MSL, CR) suele salir
mejor que comprar dos por separado:

- Bundle 3 libros: MXN $1,999 (vs. $2,397 comprando individual).
- Los tres libros usan el mismo marco de análisis; comparar entre ellos te
  ayuda a decidir sin cambiar de vocabulario.

{{site_origin}}/bundle-pharma

Si ya te decidiste por {{role_label}} y solo quieres el libro específico,
sigue disponible: {{site_origin}}/libro-{{role_slug}}.

Si algo de todo esto (quiz, blog, libros, contenido gratis) te ha servido,
contéstame este email y dime qué. Leo todas las respuestas.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

## Observabilidad

El endpoint `/api/drip-tick` responde con `TickSummary` en cada ejecución
(desglose de outcomes, sent_details, errors). Los logs quedan en Cloudflare
Workers logs (`wrangler tail solca`).

Métricas útiles para revisar semanalmente:

- **Volumen enviado**: `sum(sent_details) por día`. Se puede reconstruir con
  Postmark Messages API filtrando por tag `drip-cv-d*` y `drip-quiz-d*`.
- **Apertura y clic**: Postmark Analytics API por tag (mismo patrón que
  `weekly-report.ts` usa para `welcome-cv` y `blog-broadcast`).
- **Kill switch**: contar keys con prefix `unsub:*:drip` en KV EMAILS. Alta
  tasa de bajas es señal de que el copy fastidia; revisar y ajustar.
- **Anti-colisión activada**: contar `by_outcome.skip_recent_broadcast` en
  los summaries; si es alto, tal vez conviene reducir la ventana a 24h.

Sumar `drip_health` al `/api/weekly-report` es una siguiente iteración.

## Cambios pendientes vs. este runbook

**Bloqueantes antes de activar los envíos día 12 y 20** (los días 3 y 7 sí
pueden salir con el estado actual):

- **Landings de venta NO existen aún** en el repo:
  - `/curso-cv` — necesaria para drip-cv-d12.
  - `/libro-pm`, `/libro-msl`, `/libro-cr` — necesarias para drip-quiz-d12.
  - `/bundle-pharma` — necesaria para drip-quiz-d20.
  Opciones: (a) crearlas en Astro; (b) apuntar el copy a URLs Hotmart directas
  (las URLs de los tres SKUs viven en `src/pages/index.astro`, ver
  `TOOLS_REGISTRY.md` § 1.6); (c) posponer envío del d12/d20 hasta que existan
  landings.

**Recomendables antes del primer envío:**

- **Templates Postmark**: los 8 alias listados abajo deben existir en el
  dashboard antes del primer envío real. Si falta un template, Postmark
  responde con `ErrorCode 1101`/`1102` y el error se captura en
  `by_outcome.error` del summary.
- **Blogs referenciados** (verificados 4 ago 2026):
  - drip-cv-d7 → `/blog/cv-pharma-cinco-ajustes-desde-phd` ✓ existe.
  - drip-quiz-d3 → `/blog/como-ser-{{role_slug}}-en-mexico`: verificado
    4 ago 2026, `como-ser-msl-en-mexico` y `como-ser-cra-en-mexico` existen,
    pero **`como-ser-pm-en-mexico` NO existe** (solo hay el post comparativo
    `msl-cra-pm-heor-diferencia-rol-pharma`). Para el track quiz con
    `role='PM'`, el template `drip-quiz-d3` debe apuntar al comparativo o
    condicionar la URL con `role_slug` en el template body.
