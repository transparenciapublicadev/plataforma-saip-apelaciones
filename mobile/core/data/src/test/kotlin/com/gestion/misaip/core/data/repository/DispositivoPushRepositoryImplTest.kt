package com.gestion.misaip.core.data.repository

import com.gestion.misaip.core.domain.model.AppFlavorPush
import com.gestion.misaip.core.domain.model.PlataformaPush
import com.gestion.misaip.core.domain.model.RegistrarDispositivoPush
import com.gestion.misaip.core.network.datasource.DispositivoPushRemoteDataSource
import com.gestion.misaip.core.network.dto.rest.DispositivoPushRestDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class DispositivoPushRepositoryImplTest {

    private val remoteDataSource: DispositivoPushRemoteDataSource = mockk()
    private val repository = DispositivoPushRepositoryImpl(remoteDataSource)

    @Test
    fun `registro conserva flavor y nunca simula exito local`() = runTest {
        val request = RegistrarDispositivoPush(
            token = "fake-fcm-token-for-repository-test",
            appFlavor = AppFlavorPush.TTAIP,
            plataforma = PlataformaPush.ANDROID,
            deviceIdHash = "c".repeat(64),
            appVersion = "1.0.0",
            buildType = "debug"
        )
        coEvery { remoteDataSource.registrar(any()) } returns DispositivoPushRestDto(
            id = 9,
            tipoUsuario = "TTAIP",
            appFlavor = "TTAIP",
            plataforma = "ANDROID",
            tokenFingerprint = "123456789abc",
            deviceFingerprint = "abcdef123456",
            estado = "ACTIVO"
        )

        val dispositivo = repository.registrar(request)

        assertEquals(AppFlavorPush.TTAIP, dispositivo.appFlavor)
        coVerify(exactly = 1) {
            remoteDataSource.registrar(match { it.token == request.token && it.deviceIdHash == request.deviceIdHash })
        }
    }
}
