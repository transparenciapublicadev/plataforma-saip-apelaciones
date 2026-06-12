package com.gestion.misaip.core.domain.usecase.documento

import com.gestion.misaip.core.domain.model.ArchivoDocumento
import com.gestion.misaip.core.domain.model.DestinoDescargaDocumento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.domain.repository.DocumentoRepository

class ValidarArchivoDocumentoUseCase {

    operator fun invoke(archivo: ArchivoDocumento) {
        require(archivo.nombre.isNotBlank()) { "No se pudo identificar el nombre del archivo." }
        require(archivo.sizeBytes in 1..MAX_FILE_SIZE_BYTES) {
            "El archivo excede el tamaño máximo permitido de 10 MB."
        }
        require(archivo.contentType.lowercase() in ALLOWED_CONTENT_TYPES) {
            "Tipo de archivo no permitido. Use PDF, JPEG, PNG o TXT."
        }
    }

    companion object {
        const val MAX_FILE_SIZE_BYTES = 10L * 1024L * 1024L

        val ALLOWED_CONTENT_TYPES = setOf(
            "application/pdf",
            "image/jpeg",
            "image/png",
            "text/plain"
        )
    }
}

class UploadDocumentoUseCase(
    private val repository: DocumentoRepository,
    private val validarArchivo: ValidarArchivoDocumentoUseCase
) {
    suspend operator fun invoke(
        archivo: ArchivoDocumento,
        tipoDocumento: TipoDocumento,
        relacion: DocumentoRelacion
    ) = repository.upload(
        archivo = archivo.also(validarArchivo::invoke),
        tipoDocumento = tipoDocumento,
        relacion = relacion
    )
}

class GetDocumentoMetadataUseCase(
    private val repository: DocumentoRepository
) {
    suspend operator fun invoke(documentoId: String) = repository.getMetadata(documentoId)
}

class DownloadDocumentoUseCase(
    private val repository: DocumentoRepository
) {
    suspend operator fun invoke(
        documentoId: String,
        destino: DestinoDescargaDocumento
    ) = repository.download(documentoId, destino)
}

class DeleteDocumentoUseCase(
    private val repository: DocumentoRepository
) {
    suspend operator fun invoke(documentoId: String) = repository.delete(documentoId)
}

