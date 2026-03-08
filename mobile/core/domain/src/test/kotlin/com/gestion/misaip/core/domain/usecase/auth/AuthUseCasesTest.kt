package com.gestion.misaip.core.domain.usecase.auth

import com.gestion.misaip.core.domain.model.TipoUsuario
import com.gestion.misaip.core.domain.model.Usuario
import com.gestion.misaip.core.domain.repository.UsuarioRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class AutenticarUsuarioUseCaseTest {

    private lateinit var usuarioRepository: UsuarioRepository
    private lateinit var useCase: AutenticarUsuarioUseCase

    private val ciudadano = Usuario(
        id = "usr-1",
        tipo = TipoUsuario.CIUDADANO,
        nombre = "Juan Pérez",
        dni = "12345678",
        email = "juan@mail.com",
        fechaRegistro = 1700000000000L
    )

    @Before
    fun setup() {
        usuarioRepository = mockk()
        useCase = AutenticarUsuarioUseCase(usuarioRepository)
    }

    // --- autenticarCiudadano ---

    @Test
    fun `autenticarCiudadano retorna error con DNI vacio`() = runTest {
        val result = useCase.autenticarCiudadano("", "password123")
        assertTrue(result is AutenticarUsuarioUseCase.AuthResult.Error)
        assertEquals("El DNI es obligatorio", (result as AutenticarUsuarioUseCase.AuthResult.Error).mensaje)
    }

    @Test
    fun `autenticarCiudadano retorna error con DNI invalido`() = runTest {
        val result = useCase.autenticarCiudadano("123", "password123")
        assertTrue(result is AutenticarUsuarioUseCase.AuthResult.Error)
        assertEquals("El DNI debe tener 8 dígitos", (result as AutenticarUsuarioUseCase.AuthResult.Error).mensaje)
    }

    @Test
    fun `autenticarCiudadano retorna error con password vacio`() = runTest {
        val result = useCase.autenticarCiudadano("12345678", "")
        assertTrue(result is AutenticarUsuarioUseCase.AuthResult.Error)
        assertEquals("La contraseña es obligatoria", (result as AutenticarUsuarioUseCase.AuthResult.Error).mensaje)
    }

    @Test
    fun `autenticarCiudadano retorna Success con credenciales validas`() = runTest {
        coEvery { usuarioRepository.autenticarCiudadano("12345678", "password123") } returns ciudadano

        val result = useCase.autenticarCiudadano("12345678", "password123")

        assertTrue(result is AutenticarUsuarioUseCase.AuthResult.Success)
        assertEquals(ciudadano, (result as AutenticarUsuarioUseCase.AuthResult.Success).usuario)
        coVerify { usuarioRepository.autenticarCiudadano("12345678", "password123") }
    }

    @Test
    fun `autenticarCiudadano retorna Error cuando repositorio lanza excepcion`() = runTest {
        coEvery { usuarioRepository.autenticarCiudadano(any(), any()) } throws RuntimeException("Credenciales inválidas")

        val result = useCase.autenticarCiudadano("12345678", "password123")

        assertTrue(result is AutenticarUsuarioUseCase.AuthResult.Error)
        assertEquals("Credenciales inválidas", (result as AutenticarUsuarioUseCase.AuthResult.Error).mensaje)
    }

    // --- autenticarFuncionario ---

    @Test
    fun `autenticarFuncionario retorna error con usuario vacio`() = runTest {
        val result = useCase.autenticarFuncionario("", "password123")
        assertTrue(result is AutenticarUsuarioUseCase.AuthResult.Error)
        assertEquals("El usuario es obligatorio", (result as AutenticarUsuarioUseCase.AuthResult.Error).mensaje)
    }

    @Test
    fun `autenticarFuncionario retorna error con password vacio`() = runTest {
        val result = useCase.autenticarFuncionario("funcionario1", "")
        assertTrue(result is AutenticarUsuarioUseCase.AuthResult.Error)
        assertEquals("La contraseña es obligatoria", (result as AutenticarUsuarioUseCase.AuthResult.Error).mensaje)
    }

    @Test
    fun `autenticarFuncionario retorna Success con credenciales validas`() = runTest {
        val funcionario = ciudadano.copy(tipo = TipoUsuario.FUNCIONARIO)
        coEvery { usuarioRepository.autenticarFuncionario("funcionario1", "password123") } returns funcionario

        val result = useCase.autenticarFuncionario("funcionario1", "password123")

        assertTrue(result is AutenticarUsuarioUseCase.AuthResult.Success)
        coVerify { usuarioRepository.autenticarFuncionario("funcionario1", "password123") }
    }

    @Test
    fun `autenticarFuncionario retorna Error cuando repositorio lanza excepcion`() = runTest {
        coEvery { usuarioRepository.autenticarFuncionario(any(), any()) } throws RuntimeException("Error de red")

        val result = useCase.autenticarFuncionario("funcionario1", "password123")

        assertTrue(result is AutenticarUsuarioUseCase.AuthResult.Error)
        assertEquals("Error de red", (result as AutenticarUsuarioUseCase.AuthResult.Error).mensaje)
    }
}

