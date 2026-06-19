# Simulador de Entrevistas con IA · Addendum del proyecto Solca

> **Propósito:** complementar el documento original *"Simulador de Entrevistas con IA — Prompt de contexto y siguientes acciones"* con el contexto real de Solca (stack actual, audiencia, reglas editoriales, herramientas existentes), corregir desactualizaciones, y aterrizar gaps que el doc no captura.
>
> Léelo junto con `OSCAR_PROFILE.md`, `TOOLS_REGISTRY.md` y el doc original.
>
> **Fecha:** 25 may 2026.

---

## TL;DR · qué cambia respecto al doc original

| Tema | Doc original | Realidad Solca | Acción |
|---|---|---|---|
| Stack del sitio | "HTML/CSS estático en GitHub + Cloudflare" | **Astro 5 SSR sobre Cloudflare Workers** | Construir como ruta nueva del Astro existente, no como sitio separado. |
| Auth + DB | Supabase | Cloudflare KV (ya en uso) + opcional Cloudflare D1 si necesitamos relaciones | Evitar añadir Supabase como dependencia nueva. |
| Pagos | Conekta + Stripe | Hotmart ya integrado para los 3 libros | Reusar Hotmart como primer paso; Conekta solo si pruebas validan demanda y queremos OXXO/SPEI directo. |
| Audiencia | "Ciencias de la salud y biológicas" | Audiencia ampliada oficial (25 may 2026): *"Carreras en industria farmacéutica para profesionales en ciencias biológicas y afines"* | Alinear copy y selector de áreas con esta bajada. |
| Voz (Web Speech API) | "Funciona bien en Chrome" | Cierto en Chrome/Edge desktop · iOS Safari limitado · Firefox sin soporte nativo | Tratar voz como progressive enhancement, no requisito. |
| Lead magnet | "Captura de email antes del resultado" | `/revisar-cv` actual NO obliga email | Consistencia: email opcional con incentivo (reporte por mail), no obligatorio. |

---

## 1 · Alineamiento con la marca Solca

### 1.1 · Audiencia objetivo (literal, copiar al UI)

La línea oficial de Solca desde 25 may 2026 es:

> Carreras en la industria farmacéutica para profesionales en ciencias biológicas y afines.

El selector de áreas en el cuestionario debe reflejar esa amplitud — añadir respecto al doc original:

- QFB
- Biólogo / Bióloga
- Biotecnólogo / Biotecnóloga
- Médico / Médica
- Enfermero / Enfermera
- Químico Farmacéutico Industrial (QFI) / Químico Farmacobiólogo (QFB)
- Nutriólogo / Nutrióloga
- Veterinario / Veterinaria (entran a pharma veterinaria)
- Farmacéutico clínico
- PhD en biomedicina / biología molecular / farmacología / similar
- Posdoctorado activo
- **Otro · escribir** (campo libre con etiqueta posterior por Claude)

Cada área se mapea internamente a roles probables. Ejemplos:

| Área | Roles más probables a sugerir |
|---|---|
| QFB | Pharmacovigilance, Regulatory, Manufacturing QA, Medical Information |
| Biólogo / Biotecnólogo | CRA, MSL (con PhD), Bioprocess, R&D |
| Médico | MSL, Medical Advisor, Medical Director |
| Enfermero | Site Coordinator, Pharmacovigilance, Patient Support Programs |
| Nutriólogo | Medical Education, Patient Programs en nutrición especializada |
| PhD en biomedicina | MSL, Medical Affairs, HEOR, Regulatory Strategy |

Mostrar 2-3 roles sugeridos según el área seleccionada en Modo B.

### 1.2 · Reglas editoriales transversales (aplican al prompt de IA)

Estas reglas (documentadas en `OSCAR_PROFILE.md`) deben quedar en el system prompt del simulador, no en notas externas:

1. **Sin emoji.** Política de marca.
2. **Regla de traducción.** Cualquier acrónimo pharma (ICH-GCP, SOP, TMF, KOL, MLR, HEOR, etc.) se define inline la primera vez que aparece en una pregunta o feedback.
3. **Test entry-level.** Las preguntas deben ser entendibles por alguien que recién está cruzando de academia a industria — no asumir conocimiento previo del oficio.
4. **Sin fabricación.** No inventar nombres específicos de personas, estudios clínicos ficticios, papers ficticios, ni cifras específicas sin fuente. Si una pregunta requiere un caso concreto, usar fraseos como *"imagina un estudio fase III en oncología"* sin nombre comercial.
5. **Sobriedad en feedback.** Honesto, directo, sin floritura. Si la respuesta del usuario fue floja, decirlo claro. Si fue buena, decirlo sin inflar.
6. **Anclaje a evidencia.** Cuando el feedback sugiere mejoras, ancla en patrones reales (ICH-GCP, vocabulario CRO, etc.) no en generalidades.

### 1.3 · CTA contextual por plan y momento (decisión 12 jun 2026 — corregido v0.3)

**Cambio respecto a v0.1:** Inicialmente se propuso CTA libro contextual al rol al final de CADA sesión. Oscar identificó que esto genera fatiga publicitaria en usuarios pagados que ya demostraron buy-in. Evidencia externa confirma el riesgo:

