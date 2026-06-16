package com.gestion.misaip.messaging

import android.content.Context
import android.provider.Settings
import com.gestion.misaip.BuildConfig
import com.gestion.misaip.config.AppRolePolicy
import com.gestion.misaip.data.CredentialStorage
import com.gestion.misaip.core.domain.model.AppFlavorPush
import com.gestion.misaip.core.domain.model.RegistrarDispositivoPush
import com.gestion.misaip.core.domain.model.RevocarDispositivoPushActual
import com.gestion.misaip.core.domain.usecase.notificacion.RegistrarDispositivoPushUseCase
import com.gestion.misaip.core.domain.usecase.notificacion.RevocarDispositivoPushActualUseCase
import java.security.MessageDigest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import timber.log.Timber

class PushTokenSyncCoordinator(
    context: Context,
    private val credentialStorage: CredentialStorage,
    private val registrarDispositivoPushUseCase: RegistrarDispositivoPushUseCase,
    private val revocarDispositivoPushActualUseCase: RevocarDispositivoPushActualUseCase
) {

    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Registra el token FCM del dispositivo en segundo plano.
     *
     * NOTA DE SEGURIDAD (AppSec): El payload enviado contiene únicamente datos técnicos del terminal.
     * La vinculación con el usuario autenticado se delega de forma implícita al interceptor de red
     * que adjunta las cabeceras de autorización de la sesión activa (Bearer Token / Cookie).
     */
    fun registrarEnSegundoPlano(token: String) {
        // Guardar siempre el token más reciente en caché local (EncryptedSharedPreferences)
        credentialStorage.saveCachedFcmToken(token)

        // Si el usuario no ha iniciado sesión, no realizamos la llamada de red.
        // Se sincronizará automáticamente cuando el usuario inicie sesión.
        val sessionToken = credentialStorage.getToken()
        if (sessionToken.isNullOrBlank()) {
            Timber.d("Usuario no autenticado. Token FCM guardado en caché local para futura sincronización.")
            return
        }

        scope.launch {
            runCatching {
                registrarDispositivoPushUseCase(
                    RegistrarDispositivoPush(
                        token = token,
                        appFlavor = AppFlavorPush.valueOf(AppRolePolicy.currentRole.name),
                        deviceIdHash = deviceIdHash(),
                        appVersion = BuildConfig.VERSION_NAME,
                        buildType = BuildConfig.BUILD_TYPE
                    )
                )
            }.onSuccess {
                Timber.d("Token FCM sincronizado con backend")
            }.onFailure { error ->
                Timber.w(error, "No se pudo sincronizar token FCM; se reintentará en próxima sesión o renovación")
            }
        }
    }

    /**
     * Registra el token FCM de forma síncrona/suspendida y retorna si fue exitoso.
     */
    suspend fun registrarSincronamente(token: String): Boolean {
        val sessionToken = credentialStorage.getToken()
        if (sessionToken.isNullOrBlank()) {
            Timber.d("No hay sesión activa para sincronización síncrona.")
            return false
        }

        return runCatching {
            registrarDispositivoPushUseCase(
                RegistrarDispositivoPush(
                    token = token,
                    appFlavor = AppFlavorPush.valueOf(AppRolePolicy.currentRole.name),
                    deviceIdHash = deviceIdHash(),
                    appVersion = BuildConfig.VERSION_NAME,
                    buildType = BuildConfig.BUILD_TYPE
                )
            )
            true
        }.onSuccess {
            Timber.d("Token FCM sincronizado de forma síncrona con backend")
        }.onFailure { error ->
            Timber.w(error, "No se pudo sincronizar token FCM de forma síncrona")
        }.getOrDefault(false)
    }

    suspend fun revocarActualSiEsPosible() {
        revocarSincronamente()
    }

    /**
     * Revoca el token FCM actual en el backend de forma síncrona/suspendida.
     */
    suspend fun revocarSincronamente(): Boolean {
        return runCatching {
            revocarDispositivoPushActualUseCase(RevocarDispositivoPushActual(deviceIdHash()))
            true
        }.onSuccess {
            Timber.d("Token FCM revocado síncronamente en backend")
        }.onFailure { error ->
            Timber.w(error, "No se pudo revocar token FCM síncronamente")
        }.getOrDefault(false)
    }

    private fun deviceIdHash(): String {
        val androidId = Settings.Secure.getString(appContext.contentResolver, Settings.Secure.ANDROID_ID)
            .orEmpty()
            .ifBlank { appContext.packageName }
        val digest = MessageDigest.getInstance("SHA-256").digest(androidId.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}
