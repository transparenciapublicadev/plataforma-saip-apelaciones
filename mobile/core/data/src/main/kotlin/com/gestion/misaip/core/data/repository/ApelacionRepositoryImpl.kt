package com.gestion.misaip.core.data.repository

import app.cash.sqldelight.coroutines.asFlow
import app.cash.sqldelight.coroutines.mapToList
import app.cash.sqldelight.coroutines.mapToOneOrNull
import com.gestion.misaip.core.data.mapper.ApelacionMapper
import com.gestion.misaip.core.database.SaipDatabase
import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import com.gestion.misaip.core.network.datasource.ApelacionRemoteDataSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID

/**
 * Implementación Offline-First del repositorio de Apelaciones.
 * SQLDelight es la SSOT local y el backend REST es la fuente remota de datos.
 */
class ApelacionRepositoryImpl(
    private val database: SaipDatabase,
    private val remoteDataSource: ApelacionRemoteDataSource
) : ApelacionRepository {

    private val queries = database.apelacionQueries
    override suspend fun cargarPaginaApelaciones(
        pagina: Int,
        tamano: Int
    ): Pagina<Apelacion> = cargarPagina(
        pagina = pagina,
        tamano = tamano,
        remote = { remoteDataSource.getPaginaApelaciones(pagina, tamano) },
        local = {
            queries.getAllApelacionesPaginadas(tamano.toLong(), offset(pagina, tamano))
                .executeAsList()
                .map(ApelacionMapper::toDomain) to queries.countAllApelaciones().executeAsOne()
        }
    )

    override suspend fun cargarPaginaApelacionesUsuario(
        usuarioId: String,
        pagina: Int,
        tamano: Int
    ): Pagina<Apelacion> = cargarPagina(
        pagina = pagina,
        tamano = tamano,
        remote = { remoteDataSource.getPaginaApelacionesUsuario(usuarioId, pagina, tamano) },
        local = {
            queries.getApelacionesByUsuarioPaginadas(
                usuarioId,
                tamano.toLong(),
                offset(pagina, tamano)
            ).executeAsList().map(ApelacionMapper::toDomain) to
                queries.countApelacionesByUsuario(usuarioId).executeAsOne()
        }
    )

    override fun getApelacionesUsuario(usuarioId: String): Flow<List<Apelacion>> {
        return queries.getApelacionesByUsuario(usuarioId)
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities -> entities.map { ApelacionMapper.toDomain(it) } }
    }

    override fun getTodasLasApelaciones(): Flow<List<Apelacion>> {
        return queries.getAllApelaciones()
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities -> entities.map { ApelacionMapper.toDomain(it) } }
    }

    override fun getApelacionPorExpediente(expediente: String): Flow<Apelacion?> {
        return queries.getApelacionByExpediente(expediente)
            .asFlow()
            .mapToOneOrNull(Dispatchers.IO)
            .map { entity -> entity?.let { ApelacionMapper.toDomain(it) } }
    }

    override fun getApelacionPorSAIP(expedienteSAIP: String): Flow<Apelacion?> {
        return queries.getApelacionByExpedienteSAIP(expedienteSAIP)
            .asFlow()
            .mapToOneOrNull(Dispatchers.IO)
            .map { entity -> entity?.let { ApelacionMapper.toDomain(it) } }
    }

    override suspend fun crearApelacion(apelacion: Apelacion): Apelacion = withContext(Dispatchers.IO) {
        val id = UUID.randomUUID().toString()
        val year = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)

        // Recalcular contador basado en expedientes existentes para evitar duplicados
        try {
            val maxResult = queries.getMaxExpedienteTTAIP().executeAsOneOrNull()
            val maxNum = maxResult?.MAX ?: 0L
            if (maxNum > 0) {
                queries.setContadorSiMayor(maxNum + 1, System.currentTimeMillis(), "TTAIP")
                android.util.Log.d("MiSAIP", "Contador TTAIP recalculado antes de crear: ${maxNum + 1}")
            }
        } catch (e: Exception) {
            android.util.Log.e("MiSAIP", "Error recalculando contador TTAIP: ${e.message}", e)
        }

        // Generar expediente único con reintentos (máx 10) para evitar sobreescritura
        var expediente: String
        var intentos = 0
        do {
            val contador = queries.getContador("TTAIP").executeAsOne()
            queries.incrementarContador(System.currentTimeMillis(), "TTAIP")
            expediente = "${String.format("%05d", contador)}-$year-JUS/TTAIP"
            val existente = queries.getApelacionByExpediente(expediente).executeAsOneOrNull()
            intentos++
            if (existente != null) {
                android.util.Log.w("MiSAIP", "Expediente TTAIP $expediente ya existe, reintentando (intento $intentos)")
            }
        } while (queries.getApelacionByExpediente(expediente).executeAsOneOrNull() != null && intentos < 10)

        if (intentos >= 10) {
            android.util.Log.e("MiSAIP", "No se pudo generar expediente TTAIP único tras $intentos intentos")
        }
        android.util.Log.d("MiSAIP", "Expediente TTAIP generado: $expediente (intento $intentos)")

        val apelacionCompleta = apelacion.copy(
            id = id,
            expediente = expediente,
            fechaPresentacion = System.currentTimeMillis(),
            estado = EstadoApelacion.EN_CALIFICACION_1,
            diasRestantes = 7,
            timeline = listOf(
                TimelineItem(
                    fecha = System.currentTimeMillis(),
                    evento = "Apelación presentada ante el TTAIP",
                    tipo = "recepcion",
                    completado = true
                )
            )
        )

        guardarApelacionLocal(apelacionCompleta, sincronizado = false, pendienteSubida = true)

        queries.insertSyncLog("Apelacion", id, "INSERT", System.currentTimeMillis())

        try {
            remoteDataSource.crearApelacion(apelacionCompleta)
            queries.marcarApelacionSincronizada(id)
            android.util.Log.d("MiSAIP", "Apelación $expediente sincronizada con backend REST")
        } catch (e: Exception) {
            android.util.Log.e("MiSAIP", "Error sincronizando apelación $expediente con backend REST: ${e.message}", e)
        }

        apelacionCompleta
    }

    override suspend fun actualizarApelacion(apelacion: Apelacion) = withContext(Dispatchers.IO) {
        guardarApelacionLocal(apelacion, sincronizado = false, pendienteSubida = true)
        Unit
    }

    override suspend fun crearApelacionExterna(
        request: RegistrarApelacionExterna
    ): Apelacion = guardarOperacionOnline {
        remoteDataSource.crearApelacionExterna(request)
    }

    override suspend fun crearApelacionAnteEntidad(
        request: RegistrarApelacionAnteEntidad
    ): Apelacion = guardarOperacionOnline {
        remoteDataSource.crearApelacionAnteEntidad(request)
    }

    override suspend fun getElevacion(apelacionId: String): ElevacionApelacion =
        withContext(Dispatchers.IO) {
            remoteDataSource.getElevacion(apelacionId)
        }

    override suspend fun getPendientesElevacionEntidad(
        entidadId: String
    ): List<ElevacionApelacion> = withContext(Dispatchers.IO) {
        remoteDataSource.getPendientesElevacionEntidad(entidadId)
    }

    override suspend fun elevarApelacion(
        apelacionId: String,
        request: RegistrarElevacionApelacion
    ): Apelacion = guardarOperacionOnline {
        remoteDataSource.elevarApelacion(apelacionId, request)
    }

    override suspend fun comunicarOmisionElevacion(
        apelacionId: String,
        request: ComunicarOmisionElevacion
    ): ElevacionApelacion = withContext(Dispatchers.IO) {
        val elevacion = remoteDataSource.comunicarOmisionElevacion(apelacionId, request)
        actualizarElevacionCache(apelacionId, elevacion)
        elevacion
    }

    override suspend fun calificarApelacion(
        expediente: String,
        tipo: String,
        calificacion: Calificacion
    ) {
        guardarOperacionOnline {
            remoteDataSource.calificarApelacion(expediente, tipo, calificacion)
        }
    }

    override suspend fun presentarSubsanacion(
        expediente: String,
        subsanacion: Subsanacion
    ) {
        guardarOperacionOnline {
            remoteDataSource.presentarSubsanacion(expediente, subsanacion)
        }
    }

    /**
     * Sincroniza apelaciones con el backend REST.
     * 1. Sube apelaciones pendientes locales (push)
     * 2. Descarga cambios desde el backend a la BD local (pull)
     */
    override suspend fun sincronizar() = withContext(Dispatchers.IO) {
        // 1. Push: Subir apelaciones pendientes (con timeout por ítem)
        val pendientes = queries.getApelacionesPendientesSincronizacion().executeAsList()
        for (entity in pendientes) {
            try {
                val subido = withTimeoutOrNull(5_000L) {
                    val apelacion = ApelacionMapper.toDomain(entity)
                    remoteDataSource.actualizarApelacion(apelacion)
                    true
                }
                if (subido == true) {
                    queries.marcarApelacionSincronizada(entity.id)
                }
            } catch (e: Exception) {
                android.util.Log.w("MiSAIP", "Error push apelación ${entity.id}: ${e.message}")
            }
        }

        // 2. Pull: Descargar actualizaciones desde backend REST (con timeout global)
        try {
            val ultimaSync = queries.getAllApelaciones().executeAsList()
                .filter { it.sincronizado }
                .maxOfOrNull { it.ultimaModificacion } ?: 0L

            val remotas = withTimeoutOrNull(8_000L) {
                remoteDataSource.getApelacionesModificadasDesde(ultimaSync)
            }
            if (remotas != null) {
                android.util.Log.d("MiSAIP", "Apelaciones remotas obtenidas: ${remotas.size}")
                for (apelacion in remotas) {
                    guardarApelacionLocal(apelacion, sincronizado = true, pendienteSubida = false)
                }
            } else {
                android.util.Log.w("MiSAIP", "Timeout sincronizando apelaciones (pull) — sin conexión o servidor lento")
            }
        } catch (e: Exception) {
            android.util.Log.e("MiSAIP", "Error sincronizando apelaciones: ${e.message}", e)
        }

        // 3. Recalcular contador TTAIP basado en el máximo expediente local
        try {
            val maxResult = queries.getMaxExpedienteTTAIP().executeAsOneOrNull()
            val maxNum = maxResult?.MAX ?: 0L
            if (maxNum > 0) {
                queries.setContadorSiMayor(maxNum + 1, System.currentTimeMillis(), "TTAIP")
                android.util.Log.d("MiSAIP", "Contador TTAIP actualizado al máximo local: ${maxNum + 1}")
            }
        } catch (e: Exception) {
            android.util.Log.e("MiSAIP", "Error actualizando contador TTAIP: ${e.message}", e)
        }
        Unit
    }

    private suspend fun cargarPagina(
        pagina: Int,
        tamano: Int,
        remote: suspend () -> Pagina<Apelacion>,
        local: suspend () -> Pair<List<Apelacion>, Long>
    ): Pagina<Apelacion> = withContext(Dispatchers.IO) {
        withOfflinePageFallback(
            remote = {
                val remota = remote()
                val actualizadas = remota.contenido.map { resumen ->
                    val cached = queries.getApelacionByExpediente(resumen.expediente)
                        .executeAsOneOrNull()
                        ?.let(ApelacionMapper::toDomain)
                    val merged = resumen.completarResumenDesde(cached)
                    guardarApelacionLocal(merged, sincronizado = true, pendienteSubida = false)
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

    private fun guardarApelacionLocal(
        apelacion: Apelacion,
        sincronizado: Boolean,
        pendienteSubida: Boolean
    ) {
        val entity = ApelacionMapper.toEntity(apelacion, pendienteSubida)
        queries.insertApelacion(
            id = entity.id, expediente = entity.expediente,
            expedienteSAIP = entity.expedienteSAIP, solicitudId = entity.solicitudId,
            usuarioId = entity.usuarioId,
            apelanteNombre = entity.apelanteNombre, apelanteDni = entity.apelanteDni,
            apelanteEmail = entity.apelanteEmail, entidad = entity.entidad,
            entidadId = entity.entidadId, asunto = entity.asunto,
            fundamentoLegal = entity.fundamentoLegal, exposicionHechos = entity.exposicionHechos,
            pretension = entity.pretension, fechaPresentacion = entity.fechaPresentacion,
            estado = entity.estado, funcionarioTTAIP = entity.funcionarioTTAIP,
            primeraCalificacion = entity.primeraCalificacion,
            segundaCalificacion = entity.segundaCalificacion,
            subsanacion = entity.subsanacion, timeline = entity.timeline,
            diasHabiles = entity.diasHabiles, diasRestantes = entity.diasRestantes,
            informeOralSolicitado = entity.informeOralSolicitado,
            timerPausado = entity.timerPausado, fechaElevacion = entity.fechaElevacion,
            elevacionExtemporanea = entity.elevacionExtemporanea,
            tipoOrigen = entity.tipoOrigen,
            numeroSolicitudExterna = entity.numeroSolicitudExterna,
            tipoDenegatoria = entity.tipoDenegatoria,
            fechaPresentacionSolicitudExterna = entity.fechaPresentacionSolicitudExterna,
            fechaRespuestaEntidad = entity.fechaRespuestaEntidad,
            resumenSolicitudOriginal = entity.resumenSolicitudOriginal,
            resumenRespuestaEntidad = entity.resumenRespuestaEntidad,
            referenciaDocumentoSolicitud = entity.referenciaDocumentoSolicitud,
            referenciaCargoRecepcion = entity.referenciaCargoRecepcion,
            referenciaRespuestaEntidad = entity.referenciaRespuestaEntidad,
            evidenciaSilencioAdministrativo = entity.evidenciaSilencioAdministrativo,
            observacion = entity.observacion,
            estadoElevacion = entity.estadoElevacion,
            fechaLimiteElevacion = entity.fechaLimiteElevacion,
            referenciaCargoPresentacionElevacion = entity.referenciaCargoPresentacionElevacion,
            referenciaExpedienteElevado = entity.referenciaExpedienteElevado,
            referenciaPruebaOmision = entity.referenciaPruebaOmision,
            sincronizado = sincronizado, pendienteSubida = pendienteSubida,
            ultimaModificacion = System.currentTimeMillis()
        )
    }

    private fun Apelacion.completarResumenDesde(local: Apelacion?): Apelacion {
        if (local == null) return this
        return local.copy(
            id = id.ifBlank { local.id },
            expediente = expediente.ifBlank { local.expediente },
            expedienteSAIP = expedienteSAIP.ifBlank { local.expedienteSAIP },
            solicitudId = solicitudId ?: local.solicitudId,
            usuarioId = usuarioId.ifBlank { local.usuarioId },
            apelante = local.apelante.copy(
                nombre = apelante.nombre.ifBlank { local.apelante.nombre }
            ),
            entidad = entidad.ifBlank { local.entidad },
            entidadId = entidadId.ifBlank { local.entidadId },
            fechaPresentacion = fechaPresentacion.takeIf { it > 0 } ?: local.fechaPresentacion,
            estado = estado,
            tipoOrigen = if (tipoOrigen == TipoOrigenApelacion.SAIP_INTERNA) local.tipoOrigen else tipoOrigen,
            datosExternos = datosExternos ?: local.datosExternos,
            elevacion = elevacion ?: local.elevacion
        )
    }

    private suspend fun guardarOperacionOnline(
        operacion: suspend () -> Apelacion
    ): Apelacion = withContext(Dispatchers.IO) {
        val apelacion = operacion()
        guardarApelacionLocal(apelacion, sincronizado = true, pendienteSubida = false)
        apelacion
    }

    private fun actualizarElevacionCache(apelacionId: String, elevacion: ElevacionApelacion) {
        val local = queries.getAllApelaciones().executeAsList()
            .firstOrNull { it.id == apelacionId }
            ?.let(ApelacionMapper::toDomain)
            ?: return
        guardarApelacionLocal(
            local.copy(elevacion = elevacion),
            sincronizado = true,
            pendienteSubida = false
        )
    }

    private fun paginaLocal(
        contenido: List<Apelacion>,
        pagina: Int,
        tamano: Int,
        total: Long
    ): Pagina<Apelacion> {
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
}
