package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import io.mockk.*
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class CrearApelacionUseCaseTest {

    private val apelacionRepository: ApelacionRepository = mockk()
    private val solicitudRepository: SolicitudRepository = mockk()
    private lateinit var useCase: CrearApelacionUseCase

    private val apelante = Apelante("Juan", "12345678", "juan@mail.com")
    private val solicitante = Solicitante("Juan", "12345678", "juan@mail.com")

    private val solicitudApelable = Solicitud(
        id = "sol-1",
        expediente = "SAIP-2025-00001",
        tipo = TipoSolicitud.ACCESO_INFORMACION,
        entidad = "Ministerio de Justicia",
        entidadId = "ent-1",
        usuarioId = "usr-1",
        solicitante = solicitante,
        asunto = "Información pública",
        descripcion = "Solicito información",
        fechaCreacion = 1700000000000L,
        fechaLimite = 1701000000000L,
        estado = EstadoSolicitud.DENEGADA
    )

    private fun crearParams(
        fundamentoLegal: String = "Art. 11 Ley 27806",
        exposicionHechos: String = "Los hechos ocurrieron...",
        pretension: String = "Solicito entrega de información",
        expedienteSAIP: String = "SAIP-2025-00001",
        usuarioId: String = "usr-1"
    ) = CrearApelacionUseCase.Params(
        expedienteSAIP = expedienteSAIP,
        usuarioId = usuarioId,
        apelante = apelante,
        fundamentoLegal = fundamentoLegal,
        exposicionHechos = exposicionHechos,
        pretension = pretension
    )

    @Before
    fun setup() {
        useCase = CrearApelacionUseCase(apelacionRepository, solicitudRepository)
    }

    @Test
    fun `retorna error cuando fundamentoLegal esta vacio`() = runTest {
        val result = useCase(crearParams(fundamentoLegal = ""))
        assertTrue(result is CrearApelacionUseCase.Result.Error)
        assertEquals("El fundamento legal es obligatorio", (result as CrearApelacionUseCase.Result.Error).mensaje)
    }

    @Test
    fun `retorna error cuando exposicionHechos esta vacia`() = runTest {
        val result = useCase(crearParams(exposicionHechos = ""))
        assertTrue(result is CrearApelacionUseCase.Result.Error)
        assertEquals("La exposición de hechos es obligatoria", (result as CrearApelacionUseCase.Result.Error).mensaje)
    }

    @Test
    fun `retorna error cuando pretension esta vacia`() = runTest {
        val result = useCase(crearParams(pretension = ""))
        assertTrue(result is CrearApelacionUseCase.Result.Error)
        assertEquals("La pretensión es obligatoria", (result as CrearApelacionUseCase.Result.Error).mensaje)
    }

    @Test
    fun `retorna error cuando solicitud no existe`() = runTest {
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-00001") } returns flowOf(null)

        val result = useCase(crearParams())
        assertTrue(result is CrearApelacionUseCase.Result.Error)
        assertTrue((result as CrearApelacionUseCase.Result.Error).mensaje.contains("No se encontró"))
    }

    @Test
    fun `retorna error cuando solicitud no puede ser apelada`() = runTest {
        val solicitudNoApelable = solicitudApelable.copy(estado = EstadoSolicitud.RECEPCIONADA)
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-00001") } returns flowOf(solicitudNoApelable)

        val result = useCase(crearParams())
        assertTrue(result is CrearApelacionUseCase.Result.Error)
        assertTrue((result as CrearApelacionUseCase.Result.Error).mensaje.contains("no puede ser apelada"))
    }

    @Test
    fun `retorna error cuando usuario no es dueno de la solicitud`() = runTest {
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-00001") } returns flowOf(solicitudApelable)

        val result = useCase(crearParams(usuarioId = "otro-usuario"))
        assertTrue(result is CrearApelacionUseCase.Result.Error)
        assertTrue((result as CrearApelacionUseCase.Result.Error).mensaje.contains("Solo puede apelar sus propias"))
    }

    @Test
    fun `retorna error cuando ya existe apelacion para la solicitud`() = runTest {
        val apelacionExistente = mockk<Apelacion> {
            every { expediente } returns "01560-2025-JUS/TTAIP"
        }
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-00001") } returns flowOf(solicitudApelable)
        every { apelacionRepository.getApelacionPorSAIP("SAIP-2025-00001") } returns flowOf(apelacionExistente)

        val result = useCase(crearParams())
        assertTrue(result is CrearApelacionUseCase.Result.Error)
        assertTrue((result as CrearApelacionUseCase.Result.Error).mensaje.contains("Ya existe una apelación"))
    }

    @Test
    fun `retorna success cuando todos los datos son validos`() = runTest {
        val apelacionCreada = mockk<Apelacion>()
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-00001") } returns flowOf(solicitudApelable)
        every { apelacionRepository.getApelacionPorSAIP("SAIP-2025-00001") } returns flowOf(null)
        coEvery { apelacionRepository.crearApelacion(any()) } returns apelacionCreada

        val result = useCase(crearParams())
        assertTrue(result is CrearApelacionUseCase.Result.Success)
        assertEquals(apelacionCreada, (result as CrearApelacionUseCase.Result.Success).apelacion)
        coVerify { apelacionRepository.crearApelacion(any()) }
    }

    @Test
    fun `retorna error cuando repositorio lanza excepcion`() = runTest {
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-00001") } returns flowOf(solicitudApelable)
        every { apelacionRepository.getApelacionPorSAIP("SAIP-2025-00001") } returns flowOf(null)
        coEvery { apelacionRepository.crearApelacion(any()) } throws RuntimeException("Error de red")

        val result = useCase(crearParams())
        assertTrue(result is CrearApelacionUseCase.Result.Error)
        assertEquals("Error de red", (result as CrearApelacionUseCase.Result.Error).mensaje)
    }

    @Test
    fun `apelacion creada entra a primera calificacion`() = runTest {
        val slot = slot<Apelacion>()
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-00001") } returns flowOf(solicitudApelable)
        every { apelacionRepository.getApelacionPorSAIP("SAIP-2025-00001") } returns flowOf(null)
        coEvery { apelacionRepository.crearApelacion(capture(slot)) } answers { slot.captured }

        val result = useCase(crearParams())
        assertTrue(result is CrearApelacionUseCase.Result.Success)
        assertEquals(EstadoApelacion.EN_CALIFICACION_1, slot.captured.estado)
        assertEquals("Ministerio de Justicia", slot.captured.entidad)
        assertTrue(slot.captured.timeline.isNotEmpty())
    }
}
