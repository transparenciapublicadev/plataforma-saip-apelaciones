# Mobile Role Apps

La app mobile se distribuye como tres APKs independientes mediante flavors Gradle:

- `ciudadano`: `com.gestion.misaip.ciudadano`, app publica para Google Play.
- `funcionario`: `com.gestion.misaip.funcionario`, app interna para entidades publicas.
- `ttaip`: `com.gestion.misaip.ttaip`, app restringida para miembros del TTAIP.

La regla de runtime vive en `app/src/main/java/com/gestion/misaip/config/AppRolePolicy.kt`.
Usarla siempre que una pantalla, sesion guardada o deep link pueda cruzar roles.

## Backend

La fuente de verdad para autenticacion, datos y reglas de negocio es el backend Spring Boot + JWT.

- `core:network` consume REST con Retrofit + OkHttp.
- `core:data` implementa repositorios contra REST y cache local SQLDelight.
- `openapi.json` es el snapshot de referencia del contrato actual y se actualiza con `scripts/sync-openapi.ps1`.
- Firebase Auth y Firestore no deben usarse como backend de datos.
- Firebase queda limitado a Cloud Messaging para recepcion de push.

## Configuracion local

`REST_BASE_URL` se resuelve desde propiedades Gradle:

- Emulador Android: `http://10.0.2.2:8080/`.
- Dispositivo con `adb reverse tcp:8080 tcp:8080`: `http://127.0.0.1:8080/`.
- Dispositivo en red local: URL LAN del backend.

Para sobrescribir el valor versionado, usar `mobile/local.properties`, que no se versiona.

## Build

```powershell
cd mobile
.\gradlew.bat assembleCiudadanoDebug
.\gradlew.bat assembleFuncionarioDebug
.\gradlew.bat assembleTtaipDebug
```

## Reglas Por APK

- App Ciudadano: registro publico, login ciudadano, SAIP, seguimiento, apelaciones internas o externas, presentación ante entidad, comunicación de omisión y subsanaciones. La creación SAIP exige consentimiento expreso y canal formal (`CORREO_ELECTRONICO`, `CASILLA_ELECTRONICA`, `PLATAFORMA` o `FISICA`).
- App Funcionario: login interno, bandeja de entidad, respuesta de solicitudes, elevaciones pendientes al TTAIP y seguimiento de expedientes vinculados.
- App TTAIP: login restringido, bandeja paginada, expediente agregado, sala y miembros, calificacion y subsanacion online, descargos, suspensiones, constancias, acuses, intentos, reprocesos, cumplimiento, historial, admision excepcional y resoluciones finales.

Las actuaciones legales de App TTAIP son `online-only`: SQLDelight conserva el resumen
de apelacion para consulta de bandeja, pero no simula resoluciones, notificaciones,
reprocesos ni seguimientos de cumplimiento cuando no hay conexión.

El login, Splash y la navegacion validan el rol contra `BuildConfig.APP_ROLE` mediante
`AppRolePolicy` para impedir accesos cruzados entre APKs, incluso con sesiones
persistidas o enlaces profundos.

La app no genera un APK de administrador. Los accesos `ADMIN` no estan permitidos en
las tres apps mobile actuales.

## FCM

La app obtiene token FCM, lo registra o renueva contra el backend autenticado, se suscribe a topics por rol y recibe mensajes mediante `MiSaipMessagingService`.

El logout intenta revocar el dispositivo actual antes de borrar el JWT. Login, splash y `onNewToken` sincronizan el token sin escribirlo en logs ni Firestore. El backend persiste hash y, si operaciones configura una clave AES externa, una copia cifrada recuperable por el futuro emisor.

Pendiente: integrar Firebase Admin para envío real desde servidor. El adapter backend responde explícitamente como no configurado o pendiente; no simula entrega push.

## Firebase historico

`firebase-setup/` conserva utilidades antiguas de Firebase Auth y Firestore solo como referencia historica. No ejecutar esos scripts ni usarlos para datos productivos. La aplicacion Android productiva depende unicamente de Firebase Cloud Messaging.

## Auditoria de sincronizacion

La matriz de estado, brechas contra OpenAPI y propuesta de PRs vive en `MOBILE_SYNC_AUDIT.md`.
