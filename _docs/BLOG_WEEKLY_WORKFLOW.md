# Workflow · Blog semanal solcaciencia.com

> **Establecido:** 21 jul 2026 · **Actualizado:** 19 nov 2026 (decisión de Oscar)
> **Cadencia:** 1 blog por semana, publicado los **viernes**
> **Fuente:** una pieza del sprint LinkedIn vigente de esa misma semana (de preferencia el Solca Insight)
> **Redacción:** GPT-6.1 Sol (OpenRouter) con brief de Claude; Claude verifica, edición con el prompt de editor senior, revisor editorial y revisor independiente
> **Instrucciones operativas:** `/Users/oscar/Documents/Claude/Scheduled/solca-blog-weekly-lunes/SKILL.md` · **Temas:** `BLOG_BACKLOG.md`, sección "Pendientes · sprint"
> **Distribución:** broadcast a suscriptores KV EMAILS vía Postmark

El blog es la versión larga, indexable y enlazable de una pieza del sprint. Usa las mismas reglas de redacción del sprint (`estrategia-linkedin/sprint-dic-2026/BRIEF-redaccion.md`) y el mismo destino que la pieza de origen.

---

## Cadencia semanal

| Día | Acción | Responsable |
|---|---|---|
| Lun 8am (tarea programada) | Toma la fila de la semana del backlog, arma el brief, GPT-6.1 Sol redacta, Claude verifica y corrige, edición con editor senior, revisor editorial e independiente, cover. Deja el .md listo, sin commit. | Claude + GPT-6.1 Sol |
| Mar-Mié | Revisa el .md. Aprueba o pide ajustes. | Oscar |
| Al aprobar | `npm run deploy` desde la terminal de Oscar (git push no despliega). El post aparece el viernes de su pubDate. | Oscar |
| Vie 8am (cron Worker) | Broadcast a KV EMAILS vía Postmark: hook + link al blog. | Cloudflare Worker |

**Regla operativa:** el blog debe estar desplegado antes del jueves para dar margen al cron del viernes.

---

## Fuentes de contenido

- **Válidas:** las piezas del sprint vigente (Solca Insight y posts B, C o E con cuerpo suficiente). La fila del backlog dice cuál.
- **Se evita:** una pieza cuyo tema ya cubre un post del blog (se elige otra de la misma semana) y piezas que dependen de cifras que se capturan después del lunes.
- **Reglas de copy:** las del sprint (`BRIEF-redaccion.md`): sin ATS, sin experiencia propia de Oscar, tono mesurado y empático, "sin costo" en vez de "gratis", afirmaciones de herramientas solo las verificables (revisor 20 criterios y 2 análisis por correo cada 30 días; quiz 12 preguntas y 5 roles; simulador 5 preguntas en la sesión sin costo).
- **CTA:** el destino de la pieza de origen, en el `cta` del frontmatter (`vacantes | revisar-cv | quiz-rol | simulador`) y en el enlace final del cuerpo.

---

## Transformación SEO — checklist

Cada blog semanal debe cumplir:

- Título 50-65 chars con keyword primary natural.
- Meta description 130-155 chars recomendado (máximo 180 por el schema) con keyword primary.
- H1 = título del blog (no repite).
- 3-5 H2 descriptivos con keywords long-tail.
- 800-1500 palabras (300-500 más largo que el post LinkedIn).
- Al menos 2 fuentes externas citadas con URL.
- CTA único al final (rotación: revisar-cv / quiz-rol / simulador).
- Cover 1280×720 generado con `scripts/generate-blog-cover.py`.
- Frontmatter Astro completo (title, description, pubDate, heroImage, category, tags, readingMinutes).

**Sub-regla:** el blog NO debe ser copia literal del post LinkedIn. Al menos 40% de reescritura, más contexto, más ejemplos, más fuentes.

## Checklist obligatorio pre-publicación (verificación de fuentes)

Antes de entregar el draft, revisar cada afirmación con número, porcentaje, tendencia, estudio citado, o "en promedio X":

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
