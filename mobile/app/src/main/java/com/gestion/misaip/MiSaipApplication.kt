package com.gestion.misaip

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.util.Log
import androidx.work.Configuration
import com.gestion.misaip.core.data.di.dataModule
import com.gestion.misaip.core.database.SaipDatabase
import com.gestion.misaip.core.database.di.databaseModule
import com.gestion.misaip.core.domain.di.domainModule
import com.gestion.misaip.di.appModule
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import com.gestion.misaip.core.domain.repository.EntidadPublicaRepository
import com.gestion.misaip.core.domain.repository.NotificacionRepository
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import com.gestion.misaip.core.domain.repository.UsuarioRepository
import com.gestion.misaip.core.network.di.restNetworkModule
import com.gestion.misaip.messaging.NotificationPushHelper
import com.gestion.misaip.messaging.FCMHelper
import com.gestion.misaip.messaging.PushTokenSyncCoordinator
import com.gestion.misaip.presentation.di.presentationModule
import com.gestion.misaip.sync.SyncWorkerFactory
import org.koin.android.ext.android.get
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.context.startKoin
import org.koin.core.logger.Level
import timber.log.Timber

/**
 * Application principal de MiSAIP.
 *
 * Inicializa:
 * - Koin (Inyección de Dependencias)
 * - WorkManager (Sincronización en segundo plano)
 * - Timber (Logging)
 */
class MiSaipApplication : Application(), Configuration.Provider {

    override fun onCreate() {
        super.onCreate()

        // Capturar excepciones detalladas solo en debug para no exponer datos en release.
        if (BuildConfig.DEBUG) {
            instalarManejadorErrores()
        }

        // Inicializar Timber para logging (solo en debug)
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }

        // Inicializar Koin
        initKoin()

        // Crear canales de notificación para FCM
        crearCanalesNotificacion()

        // Inicializar helper de notificaciones push
        NotificationPushHelper.init(this)
        FCMHelper.init(get<PushTokenSyncCoordinator>())

