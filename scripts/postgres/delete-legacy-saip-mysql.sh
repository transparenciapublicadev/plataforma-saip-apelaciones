#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
APPLY="${APPLY:-false}"
EXPECTED_ROWS="${EXPECTED_LEGACY_SAIP_ROWS:-8}"
CONFIRMATION="${LEGACY_SAIP_DELETE_CONFIRMATION:-}"
MIGRATION_ACTOR="${MIGRATION_ACTOR:-}"
ALLOW_STAGING="${ALLOW_STAGING:-false}"
CONFIRM_STAGING_READ_ONLY="${CONFIRM_STAGING_READ_ONLY:-NO}"
CONFIRM_STAGING_APPLY="${CONFIRM_STAGING_APPLY:-NO}"
DIAGNOSTIC_SQL_PATH="$ROOT_DIR/database/postgres/diagnose_delete_legacy_saip_mysql.sql"
DELETE_SQL_PATH="$ROOT_DIR/database/postgres/delete_legacy_saip_mysql.sql"

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
[[ "$EXPECTED_ROWS" == "8" ]] || {
  printf 'EXPECTED_LEGACY_SAIP_ROWS must be exactly 8.\n' >&2
  exit 1
}
if [[ "$MYSQL_DATABASE" =~ [Pp][Rr][Oo][Dd] ]]; then
  printf 'Production-like database names are always rejected by this deletion tool.\n' >&2
  exit 1
fi

is_local=false
if [[ "$MYSQL_HOST" == "localhost" || "$MYSQL_HOST" == "127.0.0.1" || "$MYSQL_HOST" == "::1" ]]; then
  is_local=true
fi
if [[ "$is_local" != "true" ]]; then
  [[ "$MYSQL_DATABASE" =~ ([Ss][Tt][Aa][Gg][Ee]?|[Rr][Ee][Hh][Ee][Aa][Rr][Ss][Aa][Ll]|[Tt][Ee][Ss][Tt]|[Qq][Aa]|[Dd][Ee][Vv]) ]] || {
    printf 'Remote deletion is allowed only for a staging, rehearsal, test, QA or dev database.\n' >&2
    exit 1
  }
  if [[ "$ALLOW_STAGING" != "true" || "$CONFIRM_STAGING_READ_ONLY" != "YES" ]]; then
    printf 'Remote diagnosis requires ALLOW_STAGING=true and CONFIRM_STAGING_READ_ONLY=YES.\n' >&2
    exit 1
  fi
  if [[ "$APPLY" == "true" && "$CONFIRM_STAGING_APPLY" != "YES" ]]; then
    printf 'Remote apply additionally requires CONFIRM_STAGING_APPLY=YES.\n' >&2
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

printf 'Legacy SAIP deletion diagnosis against %s:%s/%s\n' \
  "$MYSQL_HOST" "$MYSQL_PORT" "$MYSQL_DATABASE"

diagnostic_output="$(
  MYSQL_PWD="$MYSQL_PASSWORD" mysql "${mysql_args[@]}" < "$DIAGNOSTIC_SQL_PATH"
)"
printf '%s\n' "$diagnostic_output"

candidate_rows="$(
  awk -F $'\t' '$1 == "GUARD" && $2 == "candidate_rows" { print $3 }' \
    <<< "$diagnostic_output"
)"
ambiguity_rows="$(
  awk -F $'\t' '$1 == "GUARD" && $2 == "ambiguity_rows" { print $3 }' \
    <<< "$diagnostic_output"
)"

[[ -n "$candidate_rows" && -n "$ambiguity_rows" ]] || {
  printf 'The diagnostic did not return the required safety guards.\n' >&2
  exit 1
}
if [[ "$candidate_rows" != "$EXPECTED_ROWS" ]]; then
  printf 'Expected exactly %s candidates, but found %s. No data was modified.\n' \
    "$EXPECTED_ROWS" "$candidate_rows" >&2
  exit 1
fi
if [[ "$ambiguity_rows" != "0" ]]; then
  printf 'Found %s shared, ambiguous or unknown dependencies. No data was modified.\n' \
    "$ambiguity_rows" >&2
  exit 1
fi

if [[ "$APPLY" != "true" ]]; then
  printf 'DRY RUN: the exact candidate set is safe to review. No schema or data was modified.\n'
  exit 0
fi

[[ "$CONFIRMATION" == "DELETE_LEGACY_SAIP_2025_00001_00008" ]] || {
  printf 'Apply requires LEGACY_SAIP_DELETE_CONFIRMATION=DELETE_LEGACY_SAIP_2025_00001_00008.\n' >&2
  exit 1
}
[[ "$MIGRATION_ACTOR" =~ ^[A-Za-z0-9_.@-]{3,120}$ ]] || {
  printf 'MIGRATION_ACTOR is required and contains unsupported characters.\n' >&2
  exit 1
}

printf 'Applying transactional deletion for exactly %s demo SAIP rows.\n' \
  "$EXPECTED_ROWS"
{
  printf "SET @migration_actor = '%s';\n" "$MIGRATION_ACTOR"
  printf "SET @expected_rows = %s;\n" "$EXPECTED_ROWS"
  cat "$DELETE_SQL_PATH"
} | MYSQL_PWD="$MYSQL_PASSWORD" mysql "${mysql_args[@]}"

remaining_rows="$(
  MYSQL_PWD="$MYSQL_PASSWORD" mysql "${mysql_args[@]}" --execute="
    SELECT COUNT(*)
    FROM solicitudes
    WHERE expediente IN (
      'SAIP-2025-00001',
      'SAIP-2025-00002',
      'SAIP-2025-00003',
      'SAIP-2025-00004',
      'SAIP-2025-00005',
      'SAIP-2025-00006',
      'SAIP-2025-00007',
      'SAIP-2025-00008'
    );
  "
)"
if [[ "$remaining_rows" != "0" ]]; then
  printf 'Deletion committed but %s candidate rows remain. Stop before ETL.\n' \
    "$remaining_rows" >&2
  exit 1
fi

printf 'Deletion committed with migration audit. Run the full MySQL preflight before export.\n'
