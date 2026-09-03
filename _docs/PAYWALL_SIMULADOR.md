# PAYWALL_SIMULADOR · flujo completo

> **Establecido:** 2 sept 2026
> **Deploy target:** antes del 8 sept 2026 (cierre fase pre-paywall)
> **Provider:** Stripe (checkout hosted + webhook)
> **Moneda:** MXN
> **Modo:** empieza en Test, se promueve a Live cuando pase QA

Este documento es el contrato de implementación. Cualquier decisión que no esté aquí es error de diseño, no de código.

---

## 1 · Planes

| | Freemium | Básico | Premium |
|---|---|---|---|
| Precio | $0 MXN | **$149 MXN** (one-shot) | **$299 MXN** (one-shot) |
| Sesiones incluidas | 1 | 3 | 8 |
| Etapa permitida | Solo `phone_screen` (5 preguntas) | Cualquiera (5/10/15) | Cualquiera |
| CV upload | Sí | Sí | Sí (distinto por sesión, historial guardado) |
| Modo A (vacante) | Solo título | Título + empresa + descripción completa | Igual básico |
| Idioma | Español / Inglés / Bilingüe | Igual | Igual |
| Reporte leyenda | Estándar | Estándar | **Extendida** (rúbrica visible + tips por dimensión baja) |
| Dificultad | `moderado` fijo | `moderado` fijo | `moderado` / `exigente` / `muy_exigente` (usuario elige) |
| CTA reporte final | Upsell Básico | Curso Solca + libros por rol | Curso Solca + libros por rol |
| Historial personal | Última sesión | Últimas 3 | Últimas 8 con etiqueta CV/vacante |
| Vigencia créditos | 240 días | 240 días | 240 días |
| Recompra | N/A (solo 1 gratis) | Sí | Sí |

**Regla dura:** ningún plan promete comparación automática entre sesiones. El historial es visual; el usuario compara por su cuenta. Mecanismo 5 (comparación auto) queda para v1.0 cuando haya n≥50.

**Regla dura:** ningún CTA menciona consultoría. Solo curso Solca (Hotmart) o libros por rol.

---

## 2 · Schema de tipos

`src/lib/simulator-types.ts`:

```typescript
export type Plan = 'gratis' | 'basico' | 'premium';

export interface PlanConfig {
  plan: Plan;
  sessionsIncluded: number;
  allowedStages: InterviewStage[];
  allowsCv: boolean;
  allowsFullVacancy: boolean; // Modo A completo (título + empresa + descripción)
  allowedDifficulties: DifficultyLevel[];
  reportLegend: 'standard' | 'extended';
  ctaTarget: 'upsell_basico' | 'course_solca';
  historyDepth: number;
  vigenciaDias: number;
}

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  gratis: {
    plan: 'gratis',
    sessionsIncluded: 1,
    allowedStages: ['phone_screen'],
    allowsCv: true,
    allowsFullVacancy: false,
    allowedDifficulties: ['moderado'],
    reportLegend: 'standard',
    ctaTarget: 'upsell_basico',
    historyDepth: 1,
    vigenciaDias: 240,
  },
  basico: {
    plan: 'basico',
    sessionsIncluded: 3,
    allowedStages: ['phone_screen', 'technical_round', 'panel_round', 'general_practice'],
    allowsCv: true,
    allowsFullVacancy: true,
    allowedDifficulties: ['moderado'],
    reportLegend: 'standard',
    ctaTarget: 'course_solca',
    historyDepth: 3,
    vigenciaDias: 240,
  },
  premium: {
    plan: 'premium',
    sessionsIncluded: 8,
    allowedStages: ['phone_screen', 'technical_round', 'panel_round', 'general_practice'],
    allowsCv: true,
    allowsFullVacancy: true,
    allowedDifficulties: ['moderado', 'dificil', 'experto'],
    reportLegend: 'extended',
    ctaTarget: 'course_solca',
    historyDepth: 8,
    vigenciaDias: 240,
  },
};
```

---

## 3 · KV bindings

| Binding | Prefix | Valor | TTL |
|---|---|---|---|
| `SIMULATOR_CREDITS` | `credits:{user_hash}` | `{plan, remaining, purchasedAt, expiresAt}` JSON | 240d |
| `SIMULATOR_BETA_CODES` | `beta:{code}` | Legacy — se sigue leyendo pero no se crean nuevos post-8-sept | — |
| `EMAILS` | `sim:{email}` | Lead del simulador | — |
| `SIMULATOR_USER_HISTORY` | `hist:{user_hash}:{sessionId}` | Snapshot: fecha, rol, etapa, CV name, 4 scores, 3 áreas mejora | 240d |
| `STRIPE_CHECKOUT_SESSIONS` | `cs:{stripe_session_id}` | Dedup del webhook | 7d |

