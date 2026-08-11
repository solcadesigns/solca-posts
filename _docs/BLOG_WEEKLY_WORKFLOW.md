# Workflow · Blog semanal solcaciencia.com

> **Establecido:** 21 jul 2026
> **Cadencia:** 1 blog por semana, publicado los **viernes**
> **Fuente:** contenido ya publicado en LinkedIn del sprint mensual (semana anterior)
> **Distribución:** broadcast a suscriptores KV EMAILS vía Postmark

Este flujo complementa al sprint LinkedIn mensual sin duplicar trabajo. Los posts LinkedIn son la fuente primaria; el blog es la versión SEO-optimizada, indexable y linkeable.

---

## Cadencia semanal

| Día | Acción | Responsable |
|---|---|---|
| Lun 8am (scheduled task) | Draft del blog semanal a partir del contenido LinkedIn de la semana anterior. Elige el post con mayor potencial SEO (Mié serie vacantes o Vie Solca Insight). Research de tendencias, keywords y PAA. Genera cover. Abre PR. | Claude |
| Mar-Mié | Review del PR. Aprueba con merge, o comenta y pide ajustes. | Oscar |
| Al merge del PR | Auto-deploy Cloudflare Workers Builds. Blog live. | Cloudflare |
| Vie 8am (cron Worker) | Broadcast a KV EMAILS vía Postmark: hook + link al blog. Uno por uno con throttling. | Cloudflare Worker |

**Regla operativa:** el blog debe estar merged antes del jueves para dar margen al cron del viernes. Si el PR sigue abierto el jueves, el cron salta esa semana (no broadcast basura).

---

## Fuentes de contenido

**Fuentes válidas para transformación SEO:**
- Mié serie "Lo que dicen las vacantes" — insights sobre patrones detectados en vacantes del mes.
- Vie Solca Insight — análisis editorial mensual sobre carrera en pharma LATAM.

**Fuentes NO válidas:**
- Lun teasers — cortos y promocionales, sin cuerpo SEO.
- Posts dedicados (ej. Vie 7 ago del simulador) — promoción de producto, no editorial.

**Regla de rotación:** no publicar 2 semanas seguidas del mismo Mié o Vie. Alterna fuentes.

---

## Transformación SEO — checklist

Cada blog semanal debe cumplir:

- Título 50-65 chars con keyword primary natural.
- Meta description 130-155 chars con keyword primary.
- H1 = título del blog (no repite).
- 3-5 H2 descriptivos con keywords long-tail.
- 800-1500 palabras (300-500 más largo que el post LinkedIn).
- Al menos 2 fuentes externas citadas con URL.
- CTA único al final (rotación: revisar-cv / quiz-rol / simulador).
- Cover 1280×720 generado con `scripts/generate-blog-cover.py`.
- Frontmatter Astro completo (title, description, pubDate, heroImage, category, tags, readingMinutes).

**Sub-regla:** el blog NO debe ser copia literal del post LinkedIn. Al menos 40% de reescritura, más contexto, más ejemplos, más fuentes.

## Checklist obligatorio pre-publicación (verificación de fuentes)

Antes de abrir el PR, revisar cada afirmación con número, porcentaje, tendencia, estudio citado, o "en promedio X":

1. **¿Tiene URL verificable en fuente primaria (no cita de tercera mano)?** Si sí, incluir el link inline.
2. **Si no tiene URL, ¿puede reformularse como observación acotada al material propio?** Ejemplo válido: "en las vacantes que revisé este mes…". Ejemplo NO válido: "en promedio los reclutadores…".
3. **Si no cumple 1 ni 2, eliminar la frase entera.** Sin excepciones.

**Prohibido apelar a muestras internas que no existen.** Ejemplo del error histórico: "revisión sistemática de más de 200 CVs" cuando no había tal muestra; "en las respuestas al survey del CV Review cero declararon C1" cuando esa pregunta ni siquiera existe en el formulario.

**Mitos específicos prohibidos:**
- **"6-8 segundos" del reclutador leyendo CV** — el estudio Ladders 2012/2018 tenía muestra de solo 30 recruiters sin especificar posiciones. Datos reales muestran varianza 12s a 2m27s. Cualquier blog que se construya sobre este marco se reescribe.

**Sentenciar cuando hay fuente, acotar cuando no.** La voz Solca no es licencia para afirmar en absoluto — es exigencia de rigor. Si la afirmación no aguanta un fact-check de 5 minutos, no va.

---

## Reglas de edición (feedback Oscar, 10 ago 2026)