- [Reteno · Control Fatigue Messaging Frequency](https://reteno.com/blog/your-apps-hidden-roi-control-fatigue-messaging-frequency-without-user-burnout) cita Euromonitor 2025: 38% de smartphone owners desactivó notificaciones por fatiga digital.
- [Refiner.io · In-app Messaging Best Practices](https://refiner.io/blog/in-app-messaging-best-practices/) reporta: *"In-app upsell prompts tied to real behavior feel natural — like hitting a usage limit or unlocking a feature."*
- [Saras Analytics · Customer Churn Analysis](https://www.sarasanalytics.com/blog/customer-churn-analysis): declining purchase frequency es señal temprana de churn.

**Lógica nueva — CTA libro atado a plan y momento del paquete:**

| Plan | Sesiones donde aparece CTA libro | Qué va en el espacio del CTA en el resto |
|---|---|---|
| Gratis (1 sesión Modo B) | Sí, al final. Es lead magnet. | n/a |
| Básico ($149, 3 sesiones) | Solo sesión 3 (despedida) | Sesión 1-2: recurso gratuito relevante al gap detectado + sugerencia de rol complementario |
| Intensivo ($349, 10 sesiones) | Solo sesión 8-10 (cierre del paquete) | Sesión 1-7: recursos gratuitos y `/revisar-cv` enfocados en gaps acumulados |
| Pro ($599, ilimitadas 30 días) | Solo cuando se acerca a expirar (≤5 días) | Resto: valor genuino sin CTA comercial |

**Mapeo de rol a libro (cuando toca CTA libro):**

| Rol practicado | Libro relevante | URL Hotmart |
|---|---|---|
| PM, Clinical PM | Libro 1 · De Doctorado a Project Manager | `https://go.hotmart.com/R105710415P` |
| MSL, Medical Affairs | Libro 2 · De Doctorado a MSL | `https://go.hotmart.com/Y105718405Y` |
| CRA, Clinical Research, Site Coordinator | Libro 3 · De Doctorado a Clinical Research | `https://go.hotmart.com/U105724060O` |
| Regulatory, PV, HEOR, Otro | Rotar entre los 3 + `/revisar-cv` |

**Regla rectora del CTA libro:** debe estar justificado por el feedback acumulado de la sesión, no ser banner automático. Si el feedback identifica un gap específico que el libro cubre, el CTA es natural. Si no hay gap claro, el CTA se omite y se reemplaza por recurso gratuito.

**Qué reemplaza el CTA libro en sesiones donde NO toca:**

1. **Recurso gratuito relevante** al gap detectado en esa sesión (curso TransCelerate de ICH-GCP, post del blog sobre el tema, `/revisar-cv` para mejorar CV).
2. **Sugerencia de rol complementario** a practicar en la próxima sesión.
3. **Comparación honesta de progreso** si hay sesiones anteriores guardadas (v1.0).
4. **Cierre directo** sin promoción cuando el feedback es completo.

### 1.4 · Variabilidad y personalización del feedback (decisión 12 jun 2026 — v0.3)

**Riesgo identificado:** si el feedback depende solo de la rúbrica de scoring 1-5, dos respuestas similares reciben feedback idéntico. Un usuario que practica 3 veces en Básico recibe feedback redundante. Mata la percepción de personalización y aumenta churn.

**Evidencia externa:**

- [Wang et al · Meta-analysis 2026 (40 estudios, 5,849 participantes)](https://journals.sagepub.com/doi/10.1177/07356331251410020): feedback personalizado vs estático tiene efecto moderado en learning outcomes (g=0.58) y fuerte en motivación (g=0.82).
- [arXiv · Dynamic Personalization through Continuous Feedback Loops](https://arxiv.org/html/2602.23376): personalización dinámica mejora satisfacción del usuario 15-23% vs métodos estáticos.
- [ScienceDirect · AI-assisted feedback systematic review](https://www.sciencedirect.com/science/article/pii/S2666557325000436): feedback fluido que evoluciona con la sesión es más efectivo que feedback fijo.

**Cuatro mecanismos de variabilidad implementados en v0.3 del system prompt:**

| # | Mecanismo | Cómo opera | Requiere infraestructura |
|---|---|---|---|
| 1 | Anclaje al perfil del candidato | Mismo score, feedback distinto según área, años, rol, idioma, CV | No |
| 2 | Conexión entre preguntas | Claude mantiene memoria activa de respuestas previas EN la sesión y conecta cada 2-3 preguntas | No |
| 3 | Pool rotativo de ángulos pedagógicos | Cinco ángulos (reclutador, benchmark, mentor, accionable, evidencia); rota sin repetir consecutivamente | No |
| 4 | Frase modelo siempre específica al contenido | La frase modelo se construye del contenido literal de la respuesta, no de plantilla | No |

**Pendiente para v1.0:**

| # | Mecanismo | Por qué v1.0 |
|---|---|---|
| 5 | Persistencia entre sesiones | Requiere binding KV `SIMULATOR_USER_HISTORY` con resumen estructurado por user_hash. Permite comparaciones honestas tipo "en tu sesión 1 te costó X, hoy mejoraste Y" |
| 6 | Detección de fatiga y adaptación | Feature avanzada basada en [Hong 2025 sobre fatigue-based adaptive feedback](https://onlinelibrary.wiley.com/doi/10.1111/jcal.70133). Evaluamos cuando tengamos data de uso real |

---

### 1.3.1 · Estructura del reporte final descargable

El PDF descargable al cerrar la sesión incluye:

- Resumen de la sesión.
- Feedback consolidado por dimensión (técnico, estructura, especificidad, alertas) con scores 1-5.
- 3 acciones concretas a trabajar antes de la entrevista real.
- Si toca CTA libro según la lógica de 1.3: párrafo justificado por el feedback acumulado.
- Si NO toca CTA libro: recurso gratuito relevante al gap detectado.
- Línea final: *"Si quieres revisión gratuita de tu CV antes de aplicar, solcaciencia.com/revisar-cv"* (siempre presente, no compite con el CTA libro porque es servicio gratuito).

---

## 2 · Stack técnico real (corrección del doc original)

### 2.1 · Lo que ya existe en solcaciencia.com

- **Astro 5 SSR** sobre Cloudflare Workers (adapter `@astrojs/cloudflare`).
- **Cloudflare KV** bindings activos: `CV_LIMITS`, `EMAILS`, `CONTACTS`, `QUIZ_METRICS`, `CV_METRICS`. Patrón para rate-limit y métricas anónimas ya probado.
- **API endpoints serverless** en `src/pages/api/*.ts`: cv-review, cv-survey, cv-stats, cv-export, quiz-subscribe, quiz-stats, quiz-export, contact. Lleva el patrón de auth opcional vía `STATS_KEY` env var.
- **MailerLite** integrado para email transactional y nurture.
- **Hotmart** integrado para venta de libros con URLs vivas.
- **Frontend stack** Inter + Space Grotesk fonts, paleta navy + naranja, layouts compartidos (`BaseLayout.astro`, `BlogPostLayout.astro`).
- **PDF generation client-side** vía jsPDF (visible en `revisar-cv.astro`) — reusable para el reporte del simulador.

### 2.2 · Stack recomendado para el simulador (revisado)

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | **Astro page** `/simulador-entrevistas` + componente Astro/JS interactivo | Mismo BaseLayout, paleta consistente. |
| API | **Cloudflare Worker** vía `src/pages/api/simulator-*.ts` | Patrón ya establecido en cv-review. |
| LLM | **Claude Sonnet** via API de Anthropic | Helper `src/lib/anthropic.ts` ya existe. Reusar. |
| Voz | **Web Speech API** (Chrome/Edge desktop) | Tratar como progressive enhancement. Fallback texto siempre disponible. Detectar ausencia y ocultar botón de voz. |
| Auth | **Magic link via MailerLite** o **Google OAuth** | Evitar Supabase. NextAuth ya está en `solca_app 2`; portable. Magic link es más simple si solo necesitamos verificar identidad. |
| DB sesiones | **Cloudflare KV** para metadata + `sesiones_restantes` por user | Mismo patrón que CV_LIMITS. Si necesitamos historial completo de sesiones, agregar Cloudflare D1 (SQLite serverless). |
| Métricas anónimas | **Cloudflare KV** `SIMULATOR_METRICS` | Para análisis agregado tipo cv-stats. |
| Pagos | **Hotmart primero, Conekta después** | Hotmart cobra ~10% pero ya está integrado y maneja LATAM completo. Conekta solo cuando validemos demanda y queramos margen extra + OXXO directo. |
| PDF reporte | **jsPDF** client-side | Mismo patrón que reporte de revisar-cv. |

### 2.3 · Por qué evitar Supabase

- Una dependencia más que mantener, autenticar, backup, monitorear.
- Coste mensual base no-cero.
- Cloudflare KV cubre el caso (rate-limit + counter por user). Si más adelante necesitamos relaciones (sesión → preguntas → respuestas), Cloudflare D1 es serverless SQLite, gratuito en tier base, integrado en el mismo worker.
- Mantener stack consistente reduce la carga cognitiva en cada deploy.

### 2.4 · Procesador de pagos · decisión 12 jun 2026

**Conekta** (decisión final descartando Hotmart y Mercado Pago).

Razones:
- Comisión ~3.6% + $3 MXN/transacción tarjeta. Significativamente mejor margen que Hotmart (10%) o Mercado Pago (~3.99% + $4 MXN).
- Foco México alineado con la audiencia principal. Para usuarios LATAM no-México, tarjeta internacional Visa/MC funciona sin fricción.
- OXXO + SPEI directo (importante para usuarios sin tarjeta).
- API limpia, webhooks confiables. Migración a producción más rápida que MP.
- Soporte mexicano si surge issue.

**Trade-off aceptado:** alcance LATAM cross-border menos cómodo (usuarios argentinos/chilenos no tienen MP wallet familiar). Si después de validar la beta se ve que >30% son no-mexicanos, evaluamos sumar Mercado Pago como segunda opción de checkout.

**Flujo de integración:**
1. Crear SKU en Conekta para cada paquete (Básico $149, Intensivo $349, Pro $599).
2. Generar checkout link en el frontend al click "Comprar".
3. Webhook `order.paid` → endpoint del worker → KV escribe `simulator_credits:<email_hash>` con `sessions_remaining`, `package`, `expires_at`.
4. Frontend lee `simulator_credits` antes de cada sesión; si es 0, muestra paywall.

---

## 3 · Embudo conectado con las herramientas existentes

El simulador NO vive aislado — entra como tercer paso del embudo Solca:

```
            ┌──────────────────┐
            │   LinkedIn /     │
            │   Blog / SEO     │  ← descubrimiento
            └────────┬─────────┘
                     │
            ┌────────▼─────────┐
            │  /revisar-cv     │  ← gratuito, análisis CV
            │  (sin email obl) │     captura email opcional
            └────────┬─────────┘
                     │
            ┌────────▼─────────┐
            │   /quiz-rol      │  ← identifica rol pharma
            │  (suscripción    │     más probable
            │   MailerLite)    │
            └────────┬─────────┘
                     │
            ┌────────▼──────────────┐
            │ /simulador-entrevistas│  ← practica para entrevista
            │  Gratis: 1 sesión     │     con feedback Claude
            │  Pago: paquetes       │
            └────────┬──────────────┘
                     │
            ┌────────▼─────────┐
            │ Libros Hotmart   │  ← profundización
            │ (CTA contextual) │
            └──────────────────┘
```

### 3.1 · Continuidad de datos entre herramientas

- Si el usuario llegó al simulador después de hacer `/quiz-rol`, prellena el área y rol más probable. Cookie o param en URL (`?from=quiz&role=msl`).
- Si el reporte del simulador identifica gaps de CV (ej. "tu respuesta sobre experiencia de protocolos sería más fuerte si la mencionas en tu CV"), el final del reporte incluye CTA explícito: *"Pasa tu CV por /revisar-cv y aplica esto"*.

### 3.2 · El paquete gratuito sirve dos propósitos

1. **Lead magnet honesto** — sesión real de 5 preguntas, feedback útil, sin obligar email.
2. **Validador de calidad para el usuario** — antes de pagar $99 MXN, vio el feedback real una vez.

Email obligatorio solo si quiere el reporte descargable. Sin email = sesión completa pero sin PDF. Eso da fricción justa sin matar el lead magnet.

---

## 4 · Modelo de datos KV (sin Supabase)

### 4.1 · Bindings nuevos en `wrangler.jsonc`

```jsonc
{
  "binding": "SIMULATOR_CREDITS",
  "id": "<crear con: npx wrangler kv namespace create SIMULATOR_CREDITS>"
},
{
  "binding": "SIMULATOR_SESSIONS",
  "id": "<crear con: npx wrangler kv namespace create SIMULATOR_SESSIONS>"
},
{
  "binding": "SIMULATOR_METRICS",
  "id": "<crear con: npx wrangler kv namespace create SIMULATOR_METRICS>"
}
```

### 4.2 · Esquema de keys

**`SIMULATOR_CREDITS`** — un value por usuario:

```
key:    credits:<email_hash>
value:  { sessions_remaining: N, expires_at: ISO, package: "basico" | "intensivo" | "pro", purchased_at: ISO, hotmart_tx_id: string }
ttl:    expires_at + 1 día buffer
```

**`SIMULATOR_SESSIONS`** — historial por sesión (TTL 90 días):

```
key:    session:<session_uuid>
value:  { email_hash, started_at, finished_at, role, area, n_questions, questions[], answers[], feedback_summary, score }
ttl:    90 días
```

**`SIMULATOR_METRICS`** — agregados anónimos para análisis tipo cv-stats:

```
key:    s:<session_uuid>
value:  { ts, area, role, n_questions, exigencia, modo, avg_score_dimension }
```

(Mismo patrón que `CV_METRICS` actual — análogo a `cv-stats.ts` para reportes agregados.)

### 4.3 · Hashear emails para privacidad

Antes de usar el email como key, hash SHA-256 con un salt del worker. Eso permite contar usuarios únicos sin guardar email plano en KV. (Importante para LFPDPPP en MX y GDPR si llegan usuarios europeos.)

### 4.4 · Por qué no D1 desde el inicio

KV es suficiente para MVP. Si más adelante queremos: (a) consultas tipo "top 10 preguntas más reprobadas en MSL en abril", (b) historial completo por usuario, o (c) dashboard de admin — ahí migramos a D1. KV no acepta queries complejas.

---

## 5 · El prompt de Claude para preguntas y feedback

Esta es la parte más crítica del producto. Lo escribo en detalle porque define la calidad real del simulador.

### 5.1 · System prompt base

```
Eres un entrevistador senior de pharma LATAM con 15+ años en industria. Hoy estás
entrevistando a un candidato para el rol de {rol} en {empresa_si_la_hay}.

Tu trabajo es hacer preguntas realistas — del tipo que un Medical Affairs Lead, un
CRO Hiring Manager o un Director Médico realmente haría — y dar feedback honesto.

Reglas:
1. No usas emoji.
2. Defines cada acrónimo pharma (ICH-GCP, SOPs, TMF, KOL, MLR, etc.) la primera vez
   que lo usas. Tu candidato puede no conocer la jerga aún.
3. No inventas nombres específicos de personas, estudios clínicos, o papers. Si
   necesitas un ejemplo, usa fraseos genéricos ("un estudio fase III en oncología").
4. Tus preguntas son del nivel de exigencia: {moderado|exigente|muy_exigente}.
5. Mezcla técnicas {n_técnicas} y conductuales {n_conductuales} según el enfoque.
6. Cuando das feedback, evalúas en 4 dimensiones:
   - Contenido técnico (precisión, vocabulario pharma correcto)
   - Estructura (¿usó STAR u otro método? ¿la respuesta tiene principio-medio-fin?)
   - Especificidad (¿dio ejemplos concretos o se quedó en generalidades?)
   - Señales de alerta (contradicciones, evasión, falta de seguridad)
7. Tu feedback es directo. Si la respuesta fue floja, lo dices con cortesía pero
   sin suavizar. Si fue buena, lo dices sin inflar.
8. El perfil del candidato es: área {área}, experiencia {años}, especialidad
   {especialidad}.
```

### 5.2 · Frameworks de evaluación según rol

Cada rol pharma tiene su método propio. El prompt debe activar el framework correcto:

| Rol | Framework principal | Frameworks secundarios |
|---|---|---|
| **MSL** | Scientific Engagement (Engage → Inquire → Inform → Insight) | Diferenciación MSL vs visitador vs Medical Director |
| **CRA** | ICH-GCP compliance | SDV checklist mentality, Risk-Based Monitoring (RBM) |
| **Clinical Project Manager** | RACI + risk-based thinking | Stakeholder management, Critical Path Method |
| **Regulatory Affairs** | ICH common technical document | COFEPRIS/ANMAT/ANVISA submission flow |
| **Pharmacovigilance** | ICH E2A-E2F · case processing | Signal detection, periodic safety updates |
| **HEOR** | PICO framework + budget impact models | Real World Evidence, payer perspective |
| **Conductuales (todos)** | STAR (Situation, Task, Action, Result) | Behavioral anchors |

El prompt debe seleccionar framework según rol y evaluar la respuesta contra ese framework, no contra un genérico de "entrevista de trabajo".

### 5.3 · Banco de preguntas semilla (para no depender solo de generación libre)

El doc original asume generación 100% libre por Claude. Eso es OK para diversidad pero arriesga repetir patrones flojos. Mejor híbrido:

- **70% generación libre** por Claude basada en perfil y rol.
- **30% banco semilla** — 30-50 preguntas curadas por rol, mezcladas con las generadas para asegurar cobertura mínima.

Las semillas las podemos derivar de los 3 libros existentes y de las conversaciones reales de outreach. (Las preguntas "más repetidas en entrevistas pharma LATAM" son justamente uno de los temas de pool para futuros newsletters — generar el banco semilla es contenido reusable.)

### 5.4 · Ejemplo de pregunta semilla para MSL

```
Pregunta: Cuéntame un caso reciente donde un KOL te cuestionó la evidencia de un
producto en un congreso. ¿Cómo manejaste la conversación?

Evaluamos:
- ¿Definió KOL antes de continuar (si lo usó)? — vocabulario.
- ¿Mostró respeto científico al KOL sin defensividad? — actitud.
- ¿Trajo evidencia específica o se quedó en generalidades? — preparación.
- ¿Diferenció scientific exchange de promoción? — compliance.
- ¿Tomó nota del cuestionamiento como insight a llevar al equipo? — insight capture.

Bandera roja: Si responde "le presenté nuestro mejor estudio para convencerlo" —
eso es lenguaje de visitador, no de MSL. Feedback debe señalarlo.
```

---

## 6 · Modelo de negocio · ajustes propuestos

### 6.1 · Precios del doc original (revisados)

| Paquete | Precio doc | Mi ajuste | Razón |
|---|---|---|---|
| Gratis | 1 sesión 5 preguntas | 1 sesión 5 preguntas **Modo B**, sin reporte PDF | Doc OK. Sin email obligatorio. |
| Básico | $99-149 MXN · 3 sesiones | **$149 MXN · 3 sesiones, ambos modos, reporte PDF, válido 30 días** | Anclar más alto facilita upsell a Intensivo. |
| Intensivo | $299-349 MXN · 10 sesiones | **$349 MXN · 10 sesiones + historial accesible + 1 sesión bonus con voz extendida (15 min)** | Diferenciador real vs Básico. |
| Pro | $599 MXN · ilimitadas 30 días | **$599 MXN · ilimitadas 30 días + revisión de tu CV incluida ($150 valor)** | Bundle con servicio existente fortalece propuesta. |

### 6.1.1 · Personalización por CV (decisión 12 jun 2026)

- **CV-personalizado solo en planes pagos.** Plan gratuito sigue siendo Modo B con preguntas genéricas correctas (ya cumple su rol de lead magnet sin agotar el diferenciador del Básico).
- **Carta de presentación: skip en v0.1.** Se evalúa para v1 si los usuarios pagados la piden. En LATAM la cover letter es menos común que en USA — agregar el campo añade fricción sin beneficio garantizado.
- **Privacidad del CV:** el CV se procesa en una llamada inicial separada a Claude para extraer un resumen estructurado. El texto del CV completo NO se guarda en KV ni se reusa entre sesiones. El resumen estructurado tampoco se guarda con identificadores personales. Lo que SÍ se guarda en `SIMULATOR_METRICS` son métricas anónimas extraídas al cierre de la sesión: área de formación, años de experiencia, técnicas científicas mencionadas (citometría, qPCR), vocabulario pharma usado correctamente vs ausente, gaps detectados, scores por dimensión. Sin nombres, sin email, sin nombres de instituciones, sin contacto.
- **Uso de las métricas anónimas:** alimentan análisis de negocio (qué roles más se practican, qué área de formación más se mueve a pharma, qué preguntas reprueban más) y contenido del newsletter ("Lo que vemos en 100 sesiones del simulador: el 80% de los PhDs no menciona ICH-GCP en su CV").

### 6.2 · Bundle con libros

| Bundle | Componentes | Precio | Margen vs por separado |
|---|---|---|---|
| Bundle CRA | Libro 3 + Intensivo (10 sesiones) | ~$700 MXN | -10% vs comprar separado |
| Bundle MSL | Libro 2 + Intensivo (10 sesiones) | ~$700 MXN | -10% |
| Bundle PM | Libro 1 + Intensivo (10 sesiones) | ~$700 MXN | -10% |
| Bundle completo | 3 libros + Pro (ilimitadas) | ~$1500 MXN | -15% |

Hotmart soporta bundles vía "infoproducto agrupado".

### 6.3 · Captura de email (consistencia con resto del sitio)

El doc original dice "Captura de email antes del resultado". **Corrección:** alinear con `/revisar-cv` que NO obliga email.

- Sesión gratis: 5 preguntas, feedback completo en pantalla, **sin email obligatorio**.
- Opcional: *"¿Quieres el reporte por mail? Deja tu correo."* — si lo deja, va a MailerLite con grupo "Simulator-trial".
- Reporte PDF descargable solo desde el momento (no en mail) si no deja email.

Eso preserva el principio Solca de baja fricción + honestidad.

---

## 7 · Riesgos y gaps de UX que el doc no captura

### 7.1 · Web Speech API tiene cobertura desigual

Cobertura aproximada:
- **Chrome desktop**: ✅ funciona bien.
- **Edge desktop**: ✅ funciona bien.
- **Safari macOS**: ⚠️ funciona pero requiere permiso explícito por sesión.
- **Safari iOS**: ⚠️ limitado, calidad de transcripción peor.
- **Firefox**: ❌ no soporta sin polyfill (rara vez confiable).
- **Chrome Android**: ✅ funciona.

**Implicación:** la voz es progressive enhancement, no requisito. La UI detecta soporte y oculta el botón de voz si no está disponible. El simulador funciona 100% con texto. Esto es importante porque tu audiencia LATAM probablemente tiene mix de devices con Safari en proporción alta.

### 7.2 · Latencia de Claude API

Sonnet 4.5 con prompt de ~1000 tokens y respuesta de ~500 tokens toma típicamente 2-4 segundos. En una sesión de 10 preguntas con feedback eso son 20-40 segundos solo de espera de IA. UX:
- **Streaming de respuestas** (token-by-token) en lugar de esperar la respuesta completa.
- **Skeleton loaders** durante el think.
- **Pregunta siguiente pre-cacheada** mientras el usuario aún responde la actual (riesgo: si Claude depende del contexto previo, no aplica).

### 7.3 · Fabricación silenciosa

Riesgo grave: Claude inventa preguntas mencionando empresas reales que no las hacen así, o cita papers ficticios. Mitigaciones:
- Reglas explícitas en el system prompt (ya incluido arriba en 5.1).
- Validación post-generación: regex que detecta nombres de empresas reales en preguntas; si aparece, abstrae a "una farmacéutica multinacional".
- Banco semilla (sección 5.3) reduce dependencia 100% en generación libre.

### 7.4 · Calidad del feedback con respuestas vagas

Si el usuario responde *"sí, una vez hice eso"* en 4 palabras, Claude tiene poco material para evaluar. UX:
- Mensaje claro: *"Tu respuesta fue corta. ¿Quieres ampliarla antes de evaluarla? El feedback será mucho más útil con un ejemplo concreto."*
- Permitir retry de respuesta sin contar como pregunta gastada.

### 7.5 · Idioma mezclado

Pharma LATAM mezcla español con acrónimos en inglés (ICH-GCP, SOPs, TMF). Las respuestas del usuario probablemente vendrán en este "Spanglish". El prompt debe aceptarlo como normal, no penalizarlo. Lo que SÍ debe corregir: traducciones incorrectas (ej. "manejo de relaciones públicas con médicos" cuando quiere decir "scientific engagement con HCPs").

### 7.6 · Compliance LFPDPPP (México)

El simulador captura: emails (si los dan), respuestas grabadas/escritas, área y rol. Necesita:
- Aviso de privacidad ligado al existente en `/privacidad`.
- Borrar sesiones de KV después de 90 días (TTL).
- Opción de "borrar mis datos" por email vía `mailto:hello@solcaciencia.com` (ya documentado en /privacidad).
- No usar emails para spam — solo para los grupos MailerLite con doble opt-in.

### 7.7 · Honestidad sobre lo que el simulador no es

En el copy de la landing, declarar explícitamente:
- *"El simulador te entrena para una entrevista. No garantiza que la pasarás."*
- *"El feedback de IA es útil pero no sustituye la opinión de un humano en industria."*
- *"Las preguntas son generadas por IA basadas en patrones reales pero no provienen de empresas específicas."*

Esto inocula contra expectativas infladas y respeta la regla de honestidad de marca.

---

## 7.8 · Plan operativo de la beta cerrada (decisión 12 jun 2026)

**Tamaño:** 20-30 personas.

**Método de acceso:** código de invitación único por persona, validado contra KV.

### 7.8.1 · Criterios de selección

Para los 20-30 invitados, priorizar:

1. **Engagement previo demostrado:** han abierto `/revisar-cv`, completado `/quiz-rol`, comentado posts del newsletter, o respondido a outreach warm de LinkedIn.
2. **Diversidad de áreas de formación:** mezcla de PhD biología, biotecnólogos, QFBs, MDs, nutriólogos. Evitar concentración en un solo perfil.
3. **Diversidad de roles apuntados:** CRA, MSL, Clinical PM, Healthcare Analyst, Regulatory. Idealmente 4-6 por rol.
4. **Diversidad geográfica:** ~50% México + resto Argentina, Colombia, Chile, Brasil.
5. **Capacidad de feedback:** preferir gente que ya escribe en público (comments, posts) por encima de lurkers.

### 7.8.2 · Cómo seleccionar técnicamente

- Lista de MailerLite suscriptores activos últimos 60 días.
- Cruzar con quienes abrieron `/revisar-cv` con email opcional (los emails están en KV `EMAILS`).
- Cruzar con los 15 contactos warm de LinkedIn outreach mayo 2026 (`LINKEDIN_OUTREACH_2026Q2.xlsx`).
- Generar lista de ~40 candidatos.
- Invitar 30; esperar respuesta de 20-25.

### 7.8.3 · KV schema para la beta

```
SIMULATOR_BETA_CODES (binding nuevo)
  key:    beta:<code_8chars>
  value:  {
    nombre_pila: "Andrea",
    email_hash: "sha256(email)",
    max_sessions: 3,
    sessions_used: 0,
    granted_at: "2026-06-15T...",
    expires_at: "2026-07-31T23:59:59Z",
    cohort: "beta-1"
  }
  ttl: hasta expires_at + 30 días de buffer
```

### 7.8.4 · Flujo del usuario beta

1. Recibe email personal con código + URL.
2. Va a `solcaciencia.com/simulador-beta?codigo=XYZ12345`.
3. Frontend valida código contra KV. Si válido + sessions_used < max_sessions: muestra cuestionario inicial. Si inválido o agotado: muestra mensaje cerrado + lista de espera.
4. Completa sesión normal con CV-personalización activa.
5. Al cerrar: KV incrementa `sessions_used`. Envío opcional de email post-sesión pidiendo feedback (2 preguntas: ¿qué te sorprendió?, ¿qué pregunta fue más útil?).

### 7.8.5 · Costos estimados de la beta

- **Tokens API Anthropic:** 30 personas × 3 sesiones × ~5000 tokens promedio × $0.003/1k tokens output = ~$1.35 USD para los outputs + ~$0.50 USD inputs. **Total: ~$2-5 USD durante toda la beta.**
- **Soporte de Oscar:** 1-2 horas selección + 30 min envío de invitaciones + 2-3 horas atendiendo feedback durante 4 semanas.
- **Sin costo de pago/procesador** — la beta es gratuita para los invitados.

### 7.8.6 · Métricas a recoger durante la beta

- Sesiones completadas vs iniciadas (proxy de fricción de UX).
- Tiempo promedio por sesión.
- Distribución de roles practicados.
- Distribución de áreas de formación.
- Score promedio por dimensión (técnico, estructura, especificidad).
- Top 5 preguntas con peor score promedio (= preguntas que el banco debe explicar mejor o que generan confusión).
- Top 3 quejas de feedback recibido.
- Conversión declarada: "¿Pagarías $X por esto?" en formulario post-sesión.

### 7.8.7 · Criterios de salida de la beta

Cuando se cumplan estos tres, lanzamos versión comercial pública:

- ≥50 sesiones completadas con score promedio ≥3.5 en cada dimensión.
- 0 incidencias de fabricación detectadas (nombres inventados, citas falsas del CV).
- ≥60% de los beta declaran que pagarían algo por el producto.

Si alguno falla: iteración v0.2 → segunda beta antes de ir a producción.

---

## 7.9 · Idioma de la sesión · decisión 12 jun 2026

**Tres modos disponibles:** Inglés / Bilingüe / Español.

**Default inteligente según contexto:**

- Modo A con vacante que incluye términos *fluent*, *advanced*, *C1*, *English required*: default forzado **Inglés** (puede cambiarse con advertencia explícita).
- Modo A con empresa multinacional reconocida en pharma sin requisito explícito: default sugerido **Bilingüe**.
- Modo A con vacante claramente en español puro: default sugerido **Español**.
- Modo B sin vacante: el usuario elige las 3 opciones con descripción de cada una.

**Comportamiento del modo Bilingüe:**

El simulador **alterna idiomas por etapa simulando multistage interview**. Primera mitad de las preguntas en español (replicando screening con reclutador local). Segunda mitad en inglés (replicando ronda técnica con hiring manager regional o global). Antes de cambiar de idioma, el simulador anuncia explícitamente la transición.

Esta decisión está sustentada por evidencia externa documentada:

- [Near.com · 9 Lessons From Hiring in LatAm](https://www.hirewithnear.com/blog/9-lessons-learned-from-hiring-in-latin-america) — cita literal: *"When designing interview stages, companies should decide which language each stage should use, and if the role requires English interviews but the candidate applied in Spanish or Portuguese, this shift should be explained before the call rather than surprising them in the calendar invite."*
- [iSmartRecruit · Multilingual Interviews](https://www.ismartrecruit.com/blogs/interview-process/multilingual-interviews) — define *multilingual interview* como categoría formal de reclutamiento.
- [Glassdoor · Catalent Pharma Interview Experience](https://www.glassdoor.com/Interview/Catalent-Pharma-Interview-Questions-E43266.htm) — proceso típico pharma incluye screening + technical + group + panel; cada etapa puede ser en idioma distinto.

**Advertencia explícita cuando el usuario elige español pero el rol típicamente requiere inglés:**

Copy redactado con el dato verificable del dataset propio de Solca (19 de 30 vacantes en mayo 2026) + cita de fuente externa sobre multistage. Implementado en `SIMULADOR_PROMPT_V0.md` sección "Copy de UI para selección de idioma".

**Lo que NO se afirma (porque no tiene fuente verificable):**

- Estadísticas específicas tipo "X% de entrevistas pharma LATAM se conducen en inglés". Ese dato no existe en fuentes públicas.
- El formato "reclutador habla inglés / candidato responde mezcla". Práctica plausible pero no documentada en fuente externa. Conjetura descartada el 12 jun 2026 tras intento de validación.

## 7.10 · Regla nueva del proyecto · fuentes externas obligatorias

**Establecida 12 jun 2026 a raíz de este episodio.**

Toda afirmación sobre realidad del mercado, prácticas de reclutamiento, datos de industria, dinámica de entrevistas, comportamiento de usuarios o cualquier afirmación empírica que termine en un entregable de producto (system prompt, copy de UI, post de blog, newsletter, ad copy) debe llevar fuente externa verificable antes de quedar fijada en el archivo.

Si no se encuentra fuente:

- Reformular conservadoramente: *"la evidencia disponible sugiere…"* en lugar de *"la mayoría de…"*.
- O declarar abiertamente: *"no encontramos fuente concluyente sobre X"*.
- O eliminar el claim del entregable.

Aplica retroactivamente: cualquier claim previo en docs o copy del proyecto que no tenga fuente debe buscarse o suavizarse en la próxima revisión.

Esta regla está documentada también en `OSCAR_PROFILE.md` para que sobreviva a sesiones futuras.

---

## 7.11 · Aprendizaje de Fase 0.2 · simulación Modo A con CV Oscar (Consultor IQVIA · 12 jun 2026)

**Resultado del cuestionario A aplicado por Oscar:**

- P1 ¿Personalizado? Sí
- P2 ¿Conexión entre preguntas? Sí
- P3 ¿Frase modelo específica? Sí
- P4 ¿CTA específico y respetuoso? Sí
- P5 ¿Fabricación detectada? **Sí · tres ocurrencias del mismo patrón estructural**

**Las tres fabricaciones detectadas:**

1. Pregunta 2 (ángulo B): *"Eso te pone por encima del 80% de candidatos PhD para Consultor que llegan a IQVIA"* — 80% inventado.
2. Pregunta 9 (ángulo B): *"This is a top-quartile answer for the question. The vast majority of candidates either deflect"* — top-quartile y vast majority sin dataset.
3. Cierre de sesión: *"Pocas sesiones llegan a este nivel en primera ronda"* — el simulador no tiene sesiones aún.

**Diagnóstico:**

Las tres salieron del **ángulo pedagógico B · "Compárate con el promedio del rol"** definido en v0.3. Ese ángulo, por naturaleza, requiere data de promedios de sesiones reales que NO EXISTE hasta que tengamos beta con ≥50 sesiones. Su presencia en el pool rotativo obligaba al simulador a fabricar comparaciones estadísticas que suenan verdaderas pero son inventadas.

**Acción correctiva (v0.4):**

- Eliminado el ángulo B del pool rotativo. Quedan 4 ángulos (A, C, D, E).
- Agregada regla anti-fabricación-motivacional como categoría separada de la regla anti-fabricación-de-hechos. Lista explícita de frases prohibidas en `SIMULADOR_PROMPT_V0.md` sección "REGLA ANTI-FABRICACIÓN-MOTIVACIONAL".
- Agregada bandera roja v0.4 en `SIMULADOR_FEEDBACK_FRAMEWORK.md` para auditoría interna.
- Documentado el aprendizaje en `OSCAR_PROFILE.md` como sub-regla de la regla de fuentes externas.

**Reintroducción futura del ángulo B:**

Cuando tengamos ≥50 sesiones beta completadas con dataset propio del simulador, reintroducimos B con cifras verificables del dataset: *"Tu respuesta en compliance regulatorio fue más estructurada que el 60% de las sesiones de junio donde se midió este tema."* Eso sí es honesto porque viene del dataset propio. Mientras tanto, queda fuera.

**Validación de los otros mecanismos en la misma sesión:**

- Mecanismo 1 (anclaje al perfil): ✓ confirmado por Oscar.
- Mecanismo 2 (conexión entre preguntas): ✓ confirmado.
- Mecanismo 3 (pool rotativo): ✓ los 5 ángulos rotaron correctamente, pero el ángulo B mismo generó el problema.
- Mecanismo 4 (frase modelo específica): ✓ confirmado.

**Lo que NO falló:**

- Cero fabricación de nombres, papers, empresas, citas del CV.
- Frase modelo siempre específica al contenido del candidato.
- CTA contextual respetuoso (recurso gratuito, no libro, para básico sesión 1).
- Reporte JSON final y JSON de métricas anónimas bien estructurados.

---

## 7.16 · Framework de análisis de métricas (decisión 16 jun 2026)

Diseñado antes de implementar Fase 1.4 para evitar parchar después con datos mal estructurados.

### 7.16.1 · Tipos de variable por campo

Las 23 métricas (17 base + 6 derivadas / demográficos) se clasifican así:

- **Categóricas nominales (multivaluadas como array):** técnicas, vocabulario_que_uso_bien, vocabulario_ausente, gaps_detectados, preguntas_que_reprobaron. Requieren explosión a long format para agregación SQL.
- **Categóricas nominales (singulares):** área, país, rol, idioma, etapa, focus, género.
- **Categóricas ordinales:** años_experiencia, número_preguntas, rol_y_match, edad_rango, scores (1-5).
- **Cuantitativas continuas:** sesión_duración_total, respuesta_promedio.
- **Cuantitativas discretas:** alertas_count.
- **Temporal:** ts.

### 7.16.2 · KPIs principales agrupados en 5 categorías

1. **Uso del producto** · sesiones iniciadas/semana, tasa de completitud, duración promedio, distribución por etapa.
2. **Calidad del simulador** · distribución de scores, top 10 preguntas reprobadas, top 10 términos pharma ausentes, distribución rol_y_match.
3. **Editoriales (Solca Insight)** · *"X% no menciona ICH-GCP"*, áreas que más se mueven, gaps comunes por nivel.
4. **Conversión y negocio** · sesiones por usuario beta, % con CV personalizado, distribución de scores por etapa elegida.
5. **Demográficos** · distribución edad/género, match rol vs demografía.

### 7.16.3 · Stack técnico (decidido 16 jun 2026)

**Storage: Cloudflare D1 (SQLite serverless) desde el inicio.**

- Permite queries SQL reales sin migraciones futuras dolorosas.
- Gratis hasta 5GB y 5M reads/día (la beta nunca llega ahí).
- Binding nuevo: `SIMULATOR_METRICS_DB`.
- Schema y migrations versionadas en `migrations/`.

**Visualización: dashboard interno con Chart.js desde MVP.**

- Página `/admin/simulator-metrics?key=<STATS_KEY>` protegida con auth.
- Carga datos del endpoint y renderiza KPIs en tiempo real.
- Mismo patrón que `/api/cv-stats` actual pero con UI.

**Automatización: cron semanal por email.**

- Cloudflare Cron Triggers cada lunes a las 8 AM CDMX.
- Endpoint cron que ejecuta queries de la semana anterior y envía resumen por email a `hello@solcaciencia.com` vía MailerLite transactional API.

### 7.16.4 · Schema SQL inicial de la tabla `sessions` (D1)

\`\`\`sql
CREATE TABLE sessions (
  -- Identidad
  session_id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,  -- unix epoch ms

  -- Perfil
  area_formacion TEXT NOT NULL,
  anios_experiencia TEXT NOT NULL,
  pais_inferido TEXT,
  rol_apuntado TEXT NOT NULL,

  -- Configuración
  idioma TEXT NOT NULL,
  etapa TEXT NOT NULL,
  numero_preguntas INTEGER NOT NULL,
  focus TEXT NOT NULL,

  -- Tiempos
  sesion_duracion_total_seg INTEGER,
  respuesta_promedio_seg INTEGER,

  -- Scores
  score_tecnico REAL,
  score_estructura REAL,
  score_especificidad REAL,
  alertas_count INTEGER,
  rol_y_match TEXT,

  -- Estado de la sesión
  completed INTEGER NOT NULL DEFAULT 0,  -- 0 = abandonada, 1 = completada
  has_cv_summary INTEGER NOT NULL DEFAULT 0,

  -- Demográficos opcionales (post-sesión)
  edad_rango TEXT,
  genero TEXT,
  demographics_submitted_at INTEGER
);

-- Tabla auxiliar para arrays multivaluados (técnicas, vocabulario, gaps)
CREATE TABLE session_tags (
  session_id TEXT NOT NULL,
  tag_type TEXT NOT NULL,  -- 'tecnica' | 'vocab_uso_bien' | 'vocab_ausente' | 'gap' | 'pregunta_reprobada'
  tag_value TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE INDEX idx_sessions_ts ON sessions(ts);
CREATE INDEX idx_sessions_rol ON sessions(rol_apuntado);
CREATE INDEX idx_sessions_area ON sessions(area_formacion);
CREATE INDEX idx_session_tags_lookup ON session_tags(session_id, tag_type);
CREATE INDEX idx_session_tags_value ON session_tags(tag_type, tag_value);
\`\`\`

Schema normalizado (sessions + session_tags) permite queries tipo:

\`\`\`sql
-- Top 10 términos pharma ausentes en sesiones de junio
SELECT tag_value, COUNT(*) as n
FROM session_tags
WHERE tag_type = 'vocab_ausente'
  AND session_id IN (SELECT session_id FROM sessions WHERE ts > 1719792000000)
GROUP BY tag_value
ORDER BY n DESC LIMIT 10;
\`\`\`

### 7.16.5 · Frecuencia de análisis

- **Por sesión:** automático (sistema guarda).
- **Semanal (15 min):** revisión KPIs de uso vía dashboard interno o cron email.
- **Mensual (1 hora):** generar 1 archivo `_docs/SIMULADOR_INSIGHTS_2026_MM.md` con KPIs + insights candidatos a newsletter.
- **Trimestral (2-3 horas):** análisis profundo, ajustes al banco semilla, decisiones de producto.

---

## 7.15 · Métricas anónimas guardadas en SIMULATOR_METRICS (decisión 16 jun 2026)

**Las 17 métricas por sesión completada:**

### Identidad de la sesión (sin identificadores personales)
- `ts` · timestamp ISO

### Perfil profesional anónimo
- `area_formacion` · QFB, Biólogo, PhD biomedicina, etc.
- `anios_experiencia` · "sin_experiencia" / "1-3" / "4-10" / "+10"
- `pais_inferido` · México / Colombia / Chile / Argentina / Brasil / Perú / Otro
- `rol_apuntado` · CRA / MSL / Clinical_PM / Healthcare_Analyst / Regulatory / PV / Otro

### Configuración elegida por el usuario
- `idioma` · español / bilingüe / inglés
- `etapa` · phone_screen / technical_round / panel_round / general_practice
- `numero_preguntas` · 5 / 10 / 15
- `focus` · técnico / conductual / mezcla

### Tiempos
- `sesion_duracion_total_seg` · tiempo total desde inicio hasta cierre
- `respuesta_promedio_seg` · promedio del tiempo por respuesta

### Vocabulario y desempeño
- `tecnicas_academicas_mencionadas` · array (sin marcas comerciales)
- `vocabulario_pharma_que_uso_bien` · array (ICH-GCP, SOPs, TMF, SDV, etc.)
- `vocabulario_pharma_ausente` · array (críticos para el rol que NO usó)
- `gaps_detectados` · array codificado (ej. `sin_experiencia_industria`)

### Scores y match
- `score_promedio_por_dimension` · {técnico, estructura, especificidad} en 1-5
- `alertas_count` · número total
- `rol_y_match` · "alto" / "medio" / "bajo"
- `preguntas_que_reprobaron` · array de categorías con score 1-2

### Demográficos opcionales (post-sesión · decisión 16 jun 2026)
- `edad_rango` · "18-24" / "25-34" / "35-44" / "45-54" / "55+" / "prefer_not_to_say" / null
- `genero` · "mujer" / "hombre" / "no_binario_otro" / "prefer_not_to_say" / null

**Captura de demográficos: post-feedback, no en cuestionario inicial.** Razón:
- Menos fricción al inicio · más conversión.
- Después del feedback el usuario ya obtuvo valor y está más dispuesto a colaborar.
- Cumple LFPDPPP México (opcionales, anónimos, consentimiento explícito).

**Protecciones aplicadas (no negociables):**

1. Sin identificadores personales (nombre, email, teléfono, dirección).
2. Sin nombres específicos de instituciones (empresas, universidades, hospitales).
3. Demográficos siempre opcionales con "prefiero no decir".
4. Aviso explícito antes de la micro-encuesta: *"Estos datos son opcionales y anónimos. Se guardan agregados (no asociados a ti como persona) para entender mejor a quién atiende el simulador. Puedes saltarte cualquiera."*
5. Edad por rango, nunca exacta.
6. Actualizar `/privacidad` con párrafo específico sobre recolección anónima del simulador (pendiente en Fase 1.4).

**Para qué se usan estas métricas:**

1. **Análisis de producto** · qué roles más se practican, qué etapas más se eligen, dónde tarda más la gente.
2. **Iteración del banco semilla** · qué preguntas tienen scores más bajos, qué vocabulario falta más.
3. **Contenido editorial Solca Insight** · *"Lo que vemos en N sesiones del simulador: el X% de los PhDs no menciona ICH-GCP"*. Ángulo natural del newsletter.

---

## 7.14 · Feedback diferido + reporte expandido + PDF universal (decisión 16 jun 2026 · v0.7)

### 7.14.1 · Feedback diferido al cierre, no inmediato por pregunta

**Cambio:** Claude ya NO da feedback explícito después de cada respuesta. Solo una transición breve opcional (*"Entendido"*, *"Pasamos a la siguiente"*) y avanza a la siguiente pregunta. La evaluación detallada se entrega consolidada al final.

**Razones:**

- **Evidencia académica sobre transferencia de conocimiento.** [ScienceDirect · Delaying Feedback Promotes Transfer of Knowledge](https://www.sciencedirect.com/science/article/abs/pii/S2211368114000448) reporta: *"Delaying feedback on homework assignments enhanced the long-term retention and transfer of learning... despite student preferences to receive feedback immediately."*
- **Procesamiento más profundo.** [ResearchGate · Immediate vs Delayed Feedback](https://www.researchgate.net/publication/373114533_Immediate_Versus_Delayed_Feedback_on_Learning_Do_People's_Instincts_Really_Conflict_with_Reality) explica: *"Delayed feedback allows for deeper processing of the material and fosters more robust memory consolidation."*
- **Igualdad de efectividad confirmada en testing formativo.** [Wiley · Medical Education 2024 · Timing's Not Everything](https://asmepublications.onlinelibrary.wiley.com/doi/full/10.1111/medu.15287): inmediato y diferido son equivalentes en performance; la decisión por diferido se sustenta entonces en la analogía con la entrevista real.
- **Paralelismo con entrevista real.** Una entrevista pharma real no da feedback intermedio. Practicar con feedback diferido entrena para la situación real y evita contaminación entre preguntas.

**Lo que sigue activo durante la sesión:**

- Mecanismo 2 · conexión entre preguntas: Claude puede mencionar respuestas previas para hacer adaptive de contenido sin dar feedback evaluativo.
- Mecanismo 1 · anclaje al perfil.
- Mecanismo 3 · pool rotativo de ángulos (se aplica al reporte final, no a turnos intermedios).
- Mecanismo 4 · frase modelo específica al contenido (se aplica por pregunta dentro del breakdown final).

### 7.14.2 · Reporte final expandido (summary + questions_breakdown)

**Cambio:** El `FinalReport` ahora tiene dos secciones principales en lugar de una.

| Sección | Contenido | UI |
|---|---|---|
| `summary` | Scores agregados (promedio), top 3 fortalezas, top 3 áreas de mejora, vocabulario a incorporar, recomendación final | Visible inmediato al cierre |
| `questions_breakdown` | Array con una entrada por cada pregunta: texto, cita textual de la respuesta, scores 1-5, ángulo usado, qué funcionó, qué mejorar, frase modelo | Expandible debajo del summary |
| `cta` | Tipo (libro o recurso gratuito), título, descripción, URL | Al final del reporte |

**Implementación:** `FinalReport` y los sub-tipos en `simulator-types.ts` (`FinalReportSummary`, `QuestionBreakdown`, `FinalReportCTA`).

### 7.14.3 · PDF descargable en todos los planes (gratis incluido)

**Cambio:** El PDF de descarga estará disponible en TODOS los planes, no solo en pagos.

**Razones:**

- **Estándar de la industria.** [Interview Trainer AI](https://www.interviewtrainerai.com/) y [FreeMockInterview](https://freemockinterview.com/) ofrecen PDF descargable incluso en planes gratuitos.
- **El valor diferencial pago NO está en el PDF.** Está en (1) más sesiones por paquete, (2) CV-personalizado, (3) ilimitadas del Pro, (4) cross-sell con libros relevantes.
- **El PDF gratis refuerza el lead magnet.** Un PDF profesional de calidad hace que el usuario quiera pagar para más sesiones, en lugar de bloquearlo en el momento de mayor valor percibido.

**Implementación:** Fase 1.4 generará el PDF client-side con jsPDF (mismo patrón que `/revisar-cv`).

### 7.14.4 · UI durante la sesión · solo progreso + timer

**Cambio:** Durante la sesión el usuario ve solo:

- Texto de la pregunta actual
- Timer informativo (no corta) según tipo de pregunta
- Indicador de progreso (*"Pregunta 3 de 10"*) + barra visual

**No ve:** scores, feedback parcial, indicadores de desempeño. Esto preserva la promesa de feedback diferido y mantiene el flow conversacional.

---

## 7.13 · Etapa de entrevista + adaptive de contenido (decisión 16 jun 2026 · v0.6)

### 7.13.1 · Pregunta por etapa, no por número

**Cambio:** el cuestionario inicial pregunta qué etapa de entrevista quiere practicar el usuario. El número de preguntas (5/10/15) se infiere automáticamente. Más claro para usuarios sin contexto pharma.

**Mapeo de etapa a número** (función `getStageInfo()` en `simulator-defaults.ts`):

| Etapa | Preguntas | Duración real | Duración simulador |
|---|---|---|---|
| Phone screen (llamada con reclutador) | 5 | 15-30 min | ~20 min |
| Ronda técnica (con hiring manager) | 10 | 45-60 min | ~40 min |
| Panel completo (final round) | 15 | 60-90 min | ~60 min |
| Práctica general (sin fecha) | 10 (default) | 45-60 min | ~40 min |

**Fuentes externas que sustentan los rangos:**

- [Indeed · Phone Screen Interview Best Practices](https://www.indeed.com/hire/c/info/interview-screening-phone-calls) — *"Screening interviews are usually short (15–30 minutes) and may be conducted by phone or video... A 30-minute phone interview typically falls into five categories: a quick background walkthrough, 'why this role' motivation, two or three behavioral examples, salary and timeline alignment, and the candidate's own questions."*
- [Goldbeck Recruiting · Job Interview Process Structure](https://goldbeck.com/blog/the-job-interview-process-structure-stages-and-best-practices/) — estructura típica de stages: phone screen → in-person interview → panel.
- [Frontline Source Group · 30-Minute Phone Interview Questions](https://www.frontlinesourcegroup.com/blog-30-minute-phone-interview-questions.html) — 5-7 preguntas en screening como rango estándar.

### 7.13.2 · Adaptive de contenido (nivel B)

**Cambio:** el system prompt v0.6 extiende el Mecanismo 2 (conexión entre preguntas) con adaptive de contenido. Claude prioriza gaps detectados en respuestas previas al elegir el contenido específico de la siguiente pregunta. **El mix general se mantiene** (lo definió el enfoque elegido por el usuario); solo el contenido específico se adapta.

**Ejemplo:**

- Mix elegido: "mezcla" (40% técnicas + 40% conductuales + 20% situacionales).
- Próxima pregunta del mix: técnica.
- En la pregunta 3 el candidato no mencionó ICH-GCP cuando aplicaba.
- La próxima técnica (pregunta 5) se enfoca específicamente en ICH-GCP en lugar de RBM o TMF.
- El mix sigue siendo mezcla; solo el contenido de la técnica se adaptó.

**Lo que NO hace el adaptive de contenido (límites):**

- No cambia la dificultad del nivel inicial (eso es nivel C de adaptive, requiere data beta para calibrar).
- No cambia el idioma de la sesión (controlado por la variable idioma).
- No reduce el número total de preguntas (controlado por la etapa).
- No salta preguntas si el candidato responde muy bien.

**Fuentes externas que sustentan adaptive:**

- [Dobr.AI · Real-Time Adaptive Questioning in Technical Interviews](https://blog.dobr.ai/2025/06/11/real-time-adaptive-questioning-in-technical-interviews/) — *"AI-powered adaptive interviews dynamically adjust the complexity, focus, and flow of interview questions based on each candidate's live performance."*
- [Acedit · AI Interview Simulations · How Adaptive Questions Work](https://www.acedit.ai/blog/ai-interview-simulations-how-adaptive-questions-work) — *"Adaptive interviewing offers more engaging conversations by matching each candidate's skill curve and minimizing fatigue from misaligned questions."*

**Reincorporación futura del nivel C (adaptive de dificultad):**

Cuando tengamos ≥50 sesiones beta con dataset propio de scores por dimensión, evaluamos agregar adaptive de dificultad. Mientras tanto, riesgo de "castigar" al usuario o reducir agency justifica posponerlo.

---

## 7.12 · UX de calibración y timing (decisión 16 jun 2026 · v0.5)

**Tres decisiones tomadas con evidencia externa:**

### 7.12.1 · Default inteligente para nivel de exigencia

El frontend aplica defaults inteligentes basados en lo que el usuario ya contestó en el cuestionario inicial. El usuario puede cambiar libremente, pero ve el default preseleccionado con label *"recomendado para tu perfil"*.

Tabla de mapeo implementada en `SIMULADOR_PROMPT_V0.md` sección "DEFAULTS INTELIGENTES POR PERFIL".

Razones:

- [Cliniversity · Pharma Interview Questions for Freshers](https://www.cliniversity.com/how-to-prepare-for-pharma-job-interviews-qa-tips/) reporta que reclutadores entry-level en clinical research evalúan workflows reales y decision-making práctico — los candidatos entry-level típicamente no tienen contexto para calibrar el nivel adecuado por sí mismos.
- [PharmaEduCenter · Get Into Clinical Research](https://pharmaeducenter.com/blog/how-to-land-entry-level-clinical-research-jobs/) confirma que entry-level mock interviews requieren guidance personalizada.
- Quitar la carga cognitiva al usuario entry-level reduce fricción inicial — factor crítico para conversión free → pago.

### 7.12.2 · Tiempo de respuesta diferenciado por tipo de pregunta

| Tipo | Preparación | Respuesta | Fuente |
|---|---|---|---|
| Conductual (STAR) | 20-30 seg | 90-120 seg | [The Interview Guys · STAR Method](https://blog.theinterviewguys.com/the-star-method/), [Indeed](https://www.indeed.com/career-advice/interviewing/how-to-use-the-star-interview-response-technique) |
| Técnica | 30-45 seg | 2-3 min | [Teal AI Interview Practice](https://www.tealhq.com/tools/ai-interview-practice) |
| Situacional / caso | 45-60 seg | 2.5-3 min | Razón analítica + Teal |
| General (CV, motivación) | 20-30 seg | 90 seg | [Indeed](https://www.indeed.com/career-advice/interviewing/how-to-use-the-star-interview-response-technique), [OphyAI](https://ophyai.com/blog/interview-tips/star-method-examples-behavioral-interviews) |

Cita literal de [Indeed](https://www.indeed.com/career-advice/interviewing/how-to-use-the-star-interview-response-technique): *"Interviewers start losing focus after 90 seconds."*

Cita literal de [The Interview Guys](https://blog.theinterviewguys.com/the-star-method/): *"A well-structured STAR answer should take 60 to 90 seconds when spoken aloud, and no more than 2 minutes at the absolute maximum."*

### 7.12.3 · Timer siempre informativo (nunca corta)

Decisión de Oscar: timer informativo en los tres niveles de exigencia. El simulador NO corta automáticamente la respuesta del candidato.

Mitigación del riesgo de "hábito malo" (candidato divaga sin penalty): cuando la respuesta excede significativamente el rango sugerido (>50% sobre el máximo), Claude incluye en el feedback una dimensión adicional educativa sobre uso del tiempo:

> *"Tu respuesta tomó 3 min 40 seg. La evidencia es que reclutadores pierden foco después de 90 segundos en conductuales. Trabaja compresión para tu entrevista real."*

En "Muy exigente", el feedback evalúa explícitamente el tiempo como dimensión con rigor mayor + indicador visual de proximidad al límite (cambio de color últimos 30 segundos).

Combina UX amable (no cortar, no estresar) con educación honesta (señalar el hábito correcto basado en evidencia).

### 7.12.4 · Voice input · ya definido en sección 7.1

Confirmación de la decisión existente:

- Web Speech API como progressive enhancement, no requisito.
- Detección automática de soporte del browser: si no soporta, oculta el botón de voz.
- Fallback texto siempre disponible.
- Paso de revisión del transcript antes de enviar.
- Cobertura: Chrome y Edge desktop ✓; Safari macOS ⚠ permiso por sesión; Safari iOS ⚠ calidad limitada; Firefox ❌ sin soporte nativo confiable; Chrome Android ✓.
- Para v1.0: evaluamos Whisper API si la voz se vuelve diferenciador medido en la beta.

Sin cambios pendientes en esta dimensión.

---

## 8 · Roadmap revisado (más realista)

El doc original propone 3 fases sin tiempo. Te doy tiempos estimados realistas dado que cada feature toca el stack actual:

### Fase 0 · Banco semilla y system prompt (~1 semana)

- Curar 30-50 preguntas semilla por cada rol principal (MSL, CRA, PM, Regulatory, PV, HEOR).
- Escribir y validar el system prompt con 5 sesiones de prueba (yo te ayudo a escribir y tú validas).
- Definir bandas de scoring por dimensión (1-5 con ancla en cada banda).

### Fase 1 · MVP funcional (~2-3 semanas)

- Ruta `/simulador-entrevistas` en Astro con UI completa.
- Componente del cuestionario de inicio (Modo A / Modo B).
- API endpoint `simulator-session` que llama a Claude vía `lib/anthropic.ts`.
- Web Speech API con fallback texto.
- KV bindings nuevos + endpoint de rate-limit (1 sesión gratis por email/IP).
- Reporte PDF client-side vía jsPDF.
- Sin pagos aún — todo gratuito mientras validamos calidad.

### Fase 2 · Pagos y cuentas (~1-2 semanas)

- Login magic-link via MailerLite (o Google OAuth si preferimos).
- Hotmart SKU para cada paquete.
- Webhook Hotmart → endpoint que escribe `simulator_credits:<email_hash>` en KV.
- UI de "mis sesiones restantes" + paywall cuando llega a 0.
- Bundle con libros configurado en Hotmart.

### Fase 3 · Métricas y mejora continua (~ongoing)

- Endpoint `simulator-stats?key=...` análogo a `cv-stats`.
- Dashboard interno básico (HTML simple sirve).
- Banco semilla iterado con feedback real.
- Insights del dashboard alimentan contenido del newsletter (qué roles más demandan, qué preguntas tienen peor score promedio).

### Fase 4 · Crecimiento (~después de 50 ventas)

- Migración opcional a Conekta para subir margen.
- Análisis de video como feature premium (~$$ separado, si demanda lo justifica).
- Sesiones de coaching humano post-simulador como upsell (tú o aliados).

---

## 9 · Decisión técnica pendiente (te toca a ti)

Hay 2 decisiones de arquitectura que prefiero validar contigo antes de tocar código:

| Decisión | Opción A | Opción B | Mi recomendación |
|---|---|---|---|
| **Auth** | Magic link MailerLite (más simple, sin password) | Google OAuth (más rápido login, requiere setup OAuth) | A si validamos demanda con MVP gratis; B si vamos directo a pagos. |
| **Pagos** | Hotmart desde día 1 (10% comisión, integrado) | Conekta desde día 1 (3-4% comisión, setup técnico) | A. Iteramos a B cuando tengamos data. |
| **DB** | KV solo (suficiente para MVP) | KV + D1 para historial complejo | A. D1 cuando necesitemos queries reales. |
| **Voz** | Solo Web Speech API (gratis, limitada) | Whisper API (costo extra, mejor calidad) | A en Fase 1. B en Fase 3 si validamos demanda. |

---

## 10 · Lo que sigue (concreto)

Si decides arrancar este proyecto:

1. **Revisa este addendum** y dime qué partes apruebas y qué partes quieres modificar.
2. **Decisiones de arquitectura** (sección 9) — me das tu pick en cada una.
3. **Banco semilla** — yo te ayudo a curar las primeras 30 preguntas para el rol con más demanda (probablemente CRA, según el dataset de vacantes mayo 2026).
4. **System prompt v0** — lo escribo en un día, lo validamos juntos con 3-5 sesiones de prueba.
5. **MVP en Astro** — yo lo construyo en `src/pages/simulador-entrevistas.astro` + `src/pages/api/simulator-session.ts` siguiendo el patrón de `/revisar-cv`.

Antes de empezar, mi recomendación operativa: **espera a que el blog (lanzado 25 may 2026) tenga 4-6 semanas de tracción** para tomar decisiones de paywall basadas en tráfico orgánico real. Mientras tanto, podemos preparar Fase 0 (banco semilla + system prompt) sin tocar producción.

— Addendum escrito por Claude para el proyecto solcaciencia.com · 25 may 2026

---

## 11 · Cierre de Fase 1.4 · entregables e implementación (19 jun 2026)

Esta sección consolida lo que efectivamente se construyó y deployó en Fase 1.4, lista de cambios concretos al código y al producto. Sirve como ancla de contexto para sesiones futuras.

### 11.1 · Inventario de entregables cerrados

| Sub-tarea | Entregable | Ubicación |
|---|---|---|
| 1.4.A | Migración D1 con schema `sessions` + `session_tags` aplicada en producción | `migrations/0001_simulator_metrics.sql` · database_id `a72d6780-de9c-4cc0-b8da-368fdc0bc932` |
| 1.4.B | Endpoint `/api/simulator-metrics` + writer compartido + integración al cierre de sesión | `src/pages/api/simulator-metrics.ts`, `src/lib/simulator-metrics-writer.ts`, `src/pages/api/simulator-session.ts:400` |
| 1.4.C | PDF descargable client-side con jsPDF, disponible en TODOS los planes (per §7.14.3) | `src/pages/simulador-entrevistas-beta/sesion.astro` · función `generateSimulatorPdf` |
| 1.4.D | Dashboard interno `/admin/simulator-metrics` con Chart.js y endpoint agregador | `src/pages/admin/simulator-metrics.astro`, `src/pages/api/simulator-stats.ts` |
| 1.4.E | Cron Trigger semanal lunes 14:00 UTC + endpoint del digest + patch post-build del worker | `src/pages/api/simulator-weekly-cron.ts`, `scripts/patch-cron-handler.mjs`, `wrangler.jsonc triggers.crons` |
| 1.4.F | Sección 6 nueva en `/privacidad` dedicada al Simulador (renumeradas 7-11) | `src/pages/privacidad.astro` |
| 1.4.G.1 | Select de área con 5 optgroup + 8 áreas nuevas (matemáticas, computacionales, admin) | `src/pages/simulador-entrevistas-beta/sesion.astro` |
| 1.4.G.2 | Nota "texto editable" debajo del textarea de respuesta | mismo `sesion.astro` |
| 1.4.G.3 | CTA override por desempeño bajo → `/revisar-cv` gratuito (no curso pagado) | `src/lib/simulator-prompt.ts` función `ctaInstructions` |
| 1.4.G.4 | `max_tokens` dinámico para el reporte final + warning si `stop_reason='max_tokens'` | `src/pages/api/simulator-session.ts` función `finalReportMaxTokens` |
| 1.4.G.5 | Regla explícita de turnos: eliminar meta-conversación (saludo separado, confirmación CV, "¿amplías?") | `src/lib/simulator-prompt.ts` |

### 11.2 · Audiencia oficial · expansión a 5 grupos (revisa §1.1)

La audiencia oficial del 25 may 2026 quedó *"profesionales en ciencias biológicas y afines"*. El 19 jun 2026 se amplió formalmente a 5 grupos para reflejar la realidad del producto:

1. Ciencias biomédicas y biológicas (PhD biomedicina, biólogos, biotecnólogos, posdocs).
2. Ciencias químico-farmacéuticas (QFB, QFI, farmacéutico clínico).
3. Ciencias clínicas y de la salud (médicos, enfermeros, nutriólogos, veterinarios).
4. **Ciencias matemáticas, computacionales y de datos** (estadística/bioestadística, matemáticas aplicadas, computación/data science, actuaría). **NUEVO**.
5. **Ciencias administrativas, económicas y de gestión** (MBA, economía, marketing, salud pública). **NUEVO**.

Más "Otro · escribir" como opción suelta. Pendiente para iteración posterior: mapear las 8 áreas nuevas a roles probables en el system prompt (hoy Claude razona desde el label sin tabla explícita, lo cual es suficiente pero no óptimo).

### 11.3 · CTA override por desempeño bajo · decisión 19 jun 2026

Cuando los scores promedio están en ≤2.5 en al menos 2 de las 3 dimensiones (técnico, estructura, especificidad), O cuando los gaps detectados incluyen *"respuestas no usan STAR"*, *"respuestas demasiado breves"* o *"fabricación o evasión"*, el CTA del reporte NO sigue la regla por plan (libro contextual al rol). Se reemplaza por la revisión gratuita de CV:

```json
{
  "type": "recurso_gratuito",
  "title": "Antes de tu entrevista: revisión gratuita de CV",
  "url": "https://solcaciencia.com/revisar-cv"
}
```

Razón documentada: vender un producto pagado después de una "derrota" rompe con la sobriedad de marca (§1.2) y con el principio §1.3 de "recurso gratuito relevante al gap detectado". Cuando exista un post free dedicado a STAR + manejo de preguntas pharma (task 1.5+), reemplazar este URL.

### 11.4 · Regla de turnos · evita meta-conversación

Aprendizaje 19 jun 2026 tras prueba real con sesión Healthcare Consultant: Claude estaba consumiendo turnos del presupuesto de N preguntas haciendo confirmaciones ("¿confirmas que eres X?") y follow-ups ("¿quieres ampliar tu respuesta?"). Una sesión de 10q tenía solo 6-7 preguntas evaluables reales.

Fix en `simulator-prompt.ts` con tres reglas no-negociables:

1. Cada respuesta de Claude cuenta como una pregunta del presupuesto, ni más ni menos.
2. La primera respuesta debe contener saludo + (si CV) confirmación inline + pregunta 1, en un solo mensaje. No esperar respuesta del candidato antes de pregunta 1.
3. Si la respuesta del candidato fue floja o corta, Claude la registra en `whatToImprove` del breakdown final y avanza. El frontend tiene su propio mecanismo de retry pre-envío (per §7.4, aún por implementar como UX explícita).

### 11.5 · max_tokens dinámico (decisión 19 jun 2026 tras truncamiento real)

Sesión real de 10 preguntas resultó en JSON truncado (solo 7 de 10 breakdowns, cta cortado a la mitad), el parser falló y el PDF salió con scores en 0.0 y la recomendación con el JSON crudo dentro. Causa: `MAX_TOKENS_FINAL_REPORT=4000` estático insuficiente.

Fórmula nueva: `BASE 3000 + 600 por pregunta · cap 16000`. Para 5q=6000, 10q=9000, 15q=12000. Cabe holgadamente dentro de los 64K de output de Sonnet 4.6.

Adicionalmente se loguea `console.warn` cuando `response.stop_reason === 'max_tokens'` con contexto (questionCount, tokens reales, prefijo/sufijo del texto). Visible en `wrangler tail` para diagnóstico antes de que un usuario reporte un PDF roto.

### 11.6 · Cron semanal · arquitectura y rationale

**Decisión**: el digest semanal NO se envía por email (todavía). Se persiste en KV `SIMULATOR_METRICS` con clave `digest:YYYY-WNN`, TTL 365 días. Razón: enviar email requiere MailerLite Transactional (rebranded MailerSend), un producto separado con API distinta que no está configurado. El valor del cron está en tener la foto semanal consolidada y auditable.

Para consultar el último digest: `GET /api/simulator-weekly-cron?key=<STATS_KEY>&show=latest`.

Cuando se configure MailerSend (u otro sender), agregar envío de email en el endpoint (TODO marcado en el código).

**Mecanismo técnico**: el adapter de Astro Cloudflare solo expone `fetch`. Para soportar Cloudflare Cron Triggers (eventos `scheduled`) se usa un patch post-build (`scripts/patch-cron-handler.mjs`) que inyecta un wrapper en `dist/_worker.js/index.js` exponiendo ambos handlers. El patch es idempotente (marker `/* SOLCA_CRON_PATCH_v2 */`) y se ejecuta automáticamente desde `npm run build` antes de `wrangler deploy`. Headers `Content-Type: application/json` + `Origin: https://solcaciencia.com` evitan el CSRF check de Astro 5 en la llamada interna.

### 11.7 · Privacidad · ajustes documentados en /privacidad

Nueva sección 6 "Simulador de Entrevistas con IA" cubre:
- Respuestas efímeras (no se guarda texto literal).
- CV efímero en CV-personalizada (resumen estructurado anónimo, texto completo no se reusa).
- Las 17 métricas anónimas agregables con lista explícita.
- Demográficos siempre opcionales con "prefiero no decir", edad por rango.
- Para qué se usan (mejora producto + newsletter editorial agregado).
- Datos de beta/paquetes con hash de email (no plano).

Renumeración: ARCO 6→7, Cookies 7→8, Seguridad 8→9, Cambios 9→10, Contacto 10→11.

### 11.8 · Stack de auth para dashboards · STATS_KEY compartido

Los tres dashboards de Solca (`/api/cv-stats`, `/api/quiz-stats`, `/api/simulator-stats`) usan el mismo secret `STATS_KEY` para auth por query param. El endpoint `/api/simulator-weekly-cron` usa el mismo secret.

Notas operativas:
- Cloudflare no permite leer secrets (por diseño). Si se pierde, hay que regenerar y guardar en password manager.
- Regenerado el 19 jun 2026 (Oscar guardó el nuevo valor en password manager).
- La URL del dashboard del simulador es `https://solcaciencia.com/admin/simulator-metrics?key=<STATS_KEY>`.

### 11.9 · Pendientes que se difirieron a Fase 1.5+

- Post free dedicado a STAR + manejo de preguntas pharma (task tracked). Cuando esté vivo, sustituye `/revisar-cv` como URL del CTA override por desempeño bajo.
- Email del cron semanal vía MailerSend cuando se configure.
- Role mapping explícito para las 8 áreas nuevas (matemáticas/computación/admin) en el system prompt.
- Retry UX pre-envío en frontend para respuestas cortas (per §7.4).
- Whisper API como alternativa al Web Speech API para mejorar transcripción en español (evaluar si los betas reportan que la voz es deficiente · ya hay un reporte de Oscar 19 jun 2026 en esa dirección).
- Persistencia entre sesiones (mecanismo 5 de §1.4) cuando haya suficiente data beta.

---

— Cierre de Fase 1.4 documentado por Claude · 19 jun 2026
