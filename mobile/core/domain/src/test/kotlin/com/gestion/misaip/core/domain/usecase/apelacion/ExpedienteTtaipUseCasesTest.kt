package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.TipoSuspensionTtaip
import com.gestion.misaip.core.domain.repository.ExpedienteTtaipRepository
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertThrows
import org.junit.Test

class ExpedienteTtaipUseCasesTest {

    private val repository = mockk<ExpedienteTtaipRepository>(relaxed = true)
    private val useCase = GestionarExpedienteTtaipUseCase(repository)

    @Test
    fun `reproceso exige mismo destinatario institucional valido`() {
        assertThrows(IllegalArgumentException::class.java) {
            kotlinx.coroutines.runBlocking {
                useCase.reprocesarNotificacion("15203-2026-JUS/TTAIP", "OTRO", "No recibido", null)
            }
        }
    }

    @Test
    fun `suspension informe oral delega accion online`() = runTest {
        useCase.registrarSuspension("20", TipoSuspensionTtaip.INFORME_ORAL, "CIUDADANO", "Audiencia", "Tatiana")

        coVerify(exactly = 1) {
            repository.registrarSuspension("20", TipoSuspensionTtaip.INFORME_ORAL, match {
                it.solicitante == "CIUDADANO" && it.responsable == "Tatiana"
            })
        }
    }

    @Test
    fun `validacion manual exige sustento`() {
        assertThrows(IllegalArgumentException::class.java) {
            kotlinx.coroutines.runBlocking {
                useCase.validarNotificacion("20", "71", "Tatiana", "")
            }
        }
    }
}
