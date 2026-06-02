package com.gestion.misaip.core.network.dto.rest

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ExpedienteTtaipDtosTest {

    @Test
    fun `expediente agregado conserva documentos evidencia y trazabilidad`() {
        val expediente = ExpedienteTtaipRestDto(
            id = 15,
            numeroExpediente = "00015-2026-JUS/TTAIP",
            estado = "EN_RESOLUCION",
            sala = SalaTtaipRestDto(id = 2, nombre = "SEGUNDA SALA"),
            resoluciones = listOf(
                ResolucionRestDto(
                    id = 51,
                    numeroResolucion = "001595-2026-JUS/TTAIP-SEGUNDA SALA",
                    tipoResolucion = "RESOLUCION_FINAL",
                    decision = "FUNDADO",
                    cedulas = listOf(
                        CedulaTtaipRestDto(
                            id = 61,
                            numeroCedula = "15203-2026-JUS/TTAIP",
                            destinatario = "ENTIDAD_PUBLICA",
                            documentoReferencia = "cedula-entidad.pdf"
                        )
                    )
                )
            ),
            notificaciones = listOf(
                NotificacionTtaipRestDto(
                    id = 71,
                    numeroCedula = "15203-2026-JUS/TTAIP",
                    destinatario = "ENTIDAD_PUBLICA",
                    estado = "FALLIDA",
                    codigoConstancia = "CONST-71",
                    acuseAutomatico = "No recibido",
                    estadoAcuse = "NO_RECIBIDO",
                    referenciaEvidencia = "acuse-71.pdf",
                    validadaManualmente = false
                )
            ),
            reprocesos = listOf(
                ReprocesoNotificacionTtaipRestDto(
                    id = 81,
                    notificacionId = 71,
                    cedulaOriginalId = 61,
                    cedulaNuevaId = 62,
                    notificacionNuevaId = 72,
                    numeroCedulaOriginal = "15203-2026-JUS/TTAIP",
                    numeroCedulaNueva = "15204-2026-JUS/TTAIP",
                    destinatario = "ENTIDAD_PUBLICA"
                )
            ),
            descargosEntidad = listOf(
                DescargoEntidadTtaipRestDto(id = 91, estadoDescargo = "REQUERIDO", documentoDescargo = "descargo.pdf")
            ),
            suspensionesPlazo = listOf(
                SuspensionPlazoTtaipRestDto(id = 101, motivoSuspension = "INFORME_ORAL", motivoDetalle = "Audiencia")
            ),
            cumplimientosResolucion = listOf(
                CumplimientoResolucionTtaipRestDto(id = 111, resolucionId = 51, evidenciaCumplimiento = "evidencia.pdf")
            )
        ).toDomain()

        assertEquals("SEGUNDA SALA", expediente.sala?.nombre)
        assertEquals("cedula-entidad.pdf", expediente.resoluciones.single().cedulas.single().documentoReferencia)
        assertEquals("acuse-71.pdf", expediente.notificaciones.single().referenciaEvidencia)
        assertTrue(expediente.notificaciones.single().permiteReproceso)
        assertEquals("62", expediente.reprocesos.single().cedulaNuevaId)
        assertEquals("descargo.pdf", expediente.descargos.single().documento)
        assertEquals("Audiencia", expediente.suspensiones.single().motivoDetalle)
        assertEquals("evidencia.pdf", expediente.cumplimientos.single().evidencia)
    }

    @Test
    fun `intento de notificacion expone solo diagnostico sanitizado`() {
        val intento = IntentoNotificacionTtaipRestDto(
            id = 5,
            estado = "FALLIDO",
            canal = "CORREO_ELECTRONICO",
            proveedor = "MOCK",
            codigoCorrelacion = "CORR-5",
            mensajeTecnicoSanitizado = "Proveedor no disponible",
            trazabilidad = "Intento persistido"
        ).toDomain()

        assertEquals("MOCK", intento.proveedor)
        assertEquals("Proveedor no disponible", intento.mensajeTecnicoSanitizado)
        assertEquals("Intento persistido", intento.trazabilidad)
    }
}
