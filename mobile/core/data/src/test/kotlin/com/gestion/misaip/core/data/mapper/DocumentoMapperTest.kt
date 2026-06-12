package com.gestion.misaip.core.data.mapper

import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.network.dto.rest.DocumentoMetadataRestDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class DocumentoMapperTest {

    @Test
    fun `metadata backend conserva campos seguros y relacion`() {
        val documento = DocumentoMapper.toDomain(metadata())

        assertEquals("7", documento.id)
        assertEquals("sustento.pdf", documento.nombreOriginal)
        assertEquals(TipoDocumento.DOCUMENTO_ADJUNTO, documento.tipoDocumento)
        assertEquals(DocumentoRelacion.Solicitud("42"), documento.relacion)
    }

    @Test
    fun `cache local conserva solo metadata liviana`() {
        val original = DocumentoMapper.toDomain(metadata())

        val serialized = DocumentoMapper.encodeMetadata(listOf(original))
        val restored = DocumentoMapper.decodeMetadata(serialized).single()

        assertEquals(original.copy(relacion = null), restored)
        assertFalse(serialized.contains("storageKey", ignoreCase = true))
        assertFalse(serialized.contains("bucket", ignoreCase = true))
        assertFalse(serialized.contains("endpoint", ignoreCase = true))
    }

    private fun metadata() = DocumentoMetadataRestDto(
        id = 7,
        tipoDocumento = "DOCUMENTO_ADJUNTO",
        nombreOriginal = "sustento.pdf",
        contentType = "application/pdf",
        sizeBytes = 4,
        hashSha256 = "a".repeat(64),
        estado = "ACTIVO",
        fechaCreacion = "2026-06-12T10:00:00Z",
        solicitudId = 42
    )
}
