pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MiSAIP"

// =============================================================================
// ARQUITECTURA MULTIMODULAR - Clean Architecture + MVVM
// =============================================================================
// :app                 -> Capa de Presentación (Compose, ViewModels, DI, Theme)
// :core:domain         -> Kotlin Puro (Modelos, UseCases, Repository Interfaces) — LOCAL
// :core:data           -> Implementación Repositorios, Mappers, DataSources
// :core:database       -> SQLDelight, DAOs, Entidades BD
// :core:network        -> REST API (Retrofit + OkHttp) + Firebase
// :core:common         -> Utilidades compartidas (Android)
// =============================================================================

include(":app")

// Core Modules
include(":core:domain")
include(":core:data")
include(":core:database")
include(":core:network")
include(":core:common")

