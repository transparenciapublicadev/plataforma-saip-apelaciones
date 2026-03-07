package com.gestion.misaip.core.domain.usecase.notificacion

import com.gestion.misaip.core.domain.model.Notificacion
import com.gestion.misaip.core.domain.repository.NotificacionRepository
import kotlinx.coroutines.flow.Flow

/**
 * Obtener notificaciones del usuario.
 */
class GetNotificacionesUseCase(
    private val notificacionRepository: NotificacionRepository
) {
    fun todas(usuarioId: String): Flow<List<Notificacion>> {
        return notificacionRepository.getNotificacionesUsuario(usuarioId)
    }

    fun noLeidas(usuarioId: String): Flow<List<Notificacion>> {
        return notificacionRepository.getNotificacionesNoLeidas(usuarioId)
    }

    fun conteoNoLeidas(usuarioId: String): Flow<Int> {
        return notificacionRepository.getConteoNoLeidas(usuarioId)
    }
}

/**
 * Marcar notificaciones como leídas.
 */
class MarcarNotificacionLeidaUseCase(
    private val notificacionRepository: NotificacionRepository
) {
    suspend fun una(notificacionId: Long) {
        notificacionRepository.marcarComoLeida(notificacionId)
    }

    suspend fun todas(usuarioId: String) {
        notificacionRepository.marcarTodasComoLeidas(usuarioId)
    }
}

/**
 * Generar notificaciones dinámicas basadas en el estado del sistema.
 * Analiza solicitudes y apelaciones para crear alertas relevantes.
 */
class GenerarNotificacionesDinamicasUseCase(
    private val notificacionRepository: NotificacionRepository
) {
    suspend operator fun invoke(usuarioId: String): List<Notificacion> {
        return notificacionRepository.generarNotificacionesDinamicas(usuarioId)
    }
}
