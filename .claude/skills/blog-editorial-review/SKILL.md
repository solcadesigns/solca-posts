---
name: blog-editorial-review
description: |
  Revisa un draft de blog para solcaciencia.com contra las reglas editoriales
  de Oscar antes de entregarlo. Se dispara SIEMPRE que se esté escribiendo o
  editando un post de blog (archivos bajo src/content/blog/*.md), y también
  cuando el usuario dice "revisa este draft", "auditea el blog", "check
  editorial", "aplica las reglas del workflow", "está listo para publicar",
  "review antifabricación", o pide feedback sobre un post recién generado.

  Lanza un subagente (Task tool con subagent_type "general-purpose") que
  aplique el checklist completo y devuelva un reporte con fixes concretos.
  Ningún draft de blog se entrega sin este paso.
---

# Blog editorial review · Solca Ciencia

Este skill es obligatorio antes de entregar cualquier draft de post para
`src/content/blog/`. También se puede invocar sobre posts ya publicados para
auditoría retroactiva.

## Cuándo se activa

- Draft nuevo generado por el flujo `Lun 8am scheduled task` del workflow blog.
- Reescritura sustancial de un post existente.
- Usuario pide review explícita ("audita el blog X", "aplica reglas", etc.).
- Antes de abrir el PR del blog semanal.

## Qué debe hacer el skill

1. Localizar el archivo del draft (`src/content/blog/<slug>.md`) y leerlo entero.
2. Lanzar UN subagente (`Task` tool, `subagent_type: general-purpose`) con el
   prompt detallado abajo. El subagente devuelve un reporte estructurado.
3. Aplicar las correcciones que el subagente recomiende, sección por sección.
4. Verificar que los cambios se aplicaron correctamente (re-leer el archivo).
5. Reportar al usuario: qué se corrigió, qué quedó pendiente por decisión
   humana, cero cambios "invisibles".

## Prompt del subagente (usar tal cual)

```
Eres el revisor editorial del blog solcaciencia.com. Estás revisando el draft
en el archivo <ruta absoluta al .md>.

Aplica el checklist siguiente y devuelve un reporte estructurado en Markdown
con secciones: [OK], [FIX SUGERIDO], [BLOQUEO].

REGLA 1 · Anclaje temporal explícito
- Si el contenido deriva de una actividad acotada en el tiempo (vacantes del
  mes, un reporte puntual, una muestra específica), el texto declara mes/año
  — por ejemplo "la selección que encontré este mes (ago/2026)".
- Usa pasado donde corresponde ("lo que ICON e IQVIA publicaron"), no presente
  atemporal ("lo que ICON e IQVIA publican").
- Marca cada afirmación que suene perene sobre material temporal.

REGLA 2 · Cada H2 sostiene su promesa
- Recorre cada H2 del post. Escribe qué promete el H2 en una frase.
- Compara con lo que efectivamente entrega el cuerpo debajo.
- Si el cuerpo no entrega la promesa: recomienda reescribir el H2 (para
  reflejar lo que sí hay) o reescribir el cuerpo (para entregar lo prometido).

REGLA 3 · Cero links rotos o placeholder
- Extrae TODOS los links del post (internos y externos).
- Para links internos (https://solcaciencia.com/... o /blog/...):
  a) Verifica que la URL sea absoluta con dominio, no relativa.
  b) Verifica que el post referenciado exista en src/content/blog/ con
     pubDate <= hoy (no linkear posts con pubDate futuro).
  c) Si el link apunta a una landing (/curso-cv, /libro-*, /bundle-*, etc.),
     verifica que exista en src/pages/ o marca como pendiente.
- Para links externos: reporta cada URL para que un humano las abra y
  verifique. No asumas que están vivas.
- Cualquier "TODO", "TK", "placeholder", "[insert link]", etc. es BLOQUEO.

REGLA 4 · Directo y concreto
- Marca párrafos que solo repitan lo dicho antes ("resúmenes operativos" que
  no aportan).
- Marca secciones de relleno (introducciones que dan vueltas, conclusiones
  genéricas).
- Marca oraciones con hedging vago ("puede ser útil considerar que...").
- Referencia de estilo: la versión editada por Oscar del blog
  cro-latam-entry-level-icon-iqvia (10 ago 2026) — párrafos cortos, dato +
  siguiente dato, cero relleno.

REGLA 5 · Barrido antifabricación (rules 1-3 del workflow existente)
Aplica el checklist de _docs/BLOG_WEEKLY_WORKFLOW.md líneas 55-68:
- Para cada afirmación con número, porcentaje, tendencia, estudio citado o
  "en promedio X": verifica que tenga URL a fuente primaria (no cita de
  tercera mano), o esté acotada al material propio ("en las vacantes que
  revisé este mes..."), o sea eliminada.
- PROHIBIDO apelar a muestras internas que no existen. Ejemplos históricos
  del error: "revisión sistemática de más de 200 CVs" sin muestra;
  proporciones sobre respuestas de survey que no existen en el formulario.
- PROHIBIDO el mito de "6-8 segundos" del reclutador leyendo CV (Ladders 2012
  con muestra de 30, sin especificar posiciones; datos reales muestran
  varianza 12s a 2m27s).

FORMATO DEL REPORTE
- [OK] Reglas que el draft ya cumple bien.
- [FIX SUGERIDO] Cambios concretos con line-number y "de esto → a esto".
- [BLOQUEO] Cosas que impiden publicar (links rotos, muestras inventadas,
  afirmaciones sin fuente).

No inventes contexto. Si no puedes verificar algo, dilo explícito ("no puedo
verificar link externo X, requiere apertura manual").
```

## Después del subagente

- Aplicar los [FIX SUGERIDO] uno por uno con la tool Edit.
- Los [BLOQUEO] van al chat para que el usuario decida (nunca commitear con
  bloqueos abiertos).
- Dejar un resumen corto al usuario: "Apliqué N fixes; quedan X bloqueos
  pendientes de tu decisión."

## Referencia cruzada

- `_docs/BLOG_WEEKLY_WORKFLOW.md` § "Reglas de edición (feedback Oscar, 10 ago 2026)"
- `_docs/BLOG_WEEKLY_WORKFLOW.md` § "Checklist obligatorio pre-publicación"
- `_docs/OSCAR_PROFILE.md` § "Reglas editoriales generales" (aplican a toda
  producción escrita: blog, LinkedIn, emails, guías).
