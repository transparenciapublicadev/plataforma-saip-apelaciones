package com.gestion.misaip.core.network.dto.rest

import kotlinx.serialization.Serializable

@Serializable
data class RegistrarDispositivoPushRestRequest(
    val token: String,
    val appFlavor: String,
    val plataforma: String,
    val deviceIdHash: String,
    val appVersion: String?,
    val buildType: String?
)

@Serializable
data class RevocarDispositivoPushActualRestRequest(
    val deviceIdHash: String
)

@Serializable
data class DispositivoPushRestDto(
    val id: Long,
    val tipoUsuario: String,
    val appFlavor: String,
    val plataforma: String,
    val tokenFingerprint: String,
    val deviceFingerprint: String,
    val estado: String,
    val appVersion: String? = null,
    val buildType: String? = null
)

@Serializable
data class EstadoProveedorPushRestDto(
    val proveedor: String,
    val estado: String,
    val configurable: Boolean,
    val credencialesExternasConfiguradas: Boolean,
    val cifradoTokenConfigurado: Boolean,
    val nota: String
)
