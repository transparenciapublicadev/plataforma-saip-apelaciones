# Reglas de negocio SAIP y TTAIP

Fuente oficial mandatoria: `Flujo SAIP Y TTAIP_081942.docx`.

Este documento consolida las reglas funcionales de la plataforma para primera instancia SAIP, segunda instancia ante el TTAIP, notificaciones, cedulas, reprocesos y trazabilidad. Debe usarse como referencia principal antes de modificar backend, frontend, mobile, Postman, seed SQL o documentacion funcional.

## Reglas de control

- No inventar plazos ni simplificar estados legales.
- No cambiar la nomenclatura actual del proyecto sin autorizacion explicita.
- No omitir notificaciones, cedulas, reprocesos ni trazabilidad cuando una regla legal depende de ellos.
- No modelar resoluciones, cedulas o notificaciones como elementos aislados del expediente TTAIP.
- Mantener RFC 9457 / Problem Details para errores backend.
- Mantener Newman/Postman como validacion funcional de contrato y flujos.

## Estado de implementacion validado

Las siguientes reglas ya estan implementadas y validadas en el flujo actual:

- SAIP exige consentimiento expreso de tratamiento de datos personales antes de crear la solicitud.
- SAIP registra canal formal de notificacion, incluyendo `CASILLA_ELECTRONICA`.
- SAIP cuenta con observacion/subsanacion formal: la entidad observa dentro de 2 dias habiles, el ciudadano subsana dentro de 2 dias habiles y el tramite conserva trazabilidad.
- Una resolucion TTAIP de `INADMISIBLE` genera cedula/notificacion solo para el ciudadano recurrente.
- Un reproceso de notificacion conserva la cedula original y genera nueva cedula y nueva notificacion para el mismo destinatario afectado.
- Postman/Newman captura una cedula real generada durante la ejecucion para reprocesar; no depende de numeros de cedula fijos del seed o environment.
- El ciudadano puede registrar una apelacion externa sin SAIP local cuando la solicitud original fue tramitada fuera de la plataforma.
- El TTAIP puede cerrar una apelacion con `ESTESE_A_LO_RESUELTO` o `NULIDAD_DEL_ACTO`, generando resolucion final, cedulas/notificaciones para ciudadano y entidad publica e historial del expediente.
- SAIP soporta ampliacion de plazo notificada hasta el dia 4 de atencion, con informe formal y cronograma de entregas parciales de maximo 30 dias entre hitos.
- SAIP soporta encauzamiento dentro de 2 dias habiles, con entidad origen, entidad destino, alcance total/parcial, motivo, responsable y trazabilidad.
- SAIP soporta liquidacion/cupon de pago para entrega fisica o reproduccion fisica, con notificacion hasta el dia 9, plazo de recojo de 30 dias habiles y archivo por no recojo.
- TTAIP soporta descargos de entidad despues de admision valida, con plazo de 7 dias habiles, suspension de plazo de resolucion y trazabilidad en el expediente.
- TTAIP soporta suspensiones adicionales por informe oral e informacion complementaria, cada una por 3 dias habiles, con solicitante, motivo, responsable, estado, trazabilidad y recalculo de fecha limite de resolucion.
- TTAIP registra constancia de envio, acuse automatico, evidencia, validacion manual y trazabilidad por cada `NotificacionTtaip`, sin integrar aun un proveedor real de correo.
- TTAIP soporta seguimiento de cumplimiento para resoluciones finales `FUNDADO` y `FUNDADO_EN_PARTE`, con plazo de 7 dias habiles, evidencia de la entidad, observacion/cierre por el Tribunal, vencimiento operativo y trazabilidad en el expediente.

## Nomenclaturas

Las nomenclaturas actuales del proyecto se mantienen:

| Elemento | Nomenclatura vigente del proyecto | Nota del documento oficial |
| --- | --- | --- |
| Solicitud SAIP | `SAIP-AAAA-NNNNN` | Cada entidad puede usar formatos propios para su expediente interno. |
| Expediente TTAIP | `NNNNN-AAAA-JUS/TTAIP` | El Tribunal usa como referencia operativa `NNNNN-AAAA`, por ejemplo `02153-2026`. |
| Resolucion TTAIP | `RESOLUCION N.° NNNNNN-AAAA-JUS/TTAIP-[SALA]` | Debe identificar la sala: `PRIMERA SALA` o `SEGUNDA SALA`. |
| Cedula de notificacion | `NNNNN-AAAA-JUS/TTAIP` | La cedula no lleva sufijo de sala. |

