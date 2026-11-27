# Recepción coordinada de nueva SAIP

## Brecha reproducida y alcance

La ruta Angular `/ciudadano/nueva-saip` creaba primero la solicitud JSON y después
subía cada archivo por separado. La caracterización con seguridad, JPA y PostgreSQL
reales conserva una solicitud y cero documentos tras rechazar una subida. La UI
ya advertía ese resultado parcial; eso no daba una garantía de registro conjunto.
Los cuatro pasos, accesos, modalidades, canales y adjuntos opcionales se conservan.

Las reglas de [presentación](../docs/business-rules/SAIP_TTAIP_REGLAS_NEGOCIO.md)
exigen consentimiento y declaración de veracidad. La nueva operación verifica ambos
y conserva esta última en la recepción; no la presenta como firma. La identidad
proviene del ciudadano autenticado, sin aceptar titularidad aportada por el cliente.
La entidad debe existir y seguir activa, conforme al catálogo utilizado por la UI.
No se cambia el calendario, duración, formato de expediente o estado inicial.

## Contrato aditivo

- `POST /api/solicitudes/recepciones`, multipart, devuelve 200: clave UUID, entidad,
  asunto, descripción, tipo de información opcional, cuatro indicadores de modalidad,
  consentimiento, declaración de veracidad, canal y archivos opcionales. Cada archivo
  tiene su `tiposDocumento` en el mismo orden (`SOLICITUD_ORIGINAL` o
  `DOCUMENTO_ADJUNTO`). No admite IDs de documentos, rutas, estado, fechas ni identidad.
- `GET /api/solicitudes/recepciones/{claveOperacion}` recupera la recepción sin
  volver a crear solicitud o documentos. Solo el ciudadano original puede consultarla
  o repetirla, incluso si otro actor conoce la clave. No hay excepción administrativa
  en esta nueva ruta; la presentación SAIP por administrador mediante JSON previo
  mantiene sus reglas.
- `AltaSaipRecepcionDTO` contiene ID/clave/fecha/declaración, solicitud autorizada y
  manifiesto exacto de metadatos. No expone huella interna ni claves de almacenamiento.
  La solicitud anidada refleja el recurso actual: idempotencia preserva IDs de recepción,
  solicitud y manifiesto; no congela todos los campos mutables del expediente.
- 400 rechaza campos/archivos inválidos; 401/403 conservan seguridad; 404 indica entidad
  o recepción no encontrada; 409 indica conflicto de contenido, persistencia o entidad
  inactiva; 500 no acredita ausencia. Un archivo aceptado retirado o perdido produce
  error, nunca una invitación a crear otra solicitud.

Los endpoints JSON y de subida independiente siguen disponibles con sus garantías
anteriores: no conocen la selección conjunta ni son idempotentes por esta clave.
Los snapshots incorporan solo las dos rutas y los dos esquemas nuevos desde Spring
validado, contrastando sus referencias transitivas; no se sincroniza toda la deriva.
Los tipos Angular se generan desde esa extensión parcial.

## Transacción, huella y concurrencia

V11 añade recepción y manifiesto sin modificar migraciones publicadas ni reconstruir
históricos. `AltaSaipRecepcionService` coordina `SolicitudService.save`, documentos y
recepción en una transacción. Reutiliza `DocumentoService`, validación de almacenamiento
y compensación. Persisten todos los archivos seleccionados o se rechaza el conjunto.
La huella SHA-256 `saip:alta:v1:` usa campos de longitud prefijada: identidad estable,
campos normalizados, consentimientos, modalidades, canal y cada archivo ordenado
(tipo, nombre, MIME, tamaño y hash de bytes). Se comprueba también que los bytes
almacenados coincidan con los leídos para la huella. Otra huella con la misma clave
produce conflicto. Otra clave representa otra operación, aunque coincida el asunto.

