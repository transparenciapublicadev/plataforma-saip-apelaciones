# Matriz de brechas SAIP/TTAIP

Fuente oficial comparada: `Flujo SAIP Y TTAIP_081942.docx`.

Alcance revisado:

- `backend/`
- `database/script_saip_db.sql`
- `backend/src/main/resources/data.sql`
- `postman/`
- `frontend/` solo mediante busqueda de impactos funcionales visibles
- `.github/copilot-instructions.md`
- `docs/src/content/docs/dominio/reglas-saip.mdx`
- `docs/src/content/docs/dominio/reglas-ttaip.mdx`

Esta matriz documenta que ya esta cubierto, que esta parcial y que debe planificarse. Las brechas prioritarias implementadas en la ultima iteracion quedaron reflejadas como cubiertas y validadas con backend tests, frontend tests/build y Newman diagnostic.

## Resumen ejecutivo

El proyecto ya cubre la base de SAIP, apelaciones TTAIP, Primera Sala, Segunda Sala, expedientes TTAIP, resoluciones, cedulas, notificaciones, historial y reprocesos. Tambien quedaron cubiertos el consentimiento de datos personales en SAIP, el canal formal de notificacion con casilla electronica, la observacion/subsanacion SAIP formal, la ampliacion de plazo SAIP con informe y cronograma de entregas parciales, el encauzamiento SAIP dentro de 2 dias habiles, la liquidacion/cupon de pago para entrega fisica con archivo por no recojo, la excepcion de inadmisibilidad notificada solo al ciudadano, el reproceso con nueva cedula/nueva notificacion sin borrar la original y la validacion Newman/Postman con cedula dinamica. Las brechas principales pendientes estan en reglas finas del documento oficial: apelaciones externas sin SAIP creada en plataforma, elevacion por entidad, descargos con suspension de plazo, informe oral/informacion complementaria, constancias/acuse de correo y cumplimiento de resolucion fundada.

## Brechas por regla

