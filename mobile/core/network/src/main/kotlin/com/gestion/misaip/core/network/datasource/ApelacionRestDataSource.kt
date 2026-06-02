package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.Pagina
import com.gestion.misaip.core.network.api.ApelacionApiService
import com.gestion.misaip.core.network.dto.rest.CrearApelacionRestRequest
import com.gestion.misaip.core.network.dto.rest.extraerMensajeProblemDetails
import kotlinx.serialization.json.Json
import retrofit2.HttpException

/**
 * Implementación REST del datasource de apelaciones.
 * Usa el backend Spring Boot + JWT como fuente remota.
 */
class ApelacionRestDataSource(
    private val apelacionApi: ApelacionApiService,
    private val tokenStorage: TokenStorage,
    private val json: Json
) : ApelacionRemoteDataSource {

    override suspend fun getPaginaApelaciones(pagina: Int, tamano: Int): Pagina<Apelacion> {
        return traducirProblemDetails {
            apelacionApi.listarPaginadas(pagina, tamano).map { it.toDomain() }
        }
    }

    override suspend fun getPaginaApelacionesUsuario(
        usuarioId: String,
        pagina: Int,
        tamano: Int
    ): Pagina<Apelacion> {
        val id = usuarioId.toLongOrNull() ?: return paginaVacia(pagina, tamano)
        return traducirProblemDetails {
            apelacionApi.getByCiudadanoPaginadas(id, pagina, tamano).map { it.toDomain() }
        }
    }

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
        return obtenerTodasLasPaginas { pagina, tamano ->
            getPaginaApelacionesUsuario(usuarioId, pagina, tamano)
        }
    }

    override suspend fun getTodasLasApelaciones(): List<Apelacion> {
        return obtenerTodasLasPaginas(::getPaginaApelaciones)
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
                obtenerTodasLasPaginas { pagina, tamano ->
                    getPaginaApelacionesUsuario(userId.toString(), pagina, tamano)
                }
            }
            "TTAIP", "FUNCIONARIO", "ADMIN" -> {
                obtenerTodasLasPaginas(::getPaginaApelaciones)
            }
            else -> {
                val userId = tokenStorage.getUserId() ?: return emptyList()
                obtenerTodasLasPaginas { pagina, tamano ->
                    getPaginaApelacionesUsuario(userId.toString(), pagina, tamano)
                }
            }
        }
    }

    private suspend fun obtenerTodasLasPaginas(
        cargarPagina: suspend (pagina: Int, tamano: Int) -> Pagina<Apelacion>
    ): List<Apelacion> {
        val resultado = mutableListOf<Apelacion>()
        var pagina = 0
        do {
            val respuesta = cargarPagina(pagina, TAMANO_SYNC)
            resultado += respuesta.contenido
            pagina++
        } while (!respuesta.ultima && pagina < respuesta.totalPaginas)
        return resultado.distinctBy { it.id.ifBlank { it.expediente } }
    }

    private suspend fun <T> traducirProblemDetails(block: suspend () -> T): T {
        return try {
            block()
        } catch (e: HttpException) {
            val mensaje = json.extraerMensajeProblemDetails(e.response()?.errorBody()?.string())
                ?: "No se pudo consultar apelaciones (${e.code()})"
            throw ApiProblemException(mensaje, e.code(), e)
        }
    }

    private fun paginaVacia(pagina: Int, tamano: Int) = Pagina<Apelacion>(
        contenido = emptyList(),
        pagina = pagina,
        tamano = tamano,
        totalElementos = 0,
        totalPaginas = 0,
        ultima = true
    )

    private companion object {
        const val TAMANO_SYNC = 100
    }
}
