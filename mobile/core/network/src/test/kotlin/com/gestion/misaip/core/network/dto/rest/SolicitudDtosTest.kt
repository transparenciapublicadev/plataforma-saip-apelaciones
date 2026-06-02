package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.CanalNotificacion
import com.gestion.misaip.core.domain.model.EstadoSolicitud
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SolicitudDtosTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `request de creacion incluye consentimiento y canal formal`() {
        val payload = CrearSolicitudRestRequest(
            asunto = "Acceso a información presupuestal",
            descripcion = "Solicito información pública del periodo vigente",
            entidadId = 10,
            ciudadanoId = 20,
            consentimientoDatosPersonales = true,
            canalNotificacion = CanalNotificacion.CASILLA_ELECTRONICA.name
        )

        val serialized = json.encodeToString(payload)

        assertTrue(serialized.contains("\"consentimientoDatosPersonales\":true"))
        assertTrue(serialized.contains("\"canalNotificacion\":\"CASILLA_ELECTRONICA\""))
    }

    @Test
    fun `response conserva consentimiento canal y estado en dominio`() {
        val solicitud = SolicitudRestDto(
            id = 42,
            expediente = "SAIP-2026-00042",
            asunto = "Solicitud de prueba",
            descripcion = "Descripción de prueba para seguimiento",
            estado = "RECEPCIONADA",
            consentimientoDatosPersonales = true,
            canalNotificacion = "PLATAFORMA"
        ).toDomain()

        assertTrue(solicitud.consentimientoDatosPersonales)
        assertEquals(CanalNotificacion.PLATAFORMA, solicitud.canalNotificacion)
        assertEquals(EstadoSolicitud.RECEPCIONADA, solicitud.estado)
    }

    @Test
    fun `problem details prioriza detail y conserva title como fallback`() {
        val conDetail = json.extraerMensajeProblemDetails(
            """{"type":"about:blank","title":"Solicitud inválida","status":400,"detail":"Debe seleccionar un canal formal de notificación"}"""
        )
        val soloTitle = json.extraerMensajeProblemDetails(
            """{"type":"about:blank","title":"Solicitud inválida","status":400}"""
        )

        assertEquals("Debe seleccionar un canal formal de notificación", conDetail)
        assertEquals("Solicitud inválida", soloTitle)
    }
}
