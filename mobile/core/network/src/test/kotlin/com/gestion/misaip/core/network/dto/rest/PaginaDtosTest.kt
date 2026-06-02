package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.Apelante
import com.gestion.misaip.core.domain.model.CanalNotificacion
import com.gestion.misaip.core.domain.model.EstadoApelacion
import com.gestion.misaip.core.domain.model.EstadoSolicitud
import com.gestion.misaip.core.domain.model.EstadoElevacionApelacion
import com.gestion.misaip.core.domain.model.TipoOrigenApelacion
import com.gestion.misaip.core.domain.model.Solicitante
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.TipoSolicitud
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PaginaDtosTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `pagina generica usa los nombres reales del contrato backend`() {
        val pagina = json.decodeFromString<PaginaRestDto<SolicitudResumenRestDto>>(
            """
            {
              "contenido": [{"id": 42, "expediente": "SAIP-2026-00042"}],
              "pagina": 1,
              "tamano": 20,
              "totalElementos": 41,
              "totalPaginas": 3,
              "ultima": false
            }
            """.trimIndent()
        ).map { it.toDomain() }

        assertEquals(1, pagina.pagina)
        assertEquals(20, pagina.tamano)
        assertEquals(41L, pagina.totalElementos)
        assertEquals(3, pagina.totalPaginas)
        assertFalse(pagina.ultima)
        assertEquals("SAIP-2026-00042", pagina.contenido.single().expediente)
    }

    @Test
    fun `resumen solicitud actualiza bandeja sin perder consentimiento ni canal local`() {
        val cached = solicitudCache()

        val solicitud = SolicitudResumenRestDto(
            id = 42,
            expediente = "SAIP-2026-00042",
            asunto = "Resumen actualizado",
            estado = "EN_REVISION"
        ).toDomain(cached)

        assertTrue(solicitud.consentimientoDatosPersonales)
        assertEquals(CanalNotificacion.CASILLA_ELECTRONICA, solicitud.canalNotificacion)
        assertEquals("Resumen actualizado", solicitud.asunto)
        assertEquals(EstadoSolicitud.EN_REVISION, solicitud.estado)
    }

    @Test
    fun `resumen apelacion conserva detalle local y actualiza estado`() {
        val cached = apelacionCache()

        val apelacion = ApelacionResumenRestDto(
            id = 7,
            expediente = "00007-2026-JUS/TTAIP",
            estado = "EN_RESOLUCION",
            ciudadanoNombre = "Ciudadano Actualizado"
        ).toDomain(cached)

        assertEquals("Fundamento registrado", apelacion.fundamentoLegal)
        assertEquals("Ciudadano Actualizado", apelacion.apelante.nombre)
        assertEquals(EstadoApelacion.EN_RESOLUCION, apelacion.estado)
    }

    @Test
    fun `resumen apelacion externa muestra referencia aun sin SAIP local`() {
        val apelacion = ApelacionResumenRestDto(
            id = 8,
            expediente = "00008-2026-JUS/TTAIP",
            numeroSolicitudExterna = "MP-EXT-2026-001",
            tipoOrigen = "EXTERNA"
        ).toDomain()

        assertEquals("", apelacion.expedienteSAIP)
        assertEquals("MP-EXT-2026-001", apelacion.referenciaSolicitudOrigen)
        assertEquals("MP-EXT-2026-001", apelacion.asunto)
    }

    @Test
    fun `detalle apelacion externa conserva elevacion y referencia sin SAIP local`() {
        val apelacion = ApelacionRestDto(
            id = 8,
            expediente = "00008-2026-JUS/TTAIP",
            estado = "PENDIENTE_ELEVACION",
            tipoOrigen = "EXTERNA",
            numeroSolicitudExterna = "MP-EXT-2026-001",
            fechaPresentacionSolicitudExterna = "2026-05-01",
            tipoDenegatoria = "TACITA",
            resumenSolicitudOriginal = "Solicitud externa",
            referenciaDocumentoSolicitud = "DOC-001",
            evidenciaSilencioAdministrativo = "Sin respuesta",
            elevacion = ElevacionApelacionRestDto(
                id = 90,
                apelacionId = 8,
                expedienteReservado = "00008-2026-JUS/TTAIP",
                entidadOrigenId = 10,
                entidadOrigenNombre = "Ministerio de Justicia",
                fechaPresentacionAnteEntidad = "2026-05-10",
                fechaLimiteElevacion = "2026-05-12",
                estadoElevacion = "PENDIENTE",
                referenciaCargoPresentacion = "CARGO-001"
            )
        ).toDomain()

        assertEquals(TipoOrigenApelacion.EXTERNA, apelacion.tipoOrigen)
        assertEquals("MP-EXT-2026-001", apelacion.referenciaSolicitudOrigen)
        assertEquals(EstadoElevacionApelacion.PENDIENTE, apelacion.elevacion?.estado)
        assertEquals("CARGO-001", apelacion.elevacion?.referenciaCargoPresentacion)
    }

    @Test
    fun `request apelacion externa expresa serializa respuesta de entidad`() {
        val payload = json.encodeToString(
            CrearApelacionExternaRestRequest(
                ciudadanoId = 20,
                entidadId = 10,
                numeroSolicitudExterna = "MP-EXT-2026-001",
                fechaPresentacionSolicitudExterna = "2026-05-01",
                tipoDenegatoria = "EXPRESA",
                fechaRespuestaEntidad = "2026-05-12",
                resumenSolicitudOriginal = "Solicitud externa",
                resumenRespuestaEntidad = "Respuesta denegatoria",
                referenciaDocumentoSolicitud = "DOC-001",
                referenciaCargoRecepcion = "CARGO-001",
                referenciaRespuestaEntidad = "RESP-001",
                evidenciaSilencioAdministrativo = null,
                fundamentos = "Fundamentos",
                observacion = null
            )
        )

        assertTrue(payload.contains("\"tipoDenegatoria\":\"EXPRESA\""))
        assertTrue(payload.contains("\"referenciaRespuestaEntidad\":\"RESP-001\""))
    }

    @Test
    fun `request apelacion externa tacita serializa evidencia de silencio`() {
        val payload = json.encodeToString(
            CrearApelacionExternaRestRequest(
                ciudadanoId = 20,
                entidadId = 10,
                numeroSolicitudExterna = "MP-EXT-2026-002",
                fechaPresentacionSolicitudExterna = "2026-05-01",
                tipoDenegatoria = "TACITA",
                fechaRespuestaEntidad = null,
                resumenSolicitudOriginal = "Solicitud externa",
                resumenRespuestaEntidad = null,
                referenciaDocumentoSolicitud = "DOC-002",
                referenciaCargoRecepcion = "CARGO-002",
                referenciaRespuestaEntidad = null,
                evidenciaSilencioAdministrativo = "Sin respuesta dentro del plazo",
                fundamentos = "Fundamentos",
                observacion = null
            )
        )

        assertTrue(payload.contains("\"tipoDenegatoria\":\"TACITA\""))
        assertTrue(payload.contains("\"evidenciaSilencioAdministrativo\":\"Sin respuesta dentro del plazo\""))
    }

    @Test
    fun `request apelacion ante entidad serializa cargo y solicitud local`() {
        val payload = json.encodeToString(
            CrearApelacionAnteEntidadRestRequest(
                solicitudId = 42,
                ciudadanoId = 20,
                fundamentos = "Fundamentos",
                fechaPresentacionAnteEntidad = "2026-06-02",
                referenciaCargoPresentacion = "CARGO-ENT-001",
                observacion = null
            )
        )

        assertTrue(payload.contains("\"solicitudId\":42"))
        assertTrue(payload.contains("\"referenciaCargoPresentacion\":\"CARGO-ENT-001\""))
    }

    private fun solicitudCache() = Solicitud(
        id = "42",
        expediente = "SAIP-2026-00042",
        tipo = TipoSolicitud.ACCESO_INFORMACION,
        entidad = "Ministerio de Justicia",
        entidadId = "10",
        usuarioId = "20",
        solicitante = Solicitante("Ciudadano Demo", "70000001", "ciudadano@example.com"),
        asunto = "Detalle local",
        descripcion = "Descripción local conservada",
        consentimientoDatosPersonales = true,
        canalNotificacion = CanalNotificacion.CASILLA_ELECTRONICA,
        fechaCreacion = 1L,
        fechaLimite = 2L,
        estado = EstadoSolicitud.RECEPCIONADA
    )

    private fun apelacionCache() = Apelacion(
        id = "7",
        expediente = "00007-2026-JUS/TTAIP",
        expedienteSAIP = "SAIP-2026-00042",
        usuarioId = "20",
        apelante = Apelante("Ciudadano Demo", "70000001", "ciudadano@example.com"),
        entidad = "Ministerio de Justicia",
        entidadId = "10",
        asunto = "Acceso a información",
        fundamentoLegal = "Fundamento registrado",
        exposicionHechos = "Hechos registrados",
        pretension = "Entrega de información",
        fechaPresentacion = 1L,
        estado = EstadoApelacion.EN_CALIFICACION_1
    )
}
