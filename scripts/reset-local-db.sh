#!/usr/bin/env bash
set -euo pipefail

database="${DB_NAME:-saip_db}"
database_host="${DB_HOST:-127.0.0.1}"
port="${DB_PORT:-3306}"
user="${DB_USERNAME:-root}"

if [[ "${CONFIRM_RESET:-}" != "YES" ]]; then
  echo "Reset cancelado. Ejecute con CONFIRM_RESET=YES para recrear una base local." >&2
  exit 1
fi

case "$database_host" in
  127.0.0.1|localhost|::1) ;;
  *)
    echo "Reset bloqueado: DB_HOST debe ser localhost, 127.0.0.1 o ::1." >&2
    exit 1
    ;;
esac

if [[ ! "$database" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Reset bloqueado: DB_NAME contiene caracteres no permitidos." >&2
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "No se encontro el cliente mysql en PATH." >&2
  exit 1
fi

echo "Recreando base MySQL local '$database' en ${database_host}:${port}..."
mysql \
  --host="$database_host" \
  --port="$port" \
  --user="$user" \
  --password \
  --execute="DROP DATABASE IF EXISTS \`$database\`; CREATE DATABASE \`$database\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

cat <<'EOF'

Base local recreada. Siguiente paso:
1. Inicie una vez el backend local para que Hibernate cree el esquema.
2. Detenga el backend.
3. Cargue database/script_saip_db.sql.
4. Inicie backend con APP_NOTIFICATIONS_MODE=MOCK y ejecute Newman.
EOF
