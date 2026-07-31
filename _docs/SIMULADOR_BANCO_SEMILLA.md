# Simulador de Entrevistas · Banco semilla v0.4

> **Estado:** 32 preguntas Junior fijas + 12 templates CV-ancladas + ángulos pedagógicos rotativos (4 ángulos activos) · 12 jun 2026 · Fase 0.2.
> **Cambios v0.3 → v0.4:** Pool rotativo reducido de 5 a 4 ángulos. El ángulo B ("Compárate con el promedio del rol") fue eliminado en v0.4 del system prompt porque requería data de sesiones reales que no existe todavía. Reincorporación cuando tengamos ≥50 sesiones beta con dataset propio.
> **Cambios v0.2 → v0.3:** La rúbrica de cada pregunta del banco se mantiene como está, pero el TEXTO del feedback ya no se deriva mecánicamente de la rúbrica. El system prompt v0.3 introduce cuatro mecanismos de variabilidad (anclaje al perfil, conexión entre preguntas, pool rotativo de 5 ángulos pedagógicos, frase modelo siempre específica). La rúbrica determina el SCORE 1-5; la rúbrica NO determina el texto. Por eso las anclas "Tip buena respuesta" de cada pregunta funcionan como SEMILLA de contenido, no como texto literal a devolver.
> **Cambios v0.1 → v0.2:** Anotado plan de traducción al inglés. El system prompt v0.2 traduce dinámicamente las preguntas semilla cuando `idioma="ingles"` o cuando corresponde a la segunda mitad de la sesión en modo bilingüe. Pre-traducción manual de las 32 preguntas queda pendiente para sub-etapa 0.2 después de validar el patrón en español.
> **Cambios v0 → v0.1:** Agregada sección F con templates de preguntas que se rellenan dinámicamente con datos del CV del candidato (solo planes pagos).
> **Fuentes externas que sustentan las decisiones de idioma:**
> - [Near.com · 9 Lessons From Hiring in LatAm](https://www.hirewithnear.com/blog/9-lessons-learned-from-hiring-in-latin-america)
> - [iSmartRecruit · Multilingual Interviews](https://www.ismartrecruit.com/blogs/interview-process/multilingual-interviews)
>
> **Cómo usar:** estas preguntas alimentan el endpoint del simulador en proporción ~30% banco / ~70% generación libre. Cada pregunta incluye su framework de evaluación, elementos a evaluar, bandera roja típica y tip de buena respuesta. El system prompt (`SIMULADOR_PROMPT_V0.md`) usa las rúbricas para alinear cómo evalúa Claude.
>
> **Reglas Solca aplicadas:** sin emoji · regla de traducción · sin fabricación de nombres ni números específicos · ancla a Junior.

---

## Distribución

| Categoría | Conteo | Propósito |
|---|---|---|
| Generales pharma (transversales) | 8 | Sobre CV, motivación, empresa, industria. |
| CRA · Clinical Research Associate | 8 | Rol más demandado. Junior. |
| MSL · Medical Science Liaison | 6 | Alta densidad de PhDs en audiencia. Junior. |
| Clinical Project Manager | 5 | Entry. Coordinación. |
| Healthcare Analyst / Strategy Consulting / Analista pharma | 5 | 9 de 30 vacantes del dataset mayo 2026. |
| **Total** | **32** | |

---

## A · GENERALES PHARMA (8)

### G1 · Sobre el CV / transición

**Pregunta:** Cuéntame cómo decidiste salir de la academia y por qué pharma específicamente.

- **Tipo:** Conductual
- **Framework:** Narrativa STAR adaptada (Situación → motivación → Acción → Resultado esperado)
- **Evaluar:**
  - Claridad de motivación (no solo "no había trabajo en academia")
  - Conocimiento básico del por qué pharma vs otras industrias (medtech, biotech, consulting)
  - Honestidad sin amargura hacia academia
- **Bandera roja:** "Salí porque no me daban plaza" sin reformular hacia algo positivo. Lenguaje de víctima.
- **Tip buena respuesta:** Una frase concreta del momento que detonó la decisión + una razón específica de por qué pharma (impacto en pacientes, escalabilidad de la ciencia, etc.).

---

### G2 · Sobre la empresa

**Pregunta:** ¿Qué sabes sobre nuestra compañía y por qué te interesa este puesto en particular?

- **Tipo:** General
- **Framework:** Preparación / conocimiento de mercado
- **Evaluar:**
  - Mencionó al menos un dato verificable de la empresa (área terapéutica, mercado clave, pipeline público)
  - Conectó algo de su perfil con la posición
- **Bandera roja:** "He escuchado que es buena empresa" sin nada concreto. Respuesta intercambiable con cualquier otra empresa.
- **Tip buena respuesta:** Mencionar un área terapéutica que esté en el pipeline público + por qué tu perfil tiene match con esa área.

---

### G3 · Sobre la posición

**Pregunta:** ¿Cuál crees que es la diferencia entre este rol y trabajar en investigación académica?

- **Tipo:** Técnica/General
- **Framework:** Comprensión del oficio pharma
- **Evaluar:**
  - Menciona regulación (ICH-GCP, SOPs, etc.) como diferencia clave
  - Menciona timelines y accountability comercial
  - Menciona trabajo en equipo multidisciplinario vs lab independiente
- **Bandera roja:** "Es lo mismo pero pagan más." Subestimación del oficio.
- **Tip buena respuesta:** Tres diferencias estructurales: regulación, equipos multidisciplinarios, timelines de negocio.

---

### G4 · Sobre la industria

**Pregunta:** ¿Qué entiendes por ICH-GCP y por qué importa para este rol?

- **Tipo:** Técnica
- **Framework:** Vocabulario pharma básico
- **Evaluar:**
  - Define ICH (International Council for Harmonisation)
  - Define GCP (Good Clinical Practice)
  - Conecta con la necesidad de proteger sujetos de estudio + integridad de datos
- **Bandera roja:** No sabe qué significa el acrónimo o lo confunde con algo más (ej. "es un certificado de farmacia").
- **Tip buena respuesta:** "ICH-GCP es el estándar internacional de buena práctica clínica que protege a los participantes y asegura calidad de datos en ensayos clínicos. Para este rol importa porque cada acción está regulada por esos principios."

---

### G5 · Auto-conocimiento

**Pregunta:** ¿Cuál crees que es tu principal fortaleza para este rol y cuál es la que más necesitas desarrollar?

- **Tipo:** Conductual
- **Framework:** STAR + autoconciencia
- **Evaluar:**
  - Fortaleza ligada a habilidades reales (no genérica como "soy responsable")
  - Debilidad real, no disfrazada de fortaleza
  - Plan claro de desarrollo de la debilidad
- **Bandera roja:** "Mi debilidad es que soy perfeccionista." Cliché que esconde falta de reflexión.
- **Tip buena respuesta:** Fortaleza con ejemplo de tesis + debilidad operativa real ("manejo de timelines comerciales") con curso o plan específico para cerrarla.

---

### G6 · Manejo de presión

**Pregunta:** Cuéntame de una situación en la que tuviste que entregar un resultado en menos tiempo del que necesitabas. ¿Qué hiciste?

- **Tipo:** Conductual
- **Framework:** STAR
- **Evaluar:**
  - Situación específica (no "siempre tengo entregas")
  - Acciones concretas tomadas (prioritización, delegación, comunicación temprana)
  - Resultado medible
  - Aprendizaje
- **Bandera roja:** "Trabajé toda la noche y lo logré." Glorifica el burnout en lugar de mostrar gestión de timing.
- **Tip buena respuesta:** Caso real (defensa de tesis, paper rebuttal) + comunicación temprana con stakeholders + priorización clara.

---

### G7 · Trabajo en equipo

**Pregunta:** Pharma trabaja en equipos multidisciplinarios. Cuéntame una experiencia donde colaboraste con alguien de un perfil muy diferente al tuyo.

- **Tipo:** Conductual
- **Framework:** STAR
- **Evaluar:**
  - Ejemplo concreto, no abstracto
  - Reconoce la diferencia de perfil sin desvalorizar al otro
  - Acciones para crear puente (lenguaje común, escuchar, traducir)
- **Bandera roja:** Implícitamente desvaloriza al otro perfil ("le tuve que explicar las cosas desde cero porque no sabía nada de biología").
- **Tip buena respuesta:** Caso real con biostadístico, médico clínico, o ingeniero + acción explícita de adaptar tu vocabulario.

---

### G8 · Manejo de feedback / corrección

**Pregunta:** Cuéntame de una vez que tu jefe o asesor te corrigió fuerte. ¿Cómo lo manejaste?

- **Tipo:** Conductual
- **Framework:** STAR + madurez profesional
- **Evaluar:**
  - Acepta que recibió crítica (no la disfraza de "consejo")
  - Reflexionó antes de reaccionar
  - Acción concreta de cambio
  - Reconoce el valor del feedback
- **Bandera roja:** Justifica que el feedback estaba mal o se defiende. Respuesta de ego.
- **Tip buena respuesta:** Caso real de feedback duro + 24h de procesamiento + cambio operativo en la siguiente entrega.

---

## B · CRA · Clinical Research Associate (8)

### C1 · ICH-GCP en práctica

**Pregunta:** Imagina que en una visita de monitoreo encuentras que el sitio investigador no actualizó el consentimiento informado a la versión más reciente del protocolo. ¿Qué haces?

- **Tipo:** Situacional
- **Framework:** ICH-GCP compliance
- **Evaluar:**
  - Reconoce como hallazgo crítico (afecta protección del sujeto)
  - Documenta en monitoring visit report
  - Escala al sponsor / al investigador principal
  - Plan de acción correctivo
- **Bandera roja:** "Le digo al doctor que lo arregle." Falta de proceso formal.
- **Tip buena respuesta:** "Documento el hallazgo, lo discuto con el PI (Principal Investigator, investigador principal), notifico al sponsor y aseguro CAPA (Corrective and Preventive Action). Mientras tanto, no se enrola más sujetos hasta resolver."

---

### C2 · Source Document Verification (SDV)

**Pregunta:** ¿Qué es SDV y por qué es importante para tu rol?

- **Tipo:** Técnica
- **Framework:** ICH-GCP
- **Evaluar:**
  - Define SDV (Source Document Verification)
  - Explica para qué sirve (asegurar que datos en eCRF coinciden con fuente)
  - Menciona evolución a Risk-Based Monitoring (no es 100% SDV)
- **Bandera roja:** Confunde SDV con auditoría o con análisis estadístico.
- **Tip buena respuesta:** "SDV es Source Document Verification, comparar los datos del eCRF (electronic Case Report Form) contra documentos fuente del sitio para confirmar integridad. Hoy con RBM (Risk-Based Monitoring) se aplica selectivamente, no a todos los datos."

---

### C3 · Risk-Based Monitoring

**Pregunta:** ¿Qué entiendes por Risk-Based Monitoring y cómo cambia el rol del CRA?

- **Tipo:** Técnica
- **Framework:** ICH E6(R3)
- **Evaluar:**
  - Define RBM
  - Menciona ICH E6(R3) como contexto regulatorio
  - Entiende cambio de "verificar todo" a "priorizar por riesgo"
- **Bandera roja:** No conoce el término o lo describe como cualquier estrategia genérica.
- **Tip buena respuesta:** "RBM identifica los datos críticos y los procesos de mayor riesgo del estudio y enfoca el monitoreo ahí, en lugar de 100% SDV. ICH E6(R3) lo formalizó."

---

### C4 · Manejo de SAEs

**Pregunta:** Estás en una visita y el investigador te reporta un evento adverso serio que ocurrió hace cinco días pero no fue notificado al sponsor. ¿Qué haces?

- **Tipo:** Situacional
- **Framework:** ICH-GCP + farmacovigilancia
- **Evaluar:**
  - Reconoce que el timeline de reporte SAE (Serious Adverse Event) es 24 horas
  - Plan de acción inmediato (reportar ahora, documentar la desviación)
  - Capacitación / refuerzo al sitio
- **Bandera roja:** "Le pido al investigador que lo reporte." Subestima la gravedad.
- **Tip buena respuesta:** "Reporte inmediato al sponsor con la desviación de timeline documentada, conversación con el PI sobre el procedimiento de SAE reporting, plan de refuerzo en el siguiente site initiation visit."

---

### C5 · Trabajo con sitios investigadores

**Pregunta:** ¿Cómo manejas a un investigador principal que es muy ocupado y no te da tiempo durante las visitas de monitoreo?

- **Tipo:** Conductual / situacional
- **Framework:** Gestión de stakeholders
- **Evaluar:**
  - Empatía con la realidad del médico
  - Estrategia concreta (agendar con anticipación, preparar agenda escrita, involucrar al sub-investigator o study coordinator)
  - No escalamiento prematuro
- **Bandera roja:** "Lo escalo al sponsor." Falta de capacidad de negociación a su nivel.
- **Tip buena respuesta:** Agenda preparada, tiempos cortos y eficientes, delegar a sub-investigator partes del workflow, escalar solo si afecta compliance.

---

### C6 · TMF / eTMF

**Pregunta:** ¿Qué es el TMF y cuál es tu rol como CRA en mantenerlo en estado de inspección?

- **Tipo:** Técnica
- **Framework:** ICH-GCP / documentación regulatoria
- **Evaluar:**
  - Define TMF (Trial Master File) y eTMF (electronic)
  - Entiende "inspection-ready"
  - Conoce documentos clave: protocolo, consentimientos, CV de investigadores, FDA forms (si aplica), correspondencia regulatoria
- **Bandera roja:** Lo confunde con archivo de paciente o con CRF.
- **Tip buena respuesta:** "TMF es Trial Master File, la documentación esencial que demuestra que el estudio se condujo según protocolo y regulación. Como CRA, verifico que esté completo y al día en cada visita."

---

### C7 · Comunicación con sponsor

**Pregunta:** Detectas que el sitio está enrolando más lento de lo esperado. ¿A quién y cómo se lo comunicas?

- **Tipo:** Situacional
- **Framework:** Comunicación regulatoria
- **Evaluar:**
  - Identifica al Clinical Trial Manager o Lead CRA como receptor
  - Lo documenta en monitoring report
  - Propone plan, no solo el problema (recruitment plan revisado, soporte al sitio)
- **Bandera roja:** "Le aviso al sponsor." Vago, sin proceso ni propuesta.
- **Tip buena respuesta:** Documento en monitoring visit report con root cause análisis simple + propuesta de plan de aceleración discutida con el PI + comunicación al CTM.

---

### C8 · Auto-evaluación técnica

**Pregunta:** Si tienes un PhD pero nunca has trabajado en industria, ¿cómo le explicas al hiring manager que puedes hacer este rol sin esa experiencia previa?

- **Tipo:** General / conductual
- **Framework:** Auto-narrativa
- **Evaluar:**
  - Traduce experiencia académica a competencias CRA (protocolos, documentación, manejo de regulación interna)
  - No minimiza la curva de aprendizaje
  - Demuestra conocimiento del rol con vocabulario correcto
- **Bandera roja:** "Aprendo rápido." Genérico sin sustento.
- **Tip buena respuesta:** Conecta tesis con protocolo + cuadernos de lab con source documentation + comité de ética con IRB/IEC + plan claro de los primeros 90 días.

---

## C · MSL · Medical Science Liaison (6)

### M1 · Diferencia con visitador médico

**Pregunta:** Para alguien que no es del sector, ¿cuál es la diferencia entre un MSL y un visitador médico?

- **Tipo:** Técnica
- **Framework:** Scientific engagement vs promoción
- **Evaluar:**
  - Distinción clara: MSL hace scientific exchange, visitador hace promoción de producto
  - Reconoce que la regulación distingue ambas actividades
  - MSL se mide por calidad del intercambio científico, visitador por ventas
- **Bandera roja:** "Son casi lo mismo, solo cambia el título." Falla compliance básica.
- **Tip buena respuesta:** "MSL hace intercambio científico (scientific engagement) con KOLs (Key Opinion Leaders, médicos influyentes en un área terapéutica) y captura insights del campo. No promueve productos. El visitador médico sí promueve productos aprobados a prescriptores. La regulación distingue ambas actividades."

---

### M2 · Manejo de KOL difícil

**Pregunta:** Estás en una reunión científica y un KOL te cuestiona fuertemente la evidencia de un producto de tu compañía. ¿Cómo manejas la conversación?

- **Tipo:** Situacional
- **Framework:** Scientific Engagement (Engage → Inquire → Inform → Insight)
- **Evaluar:**
  - Mantiene postura de exchange científico, no de defensa comercial
  - Pregunta para entender la preocupación específica
  - Comparte evidencia con balance (incluye limitaciones)
  - Captura el insight como información valiosa
- **Bandera roja:** "Le presento nuestro mejor estudio para convencerlo." Lenguaje de visitador.
- **Tip buena respuesta:** "Escucho el cuestionamiento completo, pregunto para entender qué específicamente le preocupa, comparto la evidencia disponible con sus limitaciones, agradezco el insight y lo llevo al equipo de Medical Affairs como input para el plan."

---

### M3 · Definición de insight

**Pregunta:** ¿Qué es un insight en el contexto de MSL y qué haces con uno?

- **Tipo:** Técnica
- **Framework:** Scientific Engagement
- **Evaluar:**
  - Define insight como información estructurada y accionable obtenida del campo
  - Distingue de feedback simple
  - Conoce el flujo: captura → estructura → ingreso al CRM o sistema interno → discusión con Medical Affairs
- **Bandera roja:** "Es lo que te dicen los doctores." Subestima la naturaleza estructurada.
- **Tip buena respuesta:** "Un insight es información estructurada del campo (un KOL menciona una necesidad no cubierta o un patrón de uso) que se documenta, se categoriza y alimenta decisiones de evidence generation o medical strategy."

---

### M4 · Compliance MLR

**Pregunta:** ¿Qué entiendes por MLR y cómo afecta tu trabajo cotidiano?

- **Tipo:** Técnica
- **Framework:** Compliance interno
- **Evaluar:**
  - Define MLR (Medical-Legal-Regulatory)
  - Entiende que es el comité interno que aprueba materiales antes de salir
  - Conoce timelines típicos y consecuencias de no respetarlos
- **Bandera roja:** No conoce el acrónimo.
- **Tip buena respuesta:** "MLR es el comité Medical-Legal-Regulatory, el filtro interno que aprueba cualquier material antes de usarse externamente. Como MSL no salgo con materiales no aprobados — eso me hace una operación impecable."

---

### M5 · Conocimiento de área terapéutica

**Pregunta:** Imagina que vas a entrar como MSL en oncología y nunca trabajaste el área. ¿Cómo prepararías los primeros 90 días?

- **Tipo:** Conductual / situacional
- **Framework:** Onboarding pharma
- **Evaluar:**
  - Estructura de aprendizaje (papers clave, guías clínicas, libro de texto del área)
  - Identificación de KOLs principales en el territorio
  - Plan de shadowing con MSL senior
  - Comprensión del compounds del portafolio
- **Bandera roja:** "Voy a estudiar oncología." Vago.
- **Tip buena respuesta:** Plan estructurado: 30 días lectura de guidelines (NCCN, ESMO), papers landmark, productos del portafolio. 60 días mapeo de KOLs y shadowing. 90 días primeras visitas con supervisión.

---

### M6 · Transición desde PhD

**Pregunta:** Si tu PhD fue en biología molecular básica, ¿cómo argumentas que estás listo para ser MSL si nunca trabajaste con KOLs?

- **Tipo:** General / conductual
- **Framework:** Auto-narrativa
- **Evaluar:**
  - Traduce habilidades de PhD (lectura crítica de literatura, capacidad de explicar ciencia, manejo de presentaciones técnicas) al rol
  - No minimiza la curva (gestión de KOLs es un skill nuevo)
  - Demuestra que sabe lo que es scientific exchange
- **Bandera roja:** "Soy muy bueno presentando." Genérico.
- **Tip buena respuesta:** Conexión específica: defensa de tesis ↔ manejo de cuestionamientos científicos, journal club ↔ scientific exchange con pares, presentaciones internacionales ↔ comunicación con KOLs. Plan de mentoría con MSL senior los primeros meses.

---

## D · Clinical Project Manager (5)

### P1 · Stakeholder management

**Pregunta:** En un estudio multicéntrico tienes al sponsor presionando timelines, al PI quejándose de carga operativa y al CRA reportando atrasos en data entry. ¿Cómo priorizas?

- **Tipo:** Situacional
- **Framework:** RACI + risk-based thinking
- **Evaluar:**
  - Identifica al sponsor como Accountable
  - Identifica al PI y al CRA como Responsible
  - Plan de comunicación clara con cada uno
  - Risk-based: ¿qué retraso impacta critical path?
- **Bandera roja:** "Hablo con todos al mismo tiempo." Sin priorización.
- **Tip buena respuesta:** Análisis de critical path, conversación de alineación con sponsor sobre realismo de timeline, plan de soporte operativo al sitio, escalamiento estructurado al CTM si el riesgo persiste.

---

### P2 · Critical path

**Pregunta:** ¿Qué es critical path en un proyecto clínico y cómo lo identificas?

- **Tipo:** Técnica
- **Framework:** Project management
- **Evaluar:**
  - Define critical path
  - Identifica tareas típicas que pueden retrasar todo (IRB approval, regulatory submission, primer paciente)
  - Conoce herramientas (Gantt, software de PM tipo MS Project o Smartsheet)
- **Bandera roja:** No conoce el concepto o lo confunde con timeline general.
- **Tip buena respuesta:** "Critical path es la secuencia de tareas dependientes más larga del proyecto. Si una se retrasa, el proyecto entero se retrasa. En clinical trials típicamente involucra IRB, regulatory submission y first patient first visit."

---

### P3 · Manejo de presupuesto

**Pregunta:** Si descubres a mitad del estudio que vas a exceder el presupuesto en 15%, ¿qué pasos tomas?

- **Tipo:** Situacional
- **Framework:** Financial PM
- **Evaluar:**
  - Análisis de root cause (¿por qué exceso?)
  - Comunicación temprana al sponsor / management
  - Plan de mitigación con opciones (renegociar, recortar, extender)
  - Documentación
- **Bandera roja:** Lo oculta para resolverlo después. Falla ética y operativa.
- **Tip buena respuesta:** Análisis honesto del root cause, escalamiento inmediato al sponsor con opciones presentadas en bullet points y costo proyectado de cada una.

---

### P4 · Liderazgo de equipo

**Pregunta:** Tienes un CRA en tu equipo que entrega reportes técnicamente buenos pero siempre tarde. ¿Cómo lo manejas?

- **Tipo:** Conductual
- **Framework:** People management
- **Evaluar:**
  - Conversación 1:1 para entender causas
  - Plan claro con expectativas escritas
  - Acompañamiento si necesario (priorización, capacitación)
  - Escalamiento si no mejora
- **Bandera roja:** "Le aviso a HR." Salto al control sin gestión previa.
- **Tip buena respuesta:** 1:1 enfocado en root cause, expectativas SMART, seguimiento semanal, escalamiento solo si no mejora después de plan claro de 30 días.

---

### P5 · Reporte ejecutivo

**Pregunta:** Si tuvieras que dar un status update de 5 minutos a un director sobre un estudio en curso, ¿qué incluirías y qué dejarías fuera?

- **Tipo:** Conductual / técnica
- **Framework:** Executive communication
- **Evaluar:**
  - Incluye: progreso vs plan, key risks y mitigaciones, asks específicos del management
  - Excluye: detalles operativos sin impacto en decisiones
  - Formato claro (semáforo, números)
- **Bandera roja:** Listar todo lo que está pasando sin priorizar.
- **Tip buena respuesta:** "Status semáforo + 1 KPI principal + top 2 riesgos con mitigación + ask específico al director."

---

## E · Healthcare Analyst / Strategy Consulting / Analista pharma (5)

### A1 · PICO framework

**Pregunta:** ¿Qué es el framework PICO y cómo lo aplicarías a una pregunta de mercado farmacéutico?

- **Tipo:** Técnica
- **Framework:** PICO (Population, Intervention, Comparator, Outcome)
- **Evaluar:**
  - Define los 4 elementos
  - Aplica a una pregunta concreta
  - Conecta con evidence-based decision making
- **Bandera roja:** No conoce el framework.
- **Tip buena respuesta:** "PICO es Population, Intervention, Comparator, Outcome. Si la pregunta de mercado es 'cuánto vale lanzar un biosimilar en diabetes', PICO me ayuda a estructurar: P = diabéticos tipo 2 no controlados con insulina basal, I = biosimilar nuevo, C = referencia, O = HbA1c reducción + adherencia + costo."

---

### A2 · Real World Evidence (RWE)

**Pregunta:** ¿Qué es Real World Evidence y por qué pharma lo valora cada vez más?

- **Tipo:** Técnica
- **Framework:** HEOR / regulatorio
- **Evaluar:**
  - Define RWE (evidencia de uso real, fuera del ensayo clínico)
  - Conoce fuentes (registros, claims, EHR)
  - Entiende valor regulatorio (FDA, EMA) y para acceso de mercado
- **Bandera roja:** Lo confunde con resultados de un ensayo clínico fase IV.
- **Tip buena respuesta:** "RWE es evidencia de uso del producto en condiciones reales, fuera del ensayo controlado. Viene de registros, bases de datos administrativas, EHR. Importa porque complementa el RCT para acceso de mercado y decisiones regulatorias."

---

### A3 · Caso de mercado entry-level

**Pregunta:** Una empresa pharma quiere lanzar un producto nuevo en México. ¿Qué 3 preguntas analíticas plantearías para evaluar la oportunidad?

- **Tipo:** Situacional / case interview
- **Framework:** Razonamiento estructurado
- **Evaluar:**
  - Estructura clara (mercado, competencia, acceso)
  - Preguntas operacionalizables
  - Conoce el contexto LATAM (acceso público, COFEPRIS, cobertura IMSS/ISSSTE)
- **Bandera roja:** Preguntas tan amplias que son inútiles ("¿hay demanda?").
- **Tip buena respuesta:** "Uno: tamaño y crecimiento del mercado en pacientes diagnosticados y tratados. Dos: posicionamiento competitivo del producto vs estándar actual incluyendo precio. Tres: ruta de acceso en cobertura pública (IMSS, ISSSTE, Seguro Popular sucesor) y privada."

---

### A4 · Comunicación a no técnicos

**Pregunta:** Tienes un análisis que muestra que un producto tiene mejor outcome clínico pero costo 20% mayor que el comparador. ¿Cómo se lo presentas a un director comercial?

- **Tipo:** Conductual / técnica
- **Framework:** Executive communication
- **Evaluar:**
  - Traduce número a impacto comercial
  - Presenta tradeoff con claridad (mejor outcome ↔ mayor costo)
  - Sugiere segmentos donde la diferencia es defensible
  - Evita jerga técnica innecesaria
- **Bandera roja:** Listar tablas estadísticas sin traducción.
- **Tip buena respuesta:** "Un slide con 2 columnas: outcome (mejor 20% en X) + costo (mayor 20%). Cálculo del costo-efectividad incremental. Identificación de segmentos donde el outcome justifica el costo (pacientes refractarios, hospitalización evitada). Una recomendación clara."

---

### A5 · Transición desde academia analítica

**Pregunta:** Si vienes de una tesis con análisis estadístico fuerte, ¿cómo argumentas que puedes hacer analytics pharma sin haber tocado el sector?

- **Tipo:** General / conductual
- **Framework:** Auto-narrativa
- **Evaluar:**
  - Traduce skills académicos a pharma analytics
  - Conoce vocabulario básico de HEOR / market access
  - Reconoce la curva de aprendizaje del contexto regulatorio
- **Bandera roja:** "Sé R y Python." No conecta con valor pharma.
- **Tip buena respuesta:** "Mi tesis manejó N grande con datos longitudinales y métodos causales (propensity matching, IV). En pharma analytics eso es el corazón de RWE. La curva está en el contexto: aprender taxonomías de claims, ICD-10, ATC, y el lenguaje del HEOR."

---

## F · TEMPLATES CV-ANCLADAS (12 patrones · solo planes pagos)

> Estas no son preguntas fijas. Son **patrones** que Claude rellena con datos extraídos del CV del candidato. Cada template incluye el patrón, qué campo del `cv_resumen` lo activa, y la rúbrica de evaluación.
>
> Regla anti-fabricación: si el campo está vacío o no aplica, Claude NO usa el template. Selecciona otro o cae al banco fijo.

---

### CV1 · Técnica académica → rol pharma

**Patrón:** *"En tu CV mencionas {tecnica_especifica} durante {formacion}. ¿Cómo conectarías esa técnica con las responsabilidades de un {rol}?"*

- **Activa con:** `tecnicas[]` no vacío + `rol` definido
- **Evaluar:**
  - Conexión real, no forzada (¿de verdad la técnica aporta al rol?)
  - Vocabulario de traducción (analogous to, transferable skills)
  - Honestidad sobre lo que NO aplica
- **Bandera roja:** Forzar conexiones falsas ("la citometría me prepara para hablar con KOLs").
- **Tip buena respuesta:** Conectar el principio detrás de la técnica (manejo de protocolos, lectura de datos, rigor experimental) con el principio del rol, no la técnica per se con la tarea.

---

### CV2 · Área temática vs rol aplicado

**Patrón:** *"Tu CV muestra experiencia en {area_tematica_X} pero estás aplicando a un rol en {rol_o_area_Y}. ¿Cómo justificas el cambio?"*

- **Activa con:** `areas_tematicas[]` que NO coincide con el `rol_apuntado` o vacante
- **Evaluar:**
  - Reconoce el cambio sin minimizarlo
  - Articula el por qué del cambio
  - Identifica skills transferibles concretos
- **Bandera roja:** "Es lo mismo." Falta de honestidad sobre la curva de cambio.
- **Tip buena respuesta:** "Mi experiencia en X me dio Y skill, que se transfiere a Z aspecto del rol en W. La curva específica es A."

---

### CV3 · Publicaciones como evidencia

**Patrón:** *"Tu CV indica {N} publicaciones como {primer/coautor}. En una entrevista para {rol}, ¿cómo presentarías eso sin sonar académico?"*

- **Activa con:** `publicaciones_count` > 0
- **Evaluar:**
  - Traduce métrica académica (papers, IF) a métrica pharma (rigor, impacto, comunicación)
  - Evita jerga académica innecesaria
  - Conecta con responsabilidades del rol
- **Bandera roja:** Mencionar impact factor, h-index, o nombres de journals sin contexto.
- **Tip buena respuesta:** "Las publicaciones demuestran tres cosas relevantes para {rol}: capacidad de escribir con claridad técnica, manejo de revisión por pares (analogous to MLR), y persistencia en proyectos multi-año."

---

### CV4 · Idioma inglés ausente o ambiguo

**Patrón:** *"No noté en tu CV una declaración explícita de tu nivel de inglés. ¿Cuál es tu nivel real, especialmente verbal?"*

- **Activa con:** `idiomas_declarados[]` vacío o sin inglés
- **Evaluar:**
  - Honestidad sobre el nivel (no inflar)
  - Reconoce que pharma LATAM mayoritariamente requiere inglés
  - Plan si no es C1 (curso, práctica)
- **Bandera roja:** "Mi inglés es excelente" sin sustento. Mentir aquí se descubre en la siguiente ronda.
- **Tip buena respuesta:** Nivel honesto (B2 lectura, B1 verbal) + plan concreto (curso, conversación semanal) + evidencia (papers leídos, conferencias atendidas).

---

### CV5 · Gap temporal

**Patrón:** *"Veo un periodo de {duracion} entre {evento_anterior} y {evento_posterior}. ¿Qué pasó en ese tiempo?"*

- **Activa con:** `gaps_visibles[]` no vacío
- **Evaluar:**
  - Reconoce el gap sin defensividad
  - Explica con calma y honestidad
  - Reconvierte el tiempo a algo útil (descanso, formación, búsqueda, vida personal)
- **Bandera roja:** Excusa larga y nerviosa. Sugiere que algo se oculta.
- **Tip buena respuesta:** "Tomé X tiempo para Y razón. Durante eso hice Z (curso, descanso necesario, cuidado familiar). Estoy listo para volver."

---

### CV6 · Sobre el último rol declarado

**Patrón:** *"En tu CV aparece como tu rol más reciente {experiencia[0]}. ¿Por qué decidiste buscar un cambio?"*

- **Activa con:** `experiencia[0]` definido
- **Evaluar:**
  - Razón clara del cambio (no quejas del actual)
  - Conecta con lo que busca en el siguiente rol
  - Tono profesional
- **Bandera roja:** Hablar mal del jefe o empresa actual. Red flag universal.
- **Tip buena respuesta:** Razón profesional honesta (crecimiento limitado, cambio de área de interés, necesidad de aprender X) + conexión con lo que el siguiente rol ofrece.

---

### CV7 · Habilidades pharma evidentes

**Patrón:** *"Tu CV menciona {fortaleza_pharma_evidente}. Cuéntame más en detalle de esa experiencia."*

- **Activa con:** `fortalezas_pharma_evidentes[]` no vacío
- **Evaluar:**
  - Profundidad real (más allá de lo que dice el CV)
  - Vocabulario pharma correcto al describir
  - Ejemplos concretos
- **Bandera roja:** No poder elaborar lo que el CV declara. CV inflado.
- **Tip buena respuesta:** Tres niveles de detalle: qué hiciste, cómo lo hiciste, qué aprendiste. Vocabulario pharma fluido al describir.

---

### CV8 · Primer rol en industria

**Patrón:** *"Tu CV no muestra experiencia previa en industria farmacéutica. ¿Por qué crees que el hiring manager debería arriesgarse contigo en este rol?"*

- **Activa con:** `gaps_visibles[]` incluye "sin_experiencia_industria"
- **Evaluar:**
  - Reconoce la curva de aprendizaje
  - Articula valor diferencial (qué trae que un perfil con experiencia no trae)
  - Plan de los primeros 90 días
- **Bandera roja:** "Aprendo rápido." Cliché sin sustento.
- **Tip buena respuesta:** "Reconozco que la curva inicial es real. Lo que traigo que un perfil con 3 años de CRA no tiene: rigor académico para protocolos complejos, capacidad de lectura crítica de literatura, manejo de presentaciones técnicas. Mi plan 30/60/90 sería..."

---

### CV9 · Experiencia internacional (cuando existe)

**Patrón:** *"Vi que tienes experiencia en {pais_o_institucion_extranjera}. ¿Cómo crees que esa experiencia internacional te diferencia para este rol en {pais_actual}?"*

- **Activa con:** experiencia extranjera detectada en `experiencia[]` o `formacion`
- **Evaluar:**
  - Conexión real con el rol (no solo "mejor inglés")
  - Mención de exposure a frameworks regulatorios distintos (FDA vs ANMAT)
  - Capacidad de adaptación
- **Bandera roja:** Solo enfatizar "inglés mejorado" sin más.
- **Tip buena respuesta:** Exposición a frameworks distintos + capacidad de adaptar + perspectiva multicultural útil para roles regionales.

---

### CV10 · Posdoc largo (cuando aplica)

**Patrón:** *"Veo en tu CV {duracion_posdoc} en posdoc. ¿Qué te hace decidir salir ahora y no haberlo hecho antes?"*

- **Activa con:** experiencia posdoctoral > 2 años detectada
- **Evaluar:**
  - Honestidad sobre el momento de la decisión
  - Madurez sobre la academia (sin amargura)
  - Claridad del futuro buscado
- **Bandera roja:** "No conseguí plaza" sin reformular.
- **Tip buena respuesta:** "El posdoc me dio X aprendizaje. Llegué al punto donde Y motivación pesa más. Pharma me ofrece Z específico."

---

### CV11 · Mención de un área específica que no aplica directamente al rol

**Patrón:** *"Tu CV menciona experiencia en {area_no_relacionada_al_rol}. ¿Por qué incluiste eso si no aplica directamente?"*

- **Activa con:** algún elemento de `experiencia[]` o `tecnicas[]` que NO se mapea al rol_apuntado
- **Evaluar:**
  - Razón consciente de por qué está
  - Conexión transferible al rol
  - Capacidad de editar el CV para distintas vacantes
- **Bandera roja:** "No sé, lo dejé porque sí." Falta de awareness del CV propio.
- **Tip buena respuesta:** Razón clara (skill transferible específico, contexto histórico, ampliación) + reconocimiento de que el CV debe adaptarse al rol.

---

### CV12 · Falta de una habilidad esperada

**Patrón:** *"Para el rol de {rol}, una habilidad esperada es {habilidad_clave_ausente_en_cv}. ¿Cuál es tu nivel actual ahí?"*

- **Activa con:** match entre rol_apuntado y skills críticos faltantes (ej. CRA sin ICH-GCP, MSL sin área terapéutica clara)
- **Evaluar:**
  - Honestidad sobre el gap
  - Plan concreto para cerrarlo
  - Reconocimiento del por qué importa para ese rol
- **Bandera roja:** Inventar experiencia que no está en el CV. El reclutador real lo verifica.
- **Tip buena respuesta:** "Tengo X nivel actual. Reconozco que el rol espera Y. Mi plan es Z (curso TransCelerate, mentoría, etc.) y mientras tanto compenso con W."

---

## Notas operativas para Fase 0.2 (validación)

Próxima sesión: yo simulo 5 perfiles de candidato y respondo a 3 preguntas cada uno usando el system prompt v0. Tú lees:

- ¿La pregunta que Claude eligió es realista para ese perfil?
- ¿El feedback es útil o suena genérico?
- ¿Las definiciones inline funcionan?
- ¿La rúbrica del banco semilla se respetó?
- ¿Algún caso fabricó nombres o números?

Iteramos a v0.1 y completamos el banco hasta ~60 preguntas.

---

— Solca · Simulador de Entrevistas · Banco semilla v0 · 12 jun 2026
