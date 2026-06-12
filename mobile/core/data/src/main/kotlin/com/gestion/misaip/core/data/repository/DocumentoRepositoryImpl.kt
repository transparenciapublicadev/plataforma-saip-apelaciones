package com.gestion.misaip.core.data.repository

import com.gestion.misaip.core.data.mapper.DocumentoMapper
import com.gestion.misaip.core.domain.model.ArchivoDocumento
import com.gestion.misaip.core.domain.model.DestinoDescargaDocumento
import com.gestion.misaip.core.domain.model.Documento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.ResultadoDescargaDocumento
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.domain.repository.DocumentoRepository
import com.gestion.misaip.core.network.datasource.DocumentoRemoteDataSource

class DocumentoRepositoryImpl(
    private val remoteDataSource: DocumentoRemoteDataSource
) : DocumentoRepository {

    override suspend fun upload(
        archivo: ArchivoDocumento,
        tipoDocumento: TipoDocumento,
        relacion: DocumentoRelacion
    ): Documento {
        return DocumentoMapper.toDomain(
            remoteDataSource.upload(archivo, tipoDocumento, relacion)
        )
    }

    override suspend fun getMetadata(documentoId: String): Documento {
        return DocumentoMapper.toDomain(remoteDataSource.getMetadata(documentoId))
    }

    override suspend fun download(
        documentoId: String,
        destino: DestinoDescargaDocumento
    ): ResultadoDescargaDocumento {
        return remoteDataSource.download(documentoId, destino)
    }

    override suspend fun delete(documentoId: String) {
        remoteDataSource.delete(documentoId)
    }
}

