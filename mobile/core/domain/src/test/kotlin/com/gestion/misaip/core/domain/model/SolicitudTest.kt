package com.gestion.misaip.core.domain.model

import org.junit.Assert.*
import org.junit.Test

class SolicitudTest {

    private fun crearSolicitud(estado: EstadoSolicitud) = Solicitud(
        id = "sol-1",
        expediente = "SAIP-2025-00001",
        tipo = TipoSolicitud.ACCESO_INFORMACION,
        entidad = "Ministerio de Justicia",
        entidadId = "ent-1",
        usuarioId = "usr-1",
        solicitante = Solicitante("Juan", "12345678", "juan@mail.com"),
        asunto = "Información pública",
        descripcion = "Solicito información",
        fechaCreacion = 1700000000000L,
        fechaLimite = 1701000000000L,
        estado = estado
    )

    // --- estaPendiente ---

    @Test
    fun `estaPendiente es true para RECEPCIONADA`() {
        assertTrue(crearSolicitud(EstadoSolicitud.RECEPCIONADA).estaPendiente)
    }

    @Test
    fun `estaPendiente es true para EN_REVISION`() {
        assertTrue(crearSolicitud(EstadoSolicitud.EN_REVISION).estaPendiente)
    }

    @Test
    fun `estaPendiente es true para PENDIENTE_INFORMACION`() {
        assertTrue(crearSolicitud(EstadoSolicitud.PENDIENTE_INFORMACION).estaPendiente)
    }

    @Test
    fun `estaPendiente es false para RESPONDIDA`() {
        assertFalse(crearSolicitud(EstadoSolicitud.RESPONDIDA).estaPendiente)
    }

    @Test
    fun `estaPendiente es false para DENEGADA`() {
        assertFalse(crearSolicitud(EstadoSolicitud.DENEGADA).estaPendiente)
    }

    @Test
    fun `estaPendiente es false para VENCIDA`() {
        assertFalse(crearSolicitud(EstadoSolicitud.VENCIDA).estaPendiente)
    }

    @Test
    fun `estaPendiente es false para CONCLUIDA`() {
        assertFalse(crearSolicitud(EstadoSolicitud.CONCLUIDA).estaPendiente)
    }

    // --- fueDenegada ---

    @Test
    fun `fueDenegada es true solo para DENEGADA`() {
        assertTrue(crearSolicitud(EstadoSolicitud.DENEGADA).fueDenegada)
        assertFalse(crearSolicitud(EstadoSolicitud.RESPONDIDA).fueDenegada)
    }

    // --- estaVencida ---

    @Test
    fun `estaVencida es true solo para VENCIDA`() {
        assertTrue(crearSolicitud(EstadoSolicitud.VENCIDA).estaVencida)
        assertFalse(crearSolicitud(EstadoSolicitud.RESPONDIDA).estaVencida)
    }

    // --- fueRespondida ---

    @Test
    fun `fueRespondida es true solo para RESPONDIDA`() {
        assertTrue(crearSolicitud(EstadoSolicitud.RESPONDIDA).fueRespondida)
        assertFalse(crearSolicitud(EstadoSolicitud.DENEGADA).fueRespondida)
    }

    // --- puedeSerApelada (BR-SAIP-006) ---

    @Test
    fun `puedeSerApelada es true para DENEGADA`() {
        assertTrue(crearSolicitud(EstadoSolicitud.DENEGADA).puedeSerApelada)
    }

    @Test
    fun `puedeSerApelada es true para VENCIDA`() {
        assertTrue(crearSolicitud(EstadoSolicitud.VENCIDA).puedeSerApelada)
    }

    @Test
    fun `puedeSerApelada es true para RESPONDIDA`() {
        assertTrue(crearSolicitud(EstadoSolicitud.RESPONDIDA).puedeSerApelada)
    }

    @Test
    fun `puedeSerApelada es false para RECEPCIONADA`() {
        assertFalse(crearSolicitud(EstadoSolicitud.RECEPCIONADA).puedeSerApelada)
    }

    @Test
    fun `puedeSerApelada es false para EN_REVISION`() {
        assertFalse(crearSolicitud(EstadoSolicitud.EN_REVISION).puedeSerApelada)
    }

    @Test
    fun `puedeSerApelada es false para PENDIENTE_INFORMACION`() {
        assertFalse(crearSolicitud(EstadoSolicitud.PENDIENTE_INFORMACION).puedeSerApelada)
    }

    @Test
    fun `puedeSerApelada es false para CONCLUIDA`() {
        assertFalse(crearSolicitud(EstadoSolicitud.CONCLUIDA).puedeSerApelada)
    }
}

class TipoSolicitudTest {

    @Test
    fun `fromString parsea acceso a información`() {
        assertEquals(TipoSolicitud.ACCESO_INFORMACION, TipoSolicitud.fromString("acceso a información"))
        assertEquals(TipoSolicitud.ACCESO_INFORMACION, TipoSolicitud.fromString("acceso_informacion"))
    }

