package com.gestion.misaip.core.domain.model

data class ExpedienteTtaip(
    val id: String,
    val numeroExpediente: String,
    val estado: String,
    val fechaApertura: String?,
    val fechaActualizacion: String?,
    val fechaPrimeraCalificacion: String?,
    val fechaSegundaCalificacion: String?,
    val fechaResolucionFinal: String?,
    val fechaLimiteResolucion: String?,
    val trazabilidadMinima: String?,
    val sala: SalaTtaip?,
    val miembros: List<MiembroTtaip>,
    val documentos: List<Documento> = emptyList(),
    val resoluciones: List<ResolucionTtaip>,
    val cedulas: List<CedulaTtaip>,
    val notificaciones: List<NotificacionTtaip>,
    val historial: List<HistorialTtaip>,
    val reprocesos: List<ReprocesoNotificacionTtaip>,
    val descargos: List<DescargoEntidadTtaip>,
    val suspensiones: List<SuspensionPlazoTtaip>,
    val cumplimientos: List<CumplimientoResolucionTtaip>
)

data class SalaTtaip(
    val id: String,
    val nombre: String,
    val periodoInicio: String?,
    val periodoFin: String?,
    val presidenteSala: MiembroTtaip?
)

data class MiembroTtaip(
    val id: String,
    val nombre: String,
    val cargo: String,
    val sala: String?,
    val especialidad: String?,
    val email: String?,
    val periodoInicio: String?,
    val periodoFin: String?,
    val presidenteTribunal: Boolean
)

data class ResolucionTtaip(
    val id: String,
    val numeroResolucion: String,
    val tipoResolucion: String,
    val decision: String,
    val fundamentos: String?,
    val fundamentoLegal: String?,
    val observaciones: String?,
    val fechaResolucion: String?,
    val documentos: List<Documento> = emptyList(),
    val cedulas: List<CedulaTtaip>
)

data class CedulaTtaip(
    val id: String,
    val numeroCedula: String,
    val destinatario: String,
    val destinatarioNombre: String?,
    val destinatarioEmail: String?,
    val fechaEmision: String?,
    val canal: String?,
    val estado: String?,
    val documentoReferencia: String?,
    val documentos: List<Documento> = emptyList()
)

data class NotificacionTtaip(
    val id: String,
    val cedulaId: String?,
    val numeroCedula: String,
    val destinatario: String,
    val destinatarioNombre: String?,
    val destinatarioEmail: String?,
    val fechaNotificacion: String?,
    val medio: String?,
    val medioNotificacion: String?,
    val estado: String?,
    val detalle: String?,
    val fechaEnvio: String?,
    val codigoEnvio: String?,
    val codigoConstancia: String?,
    val constanciaEnvio: String?,
    val acuseAutomatico: String?,
    val fechaAcuse: String?,
    val estadoAcuse: String?,
    val resultadoNotificacion: String?,
    val evidenciaUrl: String?,
    val referenciaEvidencia: String?,
    val validadaManualmente: Boolean,
    val fechaValidacionManual: String?,
    val responsableValidacion: String?,
    val observacionValidacion: String?,
    val trazabilidad: String?,
    val documentosCedula: List<Documento> = emptyList()
) {
    val permiteReproceso: Boolean
        get() = estado in setOf("FALLIDA", "OBSERVADA") ||
            estadoAcuse in setOf("FALLIDO", "NO_RECIBIDO", "OBSERVADO")
}

data class HistorialTtaip(
    val id: String,
    val tipoEvento: String,
    val descripcion: String,
    val estadoAnterior: String?,
    val estadoNuevo: String?,
    val actor: String?,
    val referencia: String?,
    val fechaEvento: String?
)

data class ReprocesoNotificacionTtaip(
    val id: String,
    val notificacionId: String?,
    val cedulaOriginalId: String?,
    val cedulaNuevaId: String?,
    val notificacionNuevaId: String?,
    val numeroCedulaOriginal: String,
    val numeroCedulaNueva: String?,
    val destinatario: String,
    val numeroIntento: Int?,
    val estado: String?,
    val observacion: String?,
    val trazabilidad: String? = null
)

