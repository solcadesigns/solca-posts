# Simulador de Entrevistas · Framework de feedback

> **Estado:** v1 · 12 jun 2026.
> **Propósito:** dos cuestionarios distintos para los dos momentos de validación del simulador. Cuestionario A para validación interna con CVs propios de Oscar. Cuestionario B para beta cerrada con 20-30 invitados.
> **Diferencia clave:** A es auditoría técnica rigurista (busca bugs y fabricaciones). B es percepción de usuario (busca utilidad y disposición de pago).

---

## CUESTIONARIO A · Validación interna con 3-4 CVs propios

### Propósito

Tú (Oscar) corres el simulador con 3-4 CVs que ya conoces (idealmente: uno PhD biólogo, uno biotecnólogo, uno médico, uno con gap evidente). Como conoces cada CV con detalle, puedes detectar cuando el simulador fabrica, malinterpreta, o se queda corto.

### Cuándo llenarlo

**Inmediatamente al cerrar cada sesión.** No esperes. Mientras la conversación está fresca tus impresiones son nítidas. Si esperas 24h ya borraste detalles.

### Estructura

Dividido en tres partes:
1. **Pre-sesión** (30 segundos): metadata
2. **Auditoría pregunta por pregunta** (1 min por pregunta): matriz de validación
3. **Post-sesión** (5 min): evaluación global

---

### Parte 1 · Pre-sesión

Antes de empezar la sesión, anota:

```
CV usado: ___________________ (nombre o etiqueta corta)
Perfil resumido: ___________________ (1 línea: formación + años + área)
Rol al que se aplicó: ___________________
Empresa/vacante (si aplica): ___________________
Modo seleccionado: A (con vacante) / B (solo practicar)
Enfoque: técnico / conductual / mezcla
Nivel de exigencia: moderado / exigente / muy exigente
Número de preguntas: 5 / 10 / 15
Fecha y hora: ___________________
```

---

### Parte 2 · Auditoría pregunta por pregunta

Para CADA pregunta del simulador durante la sesión, llena esta matriz:

| Campo | Valores | Notas |
|---|---|---|
| Pregunta # | 1, 2, 3... | |
| Texto de la pregunta (resumido) | | |
| ¿Realista? | sí / parcial / no | Un reclutador real haría esta pregunta? |
| ¿Personalizada al CV? | sí / no / no aplica | Solo si subiste CV |
| ¿Citó el CV literalmente? | sí / no / inventó cita | Crítico: si dice "mencionas X" cuando NO mencionas X, es fabricación |
| ¿Definió acrónimos nuevos? | sí / no / no había acrónimos | Regla de traducción |
| ¿Fabricó algún nombre/empresa/estudio? | sí / no | Crítico: 0 tolerancia a fabricación |
| Calidad del feedback (1-5) | 1=inútil 5=excelente | |
| ¿Score de Claude vs tu juicio? | coincide / Claude más generoso / Claude más severo | |
| Notas libres | | Lo que sea relevante |

**Bandera roja crítica:** cualquier fila con "inventó cita" o "fabricó nombre" detiene la prueba. Anota qué fabricó exactamente. Eso va a v0.2 del prompt.

**Bandera roja v0.3:** si dos preguntas consecutivas reciben feedback con el MISMO ángulo pedagógico (todos suenan a "consejo de mentor" o todos a "lo que el reclutador piensa"), el Mecanismo 3 (pool rotativo) está fallando. Anota cuál ángulo se sobreusó.

**Bandera roja v0.4 · fabricación motivacional:** si en cualquier feedback o cierre aparecen frases comparativas estadísticas sin fuente, está fallando la regla anti-fabricación-motivacional. Ejemplos a cazar:

- *"Tu respuesta está en el top-quartile"*
- *"La vast majority of candidates falla esta pregunta"*
- *"Pocas sesiones llegan a este nivel"*
- *"Estás arriba del promedio para tu rol"*
- *"El 80% de candidatos PhD no menciona X"*

Esta bandera es SEPARADA de la fabricación de hechos (nombres/papers/empresas inventados). El patrón cazado en Fase 0.2 con el CV de Oscar fueron tres ocurrencias de este tipo, todas vinculadas al ángulo pedagógico B (eliminado en v0.4). Reincorporación del ángulo B y de comparaciones estadísticas requiere ≥50 sesiones beta para tener data real del promedio.

---

### Parte 3 · Post-sesión (10 preguntas)

#### P1 · Calidad general del simulador

Del 1 al 5, ¿cómo evalúas la sesión completa en términos de utilidad para un candidato real?

`1 = inservible · 2 = malo · 3 = aceptable · 4 = bueno · 5 = excelente`

Respuesta: __

Justifica en 1-2 frases: __

#### P2 · Calidad técnica del feedback

