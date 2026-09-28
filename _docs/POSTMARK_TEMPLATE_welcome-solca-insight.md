# Postmark template · `welcome-solca-insight`

Fuente de verdad del contenido del welcome email disparado desde:
- `src/pages/api/cv-review.ts` — `tag: 'welcome-cv'`, `is_cv=true`
- `src/pages/api/quiz-subscribe.ts` — `tag: 'welcome-quiz'`, `is_quiz=true`

**Ambos handlers usan el mismo `templateAlias: 'welcome-solca-insight'`** — la personalización vive en las variables del `templateModel` y los bloques condicionales del template.

---

## Variables que recibe el template

| Variable | Origen | Ejemplo |
|---|---|---|
| `first_name` | Nombre del usuario (opcional, puede venir vacío) | `Claudia` |
| `is_cv` | `true` si viene de CV Review | `true` / `false` |
| `is_quiz` | `true` si viene de Quiz Match | `true` / `false` |
| `role_label` | Solo cuando `is_quiz`: nombre humano del rol match | `Project Manager clínico` · `Medical Science Liaison` · `Clinical Research` · `Farmacovigilancia` · `Life Sciences Consulting` |
| `cta_url` | Solo cuando `is_quiz`: URL del simulador con módulo pre-seleccionado + UTM | `https://solcaciencia.com/simulador-entrevistas/?modulo=fv&utm_source=email&utm_medium=welcome-quiz&utm_campaign=welcome-quiz-cta&utm_content=rol-fv` |
| `cta_label` | Solo cuando `is_quiz`: texto del botón CTA | `Practica preguntas de Farmacovigilancia` |
| `role_next_step` | Solo cuando `is_quiz`: 1 línea descriptiva del próximo paso | `Simulador con módulo Farmacovigilancia: 5 preguntas de screening en CRO/BPO (freemium, sin costo).` |

**Nota**: el `role_label` y el mapeo módulo-CTA quedan hardcodeados en `quiz-subscribe.ts:CTA_BY_ROLE`. Para agregar un nuevo rol al futuro (Regulatory, HEOR, etc.), editar ese objeto + el `QuizRole` type.

---

