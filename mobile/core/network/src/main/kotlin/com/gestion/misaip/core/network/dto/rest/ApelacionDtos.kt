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
            usuarioId = ciudadanoId?.toString() ?: "",
            apelante = Apelante(
                nombre = ciudadanoNombre ?: "",
                dni = "",
                email = ""
            ),
            entidad = entidadNombre ?: "",
            entidadId = entidadId?.toString() ?: "",
            asunto = solicitudAsunto ?: "",
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
            diasRestantes = diasSubsanacion
        )
    }
}

/**
 * Mapea el estado del backend al enum del dominio mobile.
 * Ahora los valores son idénticos entre backend y mobile.
 */
private fun mapEstadoApelacion(estado: String?, resultado: String?): EstadoApelacion {
    return EstadoApelacion.fromString(estado ?: "PENDIENTE_ELEVACION")
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
