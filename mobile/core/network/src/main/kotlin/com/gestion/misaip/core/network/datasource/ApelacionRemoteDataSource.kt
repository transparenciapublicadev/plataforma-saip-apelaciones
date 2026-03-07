package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Apelacion

/**
 * Interfaz para la fuente de datos remota de Apelaciones.
 * Abstrae la comunicación con Firebase Firestore.
 */
interface ApelacionRemoteDataSource {

    suspend fun crearApelacion(apelacion: Apelacion)

    suspend fun actualizarApelacion(apelacion: Apelacion)

    suspend fun getApelacionesUsuario(usuarioId: String): List<Apelacion>

    suspend fun getTodasLasApelaciones(): List<Apelacion>

    suspend fun getApelacionPorExpediente(expediente: String): Apelacion?

    suspend fun getApelacionesModificadasDesde(desde: Long): List<Apelacion>
}
