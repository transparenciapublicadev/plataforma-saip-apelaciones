# R3: transiciones de apelaciones TTAIP

Entrega local acotada, 2026-10-23. No es una auditoría integral ni una implementación
de emisión documental, numeración o firma digital.

## Regla respaldada y matriz

Fuente: [reglas consolidadas](../docs/business-rules/SAIP_TTAIP_REGLAS_NEGOCIO.md),
secciones Primera calificación, Segunda calificación, Resolución final,
Notificaciones y Reglas de cédulas; [brechas](../docs/business-rules/SAIP_TTAIP_BRECHAS.md).
El DOCX original no estuvo accesible. No se infiere vigencia de las etiquetas
«cubierto» del inventario antiguo sin comprobar código y pruebas.

Decisión explícita del usuario: exigir **ambas notificaciones eficaces** para
avanzar desde segunda admisión; la elección de fecha base cuando las eficacias
sean distintas queda para una entrega de dominio posterior.

| Inicio | Operación / actor | Actuaciones o evidencia necesaria | Resultado permitido |
| --- | --- | --- | --- |
| Cualquier estado | PUT/PATCH genérico; TTAIP/administrador | Cuenta/rol y recurso autorizados; estado solicitado igual al persistido | Datos editables o repetición del estado; cambiarlo devuelve 409 |
| EN_CALIFICACION_1 | calificacion/{id}/subsanar; TTAIP/administrador | Primera calificación aún no registrada; fundamentos reales | Resolución INADMISIBLE, cédula al recurrente y EN_SUBSANACION |
| EN_CALIFICACION_1 | calificacion/{id}/admitir o inadmitir; TTAIP/administrador | Primera calificación aún no registrada; fundamentos reales | Primera admisión o improcedencia registrada; se conserva la etiqueta operativa existente |
| EN_SUBSANACION | Recepción de subsanación; ciudadano titular/administrador | Requerimiento INADMISIBLE vigente; texto y todos los archivos elegidos; reloj no vencido | Recepción persistida, EN_CALIFICACION_2; adjuntos siguen opcionales |
| EN_CALIFICACION_2 | calificacion/{id}/admitir o inadmitir; TTAIP/administrador | Primera INADMISIBLE y recepción del mismo requerimiento; ninguna segunda calificación previa | Segunda actuación registrada; admitir deja NOTIFICACION_SEGUNDA_CALIFICACION |
| NOTIFICACION_SEGUNDA_CALIFICACION | notificar-segunda-calificacion; TTAIP/administrador | Segunda admisión del expediente, recepción vinculada, eficacia acreditada para recurrente **y** entidad de esa resolución | EN_RESOLUCION persistido; repetición en EN_RESOLUCION no agrega actuaciones |
| EN_RESOLUCION | Descargos; TTAIP requiere, funcionario de la entidad presenta | Requerimiento y presentación o vencimiento registrados mediante los comandos existentes; entidad y expediente correctos | Actuación y cierre de la suspensión existente; no cambia duración/calendario |
| EN_RESOLUCION | resolucion/{id}/{decision}; TTAIP/administrador | Admisión registrada, ambas eficacias acreditadas; recepción si hubo segunda calificación; descargos de esa admisión presentados o vencidos, ninguno requerido pendiente; sin resolución final previa | Resolución/estado final correspondientes, atómicos |
| EN_SUBSANACION | calificacion/{id}/no-presentado; TTAIP/administrador | Requerimiento INADMISIBLE sin recepción, inicio acreditado y plazo vencido; fundamentos | Resolución TENER_POR_NO_PRESENTADO y cierre registrado |

Registrar la actuación, almacenar un archivo, acreditar notificación y verificar
una firma son hechos distintos. El servicio conserva los metadatos/historial
existentes, pero no certifica que esos registros constituyan un PDF emitido o
firmado. Un archivo o envío técnico por sí solos no satisfacen las precondiciones.

## Corrección y concurrencia

`TransicionesApelacionTtaipService` concentra las comprobaciones y bloquea la fila
de la apelación durante la transacción. Los comandos de calificación y resolución,
las actualizaciones genéricas, el requerimiento/presentación de descargos y el registro,
envío técnico o reproceso de evidencia por la API
comparten ese bloqueo. Se refresca el agregado después de adquirirlo para no
decidir con una entidad cargada antes de una transacción concurrente.