class RegistrarCiudadanoUseCaseTest {

    private lateinit var usuarioRepository: UsuarioRepository
    private lateinit var useCase: RegistrarCiudadanoUseCase

    private val paramsValidos = RegistrarCiudadanoUseCase.Params(
        nombre = "Ana García",
        dni = "87654321",
        email = "ana@mail.com",
        telefono = "999888777",
        direccion = "Av. Principal 123",
        password = "password123",
        confirmarPassword = "password123"
    )

    @Before
    fun setup() {
        usuarioRepository = mockk()
        useCase = RegistrarCiudadanoUseCase(usuarioRepository)
    }

    @Test
    fun `registro retorna error con nombre vacio`() = runTest {
        val result = useCase(paramsValidos.copy(nombre = ""))
        assertTrue(result is RegistrarCiudadanoUseCase.RegisterResult.Error)
        assertEquals("El nombre es obligatorio", (result as RegistrarCiudadanoUseCase.RegisterResult.Error).mensaje)
    }

    @Test
    fun `registro retorna error con DNI invalido`() = runTest {
        val result = useCase(paramsValidos.copy(dni = "123"))
        assertTrue(result is RegistrarCiudadanoUseCase.RegisterResult.Error)
        assertEquals("El DNI debe tener 8 dígitos", (result as RegistrarCiudadanoUseCase.RegisterResult.Error).mensaje)
    }

    @Test
    fun `registro retorna error con email invalido`() = runTest {
        val result = useCase(paramsValidos.copy(email = "no-email"))
        assertTrue(result is RegistrarCiudadanoUseCase.RegisterResult.Error)
        assertEquals("El email no es válido", (result as RegistrarCiudadanoUseCase.RegisterResult.Error).mensaje)
    }

    @Test
    fun `registro retorna error con password corto`() = runTest {
        val result = useCase(paramsValidos.copy(password = "123", confirmarPassword = "123"))
        assertTrue(result is RegistrarCiudadanoUseCase.RegisterResult.Error)
        assertEquals("La contraseña debe tener al menos 8 caracteres", (result as RegistrarCiudadanoUseCase.RegisterResult.Error).mensaje)
    }

    @Test
    fun `registro retorna error cuando passwords no coinciden`() = runTest {
        val result = useCase(paramsValidos.copy(confirmarPassword = "otraPassword"))
        assertTrue(result is RegistrarCiudadanoUseCase.RegisterResult.Error)
        assertEquals("Las contraseñas no coinciden", (result as RegistrarCiudadanoUseCase.RegisterResult.Error).mensaje)
    }

    @Test
    fun `registro exitoso retorna Success`() = runTest {
        val usuarioRegistrado = Usuario(
            id = "new-usr",
            tipo = TipoUsuario.CIUDADANO,
            nombre = "Ana García",
            dni = "87654321",
            email = "ana@mail.com",
            telefono = "999888777",
            direccion = "Av. Principal 123",
            fechaRegistro = 1700000000000L
        )
        coEvery { usuarioRepository.registrarCiudadano(any(), eq("password123")) } returns usuarioRegistrado

        val result = useCase(paramsValidos)

        assertTrue(result is RegistrarCiudadanoUseCase.RegisterResult.Success)
        assertEquals(usuarioRegistrado, (result as RegistrarCiudadanoUseCase.RegisterResult.Success).usuario)
    }

    @Test
    fun `registro retorna Error cuando repositorio lanza excepcion`() = runTest {
        coEvery { usuarioRepository.registrarCiudadano(any(), any()) } throws RuntimeException("DNI ya registrado")

        val result = useCase(paramsValidos)

        assertTrue(result is RegistrarCiudadanoUseCase.RegisterResult.Error)
        assertEquals("DNI ya registrado", (result as RegistrarCiudadanoUseCase.RegisterResult.Error).mensaje)
    }
}
