package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.core.domain.model.NivelGobierno
import kotlinx.serialization.Serializable

@Serializable
data class EntidadRestDto(
    val id: Long? = null,
    val nombre: String? = null,
    val acronimo: String? = null,
    val descripcion: String? = null,
    val direccion: String? = null,
    val telefono: String? = null,
    val email: String? = null,
    val estado: String? = null,
    val activa: Boolean? = null,
    val fechaRegistro: String? = null,
    val solicitudesAsignadas: Long? = null,
    val pendientes: Long? = null,
    val respondidas: Long? = null,
    val vencidas: Long? = null,
    val tasaCumplimiento: Int? = null
) {
    fun toDomain(): EntidadPublica {
        return EntidadPublica(
            id = id?.toString() ?: "",
            nombre = nombre ?: "",
            sector = "",
            siglas = acronimo,
            direccion = direccion,
            telefono = telefono,
            email = email,
            nivelGobierno = NivelGobierno.NACIONAL,
            activa = activa ?: true
        )
    }
}
