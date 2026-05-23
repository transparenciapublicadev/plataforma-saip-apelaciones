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
