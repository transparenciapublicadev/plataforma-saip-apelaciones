package com.gestion.misaip.core.domain.usecase.documento

import com.gestion.misaip.core.domain.model.ArchivoDocumento
import com.gestion.misaip.core.domain.model.Documento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.domain.repository.DocumentoRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.io.ByteArrayInputStream
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class DocumentoUseCasesTest {

    private val repository = mockk<DocumentoRepository>()
    private val validator = ValidarArchivoDocumentoUseCase()

    @Test
    fun `validacion acepta los tipos documentales permitidos`() {
        listOf("application/pdf", "image/jpeg", "image/png", "text/plain").forEach { type ->
            validator(archivo(contentType = type))
        }
    }

    @Test
    fun `validacion rechaza archivo mayor a diez megabytes`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            validator(
                archivo(
                    sizeBytes = ValidarArchivoDocumentoUseCase.MAX_FILE_SIZE_BYTES + 1
                )
            )
        }

        assertEquals(
            "El archivo excede el tamaño máximo permitido de 10 MB.",
            exception.message
        )
    }

    @Test
    fun `validacion rechaza tipo no permitido`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            validator(archivo(contentType = "application/zip"))
        }

        assertEquals(
            "Tipo de archivo no permitido. Use PDF, JPEG, PNG o TXT.",
            exception.message
        )
    }

    @Test
    fun `upload valida y delega relacion al repositorio`() = runTest {
        val file = archivo()
        val relation = DocumentoRelacion.Solicitud("42")
        val expected = Documento(
            id = "7",
            nombreOriginal = "sustento.pdf",
            contentType = "application/pdf",
            sizeBytes = 4
        )
        coEvery {
            repository.upload(file, TipoDocumento.DOCUMENTO_ADJUNTO, relation)
        } returns expected

        val result = UploadDocumentoUseCase(repository, validator)(
            file,
            TipoDocumento.DOCUMENTO_ADJUNTO,
            relation
        )

        assertEquals(expected, result)
        coVerify(exactly = 1) {
            repository.upload(file, TipoDocumento.DOCUMENTO_ADJUNTO, relation)
        }
    }

    private fun archivo(
        contentType: String = "application/pdf",
        sizeBytes: Long = 4
    ) = ArchivoDocumento(
        nombre = "sustento.pdf",
        contentType = contentType,
        sizeBytes = sizeBytes,
        abrirContenido = { ByteArrayInputStream(byteArrayOf(1, 2, 3, 4)) }
    )
}