data class DescargoEntidadTtaip(
    val id: String,
    val entidadNombre: String?,
    val fechaRequerimiento: String?,
    val fechaLimiteDescargo: String?,
    val fechaPresentacion: String?,
    val estado: String?,
    val resumen: String?,
    val documento: String?,
    val responsableEntidad: String?,
    val observacion: String?,
    val trazabilidad: String?
)

data class SuspensionPlazoTtaip(
    val id: String,
    val motivo: String,
    val solicitante: String?,
    val motivoDetalle: String?,
    val fechaInicio: String?,
    val fechaFin: String?,
    val diasSuspendidos: Int?,
    val estado: String?,
    val observacion: String?
)

data class CumplimientoResolucionTtaip(
    val id: String,
    val resolucionId: String,
    val numeroResolucion: String?,
    val decisionResolucion: String?,
    val entidadNombre: String?,
    val fechaLimiteCumplimiento: String?,
    val estado: String?,
    val tipo: String?,
    val descripcion: String?,
    val evidencia: String?,
    val referenciaDocumento: String?,
    val observacion: String?,
    val trazabilidad: String?
)

data class IntentoNotificacionTtaip(
    val id: String,
    val estado: String?,
    val canal: String?,
    val proveedor: String?,
    val codigoCorrelacion: String?,
    val codigoConstancia: String?,
    val estadoAcuse: String?,
    val mensajeTecnicoSanitizado: String?,
    val fechaIntento: String?,
    val fechaRespuesta: String?,
    val trazabilidad: String?
)

enum class DecisionResolucionTtaip(val etiqueta: String) {
    FUNDADO("Fundado"),
    FUNDADO_EN_PARTE("Fundado en parte"),
    INFUNDADO("Infundado"),
    INFUNDADO_EN_PARTE("Infundado en parte"),
    IMPROCEDENTE("Improcedente"),
    CONCLUSION_SUSTRACCION_MATERIA("Sustracción de la materia"),
    CONCLUSION_DESISTIMIENTO("Desistimiento"),
    ESTESE_A_LO_RESUELTO("Estese a lo resuelto"),
    NULIDAD_DEL_ACTO("Nulidad del acto")
}

enum class TipoSuspensionTtaip {
    INFORME_ORAL,
    INFORMACION_COMPLEMENTARIA
}

data class AdmitirElevacionExcepcional(
    val responsableTtaip: String,
    val observacion: String
)

data class RequerirDescargoTtaip(
    val responsableTtaip: String,
    val observacion: String?
)

data class RegistrarSuspensionTtaip(
    val solicitante: String,
    val motivo: String,
    val responsable: String,
    val observacion: String?
)

data class CancelarSuspensionTtaip(
    val responsable: String,
    val observacion: String?
)

data class EnviarNotificacionTtaip(
    val asunto: String,
    val contenido: String,
    val responsable: String?
)

data class RegistrarConstanciaTtaip(
    val medioNotificacion: String,
    val constanciaEnvio: String,
    val responsable: String,
    val referenciaEvidencia: String?
)

data class RegistrarAcuseTtaip(
    val estadoAcuse: String,
    val acuseAutomatico: String,
    val responsable: String?,
    val referenciaEvidencia: String?
)

data class ValidarNotificacionTtaip(
    val responsableValidacion: String,
    val observacionValidacion: String,
    val referenciaEvidencia: String?
)

data class ReprocesarNotificacionTtaip(
    val numeroCedulaOriginal: String,
    val destinatario: String,
    val observacion: String,
    val responsable: String?
)

data class CrearSeguimientoCumplimientoTtaip(
    val responsableTtaip: String?,
    val observacion: String?
)

data class ObservarCumplimientoTtaip(
    val observacion: String,
    val responsableTtaip: String?
)

data class CerrarCumplimientoTtaip(
    val responsableTtaip: String?,
    val observacion: String?
)

data class ResolverApelacionTtaip(
    val decision: DecisionResolucionTtaip,
    val fundamentos: String,
    val fundamentoLegal: String?,
    val observaciones: String?
)
