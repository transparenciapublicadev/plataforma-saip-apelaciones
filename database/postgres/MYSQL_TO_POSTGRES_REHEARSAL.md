# MySQL to PostgreSQL Migration History

This file preserves the minimum useful history of the completed migration. It
is not an active operational guide.

## Scope

- The source database contained local/demo data only.
- No production records were migrated and no production cutover occurred.
- Eight incomplete legacy SAIP demo records were removed after guarded
  diagnosis because neither consent nor notification channel could be proven.
- PostgreSQL schema idempotency, Hibernate validation, repository behavior and
  Newman regression were validated before PostgreSQL became the default.

## Decisions Retained

- Do not invent consent or a formal notification channel for historical rows.
- Keep credentials and database exports outside Git.
- Use native PostgreSQL booleans, timestamps, identity columns and `ON CONFLICT`.
- Enforce case-insensitive uniqueness for email and entity acronyms with
  functional indexes.
- Manage the schema explicitly; the backend uses `ddl-auto=validate` and does
  not run `data.sql`.

## Current Operation

Use these supported scripts:

```powershell
.\scripts\postgres\run-postgres-schema.ps1 -RunTwice
.\scripts\postgres\validate-postgres-profile.ps1
.\scripts\postgres\run-newman-postgres.ps1
```

Despite the compatibility filename, `validate-postgres-profile` validates the
default PostgreSQL runtime and its dedicated integration-test profile. MySQL
preflight, deletion and ETL scripts were removed after the demo migration was
closed.

The official schema is
`database/postgres/script_saip_db_postgres.sql`. Document storage remains a
separate future phase.
