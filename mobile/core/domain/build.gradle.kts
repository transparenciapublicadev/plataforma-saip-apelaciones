plugins {
    alias(libs.plugins.kotlin.jvm)
}

// ============================================================================
// MÓDULO DE DOMINIO - KOTLIN PURO (LOCAL AL MOBILE)
// ============================================================================
// Copia local del dominio compartido.
// No debe tener NINGUNA dependencia de Android ni Firebase.
// Solo tipos estándar de Kotlin.
// ============================================================================

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    // Coroutines (Kotlin Puro - sin Android)
    implementation(libs.kotlinx.coroutines.core)

    // Koin Core (sin Android)
    implementation(libs.koin.core)

    // Testing
    testImplementation(libs.bundles.testing)
}
