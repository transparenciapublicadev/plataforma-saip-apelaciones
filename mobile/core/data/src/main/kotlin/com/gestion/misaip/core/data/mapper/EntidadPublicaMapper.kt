package com.gestion.misaip.core.data.mapper

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.database.EntidadPublica as EntidadPublicaEntity

/**
 * Mapper bidireccional entre modelo de Dominio y Entidad de BD para Entidades Públicas.
 */
object EntidadPublicaMapper {

    fun toDomain(entity: EntidadPublicaEntity): EntidadPublica {
        return EntidadPublica(
            id = entity.id,
            nombre = entity.nombre,
            sector = entity.sector,
            siglas = entity.siglas,
            ruc = entity.ruc,
            direccion = entity.direccion,
            telefono = entity.telefono,
            email = entity.email,
            sitioWeb = entity.sitioWeb,
            nivelGobierno = NivelGobierno.fromString(entity.nivelGobierno),
            activa = entity.activa
        )
    }

    fun toEntity(domain: EntidadPublica): EntidadPublicaEntity {
        return EntidadPublicaEntity(
            id = domain.id,
            nombre = domain.nombre,
            sector = domain.sector,
            siglas = domain.siglas,
            ruc = domain.ruc,
            direccion = domain.direccion,
            telefono = domain.telefono,
            email = domain.email,
            sitioWeb = domain.sitioWeb,
            nivelGobierno = domain.nivelGobierno.name,
            activa = domain.activa,
            sincronizado = false,
            ultimaModificacion = System.currentTimeMillis()
        )
    }
}
