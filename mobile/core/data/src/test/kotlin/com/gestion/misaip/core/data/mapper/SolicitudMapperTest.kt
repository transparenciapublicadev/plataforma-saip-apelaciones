package com.gestion.misaip.core.data.mapper

import com.gestion.misaip.core.domain.model.CanalNotificacion
import com.gestion.misaip.core.domain.model.Documento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.EstadoSolicitud
import com.gestion.misaip.core.domain.model.RespuestaEntidad
import com.gestion.misaip.core.domain.model.Solicitante
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.domain.model.TipoRespuesta
import com.gestion.misaip.core.domain.model.TipoSolicitud
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SolicitudMapperTest {

    @Test
    fun `round trip local conserva consentimiento canal y estado`() {
        val original = Solicitud(
            id = "42",
            expediente = "SAIP-2026-00042",
            tipo = TipoSolicitud.ACCESO_INFORMACION,
            entidad = "Entidad Pública",
            entidadId = "10",
            usuarioId = "20",
            solicitante = Solicitante(
                nombre = "Ciudadano Demo",
                dni = "00000000",
                email = "ciudadano@example.test"
            ),
            asunto = "Solicitud de prueba",
            descripcion = "Descripción de prueba para seguimiento",
            consentimientoDatosPersonales = true,
            canalNotificacion = CanalNotificacion.CORREO_ELECTRONICO,
            fechaCreacion = 1_000,
            fechaLimite = 2_000,
            estado = EstadoSolicitud.EN_REVISION
        )

        val restored = SolicitudMapper.toDomain(SolicitudMapper.toEntity(original))

        assertTrue(restored.consentimientoDatosPersonales)
        assertEquals(CanalNotificacion.CORREO_ELECTRONICO, restored.canalNotificacion)
        assertEquals(EstadoSolicitud.EN_REVISION, restored.estado)
    }

    @Test
    fun `round trip local conserva id y metadata segura de respuesta`() {
        val documento = Documento(
            id = "91",
            nombreOriginal = "respuesta.pdf",
            contentType = "application/pdf",
            sizeBytes = 2_048,
            hashSha256 = "abc123",
            tipoDocumento = TipoDocumento.RESPUESTA_ENTIDAD,
            relacion = DocumentoRelacion.Respuesta("31")
        )
        val original = Solicitud(
            id = "42",
            expediente = "SAIP-2026-00042",
            tipo = TipoSolicitud.ACCESO_INFORMACION,
            entidad = "Entidad Pública",
            entidadId = "10",
            usuarioId = "20",
            solicitante = Solicitante(
                nombre = "Ciudadano Demo",
                dni = "00000000",
                email = "ciudadano@example.test"
            ),
            asunto = "Solicitud de prueba",
            descripcion = "Descripción de prueba para seguimiento",
            consentimientoDatosPersonales = true,
            canalNotificacion = CanalNotificacion.PLATAFORMA,
            fechaCreacion = 1_000,
            fechaLimite = 2_000,
            estado = EstadoSolicitud.RESPONDIDA,
            respuestaEntidad = RespuestaEntidad(
                id = "31",
                fechaRespuesta = 1_500,
                funcionario = "Funcionario Demo",
                tipo = TipoRespuesta.ENTREGA_TOTAL,
                fundamentacion = "Entrega completa",
                documentos = listOf(documento)
            )
        )

        val entity = SolicitudMapper.toEntity(original)
        val restored = SolicitudMapper.toDomain(entity)

        assertEquals("[]", entity.respuestaArchivos)
        assertEquals("31", restored.respuestaEntidad?.id)
        assertEquals(listOf(documento), restored.respuestaEntidad?.documentos)
    }
}
