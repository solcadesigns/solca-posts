# Lo que dicen las vacantes #1 · Mié 27 may 2026

**Publicar:** Miércoles 27 de mayo 2026, mediodía CDMX
**Canal:** LinkedIn (post largo · artículo nativo opcional)
**Cover:** `mier_2026_05_27.png` (1280×720, distribución por categoría de rol)
**CTA:** `solcaciencia.com/revisar-cv`
**Hashtags:** `#PharmaLATAM #CarrerasPharma #CV #PhDtransition #ClinicalOperations #SolcaCiencia`

---

## Título

**Lo que dicen las vacantes · 33% son Clinical Operations · solo 10% son MSL · y 1 de 30 pide PhD**

## Subtítulo (línea de gancho)

Mientras curaba el listado de vacantes del mes encontré 30 pharma abiertas en LATAM. Antes de pasártelas, conté qué piden realmente. Esto fue lo que salió.

---

## Cuerpo

Cada mes te paso una lista de vacantes pharma curadas en el newsletter del viernes. Este mes, antes de mandarte el listado, me detuve a contar. No quería pasarte 30 enlaces sin entender qué patrón forman juntos. Lo que encontré reordena de qué hablar.

Los números son de **30 vacantes pharma en LATAM publicadas en LinkedIn entre el 13 y el 19 de mayo de 2026**, en México, Colombia, Chile, Argentina y Brasil. Las leí una por una. No es un censo, es una muestra del mes; pero es suficiente para ver el patrón.

### El 33% son Clinical Operations · no MSL

De las 30 vacantes, **10 son Clinical Operations**: CRAs, Clinical Trial Coordinators, Site Navigators, Study Start-Up Managers, Associate Program Managers. ICON, IQVIA, Parexel y CROs locales abriendo posiciones para mover ensayos clínicos en sitio.

En contraste, las posiciones de **Medical Science Liaison son 3 de 30**. Una décima parte. Y de esas tres, dos son la misma vacante de un Senior MSL Oncology publicada en dos países distintos por Bristol Myers Squibb.

Si lo que estás buscando hoy es "MSL en LATAM", el mercado te está diciendo: hay pocas, son senior, y compiten contra perfiles con años de industria. Si lo que estás buscando es Clinical Operations, hay más del triple de puertas abiertas.

### Las otras categorías

- **HEOR y Consulting**: 9 de 30 (IQVIA, Optum, Trinity Life Sciences, etc.). Mucha analítica.
- **Regulatory Affairs**: 2 de 30 (uno en Colombia, uno en Argentina).
- **R&D y Lab**: 2 de 30.
- **Pharmacovigilance**: 1 de 30 (graduate level, Novartis México).
- **Epidemiología clínica**: 1 de 30 (Medellín).
- **Trampas**: 3 de 30 que aparecen al buscar "pharma" en LinkedIn pero no son pharma — un Laboratorista de materiales de UChile, un Health Consultant de PwC que en realidad es ERP médico, y un Coordinador de I+D de Clase Azul Tequila. Los menciono porque si tu búsqueda automática te las trae, sabes que puedes saltarlas sin abrir la descripción.

### El dato que más me sorprendió

De las 30 vacantes, **solo 1 menciona PhD** — y lo menciona como "deseable", no como requisito. Las otras 29 piden licenciatura, en algunos casos maestría. Veinte de las treinta tienen como base "Bachelor's degree in life sciences, pharmacy or related".

Esto no significa que el PhD no sirva. Significa que las empresas no lo están pidiendo en la descripción. Y eso tiene una consecuencia operativa: si tu CV abre con "PhD candidate · 7 papers · 4 técnicas de citometría", el filtro automático de la CRO no encuentra el match contra "ICH-GCP · SOPs · TMF · CRA experience". Tu doctorado no compite con un bachelor's; compite con un bachelor's que ya sabe el vocabulario de la industria.

### Lo que sí piden, en orden de frecuencia

Conté los acrónimos pharma que aparecieron en las 30 descripciones. Los seis más frecuentes:

- **ICH** y **ICH-GCP**: en 9 de 30 vacantes
- **SOPs**: en 7 de 30
- **TMF / eTMF**: en 6 de 30
- **CRO experience**: en 5 de 30
- **HEOR**: en 3 de 30
- **CTMS** y **eCRF**: en 2 de 30 cada uno

Si tu CV tiene 7 papers y 0 de estos términos, no es un problema de calidad: es un problema de traducción. Y la traducción se puede hacer en una tarde, no en otro posdoc.

### Qué hago con esta información

Tres cosas concretas:

1. **Si estás escribiendo CV para LATAM hoy**, agrega los acrónimos arriba donde sea honesto agregarlos. "Trained in ICH-GCP" es decir la verdad si tomaste el curso gratuito de la OMS o de TransCelerate. No es inflar.
2. **Si estás aplicando, ajusta el embudo**: por cada 10 aplicaciones, 3 deberían ser Clinical Operations, no 10 a MSL.
3. **Si tu argumento es "soy sobrecalificado para CRA"**, el mercado de mayo te dice que ese es exactamente el rol que más se está pagando contratar este mes en la región. La sobrecalificación se vuelve ventaja a los 18 meses.

### Próximo miércoles

El miércoles que viene desgloso los 15 acrónimos pharma que aparecen en casi toda vacante y casi ningún PhD usa en su CV. Es la lista que más me han pedido en privado y que finalmente tengo evidencia para armar.

Si quieres retroalimentación gratuita de tu CV antes de aplicar a cualquiera de estas, la herramienta está abierta en **solcaciencia.com/revisar-cv**.

---

#PharmaLATAM #CarrerasPharma #CV #PhDtransition #ClinicalOperations #SolcaCiencia

---

## Notas internas

- N=30 vacantes pharma LATAM, 13-19 may 2026, LinkedIn, fuente: PDF `Listado para claudia 19 may 2026 (1).pdf`.
- Conteos auditables en `vacantes_analysis.json` (outputs).
- Trampas declaradas explícitamente: IDIEM Chile (materiales), PwC México (ERP médico), Clase Azul (tequila).
- "1 de 30 menciona PhD" — auditado contra regex `\bph\.?d|doctorado|doctoral`. La única vacante que lo menciona es Medical Monitoring (Assoc Medical Dir Respiratory), Argentina, como "MD or PhD preferred".
- Acrónimos contados con `\bACRONYM\b` (case-sensitive), no contando aparición múltiple en mismo job.
- CTA: rotación dice que el siguiente uso de `/revisar-cv` toca este miércoles. El próximo miércoles toca menciónarlo otra vez (es coherente con el tema acrónimos = CV).
