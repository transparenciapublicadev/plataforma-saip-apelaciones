package com.gestion.misaip.core.domain.model

/**
 * Entidad de Dominio: Usuario
 *
 * Representa un usuario del sistema SAIP.
 * Kotlin Puro - Sin dependencias de Android ni Firebase.
 */
data class Usuario(
    val id: String,
    val tipo: TipoUsuario,
    val nombre: String,
    val dni: String? = null,
    val usuario: String? = null,
    val email: String? = null,
    val telefono: String? = null,
    val direccion: String? = null,
    val entidad: String? = null,
    val entidadId: String? = null,
    val cargo: String? = null,
    val fechaRegistro: Long
) {

    /**
     * Verifica si el usuario es un ciudadano.
     */
    val esCiudadano: Boolean get() = tipo == TipoUsuario.CIUDADANO

    /**
     * Verifica si el usuario es un funcionario de entidad.
     */
    val esFuncionario: Boolean get() = tipo == TipoUsuario.FUNCIONARIO

    /**
     * Verifica si el usuario es funcionario del TTAIP.
     */
    val esTTAIP: Boolean get() = tipo == TipoUsuario.TTAIP

    /**
     * Verifica si el usuario es administrador.
     */
    val esAdmin: Boolean get() = tipo == TipoUsuario.ADMIN
}

/**
 * Tipos de usuario del sistema SAIP.
 */
enum class TipoUsuario {
    CIUDADANO,
    FUNCIONARIO,
    TTAIP,
    ADMIN;

    companion object {
        fun fromString(value: String): TipoUsuario {
            return when (value.lowercase()) {
                "ciudadano" -> CIUDADANO
                "funcionario" -> FUNCIONARIO
                "ttaip" -> TTAIP
                "admin" -> ADMIN
                else -> CIUDADANO
            }
        }
    }
}

/**
 * Datos de un solicitante (información pública).
 */
data class Solicitante(
    val nombre: String,
    val dni: String,
    val email: String,
    val telefono: String = "",
    val direccion: String = ""
)

