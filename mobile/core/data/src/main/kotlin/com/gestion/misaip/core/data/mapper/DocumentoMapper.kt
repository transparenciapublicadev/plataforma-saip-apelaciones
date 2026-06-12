package com.gestion.misaip.core.data.mapper

import com.gestion.misaip.core.domain.model.Documento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.EstadoDocumento
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.network.dto.rest.DocumentoMetadataRestDto
import com.gestion.misaip.core.network.dto.rest.DocumentoRestDto
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

object DocumentoMapper {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun toDomain(dto: DocumentoMetadataRestDto): Documento {
        return Documento(
            id = dto.id.toString(),
            nombreOriginal = dto.nombreOriginal,
            contentType = dto.contentType,
            sizeBytes = dto.sizeBytes,
            hashSha256 = dto.hashSha256,
            estado = EstadoDocumento.fromString(dto.estado),
            fechaCreacion = dto.fechaCreacion,
            tipoDocumento = TipoDocumento.fromString(dto.tipoDocumento),
            relacion = dto.toRelacion()
        )
    }

    fun toDomain(dto: DocumentoRestDto): Documento? {
        val id = dto.id ?: return null
        return Documento(
            id = id.toString(),
            nombreOriginal = dto.nombreArchivo.orEmpty().ifBlank { "Documento $id" },
            contentType = dto.tipoArchivo ?: "application/octet-stream",
            sizeBytes = dto.tamanio ?: 0L,
            fechaCreacion = dto.fechaSubida,
            tipoDocumento = TipoDocumento.fromString(dto.tipoDocumento)
        )
    }

    fun encodeMetadata(documentos: List<Documento>): String {
        return json.encodeToString(documentos.map(DocumentoCacheDto::fromDomain))
    }

    fun decodeMetadata(value: String): List<Documento> {
        if (value.isBlank() || value == "[]") return emptyList()
        return runCatching {
            json.decodeFromString<List<DocumentoCacheDto>>(value).map(DocumentoCacheDto::toDomain)
        }.getOrDefault(emptyList())
    }

    private fun DocumentoMetadataRestDto.toRelacion(): DocumentoRelacion? {
        return when {
            solicitudId != null -> DocumentoRelacion.Solicitud(solicitudId.toString())
            apelacionId != null -> DocumentoRelacion.Apelacion(apelacionId.toString())
            expedienteTtaipId != null ->
                DocumentoRelacion.ExpedienteTtaip(expedienteTtaipId.toString())
            resolucionId != null -> DocumentoRelacion.Resolucion(resolucionId.toString())
            cedulaNotificacionId != null ->
                DocumentoRelacion.CedulaNotificacion(cedulaNotificacionId.toString())
            else -> null
        }
    }
}

@Serializable
private data class DocumentoCacheDto(
    val id: String,
    val nombreOriginal: String,
    val contentType: String,
    val sizeBytes: Long,
    val hashSha256: String? = null,
    val estado: String,
    val fechaCreacion: String? = null,
    val tipoDocumento: String
) {
    fun toDomain() = Documento(
        id = id,
        nombreOriginal = nombreOriginal,
        contentType = contentType,
        sizeBytes = sizeBytes,
        hashSha256 = hashSha256,
        estado = EstadoDocumento.fromString(estado),
        fechaCreacion = fechaCreacion,
        tipoDocumento = TipoDocumento.fromString(tipoDocumento)
    )

    companion object {
        fun fromDomain(documento: Documento) = DocumentoCacheDto(
            id = documento.id,
            nombreOriginal = documento.nombreOriginal,
            contentType = documento.contentType,
            sizeBytes = documento.sizeBytes,
            hashSha256 = documento.hashSha256,
            estado = documento.estado.name,
            fechaCreacion = documento.fechaCreacion,
            tipoDocumento = documento.tipoDocumento.name
        )
    }
}
