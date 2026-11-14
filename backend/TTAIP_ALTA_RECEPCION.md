# Alta coordinada de apelaciones

## Brecha y modalidades

AppealForm creaba primero la apelación y luego subía o clonaba sus documentos.
Una prueba con JWT, PostgreSQL y LOCAL conserva una apelación, un expediente y su
historial de apertura después de rechazar la subida posterior. Advertir un registro
parcial en Angular no resolvía esa inconsistencia. También se reprodujo por unidad
que `DocumentoService.clonar` no compensaba una copia ante rollback posterior.

La operación nueva conserva las [reglas disponibles](../docs/business-rules/SAIP_TTAIP_REGLAS_NEGOCIO.md),
los fundamentos, identidad, requisitos documentales y las diferencias existentes:

| Modalidad | Datos y documentos | Efecto persistente del alta |
| --- | --- | --- |
| `DIRECTA_TTAIP` | SAIP del ciudadano, fundamentos no vacíos, copia de solicitud y respuesta cuando existe; recurso adicional opcional | `EN_CALIFICACION_1`, expediente TTAIP e historial de apertura |
| `ANTE_ENTIDAD` | Misma procedencia documental; fundamentos hasta 5000, fecha real no futura, referencia de cargo y observación opcional | `PENDIENTE_ELEVACION`, número reservado y elevación pendiente con trazabilidad; no abre expediente TTAIP |
| `EXTERNA` | Sin SAIP local; entidad del catálogo o declarada, número/fecha/resumen/referencia de solicitud y fundamentos hasta 5000. Expresa requiere fecha y resumen o referencia de respuesta; tácita requiere sustento declarado | `EN_CALIFICACION_1`, expediente e historial de apertura; archivos opcionales, sin SAIP ficticia |

Las copias pueden proceder de bytes nuevos o antecedentes autorizados en la SAIP y
su respuesta concreta. No se impone un mínimo universal de 50 caracteres, tres
archivos obligatorios ni un calendario de apelación nuevo. La discrepancia legal
documentada de días hábiles/calendario y la elegibilidad general quedan separadas.
No se añade una declaración de consentimiento que el contrato de apelación no
contiene ni se alteran los datos de consentimiento de la SAIP original.

## Contrato aditivo

- `POST /api/apelaciones/recepciones`: multipart con parte `datos` JSON y cero o más
  partes `archivos`. `datos` contiene UUID, modalidad, campos propios y manifiesto
  ordenado. Cada entrada sin `origenId` consume el siguiente archivo; con origen
  exige ID y SHA-256 de la versión seleccionada. Devuelve 200 para alta o repetición.
  Una apelación vinculada puede copiar varios documentos de la solicitud
  (`SOLICITUD_ORIGINAL`, `DOCUMENTO_ADJUNTO`) y de su respuesta (`RESPUESTA_ENTIDAD`).
  Cada copia conserva su tipo y se vincula a la apelación; un anexo no cubre el
  requisito de la copia de la solicitud original.
- `GET /api/apelaciones/recepciones/{claveOperacion}`: consulta sin escrituras,
  restringida al ciudadano original. No hay excepción administrativa en estas rutas.
- La recepción contiene ID, UUID, modalidad, fecha persistida, apelación autorizada
  actual y documentos con ID propio, `origenId` nullable y `hashAceptado`. No expone
  huella interna ni rutas/claves de almacenamiento.
- 400 rechaza entradas inválidas o campos ajenos; 401/403 conservan autenticación y
  autorización; 404 no descarta una operación en curso; 409 rechaza incompatibilidad
  de clave/contenido, versión, asociación o recurso; 422 conserva el rechazo de
  negocio existente (por ejemplo, tácita sin sustento). Un archivo aceptado perdido
  produce error, no recepción ausente ni recreación.

