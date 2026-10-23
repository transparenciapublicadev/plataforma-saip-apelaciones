# Inicio del plazo de subsanación TTAIP

## Regla y evidencia

La regla consolidada validada en `docs/business-rules/SAIP_TTAIP_REGLAS_NEGOCIO.md`
(secciones de primera calificación, notificaciones, cédulas y reprocesos) establece
dos días hábiles desde la notificación del requerimiento al recurrente. La misma
fuente distingue notificación entregada/validada de envío y notificación defectuosa.
El DOCX original `Flujo SAIP Y TTAIP_081942.docx` no estuvo accesible en esta entrega;
no se afirma haberlo cotejado. No se modifica duración, calendario ni estados legales.

La actuación que requiere subsanación es la resolución de primera calificación
`INADMISIBLE`. El flujo genera su cédula y notificación **solo para CIUDADANO**.
El vínculo debe ser resolución → cédula → notificación del mismo expediente y
recurrente; no basta la última notificación de cualquier destinatario del expediente.

V9 añade `inicios_plazo_subsanacion_ttaip`, sin alterar V1–V8. Registra por
requerimiento la primera eficacia acreditada: notificación, ciudadano, fecha,
duración, fuente, sustento y fecha de registro. Se establece en la misma transacción
que registra evidencia mediante los servicios de notificación existentes:

- Acuse explícito `ENTREGADO` que deja estado `ENTREGADA`, con contenido y
  `fechaAcuse` proporcionada. Para correo requiere también constancia de envío.
- Validación manual sustentada que deja estado `VALIDADA`, con `fechaEficacia`
  proporcionada y distinta de `fechaValidacionManual` (fecha de actuación del operador).

La fecha debe corresponder al intervalo entre resolución y registro actual.
Los estados pendientes, fallidos, no recibidos u observados no crean el inicio.
La aceptación técnica por SMTP, push u otro proveedor tampoco lo crea, aunque un
proveedor utilice la etiqueta `ENTREGADO`: se exige registro explícito de evidencia.
No se utiliza creación, apertura, intento de envío ni la fecha actual como sustituto.
Los documentos/constancias formales y su emisión siguen fuera de esta entrega;
se reutiliza la representación de evidencia textual/referencia del modelo validado.

## Recepción, consultas y tareas

`plazo` en el requerimiento y `plazoSubsanacion` en los DTO de apelación comparten
`PlazoSubsanacionTtaipDTO`: `PENDIENTE_INICIO`, `EN_CURSO` o `VENCIDO` son estados
**del reloj**, no nuevas etapas legales. Incluye requerimiento, notificación,
fecha eficaz, límite, días hábiles restantes y fuente. Pendiente implica fechas,
notificación y días restantes nulos; no cero ni vencimiento.

La recepción, el proceso diario y el cierre manual por no presentación usan ese
mismo inicio. Se mantiene `DiasHabilesUtil`: excluye el día base al sumar los días
aprobados y permite presentar durante todo el día límite. Un reloj pendiente no
bloquea por sí mismo la presentación ya habilitada en `EN_SUBSANACION`/`INADMISIBLE`.
La recepción idempotente previamente confirmada se recupera antes de evaluar el
vencimiento o el estado posterior. Adjuntos opcionales y compensación de subidas
permanecen como en la entrega de recepción.

Corrección R3: un rechazo por vencimiento conserva `EN_SUBSANACION` y no registra
un cierre como efecto lateral. La tarea diaria cuenta requerimientos vencidos
pendientes de resolución, sin fabricar una actuación. Mientras no se registre el
comando `calificacion/{id}/no-presentado`, el mismo caso puede aparecer en sucesivas
ejecuciones. El comando exige inicio acreditado, plazo vencido y ausencia de
recepción, y registra su resolución con fundamentos. Véase [transiciones](TTAIP_TRANSICIONES.md).

La primera inscripción se serializa mediante bloqueo de la apelación; la PK del
requerimiento refuerza su unicidad. El inicio es inmutable en JPA. Envío, reenvío,
reproceso, nueva cédula, nuevo acuse o validación posterior conservan esa fecha,
aunque registren una fecha posterior. Se conserva evidencia original y trazabilidad
de la nueva actuación; una fecha nueva no rectifica silenciosamente el plazo.

