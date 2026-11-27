# R3: transiciones SAIP — entrega local 2026-10-23

Alcance: entradas que cambian el estado de primera instancia y sus consumidores
directos. Se comparó contra un inventario SHA-256 inicial de 974 archivos del
working tree, incluidas modificaciones y archivos nuevos anteriores, no solo HEAD.
Rama `daniel/feat-public-portal-and-registro-alignment`, HEAD
`e00b68e8cb935deb801ca80ac9ffdf111ed02cad`. Sin staging ni operaciones de publicación.

## Fuentes y matriz

Autoridad disponible: [reglas SAIP](../docs/business-rules/SAIP_TTAIP_REGLAS_NEGOCIO.md),
secciones Presentación, Observación/subsanación, Ampliación, Encauzamiento,
Entrega física/digital y Tipos/estados SAIP (líneas 109–199);
[brechas](../docs/business-rules/SAIP_TTAIP_BRECHAS.md). El DOCX original no estuvo
accesible. No se importan las condiciones de resolución/notificación del TTAIP.

| Origen | Operación / actor autorizado | Actuación o condición necesaria | Resultado |
| --- | --- | --- | --- |
| Nueva | POST solicitud / ciudadano titular | Entidad, consentimiento y canal; recepción del servidor | RECEPCIONADA. El cliente no elige estado inicial |
| RECEPCIONADA | PATCH estado / funcionario de entidad o administrador | Sin respuesta ni observación pendiente | EN_REVISION. Paso operativo conservado, inferido del flujo de revisión y del caso Android IniciarRevision |
| Cualquiera | PATCH con el estado ya persistido / mismo control institucional | Identidad del recurso y autorización vigentes | Devuelve el estado sin nueva actuación. Los demás saltos genéricos producen 409 |
| RECEPCIONADA / EN_REVISION | Observar / funcionario de entidad o administrador | Motivo y plazo vigente de observación; sin otra pendiente | ObservacionSolicitud y PENDIENTE_INFORMACION, según el modelo SAIP documentado |
| PENDIENTE_INFORMACION | Subsanar / ciudadano titular (administrador en la ruta textual existente) | Observación concreta pendiente, de esta solicitud, dentro del límite almacenado; comentario textual o recepción E1.1 con bytes reales | SUBSANADA y EN_REVISION. Nombre/ruta del cliente no acreditan un archivo |
| PENDIENTE_INFORMACION | Procesar observaciones vencidas / sistema o comando administrativo | Observación aún pendiente y vencida al adquirir el bloqueo, sin respuesta | NO_SUBSANADA y CONCLUIDA. Se conserva el cierre automático SAIP validado; no se copia el cierre TTAIP mediante resolución |
| RECEPCIONADA / EN_REVISION / VENCIDA | Registrar respuesta / funcionario de entidad o administrador, funcionarioId autorizado | Respuesta real del tipo admitido, sin respuesta previa ni observación pendiente | RESPONDIDA (total/parcial) o DENEGADA. La entrega tardía conserva el límite; reglas, sección Entrega digital |
| RECEPCIONADA / EN_REVISION | Ampliación / control institucional | Informe, cronograma, fecha declarada y condiciones existentes del comando | Mantiene estado y actualiza fechaLimite con el cronograma; el scheduler respeta esa fecha |
| RECEPCIONADA / EN_REVISION | Encauzar / control institucional | Entidad activa distinta, motivo, alcance y plazo existentes | TOTAL transfiere la misma solicitud a destino y EN_REVISION; PARCIAL registra actuación sin transferir titularidad institucional |
| Solicitud en atención (incluida VENCIDA), liquidación activa | Pago / recojo / control institucional | Liquidación de esta solicitud y estado compatible; sin respuesta/observación pendiente | Pago registra pago; recojo registra recojo y RESPONDIDA. Recojo no inventa un pago omitido |
| Solicitud en atención, liquidación activa | Procesar no recojo / sistema o administrador | Límite de recojo almacenado vencido, sin respuesta y liquidación todavía activa bajo bloqueo | ARCHIVADA y CONCLUIDA; no sobrescribe una respuesta ya registrada |
| RECEPCIONADA / EN_REVISION | Detectar silencio / sistema o comando administrativo | fechaLimite almacenada anterior a hoy, sin respuesta ni observación pendiente | VENCIDA. Observaciones pendientes se resuelven por su operación específica |

