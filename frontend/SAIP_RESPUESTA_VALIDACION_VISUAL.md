# Respuesta SAIP: presentación y validación acotada

Revisión del 23–24 de octubre de 2026. Alcance: detalle institucional, formulario
de respuesta y confirmación/recuperación de recepción. No se modifica autenticación,
API, migraciones, Kotlin, numeración, firma ni emisión formal.

## Contraste y correcciones

Se compararon `EntityRequestDetail.tsx`, `EntityResponse.tsx`,
`AreaResponsablePanel.tsx`, `ConfirmSubmitModal.tsx`, `SuccessModal.tsx` y los
estilos de navegación del prototipo con los componentes Angular correspondientes.

| Diferencia comprobada | Resultado de esta entrega |
| --- | --- |
| Enlace de retorno plano; la leyenda institucional quedaba en la misma línea | Estilo de retorno del prototipo, compartido únicamente por estas dos pantallas |
| Panel de área ausente | Mismo encabezado y contenedor, con indisponibilidad explícita: el contrato no aporta asignación ni comando persistente |
| Denegatoria sin documentos visibles aunque la recepción contenía dos archivos | Documentos reales disponibles para los tres tipos, con identificación por documento y respuesta |
| Parcial sin campo para introducir fundamento ni recuperación visible del fundamento registrado | Campo de fundamento, conservación en el comando existente y visualización desde la respuesta recuperada |
| «Confirmar y notificar», «Resolución» y «Respuesta emitida» describían un registro | «Registrar respuesta» y «Respuesta registrada». No acreditan entrega, eficacia, firma ni emisión |
| Fecha límite como sustituto de fecha de respuesta; fundamentos y descripción predeterminados | Información faltante explícita, sin fechas ni argumentos legales inventados |
| «Inmediato» como plazo de entrega sin evidencia | Se explica que el registro no acredita entrega efectiva |
| Detalle basado en snapshot de ruta, sin cancelación de consultas anteriores | Seguimiento de ruta, cancelación y comprobación de generación/sesión; limpieza de datos, plazo y preview |
| Error en solicitudes previas ocultado como listado vacío | Indisponibilidad explícita, sin ampliar autorización del endpoint ciudadano |
| Etiquetas sin asociación, pestañas sin semántica y foco fuera del modal | Etiquetas vinculadas, tabs con teclado y foco contenido/restaurado en los diálogos de este flujo |
| Archivo de 73 bytes presentado como 0 KB | Tamaño en bytes para archivos menores de 1 KB |

La asignación del prototipo se guarda en almacenamiento local: no se incorpora
como actuación real. Tampoco se adoptan sus datos, Supabase ni confirmaciones
locales. Se mantienen los adjuntos opcionales y las precondiciones del servidor.
La opción de foco y la de selección por teclado son opt-in; los demás consumidores,
incluidas las entradas de autenticación, conservan su comportamiento.

Persisten diferencias justificadas o pendientes: cabecera global de Angular fuera
de este alcance; panel de área sin operación backend; plazo de apelación del
prototipo expresado en días hábiles frente al calendario que ya usa este flujo.
No se cambia esa regla por conveniencia visual.

En los datos sintéticos, `SolicitudDTO.diasRestantes` devolvió 11 y
`plazo-seguimiento.diasRestantes` devolvió 14 para una presentación del 23/10/2026
y límite del 06/11/2026. El formulario y el detalle utilizan respectivamente esas
fuentes. Se registra la discrepancia para una entrega de dominio: no se recalcula
en cliente ni se modifican duraciones/calendarios.

## Entorno y evidencia

Se arrancó Spring normal sobre PostgreSQL 18 propio, nuevo y aislado. Flyway aplicó
las diez migraciones originales, con historial exitoso; Hibernate validó el esquema
con `ddl-auto=validate`. LOCAL, notificaciones MOCK y push apagado. Cuentas, entidades,
solicitudes y archivos sintéticos; login y creación de solicitudes mediante API real.
La suite PostgreSQL utilizó otra base temporal independiente.

