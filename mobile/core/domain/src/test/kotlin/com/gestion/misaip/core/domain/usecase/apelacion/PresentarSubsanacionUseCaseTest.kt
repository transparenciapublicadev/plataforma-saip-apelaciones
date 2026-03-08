package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import io.mockk.*
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class PresentarSubsanacionUseCaseTest {

    private val apelacionRepository: ApelacionRepository = mockk()
    private lateinit var useCase: PresentarSubsanacionUseCase

    private val apelante = Apelante("Juan", "12345678", "juan@mail.com")

    private val apelacionBase = Apelacion(
        id = "ape-1",
        expediente = "01560-2025-JUS/TTAIP",
        expedienteSAIP = "SAIP-2025-00001",
        usuarioId = "usr-1",
        apelante = apelante,
        entidad = "Ministerio de Justicia",
        entidadId = "ent-1",
        asunto = "Apelación",
        fundamentoLegal = "Art. 11",
        exposicionHechos = "Los hechos",
        pretension = "Entrega información",
        fechaPresentacion = 1700000000000L,
        estado = EstadoApelacion.EN_SUBSANACION
    )

    @Before
    fun setup() {
        useCase = PresentarSubsanacionUseCase(apelacionRepository)
    }

    @Test
    fun `retorna error cuando textoCorregido esta vacio`() = runTest {
        val params = PresentarSubsanacionUseCase.Params(
            expediente = "01560-2025-JUS/TTAIP",
            textoCorregido = ""
        )
        val result = useCase(params)
        assertTrue(result is PresentarSubsanacionUseCase.Result.Error)
        assertEquals("El texto corregido es obligatorio", (result as PresentarSubsanacionUseCase.Result.Error).mensaje)
    }

    @Test
    fun `retorna success cuando subsanacion es valida`() = runTest {
        coEvery { apelacionRepository.presentarSubsanacion(any(), any()) } just Runs
        every { apelacionRepository.getApelacionPorExpediente(any()) } returns flowOf(apelacionBase)

        val params = PresentarSubsanacionUseCase.Params(
            expediente = "01560-2025-JUS/TTAIP",
            textoCorregido = "Texto corregido con nueva información"
        )
        val result = useCase(params)
        assertTrue(result is PresentarSubsanacionUseCase.Result.Success)
        coVerify { apelacionRepository.presentarSubsanacion(eq("01560-2025-JUS/TTAIP"), any()) }
    }

    @Test
    fun `retorna error cuando repositorio lanza excepcion`() = runTest {
        coEvery { apelacionRepository.presentarSubsanacion(any(), any()) } throws RuntimeException("Error de red")

        val params = PresentarSubsanacionUseCase.Params(
            expediente = "01560-2025-JUS/TTAIP",
            textoCorregido = "Texto corregido"
        )
        val result = useCase(params)
        assertTrue(result is PresentarSubsanacionUseCase.Result.Error)
        assertEquals("Error de red", (result as PresentarSubsanacionUseCase.Result.Error).mensaje)
    }

    @Test
    fun `retorna error cuando apelacion actualizada no se puede obtener`() = runTest {
        coEvery { apelacionRepository.presentarSubsanacion(any(), any()) } just Runs
        every { apelacionRepository.getApelacionPorExpediente(any()) } returns flowOf(null)

        val params = PresentarSubsanacionUseCase.Params(
            expediente = "01560-2025-JUS/TTAIP",
            textoCorregido = "Texto corregido"
        )
        val result = useCase(params)
        assertTrue(result is PresentarSubsanacionUseCase.Result.Error)
        assertTrue((result as PresentarSubsanacionUseCase.Result.Error).mensaje.contains("No se pudo obtener"))
    }

    @Test
    fun `subsanacion incluye fundamentoLegal y documentos cuando se proveen`() = runTest {
        val subsanacionSlot = slot<Subsanacion>()
        coEvery { apelacionRepository.presentarSubsanacion(any(), capture(subsanacionSlot)) } just Runs
        every { apelacionRepository.getApelacionPorExpediente(any()) } returns flowOf(apelacionBase)

        val params = PresentarSubsanacionUseCase.Params(
            expediente = "01560-2025-JUS/TTAIP",
            textoCorregido = "Texto corregido",
            fundamentoLegalCorregido = "Art. 12 corregido",
            documentos = listOf("doc1.pdf", "doc2.pdf")
        )
        useCase(params)

        assertEquals("Texto corregido", subsanacionSlot.captured.textoCorregido)
        assertEquals("Art. 12 corregido", subsanacionSlot.captured.fundamentoLegalCorregido)
        assertEquals(2, subsanacionSlot.captured.documentosAdjuntos.size)
    }
}
