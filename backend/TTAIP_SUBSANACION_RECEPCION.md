# Recepción de subsanaciones TTAIP

La pantalla de subsanación utiliza una recepción persistente por resolución de
primera calificación `INADMISIBLE`. V8 añade la recepción y sus documentos; no
modifica migraciones anteriores. La unicidad corresponde al requerimiento
concreto, no a toda la apelación. Una actuación posterior con otro requerimiento
puede tener su propia recepción. El reproceso de notificaciones conserva su flujo
independiente.

## Regla documental y plazos

Los fundamentos son obligatorios. Los adjuntos siguen siendo opcionales: todos
los seleccionados deben almacenarse correctamente para confirmar. Las
observaciones son texto libre; el modelo no expresa exigencias documentales
estructuradas y no se infieren anexos obligatorios de ese texto. Esta limitación
queda explícita en `exigenciasDocumentalesEstructuradas=false`.

Se conservan estado `EN_SUBSANACION`, calificación vigente inadmisible,
duración configurada (`diasSubsanacion` o dos días) y calendario `DiasHabilesUtil`.
La entrega de dominio posterior corrige el inicio: solo la notificación eficaz
acreditada del requerimiento al recurrente inicia el plazo. Sin evidencia, el
plazo permanece pendiente de inicio y no impide por sí mismo presentar una
subsanación ya habilitada. No se usa `Apelacion.fechaSubsanacion` como reloj.
Véase [Plazo de subsanación TTAIP](TTAIP_SUBSANACION_PLAZO.md) para evidencia,
históricos, reenvíos y alcance del contrato. El rechazo por vencimiento conserva
el cierre existente `TENER_POR_NO_PRESENTADO`; no confirma una presentación.

## API compatible

Se conservan Bearer, las respuestas de autenticación y el endpoint JSON
`POST /api/apelaciones/{id}/subsanacion`. Su contrato de fundamentos y respuesta
`ApelacionDTO` continúa disponible para consumidores JSON existentes. Ahora registra
una recepción de texto sin adjuntos, con clave determinista generada por el
servidor para el mismo requerimiento y texto. Los clientes que suban archivos por
separado deben integrar la nueva operación para obtener recepción conjunta.

Extensión autenticada:

| Método y ruta, bajo `/api/apelaciones/{apelacionId}/subsanacion` | Uso |
| --- | --- |
| `GET /requerimiento` | Identidad y condiciones actuales del requerimiento |
| `POST /{requerimientoId}/recepcion` | Multipart: `claveOperacion` UUID, `fundamentosAdicionales` y cero o más partes `archivos` con bytes |
| `GET /{requerimientoId}/recepcion/{claveOperacion}` | Recuperación y comprobación de una operación |

La recepción incluye su ID, apelación, requerimiento, expediente, clave, fecha,
fundamentos, estado `RECIBIDA` y metadatos reales de los documentos. Se reutilizan
las descargas autorizadas de `DocumentoService`. No se admiten IDs de documentos
existentes ni una identidad de actor enviada por el cliente. Se mantiene la
autorización del ciudadano titular o administrador del endpoint anterior.

Una operación idéntica devuelve la misma recepción, incluso después de avanzar
el trámite o vencer el plazo. Otra clave o contenido para un requerimiento ya
recibido produce `409`. La huella incluye fundamentos normalizados, orden,
nombre, tipo, tamaño y SHA-256 de cada archivo. Cambiar el contenido durante un
reintento no modifica la recepción anterior.

## Fallos y concurrencia

El servicio bloquea la apelación en PostgreSQL y refresca su estado antes de
recibir. Las restricciones únicas protegen requerimiento, clave y asociación de
documentos. Texto, estado, historial, documentos y recepción participan en la
misma transacción JPA; la respuesta de éxito sale después del commit.

El almacenamiento no participa en una transacción distribuida. Cada subida usa
la compensación existente de `DocumentoService`: ante rollback conocido se
eliminan los archivos ya subidos. Un fallo físico o de persistencia no produce
una recepción satisfactoria. La consulta comprueba también la disponibilidad
física; un error de almacenamiento no se interpreta como recepción ausente.

Persisten los límites del mecanismo existente: caída del proceso entre subida y
commit, fallo al borrar o resultado transaccional desconocido pueden requerir
reconciliación de archivos huérfanos. No se ha implementado una cola duradera de
compensación ni se promete atomicidad PostgreSQL/almacenamiento.

Angular conserva la clave y el número de adjuntos en `sessionStorage`, sin texto,
bytes ni JWT. Conserva el formulario en memoria ante fallos. Después de timeout,
red, error de servidor o conflicto consulta primero la recepción; solo una
consulta `404` permite reenviar con la misma clave. Si la consulta falla, mantiene
el resultado incierto. Un conflicto sin recepción confirmada se muestra como
rechazo y exige actualizar la consulta, sin repetir automáticamente el POST.
Tras recargar se comprueba la operación guardada antes de
reenviar; si no existe, deben seleccionarse de nuevo los archivos originales.
La huella del servidor impide aceptar contenido distinto bajo la misma clave.
El cambio de expediente o sesión cancela consultas y descarta respuestas tardías.

## Contrato y consumidores