Detonante: review del draft `cro-latam-entry-level-icon-iqvia-que-piden-en-realidad`. Cuatro reglas nuevas, obligatorias para todo draft futuro:

1. **Anclaje temporal explícito.** Si el contenido deriva de una actividad acotada en el tiempo (las vacantes de este mes, un reporte puntual), el texto lo declara con mes/año — "la selección que encontré este mes (ago/2026)" — y usa pasado donde corresponde ("lo que ICON e IQVIA publicaron"). Prohibido el tono perene sobre material temporal: el blog vive años, la muestra no.
2. **El texto sostiene la promesa del subheading.** Cada H2 es un contrato: si el cuerpo de la sección no entrega lo que el H2 promete, se reescribe el H2 o se reescribe el cuerpo. Verificar sección por sección antes de entregar.
3. **Cero links rotos o placeholder.** Todo link interno usa URL absoluta `https://solcaciencia.com/...` y apunta solo a posts YA publicados (pubDate anterior a hoy y deployed). Nunca linkear un post cuyo pubDate sea futuro. Todo link (interno y externo) se abre y verifica antes de entregar el draft.
4. **Directo y concreto.** Sin vueltas: párrafos cortos que entregan el dato y avanzan. Sin secciones de relleno (el "Resumen operativo" se elimina si solo repite lo ya dicho). Referencia de estilo: la versión editada por Oscar del blog CRO del 10 ago 2026.

**Agente revisor obligatorio.** Antes de entregar cualquier draft, lanzar un subagente (Task tool) que revise el texto contra estas cuatro reglas más el barrido antifabricación existente, y corregir lo que marque. El draft no se entrega sin este paso.

---

## Broadcast por email · Vie 8am

**Audiencia:** todos los emails en KV EMAILS con consent activo (opt-in vía formularios de solcaciencia.com).

**Formato B — hook + link (decidido 21 jul 2026):**
- Subject: título del blog o hook editorial (~50 chars)
- Body: primer párrafo del blog (~150 palabras) + link al blog completo
- Firma: Oscar · Solca Ciencia
- Unsubscribe link (obligatorio, Postmark lo inyecta con `{{{ pm:unsubscribe }}}`)

**Sin copiar el post entero.** Objetivo del broadcast: driver de tráfico al sitio, no reemplazar la lectura del blog.

**Implementación técnica:**
- Endpoint interno `/api/blog-broadcast` triggered por cron trigger Vie 8am (`0 14 * * 5` UTC = 8am CDMX)
- Lee el último blog publicado desde `src/content/blog/` ordenado por `pubDate` desc
- Itera KV EMAILS con throttling (~100ms entre envíos para no gatillar rate limits Postmark)
- Usa template Postmark `weekly-blog-broadcast` (TBD, crear cuando aterricemos primer blog)

---

## Salvaguardas anti-spam

Aplicando las lecciones de MailerLite/Brevo (ver `_docs/que-rompimos-brevo-mailerlite.md`):

1. **Solo suscriptores con opt-in reciente.** Un flag `optedInAt` en KV controla la elegibilidad. Contactos > 2 años sin actualización se excluyen.
2. **Broadcast individual, no bulk.** Postmark recibe una llamada por destinatario, no upload de lista.
3. **Bounces se purgan.** Postmark webhook marca la KV como suppressed en hard bounce.
4. **Unsubscribe honrado instantáneo.** Un click al link de unsubscribe elimina el flag `optedInAt` y agrega `unsubscribedAt`.

---

## Anti-patrones (no repetir)

1. **Copiar el post LinkedIn tal cual como blog.** Google penaliza contenido duplicado, y peor: el blog no rinde SEO porque no aporta valor único.
2. **Publicar blog mismo día que se programa el LinkedIn del sprint.** El blog debe estar ya deployed cuando el LinkedIn sale, para que el LinkedIn pueda linkear al blog (sub-regla 7b).
3. **Broadcast masivo desde una lista importada sin re-opt-in.** Motivo por el que MailerLite y Brevo nos cerraron. La KV EMAILS crece solo por opt-in nativo.
4. **Enviar broadcast si el blog aún no está deployed.** El cron valida que el link funcione antes de enviar.

---

## Cierre y métricas

Cada blog semanal se cierra con:
- Slug listado en `_docs/BLOG_BACKLOG.md` bajo la sección "Publicados"
- Métrica de broadcast: enviados, bounces, unsubscribes (log en KV o D1)
- Métrica de tráfico: Google Search Console + Cloudflare Web Analytics tras 7 días

Si el blog no gana tráfico orgánico en 30 días, se anota como aprendizaje editorial pero no se elimina.
