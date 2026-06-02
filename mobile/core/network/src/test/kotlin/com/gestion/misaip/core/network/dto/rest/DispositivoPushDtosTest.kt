package com.gestion.misaip.core.network.dto.rest

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DispositivoPushDtosTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `registro push incluye token flavor plataforma y hash de dispositivo`() {
        val payload = RegistrarDispositivoPushRestRequest(
            token = "fake-fcm-token-for-mobile-contract-test",
            appFlavor = "CIUDADANO",
            plataforma = "ANDROID",
            deviceIdHash = "a".repeat(64),
            appVersion = "1.0.0",
            buildType = "debug"
        )

        val serialized = json.encodeToString(payload)

        assertTrue(serialized.contains("\"token\":\"fake-fcm-token-for-mobile-contract-test\""))
        assertTrue(serialized.contains("\"appFlavor\":\"CIUDADANO\""))
        assertTrue(serialized.contains("\"plataforma\":\"ANDROID\""))
        assertTrue(serialized.contains("\"deviceIdHash\":\"${"a".repeat(64)}\""))
    }

    @Test
    fun `response push no contiene token fcm completo`() {
        val serialized = json.encodeToString(
            DispositivoPushRestDto(
                id = 1,
                tipoUsuario = "CIUDADANO",
                appFlavor = "CIUDADANO",
                plataforma = "ANDROID",
                tokenFingerprint = "123456789abc",
                deviceFingerprint = "abcdef123456",
                estado = "ACTIVO"
            )
        )

        assertFalse(serialized.contains("token-fcm-real"))
        assertTrue(serialized.contains("\"tokenFingerprint\":\"123456789abc\""))
    }
}
