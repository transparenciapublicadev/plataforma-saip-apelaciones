package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.network.api.ApelacionApiService
import com.gestion.misaip.core.network.dto.rest.CrearApelacionRestRequest
import com.gestion.misaip.core.network.dto.rest.SubsanacionRestRequest

/**
 * Implementación REST del datasource de apelaciones.
 * Usa el backend Spring Boot en lugar de Firebase.
 */
class ApelacionRestDataSource(
    private val apelacionApi: ApelacionApiService,
    private val tokenStorage: TokenStorage
) : ApelacionRemoteDataSource {

    override suspend fun crearApelacion(apelacion: Apelacion) {
        val userId = tokenStorage.getUserId() ?: throw NetworkException("Usuario no autenticado")
        apelacionApi.crear(
            CrearApelacionRestRequest(
                fundamentos = apelacion.fundamentoLegal,
                solicitudId = apelacion.expedienteSAIP.toLongOrNull()
                    ?: throw NetworkException("ID de solicitud inválido"),
                ciudadanoId = userId
            )
        )
    }

    override suspend fun actualizarApelacion(apelacion: Apelacion) {
        val id = apelacion.id.toLongOrNull() ?: return
        apelacionApi.actualizarEstado(id, mapOf("estado" to apelacion.estado.name))
    }

    override suspend fun getApelacionesUsuario(usuarioId: String): List<Apelacion> {
        val id = usuarioId.toLongOrNull() ?: return emptyList()
        return apelacionApi.getByCiudadano(id).map { it.toDomain() }
    }

    override suspend fun getTodasLasApelaciones(): List<Apelacion> {
        return apelacionApi.listar().map { it.toDomain() }
    }

    override suspend fun getApelacionPorExpediente(expediente: String): Apelacion? {
        return try {
            apelacionApi.getByExpediente(expediente).toDomain()
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun getApelacionesModificadasDesde(desde: Long): List<Apelacion> {
        // El backend no tiene endpoint de sync incremental.
        // Sincronizamos por rol para mantener consistencia con frontend.
        return when (tokenStorage.getTipoUsuario()?.uppercase()) {
            "CIUDADANO" -> {
                val userId = tokenStorage.getUserId() ?: return emptyList()
                apelacionApi.getByCiudadano(userId).map { it.toDomain() }
            }
            "FUNCIONARIO", "TTAIP", "ADMIN" -> {
                apelacionApi.listar().map { it.toDomain() }
            }
            else -> {
                val userId = tokenStorage.getUserId() ?: return emptyList()
                apelacionApi.getByCiudadano(userId).map { it.toDomain() }
            }
        }
    }
}
