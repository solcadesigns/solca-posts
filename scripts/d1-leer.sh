#!/usr/bin/env bash
# Consulta de solo lectura a D1 de producción (simulator-metrics).
# Acepta una sola sentencia SELECT, WITH ... SELECT o PRAGMA de lectura; rechaza todo lo demás.
# Uso: scripts/d1-leer.sh "SELECT COUNT(*) FROM vacantes"
# Existe para que Claude pueda consultar sin pedir permiso cada vez sin poder escribir en producción.
set -euo pipefail

sql="${1:-}"
if [[ -z "$sql" || $# -ne 1 ]]; then
  echo "uso: $0 \"SELECT ...\"" >&2
  exit 2
fi

# Normaliza: quita comentarios, espacios al inicio y un punto y coma final.
limpio="$(printf '%s' "$sql" | sed -e 's/--.*$//' | tr '\n' ' ' | sed -e 's#/\*.*\*/# #g' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*;[[:space:]]*$//')"
mayus="$(printf '%s' "$limpio" | tr '[:lower:]' '[:upper:]')"

if [[ "$limpio" == *";"* ]]; then
  echo "rechazado: solo una sentencia por llamada" >&2
  exit 3
fi
if ! [[ "$mayus" =~ ^(SELECT|WITH|PRAGMA)[[:space:]] ]]; then
  echo "rechazado: solo SELECT, WITH o PRAGMA" >&2
  exit 3
fi
if [[ "$mayus" =~ (^|[^A-Z_])(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|VACUUM|REINDEX|TRUNCATE)([^A-Z_]|$) ]]; then
  echo "rechazado: contiene ${BASH_REMATCH[2]}" >&2
  exit 3
fi
# PRAGMA también escribe en forma de función (PRAGMA user_version(5)), así que solo se aceptan los de inspección.
if [[ "$mayus" =~ ^PRAGMA ]] && ! [[ "$mayus" =~ ^PRAGMA[[:space:]]+(TABLE_INFO|TABLE_XINFO|TABLE_LIST|INDEX_LIST|INDEX_INFO|FOREIGN_KEY_LIST)[[:space:]]*\([[:space:]]*[\'\"]?[A-Z0-9_]+[\'\"]?[[:space:]]*\)[[:space:]]*$ ]]; then
  echo "rechazado: solo PRAGMA table_info/table_list/index_list/index_info/foreign_key_list(tabla)" >&2
  exit 3
fi

cd "$(dirname "$0")/.."
exec npx wrangler d1 execute simulator-metrics --remote --json --command "$limpio"