Si el documento oficial menciona un formato diferente, se registra como referencia funcional, no como cambio automatico del sistema.

## Alcance del sistema

La plataforma contempla tres procesos:

1. Primera instancia SAIP: recepcion, revision, subsanacion, atencion, respuesta, vencimiento y apelabilidad.
2. Segunda instancia TTAIP: apelacion, expediente TTAIP, sala, miembros, calificacion, subsanacion, resoluciones, cedulas y resolucion final.
3. Gestion de notificaciones, constancias, reprocesos, auditoria e historial del tramite.

El backend es la fuente central de datos y contrato API. El expediente TTAIP es el agregado principal de segunda instancia.

## Reglas SAIP

### Presentacion

- El ciudadano puede presentar una SAIP por mesa de partes fisica o por plataforma virtual.
- Para esta plataforma, el canal productivo esperado es digital. Si se incorpora mesa de partes fisica, debe digitalizarse el cargo/documento y registrarse sin romper la trazabilidad.
- El formato SAIP debe alinearse al D.S. N.° 007-2024-JUS y a los requisitos de la Ley 27444.
- Al recibir la SAIP, el sistema genera el numero `SAIP-AAAA-NNNNN`.
- Estado inicial esperado del negocio: `SAIP Presentada`.
- Estado actual equivalente en backend: `RECEPCIONADA`.

### Requisitos obligatorios

El escrito o formulario debe contener como minimo:

- Nombres y apellidos completos del administrado.
- Domicilio.
- Numero de DNI o carne de extranjeria.
- Calidad de representante y datos del representado, si corresponde.
- Expresion concreta de lo pedido.
- Fundamentos de hecho y, cuando sea posible, fundamentos de derecho.
- Lugar y fecha.
- Firma o huella digital si se presenta documento escrito o formato que lo requiera.

En la plataforma, como no existe firma manuscrita directa, debe existir aceptacion expresa de tratamiento de datos personales y declaracion de veracidad equivalente al cierre del formulario.

### Requisitos opcionales o condicionales

- Organo, entidad o autoridad a la cual se dirige, cuando sea posible identificarla.
- Direccion de notificacion si difiere del domicilio real.
- Relacion de documentos o anexos indicados por el TUPA.
- Identificacion de expediente previo si el procedimiento ya fue iniciado.
- Adjuntos o cargos cuando correspondan.

### Medios de entrega

- Digital por plataforma.
- Correo electronico.
- Fisico en copias simples o certificadas.
- Casilla electronica.

Cuando el ciudadano seleccione casilla electronica como medio de notificacion, el sistema debe respetar ese canal como medio principal y no mezclarlo con otros salvo excepcion legal o reproceso justificado.

### Modalidad de notificacion y datos personales

- El ciudadano debe aceptar el tratamiento de datos personales para fines del procedimiento.
- La plataforma debe registrar el canal elegido para notificaciones.
- La notificacion debe quedar trazada con fecha, medio, destinatario, resultado y evidencia disponible.
- Implementacion actual: `Solicitud` y `SolicitudDTO` registran `consentimientoDatosPersonales` y `canalNotificacion`; el formulario ciudadano y Postman los envian como datos obligatorios al crear SAIP.

### Plazos SAIP

- La entidad tiene 2 dias habiles despues de recibir la SAIP para evaluar requisitos minimos y observar si corresponde.
- Si la SAIP no es observada, se considera aceptada y pasa a tramite.
- El plazo ordinario de atencion es de 10 dias habiles.
- El conteo inicia el dia habil siguiente a la recepcion.
- Si la SAIP ingresa fuera de horario laboral, se considera recibida el siguiente dia habil y el plazo inicia al dia habil posterior.
- La subsanacion de una observacion reinicia la logica de recepcion: si ingresa fuera de horario, se toma el siguiente dia habil.

