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

## Copy final · Track CV

### drip-cv-d3 · el error más común

**Subject:** El error más común en CVs a pharma LATAM

**Body (Text):**
```
Hola {{first_name}},

Tres días después de mandar tu CV a Solca Ciencia. Va una observación breve.

El error que más veo en CVs que apuntan a industria pharma LATAM: la sección
de experiencia describe lo que hiciste como investigador, académico o
estudiante, pero no traduce el output a lo que la industria compra.

Ejemplo: "Publiqué 3 artículos indexados" es dato de academia. Lo que
industria pharma busca es: "generé evidencia sobre X en Y personas y presenté
los resultados en formato de decisión ejecutiva a Z audiencia".

Esta semana, si tienes 20 minutos, agarra tu CV y traduce tus experiencias al
lenguaje pharma.

Si quieres profundizar en cómo hacer una aplicación exitosa (desde CV a
entrevista) te recomiendo nuestro curso en línea: CV para Ciencias Biológicas
y de la Salud → https://go.hotmart.com/B104495115T

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
Sigues suscrito al newsletter Solca Insight aparte.
```

### drip-cv-d7 · filtros ATS

**Subject:** Tres ajustes de CV para pasar filtros ATS

**Body (Text):**
```
{{first_name}},

Una semana. Si estas aplicando activamente a vacantes, tu CV probablemente ya
pasó por 1-2 filtros ATS. Estos filtros no son mágicos, pero sí son literales:
hacen match entre palabras del posting y palabras del CV.

Tres ajustes que sí pueden impactar inmediatamente:

1. Poner el título exacto de la vacante en tu headline (a menos que no puedas
   defenderlo).
2. Incluir las habilidades solicitadas textualmente del posting.
3. Verificar que tu PDF sea seleccionable (no imagen escaneada). Los ATS cada
   vez son mejores, pero no te arriesgues a que no pueda leer imágenes.

Si quieres profundizar en cómo hacer una aplicación exitosa (desde CV a
entrevista) te recomiendo nuestro curso en línea: CV para Ciencias Biológicas
y de la Salud → https://go.hotmart.com/B104495115T

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

### drip-cv-d12 · pitch curso CV

**Subject:** Curso CV pharma · si tu CV podría no estar funcionando

**Body (Text):**
```
{{first_name}},

Doce días. Si estás aquí porque tu CV podría no estar funcionando.

Hice un curso de CV pharma con:

- Framework paso a paso para reescribir un CV académico en formato industria.
- Plantillas ATS-friendly.
- Sección sobre entrevistas y estrategias para responder.

Precio de lanzamiento: MXN $999 (regular $1,499). Garantía 30 días completos:
si el curso no te sirve, te devuelvo el dinero sin preguntas.

CV para Ciencias Biológicas y de la Salud → https://go.hotmart.com/B104495115T

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

### drip-cv-d20 · cierre

**Subject:** Por qué construí Solca Ciencia (y qué sigue si el CV no es el bloqueo)

**Body (Text):**
```
{{first_name}},

Veinte días. Este es el último email de mi secuencia de bienvenida.

Construí Solca Ciencia porque, después de años de ver el mismo patrón: gente
talentosa que se quedaba fuera no por falta de fondo científico, sino por no
saber traducir su perfil al lenguaje que la industria busca.

Los recursos existen, pero fragmentados, mal etiquetados, escritos para gente
que ya está adentro. Solca Ciencia intenta cerrar esa brecha con contenido
directo, herramientas gratis (revisar CV, quiz de rol, simulador entrevistas),
así como herramientas premium, cursos y guías pagadas cuando quieres
profundizar.

Si el CV no es tu bloqueo real, aquí lo que puede serlo y con qué recurso lo
atacas:

- No sabes qué rol te queda: {{site_origin}}/quiz-rol
- Sabes el rol pero no tienes práctica de entrevista:
  {{site_origin}}/simulador-entrevistas
- El bloqueo es de red / contactos: revisa los posts de LinkedIn en el blog
  ({{site_origin}}/blog).

Si algo de todo esto te ha servido, contéstame este email y dime qué. Leo
todas las respuestas.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

## Copy final · Track Quiz

Los cuatro reciben `role_label` (nombre humano · "Medical Science Liaison",
"Product Manager", "Clinical Research"). El `role_slug` se dejó de usar
después de descubrir que las URLs por rol no existían — los templates finales
apuntan a URLs Hotmart directas o a `{{site_origin}}/#libros` (ancla en home
con los tres libros).

### drip-quiz-d3 · profundizar en el rol

**Subject:** Tu rol asignado por el quiz: {{role_label}}. Aquí más contexto.

