package com.gestion.misaip.core.domain.repository

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.Calificacion
import com.gestion.misaip.core.domain.model.Subsanacion
import com.gestion.misaip.core.domain.model.Pagina
import com.gestion.misaip.core.domain.model.ComunicarOmisionElevacion
import com.gestion.misaip.core.domain.model.ElevacionApelacion
import com.gestion.misaip.core.domain.model.RegistrarApelacionAnteEntidad
import com.gestion.misaip.core.domain.model.RegistrarApelacionExterna
import com.gestion.misaip.core.domain.model.RegistrarElevacionApelacion
import kotlinx.coroutines.flow.Flow

/**
 * Interfaz del Repositorio de Apelaciones TTAIP.
 *
 * Define el contrato para el acceso a datos de apelaciones.
 * La implementación debe seguir el patrón Offline-First.
 *
 * IMPORTANTE: Esta interfaz está en el módulo de DOMINIO,
 * por lo tanto NO debe tener dependencias de Android ni Firebase.
 */
interface ApelacionRepository {

    suspend fun cargarPaginaApelaciones(
        pagina: Int = 0,
        tamano: Int = 20
    ): Pagina<Apelacion>

    suspend fun cargarPaginaApelacionesUsuario(
        usuarioId: String,
        pagina: Int = 0,
        tamano: Int = 20
    ): Pagina<Apelacion>

    /**
     * Obtiene todas las apelaciones del usuario como un Flow reactivo.
     *
     * @param usuarioId ID del usuario
     * @return Flow de lista de apelaciones
     */
    fun getApelacionesUsuario(usuarioId: String): Flow<List<Apelacion>>

    /**
     * Obtiene todas las apelaciones (para funcionarios TTAIP).
     *
     * @return Flow de lista de todas las apelaciones
     */
    fun getTodasLasApelaciones(): Flow<List<Apelacion>>

    /**
     * Obtiene una apelación específica por su expediente.
     *
     * @param expediente Número de expediente TTAIP
     * @return Flow de la apelación o null
     */
    fun getApelacionPorExpediente(expediente: String): Flow<Apelacion?>

    /**
     * Actualiza el detalle completo desde backend y conserva metadata documental liviana.
     */
    suspend fun refrescarDetalle(expediente: String): Apelacion?

    /**
     * Obtiene la apelación relacionada con una solicitud SAIP.
     *
     * @param expedienteSAIP Número de expediente SAIP
     * @return Flow de la apelación o null
     */
    fun getApelacionPorSAIP(expedienteSAIP: String): Flow<Apelacion?>

    /**
     * Crea una nueva apelación.
     *
     * @param apelacion Datos de la nueva apelación
     * @return La apelación creada con su expediente asignado
     */
    suspend fun crearApelacion(apelacion: Apelacion): Apelacion

    /** Operaciones legales online-only: el backend asigna expediente y valida plazos. */
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

    /**
     * Actualiza una apelación existente.
     *
     * @param apelacion Apelación con datos actualizados
     */
    suspend fun actualizarApelacion(apelacion: Apelacion)

    /**
     * Registra una calificación (primera o segunda) de una apelación.
     *
     * @param expediente Número de expediente
     * @param tipo Tipo de calificación ("primera" o "segunda")
     * @param calificacion Datos de la calificación
     */
    suspend fun calificarApelacion(expediente: String, tipo: String, calificacion: Calificacion)

    /**
     * Presenta una subsanación para una apelación.
     *
     * @param expediente Número de expediente
     * @param subsanacion Datos de la subsanación
     * @param fileBytes Bytes del archivo adjunto
     * @param fileName Nombre del archivo adjunto
     * @param mimeType Tipo MIME del archivo
     */
    suspend fun presentarSubsanacion(
        expediente: String,
        subsanacion: Subsanacion,
        fileBytes: ByteArray? = null,
        fileName: String? = null,
        mimeType: String? = null
    )

    /**
     * Sincroniza las apelaciones con el servidor remoto.
     */
    suspend fun sincronizar()
}
