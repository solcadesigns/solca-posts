# Prompts para figuras internas · Libro Clinical Research

Fecha: 12 ago 2026. Herramienta objetivo: Google Nano Banana / Flux Pro / Midjourney. Total: 32 figuras (7+7+7+6+5) para los 5 módulos.

## Especificaciones comunes a TODAS las figuras

- **Tamaño output**: 1600×1067 px (aspect ratio 3:2 horizontal) → cabe a `width=4in` en el docx del libro sin distorsión, imprime a ~400 dpi.
- **Estilo**: minimalista editorial, ilustración vectorial limpia, sin decoración excesiva. Coherente con la portada (mismo lenguaje visual del libro).
- **Paleta**: fondo off-white `#F7F5EE` para lectura clara en print; acentos navy `#1B3A6B` (elementos primarios), naranja `#E8743A` (highlights, énfasis), gris navy secundario `#94A4BC` (elementos de apoyo). Cero uso de blanco puro (#FFFFFF); todo off-white cálido.
- **Sin texto en inglés**: cualquier texto embebido debe ser en español y bien acentuado (á, é, í, ó, ú, ñ). Herramientas IA suelen equivocar acentos y verbos españoles: verificar caption antes de aceptar la imagen.
- **Sin fotorrealismo**: ilustración plana / infográfica / vectorial. Nada de rostros, nada de personas reales.

## Dos versiones por figura

Para cada figura tienes dos prompts:

- **Versión A · con texto embebido**: la IA genera la imagen incluyendo labels y captions dentro del arte. Más rápido, riesgo: la IA puede escribir mal el español (acentos, verbos, saltos de letra). Verifica cada texto antes de aceptar.
- **Versión B · solo arte**: la IA genera solo la ilustración, sin ningún texto. Después yo quemo los labels con Pillow (garantía de tipografía correcta + acentos perfectos). Más pasos pero calidad tipográfica garantizada.

Recomiendo **B** para figuras con más de 3 labels o con jerga técnica (regulatorio, pipeline de fases, siglas), y **A** para figuras conceptuales con 0-3 labels simples.

Cuando uses B, guarda el archivo como `bg_figura_X_Y.png` (sin texto) y yo escribo un script que agrega los labels correspondientes.

## Aspect ratio y sintaxis por herramienta

- **Nano Banana / Gemini**: agrega al final del prompt "Portrait aspect ratio 3:2 landscape, minimum 1600px wide."
- **Midjourney v6.1**: `--ar 3:2 --style raw`
- **Flux Pro (fal.ai)**: parámetro `aspect_ratio: "3:2"` o dimensiones `width: 1600, height: 1067`
- **DALL-E 3**: agrega "Output size: 1792×1024 pixels, landscape 16:9" (la aproximación más cercana; se recorta después)

---

# MÓDULO 1 · Fundamentos de la investigación clínica

## Figura 1.1 · Por qué un científico de la salud encaja en investigación clínica

**Concepto:** puente/traducción entre habilidades del laboratorio académico y las tareas de investigación clínica industrial. Dos columnas conectadas por líneas curvas naranja.

**A · Con texto embebido:**
```
Editorial infographic illustration, minimalist flat vector style, landscape 3:2 aspect ratio,
off-white background #F7F5EE. Two vertical columns of icons connected by curving orange arrows.
Left column labeled in Spanish "FORMACIÓN CIENTÍFICA" in navy #1B3A6B Space Grotesk uppercase small caps,
containing 4 small navy icons stacked vertically with Spanish labels: "Análisis de literatura",
"Diseño experimental", "Interpretación de datos", "Comunicación técnica". Right column labeled
"INVESTIGACIÓN CLÍNICA" in same style, containing 4 orange-accented icons with Spanish labels:
"Revisión de protocolo", "Monitorización de sitios", "Análisis de resultados", "Reporte a
sponsor". Three curving orange lines connect the columns showing knowledge transfer. Clean sans-serif
typography, sufficient white space, print-ready quality. Portrait aspect ratio 3:2 landscape,
minimum 1600px wide.
```

**B · Solo arte (sin texto):**
```
Editorial infographic illustration, minimalist flat vector style, landscape 3:2 aspect ratio,
off-white background #F7F5EE. Two vertical columns of small square icons connected by three
curving orange #E8743A arrows suggesting knowledge transfer. Left column: 4 navy #1B3A6B icons
stacked vertically (book, flask, chart, speech bubble). Right column: 4 orange-accented icons
stacked vertically (document, magnifying glass, bar chart, envelope). Empty label placeholder
zones above each column and next to each icon (blank rectangles). Clean vector style, ample
whitespace, print-ready. NO TEXT anywhere, no letters, no words. Portrait aspect ratio 3:2
landscape, minimum 1600px wide.
```

## Figura 1.2 · Qué es un ensayo clínico · pre-clínica y fases I-IV

**Concepto:** pipeline horizontal de las 5 etapas del desarrollo (Preclínica → Fase I → II → III → IV) con anchos proporcionales a duración/costo. Recomendado B.

**A · Con texto:**
```
Editorial pipeline infographic, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. Horizontal timeline of 5 sequential rectangular blocks left to right, varying widths
(Preclínica largest, Fase I small, Fase II medium, Fase III largest, Fase IV medium-small),
alternating navy #1B3A6B and orange #E8743A fills. Above each block, Spanish label in navy Space
Grotesk uppercase: "PRECLÍNICA", "FASE I", "FASE II", "FASE III", "FASE IV". Below each block,
small caption with Spanish descriptor: "Animales · Toxicidad", "20-100 sanos · Seguridad",
"100-500 pacientes · Eficacia inicial", "1000-5000 · Eficacia confirmada", "Post-aprobación ·
Vigilancia". Subtle horizontal timeline arrow underneath. Print-ready. Landscape 3:2 minimum
1600px wide.
```

**B · Solo arte:**
```
Editorial pipeline infographic, minimalist flat vector, landscape 3:2 aspect ratio. Off-white
#F7F5EE background. Horizontal sequence of 5 rectangular blocks left to right, varying widths
(second-widest first, small, medium, widest, medium-small), alternating navy #1B3A6B and orange
#E8743A fills, connected by thin gray arrows. Empty rectangular label placeholders above and
below each block. Subtle horizontal timeline arrow spanning the bottom. Clean vector, ample
whitespace, print-ready quality. NO TEXT, no letters, no words. Landscape 3:2 minimum 1600px
wide.
```

## Figura 1.3 · GCP · introducción

**Concepto:** cuatro pilares GCP (Ética, Seguridad, Integridad de datos, Cumplimiento regulatorio) representados como columnas verticales con base común. Recomendado A.

**A · Con texto:**
```
Editorial infographic, minimalist flat vector, landscape 3:2 aspect ratio. Off-white #F7F5EE
background. Four tall thin vertical rectangular columns of equal height, evenly spaced, standing
on a common horizontal base line. Each column filled with navy #1B3A6B with orange #E8743A
capital top segment. Below each column base, Spanish label in navy Space Grotesk uppercase:
"ÉTICA", "SEGURIDAD DEL PACIENTE", "INTEGRIDAD DE DATOS", "CUMPLIMIENTO REGULATORIO". Above the
four columns, small centered header text in navy italic serif: "Pilares de Buenas Prácticas
Clínicas". Clean minimalist, print-ready. Landscape 3:2 minimum 1600px wide.
```

**B · Solo arte:**
```
Editorial infographic, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background. Four
tall thin vertical rectangular columns of equal height, evenly spaced on a common horizontal base
line. Each column filled with navy #1B3A6B with orange #E8743A capital top segment. Empty
placeholder zones above and below each column for labels. Clean minimalist. NO TEXT anywhere.
Landscape 3:2 minimum 1600px wide.
```

## Figura 1.4 · El ecosistema · sponsors, CROs, sitios, IRB/EC, pacientes, reguladores

**Concepto:** hub-and-spokes con 6 actores conectados a un ensayo clínico central. Recomendado B por complejidad de labels.

**B · Solo arte (recomendado):**
```
Editorial network diagram, minimalist flat vector, landscape 3:2 aspect ratio. Off-white
#F7F5EE background. Central hexagonal node in orange #E8743A with subtle glow, connected by 6
thin navy #1B3A6B lines radiating outward to 6 circular nodes equidistant around it (positioned
at 12, 2, 4, 6, 8, 10 o'clock). Each outer circular node is navy filled with an orange border.
Simple icons inside each outer node (building, factory, hospital, gavel, person silhouette,
government building). Empty label placeholders below each outer node. Clean minimalist vector.
NO TEXT, no letters. Landscape 3:2 minimum 1600px wide.
```

**A · Con texto:**
```
Editorial network diagram, same composition as above. Central hexagonal node labeled "ENSAYO
CLÍNICO" in white bold sans-serif. Each of the 6 outer nodes labeled in Spanish below in navy
Space Grotesk uppercase: "SPONSOR", "CRO", "SITIO CLÍNICO", "IRB / CEIC", "PACIENTE",
"REGULADOR". Connecting lines: navy thin. Portrait aspect ratio 3:2 landscape.
```

## Figura 1.5 · Roles principales · CRS y CRA

**Concepto:** comparativa lado-a-lado de los dos roles con 3-4 atributos cada uno. Recomendado A si el copy es corto.

**A · Con texto:**
```
Editorial comparison illustration, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. Split in half vertically by a thin orange #E8743A line. LEFT HALF titled "CRS"
in large navy #1B3A6B Space Grotesk bold, with subheader "Clinical Research Scientist" in navy
italic below. Under the header, 4 short Spanish bullet points with small navy icons: "Diseña
protocolos", "Interpreta resultados", "Escribe secciones científicas", "Rol home-based". RIGHT
HALF titled "CRA" in large navy Space Grotesk bold with subheader "Clinical Research Associate".
Below, 4 short Spanish bullets with orange icons: "Monitorea sitios clínicos", "Verifica datos
en fuente", "Viaja frecuentemente", "Reporta a sponsor". Central vertical divider is thin orange.
Clean minimalist, print-ready. Landscape 3:2 minimum 1600px wide.
```

**B · Solo arte:**
```
Editorial comparison illustration, minimalist flat vector, landscape 3:2. Off-white background,
central vertical orange divider. Two mirrored panels each with empty header zone at top, empty
subheader zone below, and 4 small icon rows below with empty text placeholders. Left column
uses navy icons (blueprint, chart, document, house). Right column uses orange icons (magnifying
glass, checkmark, airplane, envelope). NO TEXT anywhere. Landscape 3:2 minimum 1600px wide.
```

## Figura 1.6 · Otros roles relevantes en investigación clínica

**Concepto:** wheel/rueda con 6-8 roles alrededor de un núcleo central. Recomendado B.

**B · Solo arte:**
```
Editorial radial diagram, minimalist flat vector, landscape 3:2 aspect ratio. Off-white #F7F5EE
background. Central small navy #1B3A6B disc surrounded by 8 medium-sized navy circles arranged
evenly in a large ring around the center, each connected to the center by a thin gray line. Each
outer circle contains a simple orange-outlined icon (paperclip, gear, shield, folder, magnifying
glass, dollar sign, calendar, headset). Empty rectangular label placeholders below each outer
circle. Clean minimalist. NO TEXT. Landscape 3:2 minimum 1600px wide.
```

## Figura 1.7 · Diez habilidades transferibles de tu formación científica

**Concepto:** grid 2×5 o 5×2 de skills con iconos. Recomendado A si copy corto.

**A · Con texto:**
```
Editorial skill grid, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background. Header
centered top in navy Space Grotesk uppercase: "10 HABILIDADES TRANSFERIBLES". Below, grid of 10
cells arranged 5 columns × 2 rows. Each cell has a small centered navy #1B3A6B outlined icon
above (book, chart, magnifying glass, presentation, gear, calendar, checklist, network, flask,
speech bubble) and a short Spanish label below in navy sans-serif: "Lectura crítica", "Análisis
estadístico", "Diseño experimental", "Presentación oral", "Gestión de tiempo", "Planificación",
"Verificación de detalles", "Colaboración", "Escritura técnica", "Comunicación con expertos".
Odd-column icons in navy, even-column icons in orange #E8743A for visual rhythm. Clean minimalist.
Landscape 3:2 minimum 1600px wide.
```

**B · Solo arte:**
```
Editorial skill grid, same composition. Grid of 10 cells arranged 5 columns × 2 rows. Each cell
has a small centered outlined icon (book, chart, magnifying glass, presentation, gear, calendar,
checklist, network, flask, speech bubble). Odd-column icons in navy #1B3A6B, even-column icons in
orange #E8743A. Empty text placeholder below each icon. Empty header zone at top. NO TEXT.
Landscape 3:2 minimum 1600px wide.
```

---

# MÓDULO 2 · Operación y compliance

## Figura 2.1 · Un día en la vida de un CRS

**Concepto:** timeline horizontal de un día típico (8am → 6pm) con bloques de actividades. Recomendado B.

**B · Solo arte:**
```
Editorial daily timeline infographic, minimalist flat vector, landscape 3:2 aspect ratio.
Off-white #F7F5EE background. Horizontal timeline spanning full width, marked with 6 evenly-
spaced tick marks and hour labels replaced with empty placeholders. Above the timeline, 6
rectangular blocks of varying widths alternate navy #1B3A6B and orange #E8743A fills, each with
a small icon inside (laptop, document, meeting bubble, chart, phone, coffee). Empty label
placeholders above each block. Clean minimalist. NO TEXT. Landscape 3:2 minimum 1600px wide.
```

**A · Con texto:**
```
Same composition. Timeline hours labeled 8, 10, 12, 14, 16, 18 in small navy sans-serif. Blocks
labeled in Spanish uppercase: "LECTURA LITERATURA", "REDACCIÓN PROTOCOLO", "REUNIÓN SPONSOR",
"REVISIÓN DATOS", "LLAMADAS SITIOS", "SÍNTESIS DEL DÍA". Header centered top: "UN DÍA COMO CRS".
```

## Figura 2.2 · Un día en la vida de un CRA

Similar a 2.1 con bloques distintos: "REVISIÓN AGENDA", "VIAJE A SITIO", "VISITA MONITORING", "SDV", "REPORTE MVR", "REGRESO Y ADMIN". Recomendado B con mismo prompt base cambiando iconos (car, hospital, clipboard, spreadsheet, laptop, mail).

## Figura 2.3 · Diseño de ensayos y protocolo

**Concepto:** flowchart de las 9 secciones estándar de un protocolo. Recomendado B (mucho texto).

**B · Solo arte:**
```
Editorial flowchart, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background. 9
rounded rectangular boxes arranged in 3 rows × 3 columns, connected by thin navy #1B3A6B arrows
following reading order (left-to-right, then next row). All boxes are navy filled with orange
#E8743A left border stripe. Small icon in each box (target, magnifying glass, calendar, chart,
person, checklist, flask, document, seal). Empty text placeholder inside each box. Clean
minimalist. NO TEXT. Landscape 3:2 minimum 1600px wide.
```

## Figura 2.4 · ICH E6(R3) · qué cambia con la versión 2025

**Concepto:** dos pilas de bloques comparando R2 vs R3, con delta indicators. Recomendado A (poco texto).

**A · Con texto:**
```
Editorial comparison illustration, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. Two vertical stacks of blocks side-by-side. Left stack labeled "ICH E6(R2)" in navy
Space Grotesk uppercase, 5 identical navy #1B3A6B blocks stacked. Right stack labeled "ICH E6(R3)
· 2025" in navy uppercase with orange divider underneath, 5 blocks stacked but with orange
#E8743A highlight on 3 of them (indicating changes). Small delta arrow between stacks with
Spanish label "Cambios clave: Quality Management System · Risk-based approach · Data governance".
Print-ready. Landscape 3:2 minimum 1600px wide.
```

## Figura 2.5 · Marco regulatorio LATAM por país

**Nota:** esta figura fue reemplazada previamente por Oscar con la imagen "LATAM 5 replacement". Se conserva salvo que Oscar decida regenerarla en el nuevo estilo unificado.

## Figura 2.6 · Marco regulatorio España · AEMPS, EMA y CTIS

**Concepto:** diagrama jerárquico UE → EMA → AEMPS → CEIm → sitios. Recomendado B.

**B · Solo arte:**
```
Editorial hierarchy diagram, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background.
Vertical hierarchy: top center a large navy #1B3A6B pill-shape (representing EU), below it a
medium orange #E8743A pill (representing EMA), below that a medium navy pill (AEMPS), below that
two smaller pills side-by-side in orange (representing CEIm and CTIS), and at the bottom row 4
small navy circles (representing clinical sites). Thin gray lines connect each level with the
next in a tree structure. Empty text placeholder inside each shape. Clean minimalist. NO TEXT.
Landscape 3:2 minimum 1600px wide.
```

## Figura 2.7 · Marco regulatorio FDA · por qué importa aunque trabajes en LATAM o España

**Concepto:** diagrama de influencia FDA → ICH → agencias locales (COFEPRIS, ANMAT, INVIMA, ISP, ANVISA, AEMPS). Recomendado B.

**B · Solo arte:**
```
Editorial influence diagram, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background.
Top left corner: large orange #E8743A octagon (representing FDA). Center: medium navy #1B3A6B
hexagon (representing ICH). Right side and bottom row: 6 small navy circles arranged in an
arc (representing 6 regional agencies). Thin curving arrows: one thick orange arrow from FDA
octagon down to central ICH hexagon; multiple thin navy arrows radiating from ICH hexagon out to
each of the 6 small circles. Empty text placeholder inside each shape. Clean minimalist. NO TEXT.
Landscape 3:2 minimum 1600px wide.
```

---

# MÓDULO 3 · Reverse-engineering tu rol ideal

## Figura 3.1 · Antes de aplicar · seis factores que decides tú

**Concepto:** hexagrama de 6 vértices con factor en cada uno. Recomendado B.

**B · Solo arte:**
```
Editorial hexagram diagram, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background.
Large centered hexagon outlined in thin navy #1B3A6B with 6 empty vertex nodes (small orange
#E8743A circles at each vertex). Center of the hexagon: small navy circle. Empty text placeholder
next to each vertex circle. Subtle light-gray diagonal shading in bottom-right quadrant. Clean
minimalist. NO TEXT. Landscape 3:2 minimum 1600px wide.
```

## Figura 3.2 · Quién contrata · pharma, biotech, CROs en LATAM

**Concepto:** tres columnas de logos-tipo (sin marcas reales) para pharma / biotech / CRO. Recomendado B.

**B · Solo arte:**
```
Editorial category illustration, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. Three vertical columns of 4 stylized generic company logos each (simple abstract
navy #1B3A6B shapes: pill, DNA helix, gear, molecule for each). Center column has orange #E8743A
accents to differentiate. Empty header placeholder above each column. Clean minimalist. NO TEXT,
no real company names or logos. Landscape 3:2 minimum 1600px wide.
```

## Figura 3.3 · Salarios LATAM por país

**Concepto:** bar chart horizontal con 5 países. Recomendado A (necesita labels precisos).

**A · Con texto:**
```
Editorial bar chart, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background.
Horizontal bar chart with 5 rows labeled in Spanish on the left: "México", "Argentina",
"Colombia", "Chile", "Brasil". Each bar in navy #1B3A6B with a thinner orange #E8743A overlay
segment at the far right indicating variable range. Values shown at bar ends in navy sans-serif:
"MXN 400-900k", "USD 25-50k", "COP 80-180k", "CLP 25-55M", "BRL 100-260k". Header top-left in
navy Space Grotesk uppercase: "SALARIO CRA · RANGOS ANUALES". Small footnote bottom-right in
gray italic: "Fuentes: Glassdoor, SalaryExpert, EPM Scientific 2026". Landscape 3:2 minimum
1600px wide.
```

## Figura 3.4 · Mercado laboral España · empresas Iberia y bandas salariales CR

**A · Con texto:**
```
Editorial bar chart, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background.
Horizontal bar chart with 6 rows labeled in Spanish on the left: "CRA I", "CRA II", "Senior CRA",
"Lead CRA", "CTM", "CRS". Each bar in navy #1B3A6B with orange #E8743A range overlay. Values at
bar ends in navy sans-serif: "€28-38k", "€35-48k", "€45-62k", "€58-78k", "€65-95k", "€48-72k".
Header top-left: "SALARIOS CR EN ESPAÑA · EUR ANUALES BASE". Footnote gray italic: "EPM Scientific
2026 + Glassdoor España". Landscape 3:2 minimum 1600px wide.
```

## Figura 3.5 · La búsqueda de empleo · LinkedIn y presencia digital

**Concepto:** perfil LinkedIn estilizado con highlights en secciones clave. Recomendado B.

**B · Solo arte:**
```
Editorial LinkedIn profile mockup illustration, minimalist flat vector, landscape 3:2. Off-white
#F7F5EE background. Stylized generic professional profile mockup (no real LinkedIn logo, no real
name): navy #1B3A6B rectangular banner at top, empty circular avatar placeholder, empty
horizontal bars representing headline, summary, and experience sections. 4 sections highlighted
with orange #E8743A tick marks or accent bars (headline, summary, skills, activity). Empty text
placeholders throughout. Clean minimalist. NO TEXT, no letters, no real logos. Landscape 3:2
minimum 1600px wide.
```

## Figura 3.6 · El currículum · CV académico vs. CRA/CRS Resume

**Concepto:** comparativa side-by-side de dos CVs esquematizados. Recomendado B.

**B · Solo arte:**
```
Editorial CV comparison illustration, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. Two portrait-oriented document mockups side-by-side. LEFT: navy #1B3A6B outlined
document with dense horizontal lines representing text, multiple sections stacked with small
bullet marks. RIGHT: same document with orange #E8743A accent border, more spaced lines and
larger section headers, fewer bullets, cleaner layout. Empty header placeholders above each
document. Thin gray downward-arrow between the two indicating transformation. Clean minimalist.
NO TEXT. Landscape 3:2 minimum 1600px wide.
```

## Figura 3.7 · La entrevista · cinco fases y método STAR

**Concepto:** flowchart de 5 fases + descripción del método STAR abajo. Recomendado A.

**A · Con texto:**
```
Editorial flowchart, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background. Top:
horizontal sequence of 5 numbered navy #1B3A6B circles connected by thin orange #E8743A arrows,
each labeled in Spanish below in navy Space Grotesk uppercase: "SCREENING", "RECRUITER",
"HIRING MANAGER", "TÉCNICA", "OFERTA". Bottom: 4-column horizontal band with STAR method letters
S, T, A, R in large orange each with Spanish label below: "Situación", "Tarea", "Acción",
"Resultado". Header centered top: "5 FASES DE ENTREVISTA CR". Clean minimalist. Landscape 3:2
minimum 1600px wide.
```

---

# MÓDULO 4 · Primeros 90 días y crecimiento de carrera

## Figura 4.1 · Onboarding · plan 30/60/90 días

**A · Con texto:**
```
Editorial timeline infographic, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. Horizontal timeline divided in 3 equal segments labeled "30 DÍAS", "60 DÍAS",
"90 DÍAS" in navy Space Grotesk uppercase. Each segment contains 3 short Spanish bullet points
in navy sans-serif with orange bullet dots: "Aprender protocolo · Conocer equipo · Primera
visita", "Ejecutar autónomo · Cerrar queries · Reunión sponsor", "Manejo de crisis ·
Retroalimentar CTM · Plan trimestre". Header top: "PLAN 30-60-90 · PRIMEROS DÍAS COMO CRA".
Landscape 3:2 minimum 1600px wide.
```

## Figura 4.2 · Cuatro patrones de fracaso en el primer año

**B · Solo arte:**
```
Editorial matrix illustration, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. 2×2 grid of quadrants separated by thin gray axes. Each quadrant contains a simple
warning icon in the center (exclamation mark, question mark, spiral, distance symbol) in orange
#E8743A on navy #1B3A6B rounded background. Empty label placeholder in each quadrant corner.
Empty axis labels at top and left. Clean minimalist. NO TEXT. Landscape 3:2 minimum 1600px wide.
```

## Figura 4.3 · Crecimiento vertical · CRA → Director Clinical Operations

**B · Solo arte:**
```
Editorial career ladder illustration, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. Diagonal ascending staircase from bottom-left to top-right with 5 evenly-spaced
navy #1B3A6B rectangular steps, each larger than the previous. Each step has a small orange
#E8743A circular indicator at its top-front edge. Thin curving orange arrow trails along the
staircase suggesting upward trajectory. Empty text placeholder next to each step (right side).
Clean minimalist. NO TEXT. Landscape 3:2 minimum 1600px wide.
```

## Figura 4.4 · Crecimiento vertical · CRS → Director Investigación Clínica

Similar a 4.3 con misma composición base y placeholders diferentes. Reusa **B** de 4.3.

## Figura 4.5 · Movimientos laterales · siete caminos

**B · Solo arte:**
```
Editorial radial diagram, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background.
Central navy #1B3A6B pill labeled area (empty), with 7 curving orange #E8743A arrows radiating
outward in different directions to 7 smaller navy circles arranged around it. Each outer circle
has a distinct simple icon (medical bag, chart, gear, briefcase, magnifying glass, gavel,
handshake). Empty label placeholder next to each outer circle. Clean minimalist. NO TEXT.
Landscape 3:2 minimum 1600px wide.
```

## Figura 4.6 · Certificaciones · ACRP, SOCRA, DIA, SCT

**A · Con texto:**
```
Editorial comparison table, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background.
4-column layout with each column headed by an organization acronym in large navy Space Grotesk
bold: "ACRP", "SOCRA", "DIA", "SCT". Below each header, 3 rows of short Spanish attributes with
small orange #E8743A tick or navy X marks: "Certificación CRA", "Reconocimiento global",
"Membresía anual". Row labels on the far left in navy uppercase small caps. Clean minimalist,
print-ready. Landscape 3:2 minimum 1600px wide.
```

---

# MÓDULO 5 · IA en investigación clínica

## Figura 5.1 · La IA cambia el oficio pero no lo reemplaza

**B · Solo arte:**
```
Editorial quadrant diagram, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background.
2×2 matrix separated by thin gray axes. Top-right quadrant highlighted with subtle orange #E8743A
background tint. Each quadrant contains a stylized icon in navy #1B3A6B (robot silhouette, human
silhouette, gear, brain). Axis labels are empty placeholders. Clean minimalist. NO TEXT.
Landscape 3:2 minimum 1600px wide.
```

## Figura 5.2 · Casos de uso reales hoy · clasificación honesta

**A · Con texto:**
```
Editorial matrix illustration, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. Vertical axis labeled "MADUREZ" (bottom "BAJA", top "ALTA") in navy Space Grotesk
uppercase. Horizontal axis labeled "IMPACTO OPERATIVO" (left "BAJO", right "ALTO"). 4-6 small
circular chips distributed across the plane, each with a short Spanish label: "Literature
monitoring", "Auto-drafting queries", "Signal detection", "Protocol synthesis", "Site selection
predictive", "Regulatory writing draft". Top-right quadrant highlighted with subtle orange
background tint indicating "Real deployed". Clean minimalist. Landscape 3:2 minimum 1600px wide.
```

## Figura 5.3 · Diez prompts plantilla para CRS y CRA

**B · Solo arte:**
```
Editorial grid of cards, minimalist flat vector, landscape 3:2. Off-white #F7F5EE background.
5×2 grid of small rounded rectangular cards. Each card is navy #1B3A6B filled with a small orange
#E8743A "quote mark" symbol in the top-left corner and horizontal lines suggesting text below.
Empty text placeholder in each card. Clean minimalist. NO TEXT, no letters. Landscape 3:2
minimum 1600px wide.
```

## Figura 5.4 · Riesgos · GCP, datos sensibles, alucinación, sesgo

**A · Con texto:**
```
Editorial risk matrix illustration, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. 4 large rounded rectangular blocks arranged in 2×2 grid. Each block is navy #1B3A6B
with an orange warning triangle icon in the top-right corner. Each block has a Spanish label
centered in white sans-serif bold: "GCP · Trazabilidad", "Datos sensibles · Privacidad",
"Alucinación · Verificación", "Sesgo · Auditoría". Small subtitle below each label in white
italic. Clean minimalist. Landscape 3:2 minimum 1600px wide.
```

## Figura 5.5 · Marco regulatorio · FDA, EMA, ICH ante la IA

**B · Solo arte:**
```
Editorial regulatory triangle diagram, minimalist flat vector, landscape 3:2. Off-white #F7F5EE
background. Equilateral triangle in the center outlined in thin navy #1B3A6B with orange #E8743A
vertex nodes (small circles). Inside the triangle, a small stylized AI chip icon in orange
positioned at the centroid. Empty text placeholder next to each vertex. Clean minimalist. NO
TEXT. Landscape 3:2 minimum 1600px wide.
```

---

## Convención de archivos que espera el script de texto (solo para versión B)

Cuando descargues las imágenes solo-arte (versión B), guárdalas con este naming en `/Users/oscar/Downloads/solca/libro3/images/`:

- `bg_figura_1_1.png`, `bg_figura_1_2.png`, etc.

Yo te dejo listo un script `add_labels_figuras.py` que toma cada `bg_figura_X_Y.png`, aplica los labels que corresponden a esa figura, y guarda el resultado como `figure_X_Y.png` (sobrescribiendo el existente). Con eso el rebuild del docx toma la nueva imagen sin cambios en el markdown.

## Flujo sugerido

1. Empieza con **1-2 figuras piloto** (por ejemplo 1.1 y 2.6). Genera ambas versiones (A y B) para comparar. Elige el approach que quede mejor.
2. Si eliges **A embed**: verifica manualmente cada texto embebido (ojo con acentos y verbos). Guarda como `figure_X_Y.png` directo en `libro3/images/`.
3. Si eliges **B solo arte**: guarda como `bg_figura_X_Y.png`. Cuando tengas ~5 acumuladas, me avisas y corro el script de labels.
4. Rebuild final: `cd /Users/oscar/Downloads/solca/libro3 && python3 build_docx.py`.