`user_hash` = SHA-256(email lowercased) primeros 16 chars. Consistente con lo que ya usamos en cv-metrics.

---

## 4 · Endpoints nuevos

### `POST /api/simulator-checkout`

Body: `{plan: 'basico' | 'premium', email: string}`.

1. Valida email formato.
2. Lookup price_id según `PLAN_TO_PRICE_ID` (env var).
3. Crea Stripe Checkout Session:
   - `mode: 'payment'` (one-shot, no subscription)
   - `line_items: [{price: priceId, quantity: 1}]`
   - `customer_email: email`
   - `metadata: {email, plan, source: 'simulator'}`
   - `success_url: https://solcaciencia.com/simulador-entrevistas/gracias?session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url: https://solcaciencia.com/simulador-entrevistas/`
4. Devuelve `{url: session.url}`.
5. Frontend hace `window.location = url`.

### `POST /api/simulator-stripe-webhook`

Recibe `checkout.session.completed`.

1. Verifica firma con `STRIPE_WEBHOOK_SECRET`.
2. Idempotencia: si `cs:{session.id}` existe en `STRIPE_CHECKOUT_SESSIONS`, retorna 200 sin repetir.
3. Extrae `email`, `plan` de metadata.
4. Genera `user_hash = sha256(email).slice(0,16)`.
5. Escribe a `SIMULATOR_CREDITS`:
   ```json
   {
     "plan": "basico",
     "remaining": 3,
     "purchasedAt": "2026-09-08T14:32:00Z",
     "expiresAt": "2027-05-06T14:32:00Z"
   }
   ```
   Si ya existe un record del mismo user (recompra), sumar `remaining` y usar el `expiresAt` mayor.
6. Envía email via Postmark template `simulator-purchase-confirmation` con `{first_name, plan_label, sessions_included, access_url}`.
7. Marca `cs:{session.id}` en `STRIPE_CHECKOUT_SESSIONS` con TTL 7d.

### `GET /api/simulator-credits?email=...`

Devuelve `{plan, remaining, expiresAt}` para el frontend, protegido por rate limit.

---

## 5 · Gating en `simulator-session.ts`

`handleInit` cambios:

1. Recibe `email` en body (obligatorio para free/basico/premium).
2. Lookup en `SIMULATOR_CREDITS` con `user_hash(email)`.
   - Si no existe → asigna plan free por defecto (registra en KV con `remaining: 1`).
   - Si existe pero expirado → responde `errorCode: 'credits_expired'` con CTA a upsell.
   - Si existe pero remaining=0 → responde `errorCode: 'credits_exhausted'`.
3. Aplica `PLAN_CONFIG[plan]` para validar profile:
   - `profile.interviewStage` debe estar en `allowedStages` (freemium force phone_screen).
   - `profile.difficulty` debe estar en `allowedDifficulties` (freemium force moderado).
   - Si `!allowsCv` y `cvSummary` presente → ignorar CV (log warn).
   - Si `!allowsFullVacancy` y `profile.mode === 'A'` → recortar a solo `roleTitle`, borrar `company` y `vacancyText`.
4. Al completar reporte final → decrementa `remaining` en `SIMULATOR_CREDITS`.
5. Snapshot en `SIMULATOR_USER_HISTORY` (todos los planes; freemium se limita en la vista al último).

Reemplaza el mecanismo actual de `SIMULATOR_BETA_CODES` (que sigue funcionando en paralelo hasta migrar todos los códigos beta).

---

## 6 · Frontend

### Landing `/simulador-entrevistas/` (rediseño)

- Hero nuevo: "Practica tu entrevista pharma con feedback estructurado. Tres planes, un método."
- Sección de 3 planes con tabla comparativa (columnas Freemium / Básico / Premium).
- CTA de cada plan:
  - Freemium: "Empezar sin costo" → formulario email → llama `/api/simulator-subscribe` con `plan=free`.
  - Básico: "Comprar $149 MXN" → formulario email → llama `/api/simulator-checkout` con `plan=basico`.
  - Premium: "Comprar $299 MXN" → mismo → `plan=premium`.

### `/simulador-entrevistas/gracias`

Página post-checkout. Lee `session_id` de query, hace fetch `/api/simulator-credits?email=...` (o mejor: el webhook ya escribió, esta página solo confirma). Muestra:
- "Compra confirmada"
- "Ya te llegó un correo con tu acceso"
- Botón "Empezar mi primera sesión" → `/simulador-entrevistas/sesion?email=...`

