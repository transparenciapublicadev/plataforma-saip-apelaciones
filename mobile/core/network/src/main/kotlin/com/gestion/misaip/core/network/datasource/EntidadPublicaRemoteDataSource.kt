package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.EntidadPublica

/**
 * Interfaz para la fuente de datos remota de Entidades Públicas.
 */
interface EntidadPublicaRemoteDataSource {

    suspend fun getEntidadesActivas(): List<EntidadPublica>

    suspend fun getEntidadPorId(id: String): EntidadPublica?

    suspend fun sincronizar(): List<EntidadPublica>
}
