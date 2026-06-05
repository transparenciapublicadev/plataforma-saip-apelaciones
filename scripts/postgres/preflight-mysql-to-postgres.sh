#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
ALLOW_REMOTE="${ALLOW_REMOTE:-false}"
CONFIRM_REMOTE_PREFLIGHT="${CONFIRM_REMOTE_PREFLIGHT:-NO}"
ALLOW_PRODUCTION_READ_ONLY="${ALLOW_PRODUCTION_READ_ONLY:-false}"
CONFIRM_PRODUCTION_READ_ONLY="${CONFIRM_PRODUCTION_READ_ONLY:-NO}"
EXPECTED_TABLES_PATH="$ROOT_DIR/database/postgres/expected_rehearsal_tables.txt"
PREFLIGHT_SQL_PATH="$ROOT_DIR/database/postgres/preflight_mysql_to_postgres.sql"

: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"

[[ "$MYSQL_HOST" =~ ^[A-Za-z0-9_.:-]+$ ]] || {
  printf 'MYSQL_HOST contains unsupported characters.\n' >&2
  exit 1
}
[[ "$MYSQL_DATABASE" =~ ^[A-Za-z0-9_]+$ ]] || {
  printf 'MYSQL_DATABASE must contain only letters, numbers or underscores.\n' >&2
  exit 1
}

if [[ "$MYSQL_HOST" != "localhost" && "$MYSQL_HOST" != "127.0.0.1" && "$MYSQL_HOST" != "::1" ]]; then
  if [[ "$ALLOW_REMOTE" != "true" || "$CONFIRM_REMOTE_PREFLIGHT" != "YES" ]]; then
    printf 'Remote MySQL preflight requires ALLOW_REMOTE=true and CONFIRM_REMOTE_PREFLIGHT=YES.\n' >&2
    exit 1
  fi
fi

if [[ "$MYSQL_DATABASE" =~ [Pp][Rr][Oo][Dd] ]]; then
  if [[ "$ALLOW_PRODUCTION_READ_ONLY" != "true" || "$CONFIRM_PRODUCTION_READ_ONLY" != "YES" ]]; then
    printf 'A production-like database requires explicit read-only production confirmation.\n' >&2
    exit 1
  fi
fi

command -v mysql >/dev/null 2>&1 || {
  printf 'mysql client was not found in PATH.\n' >&2
  exit 1
}

mysql_args=(
  "--host=$MYSQL_HOST"
  "--port=$MYSQL_PORT"
  "--user=$MYSQL_USER"
  "--database=$MYSQL_DATABASE"
  "--batch"
  "--raw"
  "--skip-column-names"
  "--default-character-set=utf8mb4"
)

expected_union=""
while IFS= read -r table_name; do
  [[ -n "$table_name" ]] || continue
  if [[ -n "$expected_union" ]]; then
    expected_union+=" UNION ALL "
  fi
  expected_union+="SELECT '$table_name' AS table_name"
done < "$EXPECTED_TABLES_PATH"

missing_query="SELECT expected.table_name FROM ($expected_union) expected
LEFT JOIN information_schema.tables actual
  ON actual.table_schema = DATABASE()
 AND actual.table_name = expected.table_name
WHERE actual.table_name IS NULL
ORDER BY expected.table_name"

missing_tables="$(MYSQL_PWD="$MYSQL_PASSWORD" mysql "${mysql_args[@]}" --execute="$missing_query")"
if [[ -n "$missing_tables" ]]; then
  printf 'Missing expected MySQL tables:\n%s\n' "$missing_tables" >&2
  exit 1
fi

printf 'Running read-only MySQL to PostgreSQL preflight against %s:%s/%s\n' \
  "$MYSQL_HOST" "$MYSQL_PORT" "$MYSQL_DATABASE"

blocking_issues=0
while IFS=$'\t' read -r section check_name value; do
  [[ -n "$section" ]] || continue
  printf '%-18s %-58s %8s\n' "$section" "$check_name" "$value"
  if [[ "$section" != "TABLE_COUNT" ]]; then
    blocking_issues=$((blocking_issues + value))
  fi
done < <(MYSQL_PWD="$MYSQL_PASSWORD" mysql "${mysql_args[@]}" < "$PREFLIGHT_SQL_PATH")

if (( blocking_issues > 0 )); then
  printf 'MySQL preflight found %d blocking violation(s). No data was modified.\n' "$blocking_issues" >&2
  exit 2
fi

printf 'MySQL preflight passed with zero blocking violations. No data was modified.\n'
