package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.Pagina
import com.gestion.misaip.core.domain.model.AmpliacionPlazoSolicitud
import com.gestion.misaip.core.domain.model.EncauzamientoSolicitud
import com.gestion.misaip.core.domain.model.LiquidacionCostoSolicitud
import com.gestion.misaip.core.domain.model.ObservacionSolicitud
import com.gestion.misaip.core.domain.model.OperacionesSolicitudFuncionario
import com.gestion.misaip.core.domain.model.RegistrarAmpliacionPlazoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarEncauzamientoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarLiquidacionCostoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarObservacionSolicitud

/**
 * Interfaz para la fuente de datos remota de Solicitudes.
 *
 * Abstrae la comunicación de solicitudes con el backend REST.
 * Esta interfaz mantiene desacoplada la capa de datos para testing y migración a KMP.
 */
interface SolicitudRemoteDataSource {

    suspend fun getPaginaSolicitudes(
        pagina: Int,
        tamano: Int
    ): Pagina<Solicitud>

    suspend fun getPaginaSolicitudesUsuario(
        usuarioId: String,
        pagina: Int,
        tamano: Int
    ): Pagina<Solicitud>

    suspend fun getPaginaSolicitudesEntidad(
        entidadId: String,
        pagina: Int,
        tamano: Int
    ): Pagina<Solicitud>

    suspend fun getOperacionesFuncionario(solicitudId: String): OperacionesSolicitudFuncionario

    suspend fun registrarObservacion(
        solicitudId: String,
        request: RegistrarObservacionSolicitud
    ): ObservacionSolicitud

    suspend fun registrarAmpliacion(
        solicitudId: String,
        request: RegistrarAmpliacionPlazoSolicitud
    ): AmpliacionPlazoSolicitud

    suspend fun registrarEncauzamiento(
        solicitudId: String,
        request: RegistrarEncauzamientoSolicitud
    ): EncauzamientoSolicitud

    suspend fun emitirLiquidacion(
        solicitudId: String,
        request: RegistrarLiquidacionCostoSolicitud
    ): LiquidacionCostoSolicitud

    /**
     * Crea una nueva solicitud en el servidor.
     *
     * @param solicitud Solicitud a crear
     * @throws NetworkException si hay error de red
     */
    suspend fun crearSolicitud(solicitud: Solicitud): Solicitud

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

/**
 * Error HTTP rechazado por backend. No debe tratarse como creación offline pendiente.
 */
class ApiProblemException(
    message: String,
    val status: Int,
    cause: Throwable? = null
) : Exception(message, cause)
