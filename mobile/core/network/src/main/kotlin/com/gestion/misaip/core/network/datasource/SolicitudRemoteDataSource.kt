package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Solicitud

/**
 * Interfaz para la fuente de datos remota de Solicitudes.
 *
 * Abstrae la comunicación con Firebase Firestore.
 * Esta interfaz permite cambiar la implementación de Firebase
 * sin afectar el resto de la aplicación (útil para testing y migración a KMP).
 */
interface SolicitudRemoteDataSource {

    /**
     * Crea una nueva solicitud en el servidor.
     *
     * @param solicitud Solicitud a crear
     * @throws NetworkException si hay error de red
     */
    suspend fun crearSolicitud(solicitud: Solicitud)

    /**
     * Actualiza una solicitud existente en el servidor.
     *
     * @param solicitud Solicitud con datos actualizados
     * @throws NetworkException si hay error de red
     */
    suspend fun actualizarSolicitud(solicitud: Solicitud)

    /**
     * Obtiene las solicitudes de un usuario desde el servidor.
     *
     * @param usuarioId ID del usuario
     * @return Lista de solicitudes
     */
    suspend fun getSolicitudesUsuario(usuarioId: String): List<Solicitud>

    /**
     * Obtiene una solicitud por su expediente.
     *
     * @param expediente Número de expediente
     * @return Solicitud o null
     */
    suspend fun getSolicitudPorExpediente(expediente: String): Solicitud?

    /**
     * Obtiene solicitudes modificadas después de una fecha.
     * Usado para sincronización incremental.
     *
     * @param desde Timestamp desde el cual buscar cambios
     * @return Lista de solicitudes modificadas
     */
    suspend fun getSolicitudesModificadasDesde(desde: Long): List<Solicitud>
}

/**
 * Excepción de red.
 */
class NetworkException(message: String, cause: Throwable? = null) : Exception(message, cause)

