package com.gestion.misaip.core.domain.usecase.solicitud

import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import com.gestion.misaip.core.domain.repository.SolicitudEstadisticas
import kotlinx.coroutines.flow.Flow

/**
 * Caso de Uso: Obtener Todas las Solicitudes (Administrador)
 *
 * Recupera todas las solicitudes SAIP del sistema.
 * Solo debe ser usado por el administrador.
 *
 * @param solicitudRepository Repositorio de solicitudes (inyectado por Koin)
 */
class GetTodasLasSolicitudesUseCase(
    private val solicitudRepository: SolicitudRepository
) {

    /**
     * Ejecuta el caso de uso.
     *
     * @return Flow de lista de todas las solicitudes
     */
    operator fun invoke(): Flow<List<Solicitud>> {
        return solicitudRepository.getTodasLasSolicitudes()
    }
}

/**
 * Caso de Uso: Obtener Solicitudes del Usuario
 *
 * Recupera todas las solicitudes SAIP de un usuario específico.
 * El Flow proviene de la base de datos local (SSOT - Single Source of Truth).
 *
 * @param solicitudRepository Repositorio de solicitudes (inyectado por Koin)
 */
class GetSolicitudesUsuarioUseCase(
    private val solicitudRepository: SolicitudRepository
) {

    /**
     * Ejecuta el caso de uso.
     *
     * @param usuarioId ID del usuario
     * @return Flow de lista de solicitudes del usuario
     */
    operator fun invoke(usuarioId: String): Flow<List<Solicitud>> {
        require(usuarioId.isNotBlank()) { "El ID del usuario no puede estar vacío" }
        return solicitudRepository.getSolicitudesUsuario(usuarioId)
    }
}

/**
 * Caso de Uso: Obtener Solicitud por Expediente
 *
 * Recupera una solicitud específica por su número de expediente.
 *
 * @param solicitudRepository Repositorio de solicitudes (inyectado por Koin)
 */
class GetSolicitudPorExpedienteUseCase(
    private val solicitudRepository: SolicitudRepository
) {

    /**
     * Ejecuta el caso de uso.
     *
     * @param expediente Número de expediente SAIP
     * @return Flow de la solicitud o null si no existe
     */
    operator fun invoke(expediente: String): Flow<Solicitud?> {
        require(expediente.isNotBlank()) { "El expediente no puede estar vacío" }
        return solicitudRepository.getSolicitudPorExpediente(expediente)
    }
}

/**
 * Caso de Uso: Obtener Estadísticas de Solicitudes
 *
 * Obtiene las estadísticas de solicitudes de un usuario.
 *
 * @param solicitudRepository Repositorio de solicitudes (inyectado por Koin)
 */
class GetEstadisticasSolicitudesUseCase(
    private val solicitudRepository: SolicitudRepository
) {

    /**
     * Ejecuta el caso de uso.
     *
     * @param usuarioId ID del usuario
     * @return Flow de estadísticas
     */
    operator fun invoke(usuarioId: String) = solicitudRepository.getEstadisticas(usuarioId)
}

