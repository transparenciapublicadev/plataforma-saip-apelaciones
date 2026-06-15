package com.gestion.misaip.core.network.dto.rest

import kotlinx.serialization.Serializable

/**
 * DTO para registrar un dispositivo push.
 *
 * NOTA DE SEGURIDAD (AppSec): Este DTO debe contener únicamente datos técnicos
 * del terminal. JAMÁS debe exponer información de identidad (como usuarioId, email o DNI).
 * La vinculación al propietario del dispositivo se realiza de forma implícita y segura
 * en el backend a través del contexto de seguridad de la sesión activa.
 */
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
