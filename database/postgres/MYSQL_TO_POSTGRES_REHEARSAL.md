# MySQL to PostgreSQL Rehearsal

This guide defines a controlled rehearsal. It is not a production cutover and
does not change the default MySQL runtime.

## Safety Boundary

- Use a local database or an approved isolated staging environment.
- Never commit dumps, exported rows, credentials or Newman reports.
- Freeze writes before the final export used in a rehearsal.
- Keep the source MySQL database unchanged and available for rollback.
- Do not use the PostgreSQL target for production traffic.

## 1. Source Preflight

Provide credentials only through environment variables:

```powershell
$env:MYSQL_HOST = "localhost"
$env:MYSQL_PORT = "3306"
$env:MYSQL_DATABASE = "saip_db"
$env:MYSQL_USER = "<local-user>"
$env:MYSQL_PASSWORD = "<local-password>"
.\scripts\postgres\preflight-mysql-to-postgres.ps1
```

The preflight is read-only and checks expected tables, counts, case-insensitive
duplicates, critical foreign-key orphans, required values, target lengths and
stable PostgreSQL checks. Remote analysis requires two explicit confirmation
flags. Production-like database names require a separate double confirmation.

The PR 5 local preflight found no case-insensitive duplicates or referential
orphans, but it found eight demo/legacy SAIP rows where both personal-data
consent and notification channel were null. The dependency audit confirmed
that they formed a self-contained demo graph. They were deleted locally with
the protected, transactional policy `DELETE_LEGACY_INCOMPLETE_SAIP`; no
consent or notification channel was invented.

Run the deletion diagnosis in dry-run mode with:

```powershell
.\scripts\postgres\delete-legacy-saip-mysql.ps1
```

Dry-run is the default. It lists technical identifiers, SAIP number, status,
dates, entity/citizen IDs and dependency counts. It does not return personal
names, DNI, full email, phone, address, document content, tokens or payloads.

The local diagnosis confirmed `SAIP-2025-00001` through
`SAIP-2025-00008`. None has a successful SAIP notification attempt that proves
a channel. A registered user email is not evidence of citizen consent or
channel choice.

### Protected deletion

Apply requires the exact row count, confirmation phrase and identified actor:

```powershell
$env:EXPECTED_LEGACY_SAIP_ROWS = "8"
$env:LEGACY_SAIP_DELETE_CONFIRMATION = "DELETE_LEGACY_SAIP_2025_00001_00008"
$env:MIGRATION_ACTOR = "<identified-operator>"
.\scripts\postgres\delete-legacy-saip-mysql.ps1 -Apply
```

The script rejects production-like database names, requires explicit staging
confirmation for remote execution, aborts on shared or ambiguous dependencies
and deletes child rows before the eight requests in one transaction. It records
the actor, policy, reason, expected/deleted counts and SAIP numbers in
`auditoria_migracion_saip` and its detail table, without personal data.

After the local apply, the full preflight reported zero null consent values,
zero null notification channels and zero blocking findings. The automatic
Spring seed was also adjusted so application startup cannot recreate this
incomplete demo graph.

## 2. Export and Transform

The repository intentionally does not automate this step yet. Select and
approve a migration tool before handling real data. A rehearsal must:

1. Create an encrypted, access-controlled MySQL backup outside the repository.
2. Export data only after the preflight returns zero blocking findings.
3. Normalize `usuarios.email` to lowercase and `entidades.acronimo` to uppercase.
4. Convert MySQL booleans to PostgreSQL `BOOLEAN`.
5. Convert operational `DATETIME` values to `TIMESTAMPTZ` using the documented
   source timezone.
6. Preserve primary keys and then reset PostgreSQL identity sequences.
7. Load tables in dependency order, without disabling validation permanently.
8. Record source and target counts in the release evidence, not in Git.

PR 6 recommends a reviewed custom ETL job over direct `pgloader` schema
conversion. The target schema already exists and the load needs explicit table
order, strict transformations, preserved IDs, sequence resets and
reconciliation. The concrete plan is documented in
`database/postgres/MYSQL_TO_POSTGRES_ETL_PLAN.md`.

## 3. Prepare and Verify PostgreSQL

Create the target schema in an empty rehearsal database:

```powershell
$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGDATABASE = "saip_db_postgres_rehearsal"
$env:PGUSER = "<local-user>"
$env:PGPASSWORD = "<local-password>"
.\scripts\postgres\run-postgres-schema.ps1 -RunTwice
```

After loading rehearsal data, run:

```powershell
.\scripts\postgres\verify-postgres-rehearsal.ps1
```

Compare every `TABLE_COUNT` row with the source preflight output. All
case-insensitive, orphan and cross-aggregate consistency checks must be zero.

## 4. Backend and Newman Regression

For the seed-compatible local rehearsal:

```powershell
.\scripts\postgres\run-newman-postgres.ps1
```

The runner verifies PostgreSQL, starts the backend with profile `postgres`,
forces `APP_NOTIFICATIONS_MODE=MOCK`, waits for `/v3/api-docs`, executes Newman
diagnostic and stops the backend. Newman artifacts remain under the ignored
`postman/reports/` directory.

The seed-based PR 5 rehearsal completed with 252 requests, 428 assertions and
zero failures. This proves runtime compatibility, but it does not replace a
second regression after transformed MySQL data is loaded into staging.

For staging, deploy the backend separately with profile `postgres` and run the
existing Newman command against an approved environment file outside Git.

## Rollback and Cutover Draft

1. Announce a maintenance window and freeze writes.
2. Capture and verify the final MySQL backup.
3. Run preflight against the frozen source.
4. Load a fresh PostgreSQL target and compare all counts and relations.
5. Run Hibernate validation, backend tests, smoke tests and Newman.
6. Keep MySQL read-only and retain the previous application configuration.
7. Cut over only after explicit approval and documented acceptance.
8. If validation fails, stop the PostgreSQL backend, restore the previous
   MySQL configuration and reopen writes only after consistency checks.

No cutover is authorized by this rehearsal document.
