# Recepción coordinada de respuesta SAIP — 2026-10-23

Esta entrega cubre registro conjunto de respuesta total, parcial o denegatoria y
todos los archivos seleccionados. No acredita entrega de información, eficacia
de una notificación, firma verificada, numeración ni emisión oficial.

## Defecto y regla conservada

El formulario registraba primero la respuesta JSON y después subía documentos en
peticiones independientes. Un fallo de subida dejaba respuesta y estado final
persistidos; la pantalla mantenía confirmación de registro con advertencia parcial.
La prueba Angular RED exige que ese caso no muestre éxito. La caracterización
PostgreSQL reproduce respuesta persistida y cero documentos tras fallar la subida
separada; se conserva para delimitar el contrato anterior.

El historial visible de respuesta se deriva de `sol.respuesta.fechaRespuesta`
(`funcionario-solicitud-detalle.component.ts`, `historialItems`), no de una nueva
actuación de emisión creada aquí. Al revertir desaparecen la respuesta y su estado
final, por lo que no hay evento de respuesta de esta operación para derivar. Las
leyendas previas «Respuesta emitida» de otras vistas no acreditan emisión formal;
su revisión completa permanece separada de esta coordinación.

Las [reglas validadas](../docs/business-rules/SAIP_TTAIP_REGLAS_NEGOCIO.md), apartado
de entrega/respuesta, distinguen entrega total, parcial y denegación. No establecen
adjuntos universalmente obligatorios. Se conservan tipo, causal, fundamento,
formato/plazo y las precondiciones de los comandos anteriores. No se interpreta
registro como prueba de los hechos jurídicos posteriores. El DOCX original no
estuvo accesible; no se afirma su lectura.

## Operación y consistencia

- `POST /api/respuestas/solicitud/{solicitudId}/recepciones`, multipart:
  `claveOperacion` UUID, `tipoRespuesta`, `contenido`; demás campos del DTO y
  `archivos` opcionales. Devuelve 200 tanto al registrar como al recuperar un
  reintento idéntico.
- `GET` de la misma ruta más `/{claveOperacion}` recupera la recepción y su
  manifiesto. Requiere el actor original y su autorización actual sobre el recurso.
- `RespuestaSaipRecepcionService` bloquea/refresca la solicitud y reutiliza los
  comandos de `RespuestaService`, `DocumentoService.subir` y `StorageProvider`.
  Respuesta, estado, recepción y manifiesto participan en la misma transacción JPA.
  Cada documento queda asociado a la respuesta creada, sin aceptar IDs de archivos
  aportados por el cliente. V10 añade recepción y manifiesto; V1–V9 no cambian.
- Huella SHA-256 versionada con campos de longitud prefijada: solicitud, actor
  autenticado, funcionario autorizado, todos los campos y cada archivo ordenado
  (nombre, MIME, tamaño y bytes). Misma clave/huella recupera el resultado; otro
  contenido o clave incompatible devuelve 409. Otra identidad no recupera ni
  suplanta la operación (403). Una clave del actor no se reutiliza en otro recurso.
- Bloqueo de raíz y restricciones únicas evitan dos respuestas/recepciones. Se
  conservan las defensas [R3 SAIP](SAIP_TRANSICIONES.md): estados permitidos y
  ausencia de observación pendiente, con autorización de rol, entidad y recurso.
  La cardinalidad de una respuesta por solicitud ya existe en el modelo.
- Al abortar, la compensación de `DocumentoService` elimina objetos subidos y la
  transacción revierte documentos, respuesta y estado. No hay atomicidad distribuida:
  un fallo de compensación o caída del proceso puede requerir reparación operativa.
  Ante resultado transaccional desconocido no se eliminan objetos que podrían
  pertenecer a un commit válido. No se implementa aquí un reconciliador duradero.
- La consulta comprueba disponibilidad y asociación de cada documento aceptado.
  Archivo perdido tras el commit produce 500, conservando la recepción; no se
  presenta como 404 de operación ausente ni se vuelve a registrar.

Los endpoints JSON previos y la subida independiente conservan sus contratos.
Son registros independientes y no ofrecen la garantía de una selección conjunta
futura. El formulario Angular ya no los encadena. No se migra ni fabrica manifiesto
para respuestas históricas; su recepción coordinada no puede presumirse.

## Angular y consumidores

