# Staging local y migraciones originales

El perfil `staging` es el arranque local con almacenamiento Supabase. La clave
JWT sigue en `application.properties`, con el fallback de desarrollo si
`JWT_SECRET` no viene en `backend/.env`. Flyway usa
`classpath:db/migration,classpath:db/seed`, la misma historia que `saip_db`.
La imagen de producción no copia `db/seed` ni este perfil, y su perfil `prod`
se queda en `classpath:db/migration`.
No se rotan claves, cambian cuentas existentes ni se editan migraciones aplicadas.

`StagingConfigurationTest` comprueba que, sin `JWT_SECRET`, staging conserva la
clave de desarrollo de `application.properties`, que una clave explícita la
sustituye, y que Flyway local resuelve `db/seed` mientras `prod` no lo incluye.
Son pruebas de
configuración sin proveedores externos ni PostgreSQL; no acreditan producción.
Los tres contextos de pruebas staging previos aportan claves generadas por
`DynamicPropertySource`; sus expectativas funcionales se conservan.

## Antes de aplicar a un entorno existente

- Identificar primero imagen/commit, perfiles activos, configuración de secretos
  y ubicaciones Flyway reales, mediante metadatos sanitizados.
- Una base histórica con migraciones seed necesita un plan revisado para su
  historial. No editar V2, borrar historial ni ignorar faltantes para conseguir verde.
- Si se demuestra que la clave compartida estuvo activa, preparar rotación e
  invalidación de sesiones con el responsable; esta corrección no las ejecuta.
- Si se demuestran cuentas demo activas, revisar su acceso y preparar su
  desactivación/credenciales únicas con autorización. El código publicado no
  demuestra por sí solo la existencia o exposición de esas cuentas.

El fallback del perfil de desarrollo general permanece fuera de esta corrección.
El Dockerfile preparado lo retira del artefacto y excluye staging/seed mediante
`.dockerignore`; eso no identifica la imagen efectivamente desplegada. La consulta
de metadatos del despliegue sigue pendiente. No se prueba login demo ni carga
contra producción como parte de esta entrega.

## Comprobación del candidato — 2026-11-07

`./mvnw.cmd -o test` en copia aislada del candidato publicado: 505 casos,
290 aprobados, 0 fallos/errores y 215 opt-ins omitidos. Una sola corrida final,
sin sumar la reproducción RED ni reejecuciones. La suite incluye Mockito/H2;
no acredita PostgreSQL, Supabase, SMTP o perfil desplegado reales. Se excluyó
el cambio local preexistente de prod, que no forma parte de esta publicación.
