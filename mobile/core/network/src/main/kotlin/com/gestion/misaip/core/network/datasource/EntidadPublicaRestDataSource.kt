package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.core.network.api.EntidadApiService

/**
 * Implementación REST del datasource de entidades públicas.
 * Usa el backend Spring Boot + JWT como fuente remota.
 */
class EntidadPublicaRestDataSource(
    private val entidadApi: EntidadApiService
) : EntidadPublicaRemoteDataSource {

    override suspend fun getEntidadesActivas(): List<EntidadPublica> {
        return entidadApi.getActivas().map { it.toDomain() }
    }

    override suspend fun getEntidadPorId(id: String): EntidadPublica? {
        return try {
            entidadApi.getById(id.toLong()).toDomain()
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun sincronizar(): List<EntidadPublica> {
        return getEntidadesActivas()
    }
}
