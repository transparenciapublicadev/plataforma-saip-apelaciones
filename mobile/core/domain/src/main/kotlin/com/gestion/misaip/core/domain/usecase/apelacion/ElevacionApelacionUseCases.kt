package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.ComunicarOmisionElevacion
import com.gestion.misaip.core.domain.model.ElevacionApelacion
import com.gestion.misaip.core.domain.model.RegistrarApelacionAnteEntidad
import com.gestion.misaip.core.domain.model.RegistrarApelacionExterna
import com.gestion.misaip.core.domain.model.RegistrarElevacionApelacion
import com.gestion.misaip.core.domain.model.TipoDenegatoria
import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.repository.ApelacionRepository

class CrearApelacionExternaUseCase(
    private val repository: ApelacionRepository
) {
    suspend operator fun invoke(request: RegistrarApelacionExterna): Apelacion {
        require(request.ciudadanoId.isNotBlank()) { "No se encontró el ciudadano autenticado" }
        require(!request.entidadId.isNullOrBlank()) { "Seleccione la entidad pública" }
        require(request.numeroSolicitudExterna.isNotBlank()) { "Ingrese el número de solicitud externa" }
        require(request.fechaPresentacionSolicitudExterna.isNotBlank()) { "Ingrese la fecha de presentación de la solicitud" }
        require(request.resumenSolicitudOriginal.isNotBlank()) { "Ingrese el resumen de la solicitud original" }
        require(request.referenciaDocumentoSolicitud.isNotBlank()) { "Ingrese la referencia del documento de solicitud" }
        require(request.fundamentos.isNotBlank()) { "Ingrese los fundamentos de la apelación" }

        when (request.tipoDenegatoria) {
            TipoDenegatoria.EXPRESA -> require(
                !request.resumenRespuestaEntidad.isNullOrBlank() ||
                    !request.referenciaRespuestaEntidad.isNullOrBlank()
            ) { "Registre el resumen o la referencia de la respuesta de la entidad" }

            TipoDenegatoria.TACITA -> require(!request.evidenciaSilencioAdministrativo.isNullOrBlank()) {
                "Registre la evidencia o declaración de silencio administrativo"
            }
        }

        return repository.crearApelacionExterna(request)
    }
}

class CrearApelacionAnteEntidadUseCase(
    private val repository: ApelacionRepository
) {
    suspend operator fun invoke(request: RegistrarApelacionAnteEntidad): Apelacion {
        require(request.solicitudId.isNotBlank()) { "No se encontró la SAIP local seleccionada" }
        require(request.ciudadanoId.isNotBlank()) { "No se encontró el ciudadano autenticado" }
        require(request.fundamentos.isNotBlank()) { "Ingrese los fundamentos de la apelación" }
        require(request.fechaPresentacionAnteEntidad.isNotBlank()) { "Ingrese la fecha de presentación ante entidad" }
        require(request.referenciaCargoPresentacion.isNotBlank()) { "Ingrese la referencia del cargo de presentación" }
        return repository.crearApelacionAnteEntidad(request)
    }
}

class GetElevacionApelacionUseCase(
    private val repository: ApelacionRepository
) {
    suspend operator fun invoke(apelacionId: String): ElevacionApelacion {
        require(apelacionId.isNotBlank()) { "No se encontró la apelación" }
        return repository.getElevacion(apelacionId)
    }
}

class GetPendientesElevacionEntidadUseCase(
    private val repository: ApelacionRepository
) {
    suspend operator fun invoke(entidadId: String): List<ElevacionApelacion> {
        require(entidadId.isNotBlank()) { "No se encontró la entidad autenticada" }
        return repository.getPendientesElevacionEntidad(entidadId)
    }
}

class ElevarApelacionUseCase(
    private val repository: ApelacionRepository
) {
    suspend operator fun invoke(
        apelacionId: String,
        request: RegistrarElevacionApelacion
    ): Apelacion {
        require(apelacionId.isNotBlank()) { "No se encontró la apelación" }
        require(request.responsableEntidad.isNotBlank()) { "Ingrese el responsable institucional" }
        require(request.referenciaExpedienteElevado.isNotBlank()) { "Ingrese la referencia del expediente remitido" }
        return repository.elevarApelacion(apelacionId, request)
    }
}

class ComunicarOmisionElevacionUseCase(
    private val repository: ApelacionRepository
) {
    suspend operator fun invoke(
        apelacionId: String,
        request: ComunicarOmisionElevacion
    ): ElevacionApelacion {
        require(apelacionId.isNotBlank()) { "No se encontró la apelación" }
        require(request.referenciaPruebaOmision.isNotBlank()) { "Ingrese la prueba o referencia de la omisión" }
        return repository.comunicarOmisionElevacion(apelacionId, request)
    }
}
