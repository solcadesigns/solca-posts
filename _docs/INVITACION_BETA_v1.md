# Template de invitación · Beta cerrada del Simulador de Entrevistas

**Versión v1 · 19 jun 2026** · sin emoji, voz Solca (directa, honesta, sin floritura).

Diseñado para mail merge con el CSV que devuelve `scripts/generate-beta-codes.mjs` (columnas `nombre`, `codigo`, `url`, `cohort`).

---

## Asunto (subject)

```
{{nombre}}, te quiero pedir un favor con un simulador de entrevistas pharma
```

Alternativas si quieres testear A/B:

```
{{nombre}}, ¿probarías 20 minutos un simulador para entrevistas pharma?
```

```
Acceso a la beta cerrada del Simulador de Entrevistas (Solca)
```

---

## Cuerpo del email

```
Hola {{nombre}},

Te escribo porque estoy probando un simulador de entrevistas pharma con un grupo
chico antes de abrirlo al público, y tu perfil encaja con la audiencia.

Cómo funciona: un entrevistador con IA te hace preguntas reales (de 5 a 15 según
la etapa que elijas), tú respondes por texto o voz, y al final te entrega un
reporte detallado con scores por dimensión, qué funcionó, qué afinar, y frase
modelo por pregunta. Toma entre 20 y 60 minutos según la longitud que elijas.

Tu acceso (3 sesiones, válido hasta 31 ago 2026):

{{url}}

El código es {{codigo}} (por si el link no funciona, lo metes manual en la página).

Lo que necesito de ti:

  1. Corre al menos una sesión completa cuando puedas.
  2. Al final del reporte hay una encuesta corta opcional · si tienes 2 minutos,
     llénala. Es lo que más me ayuda a iterar.
  3. Si algo se rompe, se siente raro, o tienes una idea, respóndeme este mismo
     correo. Sin filtros · me sirve más lo crudo que lo amable.

No te voy a pasar a una lista de marketing ni te voy a vender nada por esto.
Estás probando algo nuevo y agradezco el tiempo.

Cualquier cosa, hello@solcaciencia.com (o respondes este mensaje).

Gracias,
Oscar
```

---

## Notas de uso

**Variables a sustituir** (en Postmark templateModel, Gmail merge, o el sender que uses):
- `{{nombre}}` → columna `nombre` del CSV
- `{{url}}` → columna `url` del CSV (link de un clic con código pre-armado)
- `{{codigo}}` → columna `codigo` del CSV (fallback si el link falla)

**Tono y reglas de marca aplicadas** (per `OSCAR_PROFILE.md`):
- Sin emoji.
- Sin acrónimos pharma en el cuerpo (audiencia mixta, no asumir contexto).
- Honesto sobre qué es y qué pides (3 sesiones, una encuesta, feedback crudo).
- Una sola CTA (el link). Sin botones múltiples ni promesas de marketing.
- Cierre humano · firmado por Oscar, no por "el equipo Solca".

**Cuándo personalizar más allá del merge**:
- Si el invitado es un contacto warm (LinkedIn outreach mayo 2026, exalumno, conocido directo), añade UNA línea inicial específica que reconozca el contexto previo. Ejemplo: *"Te vi hace unas semanas mencionar que estás aplicando a Clinical Operations · creo que esto te va a venir bien para esa búsqueda."*
- Si es un suscriptor activo del newsletter que no conoces personalmente, déjalo igual al template.

**Anti-patrones a evitar**:
- NO uses promesas tipo *"esto te va a transformar tu carrera"* o *"feedback de clase mundial"*. Choca con la regla anti-fabricación motivacional.
- NO pongas estadísticas inventadas (*"80% de quienes practican aquí consiguen entrevista"*). No tenemos data todavía.
- NO presiones con scarcity (*"solo quedan 5 cupos"*). Tienes 30 invitados elegidos a propósito; el scarcity es real pero no operativo para ellos.

**Seguimiento post-envío**:
- Si después de 7 días el invitado no entró a `/sesion`, manda un recordatorio corto (3 líneas): *"{{nombre}}, te dejé acceso a la beta hace una semana. Si no es buen momento, no pasa nada · si quieres probar, el link sigue activo: {{url}}"*.
- Si después de la sesión no llenó la encuesta, manda 1 follow-up con las 2 preguntas más críticas pegadas en el correo (sorpresa + mejora).

---

## Cuándo usar este template

- Primera ola: 30 invitados warm, beta-1 cohort.
- Segunda ola (si la primera deja huecos): hasta 15 adicionales, beta-2 cohort.
- NO usar para frío total (suscriptores nuevos que nunca interactuaron). Para ellos, primero un warm-up de 2-3 emails antes de invitar.

---

— Template escrito por Claude para Solca · 19 jun 2026
