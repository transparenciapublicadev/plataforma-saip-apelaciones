#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="${SCRIPT_PATH:-database/postgres/script_saip_db_postgres.sql}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
RUN_TWICE="${RUN_TWICE:-false}"
ALLOW_REMOTE="${ALLOW_REMOTE:-false}"

if [[ -z "${PGDATABASE:-}" ]]; then
  echo "PGDATABASE is required. Use a local/staging database, never production." >&2
  exit 1
fi

if [[ -z "${PGUSER:-}" ]]; then
  echo "PGUSER is required." >&2
  exit 1
fi

if [[ "$PGHOST" != "localhost" && "$PGHOST" != "127.0.0.1" && "$PGHOST" != "::1" && "$ALLOW_REMOTE" != "true" ]]; then
  echo "Remote host '$PGHOST' requires ALLOW_REMOTE=true. Use only for approved staging." >&2
  exit 1
fi

if [[ "$PGDATABASE" =~ [Pp][Rr][Oo][Dd] ]]; then
  echo "Refusing to run against database '$PGDATABASE'. This script is only for local/staging rehearsal." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql was not found in PATH. Install PostgreSQL client tools." >&2
  exit 1
fi

run_schema() {
  local run_number="$1"
  echo "Running PostgreSQL schema script (run ${run_number}) against ${PGHOST}:${PGPORT}/${PGDATABASE} as ${PGUSER}"
  psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$SCRIPT_PATH"
}

run_schema 1

if [[ "$RUN_TWICE" == "true" ]]; then
  run_schema 2
fi

echo "PostgreSQL table count:"
psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  -c "select count(*) as table_count from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';"

echo "PostgreSQL seed smoke counts:"
psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  -c "select 'usuarios' tabla, count(*) total from usuarios union all select 'entidades', count(*) from entidades union all select 'salas_ttaip', count(*) from salas_ttaip union all select 'miembros_ttaip', count(*) from miembros_ttaip union all select 'expedientes_ttaip', count(*) from expedientes_ttaip union all select 'cedulas_notificacion', count(*) from cedulas_notificacion union all select 'dispositivos_notificacion_push', count(*) from dispositivos_notificacion_push;"