La identidad procede del JWT. No se admiten ciudadano, estado, expediente, fechas
de alta, sesión ni asociaciones documentales arbitrarias como atributos de entrada.
Los endpoints JSON previos y los comandos posteriores permanecen: no conocen esta
clave ni la selección conjunta, y no adquieren idempotencia documental retroactiva.
Android todavía usa esos contratos; su revisión es estática, sin Kotlin modificado.

## Seguimiento de la primera calificación

Los listados `/api/panel/solicitudes` y `/api/panel/apelaciones` pueden informar
`plazoPrimeraCalificacion` con `diasRestantes` y `vencido`. Se muestra únicamente
mientras está pendiente la primera calificación y consta el ingreso al Tribunal:
recepción directa o externa, remisión registrada por la entidad o apertura por
admisión excepcional acreditada. El Mapa Integral (página numerada 4) fija siete
días hábiles. Se excluye el día de recepción y se cuenta el último día permitido,
con el calendario y la fecha de Lima que usa el backend. Los registros históricos
sin esos datos, los pendientes de remisión y los que ya tienen una calificación
omiten el campo. El contador es de seguimiento y no cambia etapas ni fechas.

La extensión es aditiva. Los snapshots históricos no contienen las rutas del panel;
el contrato de esta consulta se comprueba en el OpenAPI de Spring y se consume
mediante el modelo específico del panel Angular.

## Huella, procedencia y transacción

V12 añade tablas de recepción y manifiesto; no modifica ni reconstruye históricos.
La huella SHA-256 `ttaip:alta:v1` delimita campos con longitudes e incluye actor,
modalidad/datos y documentos ordenados. Un archivo nuevo aporta tipo, nombre, MIME,
tamaño y hash real; un antecedente aporta tipo, ID y hash de la versión seleccionada.
Misma clave/actor/contenido recupera IDs y manifiesto; otra huella produce conflicto,
otro actor recibe 403. Otro UUID es otra operación, sin deduplicación por texto.

Antes de copiar se bloquea la SAIP y se comprueba titularidad y relación exclusiva
del antecedente: solicitud original de esa SAIP o respuesta de esa misma solicitud.
No basta con conocer un ID accesible de otro expediente. Se comprueba la versión
declarada y el hash/tamaño de los bytes realmente copiados. La copia recibe ID y
objeto propios; origen y hash aceptado quedan persistidos. Un reintento confirmado
no vuelve a copiar ni depende de una versión futura del original.

Un advisory lock PostgreSQL transaccional compartido por altas nuevas y numeración
legacy serializa la consulta de clave y asignación existente `count+1`. Conserva
formato y fórmula; se mantiene hasta commit/rollback, incluyendo documentos, por lo
que puede añadir espera. Las restricciones únicas refuerzan operación, apelación y
documentos. H2/mocks no demuestran ese bloqueo. La SAIP se bloquea antes de validar
sus relaciones para coordinar con los escritores que usan el mecanismo existente.

Creación, elevación/expediente, historial, documentos y recepción participan en la
misma transacción JPA. Se recarga el resultado tras flush para devolver precisión
temporal y colecciones persistidas, incluido el historial real. El reintento no
repite apertura, trazabilidad ni archivos. El recorrido revisado no envía avisos
automáticos de alta: no se inventan notificaciones ni eficacia.

## Almacenamiento y resultados inciertos

No existe atomicidad distribuida. Se reutiliza `DocumentoService`/`StorageProvider`;
subidas y clones registran la compensación de sus objetos antes de cerrar el stream.
Un rollback confirmado elimina las copias de la operación, nunca el antecedente.
Commit o resultado transaccional desconocido conservan objetos para recuperación.
Si falla una compensación o cae el proceso puede quedar un residuo que requiere
reparación operativa; no se implementa aquí un reconciliador duradero.

La pérdida de confirmación después de commit se prueba mediante fallo de transporte
inyectado tras la transacción sobre persistencia real. `STATUS_UNKNOWN` se comprueba
por unidad con mocks: no equivale a simular un commit indeterminado o caída real.

