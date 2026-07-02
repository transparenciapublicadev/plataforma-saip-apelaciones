package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.Calificacion
import com.gestion.misaip.core.domain.model.ComunicarOmisionElevacion
import com.gestion.misaip.core.domain.model.ElevacionApelacion
import com.gestion.misaip.core.domain.model.Pagina
import com.gestion.misaip.core.domain.model.RegistrarApelacionAnteEntidad
import com.gestion.misaip.core.domain.model.RegistrarApelacionExterna
import com.gestion.misaip.core.domain.model.RegistrarElevacionApelacion
import com.gestion.misaip.core.domain.model.ResultadoCalificacion
import com.gestion.misaip.core.domain.model.Subsanacion
import com.gestion.misaip.core.network.api.ApelacionApiService
import com.gestion.misaip.core.network.api.TTAIPApiService
import com.gestion.misaip.core.network.dto.rest.CalificacionRestRequest
import com.gestion.misaip.core.network.dto.rest.ComunicarOmisionElevacionRestRequest
import com.gestion.misaip.core.network.dto.rest.CrearApelacionRestRequest
import com.gestion.misaip.core.network.dto.rest.CrearApelacionAnteEntidadRestRequest
import com.gestion.misaip.core.network.dto.rest.CrearApelacionExternaRestRequest
import com.gestion.misaip.core.network.dto.rest.ElevarApelacionRestRequest
import com.gestion.misaip.core.network.dto.rest.SubsanacionRestRequest
import com.gestion.misaip.core.network.dto.rest.extraerMensajeProblemDetails
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Implementación REST del datasource de apelaciones.
 * Usa el backend Spring Boot + JWT como fuente remota.
 */