        Timber.d("MiSAIP Application initialized")
    }

    /**
     * Crea los canales de notificación para Android 8.0+.
     * Se ejecuta al inicio para que las notificaciones push siempre tengan un canal válido.
     */
    private fun crearCanalesNotificacion() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)

            val canales = listOf(
                // Canal general (default de FCM)
                NotificationChannel(
                    com.gestion.misaip.messaging.NotificationChannels.GENERAL,
                    getString(R.string.channel_general_name),
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = getString(R.string.channel_general_desc)
                    enableLights(true)
                    enableVibration(true)
                },
                // Canal para solicitudes SAIP
                NotificationChannel(
                    com.gestion.misaip.messaging.NotificationChannels.SAIP,
                    getString(R.string.channel_saip_name),
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = getString(R.string.channel_saip_desc)
                    enableLights(true)
                    enableVibration(true)
                },
                // Canal para apelaciones TTAIP
                NotificationChannel(
                    com.gestion.misaip.messaging.NotificationChannels.TTAIP,
                    getString(R.string.channel_ttaip_name),
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = getString(R.string.channel_ttaip_desc)
                    enableLights(true)
                    enableVibration(true)
                },
                // Canal para alertas urgentes (vencimientos)
                NotificationChannel(
                    com.gestion.misaip.messaging.NotificationChannels.ALERTAS,
                    getString(R.string.channel_alertas_name),
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = getString(R.string.channel_alertas_desc)
                    enableLights(true)
                    enableVibration(true)
                }
            )

            notificationManager.createNotificationChannels(canales)
            Timber.d("Canales de notificación creados: ${canales.size}")
        }
    }

    /**
     * Inicializa Koin con todos los módulos de la aplicación.
     *
     * Orden de módulos (por dependencias):
     * 1. Database (SQLDelight)
     * 2. Network (REST API — Spring Boot Backend)
     * 3. Domain (Use Cases)
     * 4. Data (Repositories)
     * 5. App (TokenStorage, helpers)
     * 6. Presentation (ViewModels)
     */
    private fun initKoin() {
        startKoin {
            // Logger de Koin (reducido en release)
            androidLogger(if (BuildConfig.DEBUG) Level.DEBUG else Level.ERROR)

            // Contexto de Android
            androidContext(this@MiSaipApplication)

            // Módulos de Koin
            modules(
                // Core Modules
                databaseModule,
                restNetworkModule(
                    baseUrl = BuildConfig.REST_BASE_URL,
                    enableHttpLogging = BuildConfig.DEBUG
                ),
                domainModule,
                dataModule,

                // App Module (TokenStorage, helpers)
                appModule,

                // Presentation Module
                presentationModule
            )
        }

        Timber.d("Koin initialized with all modules")

        // Verificación temprana de dependencias críticas en debug
        if (BuildConfig.DEBUG) {
            verificarModulosKoin()
        }
    }

    /**
     * Verifica que las dependencias críticas de Koin se resuelven correctamente.
     * Solo en debug — permite detectar errores de DI tempranamente.
     */
    private fun verificarModulosKoin() {
        val tag = "KOIN_VERIFY"
        try {
            val koin = org.koin.core.context.GlobalContext.get()

            // 1. Base de datos
            Log.d(tag, "Verificando SaipDatabase...")
            koin.get<SaipDatabase>()
            Log.d(tag, "  ✓ SaipDatabase OK")

            // 2. Repositorios
            Log.d(tag, "Verificando repositorios...")
            koin.get<UsuarioRepository>()
            Log.d(tag, "  ✓ UsuarioRepository OK")
            koin.get<SolicitudRepository>()
            Log.d(tag, "  ✓ SolicitudRepository OK")
            koin.get<ApelacionRepository>()
            Log.d(tag, "  ✓ ApelacionRepository OK")
            koin.get<EntidadPublicaRepository>()
            Log.d(tag, "  ✓ EntidadPublicaRepository OK")
            koin.get<NotificacionRepository>()
            Log.d(tag, "  ✓ NotificacionRepository OK")

            Log.d(tag, "=== TODAS LAS DEPENDENCIAS VERIFICADAS OK ===")
        } catch (e: Exception) {
            Log.e(tag, "ERROR al verificar dependencias Koin", e)
            // Imprimir la cadena completa de causas
            var cause: Throwable? = e.cause
            var depth = 1
            while (cause != null) {
                Log.e(tag, "  Causa nivel $depth: ${cause::class.simpleName}: ${cause.message}")
                cause = cause.cause
                depth++
            }
        }
    }

    /**
     * Instala un manejador global de excepciones no capturadas
     * para diagnóstico detallado. Solo registra — no previene el crash.
     */
    private fun instalarManejadorErrores() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e("MISAIP_CRASH", "=== EXCEPCIÓN NO CAPTURADA ===")
            Log.e("MISAIP_CRASH", "Thread: ${thread.name}")
            Log.e("MISAIP_CRASH", "Excepción: ${throwable::class.simpleName}: ${throwable.message}")
            // Imprimir la cadena completa de causas
            var cause: Throwable? = throwable.cause
            var depth = 1
            while (cause != null) {
                Log.e("MISAIP_CRASH", "Causa nivel $depth: ${cause::class.simpleName}: ${cause.message}")
                cause = cause.cause
                depth++
            }
            Log.e("MISAIP_CRASH", "Stack trace completo:", throwable)
            // Delegar al handler por defecto para que Android muestre el crash dialog
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    /**
     * Configuración de WorkManager con factory personalizada.
     * Protegido con try-catch por si se accede antes de que Koin esté listo.
     */
    override val workManagerConfiguration: Configuration
        get() {
            return try {
                Configuration.Builder()
                    .setWorkerFactory(SyncWorkerFactory(get(), get(), get()))
                    .setMinimumLoggingLevel(
                        if (BuildConfig.DEBUG) android.util.Log.DEBUG
                        else android.util.Log.ERROR
                    )
                    .build()
            } catch (e: Exception) {
                Timber.e(e, "WorkManager: Error al crear configuración, usando default")
                Configuration.Builder()
                    .setMinimumLoggingLevel(android.util.Log.ERROR)
                    .build()
            }
        }
}
