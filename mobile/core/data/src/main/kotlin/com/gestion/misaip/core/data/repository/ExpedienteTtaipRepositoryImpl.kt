package com.gestion.misaip.core.data.repository

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.ExpedienteTtaipRepository
import com.gestion.misaip.core.network.datasource.ExpedienteTtaipRemoteDataSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * El agregado TTAIP se consulta y muta contra backend. SQLDelight conserva solo
 * el resumen de apelación seguro para bandejas; no simula actos legales offline.
 */
class ExpedienteTtaipRepositoryImpl(
    private val remoteDataSource: ExpedienteTtaipRemoteDataSource
) : ExpedienteTtaipRepository {
    override suspend fun obtenerPorNumero(numeroExpediente: String) = io { remoteDataSource.obtenerPorNumero(numeroExpediente) }
    override suspend fun admitirExcepcionalmente(apelacionId: String, request: AdmitirElevacionExcepcional) = io { remoteDataSource.admitirExcepcionalmente(apelacionId, request) }
    override suspend fun requerirDescargo(expedienteId: String, request: RequerirDescargoTtaip) = io { remoteDataSource.requerirDescargo(expedienteId, request) }
    override suspend fun registrarSuspension(expedienteId: String, tipo: TipoSuspensionTtaip, request: RegistrarSuspensionTtaip) = io { remoteDataSource.registrarSuspension(expedienteId, tipo, request) }
    override suspend fun cancelarSuspension(expedienteId: String, suspensionId: String, request: CancelarSuspensionTtaip) = io { remoteDataSource.cancelarSuspension(expedienteId, suspensionId, request) }
    override suspend fun enviarNotificacion(expedienteId: String, notificacionId: String, request: EnviarNotificacionTtaip) = io { remoteDataSource.enviarNotificacion(expedienteId, notificacionId, request) }
    override suspend fun listarIntentosNotificacion(expedienteId: String, notificacionId: String) = io { remoteDataSource.listarIntentosNotificacion(expedienteId, notificacionId) }
    override suspend fun registrarConstancia(expedienteId: String, notificacionId: String, request: RegistrarConstanciaTtaip) = io { remoteDataSource.registrarConstancia(expedienteId, notificacionId, request) }
    override suspend fun registrarAcuse(expedienteId: String, notificacionId: String, request: RegistrarAcuseTtaip) = io { remoteDataSource.registrarAcuse(expedienteId, notificacionId, request) }
    override suspend fun validarNotificacion(expedienteId: String, notificacionId: String, request: ValidarNotificacionTtaip) = io { remoteDataSource.validarNotificacion(expedienteId, notificacionId, request) }
    override suspend fun reprocesarNotificacion(request: ReprocesarNotificacionTtaip) = io { remoteDataSource.reprocesarNotificacion(request) }
    override suspend fun crearSeguimientoCumplimiento(expedienteId: String, resolucionId: String, request: CrearSeguimientoCumplimientoTtaip) = io { remoteDataSource.crearSeguimientoCumplimiento(expedienteId, resolucionId, request) }
    override suspend fun observarCumplimiento(expedienteId: String, cumplimientoId: String, request: ObservarCumplimientoTtaip) = io { remoteDataSource.observarCumplimiento(expedienteId, cumplimientoId, request) }
    override suspend fun cerrarCumplimiento(expedienteId: String, cumplimientoId: String, request: CerrarCumplimientoTtaip) = io { remoteDataSource.cerrarCumplimiento(expedienteId, cumplimientoId, request) }
    override suspend fun resolverApelacion(apelacionId: String, request: ResolverApelacionTtaip) = io { remoteDataSource.resolverApelacion(apelacionId, request) }

    private suspend fun <T> io(block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