¿El feedback que Claude dio después de cada respuesta es accionable? ¿Le dice al candidato qué hacer distinto la próxima vez?

`Sí en todas / Sí en la mayoría / Mitad y mitad / No en la mayoría / No en ninguna`

Respuesta: __

Ejemplo concreto del mejor feedback: __

Ejemplo concreto del peor feedback: __

#### P3 · Personalización del CV

Si subiste CV, ¿las preguntas CV-ancladas se sintieron reales o forzadas?

`Reales en todas / Reales en la mayoría / Mitad y mitad / Forzadas la mayoría / No usó el CV`

Respuesta: __

#### P4 · Fabricación detectada

¿Detectaste alguna fabricación durante la sesión? (nombres, empresas, estudios, citas del CV inventadas, estadísticas sin fuente, etc.)

`Sí / No`

Si sí, describe exactamente qué fabricó: __

#### P5 · Reglas de marca

¿El simulador respetó las reglas de marca Solca durante toda la sesión?

| Regla | Cumplió |
|---|---|
| Sin emoji | sí / no |
| Definió acrónimos primera vez | sí / no / no había |
| Tono profesional español neutro | sí / no |
| Feedback honesto sin floritura | sí / no |
| Cero fabricación | sí / no |

#### P6 · El reporte final JSON

¿El JSON final con scores y recomendaciones está bien estructurado?

`Sí, listo para frontend / Sí pero falta algo / Roto`

Si "falta algo" o "roto", describe: __

#### P7 · El JSON de métricas anónimas

¿Las métricas extraídas son útiles para análisis de negocio?

`Muy útiles / Útiles / Mediocres / Inútiles`

¿Algún campo importante falta? __

¿Algún campo se filtró que debería ser privado? (nombre, email, etc.) __

#### P8 · Comparación con un reclutador humano

Sin minimizar las diferencias obvias, ¿qué tan cerca está la sesión de una entrevista de un reclutador pharma real?

`Muy lejos / Lejos pero útil / A medio camino / Cerca / Indistinguible`

Respuesta: __

¿Qué le falta para acercarse más? __

#### P9 · La pregunta sorpresiva

Si tuvieras que listar UNA cosa que te sorprendió (positiva o negativa) durante la sesión, ¿qué sería?

Respuesta libre: __

#### P10A · Variabilidad del feedback (v0.3)

Si corriste la misma sesión 2 veces con CVs similares o el mismo CV: ¿el feedback se sintió variado o redundante?

`Muy variado / Aceptable / Repetitivo / Idéntico / No probé esto`

Si "Repetitivo" o "Idéntico", anota qué frases se repitieron literalmente: __

¿Detectaste que Claude rotara los ángulos pedagógicos? (reclutador, benchmark, mentor, accionable, evidencia)

`Sí, claramente / Más o menos / No, todo era el mismo ángulo`

#### P10B · CTA libro (v0.3)

Si corriste sesión con plan `basico` simulado sesión 1 o 2: ¿apareció CTA libro?

`Sí (problema — no debería) / No (correcto)`

Si corriste sesión con plan `intensivo` simulado sesión 8-10: ¿el CTA libro estaba justificado por el feedback de la sesión o sonaba a banner?

`Justificado / Mitad y mitad / Sonaba a banner`

#### P10C · Conexión entre preguntas (v0.3)

¿Claude conectó respuestas previas de la sesión con preguntas posteriores? (ej. "en tu pregunta 3 dijiste X, esta respuesta lo contradice")

`Sí, varias veces / Una o dos / No nunca`

Si no lo hizo nunca, ese mecanismo 2 está fallando.

#### P11 · ¿Lanzas o vuelves a iterar?

Si esta fuera la versión final, ¿la lanzarías a la beta cerrada de 20-30 personas o iteramos antes?

`Lanzar tal cual / Lanzar con cambios menores / Iterar v0.2 antes de beta`

Si iteramos: top 3 cambios prioritarios: __

---

## CUESTIONARIO B · Beta cerrada (20-30 invitados)

### Propósito

Después de las correcciones internas con tus 3-4 CVs, mandas a los 20-30 invitados. Cada uno hace 1-3 sesiones. El cuestionario B mide percepción, utilidad, fricción de UX, y disposición de pago.

### Diseño operativo

Tres puntos de contacto. Ni más ni menos.

| Momento | Qué se manda | Largo | Esfuerzo del usuario |
|---|---|---|---|
| **Día 0 · inmediato post-sesión** | Encuesta rápida 5 preguntas | 1 min | Bajo |
| **Día 3 · si no respondió** | Recordatorio amable + 2 preguntas extra opcionales | 3 min | Medio |
| **Día 7 · cierre de cohorte** | Survey final amplio 10 preguntas | 7 min | Alto, con incentivo |

