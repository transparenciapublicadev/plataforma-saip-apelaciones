package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.*
import kotlinx.serialization.Serializable

@Serializable
data class ExpedienteTtaipRestDto(
    val id: Long? = null,
    val numeroExpediente: String? = null,
    val estado: String? = null,
    val fechaApertura: String? = null,
    val fechaActualizacion: String? = null,
    val fechaPrimeraCalificacion: String? = null,
    val fechaSegundaCalificacion: String? = null,
    val fechaResolucionFinal: String? = null,
    val fechaLimiteResolucion: String? = null,
    val trazabilidadMinima: String? = null,
    val sala: SalaTtaipRestDto? = null,
    val miembros: List<MiembroTtaipRestDto> = emptyList(),
    val resoluciones: List<ResolucionRestDto> = emptyList(),
    val cedulas: List<CedulaTtaipRestDto> = emptyList(),
    val notificaciones: List<NotificacionTtaipRestDto> = emptyList(),
    val historial: List<HistorialTtaipRestDto> = emptyList(),
    val reprocesos: List<ReprocesoNotificacionTtaipRestDto> = emptyList(),
    val descargosEntidad: List<DescargoEntidadTtaipRestDto> = emptyList(),
    val suspensionesPlazo: List<SuspensionPlazoTtaipRestDto> = emptyList(),
    val cumplimientosResolucion: List<CumplimientoResolucionTtaipRestDto> = emptyList()
) {
    fun toDomain() = ExpedienteTtaip(
        id = id?.toString().orEmpty(),
        numeroExpediente = numeroExpediente.orEmpty(),
        estado = estado.orEmpty(),
        fechaApertura = fechaApertura,
        fechaActualizacion = fechaActualizacion,
        fechaPrimeraCalificacion = fechaPrimeraCalificacion,
        fechaSegundaCalificacion = fechaSegundaCalificacion,
        fechaResolucionFinal = fechaResolucionFinal,
        fechaLimiteResolucion = fechaLimiteResolucion,
        trazabilidadMinima = trazabilidadMinima,
        sala = sala?.toDomain(),
        miembros = miembros.map { it.toDomain() },
        resoluciones = resoluciones.map { it.toTtaipDomain() },
        cedulas = cedulas.map { it.toDomain() },
        notificaciones = notificaciones.map { it.toDomain() },
        historial = historial.map { it.toDomain() },
        reprocesos = reprocesos.map { it.toDomain() },
        descargos = descargosEntidad.map { it.toDomain() },
        suspensiones = suspensionesPlazo.map { it.toDomain() },
        cumplimientos = cumplimientosResolucion.map { it.toDomain() }
    )
}

@Serializable
data class SalaTtaipRestDto(
    val id: Long? = null,
    val nombre: String? = null,
    val periodoInicio: String? = null,
    val periodoFin: String? = null,
    val presidenteSala: MiembroTtaipRestDto? = null
) {
    fun toDomain() = SalaTtaip(id?.toString().orEmpty(), nombre.orEmpty(), periodoInicio, periodoFin, presidenteSala?.toDomain())
}

@Serializable
data class MiembroTtaipRestDto(
    val id: Long? = null,
    val nombre: String? = null,
    val cargo: String? = null,
    val sala: String? = null,
    val especialidad: String? = null,
    val email: String? = null,
    val periodoInicio: String? = null,
    val periodoFin: String? = null,
    val presidenteTribunal: Boolean? = null
) {
    fun toDomain() = MiembroTtaip(id?.toString().orEmpty(), nombre.orEmpty(), cargo.orEmpty(), sala, especialidad, email, periodoInicio, periodoFin, presidenteTribunal == true)
}

@Serializable
data class CedulaTtaipRestDto(
    val id: Long? = null,
    val numeroCedula: String? = null,
    val destinatario: String? = null,
    val destinatarioNombre: String? = null,
    val destinatarioEmail: String? = null,
    val fechaEmision: String? = null,
    val canal: String? = null,
    val estado: String? = null,
    val documentoReferencia: String? = null
) {
    fun toDomain() = CedulaTtaip(id?.toString().orEmpty(), numeroCedula.orEmpty(), destinatario.orEmpty(), destinatarioNombre, destinatarioEmail, fechaEmision, canal, estado, documentoReferencia)
}

