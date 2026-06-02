package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.AlcanceEncauzamiento
import com.gestion.misaip.core.domain.model.CanalNotificacion
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SolicitudOperacionDtosTest {

    private val json = Json { encodeDefaults = true }

    @Test
    fun `requests funcionario conservan nombres exactos del contrato backend`() {
        val observacion = json.encodeToString(
            ObservarSolicitudRestRequest("Falta precisar el periodo", "Funcionario")
        )
        val ampliacion = json.encodeToString(
            RegistrarAmpliacionPlazoRestRequest(
                motivoAmpliacion = "Volumen documental",
                informeAmpliacion = "Informe 001",
                fechaNotificacionAmpliacion = "2026-06-02",
                cronograma = listOf(
                    RegistrarEntregaParcialRestRequest(1, "Primer bloque", "2026-06-20")
                )
            )
        )
        val encauzamiento = json.encodeToString(
            RegistrarEncauzamientoSolicitudRestRequest(2, "Entidad competente", "PARCIAL")
        )
        val liquidacion = json.encodeToString(
            RegistrarLiquidacionCostoRestRequest(
                monto = 18.50,
                moneda = "PEN",
                concepto = "Copias físicas",
                fechaNotificacion = "2026-06-02",
                medioNotificacion = "CORREO_ELECTRONICO"
            )
        )

        assertTrue(observacion.contains("\"motivoObservacion\""))
        assertTrue(ampliacion.contains("\"fechaNotificacionAmpliacion\""))
        assertTrue(ampliacion.contains("\"cronograma\""))
        assertTrue(encauzamiento.contains("\"entidadDestinoId\":2"))
        assertTrue(encauzamiento.contains("\"alcance\":\"PARCIAL\""))
        assertTrue(liquidacion.contains("\"medioNotificacion\":\"CORREO_ELECTRONICO\""))
        assertTrue(liquidacion.contains("\"monto\":18.5"))
    }

    @Test
    fun `responses funcionario se mapean a modelos livianos de dominio`() {
        val encauzamiento = EncauzamientoSolicitudRestDto(
            id = 8,
            solicitudId = 10,
            expediente = "SAIP-2026-00010",
            entidadDestinoId = 2,
            entidadDestinoNombre = "Ministerio de Educación",
            motivoEncauzamiento = "Competencia sectorial",
            alcance = "TOTAL",
            estadoEncauzamiento = "REGISTRADO"
        ).toDomain()
        val liquidacion = LiquidacionCostoSolicitudRestDto(
            id = 9,
            solicitudId = 10,
            expediente = "SAIP-2026-00010",
            monto = "18.50",
            moneda = "PEN",
            concepto = "Copias simples",
            estadoLiquidacion = "NOTIFICADA",
            medioNotificacion = "CASILLA_ELECTRONICA"
        ).toDomain()

        assertEquals(AlcanceEncauzamiento.TOTAL, encauzamiento.alcance)
        assertEquals("Ministerio de Educación", encauzamiento.entidadDestinoNombre)
        assertEquals("18.50", liquidacion.monto)
        assertEquals(CanalNotificacion.CASILLA_ELECTRONICA, liquidacion.medioNotificacion)
    }
}
