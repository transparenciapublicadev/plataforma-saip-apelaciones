package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import io.mockk.*
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class CalificarApelacionUseCaseTest {

    private val apelacionRepository: ApelacionRepository = mockk()
    private lateinit var useCase: CalificarApelacionUseCase

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
        estado = EstadoApelacion.EN_CALIFICACION_1
    )

    private fun crearParams(
        resultado: ResultadoCalificacion = ResultadoCalificacion.ADMISIBLE,
        fundamentacion: String = "Cumple requisitos formales",
        tipoCalificacion: String = "primera",
        ordenEntrega: Boolean = false,
        subsanacionRequerida: Boolean = false
    ) = CalificarApelacionUseCase.Params(
        expediente = "01560-2025-JUS/TTAIP",
        tipoCalificacion = tipoCalificacion,
        resultado = resultado,
        fundamentacion = fundamentacion,
        ordenEntrega = ordenEntrega,
        subsanacionRequerida = subsanacionRequerida
    )

    @Before
    fun setup() {
        useCase = CalificarApelacionUseCase(apelacionRepository)
    }

    @Test
    fun `retorna error cuando fundamentacion esta vacia`() = runTest {
        val result = useCase(crearParams(fundamentacion = ""))
        assertTrue(result is CalificarApelacionUseCase.Result.Error)
        assertEquals("La fundamentación es obligatoria", (result as CalificarApelacionUseCase.Result.Error).mensaje)
    }

    @Test
    fun `calificacion INADMISIBLE auto-activa subsanacionRequerida`() = runTest {
        val calificacionSlot = slot<Calificacion>()
        coEvery { apelacionRepository.calificarApelacion(any(), any(), capture(calificacionSlot)) } just Runs
        every { apelacionRepository.getApelacionPorExpediente(any()) } returns flowOf(apelacionBase)

        useCase(crearParams(resultado = ResultadoCalificacion.INADMISIBLE, subsanacionRequerida = false))

        assertTrue(calificacionSlot.captured.subsanacionRequerida)
    }

    @Test
    fun `calificacion genera cedula para ciudadano`() = runTest {
        val calificacionSlot = slot<Calificacion>()
        coEvery { apelacionRepository.calificarApelacion(any(), any(), capture(calificacionSlot)) } just Runs
        every { apelacionRepository.getApelacionPorExpediente(any()) } returns flowOf(apelacionBase)

        useCase(crearParams(resultado = ResultadoCalificacion.ADMISIBLE))

        assertNotNull(calificacionSlot.captured.cedulaNotificacionCiudadano)
        assertEquals(DestinatarioCedula.CIUDADANO, calificacionSlot.captured.cedulaNotificacionCiudadano?.destinatario)
        assertEquals(EstadoCedula.PENDIENTE, calificacionSlot.captured.cedulaNotificacionCiudadano?.estado)
    }

    @Test
    fun `calificacion con ordenEntrega genera cedula para entidad`() = runTest {
        val calificacionSlot = slot<Calificacion>()
        coEvery { apelacionRepository.calificarApelacion(any(), any(), capture(calificacionSlot)) } just Runs
        every { apelacionRepository.getApelacionPorExpediente(any()) } returns flowOf(apelacionBase)

        useCase(crearParams(resultado = ResultadoCalificacion.ADMISIBLE, ordenEntrega = true))

        assertNotNull(calificacionSlot.captured.cedulaNotificacionEntidad)
        assertEquals(DestinatarioCedula.ENTIDAD, calificacionSlot.captured.cedulaNotificacionEntidad?.destinatario)
    }

    @Test
    fun `calificacion sin ordenEntrega no genera cedula para entidad`() = runTest {
        val calificacionSlot = slot<Calificacion>()
        coEvery { apelacionRepository.calificarApelacion(any(), any(), capture(calificacionSlot)) } just Runs
        every { apelacionRepository.getApelacionPorExpediente(any()) } returns flowOf(apelacionBase)

        useCase(crearParams(resultado = ResultadoCalificacion.ADMISIBLE, ordenEntrega = false))

        assertNull(calificacionSlot.captured.cedulaNotificacionEntidad)
    }

    @Test
    fun `retorna success cuando calificacion es valida`() = runTest {
        coEvery { apelacionRepository.calificarApelacion(any(), any(), any()) } just Runs
        every { apelacionRepository.getApelacionPorExpediente(any()) } returns flowOf(apelacionBase)

        val result = useCase(crearParams())
        assertTrue(result is CalificarApelacionUseCase.Result.Success)
    }

    @Test
    fun `retorna error cuando repositorio lanza excepcion`() = runTest {
        coEvery { apelacionRepository.calificarApelacion(any(), any(), any()) } throws RuntimeException("Error de red")

        val result = useCase(crearParams())
        assertTrue(result is CalificarApelacionUseCase.Result.Error)
        assertEquals("Error de red", (result as CalificarApelacionUseCase.Result.Error).mensaje)
    }

    @Test
    fun `retorna error cuando apelacion actualizada no se puede obtener`() = runTest {
        coEvery { apelacionRepository.calificarApelacion(any(), any(), any()) } just Runs
        every { apelacionRepository.getApelacionPorExpediente(any()) } returns flowOf(null)

        val result = useCase(crearParams())
        assertTrue(result is CalificarApelacionUseCase.Result.Error)
        assertTrue((result as CalificarApelacionUseCase.Result.Error).mensaje.contains("No se pudo obtener"))
    }
}
