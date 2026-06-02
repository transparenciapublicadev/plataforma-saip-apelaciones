package com.gestion.misaip.core.domain.model

import org.junit.Assert.*
import org.junit.Test

class ApelacionTest {

    private fun crearApelacion(
        estado: EstadoApelacion = EstadoApelacion.EN_CALIFICACION_1,
        primeraCalificacion: Calificacion? = null,
        subsanacion: Subsanacion? = null
    ) = Apelacion(
        id = "ape-1",
        expediente = "01560-2025-JUS/TTAIP",
        expedienteSAIP = "SAIP-2025-00001",
        usuarioId = "usr-1",
        apelante = Apelante("Juan Pérez", "12345678", "juan@mail.com"),
        entidad = "Ministerio de Justicia",
        entidadId = "ent-1",
        asunto = "Denegación de información",
        fundamentoLegal = "Ley 27806",
        exposicionHechos = "Se denegó la información",
        pretension = "Entrega total",
        fechaPresentacion = 1700000000000L,
        estado = estado,
        primeraCalificacion = primeraCalificacion,
        subsanacion = subsanacion
    )

    // --- requiereSubsanacion ---

    @Test
    fun `requiereSubsanacion es true cuando estado ES_EN_SUBSANACION y calificacion requiere y no hay subsanacion`() {
        val calificacion = Calificacion(
            fecha = 1700000000000L,
            resultado = ResultadoCalificacion.INADMISIBLE,
            fundamentacion = "Falta documentación",
            subsanacionRequerida = true
        )
        val apelacion = crearApelacion(
            estado = EstadoApelacion.EN_SUBSANACION,
            primeraCalificacion = calificacion
        )
        assertTrue(apelacion.requiereSubsanacion)
    }

    @Test
    fun `requiereSubsanacion es false cuando ya hay subsanacion`() {
        val calificacion = Calificacion(
            fecha = 1700000000000L,
            resultado = ResultadoCalificacion.INADMISIBLE,
            fundamentacion = "Falta documentación",
            subsanacionRequerida = true
        )
        val subsanacion = Subsanacion(
            fecha = 1700100000000L,
            textoCorregido = "Texto corregido"
        )
        val apelacion = crearApelacion(
            estado = EstadoApelacion.EN_SUBSANACION,
            primeraCalificacion = calificacion,
            subsanacion = subsanacion
        )
        assertFalse(apelacion.requiereSubsanacion)
    }

    @Test
    fun `requiereSubsanacion es false cuando estado no es EN_SUBSANACION`() {
        val apelacion = crearApelacion(estado = EstadoApelacion.EN_CALIFICACION_1)
        assertFalse(apelacion.requiereSubsanacion)
    }

    @Test
    fun `requiereSubsanacion es false cuando calificacion no requiere subsanacion`() {
        val calificacion = Calificacion(
            fecha = 1700000000000L,
            resultado = ResultadoCalificacion.ADMISIBLE,
            fundamentacion = "Todo en orden",
            subsanacionRequerida = false
        )
        val apelacion = crearApelacion(
            estado = EstadoApelacion.EN_SUBSANACION,
            primeraCalificacion = calificacion
        )
        assertFalse(apelacion.requiereSubsanacion)
    }

    @Test
    fun `requiereSubsanacion es false cuando no hay primera calificacion`() {
        val apelacion = crearApelacion(estado = EstadoApelacion.EN_SUBSANACION)
        assertFalse(apelacion.requiereSubsanacion)
    }

    // --- esFundada / esInfundada ---

    @Test
    fun `esFundada es true solo con RESUELTO_FUNDADO`() {
        assertTrue(crearApelacion(estado = EstadoApelacion.RESUELTO_FUNDADO).esFundada)
        assertFalse(crearApelacion(estado = EstadoApelacion.RESUELTO_INFUNDADO).esFundada)
        assertFalse(crearApelacion(estado = EstadoApelacion.EN_RESOLUCION).esFundada)
    }

