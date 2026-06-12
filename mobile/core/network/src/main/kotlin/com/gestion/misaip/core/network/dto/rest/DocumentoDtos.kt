package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.Documento
import com.gestion.misaip.core.domain.model.TipoDocumento
import kotlinx.serialization.Serializable

@Serializable
data class DocumentoMetadataRestDto(
    val id: Long,
    val tipoDocumento: String,
    val nombreOriginal: String,
    val contentType: String,
    val sizeBytes: Long,
    val hashSha256: String? = null,
    val estado: String,
    val creadoPorId: Long? = null,
    val fechaCreacion: String? = null,
    val fechaActualizacion: String? = null,
    val solicitudId: Long? = null,
    val respuestaId: Long? = null,
    val apelacionId: Long? = null,
    val expedienteTtaipId: Long? = null,
    val resolucionId: Long? = null,
    val cedulaNotificacionId: Long? = null
)

fun DocumentoRestDto.toDomainDocumento(): Documento? {
    val documentoId = id ?: return null
    return Documento(
        id = documentoId.toString(),
        nombreOriginal = nombreArchivo.orEmpty().ifBlank { "Documento $documentoId" },
        contentType = tipoArchivo ?: "application/octet-stream",
        sizeBytes = tamanio ?: 0L,
        fechaCreacion = fechaSubida,
        tipoDocumento = TipoDocumento.fromString(tipoDocumento)
    )
}
