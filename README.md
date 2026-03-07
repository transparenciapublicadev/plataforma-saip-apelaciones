# Plataforma SAIP — Sistema de Gestión de Acceso a la Información Pública

Plataforma integral para la gestión de Solicitudes de Acceso a la Información Pública (SAIP) y Apelaciones ante el Tribunal de Transparencia y Acceso a la Información Pública (TTAIP), desarrollada bajo el marco normativo de la **Ley N.° 27806** — Ley de Transparencia y Acceso a la Información Pública del Perú.

El sistema permite a los ciudadanos presentar solicitudes de información a entidades públicas, a los funcionarios gestionar y responder dichas solicitudes dentro de los plazos legales, y al TTAIP calificar y resolver apelaciones cuando las solicitudes son denegadas o no son atendidas.

> **Nota**: Este proyecto no representa ni está afiliado a ninguna entidad gubernamental.

---

## Tabla de Contenidos

1. [Autores](#autores)
2. [Arquitectura de la Plataforma](#arquitectura-de-la-plataforma)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estructura del Monorepo](#estructura-del-monorepo)
5. [Módulos del Proyecto](#módulos-del-proyecto)
6. [Glosario de Dominio](#glosario-de-dominio)
7. [Sistema de Roles](#sistema-de-roles)
8. [Reglas de Negocio — Módulo SAIP](#reglas-de-negocio--módulo-saip)
9. [Reglas de Negocio — Módulo Apelaciones TTAIP](#reglas-de-negocio--módulo-apelaciones-ttaip)
10. [Reglas de Negocio — Motor de Notificaciones y Reprocesos](#reglas-de-negocio--motor-de-notificaciones-y-reprocesos)
11. [Reglas de Numeración e Identificadores](#reglas-de-numeración-e-identificadores)
12. [Compilación y Ejecución](#compilación-y-ejecución)
13. [Documentación](#documentación)

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
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  mobile/     │  │  frontend/   │  │  design-reference/     │ │
│  │  Android     │  │  Angular 21  │  │  FigMake (referencia)  │ │
│  │  Kotlin +    │  │  SSR +       │  │  React + Vite          │ │
│  │  Compose     │  │  Tailwind    │  │  (diseño UI target)    │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────┘ │
│         │                 │                                     │
│         └────────┬────────┘                                     │
│                  ▼                                               │
│  ┌──────────────────────────────┐                               │
│  │  backend/                    │                               │
│  │  Spring Boot 4 (Java 21)    │                               │
│  │  REST API + JPA + Security  │                               │
│  └──────────────┬───────────────┘                               │
│                 │                                               │
│      ┌──────────┴──────────┐                                    │
│      ▼                     ▼                                    │
│  ┌────────┐  ┌───────────────────┐                              │
│  │ MySQL  │  │ Firebase          │                              │
│  │ (RDBMS)│  │ Auth + Firestore  │                              │
│  │        │  │ + FCM             │                              │
│  └────────┘  └───────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### Principios de diseño

1. **Clean Architecture**: Separación estricta entre capas de presentación, dominio y datos en cada módulo.
2. **API-First Contract**: El backend publica un OpenAPI spec (`/v3/api-docs`) que es el contrato formal. Frontend genera tipos TypeScript y mobile usa Retrofit — ambos consumidores son **independientes**.
3. **Módulos independientes**: Cada módulo (backend, frontend, mobile) puede construirse, testearse y desplegarse de forma aislada. No comparten código fuente.
4. **Offline-First (mobile)**: SQLDelight como Single Source of Truth. Retrofit sincroniza contra el backend REST.
5. **Design-Driven**: El proyecto `design-reference/` (FigMake) es la referencia visual que el frontend debe replicar fielmente.

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
       │                               │                    mapeados a mano
       │                               │                           │
       ▼                               ▼                           ▼
   MySQL + JPA                   HttpClient + RxJS        OkHttp + SQLDelight
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

### Referencia de Diseño (`design-reference/`)

| Aspecto | Tecnología | Versión |
|---------|------------|---------|
| Framework | React | 18.3.1 |
| Build | Vite | 6.3.5 |
| UI Components | Radix UI + shadcn/ui | — |
| Estilos | Tailwind CSS | 4.1.12 |
| Propósito | Referencia visual (FigMake) para el frontend Angular |

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
├── design-reference/               ← Referencia visual FigMake (React + Vite)
│   ├── package.json
│   └── src/components/             ← Componentes UI de referencia
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

Aplicación web Angular 21 con Tailwind CSS. Consume la API REST del backend. Debe replicar fielmente los diseños del `design-reference/`.

**Páginas organizadas por rol:**
- `pages/auth/` — Login, Registro
- `pages/ciudadano/` — Dashboard ciudadano, Nueva SAIP, Detalle, Apelación, Subsanación
- `pages/funcionario/` — Dashboard funcionario, Responder solicitud, Detalle
- `pages/ttaip/` — Dashboard TTAIP, Calificación, Resolución
- `pages/admin/` — Dashboard administrador

### `mobile/` — App Android

Aplicación Android nativa con Kotlin, Jetpack Compose + Material 3, Clean Architecture + MVVM, Navigation 3.

**Módulos Gradle:**
- `app/` — Presentación (Screens, ViewModels, Theme, Navigation)
- `core/domain/` — Kotlin puro (Models, UseCases, Repository interfaces)
- `core/data/` — Repository implementations, Mappers
- `core/database/` — SQLDelight local DB
- `core/network/` — Firebase (Firestore, Auth, FCM)
- `core/common/` — Utilidades compartidas

### `design-reference/` — Referencia Visual

Proyecto FigMake (React + Vite + Radix UI + Tailwind) que sirve como **diseño de referencia** para el frontend Angular. Cada componente en esta carpeta representa el diseño visual exacto que debe implementarse en `frontend/`.

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
| BR-SAIP-001 | Plazo máximo: **10 días hábiles** para atender una solicitud |
| BR-SAIP-002 | Días hábiles: excluir sábados, domingos y feriados nacionales |
| BR-SAIP-003 | Subsanación solo en los **2 primeros días hábiles** |
| BR-SAIP-004 | Liquidación de costos: notificar a más tardar el **día 9** |
| BR-SAIP-005 | Silencio Administrativo Negativo si >10 días sin respuesta |

### Tipos de respuesta del funcionario

| TipoRespuesta | Estado resultante | Apelable |
|---------------|-------------------|----------|
| `ENTREGA_TOTAL` | Respondida | No |
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
| Elevación | 2 días hábiles | La entidad remite el recurso al TTAIP |
| Primera Calificación | 7 días hábiles | Improcedente / Admisión / Inadmisible |
| Subsanación | 2 días hábiles | Solo si fue declarado Inadmisible |
| Segunda Calificación | — | Post-subsanación: Improcedencia / Admisibilidad |
| Descargos | 7 días hábiles | La entidad presenta descargos |
| Instrucción | 3 días hábiles | Actuaciones internas del TTAIP |
| Resolución Final | 10 días hábiles | Fundado / Infundado |

### Estados del expediente

`PENDIENTE_ELEVACION` → `EN_CALIFICACION_1` → `EN_SUBSANACION` → `EN_CALIFICACION_2` → `ESPERANDO_DESCARGOS` → `EN_INSTRUCCION` → `EN_RESOLUCION` → `RESUELTO`

---

## Reglas de Negocio — Motor de Notificaciones y Reprocesos

| Regla | Descripción |
|-------|-------------|
| BR-REP-001 | Inmutabilidad: cédula rechazada NO se edita, se conserva como histórico |
| BR-REP-002 | Ante rechazo, generar nueva cédula con ID correlativo |
| BR-REP-003 | Mientras exista rechazo sin nueva cédula, expediente en `EN_PROCESO_DE_SUBSANACION` |
| BR-REP-004 | Etapa cierra solo cuando ambas partes tienen notificación `NOTIFICADO` |

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

### Design Reference

```bash
cd design-reference
npm install
npm run dev        # Vite dev server
```

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