### `/simulador-entrevistas/mi-historial` (nueva)

Lee `SIMULATOR_USER_HISTORY` por `user_hash(email)`, limita según `historyDepth`. Tabla con fecha, rol, etapa, CV, 4 scores.

---

## 7 · Secrets

En `wrangler.jsonc` `[vars]` o via `wrangler secret put`:

- `STRIPE_SECRET_KEY` (test/live)
- `STRIPE_WEBHOOK_SECRET` (endpoint signing secret que Stripe genera al configurar el webhook)
- `STRIPE_PRICE_ID_BASICO`
- `STRIPE_PRICE_ID_PREMIUM`
- `POSTMARK_SERVER_TOKEN` (ya existe)

---

## 8 · Testing

Antes de deploy live:

1. **Setup script:** `node scripts/setup-stripe-products.mjs` crea products/prices en Test. Copia price_ids a wrangler secrets.
2. **Checkout test:** `curl -X POST /api/simulator-checkout -d '{"plan":"basico","email":"test@solcaciencia.com"}'` → sigue el URL, usa tarjeta test `4242 4242 4242 4242` cualquier fecha futura CVV cualquiera.
3. **Webhook local:** `stripe listen --forward-to localhost:8788/api/simulator-stripe-webhook`.
4. **KV verify:** `wrangler kv key get "credits:$(echo -n test@solcaciencia.com | shasum | head -c 16)" --binding=SIMULATOR_CREDITS --remote`.
5. **Session init con freemium:** crear un usuario nuevo → `/api/simulator-session` con `action: 'init'` sin email previo → debe asignar `plan=free`, `remaining=1`, forzar phone_screen.
6. **Session init con básico exhausted:** simular 3 sesiones completadas → 4a debe responder `credits_exhausted`.

---

## 9 · Edge cases

- **Recompra:** usuario básico compra otro básico → suma 3+3=6 remaining, expiresAt = max(current, new).
- **Cross-upgrade:** usuario básico compra premium → suma remaining, plan = 'premium' (upgrade nunca downgrade).
- **Email typo en checkout:** Stripe recibe email A pero webhook escribe a A. Si el usuario intenta login con email B, no encuentra créditos. Fix: página `/simulador-entrevistas/reenviar-acceso` con lookup por Stripe customer email (llama Stripe API).
- **Chargeback / refund:** Postmark webhook `charge.refunded` → marcar `remaining: 0` en KV + email de confirmación de reembolso.
- **Expiración a 240d:** cron diario que marca expired sin borrar el record (para trazabilidad).

---

## 10 · Rollback

Si algo sale mal post-deploy:

1. **Nivel 1:** desactivar botones "Comprar" en landing con feature flag (`ENABLE_CHECKOUT=false` en env). Freemium sigue funcionando.
2. **Nivel 2:** revertir landing al hero pre-paywall temporalmente (git revert del PR de landing).
3. **Nivel 3:** apagar webhook en Stripe dashboard. Ningún checkout completado escribe créditos hasta reactivar.
4. Los usuarios con checkout completado antes del rollback ya tienen créditos escritos en KV; no se pierden.

---

## 11 · Post-deploy · plan de correos freemium (task #63)

Serie automatizada post-`plan=free`:

| Día | Trigger | Template Postmark | Objetivo |
|---|---|---|---|
| D+0 | Suscripción freemium | `simulator-welcome-free` | Código + link a sesión |
| D+3 | Si `remaining=1` (no ha usado) | `simulator-nudge-free-d3` | Recordatorio suave + tip preparación |
| D+7 | Si `remaining=1` | `simulator-nudge-free-d7` | Segundo recordatorio + link a blog "preparar entrevista pharma" |
| D+14 | Si completó freemium | `simulator-upsell-basico-d14` | Upsell $149 con resumen scores de su freemium |
| D+21 | Si compró básico y `remaining>0` sin usar | `simulator-nudge-basico` | Recordatorio + curso Solca |
| D+180 | Cualquier plan | `simulator-expiry-warning` | Aviso "quedan 60 días para usar créditos" |

---

## 12 · Referencias

- `_docs/SIMULADOR_LANDING_2026_08_19.md` · landing pública actual.
- `_docs/SIMULADOR_ENTREVISTAS_ADDENDUM.md` · reglas P-1/P-2/P-3 de producto.
- `_docs/POSTMARK_TEMPLATE_welcome-simulator-code.md` · pattern para nuevos templates.
- `src/pages/api/simulator-subscribe.ts` · endpoint que se modifica para aceptar `plan=free`.
- `src/pages/api/simulator-session.ts` · endpoint que se modifica para gating por plan.
