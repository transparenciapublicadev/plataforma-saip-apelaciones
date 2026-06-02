package com.gestion.misaip.core.data.repository

import app.cash.sqldelight.coroutines.asFlow
import app.cash.sqldelight.coroutines.mapToList
import app.cash.sqldelight.coroutines.mapToOneOrNull
import com.gestion.misaip.core.common.util.DateUtils
import com.gestion.misaip.core.data.mapper.SolicitudMapper
import com.gestion.misaip.core.data.mapper.TimelineDto
import com.gestion.misaip.core.database.SaipDatabase
import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.SolicitudEstadisticas
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import com.gestion.misaip.core.network.datasource.SolicitudRemoteDataSource
import com.gestion.misaip.core.network.datasource.ApiProblemException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import java.util.Date
import java.util.UUID
import java.io.IOException

/**
 * Implementación del Repositorio de Solicitudes SAIP.
 *
 * Sigue el patrón OFFLINE-FIRST:
 * - La base de datos local (SQLDelight) es la Single Source of Truth (SSOT)
 * - Los Flows provienen de la BD local
 * - Las operaciones de red actualizan la BD local
 * - WorkManager maneja la sincronización diferida
 *
 * @param database Base de datos SQLDelight
 * @param remoteDataSource Fuente de datos remota (backend REST)
 */
