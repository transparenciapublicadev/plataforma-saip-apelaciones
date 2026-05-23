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

    flavorDimensions += "role"

    productFlavors {
        create("ciudadano") {
            dimension = "role"
            applicationId = "com.gestion.misaip.ciudadano"
            resValue("string", "app_name", "MiSAIP Ciudadano")
            buildConfigField("String", "APP_ROLE", "\"CIUDADANO\"")
            buildConfigField("Boolean", "PUBLIC_DISTRIBUTION", "true")
        }

        create("funcionario") {
            dimension = "role"
            applicationId = "com.gestion.misaip.funcionario"
            resValue("string", "app_name", "MiSAIP Funcionario")
            buildConfigField("String", "APP_ROLE", "\"FUNCIONARIO\"")
            buildConfigField("Boolean", "PUBLIC_DISTRIBUTION", "false")
        }

        create("ttaip") {
            dimension = "role"
            applicationId = "com.gestion.misaip.ttaip"
            resValue("string", "app_name", "MiSAIP TTAIP")
            buildConfigField("String", "APP_ROLE", "\"TTAIP\"")
            buildConfigField("Boolean", "PUBLIC_DISTRIBUTION", "false")
        }
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
        resValues = true
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
    // FIREBASE CLOUD MESSAGING ONLY
    // ===========================================
    implementation(platform(libs.firebase.bom))
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

afterEvaluate {
    listOf(
        "Ciudadano" to "com.gestion.misaip.ciudadano",
        "Funcionario" to "com.gestion.misaip.funcionario",
        "Ttaip" to "com.gestion.misaip.ttaip"
    ).forEach { (flavor, appId) ->
        tasks.register("run${flavor}Debug") {
            dependsOn("install${flavor}Debug")
            doLast {
                Runtime.getRuntime().exec(
                    arrayOf(
                        "adb", "shell", "am", "start",
                        "-n", "$appId/com.gestion.misaip.MainActivity"
                    )
                )
            }
        }
    }
}