### Subsanacion y observacion

- La entidad puede observar la SAIP dentro de los 2 primeros dias habiles.
- La observacion aplica cuando faltan requisitos minimos, especialmente identificacion, pedido concreto o firma/constancia equivalente.
- El ciudadano tiene 2 dias habiles desde la notificacion para subsanar.
- Si subsana, la solicitud vuelve a revision y luego a tramite si cumple.
- Implementacion actual: `ObservacionSolicitud` registra motivo, fecha de observacion, fecha limite de subsanacion, fecha de subsanacion, comentario/documento de subsanacion, estado, responsables y trazabilidad. Al observar, la SAIP pasa a `PENDIENTE_INFORMACION`; al subsanar correctamente vuelve a `EN_REVISION`; si vence sin subsanacion, la observacion queda `NO_SUBSANADA` y la solicitud se cierra como `CONCLUIDA` segun el modelo actual.

### Ampliacion de plazo

- Si el pedido es amplio o requiere gran volumen de informacion, la entidad puede pedir ampliacion.
- Debe notificarse un informe con cronograma de entregas parciales.
- Cada entrega parcial no debe exceder 30 dias.
- La ampliacion debe notificarse como maximo hasta el dia 4 de atencion.
- Si no se notifica dentro de ese limite, se mantiene el plazo ordinario de 10 dias habiles.
- Implementacion actual: `AmpliacionPlazoSolicitud` registra motivo, informe, fecha de solicitud, fecha de notificacion, plazo original, plazo ampliado, estado, responsable, trazabilidad y `CronogramaEntregaParcialSolicitud`.
- El backend solo permite registrar ampliacion en estados `RECEPCIONADA` o `EN_REVISION`, sin otra ampliacion activa, y actualiza `Solicitud.fechaLimite` al ultimo hito valido del cronograma.
- El cronograma valida entregas progresivas: numero de entrega, descripcion, fecha programada, estado, fecha real de entrega y observacion; cada entrega debe ocurrir como maximo 30 dias despues del hito anterior.
- Postman/Newman cubre el flujo positivo y una validacion negativa esperada para cronogramas que exceden 30 dias, manteniendo Problem Details RFC 9457.

### Encauzamiento

- Si la entidad no es competente, debe encauzar la SAIP dentro de 2 dias habiles.
- Si no encauza y luego deniega, o si el ciudadano apela/reclama, la responsabilidad queda en la entidad que recibio la solicitud.
- Si solo parte de la informacion corresponde a otra entidad, la entidad receptora debe atender la parte de su competencia y clasificar el resultado como entrega parcial o denegatoria parcial.
- Implementacion actual: `EncauzamientoSolicitud` registra solicitud, entidad origen, entidad destino, motivo, alcance `TOTAL` o `PARCIAL`, fecha de encauzamiento, fecha limite, estado, responsable, sustento y trazabilidad.
- El backend solo permite encauzar SAIP en estados `RECEPCIONADA` o `EN_REVISION`, dentro de los 2 dias habiles desde la recepcion, hacia una entidad activa y distinta a la entidad origen.
- Encauzamiento `TOTAL`: actualiza la entidad responsable de la SAIP a la entidad destino y mantiene la solicitud en revision.
- Encauzamiento `PARCIAL`: conserva la SAIP en la entidad origen y registra la parte derivada para trazabilidad, sin duplicar la solicitud.
- No se permiten encauzamientos activos duplicados para la misma SAIP; los errores de regla de negocio responden con Problem Details RFC 9457.

### Liquidacion de costos y entrega fisica