El frontend de navegador usó una copia del código con una URL de API temporal que
apuntaba a un proxy loopback de pruebas. El proxy permite perder la confirmación
después del commit o fallar una consulta; no registra Bearer ni cuerpos. Esa URL
no pertenece al código publicado. El candidato de pruebas/build se extrajo desde
HEAD y recibió solo los cambios propios, conservando el environment original y
excluyendo los tres archivos administrativos pendientes.

| Escenario | Evidencia ejecutada y límite |
| --- | --- |
| Total sin adjuntos | Navegador con login real: recepción 1/respuesta 1, recuperación y navegación al detalle, antes de estas correcciones visuales |
| Total, parcial y denegatoria con dos archivos cada una | HTTP real, PostgreSQL y LOCAL; mismos IDs al repetir, asociaciones y SHA-256 comprobados al recuperar y descargar |
| Denegatoria después de recargar | Navegador sobre Angular corregido: causal, fundamento y dos documentos recuperados visibles en árbol accesible |
| Fallo físico de almacenamiento | Se sustituyó temporalmente la carpeta LOCAL propia por un archivo; HTTP 500, solicitud sin respuesta, archivos anteriores intactos; carpeta restaurada |
| Pérdida de confirmación después del commit | Proxy de prueba sobre Spring/DB reales: POST sin confirmación, primera consulta 503, recuperación posterior y reintento idéntico con la misma recepción; huella incompatible 409 |
| Otra entidad, otro actor y anónimo | HTTP real: 403/401; observación pendiente 409 y sin respuesta persistida |
| Concurrencia y compensación transaccional | Suite PostgreSQL existente: base y almacenamiento reales; aislamientos/fallos inducidos descritos en la suite, no una prueba de caída de proceso ni reparación duradera |
| Consulta fallida, cambio de ruta/sesión, respuesta tardía, teclado y mensajes | Pruebas Angular con router/plantillas reales y servicios simulados; no equivalen a navegador ni persistencia |

Ver el contrato y límites persistentes en
[recepción coordinada](../backend/SAIP_RESPUESTA_RECEPCION.md). No hay modificación
del contrato en esta entrega; sus snapshots parciales y la deriva previa permanecen.
La revisión estática de `SolicitudRepositoryImpl.kt` conserva la integración Android
anterior: no se cambia Kotlin ni se declara probada su compatibilidad extremo a extremo.

## Navegador y capturas

El navegador integrado no arrancó: `privileged native pipe bridge is not available;
browser-client is not trusted`. Se utilizó Edge mediante CUA. La selección de
archivos rechazó `setFiles` porque requiere el permiso «Allow access to file URLs»;
no se cambió ese permiso. Las consultas nativas `list_apps`/`list_windows` agotaron
el tiempo. Después, la espera del evento de descarga y la recuperación de pestaña
e inventario CUA también agotaron el tiempo. La descarga desde navegador no quedó
confirmada; sus bytes sí se comprobaron por HTTP.

Las capturas permanecen como evidencia local sin datos reales: referencia y Angular
previo en escritorio 1280×540; referencia en 390×540; detalle, confirmación y resultado
previos no constituyen un juego final. Las dos imágenes nombradas como confirmación
y éxito son idénticas y muestran la página de fondo: se descartan como evidencia de
diálogos. El registro se acredita con API y navegación, no con esas imágenes.
No existe un juego completo de capturas finales Angular. Se midieron en
DOM la tipografía Fraunces del título, fondo claro y contenedores de la referencia;
no se realizó una comparación de píxeles ni se asigna un porcentaje de paridad.

Pendientes en navegador: parcial/denegatoria sin archivos, selección y subida de
varios archivos, preview, descarga confirmada, errores/resultado incierto mediante
interfaz, cambio de sesión o solicitud con petición pendiente, rechazos visibles,
capturas finales equivalentes, pantalla pequeña Angular, oscuro y teclado tras la
corrección. Las pruebas HTTP y los mocks no sustituyen esas comprobaciones.

