package com.gestion.misaip.core.domain.usecase.solicitud

import com.gestion.misaip.core.domain.model.AlcanceEncauzamiento
import com.gestion.misaip.core.domain.model.CanalNotificacion
import com.gestion.misaip.core.domain.model.EncauzamientoSolicitud
import com.gestion.misaip.core.domain.model.LiquidacionCostoSolicitud
import com.gestion.misaip.core.domain.model.ObservacionSolicitud
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class SolicitudFuncionarioOperacionUseCasesTest {

    private val repository = mockk<SolicitudRepository>()

    @Test
    fun `registrar observacion valida y delega al repositorio`() = runTest {
        coEvery { repository.registrarObservacion("42", any()) } returns observacion()

        val result = RegistrarObservacionSolicitudUseCase(repository)(
            solicitudId = "42",
            motivo = "Falta precisar el periodo solicitado",
            responsable = " Funcionario "
        )

        assertEquals("PENDIENTE_SUBSANACION", result.estado)
        coVerify(exactly = 1) {
            repository.registrarObservacion("42", match {
                it.motivoObservacion == "Falta precisar el periodo solicitado" &&
                    it.responsable == "Funcionario"
            })
        }
    }

    @Test(expected = IllegalArgumentException::class)
    fun `ampliacion exige fecha ISO`() = runTest {
        RegistrarAmpliacionPlazoSolicitudUseCase(repository)(
            solicitudId = "42",
            motivo = "Volumen amplio",
            informe = "Informe 001",
            fechaNotificacion = "02/06/2026",
            responsable = null,
            entregaDescripcion = "Primer bloque",
            entregaFechaProgramada = "2026-06-20",
            entregaObservacion = null
        )
    }

    @Test
    fun `encauzamiento conserva alcance parcial y entidad destino`() = runTest {
        coEvery { repository.registrarEncauzamiento("42", any()) } returns encauzamiento()

        RegistrarEncauzamientoSolicitudUseCase(repository)(
            solicitudId = "42",
            entidadDestinoId = "9",
            motivo = "Competencia sectorial",
            alcance = AlcanceEncauzamiento.PARCIAL,
            responsable = "Funcionario",
            sustento = "Solo se deriva un extremo"
        )

        coVerify(exactly = 1) {
            repository.registrarEncauzamiento("42", match {
                it.entidadDestinoId == 9L && it.alcance == AlcanceEncauzamiento.PARCIAL
            })
        }
    }

    @Test
    fun `liquidacion valida monto y delega medio formal`() = runTest {
        coEvery { repository.emitirLiquidacion("42", any()) } returns liquidacion()

        EmitirLiquidacionCostoSolicitudUseCase(repository)(
            solicitudId = "42",
            codigo = "",
            monto = "18,50",
            concepto = "Copias físicas",
            fechaNotificacion = "2026-06-02",
            medioNotificacion = CanalNotificacion.CASILLA_ELECTRONICA,
            responsable = "Funcionario",
            observacion = null
        )

        coVerify(exactly = 1) {
            repository.emitirLiquidacion("42", match {
                it.monto == 18.50 && it.medioNotificacion == CanalNotificacion.CASILLA_ELECTRONICA
            })
        }
    }

    @Test(expected = IllegalArgumentException::class)
    fun `liquidacion rechaza monto negativo antes de invocar red`() = runTest {
        EmitirLiquidacionCostoSolicitudUseCase(repository)(
            solicitudId = "42",
            codigo = null,
            monto = "-1",
            concepto = "Copias físicas",
            fechaNotificacion = "2026-06-02",
            medioNotificacion = CanalNotificacion.FISICA,
            responsable = null,
            observacion = null
        )
    }

    private fun observacion() = ObservacionSolicitud(
        id = 1,
        solicitudId = 42,
        expediente = "SAIP-2026-00042",
        motivoObservacion = "Falta precisar el periodo",
        fechaObservacion = "2026-06-02",
        fechaLimiteSubsanacion = "2026-06-04",
        fechaSubsanacion = null,
        comentarioSubsanacion = null,
        estado = "PENDIENTE_SUBSANACION",
        responsableObservacion = "Funcionario",
        responsableSubsanacion = null
    )

    private fun encauzamiento() = EncauzamientoSolicitud(
        id = 2,
        solicitudId = 42,
        expediente = "SAIP-2026-00042",
        entidadOrigenNombre = "Entidad origen",
        entidadDestinoId = 9,
        entidadDestinoNombre = "Entidad destino",
        motivoEncauzamiento = "Competencia sectorial",
        alcance = AlcanceEncauzamiento.PARCIAL,
        fechaEncauzamiento = "2026-06-02",
        fechaLimiteEncauzamiento = "2026-06-04",
        estadoEncauzamiento = "REGISTRADO",
        responsable = "Funcionario",
        observacionSustento = null
    )

    private fun liquidacion() = LiquidacionCostoSolicitud(
        id = 3,
        solicitudId = 42,
        expediente = "SAIP-2026-00042",
        codigoLiquidacion = "CUPON-42",
        monto = "18.50",
        moneda = "PEN",
        concepto = "Copias físicas",
        fechaNotificacion = "2026-06-02",
        fechaLimiteRecojo = "2026-07-14",
        estadoLiquidacion = "NOTIFICADA",
        medioNotificacion = CanalNotificacion.CASILLA_ELECTRONICA,
        responsable = "Funcionario",
        observacion = null
    )
}
