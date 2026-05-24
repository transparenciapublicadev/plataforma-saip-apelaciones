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

### Encauzamiento

- Si la entidad no es competente, debe encauzar la SAIP dentro de 2 dias habiles.
- Si no encauza y luego deniega, o si el ciudadano apela/reclama, la responsabilidad queda en la entidad que recibio la solicitud.
- Si solo parte de la informacion corresponde a otra entidad, la entidad receptora debe atender la parte de su competencia y clasificar el resultado como entrega parcial o denegatoria parcial.

### Liquidacion de costos y entrega fisica

- Si la entrega es fisica, la entidad debe notificar el cupon o liquidacion de pago antes del vencimiento legal, operacionalmente hasta el dia 9.
- El ciudadano tiene 30 dias habiles desde la notificacion del cupon para recoger las copias o coordinar entrega fisica.
- Si no recoge dentro de 30 dias habiles, se archiva el expediente.

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

### Segunda calificacion

- Aplica solo si hubo inadmisibilidad y el ciudadano subsano.
- Plazo: 7 dias habiles desde la subsanacion valida.
- Puede terminar en admision/admisibilidad o improcedencia.
- La segunda calificacion debe notificarse antes de iniciar el plazo de resolucion final.

### Resolucion final

- Plazo: 10 dias habiles desde el dia siguiente de la notificacion valida de admisibilidad.
- El plazo puede suspenderse por descargos, informe oral o informacion complementaria.
- Si se solicita informe oral o informacion complementaria, el plazo se suspende 3 dias adicionales.

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

### Cumplimiento de resolucion fundada

- Si el TTAIP declara fundado el recurso, la entidad debe cumplir en maximo 7 dias habiles.
- En el mismo plazo, la entidad debe comunicar el cumplimiento al Tribunal.

## Reglas de notificacion

- Toda notificacion debe identificar destinatario, medio, fecha, estado y evidencia.
- Los destinatarios aplicables son ciudadano/recurrente y entidad publica.
- Los medios pueden ser correo, fisico, plataforma o casilla electronica.
- Si la notificacion es por correo, debe existir constancia de envio y acuse automatico.
- Si el acuse automatico indica falla o no recepcion, debe notificarse fisicamente o reprocesarse por el medio que corresponda.
- La plataforma debe permitir validacion manual de notificacion correcta cuando el flujo dependa de esa validacion.
- Una notificacion defectuosa no debe iniciar indebidamente plazos posteriores.

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
  -> ReprocesosNotificacion
  -> HistorialTtaip
```

Reglas:

- Cada resolucion debe pertenecer al expediente.
- Cada cedula debe pertenecer a una resolucion.
- Cada notificacion debe pertenecer al expediente y referenciar su cedula.
- Cada reproceso debe pertenecer al expediente y conservar la cedula/notificacion original.
- El historial registra apertura, cambios de estado, resoluciones, cedulas, notificaciones, reprocesos, subsanaciones y auditoria.

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
- Apelacion sin SAIP creada en plataforma: el documento propone permitir apelaciones de solicitudes tramitadas fuera de la plataforma. El backend actual exige `solicitudId`.
