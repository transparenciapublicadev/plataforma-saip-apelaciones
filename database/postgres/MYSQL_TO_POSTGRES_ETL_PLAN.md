# MySQL to PostgreSQL ETL Plan

This document prepares a staging rehearsal. It does not authorize a production
cutover and it never places source data, dumps or credentials in Git.

## Recommendation

Use a small reviewed ETL job for the first controlled load instead of direct
`pgloader` schema conversion.

The PostgreSQL schema already exists and is validated by Hibernate. The load
needs application-specific ordering, boolean and timestamp conversion,
case normalization, preservation of primary keys and explicit reconciliation.
`pgloader` remains useful for an exploratory copy, but its automatic schema
inference and casts are less suitable as the auditable final path.

Recommended implementation for PR 7:

- A versioned ETL program containing mappings only.
- JDBC connections or database-native clients configured exclusively through
  environment variables.
- Streaming or keyset batches rather than loading complete tables in memory.
- Checkpoints and counts, but no row payloads in logs.
- An external encrypted working directory outside the repository.
- A staging-only allowlist and explicit confirmation before writes.

## Gate Before Export

1. Freeze source writes for the approved rehearsal snapshot.
2. Run `preflight-mysql-to-postgres`.
3. Run `delete-legacy-saip-mysql` in dry-run mode and require the candidate and
   dependency graph to match the approved legacy/demo set.
4. Stop if any shared or ambiguous dependency is reported.
5. Apply deletion only with the exact confirmation, expected count and named
   migration operator. Never infer consent or notification channel.
6. Re-run the full preflight and require zero blockers.
7. Create and verify an encrypted MySQL backup outside Git.

The local rehearsal completed steps 2 through 6 for
`SAIP-2025-00001` through `SAIP-2025-00008`. A future staging snapshot must run
the same gates again; repository documentation is not evidence for another
database instance.

## Load Order

1. `usuarios`
2. `entidades`
3. `ciudadanos`, `funcionarios`, `administradores`, `miembros_ttaip`
4. `solicitudes`
5. `respuestas`, `documentos`, SAIP operational tables
6. `apelaciones`, `elevaciones_apelacion_ttaip`
7. `salas_ttaip`, `expedientes_ttaip`, `expediente_ttaip_miembros`
8. `resoluciones`, `cedulas_notificacion`, `notificaciones_ttaip`
9. `descargos_entidad_ttaip`, `suspensiones_plazo_ttaip`,
   `cumplimientos_resolucion_ttaip`, `historial_ttaip`
10. `reprocesos_notificacion`, `intentos_notificacion`,
    `dispositivos_notificacion_push`

## Transformations

- Preserve every primary key and foreign key.
- Convert MySQL `0/1` flags to PostgreSQL `BOOLEAN`.
- Interpret MySQL `DATETIME` using the approved source timezone
  `America/Lima`, then write PostgreSQL `TIMESTAMPTZ`.
- Keep legal deadline fields as `DATE`.
- Normalize `usuarios.email` with `lower(trim(email))`.
- Normalize `entidades.acronimo` with `upper(trim(acronimo))`.
- Reject, rather than truncate, values exceeding target lengths.
- Keep enum-like values unchanged and validate them against target checks.
- Do not manufacture consent, notification channel or document metadata.

## Identity Sequences

After loading explicit IDs, reset each identity sequence to the current maximum
without changing table data:

```sql
SELECT setval(
  pg_get_serial_sequence('usuarios', 'id_usuario'),
  COALESCE((SELECT MAX(id_usuario) FROM usuarios), 1),
  (SELECT COUNT(*) > 0 FROM usuarios)
);
```

The ETL must generate the equivalent statement from an allowlist for every
identity-backed table. Never derive table or column names from untrusted input.

## Reconciliation

- Compare source and target counts for all expected tables.
- Require zero case-insensitive duplicates.
- Run `verify-postgres-rehearsal` and require zero orphan or consistency issues.
- Compare minimum and maximum IDs per table.
- Compare deterministic aggregates, not personal row payloads.
- Start the backend with profile `postgres`.
- Run backend PostgreSQL tests and Newman diagnostic.
- Store signed execution evidence outside Git.

## Rollback

The rehearsal target is disposable. If any check fails:

1. Stop the PostgreSQL backend.
2. Do not publish the target database.
3. Preserve sanitized logs and counts outside Git.
4. Recreate the target from an empty database.
5. Keep MySQL unchanged as the runtime source.

Production rollback and cutover remain subject to a separate approved plan.
