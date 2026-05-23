package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.TipoUsuario
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.auth.CerrarSesionUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetSolicitudesUsuarioUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetSolicitudesEntidadUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetApelacionesUsuarioUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetTodasLasApelacionesUseCase
import com.gestion.misaip.messaging.FCMHelper
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Immutable
data class ProfileUiState(
    val nombre: String = "",
    val tipoUsuario: TipoUsuario = TipoUsuario.CIUDADANO,
    val dni: String? = null,
    val email: String? = null,
    val telefono: String? = null,
    val direccion: String? = null,
    val entidad: String? = null,
    val cargo: String? = null,
    val fechaRegistro: String = "",
    val totalSolicitudes: Int = 0,
    val respondidas: Int = 0,
    val totalApelaciones: Int = 0,
    val isLoading: Boolean = false
)

sealed class ProfileEvent {
    data class ShowMessage(val message: String) : ProfileEvent()
    object NavigateToLogin : ProfileEvent()
}

class ProfileViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val cerrarSesionUseCase: CerrarSesionUseCase,
    private val getSolicitudesUsuarioUseCase: GetSolicitudesUsuarioUseCase,
    private val getSolicitudesEntidadUseCase: GetSolicitudesEntidadUseCase,
    private val getApelacionesUsuarioUseCase: GetApelacionesUsuarioUseCase,
    private val getTodasLasApelacionesUseCase: GetTodasLasApelacionesUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<ProfileEvent>()
    val events: SharedFlow<ProfileEvent> = _events

    init {
        cargarPerfil()
    }

    fun cargarPerfil() {
        viewModelScope.launch {
            val usuario = getUsuarioActualUseCase().first() ?: return@launch

            // Estadísticas según tipo de usuario
            var totalSolicitudes = 0
            var respondidas = 0
            var totalApelaciones = 0

            when (usuario.tipo) {
                TipoUsuario.CIUDADANO -> {
                    val solicitudes = getSolicitudesUsuarioUseCase(usuario.id).first()
                    val apelaciones = getApelacionesUsuarioUseCase(usuario.id).first()
                    totalSolicitudes = solicitudes.size
                    respondidas = solicitudes.count { it.fueRespondida }
                    totalApelaciones = apelaciones.size
                }
                TipoUsuario.FUNCIONARIO -> {
                    val entidadId = usuario.entidadId
                    if (!entidadId.isNullOrBlank()) {
                        val solicitudes = getSolicitudesEntidadUseCase(entidadId).first()
                        totalSolicitudes = solicitudes.size
                        respondidas = solicitudes.count { it.fueRespondida || it.fueDenegada }
                    }
                }
                TipoUsuario.TTAIP -> {
                    val apelaciones = getTodasLasApelacionesUseCase().first()
                    totalApelaciones = apelaciones.size
                    respondidas = apelaciones.count { it.estaResuelta }
                }
                TipoUsuario.ADMIN -> {
                    // Admin no necesita estadísticas específicas en perfil
                }
            }

            _uiState.value = ProfileUiState(
                nombre = usuario.nombre,
                tipoUsuario = usuario.tipo,
                dni = usuario.dni,
                email = usuario.email,
                telefono = usuario.telefono,
                direccion = usuario.direccion,
                entidad = usuario.entidad,
                cargo = usuario.cargo,
                fechaRegistro = formatearFecha(usuario.fechaRegistro),
                totalSolicitudes = totalSolicitudes,
                respondidas = respondidas,
                totalApelaciones = totalApelaciones
            )
        }
    }

    fun cerrarSesion() {
        viewModelScope.launch {
            // Detener escucha de notificaciones push y limpiar datos de sesión
            NotificationPushHelper.detenerEscuchaNotificaciones()
            NotificationPushHelper.limpiarDatosSesion()

            // Limpiar FCM antes de cerrar sesión en el backend REST.
            val state = _uiState.value
            try {
                FCMHelper.unregisterTokenFromBackend()
                FCMHelper.unsubscribeAll(
                    tipoUsuario = state.tipoUsuario.name,
                    entidadId = state.entidad
                )
            } catch (e: Exception) {
                // No bloquear el logout por error de FCM
            }

            cerrarSesionUseCase()
            // Navegar inmediatamente sin mostrar snackbar — mejor UX
            _events.emit(ProfileEvent.NavigateToLogin)
        }
    }

    private fun formatearFecha(timestamp: Long): String {
        val sdf = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.forLanguageTag("es-PE"))
        return sdf.format(java.util.Date(timestamp))
    }
}
