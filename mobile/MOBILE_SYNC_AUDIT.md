# Auditoría de sincronización mobile

## Alcance

Esta auditoría compara `mobile/` contra el contrato OpenAPI vigente del backend después del PR #31 y registra el alcance completado de Mobile PR 5. La sincronización sigue siendo incremental: no incorpora de golpe todos los subflujos SAIP/TTAIP.

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
| Ciudadano | Registro, login, dashboard paginado, creación SAIP con consentimiento y canal formal, seguimiento básico, apelación interna, apelación externa, presentación ante entidad, comunicación de omisión, perfil y avisos locales | Parcial. Mobile PR 5 cubre los orígenes de apelación y la comunicación online de omisión. Falta sincronizar subflujos SAIP recientes. |
| Funcionario | Login interno, bandeja paginada de entidad, detalle y respuesta SAIP; actuaciones SAIP principales; consulta y remisión online de elevaciones pendientes | Parcial. Mobile PR 5 suma elevación institucional al TTAIP. Quedan actualizaciones operativas posteriores del cronograma o cupón y notificaciones del motor común. |
| TTAIP | Login restringido, bandeja paginada, calificación básica, subsanación, segunda calificación y resoluciones principales | Parcial. Falta sincronizar expediente agregado, elevación, descargos, suspensiones, constancias, acuses, reprocesos, cumplimiento y decisiones finales recientes. |
| Admin | Existe código histórico de dashboard, pero `AppRolePolicy` bloquea acceso | Correcto: administración queda en frontend web. |

## Endpoints consumidos actualmente

| Grupo | Endpoints mobile actuales | Observación |
| --- | --- | --- |
| Auth | `POST /api/auth/login`, `POST /api/auth/registro`, `GET /api/auth/me/{usuarioId}` | El interceptor JWT ahora omite token solo en auth público; `/me/{id}` conserva autorización. |
| Entidades | `GET /api/entidades`, `/activas`, `/{id}`, `/buscar` | Catálogo disponible. |
| Solicitudes | Listados paginados livianos para bandejas, listados legacy compatibles, detalle, expediente, creación y cambio de estado | Ciudadano usa `/ciudadano/{id}/paginadas`; funcionario usa `/entidad/{id}/paginadas`; sincronización en background obtiene páginas por lotes. |
| Apelaciones | Listados paginados livianos, detalle, creación interna/externa, presentación ante entidad, elevación institucional, comunicación ciudadana de omisión, cambio de estado y subsanación | Ciudadano usa `/ciudadano/{id}/paginadas`; TTAIP usa `/paginadas`. La admisión excepcional posterior a omisión queda pendiente para el agregado TTAIP. |
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

Mobile PR 3 cubre las bandejas activas por rol. Los endpoints legacy se conservan para pantallas auxiliares aún no migradas y para compatibilidad transitoria.

## Brechas contra el contrato actual