Las exclusiones de actuaciones incompatibles y la revalidación bajo bloqueo son
invariantes de coherencia derivadas de esos recorridos; no añaden estados, días o
calendarios. PUT mantiene su lista ordinaria: asunto, descripción, tipo de
información, consentimiento, canal y prioridad. Ya ignoraba estado, fechas,
respuesta, documentos y demás actuaciones; la prueba confirmó que no era el bypass.
Ahora lectura, validación y escritura de esa lista comparten transacción/bloqueo.

Un registro de actuación, metadatos/bytes almacenados, intento técnico de envío,
notificación eficaz y firma verificada son evidencias distintas. Esta entrega no
convierte fechas declaradas de ampliación/cupón ni fechaObservacion en prueba de
eficacia. El reloj SAIP de observación sigue usando su límite existente: vincularlo
a evidencia eficaz específica sigue pendiente y no se ha sustituido por el reloj
TTAIP. Tampoco se recalculan históricos.

## Reproducciones y corrección

- RED PostgreSQL inicial: 24 casos, 16 fallos y ocho aprobados. PATCH aceptaba
  PENDIENTE_INFORMACION/RESPONDIDA/DENEGADA/CONCLUIDA/VENCIDA sin actuaciones;
  permitía volver a RECEPCIONADA o aceptar una subsanación mediante EN_REVISION.
  Los tres comandos de respuesta admitían CONCLUIDA; la respuesta omitía una
  observación pendiente; un nombre/ruta inexistente daba por subsanada la solicitud.
  Un tipo desconocido se convertía en entrega total y `/aceptar` convertía parcial
  en total. El scheduler recalculaba diez días, ignoraba la ampliación persistida
  y vencía también en el último día permitido.
- RED liquidaciones: tres casos, tres fallos. Recojo reabría CONCLUIDA, agregaba
  fechaPago sin que se hubiera informado y el archivo automático reemplazaba una
  respuesta persistida por CONCLUIDA.
- RED Angular: cinco fallos y doce aprobados. Se reproducen la parcial enviada a
  `/aceptar`, confirmación sin recuperación, envío compuesto sin coordinación,
  botones de evaluación/archivo mediante PATCH y respuesta habilitada con
  subsanación pendiente.

[SolicitudService](src/main/java/pe/gob/saip/backend/service/SolicitudService.java)
coordina los comandos con un bloqueo pesimista de la solicitud, antes de sus
actuaciones. Refresca la entidad ya leída por seguridad y vuelve a autorizar tras
esperar: un encauzamiento total concurrente no deja actuar a la entidad anterior.
Los lotes ordenan solicitudes y releen las condiciones dentro de la transacción.
Los rechazos no persisten actuaciones ni trazas de éxito. No se añade arquitectura
de estados, tablas o migraciones.

[RespuestaService](src/main/java/pe/gob/saip/backend/service/RespuestaService.java)
conserva los comandos existentes y valida origen, respuesta previa y observación.
El registro general conserva tipo, causal y fundamento de una entrega parcial.
`/aceptar` se limita a total y `/denegar` a denegatoria; tipos incompatibles producen
400. Repetir una respuesta ya registrada produce 409, sin duplicarla.

La ruta JSON de subsanación sigue admitiendo comentario textual. Sus dos campos
documentales se conservan en la estructura y se marcan obsoletos: un valor no vacío
produce 400. Los archivos se reciben mediante la operación multipart E1.1. Su
coordinación interna comparte el orden solicitud → observación; conserva recepción,
huella, idempotencia, DocumentoService/StorageProvider y compensación transaccional.

## Consumidores

- Angular detalle institucional ya no ofrece aceptar/archivar una subsanación con
  PATCH. Una observación pendiente con datos históricos de subsanación se muestra
  inconsistente, con evaluación manual no disponible: no existe un comando
  validado para esa actuación adicional. Una recepción válida ya vuelve a revisión.
- El formulario de respuesta usa POST `/api/respuestas` para parcial y conserva
  causal/fundamento; total y denegatoria mantienen sus comandos. Recupera la misma
  solicitud, respuesta, tipo y estado antes de confirmar. No impone un estado local.