Una prueba adicional reprodujo la colisión de `max+1` con dos altas JSON concurrentes
(201/409). La asignación conserva su fórmula y formato, pero se serializa mediante
un advisory lock transaccional PostgreSQL compartido por alta legacy y coordinada.
La nueva operación toma ese mismo bloqueo antes de consultar la clave. Restricciones
únicas refuerzan clave global, solicitud y asociación documental. No se introduce un
segundo mecanismo de exclusión ni un contador con nuevas reglas de numeración.
El bloqueo dura hasta commit/rollback, incluyendo almacenamiento: serializa las altas
y puede añadir espera; no implica disponibilidad ilimitada. H2/mocks no demuestran
esa exclusión, que se comprueba con conexiones PostgreSQL independientes.

## Efectos y límites

La ruta de alta revisada (`SolicitudRestController.crear` → `SolicitudService.save`
→ `Solicitud.onCreate`) no envía automáticamente notificaciones ni escribe un historial
SAIP independiente. Se conserva ese comportamiento: no se inventa un aviso o una
actuación para este alta. Las fechas/estado persistidos alimentan consultas posteriores.
Las pruebas verifican cero intentos de notificación tanto en rollback como en reintento.
No se confunde guardar el canal elegido con notificación eficaz.

PostgreSQL y almacenamiento no son atómicos. La compensación existente elimina los
objetos de esta operación tras rollback conocido y conserva objetos tras commit o
resultado transaccional desconocido. Se comprueba rollback por subida fallida y por
rechazo de persistencia después de subir, con cero registros/objetos atribuibles.
También se prueba un fallo de compensación: queda un residuo físico aunque la BD
revierte; no se afirma que fue eliminado. Caída del proceso, commit verdaderamente
indeterminado o compensación fallida pueden exigir reparación operativa. No se añade
un reconciliador duradero. La prueba de `STATUS_UNKNOWN` es unitaria con mocks;
la pérdida de confirmación después de commit se prueba sobre la persistencia real.

## Angular y consumidores

Angular envía un único multipart y confirma solo después de recuperar por la misma
clave una recepción compatible con actor, contenido, solicitud y todos sus documentos.
Si el POST aportó un ID, el GET debe conservarlo y conservar el manifiesto. No hace
búsquedas por asunto, fecha o nombres. Ante red/5xx/timeout mantiene incertidumbre;
solo un GET 404 habilita un reintento explícito con la misma clave y contenido. Ese
404 no descarta una operación en curso; el servidor serializa y resuelve la repetición.
Un error de consulta no habilita reenvíos. Un rechazo conserva el formulario.

Pedido, clave y archivos quedan en memoria, sin nuevas copias de contenido personal
en almacenamiento del navegador. Cambiar sesión o destruir el formulario cancela
esperas y descarta continuaciones; no revierte un commit del servidor. Recargar pierde
esa preparación y no restaura archivos: la interfaz pide comprobar antes de abandonar
y conservar la clave si hace falta consultar después. No ofrece recuperación automática
universal tras perder también esa clave. Un nuevo UUID no deduplica por contenido.

La revisión estática de `SolicitudApiService` y `SolicitudRepositoryImpl` Android
encuentra alta JSON y sincronización offline anteriores, sin esta operación/recuperación.
Kotlin no cambia: incorporar recepción y claves duraderas en ese consumidor sigue
pendiente; no se afirma compatibilidad ejecutada ni se equipara alta local con recepción.

## Verificación reproducible

En una base nueva propia, con el patrón/usuario de las fixtures descritos en las
notas locales, usar `RUN_ALTA_SAIP_POSTGRES_TESTS=true`, `ALTA_SAIP_POSTGRES_URL` y
`ALTA_SAIP_POSTGRES_ARTIFACTS`; ejecutar `./mvnw.cmd -o test` solo con caché suficiente.
La suite arranca Spring completo, Flyway original y `ddl-auto=validate`, LOCAL,
notificaciones MOCK y push deshabilitado. No se puede apuntar a una base existente:
las fixtures verifican URL de pruebas y truncan datos sintéticos.

Pruebas Angular: HTTP simulado/jsdom, tipos app/spec y build con environment original.
Navegador, Android, alta de apelaciones, plazos legales y reparación duradera de
almacenamiento siguen siendo entregas separadas. No hay emisión formal ni firma.
