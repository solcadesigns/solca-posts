#!/usr/bin/env bash
# scripts/publish-weekly-blog.sh · 21 jul 2026
#
# Publica un blog semanal en solcaciencia.com.
# Se usa como fallback SOLO si Cloudflare Workers Builds (Git integration) no
# está activo. Si Git integration está activo, un simple `git push origin main`
# dispara auto-deploy y este script no es necesario.
#
# Uso:
#   ./scripts/publish-weekly-blog.sh <slug>
#
# Ejemplo:
#   ./scripts/publish-weekly-blog.sh entrevista-pharma-ingles-b2-c1-como-prepararla
#
# Requiere que:
#   - El archivo src/content/blog/<slug>.md exista
#   - El cover public/blog/<slug>.png exista
#   - Estés en la rama main con el árbol de git limpio (todo lo demás committed)
#   - wrangler esté logueado (npx wrangler login)

set -euo pipefail

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
  echo "Error: falta el slug del blog." >&2
  echo "Uso: $0 <slug>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BLOG_FILE="src/content/blog/${SLUG}.md"
COVER_FILE="public/blog/${SLUG}.png"

# Verificaciones
if [[ ! -f "$BLOG_FILE" ]]; then
  echo "Error: no existe $BLOG_FILE" >&2
  exit 2
fi
if [[ ! -f "$COVER_FILE" ]]; then
  echo "Error: no existe $COVER_FILE" >&2
  exit 3
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: debes estar en main, estás en $CURRENT_BRANCH" >&2
  exit 4
fi

# Extraer título del frontmatter para el commit message
TITLE="$(awk -F': ' '/^title:/ {gsub(/^"|"$/, "", $2); print $2; exit}' "$BLOG_FILE")"
if [[ -z "$TITLE" ]]; then
  TITLE="$SLUG"
fi

echo "[publish-weekly-blog] Blog: $TITLE"
echo "[publish-weekly-blog] Slug: $SLUG"

# Add + commit + push
git add "$BLOG_FILE" "$COVER_FILE"
if git diff --cached --quiet; then
  echo "[publish-weekly-blog] Nada que commitear (blog y cover ya committed?). Continuando al deploy."
else
  git commit -m "blog: $TITLE"
fi
git push origin main

# Si Cloudflare Workers Builds está activo, el push ya lo deploya.
# Si no, hacer deploy manual:
if [[ "${SOLCA_GIT_AUTODEPLOY:-0}" == "1" ]]; then
  echo "[publish-weekly-blog] Cloudflare Workers Builds detectado (SOLCA_GIT_AUTODEPLOY=1)."
  echo "[publish-weekly-blog] El push a main dispara el deploy automático. Espera 2-3 min."
else
  echo "[publish-weekly-blog] Corriendo deploy manual con wrangler..."
  npm run deploy
fi

echo "[publish-weekly-blog] Listo. Blog disponible en:"
echo "  https://solcaciencia.com/blog/${SLUG}"
echo ""
echo "El broadcast Vie 8am se dispara automáticamente cuando el cron detecte"
echo "que este blog fue publicado en los últimos 7 días."
