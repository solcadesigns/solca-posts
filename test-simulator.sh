#!/usr/bin/env bash
# Test del endpoint /api/simulator-session con sesión completa de 5 preguntas.
# Requiere jq instalado: brew install jq

set -e

ENDPOINT="https://solcaciencia.com/api/simulator-session"

# Perfil de prueba: PhD biomedicina entry-level apuntando a CRA en IQVIA, phone screen.
PROFILE='{
  "mode": "A",
  "roleTitle": "Clinical Research Associate",
  "company": "IQVIA",
  "formationArea": "PhD_biomedicina",
  "experienceYears": "sin_experiencia",
  "specialty": "neurociencia",
  "focus": "mezcla",
  "language": "bilingue",
  "difficulty": "exigente",
  "interviewStage": "phone_screen",
  "questionCount": 5
}'

# Respuestas pre-fabricadas del "candidato sintético" para cada pregunta.
ANSWERS=(
  "Soy PhD en biomedicina con foco en neurociencia. Salí de la academia porque después de cinco años en posdoc me di cuenta de que el oficio clínico aplicado me apasiona más que la investigación básica. Pharma me da la escala y el impacto regulatorio que la academia no me daba."
  "IQVIA es el CRO más grande del mundo con fuerte presencia en oncología, CNS y rare disease. Me interesa porque tienen el dataset MIDAS que pocos competidores ofrecen, y su práctica en clinical operations en LATAM es robusta. Mi PhD en neurociencia conecta directo con su pipeline CNS."
  "ICH-GCP es el estándar internacional de Good Clinical Practice del International Council for Harmonisation. Importa porque protege a los sujetos del estudio y asegura integridad de datos. En el rol de CRA, cada acción que tomo se ancla en GCP."
  "Cuando hay timeline ajustado, la regla es priorización al inicio, no velocidad después. En mi posdoc tuve una situación donde el sponsor (Eli Lilly) necesitaba data lock parcial en tres días. Hice triage de queries por tipo y persona requerida, resolví las mías primero y agendé las del médico en una sesión conjunta. Cerramos en cinco días sin shortcuts."
  "Mis primeros 90 días los enfocaría en tres cosas: las SOPs específicas de IQVIA para CRA work, el portfolio terapéutico al que me asignen — idealmente CNS donde mi background da match — y el organigrama de mi equipo: PI, sub-investigator, CTM. La marca de éxito a 90 días sería estar haciendo monitoring visits sola con review del CRA senior."
)

echo "═══════════════════════════════════════════════════════════════"
echo "  PRUEBA · Sesión completa contra /api/simulator-session"
echo "  Perfil: PhD biomedicina · CRA IQVIA · Phone screen · 5 preguntas"
echo "═══════════════════════════════════════════════════════════════"
echo

# Paso 1 · init
echo "▶ INIT · arrancando sesión..."
INIT_PAYLOAD=$(jq -n --argjson p "$PROFILE" '{action:"init",plan:"gratis",sessionNumberInPackage:1,profile:$p}')
INIT_RESPONSE=$(curl -sS -X POST "$ENDPOINT" -H "Content-Type: application/json" -d "$INIT_PAYLOAD")

OK=$(echo "$INIT_RESPONSE" | jq -r '.ok')
if [ "$OK" != "true" ]; then
  echo "✘ Error en init:"
  echo "$INIT_RESPONSE" | jq .
  exit 1
fi

SESSION_STATE=$(echo "$INIT_RESPONSE" | jq '.sessionState')
QUESTION=$(echo "$INIT_RESPONSE" | jq -r '.nextQuestion.questionText')

echo "✓ Sesión iniciada"
echo
echo "── Pregunta 1 ──"
echo "$QUESTION"
echo

# Bucle por las 5 preguntas
for i in 0 1 2 3 4; do
  ANSWER="${ANSWERS[$i]}"
  QNUM=$((i + 1))

  echo "── Respuesta candidato (pregunta $QNUM) ──"
  echo "$ANSWER"
  echo

  NEXT_PAYLOAD=$(jq -n --argjson s "$SESSION_STATE" --arg a "$ANSWER" '{
    action: "next",
    sessionState: $s,
    userAnswer: $a,
    userAnswerSeconds: 90
  }')

  NEXT_RESPONSE=$(curl -sS -X POST "$ENDPOINT" -H "Content-Type: application/json" -d "$NEXT_PAYLOAD")
  OK=$(echo "$NEXT_RESPONSE" | jq -r '.ok')

  if [ "$OK" != "true" ]; then
    echo "✘ Error en next (pregunta $QNUM):"
    echo "$NEXT_RESPONSE" | jq .
    exit 1
  fi

  SESSION_STATE=$(echo "$NEXT_RESPONSE" | jq '.sessionState')
  FINISHED=$(echo "$NEXT_RESPONSE" | jq -r '.finished // false')

  if [ "$FINISHED" = "true" ]; then
    echo "═══════════════════════════════════════════════════════════════"
    echo "  REPORTE FINAL"
    echo "═══════════════════════════════════════════════════════════════"
    echo "$NEXT_RESPONSE" | jq -r '.finalReport.recomendacionFinal'
    echo
    echo "✓ Sesión completada"
    exit 0
  fi

  NEXT_Q=$(echo "$NEXT_RESPONSE" | jq -r '.nextQuestion.questionText')
  NEXT_QNUM=$((QNUM + 1))
  echo "── Pregunta $NEXT_QNUM ──"
  echo "$NEXT_Q"
  echo
done
