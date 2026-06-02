package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.Pagina

/**
 * Interfaz para la fuente de datos remota de Apelaciones.
 * Abstrae la comunicación de apelaciones con el backend REST.
 */
interface ApelacionRemoteDataSource {

    suspend fun getPaginaApelaciones(
        pagina: Int,
        tamano: Int
    ): Pagina<Apelacion>

    suspend fun getPaginaApelacionesUsuario(
        usuarioId: String,
        pagina: Int,
        tamano: Int
    ): Pagina<Apelacion>

    suspend fun crearApelacion(apelacion: Apelacion)

    suspend fun actualizarApelacion(apelacion: Apelacion)

    suspend fun getApelacionesUsuario(usuarioId: String): List<Apelacion>

    suspend fun getTodasLasApelaciones(): List<Apelacion>

    suspend fun getApelacionPorExpediente(expediente: String): Apelacion?

    suspend fun getApelacionesModificadasDesde(desde: Long): List<Apelacion>
}