- Si la entrega es fisica, la entidad debe notificar el cupon o liquidacion de pago antes del vencimiento legal, operacionalmente hasta el dia 9.
- El ciudadano tiene 30 dias habiles desde la notificacion del cupon para recoger las copias o coordinar entrega fisica.
- Si no recoge dentro de 30 dias habiles, se archiva el expediente.
- La liquidacion aplica solo cuando la SAIP solicita entrega fisica, copia simple o copia certificada.
- El sistema registra codigo de liquidacion, monto, moneda, concepto, fecha de emision, fecha de notificacion, fecha limite de recojo, medio de notificacion, responsable, observacion y trazabilidad.
- La fecha limite de recojo se calcula sumando 30 dias habiles desde la fecha de notificacion del cupon.
- No se permite mas de una liquidacion activa para la misma SAIP.
- Estados operativos: `EMITIDA`, `NOTIFICADA`, `PAGADA`, `RECOGIDA`, `ARCHIVADA`, `CANCELADA` y `VENCIDA`.
- Si el ciudadano paga o recoge la informacion, se registra fecha de pago/recojo; al marcar `RECOGIDA`, la SAIP queda `RESPONDIDA` bajo el modelo actual.
- Si vence el plazo de recojo sin que el ciudadano recoja la informacion, el procesamiento de vencidas marca la liquidacion como `ARCHIVADA` y la SAIP como `CONCLUIDA`.
- Implementacion actual: `LiquidacionCostoSolicitud` conserva cupon, fechas, responsable, trazabilidad y estado. Postman/Newman valida emision, consulta, rechazo de duplicado activo, pago, recojo y procesamiento de vencidas.

### Entrega digital

- Si la entrega es por correo o plataforma, debe realizarse hasta el dia 10.
- Si el plazo vence, el sistema aun puede permitir notificar bajo responsabilidad, pero debe registrar si la notificacion fue dentro o fuera de plazo.

### Tipos de respuesta SAIP

| Tipo | Regla |
| --- | --- |
| Entrega total | Se entrega toda la informacion solicitada. |
| Entrega parcial | Se entrega parte de la informacion y se deniega otra parte. Tambien equivale a denegatoria parcial. |
| Denegatoria total | Se deniega toda la solicitud. Puede incluir encauzamiento total si toda la solicitud corresponde a otra entidad. |
| Silencio administrativo negativo | Aplica si la entidad no responde dentro del plazo. |

Despues de responder, el estado de negocio es `Respondida` o `SAIP atendida`.

### Apelacion desde SAIP

- Si existe denegatoria expresa, el documento oficial contiene dos referencias: una tabla con 15 dias calendario y el Art. 34.2 con 15 dias habiles.
- Regla normativa citada por el propio documento: ante denegatoria expresa, el plazo no debe ser mayor a 15 dias habiles.
- Ante denegatoria tacita o silencio administrativo negativo, no existe plazo perentorio.
- Esta diferencia debe resolverse como decision de producto/legal antes de cambiar codigo productivo.

## Estados SAIP

| Estado oficial o negocio | Estado backend actual | Observacion |
| --- | --- | --- |
| SAIP Presentada | `RECEPCIONADA` | Cubierto como estado inicial actual. |
| EnRevision | `EN_REVISION` | Cubierto. |
| Subsanacion | `PENDIENTE_INFORMACION` | Cubierto con `ObservacionSolicitud` y plazo de 2 dias habiles. |
| No subsanada / archivada | `CONCLUIDA` | Cubierto como cierre administrativo por vencimiento de observacion no subsanada. |
| En tramite / En proceso | No existe explicito | Debe evaluarse si se agrega o se mantiene `EN_REVISION`. |
| Respondida / SAIP atendida | `RESPONDIDA` o `DENEGADA` | Cubierto para respuesta total/parcial/denegatoria. |
| Vencida | `VENCIDA` | Cubierto para silencio administrativo negativo. |
| Apelable | Derivado por respuesta/vencimiento | No existe estado propio; puede ser calculado. |

## Reglas TTAIP

### Formas de presentacion de apelacion

El recurso de apelacion puede presentarse:

- Ante la entidad que emitio la respuesta o que guardo silencio, para que lo eleve al TTAIP.
- Directamente ante el TTAIP, por plataforma o mesa de partes del MINJUS.

El sistema actual deriva la apelacion ciudadana directamente al TTAIP y no modela una etapa funcional de elevacion. Esta decision se mantiene hasta que se implemente expresamente el canal de elevacion por entidad.

### Apelacion externa sin SAIP local

