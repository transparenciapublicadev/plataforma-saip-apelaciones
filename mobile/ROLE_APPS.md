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
- App TTAIP: login restringido, primera calificacion, subsanacion, segunda calificacion y resolucion.

El login, Splash y la navegacion validan el rol contra `BuildConfig.APP_ROLE` mediante
`AppRolePolicy` para impedir accesos cruzados entre APKs, incluso con sesiones
persistidas o enlaces profundos.

La app no genera un APK de administrador. Los accesos `ADMIN` no estan permitidos en
las tres apps mobile actuales.

## FCM

La app obtiene token FCM, se suscribe a topics por rol y recibe mensajes mediante `MiSaipMessagingService`.

Pendiente del backend: exponer endpoints autenticados para registrar/revocar tokens FCM y enviar notificaciones desde servidor. La app no debe escribir tokens ni colas de notificaciones en Firestore.

## Firebase historico

`firebase-setup/` conserva utilidades antiguas de Firebase Auth y Firestore solo como referencia historica. No ejecutar esos scripts ni usarlos para datos productivos. La aplicacion Android productiva depende unicamente de Firebase Cloud Messaging.

## Auditoria de sincronizacion

La matriz de estado, brechas contra OpenAPI y propuesta de PRs vive en `MOBILE_SYNC_AUDIT.md`.