class ApelacionRestDataSource(
    private val apelacionApi: ApelacionApiService,
    private val ttaipApi: TTAIPApiService,
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

    override suspend fun crearApelacion(apelacion: Apelacion): Apelacion {
        val userId = tokenStorage.getUserId() ?: throw NetworkException("Usuario no autenticado")
        return traducirProblemDetails {
            apelacionApi.crear(
                CrearApelacionRestRequest(
                    fundamentos = apelacion.fundamentoLegal,
                    solicitudId = apelacion.solicitudId?.toLongOrNull()
                        ?: throw NetworkException("ID de solicitud inválido"),
                    ciudadanoId = userId
                )
            ).toDomain()
        }
    }

    override suspend fun crearApelacionExterna(request: RegistrarApelacionExterna): Apelacion {
        return traducirProblemDetails {
            apelacionApi.crearExterna(
                CrearApelacionExternaRestRequest(
                    ciudadanoId = request.ciudadanoId.toLongRequerido("ciudadano"),
                    entidadId = request.entidadId?.toLongOrNull(),
                    numeroSolicitudExterna = request.numeroSolicitudExterna,
                    fechaPresentacionSolicitudExterna = request.fechaPresentacionSolicitudExterna,
                    tipoDenegatoria = request.tipoDenegatoria.name,
                    fechaRespuestaEntidad = request.fechaRespuestaEntidad,
                    resumenSolicitudOriginal = request.resumenSolicitudOriginal,
                    resumenRespuestaEntidad = request.resumenRespuestaEntidad,
                    referenciaDocumentoSolicitud = request.referenciaDocumentoSolicitud,
                    referenciaCargoRecepcion = request.referenciaCargoRecepcion,
                    referenciaRespuestaEntidad = request.referenciaRespuestaEntidad,
                    evidenciaSilencioAdministrativo = request.evidenciaSilencioAdministrativo,
                    fundamentos = request.fundamentos,
                    observacion = request.observacion
                )
            ).toDomain()
        }
    }

    override suspend fun crearApelacionAnteEntidad(request: RegistrarApelacionAnteEntidad): Apelacion {
        return traducirProblemDetails {
            apelacionApi.crearAnteEntidad(
                CrearApelacionAnteEntidadRestRequest(
                    solicitudId = request.solicitudId.toLongRequerido("solicitud"),
                    ciudadanoId = request.ciudadanoId.toLongRequerido("ciudadano"),
                    fundamentos = request.fundamentos,
                    fechaPresentacionAnteEntidad = request.fechaPresentacionAnteEntidad,
                    referenciaCargoPresentacion = request.referenciaCargoPresentacion,
                    observacion = request.observacion
                )
            ).toDomain()
        }
    }

    override suspend fun getElevacion(apelacionId: String): ElevacionApelacion {
        return traducirProblemDetails {
            apelacionApi.getElevacion(apelacionId.toLongRequerido("apelación")).toDomain()
        }
    }

    override suspend fun getPendientesElevacionEntidad(entidadId: String): List<ElevacionApelacion> {
        return traducirProblemDetails {
            apelacionApi.getPendientesElevacionEntidad(entidadId.toLongRequerido("entidad"))
                .map { it.toDomain() }
        }
    }

    override suspend fun elevarApelacion(
        apelacionId: String,
        request: RegistrarElevacionApelacion
    ): Apelacion {
        return traducirProblemDetails {
            apelacionApi.elevar(
                apelacionId.toLongRequerido("apelación"),
                ElevarApelacionRestRequest(
                    responsableEntidad = request.responsableEntidad,
                    referenciaExpedienteElevado = request.referenciaExpedienteElevado,
                    observacion = request.observacion
                )
            ).toDomain()
        }
    }

    override suspend fun comunicarOmisionElevacion(
        apelacionId: String,
        request: ComunicarOmisionElevacion
    ): ElevacionApelacion {
        return traducirProblemDetails {
            apelacionApi.comunicarOmision(
                apelacionId.toLongRequerido("apelación"),
                ComunicarOmisionElevacionRestRequest(
                    referenciaPruebaOmision = request.referenciaPruebaOmision,
                    observacion = request.observacion
                )
            ).toDomain()
        }
    }

    override suspend fun calificarApelacion(
        expediente: String,
        tipo: String,
        calificacion: Calificacion
    ): Apelacion = traducirProblemDetails {
        val apelacion = apelacionApi.getByExpediente(expediente)
        val apelacionId = apelacion.id ?: throw NetworkException("La apelación no tiene ID remoto")
        val request = CalificacionRestRequest(
            fundamentos = calificacion.fundamentacion,
            observaciones = calificacion.observacionesSubsanacion
        )
        when (calificacion.resultado) {
            ResultadoCalificacion.ADMISIBLE,
            ResultadoCalificacion.ADMITIDO -> ttaipApi.admitirApelacion(apelacionId, request)
            ResultadoCalificacion.INADMISIBLE -> {
                require(tipo.equals("primera", ignoreCase = true)) {
                    "La inadmisibilidad solo corresponde a primera calificación"
                }
                ttaipApi.requerirSubsanacion(apelacionId, request)
            }
            ResultadoCalificacion.IMPROCEDENTE -> ttaipApi.inadmitirApelacion(apelacionId, request)
        }.toDomain()
    }

    override suspend fun presentarSubsanacion(
        id: Long,
        fundamentos: String,
        fileBytes: ByteArray?,
        fileName: String?,
        mimeType: String?
    ): Apelacion = traducirProblemDetails {
        val filePart = if (fileBytes != null && fileName != null && mimeType != null) {
            val requestFile = fileBytes.toRequestBody(mimeType.toMediaTypeOrNull())
            MultipartBody.Part.createFormData("archivo", fileName, requestFile)
        } else null

        val fundamentosBody = fundamentos.toRequestBody("text/plain".toMediaTypeOrNull())

        apelacionApi.presentarSubsanacion(
            id,
            fundamentosBody,
            filePart
        ).toDomain()
    }

    private fun String.toLongRequerido(nombre: String): Long {
        return toLongOrNull() ?: throw NetworkException("ID de $nombre inválido")
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
