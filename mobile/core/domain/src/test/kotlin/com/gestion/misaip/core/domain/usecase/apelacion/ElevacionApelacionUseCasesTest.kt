package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.ComunicarOmisionElevacion
import com.gestion.misaip.core.domain.model.RegistrarApelacionAnteEntidad
import com.gestion.misaip.core.domain.model.RegistrarApelacionExterna
import com.gestion.misaip.core.domain.model.RegistrarElevacionApelacion
import com.gestion.misaip.core.domain.model.TipoDenegatoria
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ElevacionApelacionUseCasesTest {

    private val repository: ApelacionRepository = mockk()

    @Test
    fun `apelacion externa expresa exige respuesta de entidad`() {
        val useCase = CrearApelacionExternaUseCase(repository)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            kotlinx.coroutines.runBlocking {
                useCase(externa(tipoDenegatoria = TipoDenegatoria.EXPRESA))
            }
        }

        assertEquals("Registre el resumen o la referencia de la respuesta de la entidad", exception.message)
    }

    @Test
    fun `apelacion externa tacita exige evidencia de silencio`() {
        val useCase = CrearApelacionExternaUseCase(repository)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            kotlinx.coroutines.runBlocking {
                useCase(externa(tipoDenegatoria = TipoDenegatoria.TACITA))
            }
        }

        assertEquals("Registre la evidencia o declaración de silencio administrativo", exception.message)
    }

    @Test
    fun `apelacion externa valida se envia al repositorio`() = runTest {
        val request = externa(
            tipoDenegatoria = TipoDenegatoria.TACITA,
            evidenciaSilencio = "Cargo sin respuesta dentro del plazo"
        )
        val apelacion = mockk<Apelacion>()
        coEvery { repository.crearApelacionExterna(request) } returns apelacion

        assertEquals(apelacion, CrearApelacionExternaUseCase(repository)(request))
        coVerify(exactly = 1) { repository.crearApelacionExterna(request) }
    }

    @Test
    fun `presentacion ante entidad exige cargo`() {
        val useCase = CrearApelacionAnteEntidadUseCase(repository)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            kotlinx.coroutines.runBlocking {
                useCase(
                    RegistrarApelacionAnteEntidad(
                        solicitudId = "42",
                        ciudadanoId = "20",
                        fundamentos = "Denegatoria expresa",
                        fechaPresentacionAnteEntidad = "2026-06-02",
                        referenciaCargoPresentacion = "",
                        observacion = null
                    )
                )
            }
        }

        assertEquals("Ingrese la referencia del cargo de presentación", exception.message)
    }

    @Test
    fun `elevacion exige referencia de expediente remitido`() {
        val useCase = ElevarApelacionUseCase(repository)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            kotlinx.coroutines.runBlocking {
                useCase("7", RegistrarElevacionApelacion("Funcionario", "", null))
            }
        }

        assertEquals("Ingrese la referencia del expediente remitido", exception.message)
    }

    @Test
    fun `comunicacion de omision exige prueba`() {
        val useCase = ComunicarOmisionElevacionUseCase(repository)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            kotlinx.coroutines.runBlocking {
                useCase("7", ComunicarOmisionElevacion("", null))
            }
        }

        assertEquals("Ingrese la prueba o referencia de la omisión", exception.message)
    }

    private fun externa(
        tipoDenegatoria: TipoDenegatoria,
        evidenciaSilencio: String? = null
    ) = RegistrarApelacionExterna(
        ciudadanoId = "20",
        entidadId = "10",
        numeroSolicitudExterna = "MP-EXT-2026-001",
        fechaPresentacionSolicitudExterna = "2026-05-01",
        tipoDenegatoria = tipoDenegatoria,
        fechaRespuestaEntidad = null,
        resumenSolicitudOriginal = "Solicitud presentada fuera de plataforma",
        resumenRespuestaEntidad = null,
        referenciaDocumentoSolicitud = "DOC-SAIP-001",
        referenciaCargoRecepcion = "CARGO-001",
        referenciaRespuestaEntidad = null,
        evidenciaSilencioAdministrativo = evidenciaSilencio,
        fundamentos = "Se solicita revisar la denegatoria",
        observacion = null
    )
}
