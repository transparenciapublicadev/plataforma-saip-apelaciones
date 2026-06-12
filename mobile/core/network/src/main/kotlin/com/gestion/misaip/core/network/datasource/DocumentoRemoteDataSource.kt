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

    override suspend fun upload(
        archivo: ArchivoDocumento,
        tipoDocumento: TipoDocumento,
        relacion: DocumentoRelacion
    ): DocumentoMetadataRestDto = traducirProblemDetails {
        val body = StreamingDocumentoRequestBody(archivo)
        val part = MultipartBody.Part.createFormData("file", archivo.nombre, body)
        val relationId = relacion.id.requireRemoteId()

        api.upload(
            file = part,
            tipoDocumento = tipoDocumento.name,
            solicitudId = relationId.takeIf { relacion is DocumentoRelacion.Solicitud },
            apelacionId = relationId.takeIf { relacion is DocumentoRelacion.Apelacion },
            expedienteTtaipId = relationId.takeIf { relacion is DocumentoRelacion.ExpedienteTtaip },
            resolucionId = relationId.takeIf { relacion is DocumentoRelacion.Resolucion },
            cedulaNotificacionId = relationId.takeIf {
                relacion is DocumentoRelacion.CedulaNotificacion
            }
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
        return toLongOrNull() ?: throw NetworkException("El documento no tiene un ID remoto válido.")
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
