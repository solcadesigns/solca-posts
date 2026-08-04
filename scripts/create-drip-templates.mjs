#!/usr/bin/env node
/**
 * scripts/create-drip-templates.mjs · 4 ago 2026
 *
 * Crea (o actualiza) los 8 templates del drip de bienvenida Postmark:
 *   drip-cv-d3, drip-cv-d7, drip-cv-d12, drip-cv-d20,
 *   drip-quiz-d3, drip-quiz-d7, drip-quiz-d12, drip-quiz-d20.
 *
 * Referencia de copy: _docs/DRIP_BIENVENIDA_POSTMARK.md
 * Referencia de mecánica: src/pages/api/drip-tick.ts
 *
 * Uso:
 *   POSTMARK_SERVER_TOKEN=<token> node scripts/create-drip-templates.mjs
 *
 * El token es el SERVER token (no account token). Se saca de:
 *   https://account.postmarkapp.com/servers/20030569/credentials
 *
 * Idempotente: si el alias ya existe, hace EDIT (PUT) en vez de POST.
 *
 * Merge tags que espera cada template (los envía drip-tick.ts):
 *   {{first_name}}   — primer nombre (puede venir vacío)
 *   {{role_label}}   — solo track quiz: "Medical Science Liaison", etc.
 *   {{role_slug}}    — solo track quiz: "msl", "cra", "pm"
 *   {{site_origin}}  — https://solcaciencia.com
 *   {{unsub_url}}    — URL absoluto al kill switch, firmado con HMAC
 */

const API = 'https://api.postmarkapp.com';
const TOKEN = process.env.POSTMARK_SERVER_TOKEN;

if (!TOKEN) {
  console.error('ERROR: POSTMARK_SERVER_TOKEN no está en env.');
  console.error('Uso: POSTMARK_SERVER_TOKEN=<token> node scripts/create-drip-templates.mjs');
  console.error('Sacar token de: https://account.postmarkapp.com/servers/20030569/credentials');
  process.exit(1);
}

// ── Copy · Track CV ──────────────────────────────────────────────────

const dripCvD3 = {
  alias: 'drip-cv-d3',
  name: 'Drip CV · día 3 · error #1 en CV PhD',
  subject: 'El error #1 en CV PhD LATAM',
  textBody: `Hola {{first_name}},

Tres días después de mandar tu CV a Solca Ciencia. Va una observación breve.

El error que más veo en CVs de PhD y posdoc que apuntan a industria pharma LATAM: la sección de experiencia describe lo que hiciste como investigador, pero no traduce el output a lo que la industria compra.

"Publiqué 3 artículos indexados" es dato de academia. Lo que industria pharma lee es: "generé evidencia sobre X en Y personas y presenté los resultados en formato de decisión ejecutiva a Z audiencias".

Esta semana, si tienes 20 minutos, agarra tu CV y reescribe una sola bala así. Solo una. La diferencia es medible en la primera respuesta que recibas.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}
Sigues suscrito al newsletter Solca Insight aparte.`,
};

const dripCvD7 = {
  alias: 'drip-cv-d7',
  name: 'Drip CV · día 7 · filtros ATS',
  subject: 'Cómo pasar filtros ATS sin trucos de keyword stuffing',
  textBody: `{{first_name}},

Una semana. Tu CV probablemente ya pasó por 1-2 filtros ATS. Estos filtros no son mágicos, pero sí son literales: hacen match entre palabras del posting y palabras del CV.

Cinco ajustes que sí mueven la aguja, sin caer en keyword stuffing (que las reclutadoras ven a la primera):

1. Poner el título exacto de la vacante en tu headline si es honesto.
2. Sacrificar 2-3 responsibilities de bullet points para incluir la habilidad textual del posting.
3. Ordenar la experiencia por relevancia al rol, no por cronología pura, si la más reciente no es la más pertinente.
4. Reescribir tu formación en el idioma del posting (bilingüe puede ser CV en español con títulos técnicos en inglés).
5. Verificar que tu PDF sea seleccionable (no imagen escaneada). Los ATS no leen imágenes.

Escribí los cinco con más contexto y ejemplos aquí: {{site_origin}}/blog/cv-pharma-cinco-ajustes-desde-phd

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}`,
};

const dripCvD12 = {
  alias: 'drip-cv-d12',
  name: 'Drip CV · día 12 · pitch curso',
  subject: 'El curso de CV pharma existe, y lo hice porque me hartó ver el mismo error',
  textBody: `{{first_name}},

Doce días. Si estás aquí porque tu CV no está funcionando, y ya probaste los ajustes de los emails anteriores sin ver cambio, es momento de considerar trabajarlo con guía estructurada.

Hice un curso de CV pharma con:

- Framework paso a paso para reescribir un CV académico en formato industria.
- Diez ejemplos anonimizados de antes/después de candidatos LATAM reales.
- Plantilla ATS-friendly (Word, no template raro que se rompe al abrir).
- Sección sobre cover letter que sí se lee (la mayoría de guías la ignoran).

Precio de lanzamiento: MXN $999 (regular $1,499). Garantía 30 días completos: si el curso no te sirve, te devuelvo el dinero sin preguntas.

{{site_origin}}/curso-cv

No es para todos. Si tu CV ya está funcionando y tienes 30% de respuestas o más, no lo compres. Si estás por debajo de eso, probablemente sí te ayuda.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}`,
};

