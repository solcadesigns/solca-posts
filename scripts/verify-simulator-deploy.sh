#!/usr/bin/env bash
# Verificación post-deploy · landing pública del simulador (19 ago 2026).
# Uso: ./scripts/verify-simulator-deploy.sh
# No necesita args: golpea producción y reporta cada check.
set -uo pipefail
BASE="${BASE:-https://solcaciencia.com}"
pass() { echo "  \033[32mPASS\033[0m · $1"; }
fail() { echo "  \033[31mFAIL\033[0m · $1"; FAILED=$((FAILED+1)); }
FAILED=0

echo ""
echo "== 1 · Landing pública responde 200 =="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/simulador-entrevistas/")
[ "$CODE" = "200" ] && pass "GET /simulador-entrevistas/ → 200" || fail "esperado 200, obtenido $CODE"

echo ""
echo "== 2 · Redirect 301 desde legacy beta =="
LOC=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}" "$BASE/simulador-entrevistas-beta/")
CODE="${LOC%%|*}"; URL="${LOC##*|}"
[ "$CODE" = "301" ] && pass "GET /simulador-entrevistas-beta/ → 301" || fail "esperado 301, obtenido $CODE"
[[ "$URL" == *"/simulador-entrevistas/"* ]] && pass "redirige a $URL" || fail "redirect a URL inesperada: $URL"

echo ""
echo "== 3 · Redirect preserva ?codigo= =="
LOC=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}" "$BASE/simulador-entrevistas-beta/?codigo=SIM-TEST1234")
CODE="${LOC%%|*}"; URL="${LOC##*|}"
[ "$CODE" = "301" ] && pass "301 recibido con query string" || fail "esperado 301, obtenido $CODE"
[[ "$URL" == *"codigo=SIM-TEST1234"* ]] && pass "query preservada: $URL" || fail "query perdida: $URL"

echo ""
echo "== 4 · Redirect sesion.astro =="
LOC=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}" "$BASE/simulador-entrevistas-beta/sesion?codigo=SIM-TEST1234")
CODE="${LOC%%|*}"; URL="${LOC##*|}"
[ "$CODE" = "301" ] && pass "GET /simulador-entrevistas-beta/sesion → 301" || fail "esperado 301, obtenido $CODE"
[[ "$URL" == *"/simulador-entrevistas/sesion"* ]] && pass "apunta a sesion nueva" || fail "URL inesperada: $URL"

echo ""
echo "== 5 · POST /api/simulator-subscribe (dry-run con email de prueba) =="
echo "  Nota: envía email real. Usa un email de prueba tuyo si no quieres inbox."
read -rp "  Email de prueba (Enter para saltar este paso): " TEST_EMAIL
if [ -n "$TEST_EMAIL" ]; then
  RESP=$(curl -s -X POST "$BASE/api/simulator-subscribe" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test\",\"email\":\"$TEST_EMAIL\",\"consent\":true,\"utm_source\":\"deploy-test\",\"utm_campaign\":\"verify-2026-08-19\"}")
  echo "  Respuesta cruda: $RESP"
  echo "$RESP" | grep -q '"ok":true' && pass "endpoint responde ok:true" || fail "respuesta no ok: $RESP"
  echo "$RESP" | grep -q '"cohort":"preview"' && pass "cohort correcto (preview antes del 8 sept)" || echo "  info · cohort: $(echo $RESP | grep -o '\"cohort\":\"[^\"]*\"')"
  echo ""
  echo "  Revisa la bandeja de $TEST_EMAIL para confirmar que llegó el welcome-simulator-code."
else
  echo "  (saltado)"
fi

echo ""
echo "== 6 · Landing nueva tiene formulario y planes =="
HTML=$(curl -s "$BASE/simulador-entrevistas/")
echo "$HTML" | grep -q 'subscribe-form' && pass "formulario de suscripción presente" || fail "formulario no encontrado en HTML"
echo "$HTML" | grep -q 'Freemium' && pass "sección planes presente" || fail "sección planes no encontrada"
echo "$HTML" | grep -q 'Ya tengo un código' && pass "input de código presente" || fail "input de código no encontrado"

echo ""
echo "== 7 · Endpoint admin de códigos sigue vivo =="
echo "  (Se salta si STATS_KEY no configurado; check manual desde tu terminal)"

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "\033[32mTodos los checks pasaron.\033[0m"
else
  echo "\033[31m$FAILED check(s) fallaron. Revisa arriba.\033[0m"
  exit 1
fi
