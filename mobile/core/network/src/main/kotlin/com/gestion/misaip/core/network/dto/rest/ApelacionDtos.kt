package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.*
import kotlinx.serialization.Serializable

// =============================================
// REQUEST DTOs
// =============================================

@Serializable
data class CrearApelacionRestRequest(
    val fundamentos: String,
    val solicitudId: Long,
    val ciudadanoId: Long
)

@Serializable
data class CrearApelacionExternaRestRequest(
    val ciudadanoId: Long,
    val entidadId: Long?,
    val numeroSolicitudExterna: String,
    val fechaPresentacionSolicitudExterna: String,
    val tipoDenegatoria: String,
    val fechaRespuestaEntidad: String?,
    val resumenSolicitudOriginal: String,
    val resumenRespuestaEntidad: String?,
    val referenciaDocumentoSolicitud: String,
    val referenciaCargoRecepcion: String?,
    val referenciaRespuestaEntidad: String?,
    val evidenciaSilencioAdministrativo: String?,
    val fundamentos: String,
    val observacion: String?
)

@Serializable
data class CrearApelacionAnteEntidadRestRequest(
    val solicitudId: Long,
    val ciudadanoId: Long,
    val fundamentos: String,
    val fechaPresentacionAnteEntidad: String,
    val referenciaCargoPresentacion: String,
    val observacion: String?
)

@Serializable
data class ElevarApelacionRestRequest(
    val responsableEntidad: String,
    val referenciaExpedienteElevado: String,
    val observacion: String?
)

@Serializable
data class ComunicarOmisionElevacionRestRequest(
    val referenciaPruebaOmision: String,
    val observacion: String?
)

@Serializable
data class SubsanacionRestRequest(
    val fundamentos: String
)

// =============================================
// RESPONSE DTOs
// =============================================

@Serializable
data class ResolucionRestDto(
    val id: Long? = null,
    val tipoResolucion: String? = null,
    val decision: String? = null,
    val fundamentos: String? = null,
    val observaciones: String? = null,
    val fechaResolucion: String? = null,
    val miembroTTAIPId: Long? = null,
    val miembroTTAIPNombre: String? = null
)

@Serializable
data class ElevacionApelacionRestDto(
    val id: Long? = null,
    val apelacionId: Long? = null,
    val expedienteReservado: String? = null,
    val entidadOrigenId: Long? = null,
    val entidadOrigenNombre: String? = null,
    val fechaPresentacionAnteEntidad: String? = null,
    val fechaLimiteElevacion: String? = null,
    val fechaElevacionTtaip: String? = null,
    val fechaComunicacionCiudadano: String? = null,
    val estadoElevacion: String? = null,
    val referenciaCargoPresentacion: String? = null,
    val referenciaExpedienteElevado: String? = null,
    val referenciaPruebaOmision: String? = null,
    val responsableEntidad: String? = null,
    val responsableTtaip: String? = null,
    val observacion: String? = null,
    val trazabilidad: String? = null
) {
    fun toDomain() = ElevacionApelacion(
        id = id?.toString().orEmpty(),
        apelacionId = apelacionId?.toString().orEmpty(),
        expedienteReservado = expedienteReservado.orEmpty(),
        entidadOrigenId = entidadOrigenId?.toString().orEmpty(),
        entidadOrigenNombre = entidadOrigenNombre.orEmpty(),
        fechaPresentacionAnteEntidad = fechaPresentacionAnteEntidad.orEmpty(),
        fechaLimiteElevacion = fechaLimiteElevacion.orEmpty(),
        fechaElevacionTtaip = fechaElevacionTtaip,
        fechaComunicacionCiudadano = fechaComunicacionCiudadano,
        estado = EstadoElevacionApelacion.fromString(estadoElevacion)
            ?: EstadoElevacionApelacion.PENDIENTE,
        referenciaCargoPresentacion = referenciaCargoPresentacion.orEmpty(),
        referenciaExpedienteElevado = referenciaExpedienteElevado,
        referenciaPruebaOmision = referenciaPruebaOmision,
        responsableEntidad = responsableEntidad,
        responsableTtaip = responsableTtaip,
        observacion = observacion,
        trazabilidad = trazabilidad
    )
}