| Regla del documento oficial | Donde deberia vivir | Estado actual | Archivo relacionado | Recomendacion |
| --- | --- | --- | --- | --- |
| El DOCX es fuente mandatoria de reglas de negocio. | Docs, instrucciones IA, README funcional si aplica | Parcial | `.github/copilot-instructions.md`, `AGENTS.md`, `docs/business-rules/*` | Registrar regla mandatoria en instrucciones IA y usar estos documentos como base de implementacion. |
| Mantener nomenclaturas actuales salvo autorizacion. | Backend generators, docs, Postman, seed | Cubierto | `SolicitudService`, `ApelacionService`, `ExpedienteTtaipService`, `database/script_saip_db.sql` | No cambiar formatos ahora; documentar nomenclatura TTAIP oficial `NNNNN-AAAA` solo como referencia. |
| SAIP debe registrar datos minimos LPAG Art. 113. | DTO/formulario/backend validation | Parcial | `SolicitudDTO`, `SolicitudRestController`, `Solicitud` | Crear request DTO tipado y validar campos minimos; revisar domicilio/representante/anexos si entran al alcance. |
| Consentimiento de tratamiento de datos personales. | Frontend form, backend DTO/entity, Postman | Cubierto | `SolicitudDTO`, `Solicitud`, `nueva-saip.component.*`, Postman SAIP | Se agrego `consentimientoDatosPersonales` y se valida como obligatorio al crear SAIP. |
| Casilla electronica como medio de entrega/notificacion. | Backend entity/DTO, frontend form, notificaciones | Cubierto | `Solicitud`, `SolicitudDTO`, `nueva-saip.component.*`, Postman SAIP | Se agrego `canalNotificacion` con `CASILLA_ELECTRONICA`, se expone en DTO, se captura en frontend y se valida en la coleccion Postman. Las constancias/acuses quedan como brecha separada de motor de notificaciones. |
| Entidad tiene 2 dias habiles para observar SAIP. | Service de SAIP, estado, auditoria | Cubierto | `ObservacionSolicitud`, `SolicitudService.observarSolicitud`, `SolicitudRestController`, frontend funcionario, Postman | Observacion formal con motivo, fecha limite de subsanacion, responsable, estado y trazabilidad. |
| Estado negocio `En tramite` posterior a revision. | Enum/maquina de estados SAIP | Falta | `Solicitud.EstadoSolicitud` | Decidir si agregar `EN_TRAMITE` o mapear formalmente a `EN_REVISION`. |
| Subsanacion SAIP con 2 dias habiles desde notificacion. | Backend SAIP, frontend ciudadano, Postman | Cubierto | `ObservacionSolicitud`, `SolicitudService.subsanarSolicitud`, frontend ciudadano, Postman | El ciudadano subsana con comentario/documento; la solicitud vuelve a `EN_REVISION`. Si vence, se marca `NO_SUBSANADA` y la SAIP queda `CONCLUIDA`. |
| Ampliacion de plazo hasta dia 4 y cronograma de entregas parciales. | Backend SAIP, entidad, notificaciones, frontend, Postman | Cubierto | `AmpliacionPlazoSolicitud`, `CronogramaEntregaParcialSolicitud`, `SolicitudService.registrarAmpliacion`, `SolicitudRestController`, frontend funcionario/ciudadano, Postman | Mantener validacion de dia 4, maximo 30 dias por entrega parcial, una ampliacion activa por SAIP y Problem Details para errores. |
| Encauzamiento en 2 dias habiles. | Backend SAIP, entidad, trazabilidad, frontend, Postman | Cubierto | `EncauzamientoSolicitud`, `SolicitudService.registrarEncauzamiento`, `SolicitudRestController`, `database/script_saip_db.sql`, frontend funcionario/ciudadano, Postman | Mantener validacion de entidad destino activa y distinta, plazo de 2 dias habiles, alcance total/parcial, no duplicidad activa y Problem Details para errores. |
| Liquidacion/cupon de pago para copias fisicas hasta dia 9. | Backend SAIP, pagos/costos, notificacion, frontend, Postman | Cubierto | `LiquidacionCostoSolicitud`, `SolicitudService.emitirLiquidacion`, `SolicitudRestController`, frontend funcionario/ciudadano, Postman | Se registra codigo, monto, concepto, notificacion, fecha limite de recojo, responsable, estado y trazabilidad. Solo aplica para entrega/reproduccion fisica y no permite duplicado activo. |
| Archivo por no recoger copias en 30 dias habiles. | Backend SAIP, accion manual/proceso operativo | Cubierto | `LiquidacionCostoSolicitud`, `SolicitudService.procesarLiquidacionesVencidas` | La fecha limite de recojo se calcula sumando 30 dias habiles desde la notificacion del cupon. Si vence sin recojo, la liquidacion queda `ARCHIVADA` y la SAIP `CONCLUIDA`. |
| Entrega digital hasta dia 10 y notificacion tardia bajo responsabilidad. | Backend respuesta/notificacion | Parcial | `RespuestaService`, `Solicitud` | Registrar si respuesta/notificacion fue dentro o fuera de plazo. |
| Entrega total, parcial y denegatoria total. | Backend Respuesta | Cubierto parcial | `Respuesta.TipoRespuesta`, `RespuestaService` | `ENTREGA_TOTAL`, `ENTREGA_PARCIAL`, `DENEGACION_TOTAL` existen; mejorar causales/validacion para parcial. |
| Silencio administrativo negativo automatico. | Backend SAIP job/service | Cubierto parcial | `SolicitudService.detectarSilencioAdministrativo`, `Solicitud.isSilencioAdministrativo` | Falta verificar scheduler o job de ejecucion periodica. |
| Apelacion por denegatoria expresa: 15 dias. | Backend rules, frontend, docs | Duda | docs actuales, frontend dashboard, `AyudaPublicaRestController` | Resolver contradiccion: tabla dice calendario, Art. 34.2 dice habiles. No cambiar codigo sin decision legal/producto. |
| Apelacion por denegatoria tacita sin plazo perentorio. | Backend/frontend | Parcial | `Solicitud`, frontend utils | Documentado; verificar que frontend no bloquee por plazo en SAIP vencida. |
| Apelacion presentada ante entidad con elevacion en 2 dias. | Backend TTAIP/entidad | Falta por decision | `Apelacion.EstadoApelacion.PENDIENTE_ELEVACION`, `TTAIPService` | El proyecto decidio inicio directo; si se implementa, agregar endpoint/estado de elevacion sin romper flujo actual. |
| Apelacion directa al TTAIP. | Backend/frontend | Cubierto | `ApelacionRestController.crear` | Flujo actual crea apelacion y expediente directo en `EN_CALIFICACION_1`. |
| Apelacion de SAIP fuera de plataforma. | Backend TTAIP | Falta | `ApelacionRestController.crear`, `Apelacion` | Backend exige `solicitudId`; evaluar apelacion externa con documentos/cargo sin solicitud local. |
| Expediente TTAIP como agregado principal. | Backend/domain/database | Cubierto parcial | `ExpedienteTtaip`, `ExpedienteTtaipService`, seed | Ya relaciona apelacion, sala, miembros, resoluciones, notificaciones, historial y reprocesos. |
| Primera y Segunda Sala TTAIP. | Backend/database/frontend | Cubierto | `SalaTtaip`, `MiembroTTAIP`, `database/script_saip_db.sql` | Seed tiene ambas salas y miembros reales; mantener validacion en frontend. |
| Seed automatico de Spring Boot alineado al script oficial. | `backend/src/main/resources/data.sql` | Parcial | `backend/src/main/resources/data.sql` | El seed automatico tiene datos utiles, pero es mas antiguo/parcial que `database/script_saip_db.sql`; no contiene toda la estructura de expediente, cedulas, notificaciones, historial y reprocesos. Decidir si se sincroniza o si se documenta como seed minimo de desarrollo. |
| Resolucion TTAIP con sufijo de sala. | Backend generator/seed | Cubierto | `ExpedienteTtaipService.generarNumeroResolucion`, seed | Mantener formato vigente con sala. |
| Cedulas con mismo numero base para ciudadano y entidad. | Backend TTAIP/seed | Cubierto parcial | `ExpedienteTtaipService.generarNumeroCedula`, `CedulaNotificacion`, seed | Servicio genera dos cedulas por resolucion; revisar concurrencia/secuencia. |
| Inadmisibilidad se notifica solo al ciudadano. | Backend TTAIP | Cubierto | `ExpedienteTtaipService.registrarResolucion` | La decision `INADMISIBLE` genera cedula/notificacion solo para `CIUDADANO`; las demas resoluciones mantienen la regla general. |
| Notificacion de admisibilidad a ciudadano y entidad. | Backend TTAIP | Cubierto parcial | `ExpedienteTtaipService`, `NotificacionTtaip` | Existe notificacion para ambos; falta validacion de constancia/acuse. |
| Descargos de entidad en 7 dias habiles. | Backend TTAIP/frontend/Postman | Falta | `TTAIPService`, `Apelacion`, `ExpedienteTtaip` | Crear entidad/endpoint de descargos y suspender plazo de resolucion. |
| Suspension por descargos, informe oral o informacion complementaria. | Backend TTAIP | Falta | `ExpedienteTtaip.fechaLimiteResolucion` | Agregar eventos de suspension y recalculo de plazo. |
| Primera calificacion en 7 dias habiles. | Backend/frontend/docs | Cubierto parcial | `TTAIPService`, frontend TTAIP | Se modela estado y resolucion; falta control/alerta estricta de plazo. |
| Segunda calificacion condicional tras subsanacion. | Backend/frontend | Cubierto | `ApelacionRestController.subsanar`, `TTAIPService.admitirApelacion` | Flujo pasa a `EN_CALIFICACION_2` y luego a notificacion/resolucion. |
| No subsanar: tener por no presentado. | Backend TTAIP | Cubierto | `TTAIPService.declararTenerPorNoPresentado` | Revisar que se emita como resolucion final o equivalente segun criterio legal. |
| Improcedencia como rechazo definitivo. | Backend TTAIP | Cubierto | `TTAIPService.inadmitirApelacion`, `declararImprocedenteFinal` | Mantener diferencia `INADMISIBLE` vs `IMPROCEDENTE`. |
| Resolucion final en 10 dias habiles desde notificacion valida de admisibilidad. | Backend TTAIP | Parcial | `TTAIPService.notificarSegundaCalificacion`, `ExpedienteTtaip.fechaLimiteResolucion` | Falta ligar inicio de plazo a notificacion valida de admisibilidad y suspensiones. |
| Decisiones finales: Fundado, Fundado en parte, Infundado, Infundado en parte, Improcedente, Sustraccion, Desistimiento. | Backend TTAIP | Cubierto | `Resolucion.DecisionResolucion`, `TTAIPService` | Ya existen endpoints/decisiones para estos resultados. |
| Decisiones finales: Estese a lo resuelto y Nulidad del acto. | Backend TTAIP | Falta | `Resolucion.DecisionResolucion`, `TTAIPService` | Agregar enums/endpoints/estados si entran al alcance funcional. |
| Cumplimiento de resolucion fundada en 7 dias habiles. | Backend TTAIP/entidad | Falta | `TTAIPService`, frontend funcionario | Modelar seguimiento de cumplimiento, evidencia y comunicacion al Tribunal. |
| Notificacion por correo con constancia y acuse automatico. | Backend notificaciones | Falta | `NotificacionTtaip` | Agregar campos de evidencia, acuse, resultado y fallback por falla. |
| Notificacion fisica si falla correo. | Backend notificaciones/reproceso | Parcial | `ReprocesoNotificacion` | Reproceso existe, falta regla automatica o manual de canal alterno. |
| Validacion manual de notificacion correcta antes de avanzar. | Backend/frontend TTAIP | Parcial | `NotificacionTtaip.estado`, `TTAIPService.notificarSegundaCalificacion` | Estado existe como texto; falta endpoint/validacion funcional. |
| Reprocesar notificacion defectuosa sin borrar original. | Backend/database/Postman | Cubierto | `ReprocesoNotificacion`, `ExpedienteTtaipService`, `TTAIPRestController`, seed, Postman | El reproceso marca la notificacion original como fallida, crea nueva cedula para el mismo destinatario, registra nueva notificacion y conserva la cedula original. |
| Historial y auditoria del tramite TTAIP. | Backend/database | Cubierto parcial | `HistorialTtaip`, `ExpedienteTtaipService`, seed | Se registran eventos clave; faltan eventos de descargos, suspensiones y cumplimiento. |
| Newman/Postman debe reflejar reglas oficiales implementadas. | Postman | Cubierto | `postman/SAIP-API-Collection-Complete.json`, `postman/SAIP-API-Environment-Complete.json` | La coleccion esta en verde y el reproceso captura una cedula/notificacion real generada en runtime; ya no depende de cedulas fijas del environment. Nuevos endpoints se documentaran cuando se implementen nuevas brechas. |
| Ayuda publica debe mostrar plazos oficiales. | Backend/frontend docs | Duda | `AyudaPublicaRestController`, frontend ayuda | La ampliacion SAIP ya refleja informe y cronograma hasta el dia 4. Queda resolver la contradiccion legal de apelacion expresa: 15 calendario vs. 15 habiles. |

