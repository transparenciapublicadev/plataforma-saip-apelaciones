package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.ArchivoDocumento
import com.gestion.misaip.core.domain.model.DestinoDescargaDocumento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.ResultadoDescargaDocumento
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.network.api.DocumentoApiService
import com.gestion.misaip.core.network.dto.rest.DocumentoMetadataRestDto
import com.gestion.misaip.core.network.dto.rest.extraerMensajeProblemDetails
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okio.BufferedSink
import okio.source
import retrofit2.HttpException

interface DocumentoRemoteDataSource {

    suspend fun listByRelation(relacion: DocumentoRelacion): List<DocumentoMetadataRestDto>

    suspend fun upload(
        archivo: ArchivoDocumento,
        tipoDocumento: TipoDocumento,
        relacion: DocumentoRelacion
    ): DocumentoMetadataRestDto

    suspend fun getMetadata(documentoId: String): DocumentoMetadataRestDto

    suspend fun download(
        documentoId: String,
        destino: DestinoDescargaDocumento
    ): ResultadoDescargaDocumento

    suspend fun delete(documentoId: String)
}

class DocumentoRestDataSource(
    private val api: DocumentoApiService,
    private val json: Json
) : DocumentoRemoteDataSource {

    override suspend fun listByRelation(
        relacion: DocumentoRelacion
    ): List<DocumentoMetadataRestDto> = traducirProblemDetails {
        val query = relacion.toQuery()
        api.listByRelation(
            solicitudId = query.solicitudId,
            respuestaId = query.respuestaId,
            apelacionId = query.apelacionId,
            expedienteTtaipId = query.expedienteTtaipId,
            resolucionId = query.resolucionId,
            cedulaNotificacionId = query.cedulaNotificacionId
        )
    }

    override suspend fun upload(
        archivo: ArchivoDocumento,
        tipoDocumento: TipoDocumento,
        relacion: DocumentoRelacion
    ): DocumentoMetadataRestDto = traducirProblemDetails {
        val body = StreamingDocumentoRequestBody(archivo)
        val part = MultipartBody.Part.createFormData("file", archivo.nombre, body)
        val query = relacion.toQuery()

        api.upload(
            file = part,
            tipoDocumento = tipoDocumento.name,
            solicitudId = query.solicitudId,
            respuestaId = query.respuestaId,
            apelacionId = query.apelacionId,
            expedienteTtaipId = query.expedienteTtaipId,
            resolucionId = query.resolucionId,
            cedulaNotificacionId = query.cedulaNotificacionId
        )
    }

    override suspend fun getMetadata(documentoId: String): DocumentoMetadataRestDto {
        return traducirProblemDetails {
            api.getMetadata(documentoId.requireRemoteId())
        }
    }

    override suspend fun download(
        documentoId: String,
        destino: DestinoDescargaDocumento
    ): ResultadoDescargaDocumento {
        val response = api.download(documentoId.requireRemoteId())
        if (!response.isSuccessful) {
            throw problemException(
                status = response.code(),
                body = response.errorBody()?.string(),
                fallback = "No se pudo descargar el documento."
            )
        }

        val body = response.body()
            ?: throw ApiProblemException("No se pudo descargar el documento.", response.code())
        val bytesWritten = body.byteStream().use { input ->
            destino.abrirDestino().use { output ->
                input.copyTo(output)
            }
        }
        val contentType = response.headers()["Content-Type"]
            ?: body.contentType()?.toString()
            ?: "application/octet-stream"
        val nombre = parseFilename(response.headers()["Content-Disposition"])
            ?: "documento-$documentoId"

        return ResultadoDescargaDocumento(
            nombreOriginal = nombre,
            contentType = contentType,
            sizeBytes = bytesWritten
        )
    }

    override suspend fun delete(documentoId: String) {
        val response = api.delete(documentoId.requireRemoteId())
        if (!response.isSuccessful) {
            throw problemException(
                status = response.code(),
                body = response.errorBody()?.string(),
                fallback = "No se pudo eliminar el documento."
            )
        }
    }

    private suspend fun <T> traducirProblemDetails(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: HttpException) {
            throw problemException(
                status = error.code(),
                body = error.response()?.errorBody()?.string(),
                fallback = "No se pudo completar la operación con el documento."
            )
        }
    }

    private fun problemException(
        status: Int,
        body: String?,
        fallback: String
    ): ApiProblemException {
        val mensaje = json.extraerMensajeProblemDetails(body) ?: when (status) {
            401 -> "La sesión expiró."
            403 -> "No tienes permiso para ver este documento."
            404 -> "El documento ya no está disponible."
            413 -> "El archivo excede el tamaño máximo permitido."
            415 -> "Tipo de archivo no permitido."
            else -> "$fallback ($status)"
        }
        return ApiProblemException(mensaje, status)
    }

    private fun String.requireRemoteId(): Long {
        return toLongOrNull()?.takeIf { it > 0 }
            ?: throw NetworkException("El documento no tiene un ID remoto válido.")
    }

    private fun DocumentoRelacion.toQuery(): DocumentoRelacionQuery {
        val relationId = id.requireRemoteId()
        return when (this) {
            is DocumentoRelacion.Solicitud ->
                DocumentoRelacionQuery(solicitudId = relationId)
            is DocumentoRelacion.Respuesta ->
                DocumentoRelacionQuery(respuestaId = relationId)
            is DocumentoRelacion.Apelacion ->
                DocumentoRelacionQuery(apelacionId = relationId)
            is DocumentoRelacion.ExpedienteTtaip ->
                DocumentoRelacionQuery(expedienteTtaipId = relationId)
            is DocumentoRelacion.Resolucion ->
                DocumentoRelacionQuery(resolucionId = relationId)
            is DocumentoRelacion.CedulaNotificacion ->
                DocumentoRelacionQuery(cedulaNotificacionId = relationId)
        }
    }

    private fun parseFilename(contentDisposition: String?): String? {
        if (contentDisposition.isNullOrBlank()) return null
        val utf8Value = FILENAME_UTF8.find(contentDisposition)?.groupValues?.getOrNull(1)
        if (!utf8Value.isNullOrBlank()) {
            return URLDecoder.decode(utf8Value, StandardCharsets.UTF_8.name())
        }
        return FILENAME.find(contentDisposition)?.groupValues?.getOrNull(1)
    }

    private companion object {
        val FILENAME_UTF8 = Regex("""filename\*=UTF-8''([^;]+)""", RegexOption.IGNORE_CASE)
        val FILENAME = Regex("""filename="?([^";]+)"?""", RegexOption.IGNORE_CASE)
    }
}

private data class DocumentoRelacionQuery(
    val solicitudId: Long? = null,
    val respuestaId: Long? = null,
    val apelacionId: Long? = null,
    val expedienteTtaipId: Long? = null,
    val resolucionId: Long? = null,
    val cedulaNotificacionId: Long? = null
)

private class StreamingDocumentoRequestBody(
    private val archivo: ArchivoDocumento
) : RequestBody() {

    override fun contentType() = archivo.contentType.toMediaTypeOrNull()

    override fun contentLength() = archivo.sizeBytes

    override fun writeTo(sink: BufferedSink) {
        archivo.abrirContenido().use { input ->
            input.source().use { source ->
                sink.writeAll(source)
            }
        }
    }
}
