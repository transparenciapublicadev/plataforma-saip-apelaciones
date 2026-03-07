package com.gestion.misaip.core.data.mapper

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.database.Usuario as UsuarioEntity

/**
 * Mapper bidireccional entre modelo de Dominio y Entidad de BD para Usuarios.
 */
object UsuarioMapper {

    fun toDomain(entity: UsuarioEntity): Usuario {
        return Usuario(
            id = entity.id,
            tipo = TipoUsuario.fromString(entity.tipo),
            nombre = entity.nombre,
            dni = entity.dni,
            usuario = entity.usuario,
            email = entity.email,
            telefono = entity.telefono,
            direccion = entity.direccion,
            entidad = entity.entidad,
            entidadId = entity.entidadId,
            cargo = entity.cargo,
            fechaRegistro = entity.fechaRegistro
        )
    }

    fun toEntity(domain: Usuario, passwordHash: String? = null): UsuarioEntity {
        return UsuarioEntity(
            id = domain.id,
            tipo = domain.tipo.name,
            nombre = domain.nombre,
            dni = domain.dni,
            usuario = domain.usuario,
            email = domain.email,
            telefono = domain.telefono,
            direccion = domain.direccion,
            entidad = domain.entidad,
            entidadId = domain.entidadId,
            cargo = domain.cargo,
            fechaRegistro = domain.fechaRegistro,
            passwordHash = passwordHash,
            estaActivo = true,
            sincronizado = false,
            ultimaModificacion = System.currentTimeMillis()
        )
    }
}
