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
        val ids = listOf(
            solicitudId,
            respuestaId,
            apelacionId,
            expedienteTtaipId,
            resolucionId,
            cedulaNotificacionId
        )
        if (ids.all { it == null }) return null
        return DocumentoRelacion.fromIds(
            solicitudId = solicitudId?.toString(),
            respuestaId = respuestaId?.toString(),
            apelacionId = apelacionId?.toString(),
            expedienteTtaipId = expedienteTtaipId?.toString(),
            resolucionId = resolucionId?.toString(),
            cedulaNotificacionId = cedulaNotificacionId?.toString()
        )
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
    val tipoDocumento: String,
    val relacionTipo: String? = null,
    val relacionId: String? = null
) {
    fun toDomain() = Documento(
        id = id,
        nombreOriginal = nombreOriginal,
        contentType = contentType,
        sizeBytes = sizeBytes,
        hashSha256 = hashSha256,
        estado = EstadoDocumento.fromString(estado),
        fechaCreacion = fechaCreacion,
        tipoDocumento = TipoDocumento.fromString(tipoDocumento),
        relacion = toRelacion()
    )

    private fun toRelacion(): DocumentoRelacion? {
        val relationId = relacionId?.takeIf(String::isNotBlank) ?: return null
        return when (relacionTipo) {
            "SOLICITUD" -> DocumentoRelacion.Solicitud(relationId)
            "RESPUESTA" -> DocumentoRelacion.Respuesta(relationId)
            "APELACION" -> DocumentoRelacion.Apelacion(relationId)
            "EXPEDIENTE_TTAIP" -> DocumentoRelacion.ExpedienteTtaip(relationId)
            "RESOLUCION" -> DocumentoRelacion.Resolucion(relationId)
            "CEDULA_NOTIFICACION" -> DocumentoRelacion.CedulaNotificacion(relationId)
            else -> null
        }
    }

    companion object {
        fun fromDomain(documento: Documento) = DocumentoCacheDto(
            id = documento.id,
            nombreOriginal = documento.nombreOriginal,
            contentType = documento.contentType,
            sizeBytes = documento.sizeBytes,
            hashSha256 = documento.hashSha256,
            estado = documento.estado.name,
            fechaCreacion = documento.fechaCreacion,
            tipoDocumento = documento.tipoDocumento.name,
            relacionTipo = documento.relacion?.cacheType(),
            relacionId = documento.relacion?.id
        )

        private fun DocumentoRelacion.cacheType(): String = when (this) {
            is DocumentoRelacion.Solicitud -> "SOLICITUD"
            is DocumentoRelacion.Respuesta -> "RESPUESTA"
            is DocumentoRelacion.Apelacion -> "APELACION"
            is DocumentoRelacion.ExpedienteTtaip -> "EXPEDIENTE_TTAIP"
            is DocumentoRelacion.Resolucion -> "RESOLUCION"
            is DocumentoRelacion.CedulaNotificacion -> "CEDULA_NOTIFICACION"
        }
    }
}