const dripCvD20 = {
  alias: 'drip-cv-d20',
  name: 'Drip CV · día 20 · cierre',
  subject: 'Por qué construí Solca Ciencia (y qué sigue si el CV no es el bloqueo)',
  textBody: `{{first_name}},

Veinte días. Este es el último email de la secuencia de bienvenida.

Construí Solca Ciencia porque, después de años entrevistando candidatos PhD para industria pharma en LATAM, vi el mismo patrón: gente talentosa que se quedaba fuera no por falta de fondo científico, sino por no saber traducir su perfil al lenguaje que la industria compra.

Los recursos existían, pero fragmentados, mal etiquetados, escritos para gente que ya está adentro. Solca Ciencia intenta cerrar esa brecha con contenido directo, herramientas gratis (revisar CV, quiz de rol, simulador entrevistas) y guías pagadas cuando quieres profundizar.

Si el CV no es tu bloqueo real, aquí lo que puede serlo y con qué recurso lo atacas:

- No sabes qué rol te queda: {{site_origin}}/quiz-rol
- Sabes el rol pero no tienes práctica de entrevista: {{site_origin}}/simulador-entrevistas
- El bloqueo es de red / contactos: revisa los posts de LinkedIn en el blog ({{site_origin}}/blog).

Si algo de todo esto te ha servido, contéstame este email y dime qué. Leo todas las respuestas.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}`,
};

// ── Copy · Track Quiz ────────────────────────────────────────────────

const dripQuizD3 = {
  alias: 'drip-quiz-d3',
  name: 'Drip Quiz · día 3 · profundizar en el rol',
  subject: 'Tu rol asignado por el quiz: {{role_label}}. Aquí más contexto.',
  textBody: `{{first_name}},

Tres días desde que hiciste el quiz. El rol que más se ajusta a tu perfil fue {{role_label}}.

Un rol no es un título. Es una decisión diaria sobre en qué gastas tu tiempo. {{role_label}} implica un tipo específico de trabajo que quizás no viste en la descripción corta del resultado del quiz.

Escribí una guía detallada del rol pensada para gente que sale de academia y está evaluando entrar: qué pide un posting real, qué NO se dice en el JD, y cómo verificar si de verdad te queda antes de invertir semanas en la aplicación.

Léela aquí: {{site_origin}}/blog/como-ser-{{role_slug}}-en-mexico

Si después de leerla el rol no te queda tan bien como el quiz sugirió, es información valiosa. El quiz es una hipótesis; la guía es el reality check.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}`,
};

const dripQuizD7 = {
  alias: 'drip-quiz-d7',
  name: 'Drip Quiz · día 7 · rutas de entrada',
  subject: 'Cómo entrar a {{role_label}} desde donde estás hoy',
  textBody: `{{first_name}},

Una semana. Asumo que ya leíste la guía del rol {{role_label}} y que sigues con interés. La pregunta ahora es: cómo entrar desde donde estás hoy.

Hay tres rutas de entrada realistas a {{role_label}} en LATAM:

1. Directa · aplicar a vacantes junior o entry-level de {{role_label}} en empresas que sí contratan sin experiencia previa en industria (típicamente CROs multinacionales o farma local con programas de entrenamiento).
2. Adyacente · entrar primero a un rol vecino (Regulatory, Medical Affairs Coordinator, In-house CRA según el caso) y transicionar en 12-18 meses.
3. Vía posgrado · si la ruta directa no está funcionando, un MBA con enfoque salud o una maestría específica del rol puede desbloquear la ventana de entrada, pero es una inversión de tiempo y dinero que hay que justificar.

Qué ruta te queda depende de: tu formación, tu geografía, tu inglés, tu tolerancia a viajar, y tu urgencia financiera. Ninguna es "la buena" en abstracto.

Si quieres discutir cuál ruta te queda, contéstame este email con tu contexto en 3-4 líneas y te doy mi lectura franca (gratis, no es un pitch).

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}`,
};

const dripQuizD12 = {
  alias: 'drip-quiz-d12',
  name: 'Drip Quiz · día 12 · pitch libro del rol',
  subject: 'El libro de {{role_label}} existe (y te ahorra 6 meses de research)',
  textBody: `{{first_name}},

Doce días. Si {{role_label}} sigue en tu radar como opción real, y estás juntando información para preparar aplicación o entrevista, tengo un recurso específico para ti.

Hice un libro dedicado al rol {{role_label}} con:

- Radiografía completa del rol en LATAM (México, Argentina, Colombia, Chile).
- Bandas salariales por seniority con fuentes públicas verificables.
- Preguntas típicas de entrevista y cómo estructurar respuesta con marco STAR.
- Perfil de reclutador que suele contratar {{role_label}} y qué busca.
- Los cinco errores más frecuentes en aplicación al rol.

Precio de lanzamiento: MXN $799 (regular $999). En Hotmart, entrega inmediata, garantía 30 días.

{{site_origin}}/libro-{{role_slug}}

Si el rol te queda pero prefieres el paquete completo, hay un bundle con los tres libros (PM, MSL, CR) con descuento. Te lo pongo en el próximo email por si vale la pena en tu caso.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}`,
};