Angular conserva presentación, revisión y diálogos. Envía un multipart, comprueba
actor/modalidad/recurso/procedencia/manifiesto y confirma solo con GET compatible.
El nombre de un archivo nuevo puede ser normalizado por almacenamiento: se muestra
el metadato del servidor, sin usar el nombre como identidad de la operación o copia.
Si POST proporcionó IDs, GET y reintento deben conservarlos. Ante red/5xx/timeout
consulta por UUID; solo GET 404 permite reintento explícito de la misma preparación.
Ese 404 no prueba rollback: el backend resuelve una operación todavía en curso.
No hay reenvío automático, búsqueda por texto ni reemplazo silencioso de clave.

Formulario, clave y archivos quedan solo en memoria. Recargar no los restaura;
conservar una clave perdida o recuperar cualquier envío tras recarga no está
garantizado. Cambiar sesión, origen o destruir cancela esperas y descarta respuestas,
sin afirmar que cancelar HTTP revierta un commit del servidor.

## Verificación y límites

La suite opt-in `AltaApelacionRecepcionPostgresIntegrationTest` requiere
`RUN_ALTA_APELACION_POSTGRES_TESTS=true`, `ALTA_APELACION_POSTGRES_URL` y directorio
opcional `ALTA_APELACION_POSTGRES_ARTIFACTS`. Verifica URL/usuario de pruebas antes
de truncar datos sintéticos. Ejecutar `./mvnw.cmd -o test` solo con dependencias en
caché, PostgreSQL temporal propio, Flyway original, `ddl-auto=validate`, LOCAL y
proveedores MOCK/push apagado. Nunca apuntar las fixtures a bases del usuario.

El contrato completo se captura de Spring validado y se extienden selectivamente
los snapshots y tipos necesarios. No implica sincronización de la deriva previa.
Angular se verifica con HttpTesting/jsdom, suite general, tipos app/spec y build;
eso no prueba autorizaciones reales ni paridad visual. Navegador, revisión visual
de cierre, Android, calendarios y reparación duradera siguen separados.

Resultados de esta entrega (ejecuciones separadas; no sumar reejecuciones):

| Comprobación | Resultado y alcance |
| --- | --- |
| `./mvnw.cmd -o test` con opt-ins de alta de apelación/SAIP, precisión, respuesta y transiciones TTAIP | 536 programadas: 433 aprobadas, 103 omitidas por opt-in, cero fallos. Incluye 36 nuevas altas de apelación, 40 altas SAIP, 19 precisiones, 27 respuestas y 42 transiciones TTAIP con PostgreSQL/LOCAL; el resto mezcla H2/mocks |
| Verificación posterior del candidato final | 56/56: 37 casos de alta PostgreSQL/LOCAL, 16 unidades de `ApelacionService` y tres checks PostgreSQL de esquema/contrato (configuración, cumplimiento y JWT). Cubre las precisiones finales de anotaciones OpenAPI, inyección de EntityManager y nombre normalizado; no constituye otra suite backend general |
| `-Dtest=SubsanacionTtaipPostgresIntegrationTest` con su opt-in | 29/29 en otra base propia nueva. Se actualiza únicamente la expectativa de historial a V1–V12; V10 ya estaba desfasada con V11. Reglas, reloj y recepción permanecen |
| Angular general con environment original | 1695/1695, 63 archivos; incluye 80 casos del formulario. HttpTesting/jsdom, sin navegador |
| Tipos app/spec y build | Correctos. El primer build falló al recuperar fuentes externas; una comprobación con el mismo cliente/cabecera devolvió 200 y el reintento del comando original pasó, sin cambiar configuración |

La extensión contractual contiene exactamente dos rutas y cuatro esquemas nuevos;
se contrastan sus 21 esquemas transitivos y la autenticación con la captura real.
Los snapshots anteriores fuera de esa extensión se conservan. Las pruebas se
ejecutaron en una copia limpia con las fuentes propias, preservando los artefactos
locales preexistentes del repositorio. El historial Flyway y los checksums originales
se comprobaron, sin reemplazar migraciones por SQL manual.
