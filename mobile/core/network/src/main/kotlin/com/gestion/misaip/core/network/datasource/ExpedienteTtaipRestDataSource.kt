package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.network.api.ApelacionApiService
import com.gestion.misaip.core.network.api.TTAIPApiService
import com.gestion.misaip.core.network.dto.rest.*
import kotlinx.serialization.json.Json
import retrofit2.HttpException

class ExpedienteTtaipRestDataSource(
    private val apelacionApi: ApelacionApiService,
    private val ttaipApi: TTAIPApiService,
    private val json: Json
) : ExpedienteTtaipRemoteDataSource {

    override suspend fun obtenerPorNumero(numeroExpediente: String): Pair<Apelacion, ExpedienteTtaip> = traducir {
        val apelacion = apelacionApi.getByExpediente(numeroExpediente).toDomain()
        val expediente = apelacion.expedienteTtaip
            ?: throw NetworkException("El expediente TTAIP agregado aún no está disponible")
        apelacion to expediente
    }

    override suspend fun admitirExcepcionalmente(apelacionId: String, request: AdmitirElevacionExcepcional) = traducir {
        apelacionApi.admitirExcepcionalmente(apelacionId.id("apelación"), AdmitirElevacionExcepcionalRestRequest(request.responsableTtaip, request.observacion))
        Unit
    }

    override suspend fun requerirDescargo(expedienteId: String, request: RequerirDescargoTtaip) = traducir {
        ttaipApi.requerirDescargo(expedienteId.id("expediente"), RequerirDescargoTtaipRestRequest(request.responsableTtaip, request.observacion))
        Unit
    }

    override suspend fun registrarSuspension(expedienteId: String, tipo: TipoSuspensionTtaip, request: RegistrarSuspensionTtaip) = traducir {
        val dto = RegistrarSuspensionTtaipRestRequest(request.solicitante, request.motivo, request.responsable, request.observacion)
        when (tipo) {
            TipoSuspensionTtaip.INFORME_ORAL -> ttaipApi.registrarInformeOral(expedienteId.id("expediente"), dto)
            TipoSuspensionTtaip.INFORMACION_COMPLEMENTARIA -> ttaipApi.registrarInformacionComplementaria(expedienteId.id("expediente"), dto)
        }
        Unit
    }

    override suspend fun cancelarSuspension(expedienteId: String, suspensionId: String, request: CancelarSuspensionTtaip) = traducir {
        ttaipApi.cancelarSuspension(expedienteId.id("expediente"), suspensionId.id("suspensión"), CancelarSuspensionTtaipRestRequest(request.responsable, request.observacion))
        Unit
    }

    override suspend fun enviarNotificacion(expedienteId: String, notificacionId: String, request: EnviarNotificacionTtaip) = traducir {
        ttaipApi.enviarNotificacion(expedienteId.id("expediente"), notificacionId.id("notificación"), EnviarNotificacionTtaipRestRequest(request.asunto, request.contenido, request.responsable))
        Unit
    }

    override suspend fun listarIntentosNotificacion(expedienteId: String, notificacionId: String) = traducir {
        ttaipApi.listarIntentosNotificacion(expedienteId.id("expediente"), notificacionId.id("notificación"))
            .map { it.toDomain() }
    }

    override suspend fun registrarConstancia(expedienteId: String, notificacionId: String, request: RegistrarConstanciaTtaip) = traducir {
        ttaipApi.registrarConstancia(expedienteId.id("expediente"), notificacionId.id("notificación"), RegistrarConstanciaTtaipRestRequest(request.medioNotificacion, request.constanciaEnvio, request.responsable, request.referenciaEvidencia))
        Unit
    }

    override suspend fun registrarAcuse(expedienteId: String, notificacionId: String, request: RegistrarAcuseTtaip) = traducir {
        ttaipApi.registrarAcuse(expedienteId.id("expediente"), notificacionId.id("notificación"), RegistrarAcuseTtaipRestRequest(request.estadoAcuse, request.acuseAutomatico, request.responsable, request.referenciaEvidencia))
        Unit
    }

    override suspend fun validarNotificacion(expedienteId: String, notificacionId: String, request: ValidarNotificacionTtaip) = traducir {
        ttaipApi.validarNotificacion(expedienteId.id("expediente"), notificacionId.id("notificación"), ValidarNotificacionTtaipRestRequest(request.responsableValidacion, request.observacionValidacion, request.referenciaEvidencia))
        Unit
    }

    override suspend fun reprocesarNotificacion(request: ReprocesarNotificacionTtaip) = traducir {
        ttaipApi.reprocesarNotificacion(ReprocesarNotificacionTtaipRestRequest(request.numeroCedulaOriginal, request.destinatario, request.observacion, request.responsable))
        Unit
    }

    override suspend fun crearSeguimientoCumplimiento(expedienteId: String, resolucionId: String, request: CrearSeguimientoCumplimientoTtaip) = traducir {
        ttaipApi.crearSeguimientoCumplimiento(expedienteId.id("expediente"), resolucionId.id("resolución"), CrearSeguimientoCumplimientoTtaipRestRequest(request.responsableTtaip, request.observacion))
        Unit
    }

    override suspend fun observarCumplimiento(expedienteId: String, cumplimientoId: String, request: ObservarCumplimientoTtaip) = traducir {
        ttaipApi.observarCumplimiento(expedienteId.id("expediente"), cumplimientoId.id("cumplimiento"), ObservarCumplimientoTtaipRestRequest(request.observacion, request.responsableTtaip))
        Unit
    }

    override suspend fun cerrarCumplimiento(expedienteId: String, cumplimientoId: String, request: CerrarCumplimientoTtaip) = traducir {
        ttaipApi.cerrarCumplimiento(expedienteId.id("expediente"), cumplimientoId.id("cumplimiento"), CerrarCumplimientoTtaipRestRequest(request.responsableTtaip, request.observacion))
        Unit
    }

    override suspend fun resolverApelacion(apelacionId: String, request: ResolverApelacionTtaip) = traducir {
        val dto = ResolucionRestRequest(request.fundamentos, request.fundamentoLegal, request.observaciones)
        when (request.decision) {
            DecisionResolucionTtaip.FUNDADO -> ttaipApi.declararFundado(apelacionId.id("apelación"), dto)
            DecisionResolucionTtaip.FUNDADO_EN_PARTE -> ttaipApi.declararFundadoEnParte(apelacionId.id("apelación"), dto)
            DecisionResolucionTtaip.INFUNDADO -> ttaipApi.declararInfundado(apelacionId.id("apelación"), dto)
            DecisionResolucionTtaip.INFUNDADO_EN_PARTE -> ttaipApi.declararInfundadoEnParte(apelacionId.id("apelación"), dto)
            DecisionResolucionTtaip.IMPROCEDENTE -> ttaipApi.declararImprocedente(apelacionId.id("apelación"), dto)
            DecisionResolucionTtaip.CONCLUSION_SUSTRACCION_MATERIA -> ttaipApi.declararSustraccionMateria(apelacionId.id("apelación"), dto)
            DecisionResolucionTtaip.CONCLUSION_DESISTIMIENTO -> ttaipApi.declararDesistimiento(apelacionId.id("apelación"), dto)
            DecisionResolucionTtaip.ESTESE_A_LO_RESUELTO -> ttaipApi.declararEsteseALoResuelto(apelacionId.id("apelación"), dto)
            DecisionResolucionTtaip.NULIDAD_DEL_ACTO -> ttaipApi.declararNulidadDelActo(apelacionId.id("apelación"), dto)
        }
        Unit
    }

    private fun String.id(nombre: String) = toLongOrNull() ?: throw NetworkException("ID de $nombre inválido")

    private suspend fun <T> traducir(block: suspend () -> T): T = try {
        block()
    } catch (e: HttpException) {
        val mensaje = json.extraerMensajeProblemDetails(e.response()?.errorBody()?.string())
            ?: "No se pudo completar la operación TTAIP (${e.code()})"
        throw ApiProblemException(mensaje, e.code(), e)
    }
}
