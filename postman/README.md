# SAIP API Validation With Newman

This directory contains the executable Postman/Newman validation setup for the SAIP backend API.

## Setup

```powershell
cd postman
npm install
```

## Commands

```powershell
npm run test:api
npm run test:api:diagnostic
npm run test:api:auth
npm run test:api:bail
```

From the repository root you can also run:

```powershell
npm --prefix postman run test:api
```

## Reports

Every run writes artifacts to `postman/reports/`:

- `*.newman.html`: human-friendly execution report.
- `*.newman.json`: full Newman machine-readable summary.
- `*.newman.xml`: JUnit report for CI.
- `*.diagnostic.md`: classified diagnosis by likely source.
- `*.diagnostic.json`: machine-readable diagnosis.

## Diagnostic Categories

- `environment mal configurado`: missing variables, unresolved placeholders or wrong base values.
- `credenciales incorrectas`: login credentials or role/token mismatch.
- `token faltante`: protected requests ran before a valid login token was captured.
- `IDs inexistentes`: environment IDs or expediente values do not exist in the loaded database.
- `seed SQL desalineado`: collection assumes data not produced by `database/script_saip_db.sql`.
- `payload inválido`: request body/query does not match backend validation.
- `regla de negocio`: valid request rejected by domain state, dates, ownership or transition rules.
- `backend no disponible`: Newman could not connect to `baseUrl` or the API process is not running.
- `bug backend`: 5xx errors or backend route/error-contract defects.

Backend errors must return RFC 9457 Problem Details fields: `type`, `title`, `status`, `detail` and `instance`.

## Notification Engine Coverage

The full diagnostic run validates the shared SAIP/TTAIP notification engine in local `MOCK` mode:

- Safe engine status without credentials or secrets.
- SAIP delivery using the formal notification channel selected at runtime.
- TTAIP delivery and persisted attempt history using notification IDs captured during the run.
- Controlled TTAIP `MOCK` failure with sanitized diagnostics preserved for reproceso.
- FCM adapter safe status plus authenticated registration, idempotent refresh, ownership rejection and revocation using only a fictitious token.

`MOCK` is intended for local/Newman validation. `SMTP` is configured through backend environment variables for real email delivery. `CASILLA_ELECTRONICA` remains an explicit `NO_DISPONIBLE` adapter until an official API contract exists; automatic channel fallback is not implemented.

FCM device registration is validated without Firebase credentials. Newman uses a fictitious token and a deterministic test device hash; the adapter remains disabled locally and never simulates Firebase delivery.

Start the local backend explicitly in controlled mode before running Newman:

```powershell
$env:APP_NOTIFICATIONS_MODE='MOCK'
cd backend
.\mvnw.cmd spring-boot:run
```

The collection asserts that the safe engine status reports `modo = MOCK`. Versioned token variables remain placeholders populated by login requests at runtime.

Global SAIP and TTAIP list validations use lightweight paginated endpoints. This
keeps diagnostic runs stable without hiding accumulated local fixtures.

## Reproducible Local Database

Newman creates runtime SAIP and TTAIP records. For a clean local baseline, reset
the database explicitly and reload the official seed. The reset scripts refuse
remote hosts and require an explicit confirmation flag.

PowerShell:

```powershell
.\scripts\reset-local-db.ps1 -ConfirmReset
cd backend
.\mvnw.cmd spring-boot:run
# Stop the backend after Hibernate creates the schema.
Get-Content ..\database\script_saip_db.sql -Raw | mysql -u root -p saip_db
```

Bash:

```bash
CONFIRM_RESET=YES ./scripts/reset-local-db.sh
cd backend
./mvnw spring-boot:run
# Stop the backend after Hibernate creates the schema.
mysql -u root -p saip_db < ../database/script_saip_db.sql
```

Restart the backend with `APP_NOTIFICATIONS_MODE=MOCK` and execute
`npm run test:api:diagnostic`. The versioned environment intentionally stores
empty JWT values; login requests populate tokens only in memory during a run.

`newman.config.json` keeps a 90-second request timeout for local variance. This
margin is not a substitute for load testing.
