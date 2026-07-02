package com.gestion.misaip.core.domain.model

/**
 * Modelo de Dominio: Seguimiento de Plazo Legal
 */
data class PlazoSeguimiento(
    val fechaRegistro: String,
    val fechaVencimiento: String,
    val diasRestantes: Long,
    val enSilencioAdministrativo: Boolean
)
