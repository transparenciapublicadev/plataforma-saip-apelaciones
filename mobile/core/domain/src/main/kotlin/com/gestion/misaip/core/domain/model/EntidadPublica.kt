package com.gestion.misaip.core.domain.model

/**
 * Entidad de Dominio: Entidad Pública
 *
 * Representa una entidad pública del Estado Peruano
 * a la cual se pueden dirigir solicitudes SAIP.
 *
 * Kotlin Puro - Sin dependencias de Android ni Firebase.
 */
data class EntidadPublica(
    val id: String,
    val nombre: String,
    val sector: String,
    val siglas: String? = null,
    val ruc: String? = null,
    val direccion: String? = null,
    val telefono: String? = null,
    val email: String? = null,
    val sitioWeb: String? = null,
    val nivelGobierno: NivelGobierno = NivelGobierno.NACIONAL,
    val activa: Boolean = true
)

/**
 * Niveles de gobierno.
 */
enum class NivelGobierno {
    NACIONAL,
    REGIONAL,
    LOCAL;

    companion object {
        fun fromString(value: String): NivelGobierno {
            return when (value.lowercase()) {
                "nacional" -> NACIONAL
                "regional" -> REGIONAL
                "local" -> LOCAL
                else -> NACIONAL
            }
        }
    }
}

