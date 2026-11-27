#!/bin/bash
set -Eeuo pipefail
# Empty own volume only. No shared account/password literal and no SQL echo.
: "${DB_APP_USER:?Set the non-superuser application role}"
psql -X --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_user="$DB_APP_USER" --set=database="$POSTGRES_DB" <<'SQL'
BEGIN;
SELECT set_config('yaiku.bootstrap_app_role', :'app_user', false);
DO $bootstrap$
BEGIN
  EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
                 current_setting('yaiku.bootstrap_app_role'),
                 rtrim(pg_read_file('/run/secrets/DB_PASSWORD'), E'\r\n'));
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Application DB role initialization failed; secret values suppressed';
END;
$bootstrap$;
SELECT format('ALTER DATABASE %I OWNER TO %I', :'database', :'app_user') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'database') \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
COMMIT;
SQL
