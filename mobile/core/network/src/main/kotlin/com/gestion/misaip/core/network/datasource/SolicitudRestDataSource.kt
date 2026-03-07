package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.network.api.SolicitudApiService
import com.gestion.misaip.core.network.dto.rest.CrearSolicitudRestRequest

/**
 * Implementación REST del datasource de solicitudes.
 * Usa el backend Spring Boot en lugar de Firebase.
 */
class SolicitudRestDataSource(
    private val solicitudApi: SolicitudApiService,
    private val tokenStorage: TokenStorage
) : SolicitudRemoteDataSource {

    override suspend fun crearSolicitud(solicitud: Solicitud) {
        val userId = tokenStorage.getUserId() ?: throw NetworkException("Usuario no autenticado")
        solicitudApi.crear(
            CrearSolicitudRestRequest(
                asunto = solicitud.asunto,
                descripcion = solicitud.descripcion,
                entidadId = solicitud.entidadId.toLongOrNull()
                    ?: throw NetworkException("ID de entidad inválido"),
                ciudadanoId = userId,
                tipoInformacion = solicitud.tipo.toDisplayString()
            )
        )
    }

    override suspend fun actualizarSolicitud(solicitud: Solicitud) {
        val id = solicitud.id.toLongOrNull() ?: return
        solicitudApi.actualizarEstado(id, mapOf("estado" to solicitud.estado.toDisplayString()))
    }

    override suspend fun getSolicitudesUsuario(usuarioId: String): List<Solicitud> {
        val id = usuarioId.toLongOrNull() ?: return emptyList()
        return solicitudApi.getByCiudadano(id).map { it.toDomain() }
    }

    override suspend fun getSolicitudPorExpediente(expediente: String): Solicitud? {
        return try {
            solicitudApi.getByExpediente(expediente).toDomain()
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun getSolicitudesModificadasDesde(desde: Long): List<Solicitud> {
        // El backend no tiene endpoint de sync incremental
        // Retornamos todas las solicitudes del usuario
        val userId = tokenStorage.getUserId() ?: return emptyList()
        return solicitudApi.getByCiudadano(userId).map { it.toDomain() }
    }
}
