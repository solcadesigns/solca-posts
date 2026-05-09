# Solca · Marketing site & strategy package

> Sitio GitHub Pages + estrategia coordinada LinkedIn-first + content calendar 12 semanas + plantillas operativas.

---

## Qué hay aquí

| Archivo | Función |
|---|---|
| `index.html` | Landing page lista para GH Pages |
| `styles.css` | Hoja de estilo (paleta Solca · navy + naranja) |
| `script.js` | Pequeñas interacciones (smooth scroll, navbar) |
| `COORDINATED_MARKETING_STRATEGY.md` | El documento estratégico maestro · LÉELO PRIMERO |
| `CONTENT_CALENDAR_12_WEEKS.md` | Plan operativo de 12 semanas con fuente exacta de cada pieza |
| `LINKEDIN_POST_TEMPLATES.md` | 6 arquetipos de post LinkedIn |
| `NEWSLETTER_TEMPLATE.md` | Estructura del newsletter LinkedIn + email derivado |

---

## Por qué la estrategia es LinkedIn-first

LinkedIn es donde tu audiencia *ya está*. Un PhD biomédico LATAM en transición no busca tu contenido en Google; busca a gente que hizo el cambio en LinkedIn. Por eso:

```
Adquisición  ─────  LinkedIn (posts + newsletter) + YouTube
                                 │
Conversión   ─────  Web GH Pages (lead magnet + tienda)
                                 │
Nurture      ─────  Email propio (welcome + semanal)
                                 │
Venta        ─────  Hotmart (libros)
```

La web no compite con SEO; concentra tu CTA. LinkedIn hace el trabajo de descubrimiento.

---

## Despliegue del sitio · 30 minutos

### Paso 1 · Repositorio

```bash
# Crea repo nuevo en GitHub. Recomiendo nombre exacto:
#   oscarsolca.github.io       (URL: https://oscarsolca.github.io)
# o un repo cualquiera con:
#   solca-web                   (URL: https://oscarsolca.github.io/solca-web)

cd /Users/oscar/Downloads/solca/website
git init
git add .
git commit -m "Initial Solca marketing site"
git branch -M main
git remote add origin https://github.com/oscarsolca/oscarsolca.github.io.git
git push -u origin main
```

### Paso 2 · Activar GitHub Pages

1. Ve a tu repo en github.com.
2. Settings → Pages.
3. Source: `Deploy from a branch`. Branch: `main`. Folder: `/ (root)`.
4. Save. En 2 minutos el sitio está live.

### Paso 3 · Reemplazar placeholders

Hay seis cosas que reemplazar antes de que el sitio sea funcional. Búscalas con `grep -nE "REPLACE-ME|REPLACE-VIDEO-ID|REPLACE-FORM-ID|REPLACE-NEWSLETTER-ID" *.html`:

```
1. https://hotmart.com/REPLACE-ME-LIBRO1
2. https://hotmart.com/REPLACE-ME-LIBRO2
3. https://hotmart.com/REPLACE-ME-LIBRO3
4. https://hotmart.com/REPLACE-ME-BUNDLE
5. https://linkedin.com/in/REPLACE-ME
6. https://www.linkedin.com/newsletters/REPLACE-NEWSLETTER-ID/
7. https://youtube.com/@oscarsolca   (si tu handle es distinto)
8. REPLACE-VIDEO-ID-1, 2, 3   (IDs de YouTube de tus videos)
9. REPLACE-FORM-ID + entry.NAME_ID + entry.EMAIL_ID + entry.COUNTRY_ID
   (de Google Forms si usas esa vía · ver "Lead magnet" abajo)
```

### Paso 4 · Subir las portadas

El sitio espera tres imágenes en `covers/`:

```
covers/portada_pm.png   (de /Users/oscar/Downloads/solca/libro/images/portada.png)
covers/portada_msl.png  (de /Users/oscar/Downloads/solca/libro2/images/portada.png)
covers/portada_cr.png   (de /Users/oscar/Downloads/solca/libro3/images/portada.png)
```

```bash
mkdir -p covers
cp ~/Downloads/solca/libro/images/portada.png covers/portada_pm.png
cp ~/Downloads/solca/libro2/images/portada.png covers/portada_msl.png
cp ~/Downloads/solca/libro3/images/portada.png covers/portada_cr.png
git add covers/
git commit -m "Add book covers"
git push
```

### Paso 5 · Foto del autor (opcional)

Sube una foto cuadrada (recomendado 600×600 px) como `oscar.jpg` en la raíz. Si la omites, la sección "Sobre Solca" se acomoda sin la foto sin romperse.

---

## Lead magnet · cómo conectar el formulario

Tres opciones, en orden de recomendación:

### A) Buttondown (recomendado · gratis hasta 100 subs, $9/mes después)

1. Crea cuenta en buttondown.email.
2. Sube tu PDF como "automation" (welcome email envía el PDF como adjunto).
3. Buttondown te da un form embed; reemplaza el `<form>` actual del sitio con su HTML.
4. Configura una secuencia de welcome de 7 días dentro de Buttondown.

