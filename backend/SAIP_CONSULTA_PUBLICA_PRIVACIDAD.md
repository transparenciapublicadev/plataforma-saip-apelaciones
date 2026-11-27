# Consulta pública SAIP: minimización del asunto

La extensión `GET /api/solicitudes/publica/expediente?expediente=…` permite
consultar números SAIP y TTAIP completos. La barra de TTAIP viaja en el parámetro,
sin relajar el tratamiento de barras en las rutas. La ruta anterior sigue
disponible para SAIP. Ambos accesos devuelven el mismo resumen para una apelación
vinculada, sin caché. Una apelación externa informa su número, estado y fechas
propias, sin inventar una SAIP ni publicar el nombre libre de una entidad declarada.
La proyección se construye en una transacción de lectura para recuperar el estado
y la resolución vinculada con `open-in-view=false`. El snapshot incorpora solo la
nueva ruta y el esquema público actualizado, capturados del OpenAPI de Spring.

La revisión inicial del 2026-10-26 cubrió la ruta SAIP anterior y la minimización
de su respuesta. Los resultados de esa revisión se conservan a continuación.

## Reproducción y acceso

La reproducción usó Spring/Tomcat y HTTP reales, PostgreSQL 18.4 temporal propio,
JPA y transacciones confirmadas. Flyway aplicó las diez migraciones originales y
el contexto arrancó con `ddl-auto=validate`. LOCAL estuvo configurado; no se
probaron archivos en esta entrega. Notificaciones en MOCK y push deshabilitado.

Una solicitud sintética tenía un marcador personal inequívoco en `asunto`.
Antes de corregir, el GET **sin Bearer** respondió 200 y devolvió íntegro ese
marcador. Los logins reales del titular y de otro ciudadano obtuvieron la misma
proyección pública. Las dos regresiones de minimización fallaron; las otras cinco
comprobaciones de contexto, búsqueda y controles privados pasaron.

En la revisión inicial, la consulta exigía únicamente el código SAIP, sin DNI,
RUC, token ni titularidad. Un código
incorrecto o inexistente produjo 404 en los tres casos sintéticos probados,
sin enumeración masiva. La ausencia de Bearer en esta operación no es un bypass
del detalle privado: se trata de rutas y proyecciones distintas.

Recorrido comprobado: `SolicitudRestController.obtenerPublicaPorExpediente` llama a
`SolicitudService.findByExpediente` y `SolicitudRepository.findByExpediente`; convierte
la entidad mediante `ConsultaPublicaSolicitudDTO.from`. Jackson serializa ese record
como JSON, no la entidad ni `SolicitudDTO`. `SecurityConfig.filterChain` permite el
GET público; el controlador no añade comprobación de titularidad a esta proyección.
En las rutas privadas, el mismo controlador usa
`AutorizacionRecursosService.verificarSolicitudAccesible` antes de devolver `SolicitudDTO`.
En Angular, `SolicitudService.consultarPublicamente` y `ConsultarComponent`
consumen únicamente la ruta pública. La autenticación existente puede adjuntar Bearer,
pero la prueba con tokens válidos no obtuvo campos privados adicionales.

## Campos y decisión

| Campos anteriores | Tratamiento y alcance |
| --- | --- |
| `expediente`, `entidad`, `estado` | Conservados para identificar y seguir la solicitud. |
| `fechaPresentacion`, `fechaLimite`, `diasTranscurridos`, `diasRestantes` | Conservados como datos del servidor; no se cambia su cálculo ni calendario. |
| `ciudadano` | Se conserva la identificación enmascarada existente; su necesidad y riesgo residual de reidentificación requieren una revisión de producto separada. |
| `respuestaFecha`, `respuestaTipo` | Conservados como metadatos de registro; no acreditan entrega o notificación eficaz. |
| `apelacionExpediente`, `apelacionEstado`, `apelacionFecha`, `resolucionFecha`, `resolucionResultado` | Conservados como resumen de la apelación vinculada. No habilitan acceso privado ni certifican firma/emisión. La política de publicidad de estos metadatos no se revisó integralmente. |
| `asunto` | **Retirado de la proyección pública**, no enviado como null, truncado ni texto supuestamente anonimizado. |

El asunto es texto libre del pedido y no es necesario para devolver código,
estado y fechas de seguimiento. Las reglas validadas describen consentimiento
para fines del procedimiento, no una autorización de publicación indiscriminada
del texto del pedido: [reglas de datos personales](../docs/business-rules/SAIP_TTAIP_REGLAS_NEGOCIO.md).
La disponibilidad técnica previa del campo y la referencia de UX no justifican
su publicidad. Esta decisión minimiza el dato demostrado sin inventar una nueva
obligación legal ni cambiar el mecanismo de acceso al endpoint.

