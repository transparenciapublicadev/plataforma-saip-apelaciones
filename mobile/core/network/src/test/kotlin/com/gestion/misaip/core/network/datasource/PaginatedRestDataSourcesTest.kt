package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.network.api.ApelacionApiService
import com.gestion.misaip.core.network.api.SolicitudApiService
import com.gestion.misaip.core.network.dto.rest.ApelacionResumenRestDto
import com.gestion.misaip.core.network.dto.rest.PaginaRestDto
import com.gestion.misaip.core.network.dto.rest.SolicitudResumenRestDto
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
}
