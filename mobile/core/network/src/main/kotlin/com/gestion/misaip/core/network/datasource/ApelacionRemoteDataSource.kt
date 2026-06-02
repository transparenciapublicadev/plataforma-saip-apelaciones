package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.Calificacion
import com.gestion.misaip.core.domain.model.Pagina
import com.gestion.misaip.core.domain.model.ComunicarOmisionElevacion
import com.gestion.misaip.core.domain.model.ElevacionApelacion
import com.gestion.misaip.core.domain.model.RegistrarApelacionAnteEntidad
import com.gestion.misaip.core.domain.model.RegistrarApelacionExterna
import com.gestion.misaip.core.domain.model.RegistrarElevacionApelacion
import com.gestion.misaip.core.domain.model.Subsanacion

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

    suspend fun crearApelacion(apelacion: Apelacion): Apelacion

    suspend fun crearApelacionExterna(request: RegistrarApelacionExterna): Apelacion

    suspend fun crearApelacionAnteEntidad(request: RegistrarApelacionAnteEntidad): Apelacion

    suspend fun getElevacion(apelacionId: String): ElevacionApelacion

    suspend fun getPendientesElevacionEntidad(entidadId: String): List<ElevacionApelacion>

    suspend fun elevarApelacion(
        apelacionId: String,
        request: RegistrarElevacionApelacion
    ): Apelacion

    suspend fun comunicarOmisionElevacion(
        apelacionId: String,
        request: ComunicarOmisionElevacion
    ): ElevacionApelacion

    suspend fun calificarApelacion(
        expediente: String,
        tipo: String,
        calificacion: Calificacion
    ): Apelacion

    suspend fun presentarSubsanacion(
        expediente: String,
        subsanacion: Subsanacion
    ): Apelacion

    suspend fun actualizarApelacion(apelacion: Apelacion)

    suspend fun getApelacionesUsuario(usuarioId: String): List<Apelacion>

    suspend fun getTodasLasApelaciones(): List<Apelacion>

    suspend fun getApelacionPorExpediente(expediente: String): Apelacion?

    suspend fun getApelacionesModificadasDesde(desde: Long): List<Apelacion>
}
