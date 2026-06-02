package com.gestion.misaip.core.domain.usecase.notificacion

import com.gestion.misaip.core.domain.model.AppFlavorPush
import com.gestion.misaip.core.domain.model.PlataformaPush
import com.gestion.misaip.core.domain.model.RegistrarDispositivoPush
import com.gestion.misaip.core.domain.model.RevocarDispositivoPushActual
import com.gestion.misaip.core.domain.repository.DispositivoPushRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Test

class DispositivoPushUseCasesTest {

    private val repository: DispositivoPushRepository = mockk()

    @Test
    fun `registro delega token opaco y metadatos tecnicos al repositorio`() = runTest {
        val request = RegistrarDispositivoPush(
            token = "fake-fcm-token-for-mobile-unit-test",
            appFlavor = AppFlavorPush.CIUDADANO,
            plataforma = PlataformaPush.ANDROID,
            deviceIdHash = "a".repeat(64),
            appVersion = "1.0.0",
            buildType = "debug"
        )
        coEvery { repository.registrar(request) } returns mockk()

        RegistrarDispositivoPushUseCase(repository)(request)

        coVerify(exactly = 1) { repository.registrar(request) }
    }

    @Test
    fun `logout delega revocacion del dispositivo actual`() = runTest {
        val request = RevocarDispositivoPushActual("b".repeat(64))
        coEvery { repository.revocarActual(request) } returns Unit

        RevocarDispositivoPushActualUseCase(repository)(request)

        coVerify(exactly = 1) { repository.revocarActual(request) }
    }
}
