# Template Postmark · `blog-broadcast-weekly`

> **Alias exacto:** `blog-broadcast-weekly` (así lo llama `src/pages/api/blog-broadcast.ts` línea 109).
> **Message stream:** `broadcast` (separado del transactional).
> **Variables Mustachio:** `{{blog_title}}`, `{{blog_hook}}`, `{{blog_url}}`, `{{first_name}}`.

Este archivo tiene el contenido listo para pegar en Postmark. Se creó el 22 jul 2026 cuando armamos el cron del blog semanal Vie 8am CDMX.

---

## Pasos en el dashboard Postmark

1. Login → tu Server para `solcaciencia.com`.
2. Sidebar → **Message Streams**. Si no existe uno llamado `broadcast`, crea uno: **Add stream** → tipo **Broadcast** → nombre `Broadcast` → ID `broadcast`. Confirma.
3. Sidebar → **Templates** → **Add template** → **Code your own** → **Standard template**.
4. Nombre: `Blog broadcast semanal`. Alias: `blog-broadcast-weekly` (crítico, así se llama en el código).
5. Pega **Subject**, **HTML** y **Text** de las secciones de abajo.
6. En Preview, usa el JSON de prueba de la sección "Test data" y verifica que se rendericen las variables. Guardar.

---

## Subject

```
{{blog_title}}
```

---

## HTML body

```html
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937; line-height: 1.6; background: #ffffff;">

  <div style="border-bottom: 3px solid #e77c3c; padding-bottom: 12px; margin-bottom: 24px;">
    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Solca Insight · nuevo en el blog</p>
  </div>

  {{#first_name}}<p style="margin: 0 0 16px 0; font-size: 16px;">Hola {{first_name}},</p>{{/first_name}}

  <h1 style="font-size: 24px; margin: 0 0 16px 0; color: #1f2937; line-height: 1.3;">{{blog_title}}</h1>

  <p style="margin: 0 0 24px 0; font-size: 16px;">{{blog_hook}}</p>

  <p style="margin: 24px 0;">
    <a href="{{blog_url}}" style="background: #e77c3c; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; display: inline-block;">Leer el blog completo</a>
  </p>

  <p style="margin-top: 32px; font-size: 14px; color: #6b7280;">
    Oscar<br>
    <a href="https://solcaciencia.com" style="color: #e77c3c; text-decoration: none;">Solca Ciencia</a>
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px 0;">

  <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
    Recibes este correo porque te suscribiste en solcaciencia.com.<br>
    <a href="{{{ pm:unsubscribe }}}" style="color: #9ca3af;">Cancelar suscripción</a>
  </p>

</body>
</html>
```

---

## Text body

```
{{blog_title}}

{{#first_name}}Hola {{first_name}},

{{/first_name}}{{blog_hook}}

Leer el blog completo: {{blog_url}}

—
Oscar
Solca Ciencia
https://solcaciencia.com

—
Recibes este correo porque te suscribiste en solcaciencia.com.
Cancelar suscripción: {{{ pm:unsubscribe }}}
```

---

## Test data (para Preview en Postmark)

```json
{
  "first_name": "María",
  "blog_title": "Cómo leer un job posting pharma antes de aplicar",
  "blog_hook": "Los requisitos duros vs los deseables. Aplicar mejor rinde más que aplicar más. Cinco criterios operativos para decidir en 60 segundos si vale la pena mandar tu CV o pasar…",
  "blog_url": "https://solcaciencia.com/blog/como-leer-un-job-posting-pharma-antes-de-aplicar"
}
```

Con este JSON el preview debe mostrar: saludo "Hola María", título, hook, botón naranja "Leer el blog completo" apuntando al URL, firma, y link de unsubscribe.

Si `first_name` viene vacío (que es lo que hoy manda el broadcast, línea 111 del código: `first_name: firstName ?? ''`), el saludo entero se omite gracias al bloque `{{#first_name}}…{{/first_name}}`.

---

## Después de guardar el template

Nada más que hacer en Postmark. El código ya está listo:

- `src/pages/api/blog-broadcast.ts` → construye el TemplateModel con las 4 variables.
- `scripts/patch-cron-handler.mjs` v3 → rutea el cron `0 14 * * 5` (Vie 8am CDMX) a `/api/blog-broadcast` con el header `x-broadcast-secret`.
- `wrangler.jsonc` → tiene el cron trigger declarado.

Solo faltan dos secretos en Cloudflare (los pone Oscar):

```
cd /Users/oscar/Downloads/solca/website
openssl rand -hex 32
npx wrangler secret put BROADCAST_SECRET   # pega el valor generado
npx wrangler deploy
```

`POSTMARK_SERVER_TOKEN` ya está seteado desde la migración Brevo → Postmark del 21 jul.