- La apelacion puede originarse en una SAIP creada en la plataforma (`SAIP_INTERNA`) o en una solicitud tramitada fuera de ella (`EXTERNA`).
- Una apelacion externa no exige `solicitudId` local ni crea una SAIP ficticia.
- Debe registrar ciudadano recurrente, entidad publica del catalogo o datos minimos de entidad externa, numero y fecha de la solicitud original, resumen, copia o referencia documental de la solicitud y fundamentos.
- Si existe denegatoria expresa, debe registrar fecha y resumen o referencia documental de la respuesta de la entidad.
- Si existe denegatoria tacita, debe registrar evidencia o declaracion de silencio administrativo negativo.
- El cargo de recepcion se registra cuando corresponde.
- La apelacion externa crea normalmente expediente TTAIP `NNNNN-AAAA-JUS/TTAIP` en `EN_CALIFICACION_1`, con sala, miembros e historial de apertura.
- Cuando una entidad externa no este vinculada al catalogo local, el recurso puede registrarse y calificarse. Antes de operaciones institucionales que exigen funcionario de entidad, como descargos o cumplimiento, debe vincularse la entidad apelada al catalogo.

### Elevacion por entidad

- Si el ciudadano presenta la apelacion ante la entidad, esta tiene 2 dias habiles para elevarla al TTAIP.
- Si la entidad omite elevar el recurso, el ciudadano puede comunicarlo al TTAIP adjuntando prueba de presentacion.
- El TTAIP puede admitir excepcionalmente el recurso, sin perjuicio de la responsabilidad de la entidad.

### Registro de expediente TTAIP

- Todo recurso admitido a tramite de segunda instancia debe tener expediente TTAIP.
- El expediente TTAIP es el contenedor del caso.
- Debe vincularse con la apelacion y, cuando exista, con la solicitud SAIP de origen.
- El expediente debe identificar sala, miembros asignados, estado, fechas, resoluciones, cedulas, notificaciones, reprocesos e historial.

### Requisitos de apelacion

- Debe cumplir los requisitos de los articulos 113 y 211 de la Ley 27444.
- Debe adjuntar copia de la solicitud presentada a la entidad.
- Debe adjuntar cargo de recepcion cuando corresponda.
- Debe adjuntar respuesta de la entidad cuando exista denegatoria expresa.
- Para silencio administrativo negativo, debe permitir sustentar que no hubo respuesta dentro de plazo.

### Observacion y subsanacion

- Si la apelacion no cumple requisitos minimos, el TTAIP puede observar.
- El TTAIP tiene 2 dias habiles para observar.
- El ciudadano tiene 2 dias habiles desde la notificacion para subsanar.
- Si subsana, el recurso pasa a nueva calificacion como si fuera un nuevo ingreso para efectos de plazo.
- Si no subsana una inadmisibilidad, se emite resolucion de `TENER_POR_NO_PRESENTADO`.

### Primera calificacion

- Plazo: 7 dias habiles desde el dia habil siguiente de recepcion por el TTAIP.
- Puede emitir:
  - Admisibilidad: el recurso queda apto y se notifica a ciudadano y entidad.
  - Inadmisibilidad: defectos subsanables; se notifica solo al recurrente/ciudadano.
  - Improcedencia: rechazo definitivo por causal formal, competencia, prematuridad, extemporaneidad u otra causal.

### Descargos de entidad

- Cuando se admite la apelacion, el TTAIP requiere a la entidad descargos y/o expediente administrativo.
- La entidad tiene 7 dias habiles para presentar descargos y remitir expediente.
- El plazo de 10 dias habiles para resolver se suspende durante este periodo.
- Implementacion actual: `DescargoEntidadTtaip` registra expediente, apelacion, entidad, fecha de requerimiento, fecha limite de descargo, fecha de presentacion, estado, resumen, documento o referencia, responsable de entidad, observacion y trazabilidad.
- El requerimiento solo se permite cuando el expediente esta en `EN_RESOLUCION`, es decir, luego de una admision valida.
- No se permite mas de un descargo activo `REQUERIDO` por expediente.
- Al requerir descargos se crea `SuspensionPlazoTtaip` con motivo `DESCARGOS_ENTIDAD`, estado `ACTIVA`, inicio en la fecha de requerimiento, fin planificado en 7 dias habiles y `diasSuspendidos = 7`.
- Si la entidad presenta descargos dentro del plazo, el descargo queda `PRESENTADO`, la suspension queda `CERRADA` y los dias suspendidos se recalculan segun los dias habiles efectivamente transcurridos.
- Si presenta fuera de plazo, queda `PRESENTADO_EXTEMPORANEO`; la suspension se considera cerrada al limite legal de 7 dias habiles.
- Si vence sin presentacion, el procesamiento operativo marca el descargo como `VENCIDO_SIN_PRESENTACION`, cierra la suspension como `VENCIDA` y el expediente puede continuar.
- La fecha limite de resolucion final se recalcula desde la base de 10 dias habiles y suma los dias suspendidos registrados.
- Postman/Newman valida requerimiento positivo, rechazo por duplicado activo, consultas, presentacion de descargo, suspensiones y procesamiento de vencidos.