## HTML propuesto (pegar en Postmark UI → welcome-solca-insight → HTML body)

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Bienvenida · Solca Insight</title>
<style>
  body { margin: 0; padding: 0; background: #f6efe6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1b3a6b; line-height: 1.55; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; }
  h1 { font-size: 22px; color: #1b3a6b; margin: 0 0 16px; }
  p { font-size: 15px; color: #2d3748; margin: 0 0 14px; }
  .btn { display: inline-block; background: #e8743a; color: #ffffff !important; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 14px 0; }
  .next-step { background: #f6efe6; border-left: 3px solid #e8743a; padding: 12px 14px; margin: 14px 0; font-size: 14px; color: #1b3a6b; }
  .footer { font-size: 12px; color: #667085; margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  a { color: #1b3a6b; }
</style>
</head>
<body>
<div class="wrap">

<p>Hola{{#first_name}} {{first_name}}{{/first_name}},</p>

{{#is_cv}}
<h1>Gracias por probar el Revisor de CV</h1>

<p>Tu análisis de CV ya se procesó y te lo enviamos en un email aparte. Este email es para presentarte lo que sigue.</p>

<p>Cada semana publico un Solca Insight: un análisis corto, con dato citable, sobre carrera en pharma LATAM. La próxima entrega te llega el viernes por la mañana. Si en algún momento no te aporta, la baja está al pie de cada email.</p>

<p>Mientras tanto, dos recursos que quizá te sirvan:</p>

<p>
<a class="btn" href="https://solcaciencia.com/quiz-rol?utm_source=email&utm_medium=welcome-cv&utm_campaign=welcome-cv-cta&utm_content=quiz">Toma el quiz de rol pharma →</a>
</p>

<p>Once preguntas para saber cuál de los cinco roles pharma LATAM (PM clínico, MSL, Clinical Research, Farmacovigilancia, Life Sciences Consulting) es tu mejor match. Tres minutos, resultado inmediato.</p>

<p>Y si tu CV sale con "revisar palabras clave" en el análisis, el <a href="https://solcaciencia.com/blog/13-acronimos-pharma-cv-phd?utm_source=email&utm_medium=welcome-cv&utm_content=blog-acronimos">post sobre las 13 siglas pharma para incluir en el CV</a> cubre lo que el ATS busca.</p>
{{/is_cv}}

{{#is_quiz}}
<h1>Tu match del quiz: {{role_label}}</h1>

<p>Salió <strong>{{role_label}}</strong> como tu match más fuerte del quiz. Eso significa que, entre los cinco roles pharma LATAM que cubrimos, tu perfil natural encaja mejor con ese.</p>

<p>El resultado detallado ya te lo mostramos en el quiz mismo. Este email es para que tengas a mano el próximo paso concreto.</p>

<div class="next-step">
{{role_next_step}}
</div>

<p>
<a class="btn" href="{{cta_url}}">{{cta_label}} →</a>
</p>

<p>Cada semana publico un Solca Insight con dato citable sobre carrera en pharma LATAM — vacantes reales, salarios verificables, patrones que veo en el simulador. La próxima entrega te llega el viernes por la mañana.</p>

<p>Si el match del quiz no te resonó, respondé este email con la línea que más te chocó del resultado y lo revisamos. Ninguna respuesta se pierde: leo cada una.</p>
{{/is_quiz}}

<div class="footer">
— Oscar Solís · Solca Ciencia<br />
<a href="https://solcaciencia.com">solcaciencia.com</a><br /><br />
Recibiste este email porque te suscribiste al Solca Insight en solcaciencia.com. <a href="{{{ pm:unsubscribe }}}">Darme de baja</a>.
</div>

</div>
</body>
</html>
```

---

## Text body (versión plain-text para clientes sin HTML)

```text
Hola{{#first_name}} {{first_name}}{{/first_name}},

{{#is_cv}}
Gracias por probar el Revisor de CV.

Tu análisis ya se procesó y te lo enviamos en un email aparte. Este email es para presentarte lo que sigue.

Cada semana publico un Solca Insight: un análisis corto, con dato citable, sobre carrera en pharma LATAM. La próxima entrega te llega el viernes por la mañana. Si no te aporta, la baja está al pie de cada email.

Mientras tanto, dos recursos que quizá te sirvan:

1. Toma el quiz de rol pharma (11 preguntas, 3 minutos, resultado inmediato):
   https://solcaciencia.com/quiz-rol?utm_source=email&utm_medium=welcome-cv&utm_campaign=welcome-cv-cta&utm_content=quiz

2. Post sobre las 13 siglas pharma para incluir en el CV:
   https://solcaciencia.com/blog/13-acronimos-pharma-cv-phd
{{/is_cv}}

{{#is_quiz}}
Tu match del quiz: {{role_label}}

Salió {{role_label}} como tu match más fuerte. Eso significa que, entre los cinco roles pharma LATAM que cubrimos, tu perfil natural encaja mejor con ese.

Próximo paso:
{{role_next_step}}

{{cta_label}}:
{{cta_url}}

Cada semana publico un Solca Insight con dato citable sobre carrera en pharma LATAM. La próxima entrega te llega el viernes por la mañana.

Si el match del quiz no te resonó, respondé este email con la línea que más te chocó del resultado y lo revisamos. Leo cada respuesta.
{{/is_quiz}}

— Oscar Solís · Solca Ciencia
solcaciencia.com

Recibiste este email porque te suscribiste al Solca Insight en solcaciencia.com. Darme de baja: {{{ pm:unsubscribe }}}
```

---

## Subject line propuesto

Variable en Postmark UI (Subject field):

```
{{#is_cv}}Bienvenida a Solca Insight · gracias por probar el Revisor de CV{{/is_cv}}{{#is_quiz}}Tu match: {{role_label}} · Solca Insight{{/is_quiz}}
```

Nota: Postmark permite un solo Subject field. Si el bloque `{{#is_cv}}...{{/is_cv}}` no evalúa bien en Subject (algunas versiones del engine lo hacen literal), usar 2 templates separados (`welcome-cv` y `welcome-quiz`) con subjects fijos.

---

## Cambios versus versión anterior

- Añadidos placeholders `{{cta_url}}`, `{{cta_label}}`, `{{role_next_step}}` en la rama `is_quiz` (antes no había CTA claro; reporte semanal 2026-09-28 mostraba `welcome-quiz` con 12.5% clic vs `welcome-cv` con 78.6%).
- Actualizado el pitch del quiz para reflejar 5 roles (antes eran 3): PM clínico, MSL, Clinical Research, Farmacovigilancia, Life Sciences Consulting.
- Ambos flujos (CV y Quiz) invitan al otro flujo como recurso complementario.
- Añadida la línea "respondé este email si el match no resonó" como retroalimentación editorial (subir engagement + captar feedback de calibración del quiz).

## Cómo verificar después de deploy

1. Postmark UI → Templates → welcome-solca-insight → Preview con `templateModel`:
   ```json
   {
     "first_name": "Claudia",
     "is_quiz": true,
     "is_cv": false,
     "role_label": "Farmacovigilancia",
     "cta_url": "https://solcaciencia.com/simulador-entrevistas/?modulo=fv&utm_source=email&utm_medium=welcome-quiz&utm_campaign=welcome-quiz-cta&utm_content=rol-fv",
     "cta_label": "Practica preguntas de Farmacovigilancia",
     "role_next_step": "Simulador con módulo Farmacovigilancia: 5 preguntas de screening en CRO/BPO (freemium, sin costo)."
   }
   ```
   Debe renderizar el nombre del rol en el h1, el CTA button, y el bloque `role_next_step`.
2. Tomar el quiz en producción con match FV → verificar en Postmark Activity que llegó con el CTA correcto.
3. Reportar en el weekly-report: la métrica `welcome-quiz` clic esperada suba de 12.5% a ~40-70% (calibrada contra `welcome-cv` que hoy está en 78.6%).