@Serializable
data class ApelacionRestDto(
    val id: Long? = null,
    val expediente: String? = null,
    val fundamentos: String? = null,
    val estado: String? = null,
    val resultado: String? = null,
    val fechaApelacion: String? = null,
    val fechaSubsanacion: String? = null,
    val diasSubsanacion: Int? = null,
    val calificacionPrimera: String? = null,
    val calificacionSegunda: String? = null,
    val solicitudId: Long? = null,
    val solicitudExpediente: String? = null,
    val solicitudAsunto: String? = null,
    val ciudadanoId: Long? = null,
    val ciudadanoNombre: String? = null,
    val entidadId: Long? = null,
    val entidadNombre: String? = null,
    val tipoOrigen: String? = null,
    val entidadExternaNombre: String? = null,
    val entidadExternaRuc: String? = null,
    val entidadExternaEmail: String? = null,
    val numeroSolicitudExterna: String? = null,
    val fechaPresentacionSolicitudExterna: String? = null,
    val fechaRespuestaEntidad: String? = null,
    val tipoDenegatoria: String? = null,
    val resumenSolicitudOriginal: String? = null,
    val resumenRespuestaEntidad: String? = null,
    val referenciaDocumentoSolicitud: String? = null,
    val referenciaCargoRecepcion: String? = null,
    val referenciaRespuestaEntidad: String? = null,
    val evidenciaSilencioAdministrativo: String? = null,
    val observacion: String? = null,
    val elevacion: ElevacionApelacionRestDto? = null,
    val resolucion: ResolucionRestDto? = null,
    val resolucionPrimeraCalificacion: ResolucionRestDto? = null,
    val resolucionSegundaCalificacion: ResolucionRestDto? = null,
    val documentos: List<DocumentoRestDto>? = null
) {
    fun toDomain(): Apelacion {
        return Apelacion(
            id = id?.toString() ?: "",
            expediente = expediente ?: "",
            expedienteSAIP = solicitudExpediente ?: "",
            solicitudId = solicitudId?.toString(),
            usuarioId = ciudadanoId?.toString() ?: "",
            apelante = Apelante(
                nombre = ciudadanoNombre ?: "",
                dni = "",
                email = ""
            ),
            entidad = entidadNombre ?: "",
            entidadId = entidadId?.toString() ?: "",
            asunto = solicitudAsunto ?: numeroSolicitudExterna ?: "Apelación TTAIP",
            fundamentoLegal = fundamentos ?: "",
            exposicionHechos = "",
            pretension = "",
            fechaPresentacion = parseApelacionDate(fechaApelacion),
            estado = mapEstadoApelacion(estado, resultado),
            primeraCalificacion = calificacionPrimera?.let {
                Calificacion(
                    fecha = 0L,
                    resultado = ResultadoCalificacion.fromString(it),
                    fundamentacion = ""
                )
            },
            segundaCalificacion = calificacionSegunda?.let {
                Calificacion(
                    fecha = 0L,
                    resultado = ResultadoCalificacion.fromString(it),
                    fundamentacion = ""
                )
            },
            subsanacion = fechaSubsanacion?.let {
                Subsanacion(
                    fecha = parseApelacionDate(it),
                    textoCorregido = ""
                )
            },
            diasRestantes = diasSubsanacion,
            tipoOrigen = TipoOrigenApelacion.fromString(tipoOrigen),
            datosExternos = numeroSolicitudExterna?.let {
                DatosApelacionExterna(
                    numeroSolicitudExterna = it,
                    fechaPresentacionSolicitudExterna = fechaPresentacionSolicitudExterna.orEmpty(),
                    tipoDenegatoria = TipoDenegatoria.fromString(tipoDenegatoria) ?: TipoDenegatoria.TACITA,
                    fechaRespuestaEntidad = fechaRespuestaEntidad,
                    resumenSolicitudOriginal = resumenSolicitudOriginal.orEmpty(),
                    resumenRespuestaEntidad = resumenRespuestaEntidad,
                    referenciaDocumentoSolicitud = referenciaDocumentoSolicitud.orEmpty(),
                    referenciaCargoRecepcion = referenciaCargoRecepcion,
                    referenciaRespuestaEntidad = referenciaRespuestaEntidad,
                    evidenciaSilencioAdministrativo = evidenciaSilencioAdministrativo,
                    observacion = observacion
                )
            },
            elevacion = elevacion?.toDomain()
        )
    }
}

/**
 * Mapea el estado del backend al enum del dominio mobile.
 * Ahora los valores son idénticos entre backend y mobile.
 */
private fun mapEstadoApelacion(estado: String?, resultado: String?): EstadoApelacion {
    return EstadoApelacion.fromString(estado ?: "EN_CALIFICACION_1")
}

private fun parseApelacionDate(dateStr: String?): Long {
    if (dateStr.isNullOrBlank()) return 0L
    return try {
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).parse(dateStr)?.time ?: 0L
    } catch (_: Exception) {
        try {
            java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(dateStr)?.time ?: 0L
        } catch (_: Exception) { 0L }
    }
}
