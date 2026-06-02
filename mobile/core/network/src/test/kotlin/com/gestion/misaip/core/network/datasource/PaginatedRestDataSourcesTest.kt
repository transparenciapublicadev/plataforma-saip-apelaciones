package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.ComunicarOmisionElevacion
import com.gestion.misaip.core.domain.model.RegistrarApelacionAnteEntidad
import com.gestion.misaip.core.domain.model.RegistrarApelacionExterna
import com.gestion.misaip.core.domain.model.RegistrarElevacionApelacion
import com.gestion.misaip.core.domain.model.TipoDenegatoria
import com.gestion.misaip.core.network.api.ApelacionApiService
import com.gestion.misaip.core.network.api.SolicitudApiService
import com.gestion.misaip.core.network.dto.rest.ApelacionRestDto
import com.gestion.misaip.core.network.dto.rest.ApelacionResumenRestDto
import com.gestion.misaip.core.network.dto.rest.ElevacionApelacionRestDto
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
    fun `apelacion externa usa endpoint dedicado sin solicitud local`() = runTest {
        val api = mockk<ApelacionApiService>()
        val request = RegistrarApelacionExterna(
            ciudadanoId = "20",
            entidadId = "9",
            numeroSolicitudExterna = "EXT-2026-0042",
            fechaPresentacionSolicitudExterna = "2026-05-02",
            tipoDenegatoria = TipoDenegatoria.TACITA,
            fechaRespuestaEntidad = null,
            resumenSolicitudOriginal = "Solicitud externa de presupuesto",
            resumenRespuestaEntidad = null,
            referenciaDocumentoSolicitud = "cargo-solicitud.pdf",
            referenciaCargoRecepcion = "cargo-recepcion.pdf",
            referenciaRespuestaEntidad = null,
            evidenciaSilencioAdministrativo = "declaracion-silencio.pdf",
            fundamentos = "Silencio administrativo negativo",
            observacion = null
        )
        coEvery {
            api.crearExterna(match {
                it.ciudadanoId == 20L &&
                    it.entidadId == 9L &&
                    it.tipoDenegatoria == "TACITA" &&
                    it.evidenciaSilencioAdministrativo == "declaracion-silencio.pdf"
            })
        } returns ApelacionRestDto(
            id = 88,
            expediente = "00088-2026-JUS/TTAIP",
            tipoOrigen = "EXTERNA",
            numeroSolicitudExterna = "EXT-2026-0042",
            tipoDenegatoria = "TACITA",
            resumenSolicitudOriginal = "Solicitud externa de presupuesto",
            referenciaDocumentoSolicitud = "cargo-solicitud.pdf",
            evidenciaSilencioAdministrativo = "declaracion-silencio.pdf"
        )

        val apelacion = ApelacionRestDataSource(api, tokenStorage, json)
            .crearApelacionExterna(request)

        assertEquals(null, apelacion.solicitudId)
        assertEquals("EXT-2026-0042", apelacion.referenciaSolicitudOrigen)
        coVerify(exactly = 1) { api.crearExterna(any()) }
    }

    @Test
    fun `apelacion ante entidad usa solicitud local y cargo de presentacion`() = runTest {
        val api = mockk<ApelacionApiService>()
        val request = RegistrarApelacionAnteEntidad(
            solicitudId = "42",
            ciudadanoId = "20",
            fundamentos = "Denegatoria expresa",
            fechaPresentacionAnteEntidad = "2026-05-03",
            referenciaCargoPresentacion = "cargo-entidad.pdf",
            observacion = null
        )
        coEvery {
            api.crearAnteEntidad(match {
                it.solicitudId == 42L &&
                    it.ciudadanoId == 20L &&
                    it.referenciaCargoPresentacion == "cargo-entidad.pdf"
            })
        } returns ApelacionRestDto(
            id = 89,
            expediente = "00089-2026-JUS/TTAIP",
            estado = "PENDIENTE_ELEVACION",
            solicitudId = 42,
            solicitudExpediente = "SAIP-2026-00042"
        )

        val apelacion = ApelacionRestDataSource(api, tokenStorage, json)
            .crearApelacionAnteEntidad(request)

        assertEquals("42", apelacion.solicitudId)
        assertEquals("Pendiente de Elevación", apelacion.estado.toDisplayString())
        coVerify(exactly = 1) { api.crearAnteEntidad(any()) }
    }

    @Test
    fun `elevacion institucional y omision ciudadana usan endpoints dedicados`() = runTest {
        val api = mockk<ApelacionApiService>()
        coEvery { api.getPendientesElevacionEntidad(9) } returns listOf(
            ElevacionApelacionRestDto(
                id = 90,
                apelacionId = 89,
                expedienteReservado = "00089-2026-JUS/TTAIP",
                entidadOrigenId = 9,
                estadoElevacion = "PENDIENTE"
            )
        )
        coEvery {
            api.elevar(89, match {
                it.responsableEntidad == "Funcionario Demo" &&
                    it.referenciaExpedienteElevado == "expediente-elevado.pdf"
            })
        } returns ApelacionRestDto(
            id = 89,
            expediente = "00089-2026-JUS/TTAIP",
            estado = "EN_CALIFICACION_1"
        )
        coEvery {
            api.comunicarOmision(89, match {
                it.referenciaPruebaOmision == "prueba-omision.pdf"
            })
        } returns ElevacionApelacionRestDto(
            id = 90,
            apelacionId = 89,
            expedienteReservado = "00089-2026-JUS/TTAIP",
            entidadOrigenId = 9,
            estadoElevacion = "COMUNICADA_POR_CIUDADANO",
            referenciaPruebaOmision = "prueba-omision.pdf"
        )
        val dataSource = ApelacionRestDataSource(api, tokenStorage, json)

        val pendientes = dataSource.getPendientesElevacionEntidad("9")
        val elevada = dataSource.elevarApelacion(
            "89",
            RegistrarElevacionApelacion(
                responsableEntidad = "Funcionario Demo",
                referenciaExpedienteElevado = "expediente-elevado.pdf",
                observacion = null
            )
        )
        val omision = dataSource.comunicarOmisionElevacion(
            "89",
            ComunicarOmisionElevacion(
                referenciaPruebaOmision = "prueba-omision.pdf",
                observacion = null
            )
        )

        assertEquals("90", pendientes.single().id)
        assertEquals("00089-2026-JUS/TTAIP", elevada.expediente)
        assertEquals("COMUNICADA_POR_CIUDADANO", omision.estado.name)
        coVerify(exactly = 1) {
            api.getPendientesElevacionEntidad(9)
            api.elevar(89, any())
            api.comunicarOmision(89, any())
        }
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
