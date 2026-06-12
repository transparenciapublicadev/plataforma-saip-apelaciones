package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.ArchivoDocumento
import com.gestion.misaip.core.domain.model.DestinoDescargaDocumento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.network.api.DocumentoApiService
import com.gestion.misaip.core.network.dto.rest.DocumentoMetadataRestDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class DocumentoRestDataSourceTest {

    private val api = mockk<DocumentoApiService>()
    private val dataSource = DocumentoRestDataSource(
        api = api,
        json = Json { ignoreUnknownKeys = true }
    )

    @Test
    fun `upload multipart envia solo la relacion seleccionada`() = runTest {
        coEvery {
            api.upload(
                file = any(),
                tipoDocumento = "DOCUMENTO_ADJUNTO",
                solicitudId = 42,
                apelacionId = null,
                expedienteTtaipId = null,
                resolucionId = null,
                cedulaNotificacionId = null
            )
        } returns metadata()

        val result = dataSource.upload(
            archivo = archivo(),
            tipoDocumento = TipoDocumento.DOCUMENTO_ADJUNTO,
            relacion = DocumentoRelacion.Solicitud("42")
        )

        assertEquals(7L, result.id)
        coVerify(exactly = 1) {
            api.upload(any(), "DOCUMENTO_ADJUNTO", 42, null, null, null, null)
        }
    }

    @Test
    fun `download transmite contenido y conserva nombre de disposition`() = runTest {
        val bytes = byteArrayOf(1, 2, 3, 4)
        val output = ByteArrayOutputStream()
        coEvery { api.download(7) } returns Response.success(
            bytes.toResponseBody("application/pdf".toMediaType()),
            Headers.headersOf(
                "Content-Type",
                "application/pdf",
                "Content-Disposition",
                "attachment; filename*=UTF-8''informe%20final.pdf"
            )
        )

        val result = dataSource.download(
            documentoId = "7",
            destino = DestinoDescargaDocumento { output }
        )

        assertEquals("informe final.pdf", result.nombreOriginal)
        assertEquals("application/pdf", result.contentType)
        assertEquals(4L, result.sizeBytes)
        assertArrayEquals(bytes, output.toByteArray())
    }

    @Test
    fun `metadata propaga detail de problem details`() = runTest {
        val errorBody = """
            {"type":"about:blank","title":"Forbidden","status":403,
             "detail":"No tienes permiso para ver este documento."}
        """.trimIndent().toResponseBody("application/problem+json".toMediaType())
        coEvery { api.getMetadata(7) } throws HttpException(
            Response.error<DocumentoMetadataRestDto>(403, errorBody)
        )

        val error = runCatching { dataSource.getMetadata("7") }.exceptionOrNull()

        assertEquals(
            "No tienes permiso para ver este documento.",
            error?.message
        )
        assertEquals(403, (error as ApiProblemException).status)
    }

    private fun archivo() = ArchivoDocumento(
        nombre = "sustento.pdf",
        contentType = "application/pdf",
        sizeBytes = 4,
        abrirContenido = { ByteArrayInputStream(byteArrayOf(1, 2, 3, 4)) }
    )

    private fun metadata() = DocumentoMetadataRestDto(
        id = 7,
        tipoDocumento = "DOCUMENTO_ADJUNTO",
        nombreOriginal = "sustento.pdf",
        contentType = "application/pdf",
        sizeBytes = 4,
        estado = "ACTIVO",
        solicitudId = 42
    )
}
