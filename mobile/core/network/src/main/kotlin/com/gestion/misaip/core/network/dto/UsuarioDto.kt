package com.gestion.misaip.core.network.dto

import com.gestion.misaip.core.domain.model.*

/**
 * DTO para Usuario.
 * Representa los datos de usuario provenientes del backend REST.
 */
data class UsuarioDto(
    val id: String = "",
    val tipo: String = "",
    val nombre: String = "",
    val dni: String? = null,
    val usuario: String? = null,
    val email: String? = null,
    val telefono: String? = null,
    val direccion: String? = null,
    val entidad: String? = null,
    val entidadId: String? = null,
    val cargo: String? = null,
    val fechaRegistro: Long = 0,
    val passwordHash: String? = null
) {

    fun toDomain(): Usuario {
        return Usuario(
            id = id,
            tipo = TipoUsuario.fromString(tipo),
            nombre = nombre,
            dni = dni,
            usuario = usuario,
            email = email,
            telefono = telefono,
            direccion = direccion,
            entidad = entidad,
            entidadId = entidadId,
            cargo = cargo,
            fechaRegistro = fechaRegistro
        )
    }

    fun toMap(): Map<String, Any?> {
        return mapOf(
            "id" to id,
            "tipo" to tipo,
            "nombre" to nombre,
            "dni" to dni,
            "usuario" to usuario,
            "email" to email,
            "telefono" to telefono,
            "direccion" to direccion,
            "entidad" to entidad,
            "entidadId" to entidadId,
            "cargo" to cargo,
            "fechaRegistro" to fechaRegistro,
            "passwordHash" to passwordHash
        )
    }

    companion object {
        fun fromDomain(usuario: Usuario, passwordHash: String? = null): UsuarioDto {
            return UsuarioDto(
                id = usuario.id,
                tipo = usuario.tipo.name,
                nombre = usuario.nombre,
                dni = usuario.dni,
                usuario = usuario.usuario,
                email = usuario.email,
                telefono = usuario.telefono,
                direccion = usuario.direccion,
                entidad = usuario.entidad,
                entidadId = usuario.entidadId,
                cargo = usuario.cargo,
                fechaRegistro = usuario.fechaRegistro,
                passwordHash = passwordHash
            )
        }

        fun fromMap(map: Map<String, Any?>): UsuarioDto {
            return UsuarioDto(
                id = map["id"] as? String ?: "",
                tipo = map["tipo"] as? String ?: "CIUDADANO",
                nombre = map["nombre"] as? String ?: "",
                dni = map["dni"] as? String,
                usuario = map["usuario"] as? String,
                email = map["email"] as? String,
                telefono = map["telefono"] as? String,
                direccion = map["direccion"] as? String,
                entidad = map["entidad"] as? String,
                entidadId = map["entidadId"] as? String,
                cargo = map["cargo"] as? String,
                fechaRegistro = (map["fechaRegistro"] as? Number)?.toLong() ?: 0L,
                passwordHash = map["passwordHash"] as? String
            )
        }
    }
}
