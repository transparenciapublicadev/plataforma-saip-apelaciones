package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.Documento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.EstadoDocumento
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
    val fechaCreacion: String? = null,
    val solicitudId: Long? = null,
    val respuestaId: Long? = null,
    val apelacionId: Long? = null,
    val expedienteTtaipId: Long? = null,
    val resolucionId: Long? = null,
    val cedulaNotificacionId: Long? = null
)

fun DocumentoMetadataRestDto.toDomainDocumento(): Documento {
    val relationIds = listOf(
        solicitudId,
        respuestaId,
        apelacionId,
        expedienteTtaipId,
        resolucionId,
        cedulaNotificacionId
    )
    val relacion = if (relationIds.all { it == null }) {
        null
    } else {
        DocumentoRelacion.fromIds(
            solicitudId = solicitudId?.toString(),
            respuestaId = respuestaId?.toString(),
            apelacionId = apelacionId?.toString(),
            expedienteTtaipId = expedienteTtaipId?.toString(),
            resolucionId = resolucionId?.toString(),
            cedulaNotificacionId = cedulaNotificacionId?.toString()
        )
    }
    return Documento(
        id = id.toString(),
        nombreOriginal = nombreOriginal,
        contentType = contentType,
        sizeBytes = sizeBytes,
        hashSha256 = hashSha256,
        estado = EstadoDocumento.fromString(estado),
        fechaCreacion = fechaCreacion,
        tipoDocumento = TipoDocumento.fromString(tipoDocumento),
        relacion = relacion
    )
}

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