No se implementa una rectificación legal de un inicio ya acreditado. Si la nueva
evidencia contradice la inicial, requiere revisión y una actuación explícita
que identifique sustento, responsable, fecha anterior/nueva y efecto autorizado.
Ese procedimiento debe validarse antes de habilitar una mutación. El reproceso
existente, por sí solo, no sustituye esa decisión ni anula retroactivamente el inicio.

## Históricos y consumidores

No se hace backfill ni recálculo masivo. `Apelacion.fechaSubsanacion` y las fechas
operativas de notificación permanecen intactas. Incluso un histórico `ENTREGADA`
o `VALIDADA` sin el registro nuevo se muestra `PENDIENTE_INICIO`: la etiqueta sola
no permite inferir cuándo fue eficaz. Las fechas operativas anteriores podían
completarse automáticamente con el momento del registro; su procedencia no queda
distinguida de una fecha de entrega declarada. Un operador puede registrar evidencia fechada
verificada mediante las operaciones existentes; omitirla conserva el reloj pendiente.
Los cierres históricos ya efectuados no se reabren automáticamente.

Si todavía no hay un requerimiento inadmisible, los DTO de apelación omiten el
campo nuevo del reloj; no publican un plazo ficticio.

La extensión es aditiva: no cambia rutas, Bearer, login, archivos multipart ni
respuestas de recepción. Los campos anteriores del requerimiento `fechaBasePlazo`,
`fechaLimite` y `diasHabilesRestantes` pasan a reflejar solo eficacia acreditada y
pueden ser nulos (eran opcionales en el contrato). `fechaSubsanacion` se mantiene
como dato histórico y se documenta como obsoleto para calcular el plazo.
`fechaAcuse` omitida conserva el registro operativo con fecha actual, pero no
inicia este plazo. `fechaEficacia` manual es opcional; clientes antiguos siguen
pudiendo validar, pero no deben afirmar que esa validación inició el plazo.

Angular usa exclusivamente el reloj del servidor para formulario y paneles;
las fechas históricas no se convierten en días calendario. Los formularios de
acuse y validación permiten ingresar la fecha acreditada sin prellenarla con hoy.
No se ha cambiado el diseño ni la sesión.

Los snapshots conservan su actualización parcial deliberada. Se actualizan desde
`/v3/api-docs` real exactamente seis esquemas: `ApelacionDTO`, `ApelacionInfoDTO`,
`RequerimientoSubsanacionTtaipDTO`, `PlazoSubsanacionTtaipDTO`,
`ValidarNotificacionManualRequest` y `RegistrarAcuseAutomaticoNotificacionRequest`.
Se verifican veinte esquemas en total, incluidos los seis afectados y el cierre
de sus referencias transitivas; no se cambian rutas ni
requisitos de autenticación. Los snapshots contienen 161 rutas/89 esquemas frente
a 163 rutas/95 esquemas de la instancia completa. No se
presenta esto como sincronización completa: permanecen las rutas/esquemas de
configuración/administración excluidos y la deriva anterior en ocho rutas.

No se modifica Kotlin. Android debe integrar el reloj explícito antes de mostrar
un plazo; se conserva además la incompatibilidad previa de su presentación
multipart al endpoint JSON, detallada en `TTAIP_SUBSANACION_RECEPCION.md`. La revisión
estática y el contrato no equivalen a una ejecución Android.

## Verificación manual complementaria

1. Abrir una apelación sintética `EN_SUBSANACION` con requerimiento inadmisible y
   sin evidencia: formulario y paneles deben mostrar inicio pendiente, sin vencimiento.
2. Registrar constancia de envío, luego acuse fallido/observado: debe seguir pendiente.
3. Registrar entrega acreditada con fecha explícita o validar manualmente con
   sustento y fecha eficaz distinta de creación. Revisar IDs y límite en consultas.
4. Reenviar/reprocesar y registrar evidencia posterior: el inicio y límite originales
   deben permanecer. Una contradicción exige revisión, no ampliación automática.
5. Presentar dentro del plazo; recuperar la misma recepción con igual clave después.
   Probar otro caso fuera de plazo: sin recepción ni archivos nuevos confirmados.
