# Análisis de referencia SQL Server para Apelaciones TTAIP

## Resumen

La carpeta `BaseDeDatos_APELACIONES_TTAIP_V1/` describe una base SQL Server especializada en la segunda instancia ante el Tribunal de Transparencia y Acceso a la Información Pública. No representa la plataforma completa SAIP. Su alcance aprobado aplica a expedientes TTAIP, salas, vocales, resoluciones, cédulas/notificaciones, reprocesos y auditoría del trámite.

El proyecto actual ya conserva la primera instancia SAIP como flujo propio y usa el backend Spring Boot + MySQL como fuente de verdad. Por eso esta referencia no debe importarse literalmente ni reemplazar el modelo existente; debe usarse para fortalecer el agregado `ExpedienteTtaip`.

Archivo esperado por el pedido y archivo real encontrado:

- Pedido: `00_LEE_ME_PRIMERO.md`
- Encontrado: `00_LEEME_PRIMERO.md`

## Alcance real de la base SQL Server

La referencia modela principalmente:

- Expediente de apelación TTAIP como caso central de segunda instancia.
- Recurrente y entidad asociados al expediente.
- Sala y vocal responsable.
- Primera calificación, segunda calificación y resolución final.
- Notificaciones separadas por etapa y destinatario.
- Reprocesos de notificación, con intentos, cargo observado y subsanación.
- Vistas operativas para áreas de verificación, notificaciones, performance y carga de vocales.
- Triggers y procedimientos para auditoría, cambios de estado, asignación/reasignación y mantenimiento.
- Seguridad SQL Server propia, separada de la seguridad de la aplicación.

## Correspondencia funcional

### Apelaciones TTAIP

La referencia confirma que el expediente TTAIP debe ser el contenedor del caso en segunda instancia. En el proyecto actual esto corresponde a `ExpedienteTtaip`, vinculado a `Apelacion`, `SalaTtaip`, miembros asignados y resoluciones.

Ya cubierto:

- Apelación vinculada al expediente.
- Primera Sala y Segunda Sala.
- Miembros TTAIP reales y presidencia del tribunal en el seed MySQL.
- Resoluciones con tipo `PRIMERA_CALIFICACION`, `SEGUNDA_CALIFICACION` y `RESOLUCION_FINAL`.
- Número de resolución con sufijo de sala.

Mejorado:

- Historial estructurado de eventos del expediente TTAIP.

### Notificaciones

SQL Server separa notificaciones por etapa y destinatario: recurrente/entidad para primera calificación, segunda calificación y resolución final. En el proyecto actual se normaliza en una tabla única `notificaciones_ttaip`, vinculada a `cedulas_notificacion`.

Ya cubierto:

- Dos cédulas por resolución.
- Destinatarios `CIUDADANO` y `ENTIDAD_PUBLICA`.
- Notificación ligada al expediente y a la cédula.

Mejorado:

- Eventos de trazabilidad para cédulas emitidas y notificaciones registradas.
- Visualización del bloque de historial/notificaciones desde el detalle TTAIP.

### Reprocesos

SQL Server incluye `Notificaciones.Reproceso` para reprocesar cargos observados o notificaciones defectuosas. Esta era la brecha más clara del proyecto actual.

Integrado:

- Nueva entidad `ReprocesoNotificacion`.
- Nueva tabla MySQL `reprocesos_notificacion`.
- Relación con expediente, notificación, cédula original, destinatario, intento y estado.
- Seed idempotente con un escenario de reproceso para entidad pública.
- Exposición del reproceso dentro del DTO del expediente TTAIP.

### Auditoría y trazabilidad

SQL Server usa triggers y tablas de auditoría. En Spring Boot no conviene copiar triggers como lógica principal porque el estado del trámite vive en servicios Java y contratos REST.

Integrado:

- Nueva entidad `HistorialTtaip`.
- Nueva tabla MySQL `historial_ttaip`.
- Registro automático de apertura de expediente, cambio de estado, resolución emitida, cédula emitida, notificación registrada y reproceso registrado.

No integrado literalmente:

- Triggers de SQL Server.
- Stored procedures.
- Backups, mantenimiento SQL Server, full text, Row Level Security y roles SQL.

## Qué ya estaba cubierto en el proyecto

- `Apelacion` como recurso de segunda instancia vinculado a `Solicitud`.
- `ExpedienteTtaip` como agregado principal.
- `SalaTtaip` y miembros asignados al expediente.
- Resoluciones TTAIP en la tabla `resoluciones`.
- Cédulas y notificaciones normalizadas.
- Seed MySQL idempotente para Primera Sala y Segunda Sala.
- DTO del expediente con sala, miembros, resoluciones, cédulas y notificaciones.
- RFC 9457 / Problem Details en el backend.
- Colección Postman/Newman ya validada previamente.

