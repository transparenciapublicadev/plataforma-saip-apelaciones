# Auditoría de sincronización mobile

## Alcance

Esta auditoría compara `mobile/` contra el contrato OpenAPI vigente del backend después del PR #27. La primera pasada aplica únicamente correcciones técnicas pequeñas y seguras. No incorpora pantallas nuevas ni completa de golpe los flujos SAIP/TTAIP.

## Stack y módulos reales

| Área | Implementación detectada |
| --- | --- |
| UI | Android nativo, Kotlin, Jetpack Compose y Material 3 |
| Navegación | Single Activity con Navigation 3 (`NavDisplay`, `NavKey`) |
| Distribución | Flavors `ciudadano`, `funcionario` y `ttaip`; no existe APK admin |
| DI | Koin |
| Red | Retrofit + OkHttp + kotlinx.serialization |
| Autenticación | Backend Spring Boot + JWT almacenado con `EncryptedSharedPreferences` |
| Offline | SQLDelight y WorkManager |
| Push | Firebase Cloud Messaging únicamente |

Módulos Gradle:

- `:app`
- `:core:common`
- `:core:data`
- `:core:database`
- `:core:domain`
- `:core:network`

## Estado funcional por rol

| Rol | Funcionalidad mobile existente | Estado frente al backend actual |
| --- | --- | --- |
| Ciudadano | Registro, login, dashboard, formulario SAIP, seguimiento, apelación interna, perfil y avisos locales | Parcial. El formulario SAIP todavía no captura consentimiento ni canal formal de notificación. Falta apelación externa y sincronizar subflujos SAIP recientes. |
| Funcionario | Login interno, bandeja de entidad, detalle y respuesta SAIP | Parcial. Falta exponer en mobile observación/subsanación, ampliación, encauzamiento, liquidación y notificaciones del motor común. |
| TTAIP | Login restringido, bandeja, calificación básica, subsanación, segunda calificación y resoluciones principales | Parcial. Falta sincronizar expediente agregado, elevación, descargos, suspensiones, constancias, acuses, reprocesos, cumplimiento y decisiones finales recientes. |
| Admin | Existe código histórico de dashboard, pero `AppRolePolicy` bloquea acceso | Correcto: administración queda en frontend web. |

## Endpoints consumidos actualmente

| Grupo | Endpoints mobile actuales | Observación |
| --- | --- | --- |
| Auth | `POST /api/auth/login`, `POST /api/auth/registro`, `GET /api/auth/me/{usuarioId}` | El interceptor JWT ahora omite token solo en auth público; `/me/{id}` conserva autorización. |
| Entidades | `GET /api/entidades`, `/activas`, `/{id}`, `/buscar` | Catálogo disponible. |
| Solicitudes | Listados legacy, detalle, expediente, creación y cambio de estado | Los listados siguen compatibles, pero deben migrarse a DTOs paginados. |
| Apelaciones | Listados legacy, detalle, expediente, creación interna, cambio de estado y subsanación | Falta apelación externa y elevación por entidad. |
| TTAIP | Bandejas segmentadas, calificación básica, decisiones principales y notificación de segunda calificación | Falta cubrir endpoints agregados desde los PRs web/backend recientes. |

## Migración a paginación

| Uso actual | Contrato objetivo |
| --- | --- |
| `GET /api/solicitudes` | `GET /api/solicitudes/paginadas` |
| `GET /api/solicitudes/ciudadano/{id}` | `GET /api/solicitudes/ciudadano/{id}/paginadas` |
| `GET /api/solicitudes/entidad/{id}` | `GET /api/solicitudes/entidad/{id}/paginadas` |
| `GET /api/solicitudes/estado/{estado}` | `GET /api/solicitudes/estado/{estado}/paginadas` |
| `GET /api/apelaciones` | `GET /api/apelaciones/paginadas` |
| `GET /api/apelaciones/ciudadano/{id}` | `GET /api/apelaciones/ciudadano/{id}/paginadas` |
| `GET /api/apelaciones/estado/{estado}` | `GET /api/apelaciones/estado/{estado}/paginadas` |

La migración requiere DTOs de página, cursores de UI y estrategia de cache. No se realiza en esta pasada para no romper bandejas existentes.

## Brechas contra el contrato actual

