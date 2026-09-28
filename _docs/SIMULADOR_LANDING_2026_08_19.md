# Simulador de Entrevistas · Landing pública canónica

Fecha del cambio inicial: 19 ago 2026 · Sprint LinkedIn septiembre.
Refinamiento pre-paywall: 19 ago 2026 (mismo día, decisión de producto).

## Qué cambió

La landing canónica pasó de `/simulador-entrevistas-beta/` (privada, con noindex
y acceso solo por código enviado a mano) a `/simulador-entrevistas/` (pública,
indexable, con formulario propio que genera código automático y envía Postmark).

### Archivos nuevos

- `src/pages/simulador-entrevistas/index.astro` · landing pública con hero,
  features, formulario de suscripción, y input de código para regresar.
- `src/pages/simulador-entrevistas/sesion.astro` · copia canónica del flujo de
  sesión (mismo componente que la beta previa, con los links internos ya
  apuntando a la ruta nueva).
- `src/pages/api/simulator-subscribe.ts` · endpoint POST que registra el lead,
  genera un código único (`SIM-XXXXXXXX`), escribe al KV `SIMULATOR_BETA_CODES`
  con prefix `beta:` (reutiliza la validación existente en `/api/simulator-session`)
  y dispara Postmark con el template `welcome-simulator-code`.

### Archivos legados con redirect 301

- `src/pages/simulador-entrevistas-beta/index.astro` · reemplazado por redirect
  a `/simulador-entrevistas/` preservando query string.
- `src/pages/simulador-entrevistas-beta/sesion.astro` · reemplazado por redirect
  a `/simulador-entrevistas/sesion` preservando `?codigo=` de los emails viejos.

### Bindings usados (ya existentes en `wrangler.jsonc`)

- `SIMULATOR_BETA_CODES` (KV) · guarda los códigos con prefix `beta:`.
- `EMAILS` (KV) · guarda los leads con prefix `sim:`.
- `POSTMARK_SERVER_TOKEN` (secret) · envío del welcome.
- `SIMULATOR_SESSIONS`, `SIMULATOR_METRICS`, `SIMULATOR_METRICS_DB` · sin cambios.

## Cohorte y regla del contador (Fase actual · pre-paywall)

- `cohort` = `pre-paywall`
- `max_sessions` = 1
- `expires_at` = **7 de septiembre de 2026 · 23:59 CDMX** (cierre de la fase libre)

**El contador `sessions_used` se incrementa SOLO cuando el usuario completa la
sesión y recibe el reporte final.** Si abre y abandona, o si el LLM/parser falla,
el código queda vivo para reintentar. Esto lo aplica
`/api/simulator-session.ts` al final de `handleNext` y `handleRetryReport` (ver
comentarios `NUEVO (19 ago 2026)` en esos handlers).

Consecuencias operativas:
- El copy visible en landing y email dice explícitamente "se cuenta únicamente
  cuando termines la entrevista y recibas tu reporte".
- No hay "regalo silencioso" ni cohortes dobles. Un solo cohort, un solo cuerpo
  de email, promesa clara.
- Post-sesión completa: seguimiento por email (24 h · pregunta de feedback;
  72 h · si respondió, sesión extra de cortesía). Pendiente de implementación.

## Fase próxima (desde 8 sept 2026 · post-paywall)

- La landing actual se reemplaza por una **página de producto tipo columnas**
  con tres planes (nombres finales por definir). El endpoint
  `/api/simulator-subscribe` se retira o se protege detrás del checkout.
- Un webhook nuevo (`/api/stripe-webhook`) crea el código al confirmar pago,
  con `max_sessions` y `expires_at` según el plan comprado.
- El mismo mecanismo de código con contador sirve: solo cambia el disparador
  (formulario libre → checkout Stripe).
- **Contador visible en UI**: cuando `max_sessions > 1`, la landing/sesión
  muestra "Sesión N de M · vence el X". En pre-paywall (una sesión) no se
  muestra porque es innecesario.

## Template Postmark requerido

Alias: `welcome-simulator-code` (ya cargado en Postmark).
Subject: `Tu código para el simulador Solca ({{ access_code }})`
Modelo simplificado (sin ramas):

```json
{
  "first_name": "María",
  "access_code": "SIM-ABCD2345",
  "access_url": "https://solcaciencia.com/simulador-entrevistas/sesion?codigo=SIM-ABCD2345",
  "expires_at_human": "7 de septiembre de 2026"
}
```

El HTML/texto actualizado del template está en
`_docs/POSTMARK_TEMPLATE_welcome-simulator-code.md`. Hay que **sobreescribir la
versión previa** cargada esta mañana (que tenía ramas `is_preview`/`is_freemium`).

## Deploy checklist (para correr en la máquina de Oscar)

1. Actualizar el template `welcome-simulator-code` en Postmark con la versión
   nueva del doc (sin ramas). Enviar un test a `hello@solcaciencia.com` con el
   payload de prueba para verificar el layout.
2. `npm run build` en `website/` (Oscar, no en sandbox).
3. `wrangler deploy` desde `website/`.
4. Correr `scripts/verify-simulator-deploy.sh` (7 checks automáticos + un
   POST con email real opcional).
5. Suscribirse desde la landing pública con un email de prueba, verificar que
   llega el email con el código correcto y que el link abre la sesión.
6. Arrancar una sesión completa y confirmar que `sessions_used` sube de 0 a 1
   solo al recibir el reporte final (revisar KV desde `/admin/beta-codes`).
7. Abrir otra sesión, abandonar a mitad, verificar que `sessions_used` NO
   subió (el código sigue con 1 sesión disponible).

## Regresiones a vigilar

- Códigos beta emitidos antes del switch siguen viviendo en `SIMULATOR_BETA_CODES`
  con prefix `beta:` y siguen funcionando; el redirect 301 preserva `?codigo=`.
- El endpoint admin `/admin/beta-codes.astro` lista todos los códigos con su
  cohort ahora poblado (`pre-paywall`, además de cohortes legadas anteriores).
- Los links del sprint LinkedIn septiembre en semanas 3-5 apuntan a
  `/simulador-entrevistas/`. La beta cerrada de las semanas 1-2 sigue viva
  vía redirect.
- El sistema anterior incrementaba el contador en `handleInit`; ahora ya no.
  Cualquier código emitido bajo la lógica anterior mantiene su
  `sessions_used` histórico; los nuevos códigos parten de 0 y solo suben al
  éxito del reporte.
