package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.*

interface ExpedienteTtaipRemoteDataSource {
    suspend fun obtenerPorNumero(numeroExpediente: String): Pair<Apelacion, ExpedienteTtaip>
    suspend fun admitirExcepcionalmente(apelacionId: String, request: AdmitirElevacionExcepcional)
    suspend fun requerirDescargo(expedienteId: String, request: RequerirDescargoTtaip)
    suspend fun registrarSuspension(expedienteId: String, tipo: TipoSuspensionTtaip, request: RegistrarSuspensionTtaip)
    suspend fun cancelarSuspension(expedienteId: String, suspensionId: String, request: CancelarSuspensionTtaip)
    suspend fun enviarNotificacion(expedienteId: String, notificacionId: String, request: EnviarNotificacionTtaip)
    suspend fun listarIntentosNotificacion(expedienteId: String, notificacionId: String): List<IntentoNotificacionTtaip>
    suspend fun registrarConstancia(expedienteId: String, notificacionId: String, request: RegistrarConstanciaTtaip)
    suspend fun registrarAcuse(expedienteId: String, notificacionId: String, request: RegistrarAcuseTtaip)
    suspend fun validarNotificacion(expedienteId: String, notificacionId: String, request: ValidarNotificacionTtaip)
    suspend fun reprocesarNotificacion(request: ReprocesarNotificacionTtaip)
    suspend fun crearSeguimientoCumplimiento(expedienteId: String, resolucionId: String, request: CrearSeguimientoCumplimientoTtaip)
    suspend fun observarCumplimiento(expedienteId: String, cumplimientoId: String, request: ObservarCumplimientoTtaip)
    suspend fun cerrarCumplimiento(expedienteId: String, cumplimientoId: String, request: CerrarCumplimientoTtaip)
    suspend fun resolverApelacion(apelacionId: String, request: ResolverApelacionTtaip)
}
