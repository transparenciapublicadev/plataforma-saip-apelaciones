package com.gestion.misaip.config

import com.gestion.misaip.BuildConfig
import com.gestion.misaip.core.domain.model.TipoUsuario

/**
 * Politica central de distribucion por APK.
 *
 * Cada flavor genera un APK con un rol permitido. Esta politica evita que una
 * sesion persistida, un deep link o una pantalla compartida mezclen funciones
 * entre Ciudadano, Funcionario y TTAIP.
 */
object AppRolePolicy {
    val currentRole: TipoUsuario = runCatching {
        TipoUsuario.valueOf(BuildConfig.APP_ROLE.uppercase())
    }.getOrDefault(TipoUsuario.CIUDADANO)

    val isCitizenApp: Boolean get() = currentRole == TipoUsuario.CIUDADANO

    val allowsPublicRegistration: Boolean
        get() = BuildConfig.PUBLIC_DISTRIBUTION && currentRole == TipoUsuario.CIUDADANO

    val roleLabel: String
        get() = when (currentRole) {
            TipoUsuario.CIUDADANO -> "Ciudadano"
            TipoUsuario.FUNCIONARIO -> "Funcionario"
            TipoUsuario.TTAIP -> "TTAIP"
            TipoUsuario.ADMIN -> "Administrador"
        }

    fun isRoleAllowed(userRole: TipoUsuario): Boolean {
        return when (currentRole) {
            TipoUsuario.CIUDADANO -> userRole == TipoUsuario.CIUDADANO
            TipoUsuario.FUNCIONARIO -> userRole == TipoUsuario.FUNCIONARIO
            TipoUsuario.TTAIP -> userRole == TipoUsuario.TTAIP
            TipoUsuario.ADMIN -> false
        }
    }

    fun isRoleAllowed(userRole: String): Boolean {
        val parsedRole = runCatching {
            TipoUsuario.valueOf(userRole.uppercase())
        }.getOrNull() ?: return false
        return isRoleAllowed(parsedRole)
    }
}
