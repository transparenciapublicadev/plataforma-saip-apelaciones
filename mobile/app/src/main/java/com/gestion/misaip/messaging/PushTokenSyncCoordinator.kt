package com.gestion.misaip.messaging

import android.content.Context
import android.provider.Settings
import com.gestion.misaip.BuildConfig
import com.gestion.misaip.config.AppRolePolicy
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
    private val registrarDispositivoPushUseCase: RegistrarDispositivoPushUseCase,
    private val revocarDispositivoPushActualUseCase: RevocarDispositivoPushActualUseCase
) {

    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun registrarEnSegundoPlano(token: String) {
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

    suspend fun revocarActualSiEsPosible() {
        runCatching {
            revocarDispositivoPushActualUseCase(RevocarDispositivoPushActual(deviceIdHash()))
        }.onSuccess {
            Timber.d("Token FCM revocado en backend")
        }.onFailure { error ->
            Timber.w(error, "No se pudo revocar token FCM; el logout local continuará")
        }
    }

    private fun deviceIdHash(): String {
        val androidId = Settings.Secure.getString(appContext.contentResolver, Settings.Secure.ANDROID_ID)
            .orEmpty()
            .ifBlank { appContext.packageName }
        val digest = MessageDigest.getInstance("SHA-256").digest(androidId.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}