    @Test
    fun `esInfundada es true solo con RESUELTO_INFUNDADO`() {
        assertTrue(crearApelacion(estado = EstadoApelacion.RESUELTO_INFUNDADO).esInfundada)
        assertFalse(crearApelacion(estado = EstadoApelacion.RESUELTO_FUNDADO).esInfundada)
    }

    // --- estaResuelta ---

    @Test
    fun `estaResuelta es true para todos los estados terminales`() {
        val terminales = listOf(
            EstadoApelacion.RESUELTO,
            EstadoApelacion.RESUELTO_FUNDADO,
            EstadoApelacion.RESUELTO_FUNDADO_EN_PARTE,
            EstadoApelacion.RESUELTO_INFUNDADO,
            EstadoApelacion.RESUELTO_INFUNDADO_EN_PARTE,
            EstadoApelacion.RESUELTO_IMPROCEDENTE,
            EstadoApelacion.RESUELTO_ESTESE_A_LO_RESUELTO,
            EstadoApelacion.RESUELTO_NULIDAD_ACTO,
            EstadoApelacion.TENER_POR_NO_PRESENTADO,
            EstadoApelacion.CONCLUSION_SUSTRACCION_MATERIA,
            EstadoApelacion.CONCLUSION_DESISTIMIENTO
        )
        for (estado in terminales) {
            assertTrue("$estado debería ser terminal", crearApelacion(estado = estado).estaResuelta)
        }
    }

    @Test
    fun `estaResuelta es false para estados no terminales`() {
        val noTerminales = listOf(
            EstadoApelacion.PENDIENTE_ELEVACION,
            EstadoApelacion.EN_CALIFICACION_1,
            EstadoApelacion.EN_SUBSANACION,
            EstadoApelacion.EN_CALIFICACION_2,
            EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION,
            EstadoApelacion.EN_RESOLUCION
        )
        for (estado in noTerminales) {
            assertFalse("$estado no debería ser terminal", crearApelacion(estado = estado).estaResuelta)
        }
    }
}

class EstadoApelacionTest {

    @Test
    fun `fromString parsea estados con guiones bajos`() {
        assertEquals(EstadoApelacion.EN_CALIFICACION_1, EstadoApelacion.fromString("EN_CALIFICACION_1"))
    }

    @Test
    fun `fromString parsea estados con espacios y guiones`() {
        assertEquals(EstadoApelacion.EN_CALIFICACION_1, EstadoApelacion.fromString("en calificacion-1"))
    }

    @Test
    fun `fromString retorna EN_CALIFICACION_1 como default`() {
        assertEquals(EstadoApelacion.EN_CALIFICACION_1, EstadoApelacion.fromString("desconocido"))
    }

    @Test
    fun `isTerminal identifica correctamente estados terminales`() {
        assertTrue(EstadoApelacion.RESUELTO_FUNDADO.isTerminal())
        assertFalse(EstadoApelacion.EN_RESOLUCION.isTerminal())
    }

    @Test
    fun `toDisplayString retorna texto legible`() {
        assertEquals("Pendiente de Elevación", EstadoApelacion.PENDIENTE_ELEVACION.toDisplayString())
        assertEquals("Resuelto - Fundado", EstadoApelacion.RESUELTO_FUNDADO.toDisplayString())
        assertEquals("Resuelto - Estese a lo Resuelto", EstadoApelacion.RESUELTO_ESTESE_A_LO_RESUELTO.toDisplayString())
        assertEquals("Resuelto - Nulidad del Acto", EstadoApelacion.RESUELTO_NULIDAD_ACTO.toDisplayString())
    }
}

class ResultadoCalificacionTest {

    @Test
    fun `fromString parsea resultado correctamente`() {
        assertEquals(ResultadoCalificacion.INADMISIBLE, ResultadoCalificacion.fromString("INADMISIBLE"))
        assertEquals(ResultadoCalificacion.ADMITIDO, ResultadoCalificacion.fromString("admitido"))
    }

    @Test
    fun `fromString retorna ADMISIBLE como default`() {
        assertEquals(ResultadoCalificacion.ADMISIBLE, ResultadoCalificacion.fromString("desconocido"))
    }
}