### Sobre tu propuesta de "recordatorios diarios por una semana"

Mi recomendación honesta: **no.** Razones:

1. **Caída de respuesta acelera después del 3er contacto.** Research clásico de email marketing: del primer contacto al tercero la tasa de respuesta cae típicamente 60-70%. Del tercero al octavo cae otro 50% más. Diario por una semana = 8 contactos = casi nadie contesta los últimos.
2. **Riesgo de irritación y unsubscribe.** Tu audiencia son profesionales ocupados. Aunque haya compromiso con la beta, "completa esto YA" 7 días seguidos se siente como spam.
3. **Diluyes la señal del Día 0.** Si saben que vas a recordarles cada día, no priorizan el Día 0. Si saben que solo hay 3 contactos, el Día 0 pesa más.

**Lo que sí funciona:** los 3 puntos de contacto arriba. Total 3 emails en 7 días. Cada uno con propósito distinto. La data agregada que sale es:

- ~85% responde Día 0 (la encuesta rápida).
- ~60% del 15% restante responde Día 3.
- ~40% adicional responde Día 7 (porque ya están en cierre, hay incentivo).

Resultado típico: 85-90% de los beta dan al menos una respuesta. Diario diario habría dado quizás 50-60% por fatiga.

**Si insistes en algo más frecuente** (válido si tienes datos que demuestren que tu audiencia tolera más toques): te propongo **Día 0 + Día 2 + Día 5 + Día 7**. Cuatro contactos, espaciados con razón. Es el máximo que recomiendo sin riesgo de erosión.

### El cuestionario · Día 0 (5 preguntas · 1 minuto)

Se envía automáticamente 2-5 minutos después de cerrar la sesión (cuando el usuario ya guardó su PDF). El asunto debe ser personal y específico, no genérico.

**Asunto del email:** *"¿Cómo te fue con el simulador, {nombre}?"*

**Cuerpo del email:**

> Gracias por probar el simulador, {nombre}.
>
> Antes de que se vaya tu impresión fresca, ¿me ayudas con 5 preguntas rápidas? Toman menos de un minuto.
>
> [Botón: Responder ahora →]

**Las 5 preguntas:**

#### B1 · Utilidad percibida

> En una escala del 1 al 10, ¿qué tan útil te pareció esta sesión para preparar una entrevista real?
>
> `1 = nada útil · 10 = extremadamente útil`

(Escala numérica)

#### B2 · Realismo de las preguntas

> ¿Las preguntas que te hizo el simulador se sintieron como las que haría un reclutador real?
>
> `□ Sí, todas` `□ La mayoría` `□ Algunas` `□ Pocas` `□ Ninguna`

#### B3 · Calidad del feedback

> ¿El feedback después de cada respuesta te dijo algo útil que no sabías?
>
> `□ Sí, mucho` `□ Algo útil` `□ Más o menos` `□ Poco` `□ Nada útil`

#### B4 · La sorpresa

> En una frase: ¿qué te sorprendió de la sesión? (puede ser positivo o negativo)

(Texto libre, opcional pero recomendado en el copy)

#### B5 · Disposición de pago

> Si esta versión existiera como producto pagado, ¿qué precio te parecería justo por 3 sesiones completas con análisis de tu CV?
>
> `□ Menos de $100 MXN` `□ $100-150 MXN` `□ $150-250 MXN` `□ $250-400 MXN` `□ Más de $400 MXN` `□ No lo pagaría`

### El cuestionario · Día 3 (2 preguntas extra · 3 minutos · solo si no respondió Día 0 o si respondió y quieres profundizar)

**Asunto:** *"Una cosa más sobre el simulador, {nombre}"*

#### B6 · El momento de mayor incomodidad

> Durante la sesión, ¿hubo un momento en que sentiste que la pregunta era injusta, fuera de lugar, o que el feedback fue genérico? Cuéntame cuál.

(Texto libre)

#### B7 · Para quién

> Si tuvieras que recomendar el simulador a una persona específica de tu red, ¿quién sería y por qué?

(Texto libre — esta pregunta te da gold para targeting de marketing)

### El cuestionario · Día 7 (10 preguntas · 7 minutos · survey de cierre con incentivo)

**Incentivo recomendado:** acceso gratuito a un libro de Solca (cualquiera de los 3) por responder. Cuesta cero adicional porque tienes inventario digital infinito.

**Asunto:** *"{nombre}, cierro la beta hoy · 7 minutos y te regalo el libro que quieras"*

#### Survey de cierre (10 preguntas)

