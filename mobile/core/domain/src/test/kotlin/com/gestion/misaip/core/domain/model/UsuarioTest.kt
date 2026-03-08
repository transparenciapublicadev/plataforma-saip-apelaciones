package com.gestion.misaip.core.domain.model

import org.junit.Assert.*
import org.junit.Test

class UsuarioTest {

    private fun crearUsuario(tipo: TipoUsuario) = Usuario(
        id = "usr-1",
        tipo = tipo,
        nombre = "Juan Pérez",
        dni = "12345678",
        email = "juan@mail.com",
        fechaRegistro = 1700000000000L
    )

    @Test
    fun `esCiudadano es true solo para CIUDADANO`() {
        assertTrue(crearUsuario(TipoUsuario.CIUDADANO).esCiudadano)
        assertFalse(crearUsuario(TipoUsuario.FUNCIONARIO).esCiudadano)
        assertFalse(crearUsuario(TipoUsuario.TTAIP).esCiudadano)
        assertFalse(crearUsuario(TipoUsuario.ADMIN).esCiudadano)
    }

    @Test
    fun `esFuncionario es true solo para FUNCIONARIO`() {
        assertTrue(crearUsuario(TipoUsuario.FUNCIONARIO).esFuncionario)
        assertFalse(crearUsuario(TipoUsuario.CIUDADANO).esFuncionario)
    }

    @Test
    fun `esTTAIP es true solo para TTAIP`() {
        assertTrue(crearUsuario(TipoUsuario.TTAIP).esTTAIP)
        assertFalse(crearUsuario(TipoUsuario.CIUDADANO).esTTAIP)
    }

    @Test
    fun `esAdmin es true solo para ADMIN`() {
        assertTrue(crearUsuario(TipoUsuario.ADMIN).esAdmin)
        assertFalse(crearUsuario(TipoUsuario.CIUDADANO).esAdmin)
    }
}

class TipoUsuarioTest {

    @Test
    fun `fromString parsea todos los tipos`() {
        assertEquals(TipoUsuario.CIUDADANO, TipoUsuario.fromString("ciudadano"))
        assertEquals(TipoUsuario.FUNCIONARIO, TipoUsuario.fromString("funcionario"))
        assertEquals(TipoUsuario.TTAIP, TipoUsuario.fromString("ttaip"))
        assertEquals(TipoUsuario.ADMIN, TipoUsuario.fromString("admin"))
    }

    @Test
    fun `fromString es case-insensitive`() {
        assertEquals(TipoUsuario.CIUDADANO, TipoUsuario.fromString("CIUDADANO"))
        assertEquals(TipoUsuario.TTAIP, TipoUsuario.fromString("TTAIP"))
    }

    @Test
    fun `fromString retorna CIUDADANO como default`() {
        assertEquals(TipoUsuario.CIUDADANO, TipoUsuario.fromString("desconocido"))
    }
}
