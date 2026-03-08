package com.gestion.misaip.core.domain.usecase.solicitud

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.SolicitudEstadisticas
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import io.mockk.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class GetSolicitudesUseCaseTest {

    private val solicitudRepository: SolicitudRepository = mockk()

    private val solicitudEjemplo = Solicitud(
        id = "sol-1",
        expediente = "SAIP-2025-00001",
        tipo = TipoSolicitud.ACCESO_INFORMACION,
        entidad = "Ministerio de Justicia",
        entidadId = "ent-1",
        usuarioId = "usr-1",
        solicitante = Solicitante("Juan", "12345678", "juan@mail.com"),
        asunto = "Info pública",
        descripcion = "Solicito info",
        fechaCreacion = 1700000000000L,
        fechaLimite = 1701000000000L,
        estado = EstadoSolicitud.RECEPCIONADA
    )

    @Test
    fun `getTodasLasSolicitudes retorna lista desde repositorio`() = runTest {
        val useCase = GetTodasLasSolicitudesUseCase(solicitudRepository)
        every { solicitudRepository.getTodasLasSolicitudes() } returns flowOf(listOf(solicitudEjemplo))

        val result = useCase().first()
        assertEquals(1, result.size)
        assertEquals("SAIP-2025-00001", result[0].expediente)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `getSolicitudesUsuario lanza excepcion con userId vacio`() = runTest {
        val useCase = GetSolicitudesUsuarioUseCase(solicitudRepository)
        useCase("")
    }

    @Test
    fun `getSolicitudesUsuario retorna solicitudes del usuario`() = runTest {
        val useCase = GetSolicitudesUsuarioUseCase(solicitudRepository)
        every { solicitudRepository.getSolicitudesUsuario("usr-1") } returns flowOf(listOf(solicitudEjemplo))

        val result = useCase("usr-1").first()
        assertEquals(1, result.size)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `getSolicitudPorExpediente lanza excepcion con expediente vacio`() = runTest {
        val useCase = GetSolicitudPorExpedienteUseCase(solicitudRepository)
        useCase("")
    }

    @Test
    fun `getSolicitudPorExpediente retorna solicitud`() = runTest {
        val useCase = GetSolicitudPorExpedienteUseCase(solicitudRepository)
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-00001") } returns flowOf(solicitudEjemplo)

        val result = useCase("SAIP-2025-00001").first()
        assertNotNull(result)
        assertEquals("SAIP-2025-00001", result?.expediente)
    }

    @Test
    fun `getEstadisticas retorna estadisticas`() = runTest {
        val useCase = GetEstadisticasSolicitudesUseCase(solicitudRepository)
        val stats = SolicitudEstadisticas(total = 10, enProceso = 3, respondidas = 5, denegadas = 1, vencidas = 1)
        every { solicitudRepository.getEstadisticas("usr-1") } returns flowOf(stats)

        val result = useCase("usr-1").first()
        assertEquals(10, result.total)
        assertEquals(3, result.enProceso)
    }
}

class SolicitudEntidadUseCasesTest {

    private val solicitudRepository: SolicitudRepository = mockk()

    private val solicitudRecepcionada = Solicitud(
        id = "sol-1",
        expediente = "SAIP-2025-00001",
        tipo = TipoSolicitud.ACCESO_INFORMACION,
        entidad = "Ministerio de Justicia",
        entidadId = "ent-1",
        usuarioId = "usr-1",
        solicitante = Solicitante("Juan", "12345678", "juan@mail.com"),
        asunto = "Info pública",
        descripcion = "Solicito info",
        fechaCreacion = 1700000000000L,
        fechaLimite = 1701000000000L,
        estado = EstadoSolicitud.RECEPCIONADA
    )

    @Test(expected = IllegalArgumentException::class)
    fun `getSolicitudesEntidad lanza excepcion con entidadId vacio`() = runTest {
        val useCase = GetSolicitudesEntidadUseCase(solicitudRepository)
        useCase("")
    }

    @Test
    fun `getSolicitudesEntidad retorna solicitudes de la entidad`() = runTest {
        val useCase = GetSolicitudesEntidadUseCase(solicitudRepository)
        every { solicitudRepository.getSolicitudesEntidad("ent-1") } returns flowOf(listOf(solicitudRecepcionada))

        val result = useCase("ent-1").first()
        assertEquals(1, result.size)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `iniciarRevision lanza excepcion con expediente vacio`() = runTest {
        val useCase = IniciarRevisionUseCase(solicitudRepository)
        useCase("")
    }

    @Test
    fun `iniciarRevision lanza excepcion cuando solicitud no existe`() = runTest {
        val useCase = IniciarRevisionUseCase(solicitudRepository)
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-99999") } returns flowOf(null)

        try {
            useCase("SAIP-2025-99999")
            fail("Debió lanzar excepción")
        } catch (e: IllegalStateException) {
            assertTrue(e.message!!.contains("No se encontró"))
        }
    }

    @Test
    fun `iniciarRevision lanza excepcion cuando estado no es RECEPCIONADA`() = runTest {
        val useCase = IniciarRevisionUseCase(solicitudRepository)
        val solEnRevision = solicitudRecepcionada.copy(estado = EstadoSolicitud.EN_REVISION)
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-00001") } returns flowOf(solEnRevision)

        try {
            useCase("SAIP-2025-00001")
            fail("Debió lanzar excepción")
        } catch (e: IllegalStateException) {
            assertTrue(e.message!!.contains("Solo se puede iniciar revisión"))
        }
    }

    @Test
    fun `iniciarRevision actualiza estado a EN_REVISION`() = runTest {
        val useCase = IniciarRevisionUseCase(solicitudRepository)
        every { solicitudRepository.getSolicitudPorExpediente("SAIP-2025-00001") } returns flowOf(solicitudRecepcionada)
        val slot = slot<Solicitud>()
        coEvery { solicitudRepository.actualizarSolicitud(capture(slot)) } just Runs

        useCase("SAIP-2025-00001")

        assertEquals(EstadoSolicitud.EN_REVISION, slot.captured.estado)
        assertTrue(slot.captured.timeline.any { it.evento.contains("revisión") })
        coVerify { solicitudRepository.actualizarSolicitud(any()) }
    }
}