El formulario guarda únicamente solicitud/clave de operación en `sessionStorage`,
por actor y recurso. Contenido y archivos permanecen en memoria. Envía los bytes
en un solo comando; antes del éxito recupera recepción y solicitud y contrasta IDs,
tipo, estado y manifiesto. La confirmación muestra IDs y documentos del servidor.

Un 4xx rechaza sin éxito ni borrado del formulario. Red, timeout, 5xx o resultado
incoherente obligan a consultar; un error de consulta no prueba ausencia. Un 404
permite reintento explícito con la misma clave/contenido, que el backend serializa
incluso si el primer envío seguía en curso. Tras recarga se recupera por clave; si
no hay recepción se deben volver a seleccionar los archivos originales. Cambiar
campos o bytes de una operación ya aceptada genera conflicto. Las respuestas
tardías y la continuación de reintentos se descartan al cambiar recurso, generación,
sesión o destruir el componente. Los adjuntos siguen opcionales en validación y UI.

Revisión Android estática: `SolicitudRestDataSource.responderSolicitud` usa
`RespuestaApiService.crear` (`POST api/respuestas` JSON); `DocumentoApiService`
mantiene subida independiente. Rutas/estructuras anteriores y Bearer no cambian,
pero Android necesita integrar multipart, clave y recuperación para la nueva
garantía. No se modificó Kotlin ni se probó Android. Siguen las incompatibilidades
anteriores de subsanación y los pendientes de logout móvil.

## Contrato y evidencia reproducible

El contrato completo se captura por HTTP de Spring con PostgreSQL/Flyway/validate,
fuera de los snapshots. Solo se incorporan dos rutas y dos schemas nuevos; se
comparan también referencias transitivas, requeridos, tipos, respuestas y Bearer.
Los snapshots siguen siendo parciales: no se declara sincronización global.

Captura final: **165 rutas/97 schemas**; cada snapshot: **163/91**. El cierre de
referencias de esta extensión coincide: `RegistrarRespuestaSaipRequest`,
`RespuestaSaipRecepcionDTO`, `RespuestaDTO`, `DocumentoDTO`, `DocumentoMetadataDTO`
y `ProblemDetail`, junto con el esquema Bearer. Se corrigió la anotación del cuerpo
multipart requerido y se marcaron los seis campos siempre presentes de la recepción.
Solo clave/tipo/contenido son requeridos de entrada; `archivos` es array binario
opcional. El servidor valida restricciones de texto aunque no sean expresables por
completo en OpenAPI (por ejemplo, `NotBlank`).

Deriva previa preservada: faltan `/api/configuracion` y
`/api/estadisticas/actividad-reciente`, más seis schemas (configuración, actividad y
`ActualizarUsuarioAdminRequest`); difieren ocho rutas (usuarios/solicitudes/
funcionarios/entidades/ciudadanos/apelaciones por ID y auth registro/login) y tres
schemas (`UsuarioAdminDTO`, `CrearUsuarioAdminRequest`, `RegistroRequestDTO`).
La comparación contra los snapshots guardados al inicio demuestra que ninguna ruta
o schema anterior se sobrescribió. El contrato íntegro permanece en la evidencia
temporal; no se incorporó como supuesta sincronización global.

Desde `backend/`, después de preparar una base propia según el
[verificación reproducible](VERIFICACION.md):

```powershell
$env:RUN_RESPUESTA_POSTGRES_TESTS='true'
$env:RESPUESTA_POSTGRES_URL=$urlTemporalPropia
$env:RESPUESTA_POSTGRES_ARTIFACTS=$directorioEvidenciaExistente
./mvnw.cmd -o '-Dtest=RespuestaSaipRecepcionPostgresIntegrationTest' test
```

El fixture exige URL loopback `yaiku_e11_closeout_<32 hex>`, usuario sintético
`yaiku_e11_test`; puede truncar tablas. Nunca usar una BD existente del usuario.
`-o` requiere caché Maven. Las otras suites/opt-ins están en
[verificación reproducible](VERIFICACION.md); no ejecutarlas en paralelo sobre la misma BD.

