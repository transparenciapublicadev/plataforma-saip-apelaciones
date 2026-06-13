package com.gestion.misaip.core.data.repository

import com.gestion.misaip.core.domain.model.ArchivoDocumento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.network.datasource.DocumentoRemoteDataSource
import com.gestion.misaip.core.network.dto.rest.DocumentoMetadataRestDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.io.ByteArrayInputStream
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class DocumentoRepositoryImplTest {

    private val remote = mockk<DocumentoRemoteDataSource>()
    private val repository = DocumentoRepositoryImpl(remote)

    @Test
    fun `upload usa backend como fuente de verdad y mapea metadata`() = runTest {
        val file = ArchivoDocumento(
            nombre = "sustento.pdf",
            contentType = "application/pdf",
            sizeBytes = 4,
            abrirContenido = { ByteArrayInputStream(byteArrayOf(1, 2, 3, 4)) }
        )
        val relation = DocumentoRelacion.Apelacion("15")
        coEvery {
            remote.upload(file, TipoDocumento.RECURSO_APELACION, relation)
        } returns DocumentoMetadataRestDto(
            id = 9,
            tipoDocumento = "RECURSO_APELACION",
            nombreOriginal = "sustento.pdf",
            contentType = "application/pdf",
            sizeBytes = 4,
            estado = "ACTIVO",
            apelacionId = 15
        )

        val result = repository.upload(file, TipoDocumento.RECURSO_APELACION, relation)

        assertEquals("9", result.id)
        assertEquals(relation, result.relacion)
        coVerify(exactly = 1) {
            remote.upload(file, TipoDocumento.RECURSO_APELACION, relation)
        }
    }

    @Test
    fun `listado por relacion conserva metadata segura`() = runTest {
        val relation = DocumentoRelacion.Respuesta("31")
        coEvery { remote.listByRelation(relation) } returns listOf(
            DocumentoMetadataRestDto(
                id = 10,
                tipoDocumento = "RESPUESTA_ENTIDAD",
                nombreOriginal = "respuesta.pdf",
                contentType = "application/pdf",
                sizeBytes = 8,
                hashSha256 = "b".repeat(64),
                estado = "ACTIVO",
                respuestaId = 31
            )
        )

        val result = repository.listByRelation(relation)

        assertEquals("10", result.single().id)
        assertEquals(relation, result.single().relacion)
        assertEquals("b".repeat(64), result.single().hashSha256)
    }
}