La entrega de recepción incorporó las tres rutas anteriores, sus tres esquemas
nuevos y referencias transitivas verificadas. La entrega posterior del plazo amplía
los DTO del reloj y de evidencia según el alcance exacto documentado en
[TTAIP_SUBSANACION_PLAZO.md](TTAIP_SUBSANACION_PLAZO.md). Los tipos Angular se generan
desde esa extensión del contrato real. No es una sincronización completa del
backend: siguen fuera de los snapshots `/api/configuracion`,
`/api/estadisticas/actividad-reciente` y seis esquemas de configuración,
administración y actividad. Se conservan las diferencias previas en ocho rutas
de actualización y autenticación.

No se modifica Kotlin. La revisión estática encontró una incompatibilidad previa:
`ApelacionApiService.presentarSubsanacion` envía multipart al endpoint anterior,
con partes `fundamentos` y `archivo`; el backend anterior ya esperaba JSON con
`fundamentosAdicionales`. `ApelacionRestDataSource` construye esas mismas partes,
y sus pruebas sustituyen Retrofit por mocks. Conservar el contrato JSON no
demuestra que ese flujo Android funcione. Android necesita integrar la extensión
multipart y la consulta de recepción; esta entrega no declara verificada su
presentación ni corrige Kotlin.

## Consulta institucional del requerimiento (extensión 2026-10-28)

`GET /api/ttaip/expedientes/{expedienteId}/requerimientos/{requerimientoId}/subsanacion/recepcion`
es una lectura transaccional para TTAIP/administrador, conforme a la autorización
institucional vigente. No introduce competencias por sala ni habilita funcionarios
o ciudadanos en esta ruta. Comprueba agregado, apelación, requerimiento de primera
calificación INADMISIBLE y asociaciones exclusivas de sus documentos. No crea
expedientes, recepciones, actuaciones, evidencias ni fechas históricas.

La respuesta `ConsultaRecepcionSubsanacionTtaipDTO` contiene IDs de expediente,
apelación y requerimiento, código de expediente y estado `AUSENTE` o `RECIBIDA`.
Incluye ID/fecha/fundamentos de recepción (nulos cuando está ausente) y metadatos
documentales seguros. No devuelve clave de operación, huella interna ni rutas de
almacenamiento. Cero archivos es válido para una recepción recibida. La descarga
sigue usando `/api/documentos/{id}/download` y su autorización existente.

Solo un 200 `AUSENTE` confirma ausencia para un requerimiento válido: 404 indica
recurso inexistente o relación ajena; 409, actuación/relaciones incompatibles;
500, fallo de consulta o almacenamiento. Un archivo retirado o físicamente ausente
no transforma una recepción persistida en ausencia. 401/403 mantienen sus controles.
La recuperación ciudadana con clave conserva sus reglas de titular/admin; esta
extensión no permite al Tribunal usarla ni conocer su clave.

Segunda calificación consulta esta recepción antes de ofrecer los comandos
existentes admitir/inadmitir. Solo confirma con ID devuelto y GET compatible.
Sin ID tras una respuesta perdida, consulta actuaciones sin atribuirlas por texto
y bloquea otra escritura. Resolución final utiliza la misma lectura en el recorrido
de segunda admisión, conservando ambas evidencias de eficacia y descargos, miembro
de sesión y demás precondiciones. No se modifica la fecha base final pendiente,
el reloj de subsanación, la recepción coordinada o las defensas transaccionales.

Los snapshots incorporan únicamente esta ruta y su DTO desde el contrato real;
`DocumentoMetadataDTO` y `ProblemDetail` se contrastan como referencias transitivas.
No es sincronización global. Android conserva comandos existentes, pero aún no
implementa esta consulta institucional. Su discrepancia multipart de subsanación
descrita arriba sigue pendiente; no se modifica Kotlin ni se declara compatibilidad
ejecutada. Las pruebas de lectura/transiciones con PostgreSQL/LOCAL son distintas
de HttpTesting/jsdom Angular y de una comprobación de navegador pendiente.

## Comprobación manual pendiente

1. En un entorno de pruebas con Flyway y LOCAL, iniciar sesión como titular de una
   apelación en `EN_SUBSANACION`, con primera calificación `INADMISIBLE` vigente.
2. Abrir subsanación, introducir fundamentos y seleccionar dos archivos válidos.
   Enviar y comprobar que hay un único POST multipart con el requerimiento
   consultado y ambos archivos. La confirmación debe mostrar el ID del servidor.
3. Recargar la misma pestaña. Comprobar el GET de recepción y descargar ambos
   archivos; comparar sus bytes/SHA-256 con los originales.
4. Cortar la conexión después de enviar. Comprobar que aparece resultado incierto
   y que se consulta la recepción antes de repetir el POST. Un reintento idéntico
   debe conservar ID, documentos e historial.
5. Provocar un fallo de almacenamiento en el entorno aislado: no debe aparecer
   confirmación; el formulario debe conservarse y el estado no debe avanzar.
6. Cambiar de expediente y de sesión durante un envío. Ninguna respuesta tardía
   debe mostrar datos de la apelación o sesión anterior. Con otro ciudadano, las
   operaciones y descargas deben ser rechazadas.