@Serializable
data class NotificacionTtaipRestDto(
    val id: Long? = null,
    val numeroCedula: String? = null,
    val destinatario: String? = null,
    val destinatarioNombre: String? = null,
    val destinatarioEmail: String? = null,
    val fechaNotificacion: String? = null,
    val medio: String? = null,
    val medioNotificacion: String? = null,
    val estado: String? = null,
    val detalle: String? = null,
    val fechaEnvio: String? = null,
    val codigoEnvio: String? = null,
    val codigoConstancia: String? = null,
    val constanciaEnvio: String? = null,
    val acuseAutomatico: String? = null,
    val fechaAcuse: String? = null,
    val estadoAcuse: String? = null,
    val resultadoNotificacion: String? = null,
    val evidenciaUrl: String? = null,
    val referenciaEvidencia: String? = null,
    val validadaManualmente: Boolean? = null,
    val fechaValidacionManual: String? = null,
    val responsableValidacion: String? = null,
    val observacionValidacion: String? = null,
    val trazabilidad: String? = null
) {
    fun toDomain() = NotificacionTtaip(
        id?.toString().orEmpty(), numeroCedula.orEmpty(), destinatario.orEmpty(), destinatarioNombre,
        destinatarioEmail, fechaNotificacion, medio, medioNotificacion, estado, detalle, fechaEnvio,
        codigoEnvio, codigoConstancia, constanciaEnvio, acuseAutomatico, fechaAcuse, estadoAcuse,
        resultadoNotificacion, evidenciaUrl, referenciaEvidencia, validadaManualmente == true,
        fechaValidacionManual, responsableValidacion, observacionValidacion, trazabilidad
    )
}

@Serializable
data class HistorialTtaipRestDto(
    val id: Long? = null,
    val tipoEvento: String? = null,
    val descripcion: String? = null,
    val estadoAnterior: String? = null,
    val estadoNuevo: String? = null,
    val actor: String? = null,
    val referencia: String? = null,
    val fechaEvento: String? = null
) {
    fun toDomain() = HistorialTtaip(id?.toString().orEmpty(), tipoEvento.orEmpty(), descripcion.orEmpty(), estadoAnterior, estadoNuevo, actor, referencia, fechaEvento)
}

@Serializable
data class ReprocesoNotificacionTtaipRestDto(
    val id: Long? = null,
    val notificacionId: Long? = null,
    val cedulaOriginalId: Long? = null,
    val cedulaNuevaId: Long? = null,
    val notificacionNuevaId: Long? = null,
    val numeroCedulaOriginal: String? = null,
    val numeroCedulaNueva: String? = null,
    val destinatario: String? = null,
    val numeroIntento: Int? = null,
    val estado: String? = null,
    val observacionReproceso: String? = null
) {
    fun toDomain() = ReprocesoNotificacionTtaip(id?.toString().orEmpty(), notificacionId?.toString(), cedulaOriginalId?.toString(), cedulaNuevaId?.toString(), notificacionNuevaId?.toString(), numeroCedulaOriginal.orEmpty(), numeroCedulaNueva, destinatario.orEmpty(), numeroIntento, estado, observacionReproceso)
}

@Serializable
data class DescargoEntidadTtaipRestDto(
    val id: Long? = null,
    val entidadNombre: String? = null,
    val fechaRequerimiento: String? = null,
    val fechaLimiteDescargo: String? = null,
    val fechaPresentacion: String? = null,
    val estadoDescargo: String? = null,
    val resumenDescargo: String? = null,
    val documentoDescargo: String? = null,
    val responsableEntidad: String? = null,
    val observacion: String? = null,
    val trazabilidad: String? = null
) {
    fun toDomain() = DescargoEntidadTtaip(id?.toString().orEmpty(), entidadNombre, fechaRequerimiento, fechaLimiteDescargo, fechaPresentacion, estadoDescargo, resumenDescargo, documentoDescargo, responsableEntidad, observacion, trazabilidad)
}

@Serializable
data class SuspensionPlazoTtaipRestDto(
    val id: Long? = null,
    val motivoSuspension: String? = null,
    val solicitante: String? = null,
    val motivoDetalle: String? = null,
    val fechaInicioSuspension: String? = null,
    val fechaFinSuspension: String? = null,
    val diasSuspendidos: Int? = null,
    val estadoSuspension: String? = null,
    val observacion: String? = null
) {
    fun toDomain() = SuspensionPlazoTtaip(id?.toString().orEmpty(), motivoSuspension.orEmpty(), solicitante, motivoDetalle, fechaInicioSuspension, fechaFinSuspension, diasSuspendidos, estadoSuspension, observacion)
}

