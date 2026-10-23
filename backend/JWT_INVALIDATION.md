# Invalidación de JWT por desactivación de cuenta

La identidad sigue siendo `sub=saip:user:v1:<idUsuario>`. Además de comprobar
firma, expiración, existencia, estado actual y permisos, el filtro contrasta el
claim firmado `authVersion` con `usuarios.version_autenticacion`.

## Mecanismo persistente

- V6 añade un `BIGINT NOT NULL DEFAULT 0`, con restricción de valor no negativo.
  No modifica V1–V5 ni las claves de firma.
- El claim se emite como texto decimal canónico para conservar todo el rango de
  `Long`, sin depender de la conversión numérica del decodificador JSON.
- `UsuarioService.cambiarEstado` ejecuta una sentencia que modifica `activo` e
  incrementa la versión al pasar de activo a desactivado. Ambos cambios comparten
  transacción y bloqueo de fila. Repetir la desactivación no vuelve a incrementarla.
- Reactivar conserva la versión. Un nuevo login obtiene la versión actual; los
  tokens emitidos con una anterior siguen recibiendo el 401 genérico.

Una versión por cuenta invalida todos sus JWT anteriores por desactivación. El
cierre individual descrito abajo tiene un alcance distinto y no cambia esa versión.

## Escrituras y concurrencia

Los cambios de estado deben pasar por `UsuarioService.cambiarEstado`, o por
`guardarUsuario(usuario, activo)` para la edición administrativa transaccional.
Lo hacen las cuatro rutas existentes: PUT `/api/usuarios/{id}` y PATCH
`/api/usuarios/{id}/estado`, `/api/ciudadanos/{id}/estado` y
`/api/funcionarios/{id}/estado`.

`activo` no admite actualización mediante merge JPA ordinario. La versión tampoco
admite inserción/actualización JPA, no tiene setter y queda excluida de JSON y del
contrato API. La base inicializa la versión y la operación de estado calcula el
incremento; ningún DTO suministra su valor. Un perfil antiguo puede actualizar sus
datos ordinarios, pero no reactivar accidentalmente la cuenta ni reducir la versión.
Incluso una reactivación administrativa explícita conserva la invalidación.

## Transición y alcance

Los tokens basados en email siguen rechazados. También se rechazan los tokens con
subject estable emitidos antes de incorporar `authVersion`: **requieren iniciar
sesión nuevamente**. No se supone que una versión ausente equivalga a cero.
Versiones mal formadas o distintas de la actual reciben el mismo 401 genérico.

Bearer, `AuthResponse.token`, los demás campos de login, el formulario y el
almacenamiento de sesión permanecen compatibles con Angular y Android.

## Cierre de la sesión actual

`POST /api/auth/logout` deriva usuario, `jti` y expiración exclusivamente del Bearer
verificado por el filtro. No recibe un identificador de sesión o usuario en el
contrato. Cada emisión usa un UUID v4 aleatorio firmado como `jti`, incluidos los
logins simultáneos. Los tokens con identidad y versión correctas pero sin un `jti`
v4 canónico o sin expiración se rechazan con 401 y requieren un nuevo login. Los
tokens anteriores que ya incluyen estos campos siguen siendo compatibles.

V7 añade `sesiones_jwt_revocadas`, con clave `(id_usuario, jti)`, expiración firmada
y fecha de revocación. Es el único mecanismo de invalidación individual: no guarda
JWT completos ni hashes de sus bytes. Un insert atómico con conflicto ignorado
permite concurrencia sin duplicados. El filtro consulta esta evidencia después de
verificar firma, claims, estado de cuenta y `authVersion`.

El primer cierre confirmado devuelve 204 sin cuerpo. Un Bearer ya revocado,
inválido o expirado recibe el 401 genérico, incluso en logout. Peticiones concurrentes
pueden devolver 204 o 401; nunca restauran la sesión. Los demás `jti` del usuario
permanecen válidos. Las pestañas que comparten el mismo JWT comparten su revocación.

No hay limpieza automática en esta entrega. Las filas se conservan; una limpieza
futura solo podrá eliminarlas después de la expiración firmada, manteniendo la
validación de expiración sin tolerancia adicional. No se elimina una revocación
mientras su emisión pueda aceptarse. El borrado de la cuenta elimina sus filas por
FK; el usuario inexistente ya es rechazado por el filtro.

Angular captura el token al pulsar «Salir», envía ese Bearer explícito y limpia el
almacenamiento local inmediatamente, también sin red. Solo una respuesta exitosa
confirma la invalidación del servidor; fallo, timeout o rechazo indican cierre local
sin confirmación. Una respuesta tardía no borra ni navega sobre un nuevo login.
Los botones desktop y móvil comparten el manejador. Android conserva su contrato
de login, pero todavía debe integrar este endpoint; no se cambió código Kotlin.

La invalidación afecta futuras comprobaciones de autenticación después del commit.
No cancela operaciones que ya superaron el filtro ni revierte sus efectos. El logout
por todos los dispositivos y la política general de expiración, inactividad y
renovación siguen pendientes. «Salir» no incrementa `authVersion`.