| Área | Brecha | Prioridad | Recomendación |
| --- | --- | --- | --- |
| Contrato | `mobile/openapi.json` no existía aunque el script de sincronización lo esperaba | Alta | Cubierto en esta pasada con snapshot idéntico a `frontend/openapi.json`. |
| Auth/JWT | El interceptor excluía todas las rutas `/api/auth/**`, incluyendo perfil autenticado | Alta | Cubierto: excluir solo rutas públicas. |
| RFC 9457 | Login intentaba leer únicamente el campo legacy `mensaje` | Alta | Cubierto: priorizar `detail`, luego `mensaje` y `title`. |
| SAIP ciudadano | Creación no enviaba `consentimientoDatosPersonales` ni `canalNotificacion` | Alta | Cubierto en Mobile PR 2: UI, dominio, request REST, mapper y caché local conservan ambos campos. |
| SAIP funcionario | Las actuaciones principales no estaban disponibles en App Funcionario | Media | Cubierto en Mobile PR 4: consulta de trazabilidad y registro online de observación, ampliación, encauzamiento y liquidación. |
| Paginación | Bandejas usaban listados legacy y cargas amplias | Alta | Cubierto en Mobile PR 3: DTO genérico de página, resúmenes livianos, carga incremental y fallback SQLDelight por página. |
| Apelaciones | No soportaba `EXTERNA` ni flujo `ante-entidad` / elevación | Media | Cubierto en Mobile PR 5: creación externa, presentación ante entidad, bandeja de elevaciones, remisión online y comunicación ciudadana de omisión. |
| TTAIP | No refleja todo el expediente agregado ni flujos posteriores recientes | Media | Implementar por etapas: expediente, notificaciones, plazos y cumplimiento. |
| Push | Registro/revocación FCM en backend es un stub mobile y no existe endpoint autenticado dedicado | Alta | Diseñar contrato backend antes de conectar. No escribir tokens en Firestore. |
| Avisos | Parte de los avisos se genera localmente desde cache, no desde el motor común backend | Media | Mantener como ayuda visual transitoria y migrar a API cuando exista contrato mobile. |
| Offline | SQLDelight exigía SAIP local para apelación y guarda hash local para login offline | Media | Vínculo SAIP local corregido con migración compatible en Mobile PR 5. El threat model del login offline sigue pendiente. |
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

## Mobile PR 2: SAIP ciudadano básico

- El formulario ciudadano exige consentimiento expreso para el tratamiento de datos personales.
- El ciudadano selecciona un canal formal compatible con backend: `CORREO_ELECTRONICO`, `CASILLA_ELECTRONICA`, `PLATAFORMA` o `FISICA`.
- El botón permanece bloqueado hasta aceptar el consentimiento y la validación muestra un error claro si falta el canal.
- El request REST envía `consentimientoDatosPersonales` y `canalNotificacion`.
- Los rechazos HTTP de creación se muestran con `detail`, `mensaje` o `title` de RFC 9457 Problem Details; no se confunden con modo offline.
- Si el backend crea la SAIP, el caché reemplaza el registro provisional por el ID y número SAIP oficiales.
- Si no hay conectividad, SQLDelight conserva la SAIP pendiente y WorkManager reutiliza el endpoint de creación al sincronizar.
- El detalle ciudadano muestra el número SAIP, estado, fecha de presentación, fecha límite y canal elegido disponible.
- SQLDelight incorpora una migración verificada para conservar consentimiento y canal en instalaciones existentes.

## Mobile PR 3: bandejas paginadas y cache SQLDelight

- El contrato mobile usa `PaginaRestDto<T>` con `contenido`, `pagina`, `tamano`, `totalElementos`, `totalPaginas` y `ultima`.
- Las bandejas consumen `SolicitudResumenRestDto` y `ApelacionResumenRestDto` para evitar relaciones pesadas.
- App Ciudadano pagina solicitudes y apelaciones propias; App Funcionario pagina solicitudes de su entidad; App TTAIP pagina apelaciones globales respetando ownership backend.
- Página `0` refresca el contenido visible. Las páginas siguientes se agregan bajo demanda con la acción `Cargar más`.
- El cache existente se reutiliza sin migración destructiva: los resúmenes remotos se mezclan con el detalle SQLDelight local antes de persistir.
- `consentimientoDatosPersonales` y `canalNotificacion` se conservan al actualizar resúmenes SAIP.
- Si falla conectividad, el repositorio consulta la página equivalente desde SQLDelight. Errores HTTP reales se propagan y se muestran a la UI; no quedan ocultos por el fallback offline.
- Desde Mobile PR 5, TTAIP también puede cachear apelaciones externas creadas en web: la migración local eliminó la dependencia obligatoria de una SAIP vinculada.
- Las sincronizaciones de background conservan los métodos legacy, pero descargan lotes paginados según rol.

## Mobile PR 4: operaciones SAIP de funcionario