@Serializable
data class CumplimientoResolucionTtaipRestDto(
    val id: Long? = null,
    val resolucionId: Long? = null,
    val numeroResolucion: String? = null,
    val decisionResolucion: String? = null,
    val entidadNombre: String? = null,
    val fechaLimiteCumplimiento: String? = null,
    val estadoCumplimiento: String? = null,
    val tipoCumplimiento: String? = null,
    val descripcionCumplimiento: String? = null,
    val evidenciaCumplimiento: String? = null,
    val referenciaDocumento: String? = null,
    val observacion: String? = null,
    val trazabilidad: String? = null
) {
    fun toDomain() = CumplimientoResolucionTtaip(id?.toString().orEmpty(), resolucionId?.toString().orEmpty(), numeroResolucion, decisionResolucion, entidadNombre, fechaLimiteCumplimiento, estadoCumplimiento, tipoCumplimiento, descripcionCumplimiento, evidenciaCumplimiento, referenciaDocumento, observacion, trazabilidad)
}

@Serializable data class AdmitirElevacionExcepcionalRestRequest(val responsableTtaip: String, val observacion: String)
@Serializable data class RequerirDescargoTtaipRestRequest(val responsableTtaip: String, val observacion: String?)
@Serializable data class RegistrarSuspensionTtaipRestRequest(val solicitante: String, val motivo: String, val responsable: String, val observacion: String?)
@Serializable data class CancelarSuspensionTtaipRestRequest(val responsable: String, val observacion: String?)
@Serializable data class EnviarNotificacionTtaipRestRequest(val asunto: String, val contenido: String, val responsable: String?, val forzarFalloMock: Boolean = false)
@Serializable data class RegistrarConstanciaTtaipRestRequest(val medioNotificacion: String, val constanciaEnvio: String, val responsable: String, val referenciaEvidencia: String?)
@Serializable data class RegistrarAcuseTtaipRestRequest(val estadoAcuse: String, val acuseAutomatico: String, val responsable: String?, val referenciaEvidencia: String?)
@Serializable data class ValidarNotificacionTtaipRestRequest(val responsableValidacion: String, val observacionValidacion: String, val referenciaEvidencia: String?)
@Serializable data class ReprocesarNotificacionTtaipRestRequest(val numeroCedulaOriginal: String, val destinatario: String, val observacion: String, val responsable: String?)
@Serializable data class CrearSeguimientoCumplimientoTtaipRestRequest(val responsableTtaip: String?, val observacion: String?)
@Serializable data class ObservarCumplimientoTtaipRestRequest(val observacion: String, val responsableTtaip: String?)
@Serializable data class CerrarCumplimientoTtaipRestRequest(val responsableTtaip: String?, val observacion: String?)

@Serializable
data class IntentoNotificacionTtaipRestDto(
    val id: Long? = null,
    val estado: String? = null,
    val canal: String? = null,
    val proveedor: String? = null,
    val codigoCorrelacion: String? = null,
    val codigoConstancia: String? = null,
    val estadoAcuse: String? = null,
    val mensajeTecnicoSanitizado: String? = null,
    val fechaIntento: String? = null,
    val fechaRespuesta: String? = null,
    val trazabilidad: String? = null
) {
    fun toDomain() = IntentoNotificacionTtaip(
        id?.toString().orEmpty(), estado, canal, proveedor, codigoCorrelacion, codigoConstancia,
        estadoAcuse, mensajeTecnicoSanitizado, fechaIntento, fechaRespuesta, trazabilidad
    )
}

fun ResolucionRestDto.toTtaipDomain() = ResolucionTtaip(
    id = id?.toString().orEmpty(),
    numeroResolucion = numeroResolucion.orEmpty(),
    tipoResolucion = tipoResolucion.orEmpty(),
    decision = decision.orEmpty(),
    fundamentos = fundamentos,
    fundamentoLegal = fundamentoLegal,
    observaciones = observaciones,
    fechaResolucion = fechaResolucion,
    cedulas = cedulas.map { it.toDomain() }
)
