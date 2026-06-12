package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.*
import kotlinx.serialization.Serializable

// =============================================
// REQUEST DTOs
// =============================================

@Serializable
data class CrearSolicitudRestRequest(
    val asunto: String,
    val descripcion: String,
    val entidadId: Long,
    val ciudadanoId: Long,
    val tipoInformacion: String? = null,
    val formatoDigital: Boolean? = true,
    val formatoFisico: Boolean? = false,
    val copiaSimple: Boolean? = true,
    val copiaCertificada: Boolean? = false,
    val consentimientoDatosPersonales: Boolean,
    val canalNotificacion: String
)

// =============================================
// RESPONSE DTOs
// =============================================

@Serializable
data class RespuestaRestDto(
    val id: Long? = null,
    val tipoRespuesta: String? = null,
    val decision: String? = null,
    val contenido: String? = null,
    val causalDenegatoria: String? = null,
    val fundamentoLegal: String? = null,
    val fechaRespuesta: String? = null,
    val funcionarioId: Long? = null,
    val funcionarioNombre: String? = null,
    val documentos: List<DocumentoRestDto>? = null
)

@Serializable
data class ApelacionInfoRestDto(
    val id: Long? = null,
    val expediente: String? = null,
    val estado: String? = null,
    val resultado: String? = null,
    val fechaApelacion: String? = null,
    val fechaSubsanacion: String? = null,
    val diasSubsanacion: Int? = null
)

@Serializable
data class DocumentoRestDto(
    val id: Long? = null,
    val nombreArchivo: String? = null,
    val rutaArchivo: String? = null,
    val tipoArchivo: String? = null,
    val tamanio: Long? = null,
    val tipoDocumento: String? = null,
    val fechaSubida: String? = null
)

@Serializable
data class SolicitudRestDto(
    val id: Long? = null,
    val expediente: String? = null,
    val asunto: String? = null,
    val descripcion: String? = null,
    val estado: String? = null,
    val prioridad: String? = null,
    val semaforo: String? = null,
    val fechaPresentacion: String? = null,
    val fechaLimite: String? = null,
    val diasRestantes: Int? = null,
    val ciudadanoId: Long? = null,
    val ciudadanoNombre: String? = null,
    val ciudadanoDni: String? = null,
    val entidadId: Long? = null,
    val entidadNombre: String? = null,
    val entidadAcronimo: String? = null,
    val formatoDigital: Boolean? = null,
    val formatoFisico: Boolean? = null,
    val copiaSimple: Boolean? = null,
    val copiaCertificada: Boolean? = null,
    val tipoInformacion: String? = null,
    val consentimientoDatosPersonales: Boolean? = null,
    val canalNotificacion: String? = null,
    val respuesta: RespuestaRestDto? = null,
    val apelacion: ApelacionInfoRestDto? = null,
    val documentos: List<DocumentoRestDto>? = null
) {
    fun toDomain(): Solicitud {
        return Solicitud(
            id = id?.toString() ?: "",
            expediente = expediente ?: "",
            tipo = TipoSolicitud.fromString(tipoInformacion ?: "ACCESO_INFORMACION"),
            entidad = entidadNombre ?: "",
            entidadId = entidadId?.toString() ?: "",
            usuarioId = ciudadanoId?.toString() ?: "",
            solicitante = Solicitante(
                nombre = ciudadanoNombre ?: "",
                dni = ciudadanoDni ?: "",
                email = "",
                telefono = "",
                direccion = ""
            ),
            asunto = asunto ?: "",
            descripcion = descripcion ?: "",
            consentimientoDatosPersonales = consentimientoDatosPersonales ?: false,
            canalNotificacion = CanalNotificacion.fromStringOrNull(canalNotificacion),
            fechaCreacion = parseDate(fechaPresentacion),
            fechaLimite = parseDate(fechaLimite),
            estado = EstadoSolicitud.fromString(estado ?: "RECEPCIONADA"),
            diasRestantes = diasRestantes,
            prioridad = Prioridad.fromString(prioridad ?: "MEDIA"),
            respuestaEntidad = respuesta?.let { r ->
                RespuestaEntidad(
                    fechaRespuesta = parseDate(r.fechaRespuesta),
                    funcionario = r.funcionarioNombre ?: "",
                    tipo = TipoRespuesta.fromString(r.tipoRespuesta ?: ""),
                    fundamentacion = r.contenido ?: "",
                    archivos = r.documentos?.mapNotNull { it.rutaArchivo } ?: emptyList()
                )
            },
            silencioAdministrativo = estado == "VENCIDA",
            timeline = emptyList(),
            documentos = documentos.orEmpty().mapNotNull(DocumentoRestDto::toDomainDocumento)
        )
    }
}

/**
 * Parsea fecha ISO del backend (yyyy-MM-dd'T'HH:mm:ss) a epoch millis.
 */
private fun parseDate(dateStr: String?): Long {
    if (dateStr.isNullOrBlank()) return 0L
    return try {
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).parse(dateStr)?.time ?: 0L
    } catch (_: Exception) {
        try {
            java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(dateStr)?.time ?: 0L
        } catch (_: Exception) { 0L }
    }
}