## Pruebas y reproducción

RED focalizado: 7 fallos y 2 aprobadas antes de corregir. Corrida intermedia de cuatro
archivos: 57 aprobadas, incluyendo las regresiones; no sumarla a corridas posteriores.
Corrida final del candidato: **59/59 en cinco archivos**, con las dos pruebas de
selección por teclado incluidas. Servicios/HTTP simulados, router y plantillas
Angular reales. Los fuentes comprobados coinciden con la selección que se publica, salvo la normalización de finales
de línea de Git; el rediseño administrativo pendiente queda excluido.

La suite real `RespuestaSaipRecepcionPostgresIntegrationTest` ejecutó 27 casos:
26 aprobados y un error al exportar OpenAPI porque no existía el directorio temporal
de artefactos. Creado ese directorio, se repitió únicamente
`contratoYFlywayConValidacionCompleta`: aprobado. Es evidencia acumulada; no hubo una
nueva corrida completa de 27 casos en verde. El contrato completo se conservó
temporalmente, sin sobrescribir snapshots.

La primera suite Angular general se lanzó por error desde el runtime de navegador,
con su URL temporal: 273 aprobadas/261 fallidas, incluyendo expectativas de URL y
errores posteriores de TestBed. Esa corrida no valida el candidato publicado.
En la copia limpia, la suite general volvió a fallar al arrancar el worker forks,
sin ejecutar casos. Un smoke test independiente del mismo pool pasó (1 caso).
No se aumentaron timeouts ni se modificaron dependencias/configuración del producto.
En la corrida focalizada final se desactivaron únicamente la caché de compilación
de Node y la analítica del CLI mediante variables del proceso; no se reparó una
caché global ni se atribuye a estas opciones la causa del fallo general.

Comandos, con dependencias ya disponibles, desde `frontend/`:

```powershell
# Archivo temporal externo al repositorio; no modificar angular.json.
$runner = Join-Path $env:TEMP ('yaiku-vitest-' + [guid]::NewGuid().ToString('N') + '.mjs')
Set-Content $runner 'export default { test: { maxWorkers: 1, fileParallelism: false } };'
node node_modules/@angular/cli/bin/ng.js test --watch=false --runner-config=$runner
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.spec.json
node node_modules/@angular/cli/bin/ng.js build
```

Para repetir los 59 casos focalizados, con el mismo runner temporal:

```powershell
$env:NODE_DISABLE_COMPILE_CACHE = '1'
$env:NG_CLI_ANALYTICS = 'false'
node node_modules/@angular/cli/bin/ng.js test --watch=false --runner-config=$runner --include=src/app/pages/funcionario/respuesta-visual.spec.ts --include=src/app/pages/funcionario/funcionario-responder.component.spec.ts --include=src/app/pages/funcionario/funcionario-solicitud-detalle.component.spec.ts --include=src/app/shared/reference-modal-focus.spec.ts --include=src/app/shared/response-accessibility.spec.ts
```

Tipos app/spec y build SSR del candidato aprobados. Aviso preexistente de bundle
inicial: 870,87 kB frente al umbral de aviso de 550 kB. Comando PostgreSQL desde
`backend/`, con los opt-ins y URL de una base propia descritos en
[verificación](../backend/VERIFICACION.md):

```powershell
./mvnw.cmd -o -Dtest=RespuestaSaipRecepcionPostgresIntegrationTest test
./mvnw.cmd -o '-Dtest=RespuestaSaipRecepcionPostgresIntegrationTest#contratoYFlywayConValidacionCompleta' test
```

Para retomar la comprobación manual: iniciar los servicios aislados con las mismas
condiciones, entrar por acceso interno, abrir una solicitud de la entidad y registrar
cada tipo con/sin archivos conocidos. Conservar UUID e IDs, recargar, recuperar la
recepción y descargar; comparar SHA-256 con los originales. Repetir con fallos de
transporte/LOCAL, otra entidad y observación pendiente; no confirmar una actuación
solo por el cierre del diálogo o por un mensaje local.
