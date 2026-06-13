package com.gestion.misaip.presentation.viewmodel

import android.net.Uri
import com.gestion.misaip.core.domain.model.ArchivoDocumento
import com.gestion.misaip.core.domain.model.Documento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.domain.repository.DocumentoRepository
import com.gestion.misaip.core.domain.usecase.documento.DownloadDocumentoUseCase
import com.gestion.misaip.core.domain.usecase.documento.ListDocumentosPorRelacionUseCase
import com.gestion.misaip.core.domain.usecase.documento.UploadDocumentoUseCase
import com.gestion.misaip.core.domain.usecase.documento.ValidarArchivoDocumentoUseCase
import com.gestion.misaip.data.DocumentoContentResolver
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import java.io.ByteArrayInputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DocumentoViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val repository = mockk<DocumentoRepository>()
    private val resolver = mockk<DocumentoContentResolver>()
    private lateinit var viewModel: DocumentoViewModel

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        coEvery { repository.listByRelation(any()) } returns emptyList()
        viewModel = DocumentoViewModel(
            uploadDocumentoUseCase = UploadDocumentoUseCase(
                repository,
                ValidarArchivoDocumentoUseCase()
            ),
            listDocumentosPorRelacionUseCase = ListDocumentosPorRelacionUseCase(repository),
            downloadDocumentoUseCase = DownloadDocumentoUseCase(repository),
            validarArchivoDocumentoUseCase = ValidarArchivoDocumentoUseCase(),
            contentResolver = resolver
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `seleccion y upload agregan metadata confirmada por backend`() = runTest(dispatcher) {
        val uri = mockk<Uri>()
        val file = ArchivoDocumento(
            nombre = "sustento.pdf",
            contentType = "application/pdf",
            sizeBytes = 4,
            abrirContenido = { ByteArrayInputStream(byteArrayOf(1, 2, 3, 4)) }
        )
        val relation = DocumentoRelacion.Solicitud("42")
        val uploaded = Documento(
            id = "7",
            nombreOriginal = "sustento.pdf",
            contentType = "application/pdf",
            sizeBytes = 4,
            relacion = relation
        )
        every { resolver.resolveUpload(uri) } returns file
        coEvery {
            repository.upload(file, TipoDocumento.DOCUMENTO_ADJUNTO, relation)
        } returns uploaded
        viewModel.configurar(relation, TipoDocumento.DOCUMENTO_ADJUNTO, emptyList(), true)

        viewModel.seleccionarArchivo(uri)
        assertEquals("sustento.pdf", viewModel.uiState.value.archivoSeleccionado?.nombre)

        viewModel.upload()
        advanceUntilIdle()

        assertEquals(listOf(uploaded), viewModel.uiState.value.documentos)
        assertNull(viewModel.uiState.value.archivoSeleccionado)
        assertFalse(viewModel.uiState.value.isUploading)
        coVerify(exactly = 1) {
            repository.upload(file, TipoDocumento.DOCUMENTO_ADJUNTO, relation)
        }
    }

    @Test
    fun `upload de respuesta fallido conserva seleccion para reintento`() = runTest(dispatcher) {
        val uri = mockk<Uri>()
        val file = ArchivoDocumento(
            nombre = "respuesta.pdf",
            contentType = "application/pdf",
            sizeBytes = 4,
            abrirContenido = { ByteArrayInputStream(byteArrayOf(1, 2, 3, 4)) }
        )
        every { resolver.resolveUpload(uri) } returns file
        coEvery {
            repository.upload(
                file,
                TipoDocumento.RESPUESTA_ENTIDAD,
                DocumentoRelacion.Respuesta("31")
            )
        } throws IllegalStateException("Sin conexión")

        viewModel.seleccionarArchivo(uri)
        viewModel.upload(
            relacionDestino = DocumentoRelacion.Respuesta("31"),
            tipoDocumentoDestino = TipoDocumento.RESPUESTA_ENTIDAD,
            failureMessage = "La respuesta fue registrada, pero el documento no pudo subirse."
        )
        advanceUntilIdle()

        assertEquals("respuesta.pdf", viewModel.uiState.value.archivoSeleccionado?.nombre)
        assertFalse(viewModel.uiState.value.isUploading)
    }

    @Test
    fun `cambiar de expediente no mezcla documentos anteriores`() {
        val old = Documento("1", "anterior.pdf", "application/pdf", 1)
        val current = Documento("2", "actual.pdf", "application/pdf", 1)

        viewModel.configurar(
            DocumentoRelacion.Solicitud("1"),
            TipoDocumento.DOCUMENTO_ADJUNTO,
            listOf(old),
            true
        )
        viewModel.configurar(
            DocumentoRelacion.Solicitud("2"),
            TipoDocumento.DOCUMENTO_ADJUNTO,
            listOf(current),
            true
        )

        assertEquals(listOf(current), viewModel.uiState.value.documentos)
    }
}
