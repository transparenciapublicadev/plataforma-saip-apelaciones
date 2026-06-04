# Auditoria de migracion MySQL a PostgreSQL

Fecha de auditoria: 2026-06-04
Alcance: `database/script_saip_db.sql`, entidades JPA actuales y script PostgreSQL paralelo.
Estado: auditoria y preparacion. El runtime principal del backend sigue usando MySQL.

## Resumen ejecutivo

Se inicio la migracion controlada de MySQL a PostgreSQL sin cambiar el runtime principal del backend, sin eliminar MySQL y sin introducir almacenamiento de documentos. El resultado de esta fase es un script paralelo:

`database/postgres/script_saip_db_postgres.sql`

El script PostgreSQL es autocontenido para ensayos locales o de CI futuros: crea las tablas base que hoy normalmente genera JPA/Hibernate, crea las tablas operativas agregadas por el script MySQL, conserva relaciones, indices principales y seeds oficiales. Tambien mantiene los datos funcionales actuales de SAIP, TTAIP, salas, miembros, cédulas, notificaciones y reproceso de prueba.

No se modificaron `application.properties`, perfiles runtime, backend Java, frontend, mobile ni reglas funcionales.

## Alcance real del script MySQL actual

`database/script_saip_db.sql` no es solo un DDL completo. Es un script hibrido:

- Asume que varias tablas base ya existen por JPA/Hibernate: `usuarios`, `entidades`, `ciudadanos`, `funcionarios`, `administradores`, `miembros_ttaip`, `solicitudes`, `respuestas`, `apelaciones`, `resoluciones` y `documentos`.
- Agrega columnas de compatibilidad a tablas existentes.
- Crea tablas operativas para SAIP, TTAIP, notificaciones, push, reprocesos y trazabilidad.
- Carga seed local idempotente para entidades, usuarios demo, salas TTAIP, expedientes y casos de prueba Postman/Newman.

Por esa razon, el script PostgreSQL paralelo se diseño como autocontenido para que pueda ejecutarse en una base PostgreSQL limpia durante el siguiente PR de perfil PostgreSQL.

## Tablas convertidas

### Tablas base del modelo JPA

| Tabla | Estado en PostgreSQL | Nota |
| --- | --- | --- |
| `usuarios` | Convertida | Identity, email unico, boolean real. |
| `entidades` | Convertida | Acronimo unico e indices equivalentes. |
| `ciudadanos` | Convertida | PK/FK hacia `usuarios`; DNI unico. |
| `funcionarios` | Convertida | PK/FK hacia `usuarios`; FK a `entidades`. |
| `administradores` | Convertida | PK/FK hacia `usuarios`. |
| `miembros_ttaip` | Convertida | Periodos y presidencia del Tribunal con boolean real. |
| `solicitudes` | Convertida | Incluye consentimiento y canal formal de notificacion. |
| `respuestas` | Convertida | Relacion uno a uno con solicitud. |
| `apelaciones` | Convertida | Soporta origen interno/externo y `solicitudId` nullable. |
| `resoluciones` | Convertida | Relaciona apelacion, expediente, sala y miembro. |
| `documentos` | Convertida | Mantiene referencias actuales; no se implemento storage. |

### Tablas SAIP operativas

| Tabla | Estado en PostgreSQL | Nota |
| --- | --- | --- |
| `observaciones_solicitud` | Convertida | Observacion/subsanacion formal. |
| `ampliaciones_plazo_solicitud` | Convertida | Ampliacion con fechas y trazabilidad. |
| `cronograma_entregas_parciales_solicitud` | Convertida | Entregas parciales por ampliacion. |
| `encauzamientos_solicitud` | Convertida | Origen/destino y alcance total/parcial. |
| `liquidaciones_costo_solicitud` | Convertida | Monto `NUMERIC(12,2)` y fechas de recojo. |

### Tablas TTAIP, notificaciones y trazabilidad

| Tabla | Estado en PostgreSQL | Nota |
| --- | --- | --- |
| `elevaciones_apelacion_ttaip` | Convertida | Elevacion por entidad. |
| `salas_ttaip` | Convertida | Primera y Segunda Sala. |
| `expedientes_ttaip` | Convertida | Agregado principal TTAIP. |
| `expediente_ttaip_miembros` | Convertida | Relacion muchos a muchos expediente/miembros. |
| `cedulas_notificacion` | Convertida | Unicidad por numero y destinatario. |
| `notificaciones_ttaip` | Convertida | Constancias, acuses y validacion manual. |
| `descargos_entidad_ttaip` | Convertida | Descargos y expediente administrativo. |
| `suspensiones_plazo_ttaip` | Convertida | Descargos, informe oral e informacion complementaria. |
| `cumplimientos_resolucion_ttaip` | Convertida | Seguimiento de resoluciones fundadas. |
| `historial_ttaip` | Convertida | Eventos trazables del expediente. |
| `reprocesos_notificacion` | Convertida | Conserva cedula original y nueva cedula/notificacion. |
| `intentos_notificacion` | Convertida | Motor comun SAIP/TTAIP. |
| `dispositivos_notificacion_push` | Convertida | FCM token hash/cifrado sin exponer tokens. |

