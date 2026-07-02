package com.gestion.misaip.core.domain.repository

import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.RespuestaEntidad
import com.gestion.misaip.core.domain.model.PlazoSeguimiento
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

    suspend fun cargarPaginaSolicitudes(
        pagina: Int = 0,
        tamano: Int = 20
    ): Pagina<Solicitud>

    suspend fun cargarPaginaSolicitudesUsuario(
        usuarioId: String,
        pagina: Int = 0,
        tamano: Int = 20
    ): Pagina<Solicitud>

    suspend fun cargarPaginaSolicitudesEntidad(
        entidadId: String,
        pagina: Int = 0,
        tamano: Int = 20
    ): Pagina<Solicitud>

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
     * Actualiza el detalle completo desde backend y conserva metadata documental liviana.
     */
    suspend fun refrescarDetalle(expediente: String): Solicitud?

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
     * Consulta trazabilidad SAIP reciente para el detalle funcionario.
     * Requiere conexión: no se fabrica estado administrativo local.
     */
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
     * Registra la respuesta de una entidad a una solicitud.
     *
     * @param expediente Número de expediente
     * @param respuesta Datos de la respuesta
     */
    suspend fun responderSolicitud(
        expediente: String,
        respuesta: RespuestaEntidad
    ): RespuestaEntidad

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

    suspend fun obtenerSeguimientoPlazo(id: Long): PlazoSeguimiento
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
