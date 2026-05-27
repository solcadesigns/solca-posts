# Solca Insight · Registro de temas y memoria del ciclo

> **Propósito:** memoria compartida entre Oscar y Claude para que en cada ciclo mensual sepamos qué temas ya se cubrieron, qué temas están en el pool para próximas ediciones, y qué reglas operativas hemos refinado.
>
> **Cómo usarlo:** al iniciar cada ciclo nuevo, abre este archivo, el `NEWSLETTER_RESCHEDULE_PLAN.md` y el `TOOLS_REGISTRY.md` (inventario completo de herramientas). Pega/menciona los tres en el chat con Claude para retomar contexto en frío.

---

## Estado actual del ciclo

**Última edición cerrada:** Vie 12 jun 2026 (#06 · MSL roles disambiguation)
**Próxima edición pendiente:** Vie 19 jun 2026 (#07 · MSL salaries + vacantes #2)
**Cadencia vacantes:** cada 4 semanas a partir de Vie 22 may → Vie 19 jun → Vie 17 jul → Vie 14 ago → ...
**Nueva cadencia miércoles:** "Lo que dicen las vacantes" — serie mensual de 4 artículos de inteligencia de mercado derivados del dataset de vacantes curado ese mes. Cada miércoles a las 12:00 CDMX. Refuerza pero no sustituye la edición vacantes del viernes.

---

## Temas YA usados (no repetir como Insight principal)

### Mayo–Junio 2026

| # | Fecha | Tema Insight | Sección rotativa / Vacantes | CTA |
|---|---|---|---|---|
| 01 | Vie 8 may | Las tres puertas a industria farmacéutica desde un PhD biomédico | Lo que estoy leyendo (paper APPA/IFAPP/MAPS) | Suscríbete |
| 02 | Vie 15 may | El error #1 en CVs de PhDs aplicando a industria | Tip rápido CV/LinkedIn (3 cambios en headline) | revisar-cv |
| 03 | Vie 22 may | Después del CV: 3 lugares de LinkedIn que reclutador pharma checa | **Vacantes #1** (COL, CHL, MEX, ARG · Brasil sin vacantes) | revisar-cv |
| 04 | Vie 29 may | Salarios CRA junior LATAM · datos por país y caveats por fuente | (regular - ver scheduled) | Libro 3 (CR) |
| 05 | Vie 5 jun | ICH E6(R3) · qué cambia para CRAs y CRSs en LATAM | Lo que estoy leyendo (ICH Final Guideline) | Libro 3 (CR) |
| 06 | Vie 12 jun | MSL vs visitador vs Medical Director · disambiguación | Tip rápido CV/LinkedIn (3 frases que identifican MSL) | Libro 2 (MSL) |
| 07 | Vie 19 jun | Salarios MSL junior LATAM · por país y área terapéutica | **Vacantes #2** (pendiente curación) | Libro 2 (MSL) |

### Posts del Miércoles · serie "Lo que dicen las vacantes" (dataset N=30 may 2026)

| Fecha | # | Tesis | Cover |
|---|---|---|---|
| Mié 27 may ✅ programado | #1 | 33% son Clinical Operations · solo 10% MSL · 1 de 30 menciona PhD | `mier_2026_05_27.png` |
| Mié 3 jun ⏳ entregado | #2 | 13 acrónimos pharma que aparecen en casi toda vacante y casi ningún PhD usa | `mier_2026_06_03.png` |
| Mié 10 jun ⏳ entregado | #3 | 20 piden Bachelor mínimo pero las responsabilidades son trabajo de PhD | `mier_2026_06_10.png` |
| Mié 17 jun ⏳ entregado | #4 | 19 de 30 vacantes esperan inglés · el filtro silencioso del CV en español | `mier_2026_06_17.png` |

**Operación serie miércoles:**
- Dataset auditable en `vacantes_analysis.json` + `vacantes_raw.txt` (outputs sesión 25 may 2026).
- Frase de apertura común: "Mientras curaba el listado de vacantes del mes encontré N vacantes pharma..." → conecta con edición vacantes del viernes sin sustituirla.
- CTA cada miércoles: `solcaciencia.com/revisar-cv` (4 menciones consecutivas porque el contenido lo justifica empíricamente).
- Próximo ciclo (jul 2026): Oscar pasa nuevo PDF de vacantes, repetimos análisis, 4 artículos nuevos.

### Posts del Lunes (teasers + standalone)

| Fecha | Tipo | Tema |
|---|---|---|
| Lun 18 may ✅ publicado | Teaser | CV/ATS error (para Vie 15) |
| Lun 25 may ✅ programado | Teaser | CRA salaries hook (para Vie 29) |
| Lun 1 jun ✅ reescrito | Teaser | ICH E6(R3) hook (para Vie 5) |
| Lun 8 jun ✅ reescrito | Followup | 5 preguntas de entrevista cambiaron con R3 |
| Lun 15 jun ✅ reescrito | Teaser | MSL salaries hook (para Vie 19) |
| Lun 22 jun ⏳ pendiente reescritura | Teaser | IA en clinical research (para Vie 26) |
| Lun 29 jun ⏳ pendiente reescritura | Teaser | CRA trajectory (para Vie 3 jul) |

---

## Pool de temas DISPONIBLES para próximos ciclos

Sin orden particular — elegir según news pulse mensual y rotación de CTA libros.

### Tema 1 · Mercado / Geografía

- Mapa salarial LATAM completo · clinical research + MSL + PM por país (anual)
- Brasil · mercado más grande de clinical research LATAM · qué cambia para ti
- Argentina · cómo pensar tu salario con inflación
- Las CROs grandes con presencia LATAM · ranking actualizado
- Conversaciones con N MSL/CRA/PM senior · síntesis de patrones

### Tema 2 · Operación / Día a día

- Cómo se ve la primera semana en sitio · checklist CRA nuevo
- Cuatro fases de una visita CRA · qué pasa en cada una
- Cuáles son los KRIs/QTLs que un CRA monitorea hoy
- Onboarding 30/60/90 · qué evalúan mes a mes

### Tema 3 · Compliance / Regulación

- Compliance LATAM por país · 5 reguladores y 10 reglas clave
- Diferencia entre scientific exchange y promoción · caso anonimizado
- MLR review · cómo funciona y por qué importa para MSL
- ANVISA, COFEPRIS, ANMAT updates trimestrales

### Tema 4 · Carrera / Trayectoria

- CRA I → Director · trayectoria real en LATAM (Vie 3 jul programado)
- MSL → Medical Director · 8 caminos posibles
- Movimientos laterales desde MSL · 8 puertas
- Cuándo cambiar de empresa · regla de aprendizaje vs número

### Tema 5 · CV / Aplicación

- Cover letter para industria desde academia · 4 estructuras
- LinkedIn profile completo · sección por sección
- Cómo presentar publicaciones académicas en CV pharma
- ATS optimization · keywords por rol
- Caso anonimizado · PhD a CRA en 4 meses · análisis del proceso

### Tema 6 · Entrevista

- Las 7 preguntas más repetidas en DM (Q&A reader)
- Las 5 fases de entrevista CRA · qué evalúa cada una
- Método STAR adaptado a pharma · ejemplo concreto
- Scientific presentation en entrevista MSL · cómo prepararla
- Errores que descalifican PhDs en entrevista · los 5 más frecuentes

### Tema 7 · Consultoría / Avanzado

- Si solo presupuesto para un libro · cómo elegir
- Compliance: scientific exchange vs promoción · caso real
- Certificaciones (BCMAS, ACMA, MSL Society) · cuál vale la pena
- Cómo identificar señales en una vacante antes de aplicar

### Tema 8 · IA / Futuro

- IA en clinical research · deployed vs hype (Vie 26 jun programado)
- IA en Medical Affairs · clasificación honesta
- Prompts útiles para CRAs y CRSs (con caveat compliance)
- Herramientas IA que un CRS usa hoy · y dos que no funcionan

---

## Reglas operativas refinadas en el ciclo May–Jun 2026

Estas son agregadas a `NEWSLETTER_TEMPLATE.md` y aplican desde **Vie 19 jun** en adelante.

### 1. Referencias citadas

Cada "El dato" debe llevar **referencia específica** (no afirmación general):
- ❌ "Glassdoor reporta consistentemente que…"
- ✅ "Glassdoor LATAM Q1 2026 reporta una mediana de 65k MXN/año para CRA junior en CDMX (n=12 respuestas verificadas)…"

Si la cifra no tiene fuente sólida, **soften el claim** o **omítelo**.

### 2. Hashtags en newsletters

Hasta ahora los hashtags solo iban en posts del Lunes. Desde Vie 19 jun: incluir 3-5 hashtags al final del cuerpo del newsletter también.

Patrón base: `#PhDtoIndustry #PharmaLATAM` + 2-3 específicos del tema (#MSL, #ClinicalResearch, #SalaryNegotiation, #ICHGCP, etc.)

### 3. Honestidad sobre fabricación

Si en el draft hay alguna cifra inventada o asumida (como pasó con "12 preguntas" del libro 3), **Claude lo marca explícitamente** antes de cerrar. Reglas:
- Cifras específicas (números, %): verificar antes o no usar.
- Claims directional (la mayoría, frecuentemente): aceptables si la dirección es clara.

### 4. CTA rotación

Para evitar fatiga de la audiencia y no sobre-vender un solo libro:
- Edición vacantes (cada 4): `revisar-cv` o web.
- Edición con tema CRA: libro 3.
- Edición con tema MSL: libro 2.
- Edición con tema PM: libro 1.
- Tema cross-cutting (entrevista, networking): rota libro o `revisar-cv`.

Tracking de últimas 7 ediciones:
- #01: Suscríbete
- #02: revisar-cv
- #03: revisar-cv
- #04: Libro 3
- #05: Libro 3
- #06: Libro 2
- #07: Libro 2

→ Próxima edición (#08, tema IA): debería rotar a Libro 3 (CR) o revisar-cv para diversificar.

### 5. Cobertura de Brasil

Vie 22 may quedó sin vacantes destacables en Brasil. **Prioridad para Vie 19 jun:** intentar incluir al menos una vacante brasileña. Si no hay nada destacable, declararlo de nuevo y nota: "dos ediciones consecutivas sin Brasil — considerar push activo en próximo ciclo".

### 6. Lun teaser ≠ Lun followup

Patrones distintos, no confundir:
- **Teaser (Lun previo a Vie newsletter):** corto (~150p), hook + promesa "el viernes desgloso…" + suscríbete. SIN CTA al libro.
- **Followup (Lun posterior a Vie newsletter):** más largo (~250-300p), profundiza UN punto específico del newsletter, CON CTA al libro.

---

## Próximos pasos cuando retomemos el ciclo

**Antes del Lun 16 jun** (víspera de Lun 15 jun publicación):
1. Verificar que Lun 15 jun ya fue reescrito como teaser MSL salaries ✅ (hecho 20 may)

**Semana del 15-19 jun:**
1. Oscar abre ~30 URLs nuevas de LinkedIn jobs en Chrome (CRA/MSL/RA/PV/HEOR · MEX/BRA/ARG/COL/CHL · últimos 30 días)
2. Claude lee y cura 6-8 vacantes con la regla 60/30/10
3. Claude completa la sección Vacantes #2 del newsletter `NEWSLETTER_2026_06_19.md`
4. Claude verifica/genera "El dato" con referencia citada (no inventar)
5. Claude genera portada `newsletter_2026_06_19.png` con el mismo estilo
6. Oscar ajusta y schedule a Vie 19 jun ~10:30 AM

**Después de Vie 19 jun:**
1. Continuar con Lun 22 jun (reescribir como teaser IA) → Vie 26 jun newsletter IA
2. Continuar con Lun 29 jun (reescribir como teaser CRA trajectory) → Vie 3 jul newsletter CRA trajectory
3. Cerrar trimestre. Abrir nuevo ciclo (Vie 10 jul en adelante) eligiendo del pool de temas.

---

## Histórico de aprendizajes del ciclo

- **Vie 22 may:** primer newsletter del ciclo nuevo. Funcionó como bridge CV → LinkedIn → mercado. La portada de 3 cards (Headline/About/Activity) quedó visualmente fuerte.
- **Vie 5 jun:** ICH E6(R3) tenía cuerpo previo escrito por Oscar. Mi versión propuesta fue alternativa, no reemplazo forzado.
- **Vie 12 jun:** MSL roles disambiguation. El contenido reusó la versión que estaba originalmente en Lun 1 jun (que reescribimos como teaser ICH).
- **Lun 8 jun pivote:** evitamos solapamiento con Vie 5 jun pivotando de "ICH followup recap" a "5 preguntas de entrevista cambiaron con R3" — más concreto, no se solapa.
- **Caveat aprendido:** afirmar "12 preguntas en el libro" sin verificar fue un error. Regla nueva (#3 arriba) lo previene a futuro.

---

— Solca · Ciencia y Consultoría · registro actualizado **25 may 2026** (agregada serie miércoles "Lo que dicen las vacantes")
