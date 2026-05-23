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
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
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
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

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

        val entity = ApelacionMapper.toEntity(apelacionCompleta)
        queries.insertApelacion(
            id = entity.id, expediente = entity.expediente,
            expedienteSAIP = entity.expedienteSAIP, usuarioId = entity.usuarioId,
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
            sincronizado = false, pendienteSubida = true,
            ultimaModificacion = System.currentTimeMillis()
        )

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
        val entity = ApelacionMapper.toEntity(apelacion)
        queries.insertApelacion(
            id = entity.id, expediente = entity.expediente,
            expedienteSAIP = entity.expedienteSAIP, usuarioId = entity.usuarioId,
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
            sincronizado = false, pendienteSubida = true,
            ultimaModificacion = System.currentTimeMillis()
        )
        Unit
    }

    override suspend fun calificarApelacion(
        expediente: String,
        tipo: String,
        calificacion: Calificacion
    ) = withContext(Dispatchers.IO) {
        val calJson = json.encodeToString(
            com.gestion.misaip.core.data.mapper.CalificacionSerializable.from(calificacion)
        )

        // Normalizar tipo a minúsculas para comparación segura
        // (la UI envía "PRIMERA"/"SEGUNDA" en mayúsculas)
        val tipoLower = tipo.lowercase()

        val nuevoEstado = when {
            // Primera calificación: INADMISIBLE → subsanación (BR-TTAIP-003)
            calificacion.resultado == ResultadoCalificacion.INADMISIBLE && tipoLower == "primera" ->
                EstadoApelacion.EN_SUBSANACION.toDisplayString()
            // IMPROCEDENTE → fin del trámite (BR-TTAIP-003/005)
            calificacion.resultado == ResultadoCalificacion.IMPROCEDENTE ->
                EstadoApelacion.RESUELTO_IMPROCEDENTE.toDisplayString()
            // Primera calificación: ADMISIBLE → pasa a segunda calificación (BR-TTAIP-003)
            calificacion.resultado == ResultadoCalificacion.ADMISIBLE && tipoLower == "primera" ->
                EstadoApelacion.EN_CALIFICACION_2.toDisplayString()
            // Segunda calificación: ADMITIDO → notificación (BR-TTAIP-005/006)
            calificacion.resultado == ResultadoCalificacion.ADMITIDO && tipoLower == "segunda" ->
                EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION.toDisplayString()
            else -> EstadoApelacion.EN_CALIFICACION_1.toDisplayString()
        }

        val current = queries.getApelacionByExpediente(expediente).executeAsOneOrNull()
        val currentTimeline = current?.timeline ?: "[]"

        // Add event to timeline with human-readable result
        val resultadoDisplay = when (calificacion.resultado) {
            ResultadoCalificacion.ADMISIBLE -> "Admisible"
            ResultadoCalificacion.INADMISIBLE -> "Inadmisible"
            ResultadoCalificacion.IMPROCEDENTE -> "Improcedente"
            ResultadoCalificacion.ADMITIDO -> "Admitido"
        }
        val eventName = when (tipo) {
            "primera" -> "Primera calificación: $resultadoDisplay"
            "segunda" -> "Segunda calificación: $resultadoDisplay"
            else -> "Calificación emitida: $resultadoDisplay"
        }
        val newTimelineItems: MutableList<com.gestion.misaip.core.data.mapper.TimelineSerializable> = try {
            json.decodeFromString(currentTimeline)
        } catch (_: Exception) { mutableListOf() }
        newTimelineItems.add(
            com.gestion.misaip.core.data.mapper.TimelineSerializable(
                fecha = System.currentTimeMillis(),
                evento = eventName,
                tipo = "calificacion",
                completado = true,
                detalle = calificacion.fundamentacion.takeIf { it.isNotBlank() }
            )
        )
        val updatedTimeline = json.encodeToString(newTimelineItems)

        if (tipoLower == "primera") {
            queries.updatePrimeraCalificacion(
                estado = nuevoEstado,
                primeraCalificacion = calJson,
                timeline = updatedTimeline,
                ultimaModificacion = System.currentTimeMillis(),
                expediente = expediente
            )
        } else {
            queries.updateSegundaCalificacion(
                estado = nuevoEstado,
                segundaCalificacion = calJson,
                timeline = updatedTimeline,
                ultimaModificacion = System.currentTimeMillis(),
                expediente = expediente
            )
        }
        Unit
    }

    override suspend fun presentarSubsanacion(
        expediente: String,
        subsanacion: Subsanacion
    ) = withContext(Dispatchers.IO) {
        val subJson = json.encodeToString(
            com.gestion.misaip.core.data.mapper.SubsanacionSerializable.from(subsanacion)
        )

        val current = queries.getApelacionByExpediente(expediente).executeAsOneOrNull()
        val currentTimeline = current?.timeline ?: "[]"
        val timelineItems: MutableList<com.gestion.misaip.core.data.mapper.TimelineSerializable> = try {
            json.decodeFromString(currentTimeline)
        } catch (_: Exception) { mutableListOf() }
        timelineItems.add(
            com.gestion.misaip.core.data.mapper.TimelineSerializable(
                fecha = System.currentTimeMillis(),
                evento = "Subsanación presentada",
                tipo = "subsanacion",
                completado = true
            )
        )

        queries.updateSubsanacion(
            subsanacion = subJson,
            timeline = json.encodeToString(timelineItems),
            ultimaModificacion = System.currentTimeMillis(),
            expediente = expediente
        )
        Unit
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
                    val entity = ApelacionMapper.toEntity(apelacion, pendienteSubida = false)
                    queries.insertApelacion(
                        id = entity.id, expediente = entity.expediente,
                        expedienteSAIP = entity.expedienteSAIP, usuarioId = entity.usuarioId,
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
                        sincronizado = true, pendienteSubida = false,
                        ultimaModificacion = System.currentTimeMillis()
                    )
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
}
