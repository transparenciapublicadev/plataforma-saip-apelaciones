package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.usecase.auth.RegistrarCiudadanoUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch

@Immutable
data class RegisterUiState(
    val nombre: String = "",
    val dni: String = "",
    val email: String = "",
    val telefono: String = "",
    val direccion: String = "",
    val contrasena: String = "",
    val confirmarContrasena: String = "",
    val contrasenaVisible: Boolean = false,
    val aceptaTerminos: Boolean = false,
    val isLoading: Boolean = false,
    val errorNombre: String? = null,
    val errorDni: String? = null,
    val errorEmail: String? = null,
    val errorContrasena: String? = null,
    val errorConfirmarContrasena: String? = null
)

sealed class RegisterEvent {
    data class ShowMessage(val message: String) : RegisterEvent()
    data class NavigateToDashboard(val usuarioId: String) : RegisterEvent()
    object NavigateBack : RegisterEvent()
}

class RegisterViewModel(
    private val registrarCiudadanoUseCase: RegistrarCiudadanoUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState: StateFlow<RegisterUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<RegisterEvent>()
    val events: SharedFlow<RegisterEvent> = _events

    fun actualizarNombre(nombre: String) {
        _uiState.value = _uiState.value.copy(nombre = nombre, errorNombre = null)
    }

    fun actualizarDni(dni: String) {
        if (dni.length <= 8 && dni.all { it.isDigit() }) {
            _uiState.value = _uiState.value.copy(dni = dni, errorDni = null)
        }
    }

    fun actualizarEmail(email: String) {
        _uiState.value = _uiState.value.copy(email = email, errorEmail = null)
    }

    fun actualizarTelefono(telefono: String) {
        _uiState.value = _uiState.value.copy(telefono = telefono)
    }

    fun actualizarDireccion(direccion: String) {
        _uiState.value = _uiState.value.copy(direccion = direccion)
    }

    fun actualizarContrasena(contrasena: String) {
        _uiState.value = _uiState.value.copy(contrasena = contrasena, errorContrasena = null)
    }

    fun actualizarConfirmarContrasena(confirmar: String) {
        _uiState.value = _uiState.value.copy(confirmarContrasena = confirmar, errorConfirmarContrasena = null)
    }

    fun toggleContrasenaVisible() {
        _uiState.value = _uiState.value.copy(contrasenaVisible = !_uiState.value.contrasenaVisible)
    }

    fun toggleAceptaTerminos() {
        _uiState.value = _uiState.value.copy(aceptaTerminos = !_uiState.value.aceptaTerminos)
    }

    fun registrar() {
        viewModelScope.launch {
            val state = _uiState.value
            var hasError = false

            // Validaciones locales
            if (state.nombre.isBlank()) {
                _uiState.value = _uiState.value.copy(errorNombre = "El nombre es obligatorio")
                hasError = true
            }

            if (state.dni.isBlank()) {
                _uiState.value = _uiState.value.copy(errorDni = "El DNI es obligatorio")
                hasError = true
            } else if (state.dni.length != 8) {
                _uiState.value = _uiState.value.copy(errorDni = "El DNI debe tener 8 dígitos")
                hasError = true
            }

            if (state.email.isBlank()) {
                _uiState.value = _uiState.value.copy(errorEmail = "El email es obligatorio")
                hasError = true
            } else if (!android.util.Patterns.EMAIL_ADDRESS.matcher(state.email).matches()) {
                _uiState.value = _uiState.value.copy(errorEmail = "Email inválido")
                hasError = true
            }

            if (state.contrasena.isBlank()) {
                _uiState.value = _uiState.value.copy(errorContrasena = "La contraseña es obligatoria")
                hasError = true
            } else if (state.contrasena.length < 6) {
                _uiState.value = _uiState.value.copy(errorContrasena = "Mínimo 6 caracteres")
                hasError = true
            }

            if (state.contrasena != state.confirmarContrasena) {
                _uiState.value = _uiState.value.copy(errorConfirmarContrasena = "Las contraseñas no coinciden")
                hasError = true
            }

            if (!state.aceptaTerminos) {
                _events.emit(RegisterEvent.ShowMessage("Debe aceptar los términos y condiciones"))
                hasError = true
            }

            if (hasError) {
                _events.emit(RegisterEvent.ShowMessage("Por favor complete todos los campos correctamente"))
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true)

            try {
                val result = registrarCiudadanoUseCase(
                    RegistrarCiudadanoUseCase.Params(
                        nombre = state.nombre,
                        dni = state.dni,
                        email = state.email,
                        telefono = state.telefono,
                        direccion = state.direccion,
                        password = state.contrasena,
                        confirmarPassword = state.confirmarContrasena
                    )
                )

                when (result) {
                    is RegistrarCiudadanoUseCase.RegisterResult.Success -> {
                        val usuario = result.usuario
                        _events.emit(RegisterEvent.ShowMessage("¡Bienvenido ${usuario.nombre}!"))
                        _events.emit(RegisterEvent.NavigateToDashboard(usuarioId = usuario.id))
                    }
                    is RegistrarCiudadanoUseCase.RegisterResult.Error -> {
                        _events.emit(RegisterEvent.ShowMessage(result.mensaje))
                    }
                }
            } catch (e: Exception) {
                _events.emit(RegisterEvent.ShowMessage("Error al registrar: ${e.message}"))
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }
}

