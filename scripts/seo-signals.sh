#!/usr/bin/env bash
# scripts/seo-signals.sh · refresca las señales editoriales de GSC
# ===============================================================
#
# Por qué existe (21 sep 2026): la tarea agendada de los lunes elige el tema
# del blog leyendo _docs/BLOG_BACKLOG.md, que se arma con exports manuales de
# CSV de Search Console. El último era del 14 sep. Este script trae la data
# viva desde /api/seo-signals y la deja en un archivo del repo que la tarea del
# lunes sí puede leer.
#
# Por qué un script local y no un fetch desde la tarea: el endpoint se
# autentica con STATS_KEY. Ese secret vive en tu máquina y no tiene por qué
# viajar al prompt de una tarea agendada ni a una sesión de chat. El script lo
# lee de tu entorno, hace el request desde tu terminal, y solo escribe el JSON
# de resultados — que no contiene credenciales.
#
# Uso:
#   export STATS_KEY=...            # o déjalo en .dev.vars
#   ./scripts/seo-signals.sh
#   ./scripts/seo-signals.sh 28     # ventana de 28 días en vez de 90
#
# Salida: _docs/GSC_SIGNALS_LATEST.json
#
# Para automatizarlo del todo, agrégalo a launchd o a un cron local los lunes
# temprano, antes de que corra la tarea del blog:
#   0 7 * * 1 cd /Users/oscar/Downloads/solca/website && ./scripts/seo-signals.sh

set -euo pipefail

cd "$(dirname "$0")/.."

DIAS="${1:-90}"
SITE="${SOLCA_SITE:-https://solcaciencia.com}"
OUT="_docs/GSC_SIGNALS_LATEST.json"

# STATS_KEY del entorno, o de .dev.vars si está ahí.
if [[ -z "${STATS_KEY:-}" && -f .dev.vars ]]; then
  STATS_KEY="$(grep -E '^STATS_KEY=' .dev.vars | head -1 | cut -d= -f2- | tr -d '"'"'"' ')"
fi

if [[ -z "${STATS_KEY:-}" ]]; then
  echo "Falta STATS_KEY. Expórtala o ponla en .dev.vars:" >&2
  echo "  export STATS_KEY=..." >&2
  exit 1
fi

echo "Consultando $SITE/api/seo-signals (ventana: ${DIAS}d)…"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

CODE="$(curl -sS -o "$TMP" -w '%{http_code}' \
  --get "$SITE/api/seo-signals" \
  --data-urlencode "key=$STATS_KEY" \
  --data-urlencode "dias=$DIAS")"

if [[ "$CODE" != "200" ]]; then
  echo "Error HTTP $CODE. Respuesta:" >&2
  head -c 500 "$TMP" >&2
  echo >&2
  [[ "$CODE" == "401" ]] && echo "→ STATS_KEY no coincide con la del Worker." >&2
  [[ "$CODE" == "503" ]] && echo "→ Faltan los secrets GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY en el Worker." >&2
  exit 1
fi

# Verificación mínima: que sea JSON y traiga las llaves esperadas.
if ! python3 -c "
import json,sys
d=json.load(open('$TMP'))
for k in ('ventana','totales','oportunidades_query','fixes_pagina','ganadoras','paises'):
    if k not in d: sys.exit(f'falta la llave {k}')
print('  ventana:', d['ventana']['start'], '→', d['ventana']['end'])
print('  totales:', d['totales']['clicks'], 'clicks /', d['totales']['impresiones'], 'impresiones')
print('  oportunidades:', len(d['oportunidades_query']), '· fixes:', len(d['fixes_pagina']))
if d['conteos']['queries_analizadas'] >= 1000:
    print('  OJO: rowLimit topado, hay cola sin ver.')
"; then
  echo "La respuesta no tiene la forma esperada. No se escribió $OUT." >&2
  exit 1
fi

mv "$TMP" "$OUT"
trap - EXIT
echo "Escrito: $OUT"