const dripQuizD20 = {
  alias: 'drip-quiz-d20',
  name: 'Drip Quiz · día 20 · bundle 3 libros',
  subject: 'Bundle 3 libros pharma (por si aún estás decidiendo entre roles)',
  textBody: `{{first_name}},

Veinte días. Este es el último email de la secuencia de bienvenida.

El quiz te asignó {{role_label}}, pero sé por conversaciones directas que mucha gente en tu situación aún está evaluando entre dos o tres roles antes de decidir dónde poner las semanas de aplicación.

Si ese es tu caso, el bundle de los tres libros (PM, MSL, CR) suele salir mejor que comprar dos por separado:

- Bundle 3 libros: MXN $1,999 (vs. $2,397 comprando individual).
- Los tres libros usan el mismo marco de análisis; comparar entre ellos te ayuda a decidir sin cambiar de vocabulario.

{{site_origin}}/bundle-pharma

Si ya te decidiste por {{role_label}} y solo quieres el libro específico, sigue disponible: {{site_origin}}/libro-{{role_slug}}.

Si algo de todo esto (quiz, blog, libros, contenido gratis) te ha servido, contéstame este email y dime qué. Leo todas las respuestas.

Oscar

--
Solca Ciencia · {{site_origin}}
No quieres recibir más de estos: {{unsub_url}}`,
};

const TEMPLATES = [
  dripCvD3,
  dripCvD7,
  dripCvD12,
  dripCvD20,
  dripQuizD3,
  dripQuizD7,
  dripQuizD12,
  dripQuizD20,
];

// ── HTML wrap · el mismo para todos los templates ────────────────────
// Convierte TextBody a HTML mínimo con estilo Solca. Preserva merge tags.

function textToHtml(text) {
  // Escape HTML except merge tags {{...}} y luego reconstruir.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // Cada bloque de dos+ saltos = párrafo; los saltos internos se preservan con <br>.
  const paragraphs = escaped.split(/\n{2,}/).map((block) => {
    const withBreaks = block.trim().replace(/\n/g, '<br>\n');
    // Auto-link para líneas que sean URLs completas o merge tag unsub_url.
    const linked = withBreaks
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0ea5e9;">$1</a>')
      .replace(/{{site_origin}}(\/[^\s<]*)?/g, (match) => `<a href="${match}" style="color:#0ea5e9;">${match}</a>`)
      .replace(/{{unsub_url}}/g, '<a href="{{unsub_url}}" style="color:#0ea5e9;">{{unsub_url}}</a>');
    return `<p style="margin:0 0 16px;">${linked}</p>`;
  });
  return paragraphs.join('\n');
}

function wrapHtml(bodyHtml, subject) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px 28px;max-width:560px;">
          <tr>
            <td style="font-size:15px;line-height:1.6;color:#334155;">
${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── HTTP helpers ─────────────────────────────────────────────────────

async function pmFetch(path, method, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'X-Postmark-Server-Token': TOKEN,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.Message ?? res.statusText;
    throw new Error(`Postmark ${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

async function findTemplateIdByAlias(alias) {
  // GET /templates?count=100&offset=0 devuelve lista; buscamos por Alias
  let offset = 0;
  const count = 100;
  while (true) {
    const data = await pmFetch(`/templates?count=${count}&offset=${offset}`, 'GET');
    const found = (data.Templates ?? []).find((t) => t.Alias === alias);
    if (found) return found.TemplateId;
    if ((data.Templates ?? []).length < count) return null;
    offset += count;
  }
}

async function upsertTemplate(tpl) {
  const html = wrapHtml(textToHtml(tpl.textBody), tpl.subject);
  const payload = {
    Name: tpl.name,
    Alias: tpl.alias,
    Subject: tpl.subject,
    HtmlBody: html,
    TextBody: tpl.textBody,
    TemplateType: 'Standard',
  };

  const existingId = await findTemplateIdByAlias(tpl.alias);
  if (existingId) {
    await pmFetch(`/templates/${existingId}`, 'PUT', payload);
    console.log(`  ✓ updated  ${tpl.alias} (id ${existingId})`);
  } else {
    const created = await pmFetch('/templates', 'POST', payload);
    console.log(`  ✓ created  ${tpl.alias} (id ${created.TemplateId})`);
  }
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`Postmark server: querying...`);
  const server = await pmFetch('/server', 'GET');
  console.log(`Postmark server: ${server.Name} (id ${server.ID})`);
  console.log(`Upserting ${TEMPLATES.length} drip templates:`);
  for (const tpl of TEMPLATES) {
    try {
      await upsertTemplate(tpl);
    } catch (err) {
      console.error(`  ✗ ${tpl.alias}: ${err.message}`);
    }
  }
  console.log('Done. Verifica en https://account.postmarkapp.com/servers/20030569/templates');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
