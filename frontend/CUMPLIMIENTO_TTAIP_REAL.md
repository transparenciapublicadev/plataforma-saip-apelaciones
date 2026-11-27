# Seguimiento TTAIP con datos del servidor

Entrega R1 del 22/10/2026. Alcance: `compliance-tracking.component`, su plantilla
y pruebas. No se cambian reglas, migraciones, autenticación ni código Kotlin.

## Consultas y actuaciones

La pantalla obtiene las apelaciones resueltas de `GET /api/ttaip/resueltas` para
identificar sus agregados y consulta `GET /api/ttaip/expedientes/{id}/cumplimientos`.
Cada fila identifica un `CumplimientoResolucionTtaipDTO` persistido; no equivale a
una apelación ni se construye un seguimiento por cada resolución fundada.
Se conservan todos los seguimientos recuperados, incluidos los cerrados y parciales.

Estado, fechas, tipo, observación, referencias y trazabilidad proceden del DTO.
La SAIP de origen y fecha de resolución, cuando están informadas, proceden de la
apelación y resolución correspondiente. Las apelaciones externas pueden carecer
de SAIP local. Los contadores agrupan los estados registrados; un cierre operativo
no certifica entrega total. No se calcula avance porcentual ni vencimiento local.

| Acción visual | Comando y condición |
| --- | --- |
| Observar | `PATCH /api/ttaip/expedientes/{expedienteId}/cumplimientos/{id}/observar`; TTAIP/administrador, seguimiento no cerrado, observación obligatoria de hasta 2000 caracteres. |
| Cerrar | `PATCH /api/ttaip/expedientes/{expedienteId}/cumplimientos/{id}/cerrar`; TTAIP/administrador y seguimiento no cerrado. Conserva el cierre operativo existente, sin imponer cumplimiento total. |
| Marcar cumplido | Inhabilitada: `POST .../{id}/registrar` comunica cumplimiento por funcionario de la entidad/administrador con tipo, descripción, responsable y evidencia o referencia para TOTAL/PARCIAL. El Tribunal no sustituye esa comunicación. |
| Reiterar | Inhabilitada: falta un comando específico con sus precondiciones y trazabilidad; no se inventa el estado REITERADO. Emisión documental fuera del alcance. |
| Abrir seguimiento | No se ofrece desde esta pantalla: falta una base temporal inequívoca en el contrato para iniciar el plazo con seguridad. El endpoint existente no se modifica. |

Observar/cerrar confirman éxito únicamente tras validar la respuesta del comando y
recuperar por GET el mismo seguimiento, expediente y apelación, con el estado y
observación devueltos. Los errores conservan el texto. Un fallo de red, servidor,
timeout o recuperación discordante se muestra como resultado no comprobado: se
bloquea otro comando hasta consultar de nuevo, sin repetir automáticamente escrituras.
No se implementa idempotencia de los comandos existentes en esta entrega.

Las consultas fallidas limpian los datos anteriores y distinguen validación,
401, 403, 404, servidor y red. El vacío solo procede de consultas correctas.
Datos sin identificación suficiente se muestran como información incompleta o
error de consulta; no acreditan ausencia de actuaciones. Cambiar de selección,
sesión o destruir el componente descarta respuestas anteriores. La autorización
efectiva sigue en Spring Security y la comprobación institucional del backend.

## Plazo y conflicto con la referencia

La fuente consolidada `docs/business-rules/SAIP_TTAIP_REGLAS_NEGOCIO.md:313–324`
establece siete días hábiles para FUNDADO/FUNDADO_EN_PARTE y notificación válida
a la entidad. Su línea 319 también describe el fallback operativo anterior a la
fecha de resolución/notificación disponible. `ExpedienteTtaipService` conserva
`fechaBaseCumplimiento`, que puede usar resolución o fecha actual, y permite una
fecha base explícita en creación. El DTO no identifica la notificación que
sustenta la fecha ni su eficacia. Esa deuda es distinta del reloj de subsanación
corregido mediante V9; no se reutiliza su modelo ni se alteran históricos.

