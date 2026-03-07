package com.gestion.misaip.core.domain.usecase.solicitud

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first

/**
 * Caso de Uso: Obtener Solicitudes de una Entidad
 *
 * Recupera todas las solicitudes SAIP dirigidas a una entidad específica.
 */
class GetSolicitudesEntidadUseCase(
    private val solicitudRepository: SolicitudRepository
) {
    operator fun invoke(entidadId: String): Flow<List<Solicitud>> {
        require(entidadId.isNotBlank()) { "El ID de la entidad no puede estar vacío" }
        return solicitudRepository.getSolicitudesEntidad(entidadId)
    }
}

/**
 * Caso de Uso: Iniciar Revisión de Solicitud
 *
 * Un funcionario de entidad marca una solicitud como "En Revisión".
 * Cambia el estado de RECEPCIONADA a EN_REVISION y agrega evento al timeline.
 */
class IniciarRevisionUseCase(
    private val solicitudRepository: SolicitudRepository
) {
    suspend operator fun invoke(expediente: String) {
        require(expediente.isNotBlank()) { "El expediente no puede estar vacío" }

        val solicitud = solicitudRepository.getSolicitudPorExpediente(expediente).first()
            ?: throw IllegalStateException("No se encontró la solicitud $expediente")

        if (solicitud.estado != EstadoSolicitud.RECEPCIONADA) {
            throw IllegalStateException("Solo se puede iniciar revisión de solicitudes recepcionadas")
        }

        val timelineActualizado = solicitud.timeline + TimelineItem(
            fecha = System.currentTimeMillis(),
            evento = "Solicitud en revisión por ${solicitud.entidad}",
            tipo = "revision",
            completado = true
        )

        val solicitudActualizada = solicitud.copy(
            estado = EstadoSolicitud.EN_REVISION,
            timeline = timelineActualizado
        )

        solicitudRepository.actualizarSolicitud(solicitudActualizada)
    }
}
