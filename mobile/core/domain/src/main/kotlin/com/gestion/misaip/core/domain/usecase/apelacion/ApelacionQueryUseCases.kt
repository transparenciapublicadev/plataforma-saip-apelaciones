package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first

/**
 * Caso de Uso: Obtener Apelación por Expediente SAIP
 *
 * Busca una apelación relacionada con una solicitud SAIP específica.
 */
class GetApelacionPorSAIPUseCase(
    private val apelacionRepository: ApelacionRepository
) {
    operator fun invoke(expedienteSAIP: String): Flow<Apelacion?> {
        require(expedienteSAIP.isNotBlank()) { "El expediente SAIP no puede estar vacío" }
        return apelacionRepository.getApelacionPorSAIP(expedienteSAIP)
    }
}

/**
 * Caso de Uso: Iniciar Calificación de Apelación
 *
 * Un funcionario TTAIP marca una apelación como "En Calificación".
 * Cambia el estado de PENDIENTE a EN_CALIFICACION y agrega evento al timeline.
 */
class IniciarCalificacionUseCase(
    private val apelacionRepository: ApelacionRepository
) {
    suspend operator fun invoke(expediente: String) {
        require(expediente.isNotBlank()) { "El expediente no puede estar vacío" }

        val apelacion = apelacionRepository.getApelacionPorExpediente(expediente).first()
            ?: throw IllegalStateException("No se encontró la apelación $expediente")

        if (apelacion.estado != EstadoApelacion.PENDIENTE) {
            throw IllegalStateException("Solo se puede iniciar calificación de apelaciones pendientes")
        }

        val timelineActualizado = apelacion.timeline + TimelineItem(
            fecha = System.currentTimeMillis(),
            evento = "Apelación en calificación por el TTAIP",
            tipo = "calificacion",
            completado = true
        )

        val apelacionActualizada = apelacion.copy(
            estado = EstadoApelacion.EN_CALIFICACION,
            timeline = timelineActualizado
        )

        apelacionRepository.actualizarApelacion(apelacionActualizada)
    }
}
