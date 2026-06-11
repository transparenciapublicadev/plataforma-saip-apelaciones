#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
database="${PGDATABASE:-saip_db}"
database_host="${PGHOST:-127.0.0.1}"
port="${PGPORT:-5432}"
user="${PGUSER:-postgres}"

if [[ "${CONFIRM_RESET:-}" != "YES" ]]; then
  echo "Reset cancelado. Ejecute con CONFIRM_RESET=YES para recrear una base local." >&2
  exit 1
fi
case "$database_host" in
  127.0.0.1|localhost|::1) ;;
  *)
    echo "Reset bloqueado: PGHOST debe ser localhost, 127.0.0.1 o ::1." >&2
    exit 1
    ;;
esac
if [[ ! "$database" =~ ^[A-Za-z0-9_]+$ ]] || [[ "$database" =~ [Pp][Rr][Oo][Dd] ]]; then
  echo "Reset bloqueado: use un nombre valido de base local no productiva." >&2
  exit 1
fi

: "${PGPASSWORD:?PGPASSWORD debe definirse externamente}"
command -v psql >/dev/null 2>&1 || {
  echo "No se encontro el cliente psql en PATH." >&2
  exit 1
}

echo "Recreando schema PostgreSQL local en '$database' (${database_host}:${port})..."
psql -v ON_ERROR_STOP=1 -h "$database_host" -p "$port" -U "$user" -d "$database" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

export PGHOST="$database_host"
export PGPORT="$port"
export PGDATABASE="$database"
export PGUSER="$user"
RUN_TWICE=true "$ROOT_DIR/scripts/postgres/run-postgres-schema.sh"

echo "Base local recreada con el schema oficial PostgreSQL."
