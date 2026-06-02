package com.gestion.misaip.core.domain.model

data class RegistrarApelacionExterna(
    val ciudadanoId: String,
    val entidadId: String?,
    val numeroSolicitudExterna: String,
    val fechaPresentacionSolicitudExterna: String,
    val tipoDenegatoria: TipoDenegatoria,
    val fechaRespuestaEntidad: String?,
    val resumenSolicitudOriginal: String,
    val resumenRespuestaEntidad: String?,
    val referenciaDocumentoSolicitud: String,
    val referenciaCargoRecepcion: String?,
    val referenciaRespuestaEntidad: String?,
    val evidenciaSilencioAdministrativo: String?,
    val fundamentos: String,
    val observacion: String?
)

data class RegistrarApelacionAnteEntidad(
    val solicitudId: String,
    val ciudadanoId: String,
    val fundamentos: String,
    val fechaPresentacionAnteEntidad: String,
    val referenciaCargoPresentacion: String,
    val observacion: String?
)

data class RegistrarElevacionApelacion(
    val responsableEntidad: String,
    val referenciaExpedienteElevado: String,
    val observacion: String?
)

data class ComunicarOmisionElevacion(
    val referenciaPruebaOmision: String,
    val observacion: String?
)
