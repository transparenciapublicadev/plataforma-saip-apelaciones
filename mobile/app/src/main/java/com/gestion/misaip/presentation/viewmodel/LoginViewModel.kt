package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.usecase.auth.AutenticarUsuarioUseCase
import com.gestion.misaip.core.domain.usecase.sync.SincronizarDatosUseCase
import com.gestion.misaip.data.CredentialStorage
import com.gestion.misaip.messaging.FCMHelper
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

@Immutable
data class LoginUiState(
    val esCiudadano: Boolean = true,
    val dni: String = "",
    val usuario: String = "",
    val contrasena: String = "",
    val contrasenaVisible: Boolean = false,
    val recordarAcceso: Boolean = false,
    val isLoading: Boolean = false,
    val errorDni: String? = null,
    val errorUsuario: String? = null,
    val errorContrasena: String? = null
)

sealed class LoginEvent {
    data class ShowMessage(val message: String) : LoginEvent()
    data class NavigateToDashboard(
        val tipoUsuario: String,
        val usuarioId: String,
        val entidadId: String? = null,
        val nombreUsuario: String = ""
    ) : LoginEvent()
    object NavigateToRegister : LoginEvent()
}

class LoginViewModel(
    private val autenticarUsuarioUseCase: AutenticarUsuarioUseCase,
    private val sincronizarDatosUseCase: SincronizarDatosUseCase,
    private val credentialStorage: CredentialStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<LoginEvent>()
    val events: SharedFlow<LoginEvent> = _events

    fun resetFormulario() {
        // Cargar credenciales guardadas si existen
        val ciudadano = credentialStorage.obtenerCiudadano()
        val funcionario = credentialStorage.obtenerFuncionario()

        _uiState.value = LoginUiState(
            dni = ciudadano?.first ?: "",
            contrasena = if (ciudadano != null) ciudadano.second else if (funcionario != null) funcionario.second else "",
            usuario = funcionario?.first ?: "",
            recordarAcceso = ciudadano != null || funcionario != null,
            esCiudadano = ciudadano != null || funcionario == null
        )
    }

    fun toggleRecordarAcceso() {
        _uiState.value = _uiState.value.copy(
            recordarAcceso = !_uiState.value.recordarAcceso
        )
    }

    fun cambiarTipoLogin(esCiudadano: Boolean) {
        // Al cambiar de tab, cargar credenciales guardadas del tipo correspondiente
        val saved = if (esCiudadano) credentialStorage.obtenerCiudadano() else credentialStorage.obtenerFuncionario()
        _uiState.value = _uiState.value.copy(
            esCiudadano = esCiudadano,
            dni = if (esCiudadano) (credentialStorage.obtenerCiudadano()?.first ?: "") else _uiState.value.dni,
            usuario = if (!esCiudadano) (credentialStorage.obtenerFuncionario()?.first ?: "") else _uiState.value.usuario,
            contrasena = saved?.second ?: "",
            recordarAcceso = saved != null,
            errorDni = null,
            errorUsuario = null,
            errorContrasena = null
        )
    }

    fun actualizarDni(dni: String) {
        if (dni.length <= 8 && dni.all { it.isDigit() }) {
            _uiState.value = _uiState.value.copy(
                dni = dni,
                errorDni = null
            )
        }
    }

    fun actualizarUsuario(usuario: String) {
        _uiState.value = _uiState.value.copy(
            usuario = usuario,
            errorUsuario = null
        )
    }

    fun actualizarContrasena(contrasena: String) {
        _uiState.value = _uiState.value.copy(
            contrasena = contrasena,
            errorContrasena = null
        )
    }

    fun toggleContrasenaVisible() {
        _uiState.value = _uiState.value.copy(
            contrasenaVisible = !_uiState.value.contrasenaVisible
        )
    }

    fun iniciarSesion() {
        viewModelScope.launch {
            val state = _uiState.value
            var hasError = false

            // Validaciones
            if (state.esCiudadano) {
                if (state.dni.isBlank()) {
                    _uiState.value = _uiState.value.copy(errorDni = "El DNI es obligatorio")
                    hasError = true
                } else if (state.dni.length != 8) {
                    _uiState.value = _uiState.value.copy(errorDni = "El DNI debe tener 8 dígitos")
                    hasError = true
                }
            } else {
                if (state.usuario.isBlank()) {
                    _uiState.value = _uiState.value.copy(errorUsuario = "El correo electrónico es obligatorio")
                    hasError = true
                }
            }

            if (state.contrasena.isBlank()) {
                _uiState.value = _uiState.value.copy(errorContrasena = "La contraseña es obligatoria")
                hasError = true
            }

            if (hasError) {
                _events.emit(LoginEvent.ShowMessage("Por favor complete todos los campos"))
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true)

            try {
                val result = if (state.esCiudadano) {
                    autenticarUsuarioUseCase.autenticarCiudadano(state.dni, state.contrasena)
                } else {
                    autenticarUsuarioUseCase.autenticarFuncionario(state.usuario, state.contrasena)
                }

                when (result) {
                    is AutenticarUsuarioUseCase.AuthResult.Success -> {
                        val usuario = result.usuario

                        // Guardar o borrar credenciales según la preferencia del usuario
                        if (state.recordarAcceso) {
                            if (state.esCiudadano) {
                                credentialStorage.guardarCiudadano(state.dni, state.contrasena)
                            } else {
                                credentialStorage.guardarFuncionario(state.usuario, state.contrasena)
                            }
                        } else {
                            if (state.esCiudadano) {
                                credentialStorage.borrarCiudadano()
                            } else {
                                credentialStorage.borrarFuncionario()
                            }
                        }

                        // Navegar inmediatamente — el mensaje de bienvenida se muestra en el dashboard
                        _events.emit(LoginEvent.NavigateToDashboard(
                            tipoUsuario = usuario.tipo.name,
                            usuarioId = usuario.id,
                            entidadId = usuario.entidadId,
                            nombreUsuario = usuario.nombre
                        ))

                        // Inicializar FCM en background (token, topics, escucha push)
                        viewModelScope.launch {
                            try {
                                FCMHelper.getToken(
                                    onTokenReceived = { token ->
                                        FCMHelper.saveTokenToFirestore(token)
                                    }
                                )
                                FCMHelper.subscribeUserByType(
                                    tipoUsuario = usuario.tipo.name,
                                    entidadId = usuario.entidadId
                                )
                                NotificationPushHelper.iniciarEscuchaNotificaciones(
                                    usuarioId = usuario.id,
                                    tipoUsuario = usuario.tipo.name,
                                    entidadId = usuario.entidadId
                                )
                            } catch (e: Exception) {
                                android.util.Log.e("MiSAIP", "Error inicializando FCM post-login: ${e.message}", e)
                            }
                        }

                        // Sincronizar en background (fire-and-forget con timeout)
                        viewModelScope.launch {
                            try {
                                val syncResult = withTimeoutOrNull(8_000L) {
                                    sincronizarDatosUseCase()
                                }
                                when {
                                    syncResult == null -> android.util.Log.w("MiSAIP", "Sincronización cancelada por timeout (offline)")
                                    !syncResult.exitoso -> android.util.Log.w("MiSAIP", "Sincronización parcial: ${syncResult.errores.joinToString()}")
                                    else -> android.util.Log.d("MiSAIP", "Sincronización completada exitosamente")
                                }
                            } catch (e: Exception) {
                                android.util.Log.e("MiSAIP", "Error en sincronización post-login: ${e.message}", e)
                            }
                        }
                    }
                    is AutenticarUsuarioUseCase.AuthResult.Error -> {
                        _events.emit(LoginEvent.ShowMessage(result.mensaje))
                    }
                }
            } catch (e: Exception) {
                _events.emit(LoginEvent.ShowMessage("Error al iniciar sesión: ${e.message}"))
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun navegarARegistro() {
        viewModelScope.launch {
            _events.emit(LoginEvent.NavigateToRegister)
        }
    }
}

