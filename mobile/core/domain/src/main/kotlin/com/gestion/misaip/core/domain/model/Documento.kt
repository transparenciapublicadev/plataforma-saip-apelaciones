package com.gestion.misaip.core.domain.model

import java.io.InputStream
import java.io.OutputStream

data class Documento(
    val id: String,
    val nombreOriginal: String,
    val contentType: String,
    val sizeBytes: Long,
    val hashSha256: String? = null,
    val estado: EstadoDocumento = EstadoDocumento.ACTIVO,
    val fechaCreacion: String? = null,
    val tipoDocumento: TipoDocumento = TipoDocumento.DOCUMENTO_ADJUNTO,
    val relacion: DocumentoRelacion? = null
)

enum class TipoDocumento {
    SOLICITUD_ORIGINAL,
    RESPUESTA_ENTIDAD,
    RECURSO_APELACION,
    RESOLUCION_TTAIP,
    CEDULA_NOTIFICACION,
    EXPEDIENTE_ADMINISTRATIVO,
    INFORME,
    DOCUMENTO_ADJUNTO,
    SUBSANACION,
    OTRO;

    companion object {
        fun fromString(value: String?): TipoDocumento {
            return entries.firstOrNull { it.name == value?.trim()?.uppercase() }
                ?: DOCUMENTO_ADJUNTO
        }
    }
}

enum class EstadoDocumento {
    ACTIVO,
    ELIMINADO;

    companion object {
        fun fromString(value: String?): EstadoDocumento {
            return entries.firstOrNull { it.name == value?.trim()?.uppercase() }
                ?: ACTIVO
        }
    }
}

sealed interface DocumentoRelacion {
    val id: String

    data class Solicitud(override val id: String) : DocumentoRelacion
    data class Respuesta(override val id: String) : DocumentoRelacion
    data class Apelacion(override val id: String) : DocumentoRelacion
    data class ExpedienteTtaip(override val id: String) : DocumentoRelacion
    data class Resolucion(override val id: String) : DocumentoRelacion
    data class CedulaNotificacion(override val id: String) : DocumentoRelacion

    companion object {
        fun fromIds(
            solicitudId: String? = null,
            respuestaId: String? = null,
            apelacionId: String? = null,
            expedienteTtaipId: String? = null,
            resolucionId: String? = null,
            cedulaNotificacionId: String? = null
        ): DocumentoRelacion {
            val relaciones = listOfNotNull(
                solicitudId.normalized()?.let(::Solicitud),
                respuestaId.normalized()?.let(::Respuesta),
                apelacionId.normalized()?.let(::Apelacion),
                expedienteTtaipId.normalized()?.let(::ExpedienteTtaip),
                resolucionId.normalized()?.let(::Resolucion),
                cedulaNotificacionId.normalized()?.let(::CedulaNotificacion)
            )
            require(relaciones.size == 1) {
                "Debe indicar exactamente una relación documental."
            }
            return relaciones.single()
        }

        private fun String?.normalized(): String? = this?.trim()?.takeIf(String::isNotEmpty)
    }
}

data class ArchivoDocumento(
    val nombre: String,
    val contentType: String,
    val sizeBytes: Long,
    val abrirContenido: () -> InputStream
)

data class DestinoDescargaDocumento(
    val abrirDestino: () -> OutputStream
)

data class ResultadoDescargaDocumento(
    val nombreOriginal: String,
    val contentType: String,
    val sizeBytes: Long
)