La entidad persistida y `SolicitudDTO` privado conservan asunto y descripción.
Se verificó por HTTP que titular y funcionario de la entidad pueden recuperarlos;
sin sesión se obtiene 401, y otro ciudadano o un funcionario de otra entidad reciben
403 sin el marcador. No se cambian roles, autenticación, transiciones o migraciones.

## Contrato y consumidores

- `ConsultaPublicaSolicitudDTO` pasa de 16 a 15 propiedades. Eliminar `asunto` es un
  cambio intencional para consumidores que lo leían: deben dejar de esperarlo en
  la consulta pública y usar el detalle autorizado cuando corresponda.
- El OpenAPI vivo anterior heredaba Bearer global, aunque HTTP permitía acceso
  anónimo. Se documenta `security: []` exclusivamente en esta operación mediante
  `@SecurityRequirements`; no se modifica Spring Security ni la seguridad global.
- Se capturaron contratos completos antes/después. Salvo la URL efímera de la
  instancia, las únicas diferencias son esa declaración y la eliminación del campo.
  Ambos snapshots incorporan solo la operación pública y su esquema, sin otras
  referencias transitivas. Las 80 diferencias de contenido restantes con el contrato
  vivo se conservan; incluyen configuración/URL y deriva previa. No hay sincronización
  global ni se recalifican esas diferencias como introducidas por esta corrección.
  Entre ellas hay orden de tags/identificadores generados, registro de ciudadanos,
  administración, configuración y actividad reciente; no se incorporan aquí.
- Angular regenera `schema.ts` desde el snapshot acotado, elimina el campo de su
  tipo/proyección pública y explica que el detalle requiere acceso autorizado.
  La ausencia intencional no se presenta como información incompleta. Incluso si
  llega una respuesta legacy con asunto, no se conserva ni se muestra. No hay
  consultas privadas complementarias ni cambios al almacenamiento de sesión.
- En la búsqueda estática de `mobile/core` y `mobile/app/src/main` no se identificó
  consumo Kotlin de la operación/DTO público. `SolicitudApiService.getByExpediente`
  usa el endpoint privado y su DTO, que permanecen intactos. Solo cambia el nodo
  correspondiente de `mobile/openapi.json`; no se modifica ni ejecuta Kotlin y
  no se declara compatibilidad móvil probada.

## Verificación reproducible

[ConsultaPublicaPrivacidadPostgresIntegrationTest](src/test/java/pe/gob/saip/backend/controller/ConsultaPublicaPrivacidadPostgresIntegrationTest.java)
ejecuta siete casos por HTTP de red, sin MockMvc ni mocks de autenticación,
controladores o repositorios. Solo el proveedor externo de notificaciones es MOCK.
Verifica cuerpo JSON permitido, igualdad con/sin sesión, rechazo del detalle ajeno,
recuperación privada autorizada, códigos incorrectos y contrato vivo/Flyway.

Desde `backend`, con un clúster **propio y desechable** ya creado y accesible solo
en loopback, usuario de prueba `yaiku_e11_test` y contraseña vacía únicamente allí:

```powershell
$env:E11_POSTGRES_URL = 'jdbc:postgresql://127.0.0.1:<puerto>/yaiku_e11_closeout_<32hex>'
$env:RUN_PUBLICA_PRIVACY_POSTGRES_TESTS = 'true'
$env:PUBLICA_PRIVACY_ARTIFACTS = '<directorio privado existente>'
./mvnw.cmd -o '-Dtest=ConsultaPublicaPrivacidadPostgresIntegrationTest' test
```

`-o` requiere las dependencias ya disponibles. La prueba rechaza URLs fuera de
ese patrón aislado y no limpia bases existentes. La fixture usa cuentas sintéticas,
contraseñas efímeras y códigos distintos derivados de identidades de prueba
persistidas; admite repetición sin truncar los datos anteriores. No se guardan JWT
ni respuestas de login en las evidencias. Las capturas completas permanecen locales.

Resultado final: **7/7**, cero fallos, errores u omitidas. Una ejecución intermedia
falló en la fixture por datos constantes reutilizados; no llegó a verificar la
corrección y no se cuenta como resultado de producto. No hubo nueva comprobación
de navegador, de Android ni de todos los demás endpoints públicos.

Angular: ejecución general final **872/872**, 50 archivos, sin fallos ni omisiones;
incluye 59 casos del componente público con HttpTesting/jsdom, no HTTP Spring real.
Tipos `tsconfig.app.json` y `tsconfig.spec.json` y build de producción terminaron con
código 0 sobre candidato aislado con environments originales. Se conservan los
avisos previos de presupuesto inicial y CommonJS, sin cambiar límites ni dependencias.