### Segunda calificacion

- Aplica solo si hubo inadmisibilidad y el ciudadano subsano.
- Plazo: 7 dias habiles desde la subsanacion valida.
- Puede terminar en admision/admisibilidad o improcedencia.
- La segunda calificacion debe notificarse antes de iniciar el plazo de resolucion final.

### Resolucion final

- Plazo: 10 dias habiles desde el dia siguiente de la notificacion valida de admisibilidad.
- El plazo puede suspenderse por descargos, informe oral o informacion complementaria.
- Si se solicita informe oral o informacion complementaria, el plazo se suspende 3 dias adicionales.
- Implementacion actual: `SuspensionPlazoTtaip` reutiliza el mismo agregado de suspensiones para `DESCARGOS_ENTIDAD`, `INFORME_ORAL` e `INFORMACION_COMPLEMENTARIA`.
- Para `INFORME_ORAL` e `INFORMACION_COMPLEMENTARIA`, el sistema registra expediente, tipo de solicitud, solicitante `CIUDADANO`, `ENTIDAD_PUBLICA` o `TTAIP`, motivo, fecha de solicitud, fecha de inicio, fecha de fin planificada, `diasSuspendidos = 3`, estado, responsable, observacion y trazabilidad.
- Solo se permite registrar estas suspensiones cuando el expediente TTAIP esta en `EN_RESOLUCION`; no se permiten duplicados activos del mismo tipo para el mismo expediente.
- La fecha limite de resolucion final se recalcula desde la base de 10 dias habiles y suma todos los dias suspendidos registrados. Si una suspension adicional se cancela, queda `CANCELADA`, suma `0` dias y se conserva su traza.

Decisiones finales:

| Decision | Regla |
| --- | --- |
| Fundado | El Tribunal ampara el recurso y ordena entrega de informacion. |
| Fundado en parte | Ordena entrega parcial o version publica. |
| Infundado | Confirma la decision o conducta de la entidad. |
| Infundado en parte | Confirma parcialmente la decision o conducta de la entidad. |
| Improcedente | No se evalua el fondo por causal formal o sustantiva. |
| Conclusion por sustraccion de la materia | La entidad satisface la pretension durante el tramite. |
| Conclusion por desistimiento | El ciudadano desiste del recurso. |
| Estese a lo resuelto | Existe pronunciamiento previo aplicable al mismo asunto o pedido reiterado. |
| Nulidad del acto | Se invalida respuesta o procedimiento por vicios graves y se ordena retrotraer o emitir nuevo pronunciamiento. |

Las decisiones `ESTESE_A_LO_RESUELTO` y `NULIDAD_DEL_ACTO` se registran como resolucion final del expediente TTAIP. Deben sustentarse con la referencia al pronunciamiento previo o con el fundamento de nulidad y, por regla general, generan cedulas/notificaciones para ciudadano y entidad publica.

### Cumplimiento de resolucion fundada

