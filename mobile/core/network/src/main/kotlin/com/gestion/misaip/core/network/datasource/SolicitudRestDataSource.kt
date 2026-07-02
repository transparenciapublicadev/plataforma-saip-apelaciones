package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.Pagina
import com.gestion.misaip.core.domain.model.AmpliacionPlazoSolicitud
import com.gestion.misaip.core.domain.model.EncauzamientoSolicitud
import com.gestion.misaip.core.domain.model.PlazoSeguimiento
import com.gestion.misaip.core.domain.model.LiquidacionCostoSolicitud
import com.gestion.misaip.core.domain.model.ObservacionSolicitud
import com.gestion.misaip.core.domain.model.OperacionesSolicitudFuncionario
import com.gestion.misaip.core.domain.model.RegistrarAmpliacionPlazoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarEncauzamientoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarLiquidacionCostoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarObservacionSolicitud
import com.gestion.misaip.core.domain.model.RespuestaEntidad
import com.gestion.misaip.core.network.api.RespuestaApiService
import com.gestion.misaip.core.network.api.SolicitudApiService
import com.gestion.misaip.core.network.dto.rest.CrearRespuestaRestRequest
import com.gestion.misaip.core.network.dto.rest.CrearSolicitudRestRequest
import com.gestion.misaip.core.network.dto.rest.extraerMensajeProblemDetails
import com.gestion.misaip.core.network.dto.rest.toRest
import kotlinx.serialization.json.Json
import retrofit2.HttpException

/**
 * Implementación REST del datasource de solicitudes.
 * Usa el backend Spring Boot + JWT como fuente remota.
 */
class SolicitudRestDataSource(
    private val solicitudApi: SolicitudApiService,
    private val respuestaApi: RespuestaApiService,
    private val tokenStorage: TokenStorage,
    private val json: Json
) : SolicitudRemoteDataSource {

    override suspend fun getPaginaSolicitudes(pagina: Int, tamano: Int): Pagina<Solicitud> {
        return traducirProblemDetails {
            solicitudApi.listarPaginadas(pagina, tamano).map { it.toDomain() }
        }
    }

    override suspend fun getPaginaSolicitudesUsuario(
        usuarioId: String,
        pagina: Int,
        tamano: Int
    ): Pagina<Solicitud> {
        val id = usuarioId.toLongOrNull() ?: return paginaVacia(pagina, tamano)
        return traducirProblemDetails {
            solicitudApi.getByCiudadanoPaginadas(id, pagina, tamano).map { it.toDomain() }
        }
    }

    override suspend fun getPaginaSolicitudesEntidad(
        entidadId: String,
        pagina: Int,
        tamano: Int
    ): Pagina<Solicitud> {
        val id = entidadId.toLongOrNull() ?: return paginaVacia(pagina, tamano)
        return traducirProblemDetails {
            solicitudApi.getByEntidadPaginadas(id, pagina, tamano).map { it.toDomain() }
        }
    }

    override suspend fun getOperacionesFuncionario(
        solicitudId: String
    ): OperacionesSolicitudFuncionario {
        val id = solicitudId.requireRemoteId()
        return traducirProblemDetails {
            OperacionesSolicitudFuncionario(
                observaciones = solicitudApi.listarObservaciones(id).map { it.toDomain() },
                ampliaciones = solicitudApi.listarAmpliaciones(id).map { it.toDomain() },
                encauzamientos = solicitudApi.listarEncauzamientos(id).map { it.toDomain() },
                liquidaciones = solicitudApi.listarLiquidaciones(id).map { it.toDomain() }
            )
        }
    }

    override suspend fun registrarObservacion(
        solicitudId: String,
        request: RegistrarObservacionSolicitud
    ): ObservacionSolicitud = traducirProblemDetails {
        solicitudApi.observar(solicitudId.requireRemoteId(), request.toRest()).toDomain()
    }

    override suspend fun registrarAmpliacion(
        solicitudId: String,
        request: RegistrarAmpliacionPlazoSolicitud
    ): AmpliacionPlazoSolicitud = traducirProblemDetails {
        solicitudApi.registrarAmpliacion(solicitudId.requireRemoteId(), request.toRest()).toDomain()
    }

    override suspend fun registrarEncauzamiento(
        solicitudId: String,
        request: RegistrarEncauzamientoSolicitud
    ): EncauzamientoSolicitud = traducirProblemDetails {
        solicitudApi.registrarEncauzamiento(solicitudId.requireRemoteId(), request.toRest()).toDomain()
    }

    override suspend fun emitirLiquidacion(
        solicitudId: String,
        request: RegistrarLiquidacionCostoSolicitud
    ): LiquidacionCostoSolicitud = traducirProblemDetails {
        solicitudApi.emitirLiquidacion(solicitudId.requireRemoteId(), request.toRest()).toDomain()
    }

    override suspend fun responderSolicitud(
        solicitudId: String,
        respuesta: RespuestaEntidad
    ): RespuestaEntidad = traducirProblemDetails {
        respuestaApi.crear(
            CrearRespuestaRestRequest(
                solicitudId = solicitudId.requireRemoteId(),
                funcionarioId = tokenStorage.getUserId()
                    ?: throw NetworkException("Usuario no autenticado"),
                tipoRespuesta = respuesta.tipo.name,
                contenido = respuesta.fundamentacion
            )
        ).toDomain()
    }

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
        return obtenerTodasLasPaginas { pagina, tamano ->
            getPaginaSolicitudesUsuario(usuarioId, pagina, tamano)
        }
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
                obtenerTodasLasPaginas { pagina, tamano ->
                    getPaginaSolicitudesUsuario(userId.toString(), pagina, tamano)
                }
            }
            "FUNCIONARIO" -> {
                val entidadId = tokenStorage.getEntidadId()
                    ?: throw NetworkException("Entidad no disponible para usuario FUNCIONARIO")
                obtenerTodasLasPaginas { pagina, tamano ->
                    getPaginaSolicitudesEntidad(entidadId.toString(), pagina, tamano)
                }
            }
            "TTAIP", "ADMIN" -> {
                obtenerTodasLasPaginas(::getPaginaSolicitudes)
            }
            else -> {
                val userId = tokenStorage.getUserId() ?: return emptyList()
                obtenerTodasLasPaginas { pagina, tamano ->
                    getPaginaSolicitudesUsuario(userId.toString(), pagina, tamano)
                }
            }
        }
    }

    private suspend fun obtenerTodasLasPaginas(
        cargarPagina: suspend (pagina: Int, tamano: Int) -> Pagina<Solicitud>
    ): List<Solicitud> {
        val resultado = mutableListOf<Solicitud>()
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
                ?: "No se pudo consultar solicitudes (${e.code()})"
            throw ApiProblemException(mensaje, e.code(), e)
        }
    }

    private fun paginaVacia(pagina: Int, tamano: Int) = Pagina<Solicitud>(
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

    private fun String.requireRemoteId(): Long {
        return toLongOrNull() ?: throw NetworkException("La SAIP aún no tiene un ID remoto válido")
    }

    override suspend fun obtenerSeguimientoPlazo(id: Long): PlazoSeguimiento {
        return traducirProblemDetails {
            val response = solicitudApi.obtenerSeguimientoPlazo(id)
            if (response.isSuccessful) {
                response.body()?.toDomain() ?: throw NetworkException("Respuesta vacía del servidor")
            } else {
                throw NetworkException("Error al consultar el seguimiento de plazo (${response.code()})")
            }
        }
    }
}
