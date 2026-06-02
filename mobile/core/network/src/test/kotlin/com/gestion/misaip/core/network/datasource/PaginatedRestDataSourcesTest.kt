package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.network.api.ApelacionApiService
import com.gestion.misaip.core.network.api.SolicitudApiService
import com.gestion.misaip.core.network.dto.rest.ApelacionResumenRestDto
import com.gestion.misaip.core.network.dto.rest.PaginaRestDto
import com.gestion.misaip.core.network.dto.rest.SolicitudResumenRestDto
import com.gestion.misaip.core.network.dto.rest.AmpliacionPlazoSolicitudRestDto
import com.gestion.misaip.core.network.dto.rest.EncauzamientoSolicitudRestDto
import com.gestion.misaip.core.network.dto.rest.LiquidacionCostoSolicitudRestDto
import com.gestion.misaip.core.network.dto.rest.ObservacionSolicitudRestDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class PaginatedRestDataSourcesTest {

    private val json = Json { ignoreUnknownKeys = true }
    private val tokenStorage = mockk<TokenStorage>(relaxed = true)

    @Test
    fun `solicitudes ciudadano usa endpoint paginado con pagina y tamano`() = runTest {
        val api = mockk<SolicitudApiService>()
        coEvery { api.getByCiudadanoPaginadas(20, 1, 15) } returns PaginaRestDto(
            contenido = listOf(
                SolicitudResumenRestDto(id = 42, expediente = "SAIP-2026-00042")
            ),
            pagina = 1,
            tamano = 15,
            totalElementos = 16,
            totalPaginas = 2,
            ultima = true
        )

        val pagina = SolicitudRestDataSource(api, tokenStorage, json)
            .getPaginaSolicitudesUsuario("20", 1, 15)

        assertEquals("SAIP-2026-00042", pagina.contenido.single().expediente)
        coVerify(exactly = 1) { api.getByCiudadanoPaginadas(20, 1, 15) }
    }

    @Test
    fun `apelaciones TTAIP usa endpoint paginado general`() = runTest {
        val api = mockk<ApelacionApiService>()
        coEvery { api.listarPaginadas(0, 20) } returns PaginaRestDto(
            contenido = listOf(
                ApelacionResumenRestDto(id = 7, expediente = "00007-2026-JUS/TTAIP")
            ),
            pagina = 0,
            tamano = 20,
            totalElementos = 1,
            totalPaginas = 1,
            ultima = true
        )

        val pagina = ApelacionRestDataSource(api, tokenStorage, json)
            .getPaginaApelaciones(0, 20)

        assertEquals("00007-2026-JUS/TTAIP", pagina.contenido.single().expediente)
        coVerify(exactly = 1) { api.listarPaginadas(0, 20) }
    }

    @Test
    fun `detalle funcionario consulta las cuatro trazabilidades SAIP`() = runTest {
        val api = mockk<SolicitudApiService>()
        coEvery { api.listarObservaciones(42) } returns listOf(
            ObservacionSolicitudRestDto(id = 1, solicitudId = 42, estado = "PENDIENTE_SUBSANACION")
        )
        coEvery { api.listarAmpliaciones(42) } returns listOf(
            AmpliacionPlazoSolicitudRestDto(id = 2, solicitudId = 42, estadoAmpliacion = "NOTIFICADA")
        )
        coEvery { api.listarEncauzamientos(42) } returns listOf(
            EncauzamientoSolicitudRestDto(id = 3, solicitudId = 42, entidadDestinoId = 9)
        )
        coEvery { api.listarLiquidaciones(42) } returns listOf(
            LiquidacionCostoSolicitudRestDto(id = 4, solicitudId = 42, estadoLiquidacion = "NOTIFICADA")
        )

        val result = SolicitudRestDataSource(api, tokenStorage, json)
            .getOperacionesFuncionario("42")

        assertEquals(1, result.observaciones.size)
        assertEquals(1, result.ampliaciones.size)
        assertEquals(1, result.encauzamientos.size)
        assertEquals(1, result.liquidaciones.size)
        coVerify(exactly = 1) {
            api.listarObservaciones(42)
            api.listarAmpliaciones(42)
            api.listarEncauzamientos(42)
            api.listarLiquidaciones(42)
        }
    }
}