| Área | Brecha | Prioridad | Recomendación |
| --- | --- | --- | --- |
| Contrato | `mobile/openapi.json` no existía aunque el script de sincronización lo esperaba | Alta | Cubierto en esta pasada con snapshot idéntico a `frontend/openapi.json`. |
| Auth/JWT | El interceptor excluía todas las rutas `/api/auth/**`, incluyendo perfil autenticado | Alta | Cubierto: excluir solo rutas públicas. |
| RFC 9457 | Login intentaba leer únicamente el campo legacy `mensaje` | Alta | Cubierto: priorizar `detail`, luego `mensaje` y `title`. |
| SAIP ciudadano | Creación no envía `consentimientoDatosPersonales` ni `canalNotificacion` | Alta | Próximo PR ciudadano: agregar DTO, dominio y formulario sin valores ficticios. |
| SAIP funcionario | No consume observaciones, ampliaciones, encauzamientos ni liquidaciones | Media | Separar por vertical funcional y reutilizar endpoints ya estabilizados. |
| Paginación | Bandejas usan listados legacy y cargas amplias | Alta | Migrar solicitudes y apelaciones a DTOs livianos paginados. |
| Apelaciones | No soporta `EXTERNA` ni flujo `ante-entidad` / elevación | Media | Agregar después de estabilizar paginación y SAIP ciudadano. |
| TTAIP | No refleja todo el expediente agregado ni flujos posteriores recientes | Media | Implementar por etapas: expediente, notificaciones, plazos y cumplimiento. |
| Push | Registro/revocación FCM en backend es un stub mobile y no existe endpoint autenticado dedicado | Alta | Diseñar contrato backend antes de conectar. No escribir tokens en Firestore. |
| Avisos | Parte de los avisos se genera localmente desde cache, no desde el motor común backend | Media | Mantener como ayuda visual transitoria y migrar a API cuando exista contrato mobile. |
| Offline | SQLDelight aún exige SAIP local para apelación y guarda hash local para login offline | Media | Revisar threat model y migraciones SQLDelight antes de apelación externa. |
| Firebase histórico | `firebase-setup/` conserva scripts antiguos Auth/Firestore | Media | Mantener fuera del runtime y considerar archivado o eliminación en PR dedicado. |
| Toolchain | AGP reporta flags y APIs obsoletas | Baja | Migrar DSL/Kotlin integrado en PR técnico aislado. |
| Almacenamiento seguro | AndroidX marca `EncryptedSharedPreferences` y `MasterKey` como deprecated | Media | Diseñar reemplazo con Keystore/DataStore cifrado en PR técnico; mientras tanto, fallar cerrado. |

## Correcciones aplicadas en esta pasada

- Sincronización del snapshot `mobile/openapi.json`.
- URL local por defecto restaurada a `http://10.0.2.2:8080/` para emulador.
- Script `run_build.bat` portable y orientado a los tres flavors.
- JWT enviado a `/api/auth/me/{usuarioId}` y omitido únicamente en auth público.
- Logging HTTP debug reducido a nivel `BASIC`; no registra headers ni bodies.
- Parsing básico de RFC 9457 Problem Details en autenticación.
- `EncryptedSharedPreferences` falla cerrado si no puede inicializarse; no guarda JWT en preferencias planas.
- Backups Android deshabilitados y reglas de extracción excluyen preferencias y base local.
- Logs FCM y de login sin tokens, payloads ni identificadores personales.
- Aviso mobile de subsanación TTAIP corregido a 2 días hábiles.

## Riesgos que requieren PR dedicado

1. La creación SAIP desde mobile puede ser rechazada por validación backend hasta capturar consentimiento y canal formal.
2. Los listados legacy siguen operativos, pero no aprovechan paginación ni DTOs livianos.
3. El registro de tokens FCM aún no persiste en backend; recibir FCM funciona, pero el alta/revocación es incompleta.
4. El login offline basado en hash local y el recordatorio de contraseña cifrada necesitan decisión de seguridad explícita antes de producción.
5. La base SQLDelight requiere migración antes de representar apelación externa sin SAIP local.

## Comandos reales de validación

```powershell
cd mobile
.\gradlew.bat --version
.\gradlew.bat :app:compileCiudadanoDebugKotlin :app:compileFuncionarioDebugKotlin :app:compileTtaipDebugKotlin
.\gradlew.bat test
.\gradlew.bat assembleCiudadanoDebug assembleFuncionarioDebug assembleTtaipDebug
.\gradlew.bat lint
```

## Roadmap recomendado

| PR | Objetivo |
| --- | --- |
| Mobile PR 1 | Contrato base, seguridad de red/JWT, OpenAPI snapshot, documentación y build reproducible. |
| Mobile PR 2 | SAIP ciudadano: consentimiento, canal de notificación, DTOs vigentes y creación end-to-end. |
| Mobile PR 3 | Paginación de solicitudes y apelaciones con DTOs livianos y cache SQLDelight. |
| Mobile PR 4 | Funcionario: observación, ampliación, encauzamiento y liquidación. |
| Mobile PR 5 | Apelación externa, elevación por entidad y migración SQLDelight compatible. |
| Mobile PR 6 | TTAIP agregado: expediente, descargos, suspensiones, constancias, acuses, reprocesos y cumplimiento. |
| Mobile PR 7 | Contrato backend para alta/revocación FCM y consumo del motor común de notificaciones. |