class SolicitudRepositoryImpl(
    private val database: SaipDatabase,
    private val remoteDataSource: SolicitudRemoteDataSource
) : SolicitudRepository {

    private val queries = database.solicitudQueries
    private val contadorQueries = database.apelacionQueries // Contadores están aquí

    override suspend fun cargarPaginaSolicitudes(
        pagina: Int,
        tamano: Int
    ): Pagina<Solicitud> = cargarPagina(
        pagina = pagina,
        tamano = tamano,
        remote = { remoteDataSource.getPaginaSolicitudes(pagina, tamano) },
        local = {
            queries.getAllSolicitudesPaginadas(tamano.toLong(), offset(pagina, tamano))
                .executeAsList()
                .map(SolicitudMapper::toDomain) to queries.countAllSolicitudes().executeAsOne()
        }
    )

    override suspend fun cargarPaginaSolicitudesUsuario(
        usuarioId: String,
        pagina: Int,
        tamano: Int
    ): Pagina<Solicitud> = cargarPagina(
        pagina = pagina,
        tamano = tamano,
        remote = { remoteDataSource.getPaginaSolicitudesUsuario(usuarioId, pagina, tamano) },
        local = {
            queries.getSolicitudesByUsuarioPaginadas(
                usuarioId,
                tamano.toLong(),
                offset(pagina, tamano)
            ).executeAsList().map(SolicitudMapper::toDomain) to
                queries.countSolicitudesByUsuario(usuarioId).executeAsOne()
        }
    )

    override suspend fun cargarPaginaSolicitudesEntidad(
        entidadId: String,
        pagina: Int,
        tamano: Int
    ): Pagina<Solicitud> = cargarPagina(
        pagina = pagina,
        tamano = tamano,
        remote = { remoteDataSource.getPaginaSolicitudesEntidad(entidadId, pagina, tamano) },
        local = {
            queries.getSolicitudesByEntidadPaginadas(
                entidadId,
                tamano.toLong(),
                offset(pagina, tamano)
            ).executeAsList().map(SolicitudMapper::toDomain) to
                queries.countSolicitudesByEntidad(entidadId).executeAsOne()
        }
    )

    /**
     * Obtiene todas las solicitudes del sistema (para administrador).
     */
    override fun getTodasLasSolicitudes(): Flow<List<Solicitud>> {
        return queries.getAllSolicitudes()
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities -> entities.map { SolicitudMapper.toDomain(it) } }
    }

    /**
     * Obtiene las solicitudes del usuario desde la BD local.
     * El Flow se actualiza automáticamente cuando cambian los datos.
     */
    override fun getSolicitudesUsuario(usuarioId: String): Flow<List<Solicitud>> {
        return queries.getSolicitudesByUsuario(usuarioId)
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities -> entities.map { SolicitudMapper.toDomain(it) } }
    }

    /**
     * Obtiene las solicitudes de una entidad desde la BD local.
     */
    override fun getSolicitudesEntidad(entidadId: String): Flow<List<Solicitud>> {
        return queries.getSolicitudesByEntidad(entidadId)
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities -> entities.map { SolicitudMapper.toDomain(it) } }
    }

    /**
     * Obtiene una solicitud específica por expediente.
     */
    override fun getSolicitudPorExpediente(expediente: String): Flow<Solicitud?> {
        return queries.getSolicitudByExpediente(expediente)
            .asFlow()
            .mapToOneOrNull(Dispatchers.IO)
            .map { entity -> entity?.let { SolicitudMapper.toDomain(it) } }
    }

    /**
     * Crea una nueva solicitud.
     *
     * 1. Genera el expediente localmente
     * 2. Guarda en BD local (pendiente de sincronización)
     * 3. Intenta subir al backend REST (si hay conexión)
     * 4. Si falla, WorkManager lo sincronizará después
     */
    override suspend fun crearSolicitud(solicitud: Solicitud): Solicitud = withContext(Dispatchers.IO) {
        // Generar ID único y número de expediente
        val id = UUID.randomUUID().toString()
        val year = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)

        // Recalcular contador basado en expedientes existentes para evitar duplicados
        // (necesario tras reinstalación o si la sincronización actualizó la BD)
        try {
            val maxResult = contadorQueries.getMaxExpedienteSAIP().executeAsOneOrNull()
            val maxNum = maxResult?.MAX ?: 0L
            if (maxNum > 0) {
                contadorQueries.setContadorSiMayor(maxNum + 1, System.currentTimeMillis(), "SAIP")
                android.util.Log.d("MiSAIP", "Contador SAIP recalculado antes de crear: ${maxNum + 1}")
            }
        } catch (e: Exception) {
            android.util.Log.e("MiSAIP", "Error recalculando contador SAIP: ${e.message}", e)
        }

        // Generar expediente único con reintentos (máx 10) para evitar sobreescritura
        var expediente: String
        var intentos = 0
        do {
            val contador = contadorQueries.getContador("SAIP").executeAsOne()
            contadorQueries.incrementarContador(System.currentTimeMillis(), "SAIP")
            expediente = "SAIP-$year-${String.format("%05d", contador)}"
            val existente = queries.getSolicitudByExpediente(expediente).executeAsOneOrNull()
            intentos++
            if (existente != null) {
                android.util.Log.w("MiSAIP", "Expediente SAIP $expediente ya existe, reintentando (intento $intentos)")
            }
        } while (queries.getSolicitudByExpediente(expediente).executeAsOneOrNull() != null && intentos < 10)

        if (intentos >= 10) {
            android.util.Log.e("MiSAIP", "No se pudo generar expediente SAIP único tras $intentos intentos")
        }
        android.util.Log.d("MiSAIP", "Expediente SAIP generado: $expediente (intento $intentos)")

        // Calcular fecha límite (10 días hábiles)
        val fechaCreacion = Date()
        val fechaLimite = DateUtils.agregarDiasHabiles(fechaCreacion, 10)

        // Crear solicitud completa
        val solicitudCompleta = solicitud.copy(
            id = id,
            expediente = expediente,
            fechaCreacion = fechaCreacion.time,
            fechaLimite = fechaLimite.time,
            diasRestantes = 10,
            timeline = listOf(
                TimelineItem(
                    fecha = fechaCreacion.time,
                    evento = "Solicitud recepcionada",
                    tipo = "recepcion",
                    completado = true
                )
            )
        )

        // Guardar en BD local
        guardarSolicitudLocal(solicitudCompleta, sincronizado = false, pendienteSubida = true)

        // Registrar en log de sincronización
        contadorQueries.insertSyncLog(
            tabla = "Solicitud",
            registroId = id,
            operacion = "INSERT",
            timestamp = System.currentTimeMillis()
        )

        // Intentar sincronizar inmediatamente. Los rechazos HTTP no son fallos offline:
        // se propagan para que la UI muestre Problem Details y no confirme una SAIP inválida.
        try {
            val solicitudRemota = remoteDataSource.crearSolicitud(solicitudCompleta)
                .completarDatosLocalesDesde(solicitudCompleta)
            queries.transaction {
                queries.deleteSolicitudById(id)
                guardarSolicitudLocal(solicitudRemota, sincronizado = true, pendienteSubida = false)
            }
            android.util.Log.d("MiSAIP", "Solicitud sincronizada con backend REST")
            return@withContext solicitudRemota
        } catch (e: IOException) {
            android.util.Log.w("MiSAIP", "Backend no disponible; SAIP pendiente de sincronización")
        } catch (e: ApiProblemException) {
            queries.deleteSolicitudById(id)
            throw e
        } catch (e: Exception) {
            queries.deleteSolicitudById(id)
            throw e
        }

        solicitudCompleta
    }

    /**
     * Actualiza una solicitud existente.
     */
    override suspend fun actualizarSolicitud(solicitud: Solicitud) = withContext(Dispatchers.IO) {
        guardarSolicitudLocal(solicitud, sincronizado = false, pendienteSubida = true)
        Unit
    }

    /**
     * Registra la respuesta de una entidad.
     */
    override suspend fun responderSolicitud(
        expediente: String,
        respuesta: RespuestaEntidad
    ) = withContext(Dispatchers.IO) {
        require(respuesta.tipo != TipoRespuesta.SILENCIO_ADMINISTRATIVO) {
            "Silencio administrativo se aplica automáticamente y no se registra como respuesta manual"
        }

        val nuevoEstado = when (respuesta.tipo) {
            TipoRespuesta.DENEGACION_TOTAL -> "Denegada"
            else -> "Respondida"
        }

        // Obtener la solicitud actual para actualizar el timeline
        val solicitudActual = queries.getSolicitudByExpediente(expediente).executeAsOneOrNull()
        val timelineActual = solicitudActual?.timeline ?: "[]"

        // Agregar nuevo evento al timeline
        val eventoNombre = when (respuesta.tipo) {
            TipoRespuesta.DENEGACION_TOTAL -> "Solicitud DENEGADA por ${respuesta.funcionario}"
            TipoRespuesta.ENTREGA_TOTAL -> "Solicitud RESPONDIDA — entrega total por ${respuesta.funcionario}"
            TipoRespuesta.ENTREGA_PARCIAL -> "Solicitud RESPONDIDA — entrega parcial por ${respuesta.funcionario}"
            TipoRespuesta.SILENCIO_ADMINISTRATIVO -> error("Tipo de respuesta no permitido: SILENCIO_ADMINISTRATIVO")
        }
        val timelineItems: MutableList<TimelineDto> = try {
            Json.decodeFromString(timelineActual)
        } catch (_: Exception) { mutableListOf() }
        timelineItems.add(
            TimelineDto(
                fecha = respuesta.fechaRespuesta,
                evento = eventoNombre,
                tipo = when (respuesta.tipo) {
                    TipoRespuesta.DENEGACION_TOTAL -> "denegacion"
                    else -> "respuesta"
                },
                completado = true,
                detalle = respuesta.fundamentacion
            )
        )
        val timelineActualizado = Json.encodeToString(timelineItems)

        queries.updateRespuestaSolicitud(
            estado = nuevoEstado,
            respuestaFecha = respuesta.fechaRespuesta,
            respuestaFuncionario = respuesta.funcionario,
            respuestaTipo = respuesta.tipo.name,
            respuestaFundamentacion = respuesta.fundamentacion,
            respuestaArchivos = Json.encodeToString(
                ListSerializer(String.serializer()),
                respuesta.archivos
            ),
            timeline = timelineActualizado,
            ultimaModificacion = System.currentTimeMillis(),
            expediente = expediente
        )
        Unit
    }

    /**
     * Sincroniza las solicitudes con el backend REST.
     * 1. Sube solicitudes pendientes locales (push)
     * 2. Descarga cambios desde el backend a la BD local (pull)
     */
    override suspend fun sincronizar() = withContext(Dispatchers.IO) {
        // 1. Push: Subir solicitudes pendientes (con timeout por ítem para no bloquear offline)
        val pendientes = queries.getSolicitudesPendientesSincronizacion().executeAsList()

        for (entity in pendientes) {
            try {
                val subido = withTimeoutOrNull(5_000L) {
                    val solicitud = SolicitudMapper.toDomain(entity)
                    if (entity.id.toLongOrNull() == null) {
                        val solicitudRemota = remoteDataSource.crearSolicitud(solicitud)
                            .completarDatosLocalesDesde(solicitud)
                        queries.transaction {
                            queries.deleteSolicitudById(entity.id)
                            guardarSolicitudLocal(solicitudRemota, sincronizado = true, pendienteSubida = false)
                        }
                    } else {
                        remoteDataSource.actualizarSolicitud(solicitud)
                    }
                    true
                }
                if (subido == true && entity.id.toLongOrNull() != null) {
                    queries.marcarSolicitudSincronizada(entity.id)
                }
            } catch (e: Exception) {
                // Se reintentará después con WorkManager
                android.util.Log.w("MiSAIP", "Error push solicitud ${entity.id}: ${e.message}")
            }
        }

        // 2. Pull: Descargar actualizaciones desde backend REST (con timeout global)
        try {
            val ultimaSync = queries.getAllSolicitudes().executeAsList()
                .filter { it.sincronizado }
                .maxOfOrNull { it.ultimaModificacion } ?: 0L

            val remotas = withTimeoutOrNull(8_000L) {
                remoteDataSource.getSolicitudesModificadasDesde(ultimaSync)
            }
            if (remotas != null) {
                android.util.Log.d("MiSAIP", "Solicitudes remotas obtenidas: ${remotas.size}")
                for (solicitud in remotas) {
                    guardarSolicitudLocal(solicitud, sincronizado = true, pendienteSubida = false)
                }
            } else {
                android.util.Log.w("MiSAIP", "Timeout sincronizando solicitudes (pull) — sin conexión o servidor lento")
            }
        } catch (e: Exception) {
            android.util.Log.e("MiSAIP", "Error sincronizando solicitudes: ${e.message}", e)
        }

        // 3. Recalcular contador SAIP basado en el máximo expediente local
        try {
            val maxResult = contadorQueries.getMaxExpedienteSAIP().executeAsOneOrNull()
            val maxNum = maxResult?.MAX ?: 0L
            if (maxNum > 0) {
                // El contador debe ser maxNum + 1 para el próximo expediente
                contadorQueries.setContadorSiMayor(maxNum + 1, System.currentTimeMillis(), "SAIP")
                android.util.Log.d("MiSAIP", "Contador SAIP actualizado al máximo local: ${maxNum + 1}")
            }
        } catch (e: Exception) {
            android.util.Log.e("MiSAIP", "Error actualizando contador SAIP: ${e.message}", e)
        }
        Unit
    }

    private fun guardarSolicitudLocal(
        solicitud: Solicitud,
        sincronizado: Boolean,
        pendienteSubida: Boolean
    ) {
        val entity = SolicitudMapper.toEntity(solicitud, pendienteSubida)
        queries.insertSolicitud(
            id = entity.id,
            expediente = entity.expediente,
            tipo = entity.tipo,
            entidad = entity.entidad,
            entidadId = entity.entidadId,
            usuarioId = entity.usuarioId,
            solicitanteNombre = entity.solicitanteNombre,
            solicitanteDni = entity.solicitanteDni,
            solicitanteEmail = entity.solicitanteEmail,
            solicitanteTelefono = entity.solicitanteTelefono,
            solicitanteDireccion = entity.solicitanteDireccion,
            asunto = entity.asunto,
            descripcion = entity.descripcion,
            consentimientoDatosPersonales = entity.consentimientoDatosPersonales,
            canalNotificacion = entity.canalNotificacion,
            fechaCreacion = entity.fechaCreacion,
            fechaLimite = entity.fechaLimite,
            estado = entity.estado,
            diasRestantes = entity.diasRestantes,
            prioridad = entity.prioridad,
            silencioAdministrativo = entity.silencioAdministrativo,
            respuestaFecha = entity.respuestaFecha,
            respuestaFuncionario = entity.respuestaFuncionario,
            respuestaTipo = entity.respuestaTipo,
            respuestaFundamentacion = entity.respuestaFundamentacion,
            respuestaArchivos = entity.respuestaArchivos,
            timeline = entity.timeline,
            sincronizado = sincronizado,
            pendienteSubida = pendienteSubida,
            ultimaModificacion = System.currentTimeMillis()
        )
    }

    private suspend fun cargarPagina(
        pagina: Int,
        tamano: Int,
        remote: suspend () -> Pagina<Solicitud>,
        local: suspend () -> Pair<List<Solicitud>, Long>
    ): Pagina<Solicitud> = withContext(Dispatchers.IO) {
        withOfflinePageFallback(
            remote = {
                val remota = remote()
                val actualizadas = remota.contenido.map { resumen ->
                    val cached = queries.getSolicitudById(resumen.id).executeAsOneOrNull()
                        ?: queries.getSolicitudByExpediente(resumen.expediente).executeAsOneOrNull()
                    val merged = resumen.completarResumenDesde(
                        cached?.let(SolicitudMapper::toDomain)
                    )
                    guardarSolicitudLocal(merged, sincronizado = true, pendienteSubida = false)
                    merged
                }
                remota.copy(contenido = actualizadas)
            },
            local = {
                val (items, total) = local()
                paginaLocal(items, pagina, tamano, total)
            }
        )
    }

    private fun Solicitud.completarDatosLocalesDesde(local: Solicitud): Solicitud {
        return copy(
            solicitante = solicitante.copy(
                email = solicitante.email.ifBlank { local.solicitante.email },
                telefono = solicitante.telefono.ifBlank { local.solicitante.telefono },
                direccion = solicitante.direccion.ifBlank { local.solicitante.direccion }
            ),
            consentimientoDatosPersonales = consentimientoDatosPersonales || local.consentimientoDatosPersonales,
            canalNotificacion = canalNotificacion ?: local.canalNotificacion,
            timeline = timeline.ifEmpty { local.timeline }
        )
    }

    private fun Solicitud.completarResumenDesde(local: Solicitud?): Solicitud {
        if (local == null) return this
        return local.copy(
            id = id.ifBlank { local.id },
            expediente = expediente.ifBlank { local.expediente },
            entidad = entidad.ifBlank { local.entidad },
            entidadId = entidadId.ifBlank { local.entidadId },
            usuarioId = usuarioId.ifBlank { local.usuarioId },
            solicitante = local.solicitante.copy(
                nombre = solicitante.nombre.ifBlank { local.solicitante.nombre }
            ),
            asunto = asunto.ifBlank { local.asunto },
            canalNotificacion = canalNotificacion ?: local.canalNotificacion,
            fechaCreacion = fechaCreacion.takeIf { it > 0 } ?: local.fechaCreacion,
            fechaLimite = fechaLimite.takeIf { it > 0 } ?: local.fechaLimite,
            estado = estado,
            diasRestantes = diasRestantes ?: local.diasRestantes,
            prioridad = prioridad
        )
    }

    private fun paginaLocal(
        contenido: List<Solicitud>,
        pagina: Int,
        tamano: Int,
        total: Long
    ): Pagina<Solicitud> {
        val totalPaginas = calcularTotalPaginas(total, tamano)
        return Pagina(
            contenido = contenido,
            pagina = pagina,
            tamano = tamano,
            totalElementos = total,
            totalPaginas = totalPaginas,
            ultima = pagina + 1 >= totalPaginas,
            desdeCache = true
        )
    }

    private fun offset(pagina: Int, tamano: Int): Long = pagina.toLong() * tamano

    private fun calcularTotalPaginas(total: Long, tamano: Int): Int {
        if (total == 0L) return 0
        return ((total + tamano - 1) / tamano).toInt()
    }

    /**
     * Obtiene estadísticas de solicitudes del usuario.
     */
    override fun getEstadisticas(usuarioId: String): Flow<SolicitudEstadisticas> {
        return queries.getEstadisticasUsuario(usuarioId)
            .asFlow()
            .mapToOneOrNull(Dispatchers.IO)
            .map { stats ->
                stats?.let {
                    SolicitudEstadisticas(
                        total = it.total.toInt(),
                        enProceso = it.enProceso?.toInt() ?: 0,
                        respondidas = it.respondidas?.toInt() ?: 0,
                        denegadas = it.denegadas?.toInt() ?: 0,
                        vencidas = it.vencidas?.toInt() ?: 0
                    )
                } ?: SolicitudEstadisticas(0, 0, 0, 0, 0)
            }
    }
}
