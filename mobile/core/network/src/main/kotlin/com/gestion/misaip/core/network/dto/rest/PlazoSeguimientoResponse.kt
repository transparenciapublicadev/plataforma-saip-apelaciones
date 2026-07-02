package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.PlazoSeguimiento
import kotlinx.serialization.Serializable

@Serializable
data class PlazoSeguimientoResponse(
    val fechaRegistro: String,
    val fechaVencimiento: String,
    val diasRestantes: Long,
    val enSilencioAdministrativo: Boolean
) {
    fun toDomain() = PlazoSeguimiento(
        fechaRegistro = fechaRegistro,
        fechaVencimiento = fechaVencimiento,
        diasRestantes = diasRestantes,
        enSilencioAdministrativo = enSilencioAdministrativo
    )
}