## Reglas ya cubiertas

- Generacion de numero SAIP `SAIP-AAAA-NNNNN`.
- Generacion de expediente TTAIP `NNNNN-AAAA-JUS/TTAIP`.
- Inicio directo de apelacion ciudadana en primera calificacion.
- Estados base de SAIP: recepcionada, revision, pendiente informacion, respondida, denegada, concluida, vencida.
- Observacion/subsanacion SAIP formal con plazo de 2 dias habiles, comentario/documento, estado y trazabilidad.
- Ampliacion de plazo SAIP con motivo, informe, fecha de notificacion, plazo original, plazo ampliado, cronograma de entregas parciales y trazabilidad.
- Encauzamiento SAIP con entidad origen/destino, alcance `TOTAL`/`PARCIAL`, plazo de 2 dias habiles y trazabilidad.
- Liquidacion/cupon de pago SAIP para entrega o reproduccion fisica, con notificacion hasta el dia 9, plazo de recojo de 30 dias habiles, pago/recojo y archivo por no recojo.
- Silencio administrativo negativo como deteccion de vencimiento.
- Tipos de respuesta SAIP principales.
- Primera y Segunda Sala TTAIP con miembros reales en seed.
- Expediente TTAIP como agregado principal inicial.
- Resoluciones por tipo: primera calificacion, segunda calificacion y resolucion final.
- Cedulas y notificaciones asociadas a resoluciones.
- Destinatarios `CIUDADANO` y `ENTIDAD_PUBLICA`.
- Historial TTAIP y reprocesos de notificacion.
- Consentimiento obligatorio de tratamiento de datos personales en SAIP.
- Canal formal de notificacion de SAIP, incluyendo `CASILLA_ELECTRONICA`.
- Inadmisibilidad TTAIP notificada solo al ciudadano/recurrente.
- Reproceso de notificacion con nueva cedula y nueva notificacion, conservando la cedula original.
- Newman/Postman con cedula dinamica para reprocesos TTAIP.
- RFC 9457 / Problem Details mejorado.
- Newman/Postman validado previamente.

