package com.gestion.misaip.core.domain.model

data class RegistrarDispositivoPush(
    val token: String,
    val appFlavor: AppFlavorPush,
    val plataforma: PlataformaPush = PlataformaPush.ANDROID,
    val deviceIdHash: String,
    val appVersion: String?,
    val buildType: String?
)

data class RevocarDispositivoPushActual(
    val deviceIdHash: String
)

data class DispositivoPush(
    val id: Long,
    val tipoUsuario: String,
    val appFlavor: AppFlavorPush,
    val plataforma: PlataformaPush,
    val tokenFingerprint: String,
    val deviceFingerprint: String,
    val estado: EstadoDispositivoPush,
    val appVersion: String?,
    val buildType: String?
)

data class EstadoProveedorPush(
    val proveedor: String,
    val estado: String,
    val configurable: Boolean,
    val credencialesExternasConfiguradas: Boolean,
    val cifradoTokenConfigurado: Boolean,
    val nota: String
)

enum class AppFlavorPush {
    CIUDADANO,
    FUNCIONARIO,
    TTAIP
}

enum class PlataformaPush {
    ANDROID
}

enum class EstadoDispositivoPush {
    ACTIVO,
    REVOCADO,
    EXPIRADO
}
