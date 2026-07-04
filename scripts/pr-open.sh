#!/usr/bin/env bash
# ============================================================
# pr-open.sh - Create GitHub PR quickly using gh CLI
# ============================================================
# Usage:
#   ./scripts/pr-open.sh --title "🐛 fix(mobile): ..." --base develop
#   ./scripts/pr-open.sh --title "..." --base develop --body-file ./tmp/pr.md
# ============================================================

set -euo pipefail

TITLE=""
BASE="develop"
BODY_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title)
      TITLE="$2"
      shift 2
      ;;
    --base)
      BASE="$2"
      shift 2
      ;;
    --body-file)
      BODY_FILE="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 --title \"...\" [--base develop] [--body-file path]"
      exit 1
      ;;
  esac
done

if [[ -z "$TITLE" ]]; then
  echo "ERROR: --title es obligatorio"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI (gh) no esta instalado. https://cli.github.com/"
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "ERROR: No se pudo detectar la rama actual"
  exit 1
fi

if [[ "$CURRENT_BRANCH" == "$BASE" ]]; then
  echo "ERROR: Estas en la rama base ($BASE). Crea una rama feature primero."
  exit 1
fi

git push -u origin "$CURRENT_BRANCH"

if [[ -z "$BODY_FILE" ]]; then
  gh pr create --base "$BASE" --head "$CURRENT_BRANCH" --title "$TITLE" --fill
else
  gh pr create --base "$BASE" --head "$CURRENT_BRANCH" --title "$TITLE" --body-file "$BODY_FILE"
fi

echo "PR creado correctamente para $CURRENT_BRANCH -> $BASE"
