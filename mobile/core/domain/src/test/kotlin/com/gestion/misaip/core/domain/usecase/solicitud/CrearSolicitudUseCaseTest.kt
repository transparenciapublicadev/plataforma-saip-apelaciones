package com.gestion.misaip.core.domain.usecase.solicitud

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class CrearSolicitudUseCaseTest {

    private val solicitudRepository: SolicitudRepository = mockk()
    private lateinit var useCase: CrearSolicitudUseCase

    private val solicitante = Solicitante("Juan", "12345678", "juan@mail.com")

    private fun crearParams(
        asunto: String = "Solicito información pública",
        descripcion: String = "Descripción de la solicitud",
        entidadId: String = "ent-1",
        consentimientoDatosPersonales: Boolean = true,
        canalNotificacion: CanalNotificacion? = CanalNotificacion.CORREO_ELECTRONICO
    ) = CrearSolicitudUseCase.Params(
        tipo = TipoSolicitud.ACCESO_INFORMACION,
        entidad = "Ministerio de Justicia",
        entidadId = entidadId,
        usuarioId = "usr-1",
        solicitante = solicitante,
        asunto = asunto,
        descripcion = descripcion,
        consentimientoDatosPersonales = consentimientoDatosPersonales,
        canalNotificacion = canalNotificacion
    )

    @Before
    fun setup() {
        useCase = CrearSolicitudUseCase(solicitudRepository)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `lanza excepcion cuando asunto esta vacio`() = runTest {
        useCase(crearParams(asunto = ""))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `lanza excepcion cuando descripcion esta vacia`() = runTest {
        useCase(crearParams(descripcion = ""))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `lanza excepcion cuando entidadId esta vacia`() = runTest {
        useCase(crearParams(entidadId = ""))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `lanza excepcion cuando descripcion excede 2000 caracteres`() = runTest {
        useCase(crearParams(descripcion = "a".repeat(2001)))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `lanza excepcion cuando no acepta tratamiento de datos personales`() = runTest {
        useCase(crearParams(consentimientoDatosPersonales = false))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `lanza excepcion cuando no selecciona canal de notificacion`() = runTest {
        useCase(crearParams(canalNotificacion = null))
    }

    @Test
    fun `crea solicitud con estado RECEPCIONADA`() = runTest {
        val slot = slot<Solicitud>()
        coEvery { solicitudRepository.crearSolicitud(capture(slot)) } answers { slot.captured }

        val result = useCase(crearParams())

        assertEquals(EstadoSolicitud.RECEPCIONADA, result.estado)
        assertEquals(Prioridad.MEDIA, result.prioridad)
        assertEquals("Solicito información pública", result.asunto)
        assertTrue(result.consentimientoDatosPersonales)
        assertEquals(CanalNotificacion.CORREO_ELECTRONICO, result.canalNotificacion)
        assertTrue(result.timeline.isNotEmpty())
        coVerify { solicitudRepository.crearSolicitud(any()) }
    }

    @Test
    fun `solicitud creada tiene timeline con evento de recepcion`() = runTest {
        val slot = slot<Solicitud>()
        coEvery { solicitudRepository.crearSolicitud(capture(slot)) } answers { slot.captured }

        useCase(crearParams())

        val primerEvento = slot.captured.timeline.first()
        assertEquals("Solicitud recepcionada", primerEvento.evento)
        assertEquals("recepcion", primerEvento.tipo)
        assertTrue(primerEvento.completado)
    }
}

class ResponderSolicitudUseCaseTest {

    private val solicitudRepository: SolicitudRepository = mockk()
    private lateinit var useCase: ResponderSolicitudUseCase

    @Before
    fun setup() {
        useCase = ResponderSolicitudUseCase(solicitudRepository)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `lanza excepcion cuando expediente esta vacio`() = runTest {
        val params = ResponderSolicitudUseCase.Params(
            expediente = "",
            funcionario = "func-1",
            tipoRespuesta = TipoRespuesta.ENTREGA_TOTAL,
            fundamentacion = "Se entrega la información"
        )
        useCase(params)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `lanza excepcion cuando fundamentacion esta vacia`() = runTest {
        val params = ResponderSolicitudUseCase.Params(
            expediente = "SAIP-2025-00001",
            funcionario = "func-1",
            tipoRespuesta = TipoRespuesta.ENTREGA_TOTAL,
            fundamentacion = ""
        )
        useCase(params)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `lanza excepcion cuando tipo respuesta es silencio administrativo`() = runTest {
        val params = ResponderSolicitudUseCase.Params(
            expediente = "SAIP-2025-00001",
            funcionario = "func-1",
            tipoRespuesta = TipoRespuesta.SILENCIO_ADMINISTRATIVO,
            fundamentacion = "Plazo vencido"
        )
        useCase(params)
    }

    @Test
    fun `responde solicitud con datos validos`() = runTest {
        val expected = RespuestaEntidad(
            id = "31",
            fechaRespuesta = 1L,
            funcionario = "func-1",
            tipo = TipoRespuesta.ENTREGA_TOTAL,
            fundamentacion = "Se entrega toda la información solicitada"
        )
        coEvery { solicitudRepository.responderSolicitud(any(), any()) } returns expected

        val params = ResponderSolicitudUseCase.Params(
            expediente = "SAIP-2025-00001",
            funcionario = "func-1",
            tipoRespuesta = TipoRespuesta.ENTREGA_TOTAL,
            fundamentacion = "Se entrega toda la información solicitada"
        )
        val result = useCase(params)

        assertEquals(expected, result)
        coVerify { solicitudRepository.responderSolicitud(eq("SAIP-2025-00001"), any()) }
    }
}
