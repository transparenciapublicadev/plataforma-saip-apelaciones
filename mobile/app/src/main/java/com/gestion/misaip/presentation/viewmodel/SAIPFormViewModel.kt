package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.CrearSolicitudUseCase
import com.gestion.misaip.core.domain.usecase.entidad.GetEntidadesActivasUseCase
import com.gestion.misaip.core.domain.usecase.sync.SincronizarDatosUseCase
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@Immutable
data class SAIPFormUiState(
    val entidadId: String = "",
    val entidadNombre: String = "",
    val asunto: String = "",
    val descripcion: String = "",
    val entidades: List<EntidadPublica> = emptyList(),
    val isLoading: Boolean = false,
    val errorAsunto: String? = null,
    val errorDescripcion: String? = null,
    val errorEntidad: String? = null
)

sealed class SAIPFormEvent {
    data class ShowMessage(val message: String) : SAIPFormEvent()
    data class SolicitudCreada(val expediente: String) : SAIPFormEvent()
    object NavigateBack : SAIPFormEvent()
}

class SAIPFormViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val getEntidadesActivasUseCase: GetEntidadesActivasUseCase,
    private val crearSolicitudUseCase: CrearSolicitudUseCase,
    private val sincronizarDatosUseCase: SincronizarDatosUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(SAIPFormUiState())
    val uiState: StateFlow<SAIPFormUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<SAIPFormEvent>()
    val events: SharedFlow<SAIPFormEvent> = _events

    // Evitar sincronizar más de una vez
    private var sincronizacionIniciada = false

    init {
        cargarEntidades()
    }

    // Limpiar formulario para reutilización del ViewModel
    fun limpiarFormulario() {
        _uiState.value = SAIPFormUiState(
            entidades = _uiState.value.entidades
        )
    }

    private fun cargarEntidades() {
        viewModelScope.launch {
            getEntidadesActivasUseCase().collectLatest { listaEntidades ->
                val entidades = listaEntidades
                _uiState.value = _uiState.value.copy(entidades = entidades)

                // Si la BD local está vacía, sincronizar desde el backend REST
                if (entidades.isEmpty() && !sincronizacionIniciada) {
                    sincronizacionIniciada = true
                    viewModelScope.launch {
                        try {
                            sincronizarDatosUseCase()
                        } catch (_: Exception) { }
                    }
                }
            }
        }
    }

    fun seleccionarEntidad(entidadId: String) {
        val entidad = _uiState.value.entidades.find { it.id == entidadId }
        _uiState.value = _uiState.value.copy(
            entidadId = entidadId,
            entidadNombre = entidad?.nombre ?: "",
            errorEntidad = null
        )
    }

    fun actualizarAsunto(asunto: String) {
        _uiState.value = _uiState.value.copy(
            asunto = asunto,
            errorAsunto = null
        )
    }

    fun actualizarDescripcion(descripcion: String) {
        _uiState.value = _uiState.value.copy(
            descripcion = descripcion,
            errorDescripcion = null
        )
    }

    fun validarYEnviar() {
        viewModelScope.launch {
            val state = _uiState.value
            var hasError = false

            // Validaciones
            if (state.entidadId.isEmpty()) {
                _uiState.value = _uiState.value.copy(errorEntidad = "Seleccione una entidad")
                hasError = true
            }

            if (state.asunto.isBlank()) {
                _uiState.value = _uiState.value.copy(errorAsunto = "El asunto es obligatorio")
                hasError = true
            } else if (state.asunto.length < 10) {
                _uiState.value = _uiState.value.copy(errorAsunto = "El asunto debe tener al menos 10 caracteres")
                hasError = true
            }

            if (state.descripcion.isBlank()) {
                _uiState.value = _uiState.value.copy(errorDescripcion = "La descripción es obligatoria")
                hasError = true
            } else if (state.descripcion.length < 20) {
                _uiState.value = _uiState.value.copy(errorDescripcion = "La descripción debe tener al menos 20 caracteres")
                hasError = true
            }

            if (hasError) {
                val errores = mutableListOf<String>()
                if (state.entidadId.isEmpty()) errores.add("entidad")
                if (state.asunto.isBlank() || state.asunto.length < 10) errores.add("asunto")
                if (state.descripcion.isBlank() || state.descripcion.length < 20) errores.add("descripción")
                _events.emit(SAIPFormEvent.ShowMessage("Complete los campos: ${errores.joinToString(", ")}"))
                return@launch
            }

            // Crear solicitud
            _uiState.value = _uiState.value.copy(isLoading = true)

            try {
                val usuario = getUsuarioActualUseCase().first()
                if (usuario == null) {
                    _events.emit(SAIPFormEvent.ShowMessage("Error: usuario no encontrado"))
                    return@launch
                }

                val entidad = state.entidades.find { it.id == state.entidadId }

                val coreSolicitud = crearSolicitudUseCase(
                    CrearSolicitudUseCase.Params(
                        tipo = com.gestion.misaip.core.domain.model.TipoSolicitud.ACCESO_INFORMACION,
                        entidad = entidad?.nombre ?: "",
                        entidadId = state.entidadId,
                        usuarioId = usuario.id,
                        solicitante = com.gestion.misaip.core.domain.model.Solicitante(
                            nombre = usuario.nombre,
                            dni = usuario.dni ?: "",
                            email = usuario.email ?: "",
                            telefono = usuario.telefono ?: "",
                            direccion = usuario.direccion ?: ""
                        ),
                        asunto = state.asunto,
                        descripcion = state.descripcion
                    )
                )

                val solicitud = coreSolicitud

                // Notificar a funcionarios de la entidad sobre la nueva solicitud
                NotificationPushHelper.notificarNuevaSolicitud(
                    expedienteSaip = solicitud.expediente,
                    entidadId = state.entidadId,
                    entidadNombre = entidad?.nombre ?: "",
                    solicitante = usuario.nombre
                )

                // Navegar al dashboard con mensaje de éxito
                _events.emit(SAIPFormEvent.SolicitudCreada(solicitud.expediente))

            } catch (e: Exception) {
                _events.emit(SAIPFormEvent.ShowMessage("Error al crear la solicitud: ${e.message}"))
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }
}
