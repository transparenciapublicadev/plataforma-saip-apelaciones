#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
ALLOW_REMOTE="${ALLOW_REMOTE:-false}"
CONFIRM_REMOTE_VERIFICATION="${CONFIRM_REMOTE_VERIFICATION:-NO}"
EXPECTED_TABLES_PATH="$ROOT_DIR/database/postgres/expected_rehearsal_tables.txt"
VERIFICATION_SQL_PATH="$ROOT_DIR/database/postgres/verify_postgres_rehearsal.sql"

: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

[[ "$PGDATABASE" =~ ^[A-Za-z0-9_]+$ ]] || {
  printf 'PGDATABASE must contain only letters, numbers or underscores.\n' >&2
  exit 1
}
if [[ "$PGHOST" != "localhost" && "$PGHOST" != "127.0.0.1" && "$PGHOST" != "::1" ]]; then
  if [[ "$ALLOW_REMOTE" != "true" || "$CONFIRM_REMOTE_VERIFICATION" != "YES" ]]; then
    printf 'Remote PostgreSQL verification requires explicit confirmation.\n' >&2
    exit 1
  fi
fi
if [[ "$PGDATABASE" =~ [Pp][Rr][Oo][Dd] ]]; then
  printf 'Refusing to verify a production-like database name.\n' >&2
  exit 1
fi

command -v psql >/dev/null 2>&1 || {
  printf 'psql was not found in PATH.\n' >&2
  exit 1
}

expected_values=""
while IFS= read -r table_name; do
  [[ -n "$table_name" ]] || continue
  if [[ -n "$expected_values" ]]; then
    expected_values+=","
  fi
  expected_values+="('$table_name')"
done < "$EXPECTED_TABLES_PATH"

missing_query="WITH expected(table_name) AS (VALUES $expected_values)
SELECT expected.table_name
FROM expected
LEFT JOIN information_schema.tables actual
  ON actual.table_schema = 'public'
 AND actual.table_name = expected.table_name
WHERE actual.table_name IS NULL
ORDER BY expected.table_name"

missing_tables="$(psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
  -d "$PGDATABASE" -At -c "$missing_query")"
if [[ -n "$missing_tables" ]]; then
  printf 'Missing expected PostgreSQL tables:\n%s\n' "$missing_tables" >&2
  exit 1
fi

printf 'Running read-only PostgreSQL rehearsal verification against %s:%s/%s\n' \
  "$PGHOST" "$PGPORT" "$PGDATABASE"

blocking_issues=0
while IFS=$'\t' read -r section check_name value; do
  [[ -n "$section" ]] || continue
  printf '%-18s %-58s %8s\n' "$section" "$check_name" "$value"
  if [[ "$section" != "TABLE_COUNT" ]]; then
    blocking_issues=$((blocking_issues + value))
  fi
done < <(psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
  -d "$PGDATABASE" -At -F $'\t' -f "$VERIFICATION_SQL_PATH")

if (( blocking_issues > 0 )); then
  printf 'PostgreSQL rehearsal verification found %d violation(s).\n' "$blocking_issues" >&2
  exit 2
fi

printf 'PostgreSQL rehearsal verification passed with zero referential violations.\n'
