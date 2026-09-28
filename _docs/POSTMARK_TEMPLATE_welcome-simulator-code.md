# Postmark template · `welcome-simulator-code`

Template transaccional para el welcome del simulador. Se dispara desde
`/api/simulator-subscribe.ts` al momento de generar el código de acceso
(fase pre-paywall, hasta 7 sept 2026).

## Regla del contador

La sesión **se cuenta solo si el usuario completa la entrevista y recibe el
reporte final**. Si abre el simulador y abandona, o si el LLM falla, el
código queda vivo para reintentar. Esto lo aplica `/api/simulator-session`
al final de `handleNext` y `handleRetryReport`. El copy del email debe
comunicarlo con claridad para no generar ansiedad de "gasté mi intento".

## Metadatos del template en Postmark

- **Server:** Solca Ciencia (ID 20030569).
- **Alias:** `welcome-simulator-code`
- **Template type:** Layout + Content (o standalone). Ya cargado como standalone.
- **Subject:** `Tu código para el simulador Solca ({{ access_code }})`
- **From:** `Oscar Solís <hola@solcaciencia.com>`
- **Tag:** `welcome-simulator-code`

## Modelo de variables (mustache)

```json
{
  "first_name": "María",
  "access_code": "SIM-ABCD2345",
  "access_url": "https://solcaciencia.com/simulador-entrevistas/sesion?codigo=SIM-ABCD2345",
  "expires_at_human": "7 de septiembre de 2026"
}
```

Sin ramas `is_preview`/`is_freemium`. Un solo cuerpo, honesto y directo.

## Contenido HTML sugerido

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Tu código del simulador Solca</title>
</head>
<body style="margin:0;padding:0;background:#faf9f4;font-family:'Inter',Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e1d8;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0 0 8px;color:#4b5563;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">
                Solca Ciencia · Simulador de entrevistas
              </p>
              <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#111827;">
                Hola {{ first_name }}, aquí está tu código.
              </h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#4b5563;">
                Este código te da <strong>una sesión completa</strong> del simulador
                de entrevistas pharma. Se cuenta únicamente cuando termines la
                entrevista y recibas tu reporte final; si abres y te vas a mitad,
                el código sigue vivo. Válido hasta el
                <strong>{{ expires_at_human }}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.55;color:#4b5563;padding:12px 14px;border-left:3px solid #e77c3c;background:#fbf4ee;border-radius:6px;">
                Estás en la <strong>beta abierta</strong>. Lo único que te pedimos a
                cambio es tu retroalimentación al terminar la sesión — nos ayuda a
                mejorar el simulador antes del lanzamiento formal.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f4;border:1px dashed #e77c3c;border-radius:8px;">
                <tr>
                  <td align="center" style="padding:20px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#4b5563;text-transform:uppercase;letter-spacing:0.1em;">
                      Tu código
                    </p>
                    <p style="margin:0;font-family:'Space Grotesk',Arial,sans-serif;font-size:28px;font-weight:700;color:#111827;letter-spacing:0.06em;">
                      {{ access_code }}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 32px;">
              <a href="{{ access_url }}"
                 style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:600;font-size:15px;">
                Empezar mi sesión
              </a>
              <p style="margin:16px 0 0;font-size:12px;color:#4b5563;">
                O guarda este enlace para volver cuando estés listo:<br>
                {{ access_url }}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e5e1d8;background:#faf9f4;">
              <p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:#4b5563;">
                Qué esperar en la sesión:
              </p>
              <ul style="margin:0 0 12px 18px;padding:0;font-size:13px;line-height:1.55;color:#4b5563;">
                <li>Preguntas adaptadas a tu rol pharma (CRA, MSL, PM, Regulatory, etc.).</li>
                <li>Modo bilingüe: primera mitad en español, segunda en inglés.</li>
                <li>Reporte al final con scores de técnico, estructura y especificidad.</li>
              </ul>
              <p style="margin:0;font-size:12px;color:#4b5563;">
                ¿Dudas o problemas para entrar? Responde a este correo y te leo yo mismo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#faf9f4;">
              <p style="margin:0;font-size:11px;color:#4b5563;text-align:center;">
                Solca Ciencia · <a href="https://solcaciencia.com" style="color:#4b5563;">solcaciencia.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Contenido texto plano

```
Hola {{ first_name }},

Este código te da una sesión completa del simulador de entrevistas pharma. Se cuenta únicamente cuando termines la entrevista y recibas tu reporte final; si abres y te vas a mitad, el código sigue vivo.

Estás en la beta abierta. Lo único que te pedimos a cambio es tu retroalimentación al terminar la sesión — nos ayuda a mejorar el simulador antes del lanzamiento formal.

Código: {{ access_code }}
Válido hasta: {{ expires_at_human }}

Empezar la sesión (o guarda este enlace para volver cuando estés listo):
{{ access_url }}

Qué esperar:
- Preguntas adaptadas a tu rol pharma (CRA, MSL, PM, Regulatory).
- Modo bilingüe: mitad en español, mitad en inglés.
- Reporte al final con scores de técnico, estructura y especificidad.

¿Dudas o problemas para entrar? Responde a este correo.

Oscar
Solca Ciencia · solcaciencia.com
```

## Payload de test (uno solo, ya no hay dos variantes)

```json
{
  "first_name": "Test",
  "access_code": "SIM-TEST1234",
  "access_url": "https://solcaciencia.com/simulador-entrevistas/sesion?codigo=SIM-TEST1234",
  "expires_at_human": "7 de septiembre de 2026"
}
```

## Cambios respecto a la versión anterior (19 ago 2026)

- Eliminadas las ramas `{{#is_preview}}` / `{{#is_freemium}}`. Un solo cuerpo.
- Eliminadas las variables `cohort`, `max_sessions`, `is_preview`, `is_freemium`.
- Copy honesto: "una sesión completa" (no "1 sesión sin costo con regalo silencioso de 2").
- Copy nuevo: "se cuenta solo cuando recibas tu reporte" (transparencia sobre la regla del contador).
- CTA: "Empezar mi sesión" con hint explícito de "o guarda este enlace para volver cuando estés listo".
- Ya cargado en Postmark: la versión previa hay que sobreescribirla.
