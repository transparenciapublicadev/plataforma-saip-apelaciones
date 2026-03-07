package com.gestion.misaip.core.data.repository

import app.cash.sqldelight.coroutines.asFlow
import app.cash.sqldelight.coroutines.mapToList
import app.cash.sqldelight.coroutines.mapToOneOrNull
import com.gestion.misaip.core.data.mapper.EntidadPublicaMapper
import com.gestion.misaip.core.database.SaipDatabase
import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.core.domain.repository.EntidadPublicaRepository
import com.gestion.misaip.core.network.datasource.EntidadPublicaRemoteDataSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Implementación Offline-First del repositorio de Entidades Públicas.
 */
class EntidadPublicaRepositoryImpl(
    private val database: SaipDatabase,
    private val remoteDataSource: EntidadPublicaRemoteDataSource
) : EntidadPublicaRepository {

    private val queries = database.usuarioQueries // EntidadPublica queries are in Usuario.sq

    override fun getEntidadesActivas(): Flow<List<EntidadPublica>> {
        return queries.getAllEntidadesActivas()
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities -> entities.map { EntidadPublicaMapper.toDomain(it) } }
    }

    override fun getEntidadPorId(id: String): Flow<EntidadPublica?> {
        return queries.getEntidadById(id)
            .asFlow()
            .mapToOneOrNull(Dispatchers.IO)
            .map { entity -> entity?.let { EntidadPublicaMapper.toDomain(it) } }
    }

    override fun buscarEntidades(query: String): Flow<List<EntidadPublica>> {
        return queries.buscarEntidades(query, query)
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities -> entities.map { EntidadPublicaMapper.toDomain(it) } }
    }

    override fun getEntidadesPorSector(sector: String): Flow<List<EntidadPublica>> {
        return queries.getEntidadesBySector(sector)
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities -> entities.map { EntidadPublicaMapper.toDomain(it) } }
    }

    override suspend fun sincronizar() = withContext(Dispatchers.IO) {
        try {
            val entidadesRemotas = withTimeoutOrNull(8_000L) {
                remoteDataSource.getEntidadesActivas()
            }
            if (entidadesRemotas != null) {
                android.util.Log.d("MiSAIP", "Entidades remotas obtenidas: ${entidadesRemotas.size}")
                for (entidad in entidadesRemotas) {
                    val entity = EntidadPublicaMapper.toEntity(entidad)
                    queries.insertEntidad(
                        id = entity.id, nombre = entity.nombre, sector = entity.sector,
                        siglas = entity.siglas, ruc = entity.ruc, direccion = entity.direccion,
                        telefono = entity.telefono, email = entity.email,
                        sitioWeb = entity.sitioWeb, nivelGobierno = entity.nivelGobierno,
                        activa = entity.activa, sincronizado = true,
                        ultimaModificacion = System.currentTimeMillis()
                    )
                }
            } else {
                android.util.Log.w("MiSAIP", "Timeout sincronizando entidades — sin conexión o servidor lento")
            }
        } catch (e: Exception) {
            android.util.Log.e("MiSAIP", "Error sincronizando entidades: ${e.message}", e)
        }
        Unit
    }
}