## Qué faltaba integrar

- Modelo de reproceso de notificación.
- Historial estructurado consultable desde el expediente, no solo `trazabilidad_minima` en texto.
- Seed MySQL de reproceso y eventos de historial.
- Visualización frontend de historial y reprocesos en el detalle TTAIP.

## Qué no conviene integrar

- Tablas duplicadas de recurrente y entidad: el proyecto ya tiene `ciudadanos`, `usuarios`, `entidades` y `solicitudes`.
- Resoluciones separadas por tabla física: el proyecto usa una tabla `resoluciones` con `tipo_resolucion`, más simple y suficiente para el contrato API.
- Seis tablas físicas de notificación: la normalización actual `cedulas_notificacion` + `notificaciones_ttaip` evita duplicación y preserva destinatario/etapa mediante resolución.
- Triggers y procedures SQL Server: deben vivir como servicios transaccionales Java para mantener reglas de negocio testeables.
- Seguridad SQL Server avanzada: el proyecto usa Spring Security + JWT, roles de aplicación y configuración de CORS.
- SQL Server full-text y jobs de backup: son específicos del motor y no aplican al MySQL local del proyecto.

## Tabla de trazabilidad

| Tabla SQL Server | Propósito | Equivalente actual | Entidad/backend actual | Estado | Recomendación |
|---|---|---|---|---|---|
| `Catalogos.Sala` | Catálogo de salas TTAIP | `salas_ttaip` | `SalaTtaip` | Cubierto | Mantener Primera y Segunda Sala idempotentes en seed. |
| `Catalogos.Vocal` | Vocales y presidentes de sala | `miembros_ttaip` | `MiembroTTAIP` | Cubierto | Mantener correos, cargos y periodos oficiales. |
| `Catalogos.ResponsableNotificacion` | Responsables operativos de notificación | Texto responsable en reproceso | `ReprocesoNotificacion` | Mejorar | Evaluar catálogo propio si se agregan usuarios operativos de mesa de partes. |
| `Catalogos.SentidoResolucion` | Sentido de resolución | `decision`, `resultado` | `Resolucion.DecisionResolucion` | Cubierto | No duplicar catálogo mientras enum cubra el dominio. |
| `Catalogos.TipoVotacion` | Tipo de votación | No modelado | No aplica directo | Falta | Integrar solo si el frontend/backend gestionará actas o votos. |
| `Catalogos.MotivoReasignacion` | Motivos para reasignar vocal | No modelado | No aplica directo | Falta | Integrar cuando exista flujo de reasignación de miembros. |
| `Expedientes.Recurrente` | Ciudadano recurrente | `ciudadanos`, `usuarios` | `Ciudadano`, `Usuario` | Cubierto | No duplicar identidad del ciudadano. |
| `Expedientes.Entidad` | Entidad pública apelada | `entidades` | `Entidad` | Cubierto | No duplicar entidad. |
| `Expedientes.Expediente` | Caso principal TTAIP | `expedientes_ttaip` | `ExpedienteTtaip` | Cubierto | Seguir tratándolo como agregado principal. |
| `Expedientes.ExpedienteRecurrente` | Relación expediente-recurrente | Relación vía apelación/solicitud | `Apelacion`, `Solicitud`, `Ciudadano` | Cubierto | Mantener enlace indirecto para evitar duplicación. |
| `Expedientes.ExpedienteEntidad` | Relación expediente-entidad | Relación vía solicitud | `Solicitud.entidad` | Cubierto | Mantener fuente desde primera instancia. |
| `Expedientes.AsignacionVocal` | Asignación de vocal a expediente | `expediente_ttaip_miembros` | `ExpedienteTtaip.miembrosAsignados` | Mejorar | Si se requiere vocal ponente, agregar campo o relación con rol de asignación. |
| `Expedientes.ReasignacionVocal` | Historial de reasignaciones | `historial_ttaip` | `HistorialTtaip` | Mejorar | Registrar eventos de reasignación si se implementa flujo. |
| `Resoluciones.ResolucionPrimeraCalificacion` | Primera resolución de calificación | `resoluciones` con tipo | `Resolucion` | Cubierto | Mantener tipo `PRIMERA_CALIFICACION`. |
| `Resoluciones.ResolucionSegundaCalificacion` | Segunda resolución tras subsanación | `resoluciones` con tipo | `Resolucion` | Cubierto | Mantener tipo `SEGUNDA_CALIFICACION`. |
| `Resoluciones.ResolucionFinal` | Resolución final | `resoluciones` con tipo | `Resolucion` | Cubierto | Mantener tipo `RESOLUCION_FINAL`. |
| `Notificaciones.NotificacionRecurrentePrimera` | Notificación al recurrente en primera calificación | `notificaciones_ttaip` + `cedulas_notificacion` | `NotificacionTtaip`, `CedulaNotificacion` | Cubierto | Consultar por resolución y destinatario `CIUDADANO`. |
| `Notificaciones.NotificacionEntidadPrimera` | Notificación a entidad en primera calificación | `notificaciones_ttaip` + `cedulas_notificacion` | `NotificacionTtaip`, `CedulaNotificacion` | Cubierto | Consultar por resolución y destinatario `ENTIDAD_PUBLICA`. |
| `Notificaciones.NotificacionRecurrenteSegunda` | Notificación al recurrente en segunda calificación | `notificaciones_ttaip` + `cedulas_notificacion` | `NotificacionTtaip`, `CedulaNotificacion` | Cubierto | Mantener dos cédulas por resolución. |
| `Notificaciones.NotificacionEntidadSegunda` | Notificación a entidad en segunda calificación | `notificaciones_ttaip` + `cedulas_notificacion` | `NotificacionTtaip`, `CedulaNotificacion` | Cubierto | Mantener dos cédulas por resolución. |
| `Notificaciones.NotificacionRecurrenteFinal` | Notificación al recurrente de resolución final | `notificaciones_ttaip` + `cedulas_notificacion` | `NotificacionTtaip`, `CedulaNotificacion` | Cubierto | Mantener trazabilidad por cédula. |
| `Notificaciones.NotificacionEntidadFinal` | Notificación a entidad de resolución final | `notificaciones_ttaip` + `cedulas_notificacion` | `NotificacionTtaip`, `CedulaNotificacion` | Cubierto | Mantener trazabilidad por cédula. |
| `Notificaciones.Reproceso` | Reproceso por cargo observado o nueva notificación | `reprocesos_notificacion` | `ReprocesoNotificacion` | Cubierto | Agregar endpoints CRUD cuando exista pantalla operativa. |
| `Auditoria.LogCambios` | Auditoría de cambios | `historial_ttaip` | `HistorialTtaip` | Mejorar | Mantener eventos de dominio; evaluar auditoría global técnica después. |
| Vistas `vw_AreaNotificaciones*` | Bandejas operativas de notificación | Servicios/listados TTAIP | `TTAIPService`, DTOs | Mejorar | Crear endpoints de bandejas si se requiere operación separada. |
| Vistas `vw_ReprocesosCompletos` | Consulta de reprocesos enriquecida | DTO de expediente con reprocesos | `ReprocesoNotificacionDTO` | Mejorar | Agregar endpoint de búsqueda por estado/destinatario. |
| Stored procedures | Orquestación SQL | Servicios transaccionales Java | `TTAIPService`, `ExpedienteTtaipService` | No aplica | No copiar; mantener reglas en Java. |
| Triggers de estado/auditoría | Automatizar estado y fechas | Servicios Java + JPA callbacks | Servicios y entidades | No aplica | No copiar; preservar testabilidad. |
| Seguridad SQL Server | Roles, usuarios, RLS | Spring Security + JWT | `SecurityConfig`, auth | No aplica | No mezclar seguridad de motor con seguridad de aplicación. |

## Integración aplicada

- `HistorialTtaip` y `historial_ttaip` para trazabilidad estructurada del expediente.
- `ReprocesoNotificacion` y `reprocesos_notificacion` para reprocesos de cédula/notificación.
- DTOs de historial y reproceso dentro de `ExpedienteTtaipDTO`.
- Registro automático de eventos desde `ExpedienteTtaipService`.
- Seed MySQL idempotente con historial y reproceso de prueba.
- Vista TTAIP de detalle enriquecida con trazabilidad y reprocesos.

## Pendientes técnicos recomendados

- Crear endpoints específicos para listar y gestionar reprocesos por estado, destinatario y expediente.
- Añadir flujo operativo de reasignación de vocal si el TTAIP lo requiere.
- Evaluar catálogo de responsables de notificación si se separa mesa de partes TTAIP.
- Añadir pruebas unitarias/integración específicas para historial y reprocesos.
- Sincronizar OpenAPI cuando los DTOs nuevos queden incorporados a la documentación API publicada.