Los PUT/PATCH conservan ruta, cuerpo y DTO. Un valor inexistente o ausente conserva
el rechazo 422 del manejador de validación existente;
un cambio genérico es 409 `ProblemDetail`, antes de modificar fundamentos o
historial. No se despacha un comando inventando sus datos. Los comandos específicos
se validan antes de crear resoluciones, cédulas, notificaciones o cambios de estado.

Se exige la relación resolución → cédula → notificación del mismo expediente y
destinatario. La evidencia se comprueba mediante los registros existentes:

- Validación manual: estado VALIDADA, flag, fecha operativa, responsable y sustento,
  más el evento NOTIFICACION_VALIDADA de esa notificación.
- Acuse explícito: ENTREGADA/ENTREGADO, fecha y contenido, constancia para correo,
  más el evento ACUSE_NOTIFICACION_REGISTRADO correspondiente.

Una etiqueta puesta por un proveedor técnico, incluso MOCK, no equivale al registro
explícito de eficacia. Pendiente, fallida u observada no habilitan el avance.
Un reenvío técnico que sustituye los campos operativos tampoco puede aprovechar un
acuse antiguo que aún permanezca en el historial: `ENTREGADA_POR_*` exige registrar
nuevamente la evidencia mediante acuse explícito o validación sustentada.
No se aceptan históricos solo por su etiqueta; no hay backfill ni reapertura masiva.
La evidencia histórica insuficiente necesita revisión/registro sustentado mediante
las operaciones existentes. La entrega no elige una fecha legal de eficacia nueva.

Repetir la confirmación de segunda notificación en EN_RESOLUCION recupera el estado
si siguen cumpliéndose sus condiciones, sin insertar historial. Repetir calificación
o resolución ya registradas se rechaza con 409, sin duplicarlas. No se incorporó
un sistema de claves de idempotencia para todos esos comandos: ante resultado
incierto se consulta apelación y actuaciones antes de repetir. La recepción de
subsanación conserva su idempotencia por operación y requerimiento.

La presentación tardía conserva el rechazo 422, pero ya no cierra la apelación
como efecto lateral. El scheduler solo detecta/cuenta casos vencidos; necesita el
comando de resolución con fundamentos para cerrar. No se modifican días/calendario
ni las migraciones V1–V9.

## Consumidores y contrato

Angular conserva sus servicios/rutas y propaga los 409 sin devolver éxito ficticio.
La búsqueda acotada en `frontend/src/app` encontró el cambio genérico de apelación
en el servicio y sus specs; no encontró un llamador operativo de ese método.
`notificarSegundaCalificacion` también permanece en servicio/specs. No se cambia UX.

Android se revisó estáticamente, sin modificar Kotlin: `ApelacionApiService`
conserva PATCH; `ApelacionRestDataSource.actualizarApelacion` lo llama y la cola de
`ApelacionRepositoryImpl.sincronizar` intenta enviarlo. Los cambios locales que
pretendan imponer otro estado recibirán 409 y no deben marcarse como actuación
remota confirmada. Deben migrarse a los comandos de calificación, recepción,
confirmación de notificaciones o resolución correspondientes con sus datos reales.
No se mantiene el bypass para aparentar compatibilidad.

La incompatibilidad Android previa de subsanación multipart/JSON y la integración
de logout siguen pendientes. No se afirma compatibilidad funcional Android probada.

El contrato completo se captura desde `/v3/api-docs` de Spring sobre PostgreSQL
validado, fuera de los snapshots. La actualización de snapshots es deliberadamente
parcial: **19 operaciones** (PUT/PATCH genéricos, confirmación de segunda notificación,
calificaciones, resoluciones y sus alias), con respuestas 200/409 y descripciones
correspondientes. Se compararon completos sus **19 esquemas transitivos**, sin
cambiar ninguno: tipos, campos obligatorios, referencias y seguridad se conservan.
No se cambia
Bearer, AuthResponse, DTO de apelación ni esquemas de recepción.

