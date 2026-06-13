package com.gestion.misaip.core.domain.repository

import com.gestion.misaip.core.domain.model.ArchivoDocumento
import com.gestion.misaip.core.domain.model.DestinoDescargaDocumento
import com.gestion.misaip.core.domain.model.Documento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.ResultadoDescargaDocumento
import com.gestion.misaip.core.domain.model.TipoDocumento

interface DocumentoRepository {

    suspend fun listByRelation(relacion: DocumentoRelacion): List<Documento>

    suspend fun upload(
        archivo: ArchivoDocumento,
        tipoDocumento: TipoDocumento,
        relacion: DocumentoRelacion
    ): Documento

    suspend fun getMetadata(documentoId: String): Documento

    suspend fun download(
        documentoId: String,
        destino: DestinoDescargaDocumento
    ): ResultadoDescargaDocumento

    suspend fun delete(documentoId: String)
}