- El detalle SAIP de App Funcionario consulta observaciones, ampliaciones, encauzamientos y liquidaciones vigentes desde el backend.
- El funcionario puede registrar una observación con motivo y sustento. El detalle refleja `PENDIENTE_INFORMACION` después de sincronizar la SAIP.
- La ampliación registra motivo, informe, fecha de notificación y un cronograma mínimo inicial de entrega parcial.
- El encauzamiento registra entidad destino activa, alcance `TOTAL` o `PARCIAL`, motivo y sustento.
- La liquidación o cupón registra código, monto, concepto, fecha y canal de notificación compatible con backend.
- Todas estas actuaciones son actos administrativos online-only: requieren conectividad, nunca simulan éxito local y vuelven a cargar el detalle desde backend después de registrarse.
- Si el backend devuelve RFC 9457 Problem Details, la UI muestra `detail`, con fallback compatible a `mensaje` o `title`.
- SQLDelight continúa como respaldo de consulta para bandejas; no se creó una cola offline de mutaciones administrativas.
- Quedan fuera de este alcance la subsanación ciudadana, la edición posterior del cronograma, el marcado de pago/recojo y las notificaciones del motor común.

## Mobile PR 5: apelación externa y elevación por entidad

- App Ciudadano permite registrar una apelación externa sin fabricar una SAIP local. El formulario diferencia denegatoria `EXPRESA` y `TACITA` y exige la evidencia correspondiente.
- Una SAIP local apelable puede presentarse directamente al TTAIP o ante la entidad. La presentación ante entidad registra fecha y referencia del cargo.
- App Funcionario consulta elevaciones pendientes de su entidad y las remite al TTAIP con referencia del expediente institucional. La mutación es online-only.
- El detalle ciudadano muestra el estado `Pendiente de Elevación` sin confundirlo con primera calificación y permite comunicar omisión con una referencia verificable.
- SQLDelight incorpora `migrations/2.sqm`: `expedienteSAIP` pasa a ser nullable, se conserva `solicitudId` opcional y se persisten metadatos mínimos de origen externo y elevación.
- Las páginas de apelaciones externas se cachean sin depender de una SAIP local.
- No se implementó admisión excepcional TTAIP después de omisión: corresponde al agregado TTAIP de la siguiente etapa.

## Riesgos que requieren PR dedicado

1. Perfil, avisos locales y algunos flujos auxiliares conservan métodos legacy compatibles; deben migrarse cuando reciban un contrato paginado específico.
2. El registro de tokens FCM aún no persiste en backend; recibir FCM funciona, pero el alta/revocación es incompleta.
3. El login offline basado en hash local y el recordatorio de contraseña cifrada necesitan decisión de seguridad explícita antes de producción.
4. La admisión excepcional TTAIP posterior a una omisión comunicada queda para el agregado TTAIP.
5. El seguimiento ciudadano básico aún no representa observación, ampliación, encauzamiento ni liquidación; Mobile PR 4 incorpora estas actuaciones en el detalle de App Funcionario.

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
| Mobile PR 2 | Cubierto: SAIP ciudadano con consentimiento, canal de notificación, DTOs vigentes, caché migrable y creación end-to-end básica. |
| Mobile PR 3 | Cubierto: paginación de solicitudes y apelaciones con DTOs livianos, carga incremental y fallback SQLDelight. |
| Mobile PR 4 | Cubierto: funcionario registra online observación, ampliación con cronograma inicial, encauzamiento total/parcial y liquidación/cupón; consulta su trazabilidad desde el detalle SAIP. |
| Mobile PR 5 | Cubierto: apelación externa, presentación y elevación por entidad, comunicación ciudadana de omisión y migración SQLDelight compatible. |
| Mobile PR 6 | TTAIP agregado: expediente, descargos, suspensiones, constancias, acuses, reprocesos y cumplimiento. |
| Mobile PR 7 | Contrato backend para alta/revocación FCM y consumo del motor común de notificaciones. |
