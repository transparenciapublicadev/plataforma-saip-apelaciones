# Verificación de las entregas SAIP/TTAIP

Los informes de cada entrega conservan resultados fechados y sus límites; no son
resultados de futuras ejecuciones. El entorno comprobado el 2026-10-23 usa Java 25,
Spring Boot 4.0.6 y PostgreSQL 18.4. Angular declara pnpm 12.3.4; el entorno disponible
tenía pnpm 11.25, Angular 22.1.5, TypeScript 6.0.3 y Vitest 4.1.11.

## Comprobaciones habituales

Desde `backend/`: `./mvnw.cmd test` y `./mvnw.cmd compile`. `-o` solo si la caché
Maven ya contiene las dependencias. En POSIX, usar `./mvnw`.

Desde la raíz, con las dependencias existentes:

```powershell
pnpm --dir frontend test --watch=false
pnpm --dir frontend exec tsc --noEmit -p tsconfig.app.json
pnpm --dir frontend exec tsc --noEmit -p tsconfig.spec.json
pnpm --dir frontend run build
```

La alternativa comprobada para el gestor disponible fue `pnpm.cmd
--config.manage-package-manager-versions=false --config.auto-install=false`, antes
de `--dir`. Esto no prueba intercambiabilidad para instalar. No cambiar manifiestos,
lockfiles, presupuestos o versiones para obtener un resultado favorable.

## Integraciones PostgreSQL optativas

Estas suites **truncan datos**. Crear un cluster/base nuevos y propios en loopback,
con datos sintéticos. Nunca apuntar a una base existente, aunque esté en localhost.
Usar un directorio temporal nuevo para cluster, evidencia y LOCAL; conservar sus
rutas para detener únicamente esa instancia. No reutilizar artefactos desaparecidos.

El fixture exige URL `jdbc:postgresql://127.0.0.1:<puerto>/yaiku_e11_closeout_<32 hex>`,
usuario de pruebas `yaiku_e11_test` y password vacío. Al provisionar con `initdb`,
restringir el servidor a loopback; no usar trust fuera de esta instancia desechable.
Crear solo la base vacía: Spring aplica originales V1–V10 con Flyway (migraciones
y seed) y `spring.jpa.hibernate.ddl-auto=validate`. No ejecutar SQL manual en lugar
de Flyway, editar migraciones aplicadas ni utilizar `update`. Consultar
`flyway_schema_history` para versiones, scripts, checksums y éxito.

| Suite | Opt-in con valor `true` | URL / directorio de evidencia |
| --- | --- | --- |
| PrecisionSaipPostgresIntegrationTest | RUN_E11_POSTGRES_TESTS | E11_POSTGRES_URL / E11_POSTGRES_ARTIFACTS |
| ConfiguracionSistemaPostgresIntegrationTest | RUN_CONFIG_POSTGRES_TESTS | E11_POSTGRES_URL / E11_POSTGRES_ARTIFACTS |
| JwtAccountStatusPostgresIntegrationTest | RUN_R4_POSTGRES_TESTS | E11_POSTGRES_URL / E11_POSTGRES_ARTIFACTS |
| SubsanacionTtaipPostgresIntegrationTest | RUN_TTAIP_POSTGRES_TESTS | TTAIP_POSTGRES_URL / TTAIP_POSTGRES_ARTIFACTS |
| TransicionesTtaipPostgresIntegrationTest | RUN_R3_POSTGRES_TESTS | TTAIP_POSTGRES_URL / TTAIP_POSTGRES_ARTIFACTS |
| TransicionesSaipPostgresIntegrationTest | RUN_R3_SAIP_POSTGRES_TESTS | SAIP_POSTGRES_URL / SAIP_POSTGRES_ARTIFACTS |
| CumplimientoTtaipPostgresIntegrationTest | RUN_CUMPLIMIENTO_POSTGRES_TESTS | TTAIP_POSTGRES_URL / TTAIP_POSTGRES_ARTIFACTS |
| RespuestaSaipRecepcionPostgresIntegrationTest | RUN_RESPUESTA_POSTGRES_TESTS | RESPUESTA_POSTGRES_URL / RESPUESTA_POSTGRES_ARTIFACTS |

Ejemplo, desde `backend/`, después de crear los recursos propios:

```powershell
$env:RUN_RESPUESTA_POSTGRES_TESTS='true'
$env:RESPUESTA_POSTGRES_URL=$urlTemporalPropia
$env:RESPUESTA_POSTGRES_ARTIFACTS=$directorioEvidenciaExistente
./mvnw.cmd -o '-Dtest=RespuestaSaipRecepcionPostgresIntegrationTest' test
```

Ejecutar secuencialmente sobre esa base; no lanzar dos suites que truncan tablas a
la vez. Las fixtures usan LOCAL, notificaciones MOCK y push desactivado. Las suites
case-insensitive y S3 tienen condiciones distintas: leer su fixture antes de
habilitarlas; la primera necesita seed intacto y otra base aislada. Detener al final
únicamente el cluster propio mediante `pg_ctl -D <directorio-propio> stop`.

## Interpretación y contrato

- Distinguir JPA/PostgreSQL y bytes/hash LOCAL de mocks HTTP/Mockito, H2 y proveedores
  externos simulados. Un opt-out no es una prueba aprobada.
- No sumar reejecuciones como cobertura nueva ni llamar suite completa a un acumulado.
  Reutilizar evidencia anterior solo si corresponde al mismo contenido.
- Capturar `/v3/api-docs` completo de Spring validado en un directorio nuevo fuera de
  los snapshots. Comparar extensión, referencias transitivas, tipos, requeridos,
  respuestas y Bearer. Incorporar solo el alcance afectado y generar tipos con
  `pnpm --dir frontend run generate:api`.
- Los snapshots son parciales. El informe [recepción SAIP](SAIP_RESPUESTA_RECEPCION.md)
  delimita la deriva conservada; no afirmar sincronización global por añadir rutas.
- La revisión estática móvil no demuestra Android operativo. No se verificaron aquí
  navegador, firma digital, emisión oficial ni paridad visual.