La pantalla muestra exclusivamente la fecha límite **registrada**, con aviso de
base no acreditada, y el estado operativo almacenado. No certifica un vencimiento
legal, calcula fechas ni habilita aperturas con fechas sustitutas. Quedan pendientes
la evidencia persistente de inicio de cumplimiento y una política validada para
rectificaciones e históricos. El DOCX original no estuvo accesible en esta tarea;
no se afirma haberlo consultado ni se resuelve una decisión legal por apariencia.

Se preservan layout, tokens, iconos y disposición de `design-reference`.
Se aparta de sus acciones genéricas y de la afirmación de apertura automática de
un proceso disciplinario porque el contrato no respalda ese comportamiento.
Las referencias documentales del DTO se presentan como texto registrado, sin
archivos sustitutos ni descargas inventadas. Los documentos oficiales siguen
fuera del alcance de esta pantalla y de esta entrega.

## Contrato y verificaciones

No se extiende el contrato del backend: se reutilizan DTO y comandos existentes.
Los snapshots parciales anteriores y los tipos generados se preservan. El contraste
con OpenAPI completo de la instancia PostgreSQL validada queda en la evidencia de
la entrega; las siete rutas de cumplimiento y sus cinco esquemas transitivos
coinciden exactamente en ambos snapshots, incluyendo seguridad. No se atribuye
sincronización global: el contrato vivo conserva 163 rutas/95 esquemas frente a
161/89 de los snapshots; faltan configuración/actividad y seis esquemas ajenos,
además de ocho diferencias de rutas y tres de esquemas de administración/registro
preexistentes. No se sobrescriben esos snapshots ni se regeneran tipos sin cambios.

Las pruebas Angular usan servicios simulados para errores, reintentos, selección,
sesión y confirmación solo tras GET. `CumplimientoTtaipPostgresIntegrationTest`
ejecuta login/JWT, seguridad, JPA, transacciones y PostgreSQL reales; Flyway y
`ddl-auto=validate` habilitados, LOCAL configurado, notificaciones externas MOCK
y push deshabilitado. No se prueban subidas en este flujo, que consume referencias
ya registradas. La base debe ser temporal propia y cumplir la guarda del test.

Para ejecutarla: `RUN_CUMPLIMIENTO_POSTGRES_TESTS=true`, `TTAIP_POSTGRES_URL` con
la URL temporal aislada y `TTAIP_POSTGRES_ARTIFACTS` con una carpeta de evidencia;
después `backend/mvnw.cmd -o -Dtest=CumplimientoTtaipPostgresIntegrationTest test`.
No ejecutar esa suite contra una base existente: sus fixtures truncan datos sintéticos.

## Comprobación manual pendiente

1. Con datos sintéticos, abrir como TTAIP el seguimiento de una resolución fundada;
   comparar ID, estado y referencias con el GET autorizado.
2. Observar con motivo; verificar la respuesta PATCH, el GET posterior y el historial.
   Recargar la página y comprobar que persiste. Repetir con cierre operativo.
3. Cortar la conexión: no debe aparecer confirmación; el fundamento debe conservarse
   y debe pedirse consultar antes de repetir una operación incierta.
4. Cambiar de expediente o sesión con una petición pendiente: no deben reaparecer
   datos ni avisos del recurso anterior. Revisar teclado y mensajes accesibles.
5. Comprobar vacío, 401/403/404/5xx y ausencia de archivos o fechas de demostración.

La comprobación en navegador no pudo ejecutarse por fallo del puente del entorno.
Android conserva su contrato anterior y no se modifica ni se compila en esta entrega.
La incompatibilidad móvil previa de subsanación continúa documentada en
`backend/TTAIP_SUBSANACION_RECEPCION.md`; no queda resuelta aquí.

Resultados de cierre: Angular **437/437** (36 archivos, una suite completa con un
trabajador; 35 casos nuevos), tipos app/spec y build correctos. Backend completo
**351 casos: 270 aprobados, 81 omitidos, cero fallos/errores**, incluidos los ocho
casos nuevos con PostgreSQL real. Los omitidos pertenecen a integraciones optativas
anteriores de PostgreSQL y S3, sin volver a ejecutarlas en esta entrega. La ejecución
PG específica de ocho casos también pasó; no se suman ambas como 16 casos distintos.
Las suites Angular usan mocks de servicios; no son verificación en navegador.
El build conserva advertencias CommonJS preexistentes de jspdf/canvg.