    @Test
    fun `fromString parsea información específica`() {
        assertEquals(TipoSolicitud.INFORMACION_ESPECIFICA, TipoSolicitud.fromString("información específica"))
        assertEquals(TipoSolicitud.INFORMACION_ESPECIFICA, TipoSolicitud.fromString("informacion_especifica"))
    }

    @Test
    fun `fromString parsea copia de documentos`() {
        assertEquals(TipoSolicitud.COPIA_DOCUMENTOS, TipoSolicitud.fromString("copia de documentos"))
        assertEquals(TipoSolicitud.COPIA_DOCUMENTOS, TipoSolicitud.fromString("copia_documentos"))
    }

    @Test
    fun `fromString retorna default para valor desconocido`() {
        assertEquals(TipoSolicitud.ACCESO_INFORMACION, TipoSolicitud.fromString("algo_desconocido"))
    }

    @Test
    fun `toDisplayString retorna texto legible`() {
        assertEquals("Acceso a Información", TipoSolicitud.ACCESO_INFORMACION.toDisplayString())
        assertEquals("Información Específica", TipoSolicitud.INFORMACION_ESPECIFICA.toDisplayString())
        assertEquals("Copia de Documentos", TipoSolicitud.COPIA_DOCUMENTOS.toDisplayString())
    }
}

class EstadoSolicitudTest {

    @Test
    fun `fromString parsea todos los estados`() {
        assertEquals(EstadoSolicitud.RECEPCIONADA, EstadoSolicitud.fromString("recepcionada"))
        assertEquals(EstadoSolicitud.EN_REVISION, EstadoSolicitud.fromString("en_revisión"))
        assertEquals(EstadoSolicitud.EN_REVISION, EstadoSolicitud.fromString("en_revision"))
        assertEquals(EstadoSolicitud.PENDIENTE_INFORMACION, EstadoSolicitud.fromString("pendiente_de_información"))
        assertEquals(EstadoSolicitud.PENDIENTE_INFORMACION, EstadoSolicitud.fromString("pendiente_informacion"))
        assertEquals(EstadoSolicitud.RESPONDIDA, EstadoSolicitud.fromString("respondida"))
        assertEquals(EstadoSolicitud.DENEGADA, EstadoSolicitud.fromString("denegada"))
        assertEquals(EstadoSolicitud.CONCLUIDA, EstadoSolicitud.fromString("concluida"))
        assertEquals(EstadoSolicitud.VENCIDA, EstadoSolicitud.fromString("vencida"))
    }

    @Test
    fun `fromString retorna default para valor desconocido`() {
        assertEquals(EstadoSolicitud.RECEPCIONADA, EstadoSolicitud.fromString("inexistente"))
    }

    @Test
    fun `toDisplayString retorna texto legible para todos los estados`() {
        assertEquals("Recepcionada", EstadoSolicitud.RECEPCIONADA.toDisplayString())
        assertEquals("En Revisión", EstadoSolicitud.EN_REVISION.toDisplayString())
        assertEquals("Pendiente de Información", EstadoSolicitud.PENDIENTE_INFORMACION.toDisplayString())
        assertEquals("Respondida", EstadoSolicitud.RESPONDIDA.toDisplayString())
        assertEquals("Denegada", EstadoSolicitud.DENEGADA.toDisplayString())
        assertEquals("Concluida", EstadoSolicitud.CONCLUIDA.toDisplayString())
        assertEquals("Vencida", EstadoSolicitud.VENCIDA.toDisplayString())
    }
}

class PrioridadTest {

    @Test
    fun `fromString parsea todas las prioridades`() {
        assertEquals(Prioridad.BAJA, Prioridad.fromString("baja"))
        assertEquals(Prioridad.MEDIA, Prioridad.fromString("media"))
        assertEquals(Prioridad.ALTA, Prioridad.fromString("alta"))
        assertEquals(Prioridad.URGENTE, Prioridad.fromString("urgente"))
    }

    @Test
    fun `fromString retorna MEDIA como default`() {
        assertEquals(Prioridad.MEDIA, Prioridad.fromString("desconocido"))
    }
}

class TipoRespuestaTest {

    @Test
    fun `fromString parsea todos los tipos`() {
        assertEquals(TipoRespuesta.ENTREGA_TOTAL, TipoRespuesta.fromString("entrega_total"))
        assertEquals(TipoRespuesta.ENTREGA_PARCIAL, TipoRespuesta.fromString("entrega_parcial"))
        assertEquals(TipoRespuesta.DENEGACION_TOTAL, TipoRespuesta.fromString("denegación_total"))
        assertEquals(TipoRespuesta.DENEGACION_TOTAL, TipoRespuesta.fromString("denegacion_total"))
        assertEquals(TipoRespuesta.SILENCIO_ADMINISTRATIVO, TipoRespuesta.fromString("silencio_administrativo"))
    }

    @Test
    fun `fromString retorna ENTREGA_TOTAL como default`() {
        assertEquals(TipoRespuesta.ENTREGA_TOTAL, TipoRespuesta.fromString("desconocido"))
    }
}