```
1. ¿Cuántas sesiones completaste? (1, 2, 3, ninguna)

2. Si tuvieras que describir el simulador en 3 palabras, ¿cuáles serían?

3. Lo MEJOR del simulador, en una frase:

4. Lo PEOR del simulador, en una frase:

5. ¿Qué cambiarías si fueras product manager?

6. ¿Pagarías $149 MXN por 3 sesiones con CV?
   □ Sí · ya con esta versión   □ Sí · si arreglan X   □ No

7. ¿Pagarías $349 MXN por 10 sesiones?
   □ Sí · ya con esta versión   □ Sí · si arreglan X   □ No

8. ¿Pagarías $599 MXN por sesiones ilimitadas un mes?
   □ Sí · ya con esta versión   □ Sí · si arreglan X   □ No

9. ¿Recomendarías el simulador a otro PhD/profesional que esté en transición?
   □ Sí, sin condiciones   □ Sí, con condiciones   □ Tal vez   □ No

10. ¿Quieres que te avise cuando el simulador esté oficialmente disponible?
    □ Sí (correo)   □ No
```

---

## Mecánica de delivery (cómo se manda)

### Día 0 (inmediato post-sesión)

**Trigger:** webhook al cerrar la sesión en el frontend → endpoint `/api/simulator-feedback-trigger` → Postmark `sendEmailWithTemplate` con template alias `simulator-feedback-d0` + `templateModel: {nombre, rol_practicado, survey_url}`.

**Implementación:** el frontend manda `POST /api/simulator-feedback-trigger` con `{email, nombre, rol, codigo_beta}`. El endpoint valida, guarda estado en KV `SIMULATOR_FEEDBACK` con clave `sf:{email}:d0` (para dedupe y para saber si contestó), y llama al wrapper `src/lib/postmark.ts::sendEmailWithTemplate` que dispara el email con el survey link incluido (Google Forms o Tally.so).

### Día 3 (recordatorio condicional)

**Trigger:** Cloudflare Cron 1x/día. Recorre KV `SIMULATOR_FEEDBACK` buscando keys `sf:*:d0` con `age >= 3d` y `completed !== true`. Para esos, envía B6+B7 vía Postmark (template `simulator-feedback-d3-recordatorio`) y marca `d3_sent: true` para no repetir.

**Cómo se sabe si contestó:** Google Forms / Tally tienen webhooks que avisan cuando alguien envía respuesta. Endpoint `POST /api/simulator-feedback-webhook` recibe el evento y setea `completed: true` en el record de KV `SIMULATOR_FEEDBACK`.

### Día 7 (cierre de cohorte)

**Trigger:** scheduled task fijo 7 días después de la primera invitación a la cohorte. Independiente de si respondieron Día 0 o Día 3. Incluye link a Tally con survey de 10 preguntas y promesa de libro.

### Plataformas

- **Forms:** Tally.so (mejor UX que Google Forms, free plan suficiente para 30 usuarios).
- **Email:** Postmark (integrado desde jul 2026, ver `src/lib/postmark.ts`). Templates a crear: `simulator-feedback-d0`, `simulator-feedback-d3-recordatorio`, `simulator-feedback-d7-cierre`.
- **Tracking:** UTM en cada link para separar Día 0 vs Día 3 vs Día 7 en analytics.

### Datos a guardar

Por cada beta user en KV `SIMULATOR_BETA_FEEDBACK`:

```
{
  codigo_beta: "XYZ12345",
  nombre_pila: "Andrea",
  email_hash: "sha256(email)",
  sessions_completed: 2,
  feedback_day0: { B1: 8, B2: "La mayoría", B3: "Algo útil", B4: "Me sorprendió que detectara el gap en mi CV", B5: "150-250 MXN" },
  feedback_day3: null,
  feedback_day7: { ... },
  willingness_to_pay_aggregated: "$149-$349 MXN",
  nps_inferred: 8,
  qualitative_quote: "Me sorprendió que detectara el gap en mi CV"
}
```

---

## Criterios de éxito de la beta (qué necesitas ver para lanzar producción)

Después de los 7-14 días de beta, estos son los números que indican "listo para lanzar comercial":

| Métrica | Mínimo aceptable | Excelente |
|---|---|---|
| Tasa de respuesta Día 0 | ≥70% | ≥85% |
| Promedio B1 (utilidad 1-10) | ≥7.0 | ≥8.5 |
| % respondieron "Sí pagaría $149" en B6 (Día 7) | ≥40% | ≥60% |
| % que recomendarían a otro | ≥50% | ≥70% |
| Fabricaciones detectadas | 0 | 0 |
| Quejas estructurales graves (UX) | ≤2 | 0 |

Si las 6 columnas caen en "mínimo aceptable" o mejor: lanzas la versión comercial pública con paywall Conekta.
Si alguno cae por debajo: iteración v0.3 y segunda beta de 15-20 personas antes de lanzar.

---

— Solca · Simulador de Entrevistas · Framework de feedback v1 · 12 jun 2026