- Si el TTAIP declara `FUNDADO` o `FUNDADO_EN_PARTE`, la entidad debe cumplir en maximo 7 dias habiles.
- En el mismo plazo, la entidad debe comunicar el cumplimiento al Tribunal, adjuntando evidencia o referencia documental.
- No aplica para `INFUNDADO`, `INFUNDADO_EN_PARTE`, `IMPROCEDENTE`, `CONCLUSION_SUSTRACCION_MATERIA` ni `CONCLUSION_DESISTIMIENTO`.
- Implementacion actual: `CumplimientoResolucionTtaip` registra expediente, apelacion, resolucion, entidad, fecha de requerimiento, fecha limite, fecha de cumplimiento, estado, tipo `TOTAL`/`PARCIAL`/`NO_CUMPLE`, descripcion, evidencia o referencia documental, responsable, observacion y trazabilidad.
- La fecha limite se calcula sumando 7 dias habiles desde la notificacion valida de la resolucion final a la entidad publica cuando existe. Si no hay una notificacion valida segura, el backend usa la fecha de la resolucion/notificacion disponible como base operativa y conserva esa decision en la documentacion.
- Una notificacion valida para iniciar el seguimiento puede estar `ENTREGADA` o `VALIDADA`, tener resultado equivalente o haber sido validada manualmente con sustento.
- Solo TTAIP/administrador puede crear, observar o cerrar el seguimiento; funcionario de entidad/administrador puede registrar la comunicacion de cumplimiento.
- No se permite mas de un seguimiento activo `PENDIENTE` u `OBSERVADO` para la misma resolucion.
- Si vence sin cumplimiento, el procesamiento operativo marca el seguimiento como `VENCIDO`, sin borrar expediente ni resolucion.
- Postman/Newman valida creacion dinamica del seguimiento sobre una resolucion final fundada, rechazo por duplicado activo, registro de evidencia por entidad, observacion/cierre por TTAIP, rechazo sobre resolucion no fundada y procesamiento de vencidos.

## Reglas de notificacion

- Toda notificacion debe identificar destinatario, medio, fecha, estado y evidencia.
- Los destinatarios aplicables son ciudadano/recurrente y entidad publica.
- Los medios pueden ser correo, fisico, plataforma o casilla electronica.
- Si la notificacion es por correo, debe existir constancia de envio y acuse automatico.
- Si el acuse automatico indica falla o no recepcion, debe notificarse fisicamente o reprocesarse por el medio que corresponda.
- La plataforma debe permitir validacion manual de notificacion correcta cuando el flujo dependa de esa validacion.
- Una notificacion defectuosa no debe iniciar indebidamente plazos posteriores.
- Implementacion actual TTAIP: `NotificacionTtaip` registra medio de notificacion, fecha de envio, codigo de envio/constancia, constancia de envio, acuse automatico, fecha y estado de acuse, resultado, evidencia o referencia documental, validacion manual, responsable, observacion y trazabilidad.
- Estados operativos de notificacion: `PENDIENTE`, `ENVIADA`, `ENTREGADA`, `FALLIDA`, `OBSERVADA`, `VALIDADA` y `REPROCESADA` como referencia de negocio. El backend usa estos valores textuales de forma compatible con el modelo actual.
- Un acuse `ENTREGADO` marca la notificacion como `ENTREGADA`; un acuse `FALLIDO` o `NO_RECIBIDO` la marca como `FALLIDA`; un acuse `OBSERVADO` la marca como `OBSERVADA`.
- Una notificacion fallida u observada puede iniciar reproceso, conservando su constancia y acuse originales.
- La validacion manual solo procede con sustento: observacion, evidencia, referencia documental, constancia o acuse. Esta validacion marca la notificacion como `VALIDADA` y registra responsable y fecha.
- No se implementa aun envio real de correo, SMTP, casilla electronica real ni motor externo. El modelo queda preparado para capturar evidencia y acuses generados por esos proveedores cuando se integren.
- Los plazos que dependan de una notificacion valida deben considerar notificaciones `ENTREGADA` o `VALIDADA`. Esta iteracion documenta y protege el dato minimo, sin recalcular masivamente plazos historicos.

## Reglas de cedulas

- Cada resolucion TTAIP debe generar cedulas segun destinatarios aplicables.
- Regla general: generar cedula para ciudadano y cedula para entidad publica con el mismo numero base.
- Excepcion: la inadmisibilidad se notifica solo al recurrente/ciudadano.
- Cada cedula pertenece a una resolucion.
- Cada cedula debe poder consultarse desde el expediente TTAIP.
- Si hay reproceso, se genera una nueva cedula para la parte afectada.
- No se debe borrar ni reemplazar la cedula original.
- La nueva cedula queda vinculada al expediente, resolucion, notificacion original y destinatario.
- Implementacion actual: el reproceso crea nueva cedula y nueva notificacion para el mismo destinatario afectado, preserva la cedula original y deja trazabilidad en el expediente.

