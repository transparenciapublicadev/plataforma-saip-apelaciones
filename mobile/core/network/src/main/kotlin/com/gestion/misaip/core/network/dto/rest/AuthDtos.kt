package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.TipoUsuario
import com.gestion.misaip.core.domain.model.Usuario
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// =============================================
// REQUEST DTOs — Enviados al backend
// =============================================

@Serializable
data class LoginRequest(
    val identificador: String,
    val password: String
)

@Serializable
data class RegistroRequest(
    val email: String,
    val password: String,
    val dni: String,
    val nombreCompleto: String,
    val telefono: String? = null,
    val direccion: String? = null
)

@Serializable
data class VerificarDniRequest(
    val dni: String
)

@Serializable
data class VerificarEmailRequest(
    val email: String
)

// =============================================
// RESPONSE DTOs — Recibidos del backend
// =============================================

@Serializable
data class AuthResponse(
    val success: Boolean? = null,
    val token: String? = null,
    @SerialName("usuarioId") val usuarioId: Long? = null,
    val email: String? = null,
    @SerialName("tipoUsuario") val tipoUsuario: String? = null,
    val nombre: String? = null,
    val dni: String? = null,
    val ciudadanoId: Long? = null,
    val funcionarioId: Long? = null,
    val entidadId: Long? = null,
    val entidadNombre: String? = null,
    val cargo: String? = null,
    val miembroId: Long? = null,
    val administradorId: Long? = null,
    val redirectUrl: String? = null,
    val mensaje: String? = null
) {
    fun toDomain(): Usuario {
        return Usuario(
            id = usuarioId?.toString() ?: "",
            tipo = TipoUsuario.fromString(tipoUsuario ?: "CIUDADANO"),
            nombre = nombre ?: "",
            email = email,
            dni = dni,
            entidadId = entidadId?.toString(),
            cargo = cargo,
            entidad = entidadNombre,
            fechaRegistro = System.currentTimeMillis()
        )
    }
}

@Serializable
data class CiudadanoResponse(
    val id: Long? = null,
    val dni: String? = null,
    val nombreCompleto: String? = null,
    val email: String? = null,
    val telefono: String? = null,
    val direccion: String? = null,
    val fechaRegistro: String? = null,
    val activo: Boolean? = null,
    val totalSolicitudes: Long? = null,
    val solicitudesEnProceso: Long? = null,
    val solicitudesRespondidas: Long? = null,
    val apelacionesRealizadas: Long? = null
) {
    fun toDomain(): Usuario {
        return Usuario(
            id = id?.toString() ?: "",
            tipo = TipoUsuario.CIUDADANO,
            nombre = nombreCompleto ?: "",
            dni = dni,
            email = email,
            telefono = telefono,
            direccion = direccion,
            fechaRegistro = 0L
        )
    }
}
