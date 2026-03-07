package com.gestion.misaip.core.domain.repository

import com.gestion.misaip.core.domain.model.EntidadPublica
import kotlinx.coroutines.flow.Flow

/**
 * Interfaz del Repositorio de Entidades Públicas.
 *
 * Define el contrato para el acceso a datos de entidades públicas.
 *
 * IMPORTANTE: Esta interfaz está en el módulo de DOMINIO,
 * por lo tanto NO debe tener dependencias de Android ni Firebase.
 */
interface EntidadPublicaRepository {

    /**
     * Obtiene todas las entidades públicas activas.
     *
     * @return Flow de lista de entidades
     */
    fun getEntidadesActivas(): Flow<List<EntidadPublica>>

    /**
     * Obtiene una entidad por su ID.
     *
     * @param id ID de la entidad
     * @return Flow de la entidad o null
     */
    fun getEntidadPorId(id: String): Flow<EntidadPublica?>

    /**
     * Busca entidades por nombre o siglas.
     *
     * @param query Término de búsqueda
     * @return Flow de lista de entidades que coinciden
     */
    fun buscarEntidades(query: String): Flow<List<EntidadPublica>>

    /**
     * Obtiene entidades por sector.
     *
     * @param sector Nombre del sector
     * @return Flow de lista de entidades del sector
     */
    fun getEntidadesPorSector(sector: String): Flow<List<EntidadPublica>>

    /**
     * Sincroniza las entidades con el servidor remoto.
     */
    suspend fun sincronizar()
}

