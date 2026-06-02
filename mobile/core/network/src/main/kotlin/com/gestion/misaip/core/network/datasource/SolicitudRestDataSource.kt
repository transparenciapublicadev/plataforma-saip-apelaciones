package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.network.api.SolicitudApiService
import com.gestion.misaip.core.network.dto.rest.CrearSolicitudRestRequest
import com.gestion.misaip.core.network.dto.rest.extraerMensajeProblemDetails
import kotlinx.serialization.json.Json
import retrofit2.HttpException

/**
 * Implementación REST del datasource de solicitudes.
 * Usa el backend Spring Boot + JWT como fuente remota.
 */
class SolicitudRestDataSource(
    private val solicitudApi: SolicitudApiService,
    private val tokenStorage: TokenStorage,
    private val json: Json
) : SolicitudRemoteDataSource {

    override suspend fun crearSolicitud(solicitud: Solicitud): Solicitud {
        val userId = tokenStorage.getUserId() ?: throw NetworkException("Usuario no autenticado")
        return try {
            solicitudApi.crear(
                CrearSolicitudRestRequest(
                    asunto = solicitud.asunto,
                    descripcion = solicitud.descripcion,
                    entidadId = solicitud.entidadId.toLongOrNull()
                        ?: throw NetworkException("ID de entidad inválido"),
                    ciudadanoId = userId,
                    tipoInformacion = solicitud.tipo.toDisplayString(),
                    consentimientoDatosPersonales = solicitud.consentimientoDatosPersonales,
                    canalNotificacion = solicitud.canalNotificacion?.name
                        ?: throw NetworkException("Canal formal de notificación no disponible")
                )
            ).toDomain()
        } catch (e: HttpException) {
            val mensaje = json.extraerMensajeProblemDetails(e.response()?.errorBody()?.string())
                ?: "No se pudo registrar la SAIP (${e.code()})"
            throw ApiProblemException(mensaje, e.code(), e)
        }
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
        // El backend no tiene endpoint de sync incremental.
        // Sincronizamos por rol para mantener consistencia con frontend:
        // - CIUDADANO: solo sus solicitudes
        // - FUNCIONARIO: solicitudes de su entidad
        // - TTAIP/ADMIN: listado general
        return when (tokenStorage.getTipoUsuario()?.uppercase()) {
            "CIUDADANO" -> {
                val userId = tokenStorage.getUserId() ?: return emptyList()
                solicitudApi.getByCiudadano(userId).map { it.toDomain() }
            }
            "FUNCIONARIO" -> {
                val entidadId = tokenStorage.getEntidadId()
                    ?: throw NetworkException("Entidad no disponible para usuario FUNCIONARIO")
                solicitudApi.getByEntidad(entidadId).map { it.toDomain() }
            }
            "TTAIP", "ADMIN" -> {
                solicitudApi.listar(page = 0, size = 1000).map { it.toDomain() }
            }
            else -> {
                val userId = tokenStorage.getUserId() ?: return emptyList()
                solicitudApi.getByCiudadano(userId).map { it.toDomain() }
            }
        }
    }
}
