package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Calificacion
import com.gestion.misaip.core.domain.model.DecisionResolucionTtaip
import com.gestion.misaip.core.domain.model.ReprocesarNotificacionTtaip
import com.gestion.misaip.core.domain.model.ResolverApelacionTtaip
import com.gestion.misaip.core.domain.model.ResultadoCalificacion
import com.gestion.misaip.core.domain.model.Subsanacion
import com.gestion.misaip.core.network.api.ApelacionApiService
import com.gestion.misaip.core.network.api.TTAIPApiService
import com.gestion.misaip.core.network.dto.rest.ApelacionRestDto
import com.gestion.misaip.core.network.dto.rest.ExpedienteTtaipRestDto
import com.gestion.misaip.core.network.dto.rest.IntentoNotificacionTtaipRestDto
import com.gestion.misaip.core.network.dto.rest.ReprocesoNotificacionTtaipRestDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class ExpedienteTtaipRestDataSourceTest {

    private val apelacionApi = mockk<ApelacionApiService>()
    private val ttaipApi = mockk<TTAIPApiService>()
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `detalle usa agregado embebido del expediente`() = runTest {
        coEvery { apelacionApi.getByExpediente("00015-2026-JUS/TTAIP") } returns ApelacionRestDto(
            id = 15,
            expediente = "00015-2026-JUS/TTAIP",
            expedienteTtaip = ExpedienteTtaipRestDto(id = 20, numeroExpediente = "00015-2026-JUS/TTAIP")
        )

        val (_, expediente) = dataSource().obtenerPorNumero("00015-2026-JUS/TTAIP")

        assertEquals("20", expediente.id)
        coVerify(exactly = 1) { apelacionApi.getByExpediente("00015-2026-JUS/TTAIP") }
    }

    @Test
    fun `consulta intentos y reproceso usan endpoints institucionales`() = runTest {
        coEvery { ttaipApi.listarIntentosNotificacion(20, 71) } returns listOf(
            IntentoNotificacionTtaipRestDto(id = 1, estado = "FALLIDO")
        )
        coEvery { ttaipApi.reprocesarNotificacion(any()) } returns ReprocesoNotificacionTtaipRestDto(id = 2)
        val dataSource = dataSource()

        val intentos = dataSource.listarIntentosNotificacion("20", "71")
        dataSource.reprocesarNotificacion(
            ReprocesarNotificacionTtaip("15203-2026-JUS/TTAIP", "ENTIDAD_PUBLICA", "No recibido", "Tatiana")
        )

        assertEquals("FALLIDO", intentos.single().estado)
        coVerify(exactly = 1) {
            ttaipApi.listarIntentosNotificacion(20, 71)
            ttaipApi.reprocesarNotificacion(match { it.numeroCedulaOriginal == "15203-2026-JUS/TTAIP" })
        }
    }

    @Test
    fun `resolucion especial usa endpoint nulidad del acto`() = runTest {
        coEvery { ttaipApi.declararNulidadDelActo(15, any()) } returns ApelacionRestDto(id = 15)

        dataSource().resolverApelacion(
            "15",
            ResolverApelacionTtaip(DecisionResolucionTtaip.NULIDAD_DEL_ACTO, "Vicio grave", "Ley 27444", "Retrotraer")
        )

        coVerify(exactly = 1) {
            ttaipApi.declararNulidadDelActo(15, match { it.fundamentoLegal == "Ley 27444" })
        }
    }

    @Test
    fun `calificacion y subsanacion heredadas confirman backend`() = runTest {
        coEvery { apelacionApi.getByExpediente(any()) } returns ApelacionRestDto(id = 15)
        coEvery { ttaipApi.admitirApelacion(15, any()) } returns ApelacionRestDto(id = 15, estado = "EN_RESOLUCION")
        coEvery { apelacionApi.presentarSubsanacion(15, any(), any()) } returns ApelacionRestDto(id = 15, estado = "EN_CALIFICACION_2")
        val source = ApelacionRestDataSource(apelacionApi, ttaipApi, mockk(relaxed = true), json)

        source.calificarApelacion(
            "00015-2026-JUS/TTAIP",
            "primera",
            Calificacion(fecha = 0, resultado = ResultadoCalificacion.ADMISIBLE, fundamentacion = "Cumple requisitos")
        )
        source.presentarSubsanacion(
            15L,
            "Fundamentos corregidos",
            null,
            null,
            null
        )

        coVerify(exactly = 1) {
            ttaipApi.admitirApelacion(15, match { it.fundamentos == "Cumple requisitos" })
            apelacionApi.presentarSubsanacion(15, any(), null)
        }
    }

    private fun dataSource() = ExpedienteTtaipRestDataSource(apelacionApi, ttaipApi, json)
}
