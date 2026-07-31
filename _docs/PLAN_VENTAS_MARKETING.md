# Plan Maestro · Ventas y Marketing · productos Solca

**Fecha:** 7 jul 2026
**Cubre:** Curso CV + 3 libros PhD→industria (PM, MSL, CR)
**Basado en:** research infoproductos LATAM, benchmark competencia, research SEO Hotmart, research hero image
**Archivos fuente:** `_docs/RESEARCH_INFOPRODUCTOS_LATAM.md` · `_docs/RESEARCH_COMPETENCIA_LATAM.md` · `_docs/RESEARCH_HOTMART_SEO.md` · `_docs/RESEARCH_HERO_IMAGE.md`

---

## Parte 1 · Imagen hero del curso CV

### 1.1 · Diagnóstico imagen actual

- Nombre archivo: `ChatGPTImageFeb112026at03_13_52PM.png` (generada con ChatGPT/DALL-E genérica).
- Probable estilo aspiracional stock (persona sonriendo, gradiente).
- No cumple guía oficial Hotmart (fondo blanco desaconsejado, sin cara del instructor, sin autoridad).

### 1.2 · Tipo de imagen recomendado por research

**Retrato editorial del instructor + tipografía overlay + bloque de color plano teal.**

Justificación:
- Miniaturas con rostro humano rinden 23-50% más CTR ([onlinecoursehost](https://instructor-academy.onlinecoursehost.com/how-to-create-an-online-course-thumbnail/)).
- Coursera Career Certificates, Udemy top-sellers y Hotmart bestsellers de "Carrera y Desarrollo" convergen en este patrón.
- Cumple guía oficial Hotmart: 600×600px JPG/PNG, márgenes 50px, alto contraste, sin fondo blanco ([Hotmart Blog](https://hotmart.com/pt-br/blog/como-criar-imagem-atraente-pagina-produto)).

Descartar:
- Escenas de laboratorio con bata (los científicos reales las leen como cliché).
- Stock photo con audífonos apuntando a laptop (patrón "guru").
- Gradientes morado/naranja + cohetes (patrón infoproducto motivacional).
- Fondo blanco puro (contradice guía oficial).

### 1.3 · Prompts listos para pegar

**Opción A · Retrato editorial (recomendado principal · Midjourney V7)**

```
Editorial half-body portrait of a Latin American life-science professional in her early 30s wearing a slate-blue blazer over a cream shirt, holding a printed CV folder at chest level, standing against a matte deep-teal wall #0B3D5C, soft north window daylight from camera-left, faint laugh lines, visible skin pores, quiet confident direct gaze into the lens, subtle magazine editorial color grade, shot on Sony A7R V 85mm f/1.4 at f/2, generous negative space on the right third for headline text, palette slate blue, muted teal, warm ochre accent --ar 4:5 --style raw --s 120 --v 7 --no lab coat, stethoscope, plastic skin, forced smile, stock photo, thumbs up
```

**Opción B · Abstract editorial (si prefieres no usar modelo AI · Ideogram 4.0)**

```
Editorial abstract illustration, concept of a science career pathway, isometric flowing line graph rising over a soft gradient mesh background, subtle molecular hexagon motif in negative space, palette #0B3D5C #2A6F6A #E8B84B #F5F1E8, matte paper grain texture, magazine editorial style, generous negative space top-left for course title, calm confident tone --ar 16:9
```

**Opción C · Escena oficina profesional (Midjourney V7)**

```
Latin American biomedical professional reviewing a CV on a tablet at a modern minimalist desk, mid-morning window light, monitor showing a job application dashboard slightly out of focus in background, wearing a fine-knit navy sweater, real unposed candid moment mid-thought, shot on 35mm f/2.8, natural muted color, palette deep teal and warm neutral, no lab coat, no stethoscope --ar 16:9 --style raw --s 150 --v 7 --no stock, thumbs up, staged smile, generic office
```

**Opción D (más honesta) · Tu retrato profesional real**

Si te tomas una foto profesional real (fotógrafo local, ~USD $80-150 en Mérida), gana a cualquier AI. La cara real del instructor + tipografía en Canva rinde mejor que cualquier persona AI. Consideración práctica.

### 1.4 · Herramientas y costos verificados 2026

| Herramienta | Precio | Uso recomendado |
|---|---|---|
| Midjourney V7 | $10-30/mes | Retrato editorial fotorreal |
| Flux 2 via Freepik | ~$14/mes | Fotorrealismo (piel, luz) |
| Ideogram 4.0 | $8-20/mes | Texto integrado en imagen |
| Recraft v3 | $10/mes | SVG editable, brand consistency |
| ChatGPT gpt-image-1.5 | $20 Plus | Iteración rápida, NO da 16:9 nativo |

### 1.5 · Después de generar la imagen

En Canva o Figma:

- Agrega overlay tipográfico: "CV para Ciencias Biológicas y de la Salud" (sans-serif bold, blanco).
- Subhead: "Consigue Empleo o Posgrado" (peso medio, ochre).
- Tu nombre pequeño abajo: "Oscar Solís · PhD".
- Exporta 600×600 para Hotmart marketplace + 1200×630 para OG/landing propia.

### 1.6 · A/B test recomendado

No hay A/B test público de Hotmart comparando tipos de hero. La única forma de saber qué convierte para tu curso: correr **tu propio A/B durante 2 semanas** con 2 variantes (retrato vs abstract). Hotmart no tiene A/B nativo pero puedes hacerlo cambiando la imagen cada semana y midiendo clicks vs compras en tu dashboard.

---

## Parte 2 · Guía ejecutable de cambios en Hotmart

### 2.1 · Curso CV · lista de cambios exactos

#### Título (sección hero)

**Reemplazar:**
> CV en Ciencias Biológicas y de la Salud: Domina la Estrategia para Conseguir el Empleo o Posgrado que Deseas

**Por:**
> CV para Ciencias Biológicas y de la Salud · Consigue Empleo o Posgrado

Mantiene keyword "CV" al inicio (validada por research SEO). Baja de 108 a 68 chars (mejor CTR en Google SERP + mejor legibilidad marketplace).

**No cambiar slug URL.** El slug actual con "de-de" duplicado y hash UUID es feo pero cambiarlo genera 404 en indexación previa. Déjalo.

#### Subtítulo hero

**Reemplazar:**
> Aprende el sistema completo para aplicar con éxito a empleos y posgrados en ciencias biológicas y de la salud. Destaca entre la competencia y consigue el trabajo que deseas y mereces.

**Por:**
> No es solo hacer un CV. Es aplicar como estratega: análisis de vacante, propuesta de valor, filtros ATS, LinkedIn, cartas, declaración de posgrado y entrevistas — para perfiles QFB, biólogos, médicos, biomédicos, enfermeros, nutriólogos y afines.

#### Sección "Acerca del curso" (eliminar copy triplicado con typos)

**Reemplazar todo el bloque actual por:**

> **¿Por qué existe este curso?**
>
> La mayoría de estudiantes y profesionales en ciencias biológicas y de la salud aplican con estrategia de candidato: envían el mismo CV a 30 vacantes, esperan respuesta, se frustran. La minoría que consigue entrevistas aplica con estrategia de estratega: analiza cada vacante, construye una propuesta de valor específica, optimiza cada punto de contacto.
>
> Este curso te da el sistema de estratega, adaptado al lenguaje y realidad de ciencias biológicas y de la salud en LATAM.
>
> **Lo que aprendes:**
>
> - Analizar vacantes y requisitos reales (no lo que parece que piden)
> - Construir una propuesta de valor única para tu perfil
> - Hacer "match" estratégico con organizaciones
> - Superar filtros ATS sin trucos que descalifican
> - Redactar un CV profesional adaptado al sector salud
> - Optimizar tu perfil de LinkedIn para que reclutadores te encuentren
> - Escribir cartas de presentación que se leen completas
> - Preparar formularios de aplicación institucional
> - Redactar declaración personal para posgrados nacionales e internacionales
> - Prepararte para entrevistas por competencias
>
> **Incluye:**
>
> - Plantillas de CV probadas contra filtros ATS
> - Guía paso a paso para cartas de presentación
> - Marco de trabajo para LinkedIn profesional
> - Estructura de declaración personal para posgrado
> - Framework de entrevistas por competencias (método STAR aplicado a biosciencias)
> - Módulo bonus: cómo aplicar a posgrado internacional

#### Sección "TU INSTRUCTOR" (expandir con autoridad + honestidad)

**Reemplazar bio actual por:**

> **Oscar Solís · PhD Sheffield · Consultor pharma LATAM**
>
> - Licenciado en Biología, UNAM (México).
> - PhD en Ciencias Biomédicas, University of Sheffield (Reino Unido, top 100 mundial · [QS World Rankings](https://www.topuniversities.com/universities/university-sheffield)).
> - Máster en Administración de Instituciones de Salud.
> - Actualmente consultor y analista para la industria farmacéutica y de salud, con foco en carrera clínica y medical affairs LATAM.
>
> Antes de crear este curso, ya llevaba años acompañando a estudiantes de licenciatura, maestría y doctorado en su transición profesional. Estudiantes de la University of Sheffield que se acercaban por conversaciones informales, PhDs en México y LATAM que buscaban cómo salir de la academia sin perder identidad.
>
> No inventé un método para vender un curso. Sistematicé lo que ya venía enseñando 1 a 1.
>
> **Por qué construí esto:**
>
> He sido rechazado múltiples veces. Y fue a través de esa experiencia que entendí algo clave: no siempre controlas la decisión final del reclutador o el comité. Pero sí controlas cómo te posicionas.
>
> Ese ajuste — de candidato a estratega — es el que enseño en este curso.
>
> **Comunidad activa:**
>
> Publico contenido gratuito semanal en LinkedIn con +1,900 profesionales suscritos, y mantengo el blog público de [solcaciencia.com](https://solcaciencia.com/blog) con más de 15 artículos sobre carrera científica y transición pharma LATAM. Antes de comprar, léelos. Son la mejor muestra del método.

#### Sección nueva "MÉTODO VERIFICABLE GRATIS" (insertar antes del CTA final)

> **Antes de comprar, valida el método sin costo:**
>
> - Lee [15 artículos gratuitos sobre carrera pharma y aplicación estratégica](https://solcaciencia.com/blog).
> - Prueba la [herramienta gratuita de análisis de CV en 60 segundos](https://solcaciencia.com/revisar-cv), sin registro.
> - Suscríbete al newsletter Solca Insight en LinkedIn (gratis, cada viernes).
>
> Si el contenido gratuito te aporta, el curso te da el sistema completo estructurado y las plantillas listas.

#### Precio

**Reemplazar:**
> **$ 699*** — hasta 9 meses sin intereses. IVA incluido.

**Por:**
> **$ 1,499*** precio regular
>
> **$ 999*** precio de lanzamiento (primeros 30 compradores o hasta 31 ago 2026)
>
> Hasta 12 meses sin intereses. IVA incluido.

#### Garantía

**Reemplazar:**
> 7 días de garantía · Tu dinero de vuelta sin preguntas.

**Por:**
> 30 días de garantía · Si aplicas el método y no te sirve, te devolvemos el 100% sin preguntas.

#### Sección "TESTIMONIOS" (nueva, aprovechando 2 reviews LinkedIn)

**Agregar antes del FAQ:**

> **Lo que dicen quienes ya trabajaron con este método:**
>
> [Captura del review 1 de LinkedIn con nombre + puesto + link al perfil]
>
> [Captura del review 2 de LinkedIn]
>
> Los reviews son públicos. Puedes verificarlos en mi [perfil de LinkedIn](https://www.linkedin.com/in/oscar-consultoria/).
>
> **¿Sin más testimonios?** Este curso es de lanzamiento 2026. El precio actual refleja esa etapa: quienes compran hoy pagan menos y me ayudan a validar el método con casos reales. Si te sirve, tu testimonio aparece aquí y contribuye a que quienes vengan después vean casos verificables.

#### FAQ (reemplazar los 5 genéricos por 8 orientados a objeción)

> **¿Cuánto dura el curso?**
> Autodirigido, la mayoría lo termina en 1-2 semanas dedicando 1 hora al día.
>
> **¿Es en video o solo texto?**
> [Ajustar a lo real. Sé específico: "Combina video, PDF descargables, plantillas editables".]
>
> **¿Sirve si estoy en la licenciatura?**
> Sí. El módulo de aplicación a posgrado está diseñado para estudiantes de últimos semestres o recién egresados.
>
> **¿Sirve si ya tengo 5+ años de experiencia?**
> Sí, con matiz. El método aplica pero probablemente ya cubres varios pasos. Consulta el temario en el módulo de bienvenida. Si notas que ya sabes 80% del contenido, puedes usar la garantía de 30 días.
>
> **¿Sirve si mi target NO es pharma?**
> Sí. Los ejemplos son biosciencias/salud pero el sistema aplica a hospital, laboratorio clínico, biotecnología, dispositivos médicos, industria farmacéutica y academia (posgrado).
>
> **¿Tengo mentoría 1 a 1 incluida?**
> No, este curso es el sistema en formato self-paced. [Si tienes servicio de revisión: "Si buscas revisión personalizada de tu CV, ofrezco eso como servicio aparte, contacto en el correo del curso"].
>
> **¿Cuándo empiezo a ver resultados?**
> Los ajustes de CV y LinkedIn dan efecto en las primeras 2-3 semanas. La aplicación a posgrados con declaración personal fuerte se ve en la siguiente ronda de admisión.
>
> **¿Cómo funciona la garantía?**
> 30 días desde tu compra. Si aplicas el método y no te sirve, escribes a soporte y te devolvemos el 100%, sin preguntas ni formularios.

#### CTA (unificar en las 3 apariciones)

**Reemplazar:**
> "COMPRA AHORA" (arriba) + "Compre ahora" (medio) + "Compre ahora" (precio)

**Por CTA único consistente en las 3 apariciones:**
> **Empieza el sistema hoy** — MXN $999 precio lanzamiento

### 2.2 · Los 3 libros · lista de cambios exactos

**Títulos:** NO CAMBIAR. Los 3 títulos actuales están bien construidos SEO-wise.

**Precios:**
- Libro PM: MXN $799 regular · MXN $599 lanzamiento
- Libro MSL: MXN $799 regular · MXN $599 lanzamiento
- Libro CR: MXN $999 regular · MXN $749 lanzamiento (premium por timing ICH E6(R3))

**Garantía:** 7 → 30 días en los 3.

**Sección "Sobre el autor":** copia la misma bio expandida del curso CV.

**Agregar al final de cada landing (antes del CTA):**

> **Este libro es de lanzamiento (2026).** Los primeros compradores pagan precio de lanzamiento y me ayudan a validar el método con casos reales. Si te sirve, tu testimonio se suma como caso verificable para quienes vengan después.

**Agregar bloque "Método verificable gratis"** idéntico al del curso CV, con los links al blog + herramienta CV + newsletter.

**Cambios específicos por libro:**

**Libro PM · agregar al copy:**
> **Este libro sirve si:** ya tienes doctorado o maestría y buscas un rol de coordinación en industria farmacéutica, biotecnología, dispositivos médicos o salud digital, sin renunciar a tu identidad científica.

**Libro MSL · agregar al copy:**
> **Este libro sirve si:** ya tienes doctorado en ciencias biomédicas y quieres pasar a Medical Affairs en LATAM. Cubre Argentina, México, Colombia, Chile y Brasil.

**Libro CR · agregar al copy (capitalizar timing regulatorio):**
> **Actualizado con ICH E6(R3), la nueva norma de Buenas Prácticas Clínicas vigente desde 2025.** Si compras el libro CR de otra fuente publicada antes de 2025, está desactualizada. Este es el único material en español latino que ya integra los cambios de R3 para el CRA/CRS que arranca hoy.

**Portadas de los 3 libros** (sprint 2, no crítico esta semana):
- Libro PM: paleta azul actual + badge "GUÍA · TRANSICIÓN"
- Libro MSL: paleta verde + badge "GUÍA · MEDICAL AFFAIRS"
- Libro CR: paleta naranja + badge "GUÍA · CLINICAL RESEARCH · ICH E6(R3)"

### 2.3 · Timeline ejecutable · 5 días

**Día 1 (2 horas) · precios y garantías**
1. Cambiar los 4 precios en Hotmart.
2. Cambiar las 4 garantías a 30 días.

**Día 2 (2 horas) · limpieza del curso CV**
3. Corregir todos los typos.
4. Cambiar título del curso a versión corregida.
5. Cambiar subtítulo hero.
6. Eliminar el copy triplicado.

**Día 3 (2 horas) · bio y método verificable**
7. Escribir bio expandida del instructor (una vez, se replica en las 4 landings).
8. Agregar bloque "Método verificable gratis" con links en las 4 landings.
9. Agregar párrafos de honestidad early-stage en las 4 landings.

**Día 4 (1 hora) · social proof mínimo**
10. Capturar los 2 reviews LinkedIn.
11. Publicar en las 4 landings.

**Día 5 (1 hora) · FAQ, CTA e imagen hero nueva**
12. Reemplazar FAQ del curso CV por el nuevo de 8 preguntas.
13. Unificar CTA en las 4 landings.
14. Generar imagen hero con prompt Midjourney A y agregar tipografía en Canva.

**Total: ~8 horas distribuidas. Cero acciones destructivas para SEO existente.**

---

## Parte 3 · Plan de ventas y marketing consolidado

### 3.1 · Funnel completo

```
TRÁFICO (top of funnel)
├── SEO blogs solcaciencia.com (15 blogs pharma LATAM ya publicados)
├── SEO blogs nuevos "aplicación estratégica biosciencias" (por escribir)
└── LinkedIn newsletter Solca Insight (+1,900 suscritos)

    ↓

LEAD MAGNET GRATIS (top of funnel → mid funnel)
├── Herramienta revisar-cv (ya existe)
├── Quiz-rol (ya existe)
└── Simulador entrevistas beta (ya existe)

    ↓

CAPTURA EMAIL (mid funnel)
└── MailerLite: automation bienvenida → 3 emails valor puro → 1 email pitch curso CV

    ↓

PRODUCTO ENTRADA (bottom of funnel)
Curso CV (MXN $1,499 regular · $999 lanzamiento)
   ← 60-70% de compradores empiezan aquí

    ↓ (upsell inmediato post-compra o email día 30)

PRODUCTO ROL-ESPECÍFICO (upsell natural)
Libro PM / MSL / CR (MXN $799-$999)
   ← 20-30% de compradores curso CV agregan libro

    ↓ (upsell tercer mes)

BUNDLES (ticket alto)
Bundle 3 libros o Bundle completo (MXN $1,999-$2,999)
   ← 5-10% del tráfico compra bundle directamente

    ↓ (definir Q4 2026)

MENTORÍA 1-A-1 O CONSULTORÍA
   USD $200-500/hora es rango sano LATAM
```

### 3.2 · Sprint mensual dedicado a ventas

Complementa el sprint editorial mensual (documentado en `_docs/SPRINT_WORKFLOW.md`) con estas cadencias específicas de ventas:

**Semanal:**
- 1 post LinkedIn con testimonio o resultado real de comprador (cuando existan)
- 1 mención natural del producto en el newsletter Solca Insight del viernes

**Quincenal:**
- 1 email dedicado a MailerLite con oferta específica (ej. "aún hay 15 cupos al precio de lanzamiento")

**Mensual:**
- 1 blog nuevo que aterriza en curso CV específicamente (temas: "cómo escribir declaración personal para posgrado biosciencias LATAM", "5 errores en CV que descalifican en pharma", etc.)
- Revisión de métricas: unidades vendidas, refund rate, CAC por canal

### 3.3 · Métricas y KPIs

**Mes 1 post-relanzamiento (métricas de sanidad):**

| Métrica | Baseline actual | Target mes 1 | Target mes 3 |
|---|---|---|---|
| Ventas totales/mes | (medir hoy) | +50% | +200% |
| AOV (average order value) | ~MXN $500 estimado | MXN $999 | MXN $1,200 (por bundles) |
| Refund rate | (medir hoy) | <8% | <5% |
| Conversión visita → compra | (medir Hotmart analytics) | 1.5% | 3% |
| Tráfico desde blog Solca | (medir con SC) | +30% | +100% |
| Suscriptores newsletter Solca Insight | ~1,900 | 2,300 | 3,000 |

**Regla de sanidad:** si refund rate sube de 8%, es señal de que el copy sobrevende. Retroceder promesas o reforzar screening del target.

### 3.4 · Automations MailerLite recomendadas

Configurar en Sprint 1 (día 5 o siguiente semana):

**Automation 1 · Bienvenida al newsletter (trigger: suscripción)**
- Email 1 (día 0): "Bienvenido a Solca Insight" + link al blog más leído + regalo (checklist CV pharma PDF)
- Email 2 (día 3): "El error #1 en CV PhD" (contenido puro, sin pitch)
- Email 3 (día 7): "Cómo pasamos filtros ATS" (contenido + link suave al blog cv-cinco-ajustes)
- Email 4 (día 12): pitch curso CV con precio de lanzamiento + garantía 30 días
- Email 5 (día 20): recordatorio con caso real (cuando exista) o el "por qué construí esto"

**Automation 2 · Post-compra curso CV (trigger: compra Hotmart curso)**
- Email 1 (día 0): confirmación acceso + kickoff del módulo 1
- Email 7 (día 15): pregunta "¿qué rol específico persigues?" con 3 opciones (PM, MSL, CR)
- Email 8 (día 30): recomendación de libro específico según elección (ancla: "los compradores del curso reciben libro PM/MSL/CR con 20% de descuento en los próximos 7 días")

**Automation 3 · Recuperación de carrito abandonado**
- Hotmart tiene integración nativa con MailerLite vía webhook. Configurar recuperación día 1, 3 y 7 con precio de lanzamiento como ancla.

### 3.5 · Cross-sell entre productos

Post-compra curso CV, upsell a libro específico según rol:

```
Curso CV comprador
   ├── Interés declarado en Project Management → oferta Libro PM
   ├── Interés declarado en Medical Affairs → oferta Libro MSL
   ├── Interés declarado en Clinical Research → oferta Libro CR
   └── Sin declaración → oferta Bundle 3 libros con descuento
```

Descuento sugerido para cross-sell: 20% off durante 7 días post-compra del curso. No permanente (destruye margen), sí tiempo-limitado (crea urgencia real).

Cross-sell entre libros (comprador libro PM):
- Semana 2 post-compra: "los lectores de PM también leyeron MSL" → link con 15% off
- Semana 4: "para completar la serie PhD→industria: Bundle 3 libros con 25% off"

### 3.6 · Tráfico y adquisición · canales priorizados

**Ranking por ROI esperado (mes 1-3):**

1. **Newsletter LinkedIn Solca Insight** — audiencia ya caliente, +1,900 suscritos. CAC efectivo cero. Prioridad #1.
2. **SEO blog solcaciencia.com** — 15 blogs ya deployados, esperan indexación completa. CAC bajo, tarda 60-90 días en dar tráfico material. Prioridad #2 con inversión de tiempo (nuevos blogs mensuales).
3. **LinkedIn posts orgánicos** — cadencia sprint editorial ya establecida. CAC efectivo cero. Prioridad #3.
4. **Referidos + boca a boca** — activar afiliados en Hotmart (30-50% comisión) con creadores complementarios del nicho. Prioridad #4.
5. **Ads (Meta/Google)** — solo cuando AOV pase de MXN $1,200 y refund rate sea <5%. NO invertir antes. Prioridad #5.

### 3.7 · Reglas transversales del plan

- **Cero exagerar promesas** (regla Solca de honestidad factual aplica también a copy comercial).
- **Cero inventar cifras de éxito.** Si no tienes 50 casos, no digas "50 profesionales ya lo aplicaron". Puedes decir "método usado en mentorías 1 a 1 durante los últimos años en Sheffield y LATAM".
- **Cero comparación directa con competidores por nombre.** Refiere el mercado en general, no ataques.
- **Sin emoji.**
- **Español latino neutro** (evitar tanto "vosotros" español como demasiado mexicano si target es AR/CO/CL también).
- **Precio de lanzamiento con fecha o cupo real.** Si dices "primeros 30 compradores", cuenta los reales. Si dices "hasta 31 ago", respétalo.

---

## Referencias completas

- Auditoría curso CV (landing): https://solcadesigns.hotmart.host/cv-en-ciencias-biologicas-y-de-de-la-salud-ats-linkedin-e78259bd-c882-4b61-b496-9d3da84d06b2
- Libro PM: https://hotmart.com/es/marketplace/productos/de-doctorado-a-project-manager-guia-de-transicion-para-profesionales-de-ciencias-biologicas-biomedicas-y-de-la-salud/R105710415P
- Libro MSL: https://hotmart.com/es/marketplace/productos/de-doctorado-a-msl-medical-science-liaison-como-convertir-tu-phd-en-una-carrera-de-medical-affairs-latinoamerica/Y105718405Y
- Libro CR: https://hotmart.com/es/marketplace/productos/de-doctorado-a-clinical-research-como-entrar-a-investigacion-clinica-desde-la-academia-enfoque-latinoamerica/U105724060O

Research completo en `_docs/RESEARCH_INFOPRODUCTOS_LATAM.md` · `_docs/RESEARCH_COMPETENCIA_LATAM.md` · `_docs/RESEARCH_HOTMART_SEO.md` · `_docs/RESEARCH_HERO_IMAGE.md`.
