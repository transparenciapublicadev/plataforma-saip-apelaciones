#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
BACKEND_PID=""
BACKEND_PROCESS_GROUP=false
TEMP_DIR="$(mktemp -d)"

: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

if [[ "$PGHOST" != "localhost" && "$PGHOST" != "127.0.0.1" && "$PGHOST" != "::1" ]]; then
  printf 'The Newman PostgreSQL runner only accepts a local database.\n' >&2
  exit 1
fi
if [[ "$PGDATABASE" =~ [Pp][Rr][Oo][Dd] ]]; then
  printf 'Refusing to run against a production-like database name.\n' >&2
  exit 1
fi
if command -v curl >/dev/null 2>&1 && curl --silent --fail --max-time 2 \
  http://localhost:8080/v3/api-docs >/dev/null 2>&1; then
  printf 'Port 8080 already serves a backend. Stop it before this rehearsal.\n' >&2
  exit 1
fi

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    if [[ "$BACKEND_PROCESS_GROUP" == "true" ]]; then
      kill -- "-$BACKEND_PID" 2>/dev/null || true
    fi
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT INT TERM

"$ROOT_DIR/scripts/postgres/verify-postgres-rehearsal.sh"

export DB_URL="jdbc:postgresql://${PGHOST}:${PGPORT}/${PGDATABASE}"
export DB_USERNAME="$PGUSER"
export DB_PASSWORD="$PGPASSWORD"
export APP_NOTIFICATIONS_MODE=MOCK
export APP_NOTIFICATIONS_PUSH_ENABLED=false

if command -v setsid >/dev/null 2>&1; then
  setsid bash -c 'cd "$1" && ./mvnw -B spring-boot:run -Dspring-boot.run.profiles=postgres' \
    bash "$ROOT_DIR/backend" >"$TEMP_DIR/backend.out.log" 2>"$TEMP_DIR/backend.err.log" &
  BACKEND_PROCESS_GROUP=true
else
  (
    cd "$ROOT_DIR/backend"
    ./mvnw -B spring-boot:run -Dspring-boot.run.profiles=postgres
  ) >"$TEMP_DIR/backend.out.log" 2>"$TEMP_DIR/backend.err.log" &
fi
BACKEND_PID=$!

ready=false
for _ in $(seq 1 90); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    break
  fi
  if curl --silent --fail --max-time 2 http://localhost:8080/v3/api-docs >/dev/null; then
    ready=true
    break
  fi
  sleep 1
done

if [[ "$ready" != "true" ]]; then
  printf 'Backend did not become ready with the PostgreSQL profile.\n' >&2
  tail -n 40 "$TEMP_DIR/backend.out.log" "$TEMP_DIR/backend.err.log" >&2 || true
  exit 1
fi

cd "$ROOT_DIR/postman"
if ! npm run test:api:diagnostic; then
  printf 'Backend log tail after Newman failure:\n' >&2
  tail -n 80 "$TEMP_DIR/backend.out.log" "$TEMP_DIR/backend.err.log" >&2 || true
  exit 1
fi
