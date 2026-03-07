package com.gestion.misaip.core.domain.repository

import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.RespuestaEntidad
import kotlinx.coroutines.flow.Flow

/**
 * Interfaz del Repositorio de Solicitudes SAIP.
 *
 * Define el contrato para el acceso a datos de solicitudes.
 * La implementación debe seguir el patrón Offline-First:
 * - Flow proviene de la base de datos local (SSOT)
 * - Las operaciones de red actualizan la BD local
 *
 * IMPORTANTE: Esta interfaz está en el módulo de DOMINIO,
 * por lo tanto NO debe tener dependencias de Android ni Firebase.
 */
interface SolicitudRepository {

    /**
     * Obtiene todas las solicitudes del sistema (para administrador).
     *
     * @return Flow de lista de todas las solicitudes
     */
    fun getTodasLasSolicitudes(): Flow<List<Solicitud>>

    /**
     * Obtiene todas las solicitudes del usuario como un Flow reactivo.
     * El Flow proviene de la base de datos local (SSOT).
     *
     * @param usuarioId ID del usuario
     * @return Flow de lista de solicitudes
     */
    fun getSolicitudesUsuario(usuarioId: String): Flow<List<Solicitud>>

    /**
     * Obtiene las solicitudes de una entidad específica.
     *
     * @param entidadId ID de la entidad
     * @return Flow de lista de solicitudes
     */
    fun getSolicitudesEntidad(entidadId: String): Flow<List<Solicitud>>

    /**
     * Obtiene una solicitud específica por su expediente.
     *
     * @param expediente Número de expediente
     * @return Flow de la solicitud o null
     */
    fun getSolicitudPorExpediente(expediente: String): Flow<Solicitud?>

    /**
     * Crea una nueva solicitud.
     * Guarda localmente y programa sincronización con el servidor.
     *
     * @param solicitud Datos de la nueva solicitud
     * @return La solicitud creada con su expediente asignado
     */
    suspend fun crearSolicitud(solicitud: Solicitud): Solicitud

    /**
     * Actualiza una solicitud existente.
     *
     * @param solicitud Solicitud con datos actualizados
     */
    suspend fun actualizarSolicitud(solicitud: Solicitud)

    /**
     * Registra la respuesta de una entidad a una solicitud.
     *
     * @param expediente Número de expediente
     * @param respuesta Datos de la respuesta
     */
    suspend fun responderSolicitud(expediente: String, respuesta: RespuestaEntidad)

    /**
     * Sincroniza las solicitudes con el servidor remoto.
     * Usado por WorkManager para sincronización en segundo plano.
     */
    suspend fun sincronizar()

    /**
     * Obtiene estadísticas de solicitudes del usuario.
     *
     * @param usuarioId ID del usuario
     * @return Estadísticas de solicitudes
     */
    fun getEstadisticas(usuarioId: String): Flow<SolicitudEstadisticas>
}

/**
 * Estadísticas de solicitudes de un usuario.
 */
data class SolicitudEstadisticas(
    val total: Int,
    val enProceso: Int,
    val respondidas: Int,
    val denegadas: Int,
    val vencidas: Int
)

