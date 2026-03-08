# Plataforma SAIP — Sistema de Gestión de Acceso a la Información Pública

Plataforma integral para la gestión de Solicitudes de Acceso a la Información Pública (SAIP) y Apelaciones ante el Tribunal de Transparencia y Acceso a la Información Pública (TTAIP), desarrollada bajo el marco normativo de la **Ley N.° 27806** — Ley de Transparencia y Acceso a la Información Pública del Perú.

El sistema permite a los ciudadanos presentar solicitudes de información a entidades públicas, a los funcionarios gestionar y responder dichas solicitudes dentro de los plazos legales, y al TTAIP calificar y resolver apelaciones cuando las solicitudes son denegadas o no son atendidas.

> **Nota**: Este proyecto no representa ni está afiliado a ninguna entidad gubernamental.

---

## Tabla de Contenidos

- [Plataforma SAIP — Sistema de Gestión de Acceso a la Información Pública](#plataforma-saip--sistema-de-gestión-de-acceso-a-la-información-pública)
  - [Tabla de Contenidos](#tabla-de-contenidos)
  - [Autores](#autores)
  - [Arquitectura de la Plataforma](#arquitectura-de-la-plataforma)
    - [Principios de diseño](#principios-de-diseño)
    - [Flujo del contrato API](#flujo-del-contrato-api)
  - [Stack Tecnológico](#stack-tecnológico)
    - [Backend (`backend/`)](#backend-backend)
    - [Frontend (`frontend/`)](#frontend-frontend)
    - [Mobile (`mobile/`)](#mobile-mobile)
  - [Estructura del Monorepo](#estructura-del-monorepo)
  - [Módulos del Proyecto](#módulos-del-proyecto)
    - [`backend/` — API REST](#backend--api-rest)
    - [`frontend/` — SPA Angular](#frontend--spa-angular)
    - [`mobile/` — App Android](#mobile--app-android)
  - [Glosario de Dominio](#glosario-de-dominio)
    - [Distinción crítica: SAIP ≠ Expediente](#distinción-crítica-saip--expediente)
  - [Sistema de Roles](#sistema-de-roles)
  - [Reglas de Negocio — Módulo SAIP](#reglas-de-negocio--módulo-saip)
    - [Tipos de respuesta del funcionario](#tipos-de-respuesta-del-funcionario)
    - [Semáforo de estado](#semáforo-de-estado)
  - [Reglas de Negocio — Módulo Apelaciones TTAIP](#reglas-de-negocio--módulo-apelaciones-ttaip)
    - [Tipos de Resolución del TTAIP](#tipos-de-resolución-del-ttaip)
    - [Estados del expediente](#estados-del-expediente)
  - [Reglas de Negocio — Motor de Notificaciones y Reprocesos](#reglas-de-negocio--motor-de-notificaciones-y-reprocesos)
  - [Reglas de Numeración e Identificadores](#reglas-de-numeración-e-identificadores)
  - [Compilación y Ejecución](#compilación-y-ejecución)
    - [Backend](#backend)
    - [Frontend](#frontend)
    - [Mobile](#mobile)
    - [Sincronizar contrato OpenAPI](#sincronizar-contrato-openapi)
  - [CI/CD](#cicd)
  - [Documentación](#documentación)
  - [Licencia](#licencia)

---

## Autores

| Nombre | Rol | Contribución |
|--------|-----|--------------|
| **Kelly De la Cruz Lopez** | Co-autora, Analista Funcional | Concepción e ideación del proyecto, levantamiento y especificación de requisitos funcionales, definición de reglas de negocio, modelado del flujo de trámite SAIP y apelaciones TTAIP, diseño del dominio y validación funcional |
| **Daniel Angel Leon Salazar** | Co-autor, Arquitecto de Software | Diseño e implementación de la arquitectura Clean Architecture + MVVM multimodular, desarrollo integral de la aplicación Android nativa, backend Spring Boot, frontend Angular, integración con Firebase, sistema de notificaciones push y despliegue técnico |

---

## Arquitectura de la Plataforma

La plataforma sigue una arquitectura **Clean Architecture** en cada capa, con separación estricta de responsabilidades y comunicación unidireccional entre capas.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                     │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │  mobile/     │  │  frontend/   │                                │
│  │  Android     │  │  Angular 21  │                                │
│  │  Kotlin +    │  │  SSR +       │                                │
│  │  Compose     │  │  Tailwind    │                                │
│  └──┬───────┬───┘  └──────┬───────┘                                │
│     │       │              │                                        │
│     │  ┌────┴──────────────┘  (REST API — Retrofit / HttpClient)   │
│     │  │                                                            │
│     │  ▼                                                            │
│     │  ┌──────────────────────────────┐                             │
│     │  │  backend/                    │                             │
│     │  │  Spring Boot 4 (Java 21)    │                             │
│     │  │  REST API + JPA + Security  │                             │
│     │  └──────────────┬───────────────┘                             │
│     │                 │                                             │
│     │                 ▼                                             │
│     │           ┌────────┐                                          │
│     │           │ MySQL  │                                          │
│     │           │ (RDBMS)│                                          │
│     │           └────────┘                                          │
│     │                                                               │
│     ▼  (Auth + FCM — directo desde mobile)                         │
│  ┌───────────────────┐                                              │
│  │ Firebase          │                                              │
│  │ Auth + FCM        │                                              │
│  └───────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Principios de diseño

1. **Clean Architecture**: Separación estricta entre capas de presentación, dominio y datos en cada módulo.
2. **API-First Contract**: El backend publica un OpenAPI spec (`/v3/api-docs`) que es el contrato formal. Frontend genera tipos TypeScript y mobile usa Retrofit — ambos consumidores son **independientes**.
3. **Módulos independientes**: Cada módulo (backend, frontend, mobile) puede construirse, testearse y desplegarse de forma aislada. No comparten código fuente.
4. **Offline-First (mobile)**: SQLDelight como Single Source of Truth. Retrofit sincroniza contra el backend REST API.
5. **Smart Auth Gateway (mobile)**: Firebase Auth opcional para push/analytics. Autenticación principal mediante JWT contra el backend REST. Bypass de Firebase cuando hay conectividad directa al backend.

### Flujo del contrato API

```
Backend (Spring Boot)          Frontend (Angular)           Mobile (Android)
       │                              │                           │
       │  OpenAPI Spec                 │                           │
       │  /v3/api-docs ──────────────► │  openapi-typescript        │
       │       │                       │  genera schema.ts          │
       │       │                       │                           │
       │       └──────────────────────────────────────────────────► │
       │                               │                    Retrofit DTOs
       │◄──── REST API ──────────────────────────────────────────► │
       │                               │                    mapeados a mano
       │                               │                           │
       ▼                               ▼                           ▼
   MySQL + JPA                   HttpClient + RxJS       Retrofit + SQLDelight
                                                         + Firebase (Auth/FCM)
```

---

## Stack Tecnológico

### Backend (`backend/`)

| Aspecto | Tecnología | Versión |
|---------|------------|---------|
| Framework | Spring Boot | 4.0.0 |
| Lenguaje | Java | 21 |
| Build | Maven | Wrapper incluido |
| ORM | Spring Data JPA / Hibernate | — |
| Seguridad | Spring Security | — |
| Validación | Jakarta Bean Validation | — |
| Base de datos | MySQL | 8.x |
| Puerto | — | 8080 |

### Frontend (`frontend/`)

| Aspecto | Tecnología | Versión |
|---------|------------|---------|
| Framework | Angular | 21.0.0 |
| Lenguaje | TypeScript | 5.9.2 |
| Estilos | Tailwind CSS | 4.1.12 |
| Testing | Vitest | 4.0.8 |
| SSR | Express (Angular SSR) | 5.1.0 |
| Gráficos | @swimlane/ngx-charts | — |
| Package Manager | npm | 11.6.4 |

### Mobile (`mobile/`)

| Aspecto | Tecnología | Versión |
|---------|------------|---------|
| Lenguaje | Kotlin (exclusivo) | 2.3.10 |
| UI | Jetpack Compose + Material 3 | — |
| Arquitectura | Clean Architecture + MVVM | — |
| Navegación | Navigation 3 (NavDisplay + NavKey) | 1.0.1 |
| DI | Koin | 4.1.1 |
| DB Local | SQLDelight | 2.2.1 |
| Backend Remoto | Retrofit 2.11.0 + OkHttp 4.12.0 (REST API) | — |
| Push / Analytics | Firebase (Auth + FCM) | BOM 34.10.0 |
| Build | AGP 9.1.0, Gradle 9.3.1 | compileSdk 36, minSdk 24 |


---

## Estructura del Monorepo

```
plataforma-saip/
├── .github/
│   └── workflows/                  ← CI/CD (GitHub Actions)
│       ├── backend-ci.yml
│       ├── frontend-ci.yml
│       └── mobile-ci.yml
├── backend/                        ← API REST (Spring Boot 4, Java 21)
│   ├── pom.xml
│   └── src/
│       ├── main/
│       │   ├── java/pe/gob/saip/backend/
│       │   │   ├── config/         ← CorsConfig
│       │   │   ├── controller/     ← REST Controllers
│       │   │   ├── exception/      ← GlobalExceptionHandler
│       │   │   ├── model/
│       │   │   │   ├── dto/        ← DTOs
│       │   │   │   └── entity/     ← JPA Entities
│       │   │   ├── repository/     ← Spring Data Repositories
│       │   │   ├── security/       ← SecurityConfig
│       │   │   └── service/        ← Business Services
│       │   └── resources/
│       │       └── application.properties
│       └── test/
├── frontend/                       ← SPA (Angular 21, Tailwind CSS)
│   ├── angular.json
│   ├── package.json
│   └── src/
│       └── app/
│           ├── guards/             ← Auth guards
│           ├── interceptors/       ← HTTP interceptors
│           ├── models/             ← TypeScript interfaces
│           ├── pages/
│           │   ├── admin/
│           │   ├── auth/
│           │   ├── ciudadano/
│           │   ├── funcionario/
│           │   ├── home/
│           │   └── ttaip/
│           └── services/           ← HTTP services
├── mobile/                         ← App Android (Kotlin, Compose, MVVM)
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   ├── gradle/libs.versions.toml
│   ├── app/                        ← Capa de Presentación
│   └── core/
│       ├── domain/                 ← Kotlin puro (modelos, UseCases, interfaces) — LOCAL
│       ├── data/                   ← Repository implementations, Mappers
│       ├── database/               ← SQLDelight
│       ├── network/                ← Retrofit (REST API) + Firebase (Push/Analytics)
│       └── common/                 ← Utilidades compartidas
├── scripts/                        ← Scripts de sincronización (OpenAPI spec)
│   ├── sync-openapi.sh             ← Linux/macOS
│   └── sync-openapi.ps1            ← Windows
├── docs/                           ← Documentación técnica y funcional (en progreso)
├── .gitignore
├── LICENSE
└── README.md
```

---

## Módulos del Proyecto

### `backend/` — API REST

API RESTful construida con Spring Boot 4 y Java 21. Gestiona la lógica de negocio centralizada, persistencia en MySQL y autenticación con Spring Security.

**Controllers:**
- `SolicitudRestController` — CRUD de solicitudes SAIP
- `ApelacionRestController` — Gestión de apelaciones TTAIP
- `AuthRestController` — Autenticación y registro
- `RespuestaRestController` — Respuestas de funcionarios
- `TTAIPRestController` — Operaciones del tribunal
- `EntidadRestController` — Gestión de entidades públicas
- `CiudadanoRestController` — Operaciones de ciudadanos
- `FuncionarioRestController` — Operaciones de funcionarios
- `EstadisticasRestController` — Dashboard estadísticas
- `ReportesRestController` — Generación de reportes

### `frontend/` — SPA Angular

Aplicación web Angular 21 con Tailwind CSS. Consume la API REST del backend.

**Páginas organizadas por rol:**
- `pages/auth/` — Login, Registro
- `pages/ciudadano/` — Dashboard ciudadano, Nueva SAIP, Detalle solicitud, Nueva apelación, Subsanación
- `pages/funcionario/` — Dashboard funcionario, Responder solicitud, Detalle solicitud
- `pages/ttaip/` — Dashboard TTAIP, Calificar, Segunda Calificación, Resolver, Resolución Detalle, Proceso Disciplinario
- `pages/admin/` — Dashboard administrador

### `mobile/` — App Android

Aplicación Android nativa con Kotlin, Jetpack Compose + Material 3, Clean Architecture + MVVM, Navigation 3.

**Módulos Gradle:**
- `app/` — Presentación (Screens, ViewModels, Theme, Navigation)
- `core/domain/` — Kotlin puro (Models, UseCases, Repository interfaces)
- `core/data/` — Repository implementations, Mappers
- `core/database/` — SQLDelight local DB
- `core/network/` — Retrofit (REST API) + Firebase (Auth/FCM)
- `core/common/` — Utilidades compartidas

---

## Glosario de Dominio

| Término | Definición |
|---------|-----------|
| **SAIP** | Solicitud de Acceso a la Información Pública (primera instancia). NO es un expediente. Formato `SAIP-AAAA-NNNNN`. |
| **TTAIP** | Tribunal de Transparencia y Acceso a la Información Pública (segunda instancia). |
| **Recurrente** | Ciudadano que solicita información o apela. |
| **Entidad** | Organismo público que posee la información. |
| **Expediente** | Contenedor digital del trámite TTAIP. Solo se crea cuando el ciudadano apela. Formato `NNNNN-AAAA-JUS/TTAIP`. |
| **Resolución** | Decisión emitida por la entidad o el TTAIP (Admisibilidad, Improcedencia, Fundado, Infundado). |
| **Cédula de Notificación** | Documento numerado que certifica un intento de notificación según la resolución emitida. |
| **Reproceso** | Nueva cédula de notificación generada tras notificación fallida. |
| **Cargo** | Acuse de recibo (evidencia de que la notificación fue recibida). |
| **Silencio Administrativo Negativo** | Estado automático cuando la entidad no responde en plazo legal (10 días hábiles). |

### Distinción crítica: SAIP ≠ Expediente

- **Solicitud SAIP** = primera instancia. Número `SAIP-AAAA-NNNNN`. **NO es un expediente.**
- **Expediente TTAIP** = segunda instancia. Se crea **únicamente** cuando el ciudadano apela. Número `NNNNN-AAAA-JUS/TTAIP`.
- Las Resoluciones y Cédulas de Notificación solo existen dentro de un Expediente TTAIP.
- En la UI: usar "N° SAIP" para solicitudes, "Expediente" solo para apelaciones TTAIP.

---

## Sistema de Roles

| Rol | Enum | Dashboard | Descripción |
|-----|------|-----------|-------------|
| Ciudadano | `CIUDADANO` | Dashboard Ciudadano | Presenta solicitudes SAIP y apelaciones |
| Funcionario | `FUNCIONARIO` | Dashboard Entidad | Gestiona y responde solicitudes de su entidad |
| Vocal TTAIP | `TTAIP` | Dashboard TTAIP | Califica y resuelve apelaciones |
| Administrador | `ADMIN` | Dashboard Admin | Administración general del sistema |

---

## Reglas de Negocio — Módulo SAIP

Basadas en la Ley N.° 27806.

| Regla | Descripción |
|-------|-------------|
| `BR‑SAIP‑001` | Plazo máximo: **10 días hábiles** para atender una solicitud. El conteo inicia el **día hábil siguiente** a la recepción (día de recepción = día 0). Si la SAIP se presenta fuera del horario laboral de la entidad, se considera recibida el siguiente día hábil y el plazo inicia al día hábil posterior |
| `BR‑SAIP‑002` | Días hábiles: excluir sábados, domingos y feriados nacionales |
| `BR‑SAIP‑003` | Subsanación solo en los **2 primeros días hábiles** |
| `BR‑SAIP‑004` | Liquidación de costos: notificar a más tardar el **día 9** |
| `BR‑SAIP‑005` | Silencio Administrativo Negativo si >10 días sin respuesta |
| `BR‑SAIP‑006` | Plazo para apelar: **15 días calendario** contados desde la fecha de recepción de la respuesta de la entidad (aplica para cualquier tipo de respuesta: total, parcial, denegatoria) |

### Tipos de respuesta del funcionario

| TipoRespuesta | Estado resultante | Apelable |
|---------------|-------------------|----------|
| `ENTREGA_TOTAL` | Respondida | Sí (el ciudadano puede discrepar si la entrega fue realmente completa) |
| `ENTREGA_PARCIAL` | Respondida | Sí |
| `DENEGACION_TOTAL` | Denegada | Sí |
| `SILENCIO_ADMINISTRATIVO` | Vencida | Sí |

### Semáforo de estado

| Color | Rango | Significado |
|-------|-------|-------------|
| 🟢 Verde | Días 0–5 | En plazo |
| 🟡 Ámbar | Días 6–8 | Próximo a vencer |
| 🔴 Rojo | Días 9–10 | Urgente |
| ⚫ Negro | Vencido | Silencio Administrativo |

---

## Reglas de Negocio — Módulo Apelaciones TTAIP

Flujo secuencial según SRS v2.0:

| Etapa | Plazo | Descripción |
|-------|-------|-------------|
| Presentación del recurso | 15 días calendario | Plazo del ciudadano para presentar apelación, contado desde la fecha de recepción de la respuesta de la entidad |
| Elevación | 2 días hábiles | La entidad remite el recurso al TTAIP |
| Primera Calificación | 7 días hábiles | Genera **Primera Resolución**: Improcedente (→ rechazo definitivo) / Inadmisible (→ subsanación) / Admisión |
| Subsanación | 2 días hábiles | Solo si fue declarado Inadmisible. Si el ciudadano NO subsana, se genera resolución `TENER POR NO PRESENTADO` y finaliza el proceso |
| Segunda Calificación | — | Post-subsanación. Genera **Segunda Resolución**: Admitido (→ trámite) / Improcedente (→ rechazo definitivo). **Debe notificarse al ciudadano** antes de continuar |
| Notificación post-calificación | — | La resolución de admisibilidad o improcedencia se notifica al ciudadano. Solo después de notificación correcta inicia el plazo de resolución final |
| Resolución Final | 10 días hábiles | Decisiones posibles: Fundado, Fundado en parte, Infundado, Infundado en parte, Improcedente, Conclusión por sustracción de la materia, Conclusión por desistimiento |

### Tipos de Resolución del TTAIP

| Decisión | Descripción | Cuándo aplica |
|----------|-------------|---------------|
| **Fundado** | Se ampara el recurso de apelación y se ordena a la entidad entregar la información | Resolución Final |
| **Fundado en parte** | Se ampara parcialmente el recurso, ordenando la entrega parcial de información | Resolución Final |
| **Infundado** | Se desestima el recurso de apelación, confirmando la conducta de la entidad | Resolución Final |
| **Infundado en parte** | Se desestima parcialmente, confirmando parte de la conducta de la entidad | Resolución Final |
| **Improcedente** | El recurso no cumple requisitos formales o de fondo para ser tramitado | Primera Resolución, Segunda Resolución o Resolución Final |
| **Conclusión por sustracción de la materia** | La entidad entrega la información durante el trámite de apelación, haciendo innecesario el pronunciamiento de fondo | Resolución Final |
| **Conclusión por desistimiento** | El ciudadano desiste voluntariamente de su recurso de apelación | Resolución Final |
| **No presentado** | El ciudadano no subsana las observaciones dentro del plazo de 2 días hábiles tras ser declarado inadmisible | Primera Resolución |

### Estados del expediente

`PENDIENTE_ELEVACION` → `EN_CALIFICACION_1` → `EN_SUBSANACION` → `EN_CALIFICACION_2` → `NOTIFICACION_SEGUNDA_CALIFICACION` → `EN_RESOLUCION` → `RESUELTO`

> Estados terminales alternativos: `TENER_POR_NO_PRESENTADO` (si el ciudadano no subsana en plazo), `CONCLUSION_SUSTRACCION_MATERIA`, `CONCLUSION_DESISTIMIENTO`

---

## Reglas de Negocio — Motor de Notificaciones y Reprocesos

| Regla | Descripción |
|-------|-------------|
| `BR‑REP‑001` | Inmutabilidad: cédula rechazada NO se edita, se conserva como histórico |
| `BR‑REP‑002` | Ante rechazo, generar nueva cédula con ID correlativo |
| `BR‑REP‑003` | Mientras exista rechazo sin nueva cédula, expediente en `EN_PROCESO_DE_SUBSANACION` |
| `BR‑REP‑004` | **Notificaciones normales**: Etapa cierra solo cuando ambas partes tienen notificación `NOTIFICADO`. **Reprocesos**: Pueden afectar solo al recurrente, solo a la entidad, o ambos. El estado cambia a `SUBSANADO` cuando se re-notifica la nueva cédula a la parte afectada, se consigna la nueva fecha de notificación y el número de cédula/oficio utilizado |

---

## Reglas de Numeración e Identificadores

Todos los identificadores son **globalmente únicos**.

| Formato | Ejemplo |
|---------|---------|
| `SAIP-AAAA-NNNNN` | `SAIP-2025-00512` |
| `NNNNN-AAAA-JUS/TTAIP` | `01560-2025-JUS/TTAIP` |
| `CÉDULA DE NOTIFICACIÓN N.° NNNNN-AAAA-JUS/TTAIP` | `15203-2025-JUS/TTAIP` |
| `RESOLUCIÓN N.° NNNNNN-AAAA-JUS/TTAIP-[SALA]` | `001595-2025-JUS/TTAIP-PRIMERA SALA` |

Firmante por defecto: José Ángel Dávila Córdova (Secretario Técnico).

---

## Compilación y Ejecución

### Backend

```bash
cd backend
./mvnw spring-boot:run
# o en Windows:
mvnw.cmd spring-boot:run
```

Requiere MySQL corriendo en `localhost:3306` con la base de datos `saip_db`.

### Frontend

```bash
cd frontend
npm install
npm start          # ng serve (dev server)
npm run build      # Producción
npm test           # Vitest
```

### Mobile

```powershell
cd mobile
.\gradlew.bat assembleDebug
```

Requiere `google-services.json` en `mobile/app/`.

### Sincronizar contrato OpenAPI

Cuando el backend modifica endpoints o DTOs, los consumidores deben actualizar su contrato:

```powershell
# Windows (requiere backend corriendo en localhost:8080)
.\scripts\sync-openapi.ps1

# Linux/macOS
./scripts/sync-openapi.sh
```

Esto descarga el OpenAPI spec, lo guarda en `frontend/openapi.json` y `mobile/openapi.json`,
y regenera automáticamente los tipos TypeScript del frontend.

---

## CI/CD

El proyecto usa **GitHub Actions** con pipelines independientes por módulo:

| Workflow | Trigger (paths) | Qué hace |
|----------|-----------------|----------|
| `backend-ci.yml` | `backend/**` | Maven build + tests (Java 21, H2) + genera OpenAPI spec |
| `frontend-ci.yml` | `frontend/**` | npm install + TypeScript check + Vitest + Angular build |
| `mobile-ci.yml` | `mobile/**` | Gradle assembleDebug + tests + upload APK artifact |

Cada pipeline se ejecuta solo cuando cambian archivos en su módulo correspondiente.

---

## Documentación

La carpeta `docs/` contiene la documentación técnica y funcional del proyecto. Consultar [docs/README.md](docs/README.md) para la estructura planificada.

---

## Licencia

Ver [LICENSE](LICENSE).