- El compuesto respuesta + encauzamiento/liquidación no tiene coordinación backend.
  Se deshabilita con motivo y enlace a las actuaciones del detalle; se eliminan los
  POST complementarios tardíos cuyos errores solo se escribían en consola.
  La modalidad física se identifica mediante datos del recurso, no por la palabra
  «copia» dentro de «copia digital». No se crean nuevas SAIP por una promesa visual.
- Red/5xx o recepción sin recuperación dejan resultado pendiente de verificar y
  bloquean el reenvío desde el formulario. No hay reintento automático. Se conserva
  el formulario y se indica consultar el detalle. No es idempotencia documental
  completa para respuestas: si sus archivos fallan tras registrar la respuesta,
  se informa el resultado parcial y los adjuntos pendientes, sin afirmar entrega.
- Respuestas tardías de otro expediente/sesión o de un componente destruido se
  descartan antes de subir documentos o confirmar. Los avisos distinguen registro
  de entrega, notificación y firma. El formulario textual del ciudadano conserva su
  comando; el formulario con archivo sigue siendo E1.1.
- Android: revisión estática de SolicitudApiService, SolicitudRestDataSource,
  IniciarRevisionUseCase, repositorio/sincronización y RespuestaApiService.
  Iniciar revisión sigue permitido enviando `EN_REVISION`. El datasource manda
  `toDisplayString()` (p. ej. «En Revisión»), incompatibilidad previa con el enum REST.
  Cualquier otro salto real por PATCH pasa a 409; no se conserva un bypass para la
  cola local. Respuestas ya usan POST general. Kotlin no se modificó ni se compiló;
  verificar mappers, 409/422 y reconciliación de la cola sigue pendiente, además de
  multipart TTAIP/logout previamente documentados.

## Contrato y comprobación

Contrato completo capturado por HTTP desde el contexto Spring validado, antes y
después de las anotaciones, fuera de los snapshots. Se integró solo el delta de
**ocho operaciones** (PUT solicitud, PATCH estado, subsanar textual, procesar
observaciones vencidas, los tres POST de respuesta y PATCH liquidación) y
**SubsanarSolicitudRequest**. Se compararon **16 esquemas transitivos**, requeridos,
tipos, referencias, respuestas y seguridad Bearer. Salvo descripciones/deprecación,
los esquemas conservan su forma; no cambia el mecanismo JWT o AuthResponse.token.

Backend completo: 163 rutas/95 esquemas; snapshots: 161/89. Permanecen dos rutas y
seis esquemas ausentes, ocho rutas y tres esquemas distintos anteriores. PUT
solicitud conserva el operationId previo del snapshot (`actualizar`, backend
`actualizar_1`); no se corrige esa deriva ajena al alcance. Ambos snapshots reciben
el mismo delta y schema.ts se genera desde el snapshot actualizado. Esto es una
actualización parcial deliberada, no sincronización global ni certificación móvil.

Ejecuciones de esta entrega:

| Comprobación | Resultado / alcance |
| --- | --- |
| `backend/./mvnw.cmd -o test` con opt-ins SAIP y E1.1 | Una suite completa: 407 casos, 317 aprobados, 90 omitidos, cero fallos/errores |
| TransicionesSaipPostgresIntegrationTest, incluida en esa suite | 36 aprobados: login/JWT/filtro, MockMvc, JPA, transacciones y PostgreSQL 18.4 reales; sin mocks de repositorios/seguridad |
| PrecisionSaipPostgresIntegrationTest, incluida | 19 aprobados: bytes/hash LOCAL, recuperación, autorización, reintentos, dos conexiones/transacciones y compensación con fallo PostgreSQL real; spy heredado solo para otra inyección de fallo |
| Refuerzo posterior de dos casos del scheduler | Dos aprobados, ejecución focalizada: límite futuro, último día, vencimiento real, intento persistido y repetición sin duplicarlo. No se suman como casos únicos a la suite completa |
| Angular `test --watch=false` | Ejecución completa final: 494 aprobados, 39 archivos. HTTP y servicios simulados en specs; DOM Angular/jsdom, sin navegador real |
| `generate:api`; `tsc --noEmit -p tsconfig.app.json` y `tsconfig.spec.json` | Correctos; generación openapi-typescript 7.13.0 |
| `build` | Correcto; advertencias CommonJS existentes de la cadena PDF/canvg |

