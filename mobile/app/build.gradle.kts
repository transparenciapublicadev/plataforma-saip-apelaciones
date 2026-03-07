import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.google.services)
}

android {
    namespace = "com.gestion.misaip"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.gestion.misaip"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // REST API base URL — configurable via gradle.properties o local.properties
        buildConfigField("String", "REST_BASE_URL", "\"${project.findProperty("REST_BASE_URL") ?: "http://10.0.2.2:8080/"}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    // ===========================================
    // MÓDULOS INTERNOS (Clean Architecture)
    // ===========================================
    implementation(project(":core:common"))
    implementation(project(":core:domain"))
    implementation(project(":core:data"))
    implementation(project(":core:database"))
    implementation(project(":core:network"))

    // ===========================================
    // ANDROIDX CORE
    // ===========================================
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity.compose)

    // ===========================================
    // JETPACK COMPOSE
    // ===========================================
    implementation(platform(libs.compose.bom))
    implementation(libs.bundles.compose)
    debugImplementation(libs.compose.ui.tooling)

    // ===========================================
    // LIFECYCLE & VIEWMODEL (Compose)
    // ===========================================
    implementation(libs.bundles.lifecycle)

    // ===========================================
    // NAVIGATION 3
    // ===========================================
    implementation(libs.bundles.navigation3)

    // ===========================================
    // KOIN - INYECCIÓN DE DEPENDENCIAS
    // ===========================================
    implementation(libs.bundles.koin)

    // ===========================================
    // COROUTINES
    // ===========================================
    implementation(libs.bundles.coroutines)

    // ===========================================
    // WORKMANAGER - SINCRONIZACIÓN EN SEGUNDO PLANO
    // ===========================================
    implementation(libs.androidx.workmanager)

    // ===========================================
    // FIREBASE
    // ===========================================
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.analytics)
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.auth)
    implementation(libs.firebase.messaging)

    // ===========================================
    // LOGGING
    // ===========================================
    implementation(libs.timber)

    // ===========================================
    // SECURITY - Encrypted SharedPreferences
    // ===========================================
    implementation(libs.androidx.security.crypto)

    // ===========================================
    // TESTING
    // ===========================================
    testImplementation(libs.bundles.testing)
    testImplementation(libs.koin.test)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}