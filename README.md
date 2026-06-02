# Plataforma SAIP y Apelaciones TTAIP

> Plataforma integral para gestionar Solicitudes de Acceso a la Información Pública (SAIP), respuestas de entidades públicas y apelaciones ante el Tribunal de Transparencia y Acceso a la Información Pública (TTAIP), alineada al marco de la Ley N.° 27806 del Perú.

[![Backend](https://img.shields.io/badge/backend-Spring%20Boot%204-6DB33F?style=flat-square&logo=springboot&logoColor=white)](backend/)
[![Frontend](https://img.shields.io/badge/frontend-Angular%2021-DD0031?style=flat-square&logo=angular&logoColor=white)](frontend/)
[![Mobile](https://img.shields.io/badge/mobile-Kotlin%20%2B%20Compose-7F52FF?style=flat-square&logo=kotlin&logoColor=white)](mobile/)
[![Docs](https://img.shields.io/badge/docs-Astro%20%2B%20Starlight-FF5D01?style=flat-square&logo=astro&logoColor=white)](docs/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](LICENSE)

La plataforma modela el ciclo completo de transparencia pública: el ciudadano solicita información, la entidad responde dentro de los plazos legales y, si corresponde, el TTAIP califica y resuelve la apelación. El repositorio está organizado como un monorepo con backend, frontend web, app mobile, documentación, base de datos, colecciones de API y automatización de contrato OpenAPI.

> Este proyecto es una iniciativa académica y tecnológica. No representa ni está afiliado oficialmente a ninguna entidad gubernamental.

## Tabla de contenidos

- [Visión del producto](#visión-del-producto)
- [Co-creadores](#co-creadores)
- [Arquitectura general](#arquitectura-general)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Módulos principales](#módulos-principales)
- [Modelo de dominio](#modelo-de-dominio)
- [Contrato API y sincronización](#contrato-api-y-sincronización)
- [Seguridad y roles](#seguridad-y-roles)
- [Ejecución local](#ejecución-local)
- [Validación y CI](#validación-y-ci)
- [Documentación y herramientas](#documentación-y-herramientas)
- [Licencia](#licencia)

## Visión del producto

Plataforma SAIP centraliza la gestión digital de solicitudes de acceso a la información pública y apelaciones TTAIP con una arquitectura preparada para tres experiencias independientes:

| Superficie | Usuario principal | Objetivo |
| --- | --- | --- |
| Web pública | Ciudadano | Presentar SAIP, consultar estado, registrar apelaciones y subsanar observaciones. |
| Web interna | Funcionarios, TTAIP, administradores | Gestionar expedientes, responder solicitudes, calificar apelaciones, emitir resoluciones y revisar indicadores. |
| Mobile Android | Ciudadano y operadores | Consultar y operar flujos clave desde una aplicación nativa con sincronización local. |

El backend es la fuente de verdad del dominio y expone el contrato REST formal. El frontend Angular y la app Android consumen el mismo contrato, pero evolucionan como clientes independientes.

## Co-creadores

| Nombre | Rol en el proyecto | Contribucion principal |
| --- | --- | --- |
| **Kelly Medalit De La Cruz Lopez** | Co-creadora, Analista Funcional | Ideación del producto, levantamiento funcional, reglas de negocio, flujo SAIP/TTAIP, criterios de validación y modelado del dominio. |
| **Daniel Angel Leon Salazar** | Co-creador, Arquitecto de Software | Arquitectura técnica, backend Spring Boot, frontend Angular, app Android nativa, integración API, seguridad, automatización y despliegue técnico. |

## Arquitectura general

La arquitectura prioriza separación de responsabilidades, contrato API versionable, clientes desacoplados y validación independiente por módulo.

```mermaid
flowchart TB
    subgraph Users["Usuarios"]
        Citizen["Ciudadano"]
        Officer["Funcionario de entidad pública"]
        Tribunal["Miembro TTAIP"]
        Admin["Administrador"]
    end

    subgraph Clients["Clientes"]
        Web["frontend/\nAngular 21 + SSR\nTailwind CSS"]
        Android["mobile/\nKotlin + Jetpack Compose\nSQLDelight + Retrofit"]
        Docs["docs/\nAstro + Starlight"]
    end

    subgraph Platform["Nucleo de plataforma"]
        API["backend/\nSpring Boot 4 + Java 25\nREST + Security + OpenAPI"]
        DB[("MySQL\nsaip_db")]
        OpenAPI["/v3/api-docs\nContrato OpenAPI"]
    end

    subgraph External["Servicios externos"]
        Firebase["Firebase Cloud Messaging\nPush notifications"]
    end

    Citizen --> Web
    Officer --> Web
    Tribunal --> Web
    Admin --> Web
    Citizen --> Android

    Web -->|HTTP JSON + JWT| API
    Android -->|Retrofit + JWT| API
    API --> DB
    API --> OpenAPI
    Android -. push .-> Firebase
    Docs -. documenta .-> Platform
```

### Decisiones arquitectónicas

| Decisión | Razón |
| --- | --- |
| Backend como source of truth | Centraliza reglas legales, seguridad, persistencia y transiciones de estado. |
| OpenAPI como contrato formal | Permite sincronizar frontend y mobile sin compartir código fuente. |
| Monorepo modular | Facilita consistencia técnica, CI por paths y versionado coordinado. |
| Clientes desacoplados | Web y mobile consumen la API de forma independiente y pueden desplegarse por separado. |
| Documentación viva | `docs/` y `README.md` explican arquitectura, dominio, operación y decisiones clave. |

## Stack tecnológico

### Backend

| Área | Tecnología |
| --- | --- |
| Runtime | Java 25 |
| Framework | Spring Boot 4.0.0 |
| API | Spring Web MVC, REST JSON |
| Persistencia | Spring Data JPA, Hibernate, MySQL 8.x |
| Seguridad | Spring Security, JWT (`jjwt`), CORS configurable |
| Validación | Jakarta Bean Validation |
| Documentación API | springdoc-openapi, Swagger UI |
| Build y testing | Maven Wrapper, Spring Boot Test, H2 para escenarios de prueba |

### Frontend web

| Área | Tecnología |
| --- | --- |
| Framework | Angular 21.2.x |
| Lenguaje | TypeScript 5.9 |
| UI | Tailwind CSS 4.1, Lucide Angular, GSAP |
| SSR | Angular SSR con Express 5 |
| Formularios | Angular Forms / Reactive Forms |
| API contract | `openapi-typescript` |
| Testing | Vitest + Angular unit test builder |
| Package manager | npm 11.6.x |

### Mobile Android

| Área | Tecnología |
| --- | --- |
| Lenguaje | Kotlin 2.3.x |
| UI | Jetpack Compose + Material 3 |
| Arquitectura | Clean Architecture + MVVM |
| Navegación | Navigation 3 |
| DI | Koin 4.1 |
| Datos locales | SQLDelight 2.2 |
| Red | Retrofit 3, OkHttp 5 |
| Sincronización / jobs | Coroutines, Flow, WorkManager |
| Firebase | FCM exclusivamente para push notifications |
| Build | Gradle 9.x, Android Gradle Plugin 9.x |

### Documentación y automatización

| Área | Tecnología |
| --- | --- |
| Docs | Astro 6, Starlight, Mermaid |
| API collections | Postman collection operativa |
| Database seed | `database/script_saip_db.sql` |
| CI/CD | GitHub Actions por módulo |
| OpenAPI sync | `scripts/sync-openapi.ps1` y `scripts/sync-openapi.sh` |

## Estructura del monorepo

```text
plataforma-saip-apelaciones/
├── backend/              # API REST Spring Boot 4 + Java 25
├── frontend/             # Aplicación web Angular 21 + SSR
├── mobile/               # App Android Kotlin + Jetpack Compose
├── docs/                 # Documentación Astro + Starlight
├── database/             # Scripts SQL de apoyo y datos seed
├── postman/              # Colección operativa de API
├── scripts/              # Sincronización OpenAPI y utilidades
├── .github/workflows/    # CI independiente por módulo
├── AGENTS.md             # Instrucciones locales para Codex
├── LICENSE               # Apache License 2.0
└── README.md             # Visión técnica y funcional del proyecto
```

## Módulos principales

### `backend/` - API REST y dominio transaccional

El backend implementa las reglas centrales del sistema: solicitudes SAIP, respuestas de entidades, apelaciones TTAIP, calificación, resolución, estadísticas, reportes y autenticación.

```mermaid
flowchart LR
    Controller["REST Controllers"]
    Service["Services\nReglas de negocio"]
    Repository["Repositories\nSpring Data JPA"]
    Entity["Entities + DTOs"]
    Security["Security\nJWT + Roles"]
    MySQL[("MySQL")]

    Controller --> Service
    Service --> Repository
    Repository --> Entity
    Entity --> MySQL
    Security --> Controller
```

Controladores principales:

| Controller | Responsabilidad |
| --- | --- |
| `AuthRestController` | Login, registro y usuario autenticado. |
| `SolicitudRestController` | Ciclo SAIP y consultas de solicitudes. |
| `RespuestaRestController` | Respuestas de funcionarios a solicitudes. |
| `ApelacionRestController` | Presentación y seguimiento de apelaciones. |
| `TTAIPRestController` | Calificación, subsanación y resolución TTAIP. |
| `EntidadRestController` | Gestión de entidades públicas. |
| `CiudadanoRestController` | Operaciones del ciudadano. |
| `FuncionarioRestController` | Operaciones de funcionarios. |
| `EstadisticasRestController` | Indicadores operativos. |
| `ReportesRestController` | Generación de reportes. |

### `frontend/` - Web Angular multirol

El frontend entrega la experiencia web pública e interna. La aplicación está organizada por rol y consume servicios HTTP tipados hacia el backend.

```mermaid
flowchart TB
    App["Angular App"]
    Routes["Rutas por rol"]
    Guards["Auth Guards"]
    Interceptors["Auth Interceptor"]
    Pages["Pages\npublic / ciudadano / funcionario / ttaip / admin"]
    Services["Services\nAuth, Solicitud, Apelación, TTAIP"]
    API["Backend REST API"]

    App --> Routes
    Routes --> Guards
    Routes --> Pages
    Pages --> Services
    Services --> Interceptors
    Interceptors --> API
```

Áreas de interfaz:

| Carpeta | Alcance |
| --- | --- |
| `pages/public/` | Consulta pública y ayuda. |
| `pages/auth/` | Login y registro del ciudadano. |
| `pages/ciudadano/` | Panel, nueva SAIP, detalle, apelación y subsanación. |
| `pages/funcionario/` | Panel de entidad, detalle y respuesta de solicitud. |
| `pages/ttaip/` | Bandeja TTAIP, calificaciones, resolución y procesos disciplinarios. |
| `pages/admin/` | Administración general del sistema. |

### `mobile/` - Android nativo

La app mobile está construida con Kotlin, Jetpack Compose, arquitectura limpia y persistencia local. Su objetivo es ofrecer una experiencia nativa desacoplada del frontend web.

```mermaid
flowchart TB
    UI["app/\nScreens + ViewModels + Navigation"]
    Domain["core/domain\nModels + UseCases + Repository contracts"]
    Data["core/data\nRepository implementations + Mappers"]
    Network["core/network\nRetrofit + JWT REST"]
    Database["core/database\nSQLDelight"]
    Common["core/common\nUtilities"]

    UI --> Domain
    Domain --> Data
    Data --> Network
    Data --> Database
    UI --> Common
    Data --> Common
```

| Módulo Gradle | Responsabilidad |
| --- | --- |
| `app/` | Presentación, tema, navegación, ViewModels y pantallas. |
| `core/domain/` | Modelos de dominio, casos de uso e interfaces. |
| `core/data/` | Repositorios concretos y mapeadores. |
| `core/network/` | Cliente Retrofit, DTOs, JWT y comunicación REST con backend. |
| `core/database/` | SQLDelight y persistencia local. |
| `core/common/` | Utilidades compartidas. |

### `docs/` - Documentación técnica y funcional

Sitio de documentación construido con Astro + Starlight. Complementa este README con contenido navegable, diagramas y material técnico/funcional extendido.

### `database/`, `postman/` y `scripts/`

| Carpeta | Uso |
| --- | --- |
| `database/` | Script SQL de apoyo para inicialización o pruebas locales. |
| `postman/` | Colección operativa para validar flujos API end-to-end. |
| `scripts/` | Sincronización del contrato OpenAPI hacia consumidores. |

## Modelo de dominio

### Conceptos clave

| Concepto | Definición |
| --- | --- |
| SAIP | Solicitud de Acceso a la Información Pública. Es primera instancia y usa formato `SAIP-AAAA-NNNNN`. |
| Entidad pública | Organismo que posee o administra la información solicitada. |
| Funcionario | Usuario interno de entidad pública encargado de evaluar y responder SAIP. |
| Apelación | Recurso presentado por el ciudadano cuando la respuesta no satisface o no existe respuesta. |
| Expediente TTAIP | Contenedor de segunda instancia. Solo existe cuando hay apelación y usa formato `NNNNN-AAAA-JUS/TTAIP`. |
| TTAIP | Tribunal que califica y resuelve apelaciones. |
| Resolución | Decisión formal emitida durante calificación o resolución final. |
| Cédula de notificación | Documento que acredita notificación en el procedimiento. |

### Distinción crítica

SAIP no es expediente. La SAIP pertenece a la primera instancia ante la entidad pública. El expediente TTAIP solo nace cuando el ciudadano apela.

```mermaid
flowchart LR
    SAIP["SAIP\nSAIP-AAAA-NNNNN"]
    Response["Respuesta de entidad\no silencio administrativo"]
    Appeal["Apelación ciudadana"]
    Case["Expediente TTAIP\nNNNNN-AAAA-JUS/TTAIP"]

    SAIP --> Response
    Response -->|si corresponde| Appeal
    Appeal --> Case
```

### Flujo SAIP

```mermaid
stateDiagram-v2
    [*] --> Presentada
    Presentada --> EnRevision: recepción por entidad
    EnRevision --> Subsanacion: observación dentro de 2 días hábiles
    Subsanacion --> EnRevision: ciudadano subsana
    EnRevision --> Respondida: entrega total/parcial o denegatoria
    EnRevision --> Vencida: silencio administrativo negativo
    Respondida --> Apelable: plazo legal aplicable
    Vencida --> Apelable
    Apelable --> [*]
```

Reglas principales:

| Regla | Criterio |
| --- | --- |
| Plazo SAIP | 10 días hábiles desde el día hábil siguiente a la recepción. |
| Subsanación | Solo dentro de los 2 primeros días hábiles. |
| Liquidación de costos | Debe notificarse antes del vencimiento del plazo legal. |
| Silencio administrativo | Aplica si la entidad no responde dentro del plazo. |
| Apelación | Ante denegatoria expresa aplica el plazo legal que se defina con criterio legal/producto; ante silencio administrativo negativo no existe plazo perentorio. |

### Flujo TTAIP

```mermaid
stateDiagram-v2
    [*] --> PendienteElevacion
    PendienteElevacion --> EnCalificacionPrimera: elevación en 2 días hábiles
    EnCalificacionPrimera --> Improcedente: rechazo definitivo
    EnCalificacionPrimera --> EnSubsanacion: inadmisible
    EnCalificacionPrimera --> Admitido: admisible
    EnSubsanacion --> EnCalificacionSegunda: subsanado
    EnSubsanacion --> NoPresentado: no subsana
    EnCalificacionSegunda --> Improcedente
    EnCalificacionSegunda --> NotificacionSegunda
    NotificacionSegunda --> EnResolucion
    Admitido --> EnResolucion
    EnResolucion --> Resuelto
    Improcedente --> [*]
    NoPresentado --> [*]
    Resuelto --> [*]
```

Reglas principales:

| Etapa | Plazo / criterio |
| --- | --- |
| Elevación | 2 días hábiles para remitir el recurso al TTAIP. |
| Primera calificación | 7 días hábiles para calificar admisibilidad. |
| Subsanación | 2 días hábiles cuando el recurso es inadmisible. |
| Segunda calificación | Determina admisión posterior o improcedencia. |
| Notificación | La segunda calificación debe notificarse antes de iniciar resolución final. |
| Resolución final | 10 días hábiles para emitir decisión final. |

Decisiones de resolución final:

| Decisión | Resultado |
| --- | --- |
| Fundado | Ordena entregar la información. |
| Fundado en parte | Ordena entrega parcial. |
| Infundado | Confirma la decisión o conducta de la entidad. |
| Infundado en parte | Confirma parcialmente. |
| Improcedente | Rechazo por causal formal o de fondo. |
| Conclusión por sustracción de la materia | La entidad entrega información durante el trámite. |
| Conclusión por desistimiento | El ciudadano desiste del recurso. |

## Contrato API y sincronización

El backend publica el contrato OpenAPI en `/v3/api-docs`. Ese contrato se sincroniza hacia el frontend y mobile para mantener consistencia entre clientes.

```mermaid
sequenceDiagram
    participant B as backend/
    participant O as OpenAPI /v3/api-docs
    participant S as scripts/sync-openapi
    participant F as frontend/
    participant M as mobile/

    B->>O: Publica contrato REST
    S->>O: Descarga especificación JSON
    S->>F: Actualiza frontend/openapi.json
    S->>F: Regenera src/app/api/schema.ts
    S->>M: Actualiza mobile/openapi.json como referencia
```

Sincronización en Windows:

```powershell
.\scripts\sync-openapi.ps1
```

Sincronización en Linux/macOS:

```bash
./scripts/sync-openapi.sh
```

Regla operativa: si cambian endpoints, DTOs o modelos de API en `backend/`, sincronizar OpenAPI y validar los consumidores impactados.

## Seguridad y roles

La autenticación principal se resuelve con JWT emitido por el backend. El frontend usa guards e interceptor de autenticación. Mobile consume el backend con Retrofit y conserva Firebase Cloud Messaging exclusivamente para push notifications.

| Rol | Enum | Superficie principal | Capacidades |
| --- | --- | --- | --- |
| Ciudadano | `CIUDADANO` | Web pública, mobile | Registro, login, SAIP, consulta, apelación y subsanación. |
| Funcionario | `FUNCIONARIO` | Web interna | Gestionar solicitudes de su entidad y emitir respuestas. |
| TTAIP | `TTAIP` | Web interna | Calificar, admitir, resolver y revisar expedientes. |
| Administrador | `ADMIN` / `ADMINISTRADOR` | Web interna | Gestión de usuarios, entidades, reportes e indicadores. |

Principios de seguridad:

- Validar entradas en backend con Jakarta Bean Validation.
- Proteger endpoints con Spring Security y roles.
- Usar CORS configurable por entorno.
- Mantener secretos fuera del repositorio y usar variables de entorno.
- Validar tamaño, extensión y tipo de archivos cargados.
- Evitar logs con tokens, credenciales o información sensible.

### Motor común de notificaciones

El backend persiste intentos de notificación para SAIP y TTAIP. El modo `MOCK` se usa en desarrollo local y Newman; el modo `SMTP` habilita correo real mediante variables de entorno. `CASILLA_ELECTRONICA` cuenta con un adaptador preparado que responde explícitamente como no disponible hasta contar con el contrato API oficial. Mobile registra, renueva y revoca tokens FCM contra endpoints autenticados; el adapter de envío FCM permanece preparado pero reporta explícitamente que falta la integración Firebase Admin. No existe fallback automático entre canales.

Para despliegues productivos, activar `SPRING_PROFILES_ACTIVE=prod`. Ese perfil usa `SMTP` por defecto, rechaza `MOCK`, exige configuración externa de base de datos, JWT, CORS y SMTP, desactiva inicialización automática del seed y mantiene OpenAPI/Swagger deshabilitados salvo habilitación operativa explícita.

## Ejecución local

### Requisitos

| Herramienta | Uso |
| --- | --- |
| Java 25 | Backend Spring Boot. |
| JDK 17 | Build Android. |
| MySQL 8.x | Base de datos `saip_db`. |
| Node.js 22 | Frontend Angular y docs Astro. |
| npm 11.x | Gestión de paquetes web. |
| Android Studio / SDK | Build y ejecución mobile. |
| PowerShell o Bash | Scripts de sincronización OpenAPI. |

### Backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Comandos útiles:

```powershell
cd backend
.\mvnw.cmd compile
.\mvnw.cmd test
.\mvnw.cmd package -DskipTests
```

Variables relevantes:

| Variable | Default local |
| --- | --- |
| `DB_USERNAME` | `root` |
| `DB_PASSWORD` | `cibertec` |
| `JWT_SECRET` | Solo desarrollo local |
| `JWT_EXPIRATION_MS` | `86400000` |
| `CORS_ALLOWED_ORIGIN_PATTERNS` | Orígenes locales y Postman |

### Newman reproducible

La colección Newman crea datos runtime para validar flujos reales. Si el entorno
local acumuló fixtures, recrear explícitamente la base local y volver a cargar el
seed oficial:

```powershell
.\scripts\reset-local-db.ps1 -ConfirmReset
cd backend
.\mvnw.cmd spring-boot:run
# Detener backend después de crear el schema.
Get-Content ..\database\script_saip_db.sql -Raw | mysql -u root -p saip_db
$env:APP_NOTIFICATIONS_MODE='MOCK'
.\mvnw.cmd spring-boot:run
```

En otra terminal:

```powershell
cd postman
npm run test:api:diagnostic
```

El script bloquea hosts remotos, exige confirmación explícita y no se ejecuta de
forma automática. Newman usa variables dinámicas y tokens JWT vacíos en el
environment versionado.

### Frontend

```powershell
cd frontend
npm install
npm start
```

Comandos útiles:

```powershell
cd frontend
npm test
npm run build
npm run generate:api:live
```

### Mobile

```powershell
cd mobile
.\gradlew.bat assembleDebug
```

Comandos útiles:

```powershell
cd mobile
.\gradlew.bat clean compileDebugKotlin
.\gradlew.bat test
.\gradlew.bat clean compileDebugKotlin test
```

> Para Firebase Cloud Messaging, colocar el archivo `google-services.json` requerido por el módulo Android correspondiente.
> Restringir la API key Android preexistente desde Firebase Console por package name y certificado SHA. No editar ni mover `google-services.json` como parte de esta configuración.

### Docs

```powershell
cd docs
npm ci
npm start
npm run build
```

Para publicar la documentación con sitemap canónico:

```powershell
$env:DOCS_SITE_URL='https://docs.misaip.gob.pe'
cd docs
npm run build
```

## Validación y CI

Cada módulo tiene validaciones independientes. Esto reduce acoplamiento y permite que los cambios se revisen por superficie.

| Módulo afectado | Validación local recomendada |
| --- | --- |
| `backend/` | `cd backend; .\mvnw.cmd test` |
| `frontend/` | `cd frontend; npm test; npm run build` |
| `mobile/` | `cd mobile; .\gradlew.bat clean compileDebugKotlin test` |
| `docs/` | `cd docs; npm run build` |
| API contract | Backend corriendo + `.\scripts\sync-openapi.ps1` |

Pipelines de GitHub Actions:

| Workflow | Trigger por paths | Validación |
| --- | --- | --- |
| `backend-ci.yml` | `backend/**` | Compile, test, package y export OpenAPI. |
| `frontend-ci.yml` | `frontend/**` | `npm ci`, TypeScript check, tests y build Angular. |
| `mobile-ci.yml` | `mobile/**` | Gradle wrapper validation, debug APK y tests. |
| `docs-ci.yml` | `docs/**` | Build del sitio Astro/Starlight. |

```mermaid
flowchart LR
    Change["Cambio en PR"]
    BackendCI["Backend CI"]
    FrontendCI["Frontend CI"]
    MobileCI["Mobile CI"]
    DocsCI["Docs CI"]
    Review["Revisión técnica"]
    Develop["develop"]

    Change --> BackendCI
    Change --> FrontendCI
    Change --> MobileCI
    Change --> DocsCI
    BackendCI --> Review
    FrontendCI --> Review
    MobileCI --> Review
    DocsCI --> Review
    Review --> Develop
```

## Documentación y herramientas

| Recurso | Descripción |
| --- | --- |
| `docs/` | Sitio técnico y funcional con Astro + Starlight. |
| `postman/SAIP-API-Collection-Complete.json` | Colección completa para validar autenticación, SAIP, apelaciones, TTAIP, estadísticas y reportes. |
| `database/script_saip_db.sql` | Script SQL de apoyo para datos locales. |
| `AGENTS.md` | Reglas locales para asistentes de IA en el repositorio. |

## Roadmap técnico sugerido

| Área | Próxima mejora |
| --- | --- |
| Backend | Incorporar migraciones versionadas y ampliar pruebas de integración de ownership por flujo legal. |
| Frontend | Continuar auditoría responsive, refinamiento visual y mejoras de accesibilidad. |
| Mobile | Profundizar modo offline-first, sincronización incremental y manejo de conflictos. |
| Docs | Publicar arquitectura, ADRs, contratos API y guías de despliegue. |
| DevOps | Incorporar release automation, coverage reports y quality gates por módulo. |

## Licencia

Este proyecto está licenciado bajo **Apache License 2.0**.

Copyright 2025-2026 Kelly Medalit De La Cruz Lopez y Daniel Angel Leon Salazar.

Consulta el archivo [LICENSE](LICENSE) para los términos completos.