## Incompatibilidades MySQL encontradas

| MySQL | Impacto | Resolucion PostgreSQL |
| --- | --- | --- |
| `USE saip_db` | PostgreSQL no cambia de base dentro del script. | Omitido; se ejecuta contra la base seleccionada por `psql`. |
| `DELIMITER`, procedimientos auxiliares y `CALL` | Sintaxis propia de MySQL para DDL dinamico. | Reemplazado por DDL PostgreSQL directo, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` e indices idempotentes. |
| `AUTO_INCREMENT` | No existe en PostgreSQL. | `BIGINT GENERATED BY DEFAULT AS IDENTITY`. |
| `TINYINT(1)` | Boolean simulado en MySQL. | `BOOLEAN` real. |
| `DATETIME` | No guarda zona horaria. | `TIMESTAMPTZ` para eventos operativos; `DATE` se mantiene para plazos legales. |
| `ON UPDATE CURRENT_TIMESTAMP` | No existe como atributo de columna. | Funcion trigger `set_fecha_actualizacion()` y triggers por tabla. |
| `ON DUPLICATE KEY UPDATE` | Sintaxis MySQL. | `ON CONFLICT (...) DO UPDATE`. |
| `INSERT IGNORE` | Sintaxis MySQL. | `ON CONFLICT (...) DO NOTHING`. |
| `UPDATE ... JOIN` | Sintaxis MySQL. | `UPDATE ... FROM`. |
| `DATE_ADD`, `DATE_SUB` | Funciones MySQL. | Aritmetica con `INTERVAL`. |
| `DATE_FORMAT` | Funcion MySQL. | `to_char(...)`. |
| `CONCAT` y `LPAD` | Existen diferencias menores. | Se uso `||`, `lpad(...::text, ...)` y `to_char` donde aplica. |
| `VALUES(col)` en upsert | Forma MySQL. | Alias `EXCLUDED.col`. |
| `KEY` y `UNIQUE KEY` inline | Sintaxis MySQL. | `CREATE INDEX IF NOT EXISTS` y constraints `UNIQUE`. |
| Checks gestionados con procedimientos | El script MySQL crea o elimina checks dinamicamente. | Se definieron checks inline solo donde son estables y de bajo riesgo, especialmente notificaciones y push. |
| Charset/collation/engine | Propio de MySQL. | Omitido; se debe definir collation/encoding de la base PostgreSQL en provisionamiento. |

## Equivalencias de tipos

| Concepto | MySQL actual | PostgreSQL paralelo |
| --- | --- | --- |
| IDs | `BIGINT AUTO_INCREMENT` | `BIGINT GENERATED BY DEFAULT AS IDENTITY` |
| Booleanos | `TINYINT(1)` | `BOOLEAN` |
| Fechas de plazo | `DATE` | `DATE` |
| Fechas con hora | `DATETIME` | `TIMESTAMPTZ` |
| Textos largos | `TEXT` / `LONGTEXT` si aparece | `TEXT` |
| Montos | `DECIMAL(12,2)` | `NUMERIC(12,2)` |
| Enums JPA | `VARCHAR(...)` + checks puntuales | `VARCHAR(...)` + checks puntuales solo donde son estables |
| JSON/metadata | No se detecto JSON productivo en el script actual | Futuro: `JSONB` cuando se modele metadata documental |
| Hash/token cifrado | `CHAR(64)` / `TEXT` | `CHAR(64)` / `TEXT` |

## Decisiones tomadas

- MySQL sigue siendo la base runtime actual.
- PostgreSQL queda preparado como script paralelo, no como reemplazo inmediato.
- El script PostgreSQL es autocontenido porque el script MySQL depende de tablas base generadas por JPA.
- Se uso `TIMESTAMPTZ` para eventos con hora porque facilita auditoria y despliegues multi-entorno.
- Los plazos legales se mantienen como `DATE` para evitar mezclar tiempo/zona horaria con reglas de dias habiles.
- Los enums JPA se mantienen como `VARCHAR` para no acoplar el DDL a tipos enum PostgreSQL en esta primera fase.
- Los seeds oficiales de TTAIP se conservan:
  - Presidencia del Tribunal: Julio Cesar Mancilla Crespo, `jmancilla@minjus.gob.pe`, 2025-06-09 al 2026-06-08.
  - Primera Sala: Tatiana Azucena Valverde Alvarado, Luis Guillermo Agurto Villegas y Segundo Ulises Zamora Barboza, 2025-03-22 al 2026-03-21.
  - Segunda Sala: Junior Pichon De la Cruz, Julio Cesar Mancilla Crespo y Jessica Martha Rojas Barrueta, 2025-06-04 al 2026-06-03.
- Se conservaron los casos de prueba TTAIP con resoluciones, cedulas, notificaciones e historial.
- Se conservaron los placeholders de password del seed local (`Saip2026*`) solo por equivalencia con MySQL; no son configuracion productiva.

## Riesgos detectados

| Riesgo | Nivel | Comentario |
| --- | --- | --- |
| Divergencia entre JPA y SQL manual | Medio | El script MySQL ya es hibrido. PR 2 debe validar Hibernate contra PostgreSQL real. |
| Ejecucion no validada con `psql` local | Medio | El entorno actual no tiene CLI PostgreSQL disponible. Falta prueba real en PostgreSQL. |
| Seeds con passwords demo | Bajo para local, alto si se usa en prod | Ya existian en MySQL. Deben mantenerse fuera de entornos productivos. |
| Checks demasiado estrictos | Bajo | Se limitaron checks a valores estables. Enums de negocio siguen como `VARCHAR`. |
| Secuencias identity despues de upserts | Bajo | Al no insertar IDs fijos, PostgreSQL mantiene las identidades naturalmente. |
| Collation y busqueda case-insensitive | Medio | MySQL suele tener collations case-insensitive; PostgreSQL no. PR 2 debe decidir si usar `citext` o indices funcionales donde aplique. |

## Pendientes para PR 2

1. Crear perfil backend PostgreSQL sin cambiar aun produccion:
   - Driver JDBC PostgreSQL.
   - Perfil `postgres` o `application-postgres.properties`.
   - Datasource por variables de entorno.
   - Dialecto Hibernate correspondiente.
2. Ejecutar el script en PostgreSQL real:
   - `psql -d saip_db_postgres -f database/postgres/script_saip_db_postgres.sql`
   - Validar conteos finales.
   - Validar idempotencia ejecutandolo dos veces.
3. Ejecutar backend tests contra PostgreSQL:
   - Unidad.
   - Integracion si se habilita Testcontainers o base local.
4. Sincronizar OpenAPI solo si el cambio runtime revela diferencias contractuales.
5. Revisar queries nativas o JPQL sensibles a dialecto.
6. Definir estrategia para collations/case-insensitive:
   - `citext` para email si se aprueba.
   - Indices funcionales `lower(email)` si se prefiere no usar extension.
7. Planear migracion real de datos:
   - Dump MySQL.
   - Transformacion.
   - Carga PostgreSQL.
   - Verificacion referencial.
   - Ventana de corte.

## Validaciones necesarias

### Validacion estatica de esta fase

- Revisar que el script PostgreSQL no contenga sintaxis MySQL critica como `AUTO_INCREMENT`, `ON DUPLICATE KEY UPDATE`, `TINYINT(1)`, `DELIMITER`, `CALL` o `UPDATE ... JOIN`.
- Revisar que use `ON CONFLICT`, `BOOLEAN`, `TIMESTAMPTZ`, `NUMERIC` e indices PostgreSQL.
- Ejecutar `git diff --check`.
- Ejecutar auditoria basica de secretos.
- Ejecutar tests backend para confirmar que no se cambio runtime ni codigo funcional.

### Validacion real pendiente

No se pudo ejecutar `psql` localmente porque el CLI PostgreSQL no esta disponible en el entorno actual. La validacion real pendiente es:

```powershell
createdb saip_db_postgres
psql -d saip_db_postgres -f database/postgres/script_saip_db_postgres.sql
psql -d saip_db_postgres -f database/postgres/script_saip_db_postgres.sql
```

La segunda ejecucion debe confirmar idempotencia sin duplicar registros.

## Estrategia recomendada por fases

1. **Fase 1 - Preparacion paralela**
   - Auditoria MySQL -> PostgreSQL.
   - Script PostgreSQL paralelo.
   - Sin runtime change.

2. **Fase 2 - Perfil backend PostgreSQL**
   - Agregar dependencia PostgreSQL.
   - Crear perfil `postgres`.
   - Ejecutar tests contra PostgreSQL real o Testcontainers.
   - Mantener MySQL como perfil principal hasta aprobacion.

3. **Fase 3 - Migracion de datos**
   - Exportar MySQL.
   - Transformar tipos/fechas/booleans.
   - Cargar PostgreSQL.
   - Validar conteos, claves, relaciones y flujos Newman.

4. **Fase 4 - Cutover controlado**
   - Cambiar entorno de staging a PostgreSQL.
   - Ejecutar backend, frontend, mobile y Newman.
   - Congelar escritura si se migra produccion real.

5. **Fase 5 - Document storage**
   - Modelar metadatos documentales en PostgreSQL.
   - Integrar Supabase Storage o S3-compatible en PR separado.
   - No guardar binarios en tablas SAIP/TTAIP salvo decision explicita.

## Confirmaciones de alcance

- No se cambio el runtime principal del backend.
- No se elimino MySQL.
- No se agrego storage documental.
- No se modifico frontend.
- No se modifico mobile.
- No se cambiaron reglas de negocio SAIP/TTAIP.
- No se altero Newman/Postman.
