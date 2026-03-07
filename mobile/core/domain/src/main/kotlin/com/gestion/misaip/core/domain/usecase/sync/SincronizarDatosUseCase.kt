package com.gestion.misaip.core.domain.usecase.sync

import com.gestion.misaip.core.domain.repository.ApelacionRepository
import com.gestion.misaip.core.domain.repository.EntidadPublicaRepository
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Caso de Uso: Sincronizar Datos Completos
 *
 * Coordina la sincronización de todos los repositorios con Firebase.
 * Se invoca después del login exitoso para poblar la BD local con datos del servidor.
 * También es usado por WorkManager para sincronización periódica.
 *
 * Sincroniza en paralelo:
 * - Entidades públicas (catálogo compartido)
 * - Solicitudes SAIP (push + pull)
 * - Apelaciones TTAIP (push + pull)
 *
 * Cada repositorio internamente maneja timeouts para no bloquear en modo offline.
 */
class SincronizarDatosUseCase(
    private val solicitudRepository: SolicitudRepository,
    private val apelacionRepository: ApelacionRepository,
    private val entidadPublicaRepository: EntidadPublicaRepository
) {

    /**
     * Resultado de la sincronización.
     */
    data class SyncResult(
        val exitoso: Boolean,
        val errores: List<String> = emptyList()
    )

    /**
     * Ejecuta la sincronización completa en paralelo.
     * Usa ConcurrentLinkedQueue para recolección thread-safe de errores
     * desde las 3 coroutines paralelas.
     *
     * @return Resultado indicando éxito o listado de errores parciales
     */
    suspend operator fun invoke(): SyncResult = coroutineScope {
        // Thread-safe: 3 async coroutines escriben concurrentemente
        val errores = ConcurrentLinkedQueue<String>()

        // Sincronizar en paralelo: entidades, solicitudes, apelaciones
        val entidadesJob = async {
            try {
                entidadPublicaRepository.sincronizar()
            } catch (e: Exception) {
                errores.add("Entidades: ${e.message}")
            }
        }

        val solicitudesJob = async {
            try {
                solicitudRepository.sincronizar()
            } catch (e: Exception) {
                errores.add("Solicitudes: ${e.message}")
            }
        }

        val apelacionesJob = async {
            try {
                apelacionRepository.sincronizar()
            } catch (e: Exception) {
                errores.add("Apelaciones: ${e.message}")
            }
        }

        // Esperar a que todas terminen
        entidadesJob.await()
        solicitudesJob.await()
        apelacionesJob.await()

        SyncResult(
            exitoso = errores.isEmpty(),
            errores = errores.toList()
        )
    }
}