### B) ConvertKit (free hasta 1k subs, $9-15/mes después)

Mismo flujo. ConvertKit tiene mejor automation y tagging.

### C) Google Forms (cero costo, pero limitado)

Si todavía no quieres pagar nada:

1. Crea un Google Form con campos: nombre, email, país.
2. Después de envío, redirige a una página de gracias que tenga el link al PDF.
3. El PDF lo subes a tu propio repo (`pdf/guia-gratis.pdf`) y compartes el link.

Limitación de esta opción: **no tienes secuencia de email automatizada**, lo cual es el 70% del valor de capturar emails. Eventualmente migrarás a B.

---

## Cómo conectar el sitio con LinkedIn newsletter

LinkedIn newsletter funciona así:

1. Activa tu modo creador en LinkedIn (Settings → Creator mode).
2. Publica tu primer artículo · al hacerlo, te ofrece convertirlo en newsletter.
3. Una vez creado, LinkedIn te da una URL canónica del newsletter: `https://www.linkedin.com/newsletters/[ID]/`.
4. Reemplaza esa URL en `index.html`.

**Estrategia de doble suscripción:** en cada número de tu newsletter LinkedIn, incluye al final un párrafo que invite a la guía gratis (que captura email). En cada email a tu lista propia, ocasionalmente incluye un link a un número específico del newsletter LinkedIn.

Esto cruza las dos audiencias y aumenta retención en ambas.

---

## Cómo lanzar la primera campaña

Si esto es completamente nuevo para ti, sigue este orden:

**Día 1.** Despliega sitio en GH Pages. Manda link a 5 amigos PhDs y pide feedback brutal.

**Día 2-3.** Crea Buttondown / ConvertKit. Conecta formulario. Sube guía PDF como welcome email.

**Día 4-5.** Crea LinkedIn newsletter (mismo nombre que el sitio: "Solca · Ciencia y Consultoría"). Escribe primer número (~2000 palabras) sobre "Las tres puertas a industria farmacéutica desde un PhD biomédico" · usa la plantilla en `NEWSLETTER_TEMPLATE.md`.

**Día 6.** Publica el newsletter en LinkedIn. Cross-post un resumen como post normal con link al newsletter.

**Día 7.** Publica primer post LinkedIn según `CONTENT_CALENDAR_12_WEEKS.md` semana 1 lunes.

**Día 8-14.** Sigue el calendario de la semana 1.

**Día 15+.** Empieza a medir: ¿cuántos subscribers? ¿cuántos clicks al PDF? ¿cuántos emails captures? Itera.

---

## Métricas que conviene medir

Cada lunes, dedica 15 minutos a anotar:

| Métrica | Dónde | Meta a 90 días |
|---|---|---|
| Subscribers email propio | Buttondown / CK dashboard | 100 |
| Subscribers LinkedIn newsletter | LinkedIn analytics | 500 |
| Followers LinkedIn | LinkedIn dashboard | +200 |
| Clicks a Hotmart desde sitio | UTM parameters en links | 100 |
| Compras Hotmart | Dashboard Hotmart | 10-20 |
| Watch time YouTube (si activo) | YouTube Studio | n/a primer mes |

Si después de 90 días la lista propia no llega a 100, el problema es el lead magnet (re-trabajar) o el CTA (más visible) — no el plan.

---

## Stack mensual (cuando empiezas)

| Item | Costo |
|---|---|
| GitHub Pages | $0 |
| Buttondown free | $0 |
| LinkedIn (creator mode) | $0 |
| YouTube | $0 |
| Domain (opcional, e.g., solca.lat) | ~$15/año |
| **Total** | **$0 - $15/año** |

A los ~6 meses, cuando pases 1000 subs en email:

| Item | Costo |
|---|---|
| Buttondown / ConvertKit pago | $9-15/mes |
| Domain | ~$15/año |
| **Total** | **~$120/año** |

---

## Próximos pasos sugeridos al despliegue

1. **Antes de lanzar:** que un amigo PhD lea el sitio y te diga si entiende qué vendes en 10 segundos.
2. **Primera semana:** publica el primer newsletter LinkedIn antes de promocionar el sitio.
3. **Primer mes:** usa solo el calendario base de 3 posts/semana. No improvises.
4. **Mes 2:** revisa qué tipos de post tuvieron mejor engagement; replica esos arquetipos.
5. **Mes 3:** si ya tienes >300 emails, considera subir el lead magnet a un PDF más extenso (50 pp.) o lanzar un mini-curso de USD 27 como upsell post-libro.

---

## Archivos auxiliares · qué hacer con ellos

- `COORDINATED_MARKETING_STRATEGY.md` — léelo una vez completo, vuelve a él cuando quieras refrescar el por qué.
- `CONTENT_CALENDAR_12_WEEKS.md` — úsalo como agenda operativa. Imprímelo.
- `LINKEDIN_POST_TEMPLATES.md` — abre cada vez que vayas a escribir un post; los arquetipos te ahorran 30 min de pensar formato.
- `NEWSLETTER_TEMPLATE.md` — abre cada vez que vayas a escribir un newsletter.

— Solca · Ciencia y Consultoría
