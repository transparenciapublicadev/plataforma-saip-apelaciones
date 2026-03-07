package com.gestion.misaip.sync

import android.content.Context
import androidx.work.*
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import com.gestion.misaip.core.domain.repository.EntidadPublicaRepository
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.util.concurrent.TimeUnit

/**
 * Worker para sincronización de datos en segundo plano.
 *
 * Se ejecuta cuando hay conexión a internet para:
 * - Subir cambios locales pendientes a Firebase
 * - Descargar actualizaciones del servidor
 * - Sincronizar catálogo de entidades públicas
 *
 * Utiliza WorkManager para garantizar ejecución confiable.
 */
class SyncWorker(
    context: Context,
    workerParams: WorkerParameters,
    private val solicitudRepository: SolicitudRepository,
    private val apelacionRepository: ApelacionRepository,
    private val entidadPublicaRepository: EntidadPublicaRepository
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val WORK_NAME = "sync_work"
        const val TAG = "SyncWorker"

        /**
         * Programa la sincronización periódica.
         * Se ejecuta cada 15 minutos cuando hay conexión.
         */
        fun schedulePeriodic(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
                repeatInterval = 15,
                repeatIntervalTimeUnit = TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .addTag(TAG)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    syncRequest
                )

            Timber.d("Periodic sync scheduled")
        }

        /**
         * Ejecuta sincronización inmediata (one-time).
         */
        fun syncNow(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .addTag(TAG)
                .build()

            WorkManager.getInstance(context)
                .enqueue(syncRequest)

            Timber.d("Immediate sync enqueued")
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Timber.d("Starting sync work...")

        try {
            // Sincronizar solicitudes
            solicitudRepository.sincronizar()
            Timber.d("Solicitudes synced")

            // Sincronizar apelaciones
            apelacionRepository.sincronizar()
            Timber.d("Apelaciones synced")

            // Sincronizar catálogo de entidades
            entidadPublicaRepository.sincronizar()
            Timber.d("Entidades synced")

            Timber.d("Sync completed successfully")
            Result.success()
        } catch (e: Exception) {
            Timber.e(e, "Sync failed")

            // Reintentar si hay más intentos disponibles
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
}

/**
 * Factory para crear SyncWorker con inyección de dependencias.
 */
class SyncWorkerFactory(
    private val solicitudRepository: SolicitudRepository,
    private val apelacionRepository: ApelacionRepository,
    private val entidadPublicaRepository: EntidadPublicaRepository
) : WorkerFactory() {

    override fun createWorker(
        appContext: Context,
        workerClassName: String,
        workerParameters: WorkerParameters
    ): ListenableWorker? {
        return when (workerClassName) {
            SyncWorker::class.java.name -> {
                SyncWorker(
                    appContext, workerParameters,
                    solicitudRepository, apelacionRepository, entidadPublicaRepository
                )
            }
            else -> null
        }
    }
}

