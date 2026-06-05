#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"

if [[ "$PGHOST" != "localhost" && "$PGHOST" != "127.0.0.1" && "$PGHOST" != "::1" ]]; then
  echo "PostgreSQL profile validation only accepts a local or CI-mapped host." >&2
  exit 1
fi

if [[ -z "${PGDATABASE:-}" || "$PGDATABASE" =~ [Pp][Rr][Oo][Dd] ]]; then
  echo "PGDATABASE is required and must identify a non-production database." >&2
  exit 1
fi

if [[ -z "${PGUSER:-}" || -z "${PGPASSWORD:-}" ]]; then
  echo "PGUSER and PGPASSWORD are required through environment variables." >&2
  exit 1
fi

cd "$ROOT_DIR"

RUN_TWICE=true ./scripts/postgres/run-postgres-schema.sh

export DB_URL="jdbc:postgresql://${PGHOST}:${PGPORT}/${PGDATABASE}"
export DB_USERNAME="$PGUSER"
export DB_PASSWORD="$PGPASSWORD"
export RUN_POSTGRES_INTEGRATION_TESTS=true

cd backend
./mvnw -B test -Dspring.profiles.active=postgres