Captura completa: 163 rutas/95 esquemas; cada snapshot sigue en 161/89. Se preserva
la deriva previa en ocho rutas (`/api/usuarios/{id}`, `/api/solicitudes/{id}`,
`/api/funcionarios/{id}`, `/api/entidades/{id}`, `/api/ciudadanos/{id}`,
`/api/apelaciones/{id}`, `/api/auth/registro`, `/api/auth/login`) y tres esquemas
(`UsuarioAdminDTO`, `CrearUsuarioAdminRequest`, `RegistroRequestDTO`).
En particular, el PUT de apelación conserva `operationId=actualizar_4` del snapshot;
Spring ya exponía `actualizar_5` antes de R3 por su numeración automática. Solo se
incorporan sus descripciones/respuestas, sin renombrar esa operación generada.
No faltan referencias de la extensión; permanecen ajenas a ella dos rutas
(`/api/configuracion`, `/api/estadisticas/actividad-reciente`) y seis esquemas
(`ActualizarUsuarioAdminRequest`, `NotifConfigDTO`, `PlazosConfigDTO`,
`SystemConfigDTO`, `TarifasConfigDTO`, `ActividadRecienteDTO`). No se declara
sincronización global. Los tipos Angular se regeneran desde ese snapshot parcial.

## Pendientes de R3

La elección de fecha base del plazo final queda pendiente por decisión explícita.
El cálculo existente de `ExpedienteTtaipService.fechaInicioPlazoResolucion` conserva
sus sustitutos por fechas de actuación/apertura; exigir ambas eficacias para avanzar
no convierte ese cálculo en un reloj acreditado. No usarlo como prueba de fecha legal.
Tampoco se corrige aquí el plazo de cumplimiento ni el cambio genérico SAIP.
Numeración, firma verificada y emisión documental formal quedan fuera.

Las autorizaciones globales actuales de TTAIP/administrador se conservan; no se
introduce una asignación nueva de competencia por sala o expediente.
Una apelación externa sin entidad catalogada no puede suplir el requerimiento de
descargos con un nombre o registro inventado: la operación existente requiere
la entidad real. Debe resolverse esa asociación mediante su flujo validado antes
de pretender resolver el fondo.

## Verificación

Se reprodujeron antes de corregir: PATCH/PUT que omitían actuaciones, avance de
segunda calificación desde estado inválido o con notificaciones pendientes/fallidas/
observadas, resolución desde primera calificación, duplicación de requerimiento,
cierre automático sin resolución (recepción tardía y scheduler), reenvío técnico
que aprovechaba acuse antiguo y resolución sin descargos o con descargos pendientes.
Los RED pertinentes fallaron por 200 en lugar de 409 o por cierre indebido; no se
cuentan como reproducciones un intento con PostgreSQL no disponible ni un fixture
de canal inválido. Ambos se corrigieron/reintentaron antes de concluir.

Última suite backend **completa**: `./mvnw.cmd -o test`, **382 casos: 322 aprobados,
60 omitidos, cero fallos/errores**, con `RUN_R3_POSTGRES_TESTS=true` y
`RUN_TTAIP_POSTGRES_TESTS=true`. No es una suma de reejecuciones. La ejecución verde
anterior de 379 casos precedía a tres casos añadidos; no se suma al resultado final.

De los aprobados, **31 casos R3 + 29 de subsanación** recorren PostgreSQL 18.4,
JPA/transacciones, seguridad/JWT y login reales. Flyway aplicó las migraciones
originales a una base nueva y validó sus nueve checksums, sin pendientes/fallos;
Hibernate arrancó con `ddl-auto=validate`. No hubo cambio de esquema.
La instancia propia quedó detenida al finalizar; no se usaron bases existentes.
La concurrencia usó dos peticiones HTTP reales bloqueadas en dos conexiones PostgreSQL distintas:
una registró el requerimiento y la otra recibió 409, con una sola actuación/cédula.
Las demás peticiones de comportamiento usan MockMvc con seguridad real en proceso.
El contrato se recuperó por HTTP real de la misma instancia PostgreSQL validada.

R3 configura LOCAL pero no sube bytes nuevos; los 29 casos de subsanación sí
verifican bytes/hash, recuperación, compensación, reintentos y autorizaciones con
almacenamiento LOCAL real. Solo notificaciones externas se aíslan en modo MOCK y
push permanece deshabilitado: no se probó entrega SMTP/casilla real ni firma.
Los cuatro unitarios de TTAIPService usan repositorios/servicios/política simulados;
la prueba de los guardas la aporta la integración, no esos mocks.

Los 60 omitidos son opt-ins no activados: configuración PostgreSQL (5), precisión
SAIP PostgreSQL (19), JWT PostgreSQL (24), cumplimiento PostgreSQL (8), repositorio
case-insensitive PostgreSQL (3) y S3 externo (1). El resto de la suite incluye H2 y
mocks; no se presenta como backend íntegramente probado sobre PostgreSQL.

