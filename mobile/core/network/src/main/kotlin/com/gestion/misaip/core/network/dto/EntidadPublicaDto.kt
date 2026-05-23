package com.gestion.misaip.core.network.dto

import com.gestion.misaip.core.domain.model.*

/**
 * DTO para Entidad Pública.
 * Representa los datos provenientes del backend REST.
 */
data class EntidadPublicaDto(
    val id: String = "",
    val nombre: String = "",
    val sector: String = "",
    val siglas: String? = null,
    val ruc: String? = null,
    val direccion: String? = null,
    val telefono: String? = null,
    val email: String? = null,
    val sitioWeb: String? = null,
    val nivelGobierno: String = "NACIONAL",
    val activa: Boolean = true
) {

    fun toDomain(): EntidadPublica {
        return EntidadPublica(
            id = id,
            nombre = nombre,
            sector = sector,
            siglas = siglas,
            ruc = ruc,
            direccion = direccion,
            telefono = telefono,
            email = email,
            sitioWeb = sitioWeb,
            nivelGobierno = NivelGobierno.fromString(nivelGobierno),
            activa = activa
        )
    }

    fun toMap(): Map<String, Any?> {
        return mapOf(
            "id" to id,
            "nombre" to nombre,
            "sector" to sector,
            "siglas" to siglas,
            "ruc" to ruc,
            "direccion" to direccion,
            "telefono" to telefono,
            "email" to email,
            "sitioWeb" to sitioWeb,
            "nivelGobierno" to nivelGobierno,
            "activa" to activa
        )
    }

    companion object {
        fun fromDomain(entidad: EntidadPublica): EntidadPublicaDto {
            return EntidadPublicaDto(
                id = entidad.id,
                nombre = entidad.nombre,
                sector = entidad.sector,
                siglas = entidad.siglas,
                ruc = entidad.ruc,
                direccion = entidad.direccion,
                telefono = entidad.telefono,
                email = entidad.email,
                sitioWeb = entidad.sitioWeb,
                nivelGobierno = entidad.nivelGobierno.name,
                activa = entidad.activa
            )
        }

        fun fromMap(map: Map<String, Any?>): EntidadPublicaDto {
            return EntidadPublicaDto(
                id = map["id"] as? String ?: "",
                nombre = map["nombre"] as? String ?: "",
                sector = map["sector"] as? String ?: "",
                siglas = map["siglas"] as? String,
                ruc = map["ruc"] as? String,
                direccion = map["direccion"] as? String,
                telefono = map["telefono"] as? String,
                email = map["email"] as? String,
                sitioWeb = map["sitioWeb"] as? String,
                nivelGobierno = map["nivelGobierno"] as? String ?: "NACIONAL",
                activa = map["activa"] as? Boolean ?: true
            )
        }
    }
}