## Reglas de reproceso

- Un reproceso aplica cuando la notificacion no llego, fue defectuosa, tuvo cargo observado o requiere subsanacion de notificacion.
- Debe conservarse la notificacion original.
- Debe registrarse responsable, motivo, fecha, destinatario afectado, intento y resultado.
- Debe existir trazabilidad entre cedula original, nueva cedula si corresponde, notificacion original y nueva notificacion.
- La coleccion Postman valida esta regla capturando dinamicamente una cedula/notificacion emitida en el flujo TTAIP antes de ejecutar el reproceso.
- Si el reproceso nace de un acuse fallido, la notificacion original queda `FALLIDA` con resultado `REPROCESO_REQUERIDO` y la nueva notificacion queda `PENDIENTE` de su propia constancia/acuse.

## Expediente TTAIP como agregado principal

Modelo conceptual obligatorio:

```text
ExpedienteTtaip
  -> Apelacion
  -> Solicitud SAIP si existe
  -> SalaTtaip
  -> MiembrosTtaip
  -> Resoluciones
      -> CedulasNotificacion
          -> Notificaciones
  -> DescargosEntidad
  -> SuspensionesPlazo
  -> CumplimientosResolucion
  -> ReprocesosNotificacion
  -> HistorialTtaip
```

Reglas:

- Cada resolucion debe pertenecer al expediente.
- Cada cedula debe pertenecer a una resolucion.
- Cada notificacion debe pertenecer al expediente y referenciar su cedula.
- Cada descargo de entidad debe pertenecer al expediente y a la apelacion, y debe identificar la entidad requerida.
- Cada suspension de plazo debe pertenecer al expediente y, cuando corresponda, referenciar el descargo que la origina.
- Cada seguimiento de cumplimiento debe pertenecer al expediente, a la apelacion, a la resolucion final fundada o fundada en parte, y a la entidad obligada.
- Cada reproceso debe pertenecer al expediente y conservar la cedula/notificacion original.
- El historial registra apertura, cambios de estado, resoluciones, cedulas, notificaciones, descargos, suspensiones, cumplimientos, reprocesos, subsanaciones y auditoria.

## Estados TTAIP

| Estado oficial o negocio | Estado backend actual | Observacion |
| --- | --- | --- |
| En revision | `EN_CALIFICACION_1` o `PENDIENTE_ELEVACION` | El proyecto inicia directo en calificacion; elevacion queda como referencia/gap. |
| Observacion/Subsanacion | `EN_SUBSANACION` | Cubierto para apelacion inadmisible. |
| EnCalificacionPrimera | `EN_CALIFICACION_1` | Cubierto. |
| Admitido | `EN_RESOLUCION` o `NOTIFICACION_SEGUNDA_CALIFICACION` | El flujo actual pasa a resolucion tras admision de primera calificacion. |
| EnCalificacionSegunda | `EN_CALIFICACION_2` | Cubierto tras subsanacion. |
| NotificacionSegunda | `NOTIFICACION_SEGUNDA_CALIFICACION` | Cubierto para segunda calificacion. |
| EnResolucion | `EN_RESOLUCION` | Cubierto. |
| Resuelto | `RESUELTO_*`, `CONCLUSION_*`, `TENER_POR_NO_PRESENTADO` | Cubierto para varios cierres. |

## Contradicciones o decisiones pendientes

- Plazo de apelacion por denegatoria expresa: la tabla inicial del documento indica 15 dias calendario, pero el Art. 34.2 citado en el mismo documento indica 15 dias habiles. Debe resolverse con criterio legal/producto antes de cambiar codigo.
- Elevacion: el documento oficial incluye elevacion por entidad, pero el flujo actual del proyecto deriva directo al TTAIP. Debe decidirse si se implementa como modulo funcional o se mantiene solo como referencia.