## Reglas faltantes o parciales prioritarias

1. Definir legalmente el plazo de apelacion por denegatoria expresa: calendario vs habiles.
2. Completar constancias/acuses y validacion manual de notificacion correcta.
3. Conectar el canal elegido de SAIP con evidencias reales de notificacion cuando se implemente el motor de constancias/acuses.
4. Permitir, si se aprueba, apelacion externa sin SAIP creada en plataforma.
5. Definir si se implementa elevacion por entidad o se conserva solo flujo directo.
6. Agregar descargos de entidad y suspension de plazo.
7. Agregar informe oral/informacion complementaria y suspension adicional.
8. Agregar constancia de envio, acuse automatico y fallback de correo.
9. Agregar cumplimiento de resolucion fundada en 7 dias habiles.
10. Agregar decisiones finales `ESTESE_A_LO_RESUELTO` y `NULIDAD_DEL_ACTO` si quedan dentro del alcance.

## Cambios implementados en esta iteracion

Se implementaron brechas prioritarias y seguras: consentimiento de datos personales en SAIP, canal formal de notificacion con casilla electronica, observacion/subsanacion SAIP formal con plazo y trazabilidad, ampliacion de plazo SAIP con informe y cronograma de entregas parciales, encauzamiento SAIP con entidad origen/destino y alcance total/parcial dentro de 2 dias habiles, liquidacion/cupon de pago para entrega fisica con pago, recojo y archivo por no recojo, excepcion de cedula/notificacion solo al ciudadano para inadmisibilidad, reproceso de notificacion fallida con nueva cedula y nueva notificacion vinculadas, conservacion de la cedula original y Postman/Newman con cedula dinamica generada durante el flujo. Las reglas restantes marcadas como `Falta` o `Parcial` requieren implementacion planificada, pruebas backend, actualizacion de Postman y, cuando aplique, ajuste visual/funcional de frontend.