Los 27 casos nuevos usan autenticación real, filtro, autorización, JPA, transacciones,
PostgreSQL y LOCAL reales. Comprueban tres tipos con/sin adjuntos, descarga con
bytes/hash, asociaciones, huellas incompatibles, actor/recurso ajeno, estados y
observación pendiente, reintentos y conexiones independientes concurrentes.
Un fallo físico durante el segundo archivo y un trigger sintético de rechazo SQL
comprueban rollback/compensación. Un filtro exclusivo de test pierde la confirmación
después del commit: simula el fallo de transporte, no un corte TCP real. Los proveedores
externos de notificación usan MOCK y push está desactivado. No se mockean JPA,
seguridad ni almacenamiento de esta suite.

Las pruebas Angular usan mocks de servicios/HTTP, no persistencia ni navegador.
Además del defecto inicial, una prueba RED detectó un segundo POST de reintento
tras cambiar sesión durante la consulta; la comprobación de vigencia lo impide.
Los resultados finales y límites se registran en [verificación reproducible](VERIFICACION.md).

Ejecución completa backend: `./mvnw.cmd -o test`, con opt-ins de esta recepción,
R3 SAIP y E1.1 apuntando a la misma base propia de forma serial: **434 casos, 344
aprobados, 90 omitidos, cero fallos/errores**. Incluye los 27 nuevos, 36 R3 y 19 E1.1
reales. Una ejecución anterior focalizada de 18 casos no se suma. Tras cambios solo
en documentación OpenAPI/expectativas Flyway se ejecutaron tres métodos de
configuración/subsanación/cumplimiento y la recaptura focalizada final de esta suite;
pasaron, pero no son una segunda suite backend completa.

Angular: `pnpm --dir frontend test --watch=false`, suite completa final **514/514**,
39 archivos. Después se ajustaron los indicadores visuales de adjuntos opcionales
y se regeneraron tipos; tipos/build se ejecutaron sobre ese estado final. Se
conserva evidencia RED del fallo original (1 fallo/16 aprobados) y
del reintento cruzado de sesión (1 fallo/34 aprobados); no son fallos pendientes ni
se agregan a la cuenta final. `generate:api`, `tsc --noEmit` para app y spec y build
se verifican sobre tipos generados del fragmento real. Los comandos pnpm de esta
sesión usan `--config.manage-package-manager-versions=false --config.auto-install=false`:
versión disponible 11.25 frente a declarada 12.3.4, sin instalar ni cambiar manifiestos.

## Archivos propios y preservación

Se guardó inventario SHA-256 de 1304 archivos y copias de originales afectados,
además del diff/estado iniciales. Esta entrega no atribuye todo el diff contra HEAD
a su implementación. Cambios propios:

- Nuevos: controlador/servicio/repositorio `RespuestaSaipRecepcion*`, entidad
  `RespuestaSaipRecepcion`, DTO `RegistrarRespuestaSaipRequest` y
  `RespuestaSaipRecepcionDTO`, V10 y `RespuestaSaipRecepcionPostgresIntegrationTest`.
- Modificados: `funcionario-responder.component.ts/.html/.spec.ts`,
  `services/respuesta.service.ts/.spec.ts`, ambos `openapi.json` y
  `frontend/src/app/api/schema.ts` generado.
- Las cuatro suites opt-in de precisión, configuración, subsanación y cumplimiento
  solo actualizan la expectativa de historial de nueve a diez migraciones.
- Este informe y la guía pública de verificación.

Se mantienen los servicios/controladores anteriores de respuesta, las defensas R3,
E1.1, JWT/logout, decimal y V1–V9 tal como estaban al inicio. Sin dependencias,
configuración global, staging, commits, push, merge ni despliegue.

## Comprobación manual pendiente

1. Iniciar una instancia aislada y acceder como funcionario de la entidad de una
   solicitud en estado permitido y sin observación pendiente.
2. Registrar respuesta total, parcial o denegatoria con archivos conocidos; comprobar
   IDs de recepción/respuesta, recargar el detalle y descargar comparando bytes/hash.
3. Interrumpir la confirmación del POST; usar «Comprobar recepción», sin generar una
   clave nueva. Si no se confirmó recepción, reintentar el mismo contenido.
4. Simular fallo de almacenamiento: comprobar ausencia de éxito, conservación del
   formulario y ausencia de escrituras parciales. Cambiar recurso o sesión durante
   una consulta no debe repoblar el anterior ni reenviar su intento.

No se ejecutó navegador en esta entrega ni se midió paridad visual. Emisión formal,
firma, numeración, encauzamiento y liquidaciones quedan fuera del alcance.