Flyway aplicó las nueve migraciones originales en una base nueva propia loopback,
con datos sintéticos. `ddl-auto=validate`, historial/checksums válidos y ninguna
migración pendiente. PostgreSQL/LOCAL reales no prueban SMTP, casilla externa, FCM
o S3: notificaciones en MOCK, push deshabilitado. La suite completa también contiene
unitarias con Mockito e integraciones H2; no se afirma PostgreSQL para todos sus
casos. Los opt-outs de otras suites no son aprobaciones.

Para reproducir: seguir [verificación reproducible](VERIFICACION.md),
sin usar una base existente. Exportar `RUN_R3_SAIP_POSTGRES_TESTS=true`,
`SAIP_POSTGRES_URL=jdbc:postgresql://127.0.0.1:<puerto>/yaiku_e11_closeout_<32hex>`
y `SAIP_POSTGRES_ARTIFACTS=<directorio nuevo>`; usuario sintético `yaiku_e11_test`.
Para E1.1 usar los opt-ins de [verificación reproducible](VERIFICACION.md), secuencialmente
en esa base temporal, nunca en una del usuario. En frontend se utilizó pnpm
disponible 11.25 con `--config.manage-package-manager-versions=false
--config.auto-install=false`, sin instalar ni cambiar la declaración 12.3.4.

Las evidencias locales se agrupan en `r3-saip-20261023`: baseline, originales,
RED, logs completos, contrato antes/después, comparación transitiva, historial
Flyway y comparación final. Los intentos intermedios detectaron fixtures incompletos y un error de tipos,
corregidos antes de las suites finales. No se suman resultados parciales como una
suite verde.

## Archivos propios frente al estado inicial

Modificados sobre sus versiones locales preexistentes (no se atribuye el resto del
working tree a esta entrega):

- Backend: `controller/SolicitudRestController.java`, `controller/RespuestaRestController.java`,
  `service/SolicitudService.java`, `service/RespuestaService.java`,
  `service/PrecisionSaipService.java`, `repository/SolicitudRepository.java`,
  `scheduler/PlazoAlertaScheduler.java`, `model/dto/SubsanarSolicitudRequest.java`,
  bajo `src/main/java/pe/gob/saip/backend/`.
- Pruebas backend: `service/SolicitudServiceTest.java`, `service/RespuestaServiceTest.java`,
  `scheduler/PlazoAlertaSchedulerTest.java`, bajo `src/test/java/pe/gob/saip/backend/`.
- Frontend: `.ts/.html/.spec.ts` de `pages/funcionario/funcionario-responder.component`
  y `pages/funcionario/funcionario-solicitud-detalle.component`;
  `services/respuesta.service.ts/.spec.ts`,
  `utils/silencio-administrativo.util.ts/.spec.ts`, `api/schema.ts`, bajo `src/app/`.
- Contratos: `frontend/openapi.json`, `mobile/openapi.json`.

Nuevos de esta entrega: este informe y
`src/test/java/pe/gob/saip/backend/controller/TransicionesSaipPostgresIntegrationTest.java`.
No se modificaron migraciones, dependencias, autenticación, Kotlin ni configuración.

## Límites y comprobación manual pendiente

No se ejecutó navegador ni Android; paridad visual no medida. En un entorno de
prueba: (1) abrir una SAIP recepcionada e iniciar revisión; (2) observar y comprobar
que el funcionario no puede responder/aceptar por PATCH; (3) subsanar como titular
por texto o E1.1 con archivo y recargar; (4) registrar entrega parcial y recuperar
tipo/causal/documentos; (5) forzar error de registro/subida/consulta y comprobar
rechazo, resultado parcial o incertidumbre sin entrega ficticia; (6) probar otro
ciudadano/entidad y la derivación total concurrente.

Quedan fuera emisión oficial, firma digital y numeración. R3 no queda cerrado:
inicio acreditado del plazo SAIP, vinculación probatoria de notificaciones de
observación/ampliación/cupón, rectificación de actuaciones históricas inconsistentes
y reglas de corrección de cronogramas requieren entregas específicas. Se conservan
los límites legales actuales y la declaración de información incompleta. También
quedan la coordinación documental atómica de respuestas, atajos UI de ampliación,
restricción visual previa de respuesta tardía, fecha base de resolución TTAIP y
plazo de cumplimiento. Ver [verificación reproducible](VERIFICACION.md).