**Body (Text):**
```
{{first_name}},

Tres días desde que hiciste el quiz. El rol que más se ajusta a tu perfil fue
{{role_label}}.

Un rol no es un título. Es una decisión diaria sobre en qué invertir tu tiempo.
{{role_label}} implica un tipo específico de trabajo que quizás no viste en la
descripción corta del resultado del quiz.

Escribí unas guías introductorias para tres roles comunes en la industria
pharma con las que puedes iniciar tu camino. Cada guía incluye información
para iniciar tu formación y prepararte para adaptar y transformar tus
habilidades a lo que cada rol necesita.

Project Manager → https://go.hotmart.com/R105710415P
MSL → https://go.hotmart.com/Y105718405Y
Clinical Research → https://go.hotmart.com/U105724060O

Si después de leerla el rol no te queda tan bien como el quiz sugirió, es
información valiosa. El quiz es una hipótesis; la guía es el reality check.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

### drip-quiz-d7 · rutas de entrada

**Subject:** Tres rutas realistas para entrar a pharma en LATAM

**Body (Text):**
```
{{first_name}},

Una semana. Te comparto tres posibles rutas de entrada realistas a pharma en
LATAM:

1. Directa · aplicar a vacantes junior o entry-level en empresas que sí
   anuncian vacantes sin experiencia previa en industria.
2. Adyacente · entrar primero a un rol vecino (Regulatory, Medical Affairs
   Coordinator, In-house CRA según el caso) y transicionar en 12-18 meses.
3. Vía posgrado · si la ruta directa no está funcionando, un MBA con enfoque
   salud o una maestría o diplomado específico del rol puede desbloquear la
   ventana de entrada, pero es una inversión de tiempo y dinero que hay que
   justificar. Asegúrate de crecer tu red de contactos en estas etapas.

Qué ruta te queda depende de: tu formación, tu geografía, tu inglés, tu
tolerancia a viajar, y tu urgencia financiera. Cada camino es diferente y no
hay camino malo.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

### drip-quiz-d12 · pitch libro del rol

**Subject:** El libro de {{role_label}} está listo si sigue en tu radar

**Body (Text):**
```
{{first_name}},

Doce días. Si {{role_label}} sigue en tu radar como opción real, y estás
juntando información para preparar aplicación o entrevista, tengo un recurso
específico para ti.

Como te comenté hace unos días, hice un libro dedicado al rol {{role_label}}
con:

- Radiografía completa del rol en LATAM (México, Argentina, Colombia, Chile).
- Fundamentos teóricos, lenguaje clave, el día a día operativo del rol.
- Módulo de aplicaciones para vacantes.
- Las herramientas de IA que se utilizan en el rol.

Precio de lanzamiento: MXN $599 (regular $799). En Hotmart, entrega inmediata,
garantía 7 días.

{{site_origin}}/#libros

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
```

### drip-quiz-d20 · cierre + cupón

**Subject:** Último email · cupón BIENVENIDA50 para tu libro

**Body (Text):**
```
{{first_name}},

Veinte días. Este es el último email de la secuencia de bienvenida.

El quiz te asignó {{role_label}}. Ese resultado es una imagen del perfil que
podrías disfrutar más; tu resultado no está basado en lo que te hará ganar
más dinero, en lo que puede ser más fácil o el que más vacantes publica. Es
decir, es el rol para el que posiblemente tengas mayor vocación.

Puedes encontrarlo en nuestra página. Te comparto un cupón de descuento para
que puedas iniciar tu camino a tu siguiente éxito profesional (úsalo en el
checkout).

Cupón: BIENVENIDA50

Selecciona el libro en {{site_origin}}/#libros

Si algo de todo esto (quiz, blog, libros, contenido gratis) te ha servido,
te agradecería recomendarlos.

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

**Estado 4 ago 2026 (post-edición final de Oscar en Postmark UI):** los 8
templates están creados y editados. El copy final ya no depende de las
landings `/curso-cv`, `/libro-*`, `/bundle-*` que no existían — todos los
CTA de venta apuntan directo a Hotmart o al ancla `{{site_origin}}/#libros`.

**Pendientes reales para activar el primer envío:**

1. **Secret `DRIP_UNSUB_SECRET`**: `npx wrangler secret put DRIP_UNSUB_SECRET`
   con `openssl rand -base64 32`. Sin esto el endpoint `/api/drip-tick`
   retorna `by_outcome.error` con "DRIP_UNSUB_SECRET missing".
2. **Smoke test dry-run**: `curl -s "https://solcaciencia.com/api/drip-tick?key=$STATS_KEY&dry=true" | jq`
   para confirmar que scanned/candidates/by_outcome cuadran antes de dejar
   correr el cron.

**Pendientes de mediano plazo (tasks separadas):**

- **Mejorar descripción de libros en landings de pago** (task #22): la
  descripción actual en Hotmart no da información suficiente para decidir.
  Índice + para quién / para quién no + formato + extensión + quién escribe.
- **Portadas y títulos de libros: quitar restricción a PhD** (task #23):
  ampliar audiencia declarada a MD, PharmD, QFB con experiencia, ciencias
  de la salud en transición. Los libros sirven a más perfiles que PhD/posdoc.
- **Cobertura de blog `como-ser-pm-en-mexico`**: existe blog dedicado a MSL
  y CRA en México pero no a PM. No bloquea el drip actual (drip-quiz-d3 usa
  URLs Hotmart directas), pero sí es hueco editorial que vale cerrar.