Angular: dos servicios afectados **62/62** con `HttpTestingController`; después,
una suite completa serial **476/476 en 39 archivos**. No se suman los casos repetidos.
Comando: `pnpm --dir frontend test --watch=false --runner-config <config-temporal>`;
el config temporal solo fijó `maxWorkers:1` y `fileParallelism:false`, sin cambiar el
producto ni ampliar timeouts. Se usó pnpm 11.25 disponible con
`--config.manage-package-manager-versions=false --config.auto-install=false`, sin
instalar dependencias ni modificar el gestor declarado. Generación:
`pnpm --dir frontend run generate:api`, openapi-typescript 7.13.0.
`tsc --noEmit -p tsconfig.app.json` y `tsconfig.spec.json`: exit 0 después de generar.
`pnpm --dir frontend run build`: exit 0 después de generar, con advertencias
CommonJS de dependencias existentes (canvg/core-js, entre otras). No se cambiaron
dependencias, configuración, estilos ni Kotlin para obtener ese resultado.

Para repetir integración, crear una instancia propia con el
[verificación reproducible](VERIFICACION.md) y usar
`TTAIP_POSTGRES_URL` con el formato restringido por los fixtures,
`TTAIP_POSTGRES_ARTIFACTS` para la evidencia y los dos opt-ins anteriores. Nunca
apuntar estas suites que truncan datos a una base existente ni ejecutarlas en paralelo
sobre la misma base. No se ejecutó SQL manual en sustitución de Flyway.

Navegador y Android no ejecutados en esta entrega; no se midió paridad visual.
Las herramientas MCP de grafo no estaban disponibles: el análisis fue lectura
directa y búsquedas acotadas, sin afirmar cobertura de grafo.

## Archivos y preservación

Se inventariaron 963 archivos previos: 14 modificados por esta entrega, ninguno
eliminado y las migraciones sin cambios; los otros 949 conservaron su SHA-256.
Los incrementos se revisaron contra copias del estado inicial, además del diff Git,
porque el working tree ya contenía entregas sin commit. Se añaden tres archivos
(este documento, política y prueba R3); la nota local ignorada se actualiza aparte,
con copia previa. No se modificaron las reglas funcionales ni los controles globales.

- Política nueva: [TransicionesApelacionTtaipService](src/main/java/pe/gob/saip/backend/service/TransicionesApelacionTtaipService.java).
- Entradas: [ApelacionRestController](src/main/java/pe/gob/saip/backend/controller/ApelacionRestController.java), [TTAIPRestController](src/main/java/pe/gob/saip/backend/controller/TTAIPRestController.java).
- Coordinación: [TTAIPService](src/main/java/pe/gob/saip/backend/service/TTAIPService.java), [SubsanacionTtaipService](src/main/java/pe/gob/saip/backend/service/SubsanacionTtaipService.java).
- Vencimiento: [excepción](src/main/java/pe/gob/saip/backend/exception/PlazoSubsanacionTtaipVencidoException.java), [scheduler](src/main/java/pe/gob/saip/backend/scheduler/PlazoAlertaScheduler.java), [documentación del reloj](TTAIP_SUBSANACION_PLAZO.md).
- Backend tests: [R3 nuevo](src/test/java/pe/gob/saip/backend/controller/TransicionesTtaipPostgresIntegrationTest.java), [subsanación](src/test/java/pe/gob/saip/backend/controller/SubsanacionTtaipPostgresIntegrationTest.java), [unitarios TTAIP](src/test/java/pe/gob/saip/backend/service/TTAIPServiceTest.java).
- Angular tests: [ApelacionService](../frontend/src/app/services/apelacion.service.spec.ts), [TtaipService](../frontend/src/app/services/ttaip.service.spec.ts).
- Contrato parcial/tipos: [frontend](../frontend/openapi.json), [mobile](../mobile/openapi.json), [schema.ts](../frontend/src/app/api/schema.ts).

Comprobación manual pendiente, en entorno de prueba: requerir subsanación, presentar
como titular y admitir en segunda calificación; comprobar 409 al confirmar sin ambas
eficacias; registrar acuse/validación de cada destinatario de esa admisión y confirmar;
recargar el recurso; completar descargos con la entidad correcta y resolver mediante
el comando específico. Intentar el PATCH genérico y repetir los comandos no debe
crear actuaciones adicionales. No interpretar los metadatos recuperados como firma
verificada, emisión documental formal o fecha legal de inicio del plazo final.
