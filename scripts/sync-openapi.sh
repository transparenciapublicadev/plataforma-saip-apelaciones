#!/usr/bin/env bash
# ============================================================
# sync-openapi.sh — Sincroniza el OpenAPI spec desde el backend
# ============================================================
# Uso:
#   ./scripts/sync-openapi.sh              # Desde servidor local (localhost:8080)
#   ./scripts/sync-openapi.sh --ci         # Desde artifact del CI
#   ./scripts/sync-openapi.sh --url URL    # Desde URL custom
#
# El spec se copia a:
#   frontend/openapi.json
#   mobile/openapi.json (referencia, no se usa en build)
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_URL="http://localhost:8080/v3/api-docs"

# Parsear argumentos
while [[ $# -gt 0 ]]; do
  case $1 in
    --url) BACKEND_URL="$2"; shift 2 ;;
    --ci) echo "CI mode — use 'actions/download-artifact' en el workflow"; exit 0 ;;
    *) echo "Uso: $0 [--url URL] [--ci]"; exit 1 ;;
  esac
done

echo "Descargando OpenAPI spec desde: $BACKEND_URL"

# Descargar spec
SPEC=$(curl -sf "$BACKEND_URL") || {
  echo "ERROR: No se pudo conectar al backend en $BACKEND_URL"
  echo "Asegurate de que el backend esta corriendo: cd backend && ./mvnw spring-boot:run"
  exit 1
}

# Validar que es JSON valido
echo "$SPEC" | python3 -m json.tool > /dev/null 2>&1 || {
  echo "ERROR: La respuesta no es JSON valido"
  exit 1
}

# Guardar en frontend
FRONTEND_SPEC="$ROOT_DIR/frontend/openapi.json"
echo "$SPEC" | python3 -m json.tool > "$FRONTEND_SPEC"
echo "Frontend: $FRONTEND_SPEC actualizado"

# Guardar copia de referencia en mobile
MOBILE_SPEC="$ROOT_DIR/mobile/openapi.json"
echo "$SPEC" | python3 -m json.tool > "$MOBILE_SPEC"
echo "Mobile:   $MOBILE_SPEC actualizado (referencia)"

# Regenerar tipos TypeScript si el frontend tiene el script
if [ -f "$ROOT_DIR/frontend/package.json" ]; then
  echo ""
  echo "Regenerando tipos TypeScript..."
  cd "$ROOT_DIR/frontend"
  npm run generate:api 2>/dev/null && echo "Tipos TypeScript regenerados" || echo "WARN: No se pudieron regenerar los tipos (npm run generate:api)"
fi

echo ""
echo "Sincronizacion completa."
