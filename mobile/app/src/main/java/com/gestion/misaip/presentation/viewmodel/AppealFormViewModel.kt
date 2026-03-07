package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetSolicitudPorExpedienteUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetApelacionPorSAIPUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.CrearApelacionUseCase
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Immutable
data class AppealFormUiState(
    val expedienteSAIP: String = "",
    val solicitudEncontrada: Solicitud? = null,
    val fundamentoLegal: String = "",
    val exposicionHechos: String = "",
    val pretension: String = "",
    val aceptaDeclaracion: Boolean = false,
    val isLoading: Boolean = false,
    val errorExpediente: String? = null,
    val errorFundamentoLegal: String? = null,
    val errorHechos: String? = null,
    val errorPretension: String? = null
)

sealed class AppealFormEvent {
    data class ShowMessage(val message: String) : AppealFormEvent()
    data class ApelacionCreada(val expediente: String) : AppealFormEvent()
    object NavigateBack : AppealFormEvent()
}

class AppealFormViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val getSolicitudPorExpedienteUseCase: GetSolicitudPorExpedienteUseCase,
    private val getApelacionPorSAIPUseCase: GetApelacionPorSAIPUseCase,
    private val crearApelacionUseCase: CrearApelacionUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(AppealFormUiState())
    val uiState: StateFlow<AppealFormUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<AppealFormEvent>()
    val events: SharedFlow<AppealFormEvent> = _events

    fun setExpedienteSAIP(expediente: String) {
        _uiState.value = _uiState.value.copy(
            expedienteSAIP = expediente,
            errorExpediente = null
        )
    }

    fun buscarExpediente() {
        viewModelScope.launch {
            val expediente = _uiState.value.expedienteSAIP

            if (expediente.isBlank()) {
                _events.emit(AppealFormEvent.ShowMessage("Ingrese un número de expediente"))
                return@launch
            }

            val solicitud = getSolicitudPorExpedienteUseCase(expediente).first()

            if (solicitud == null) {
                _uiState.value = _uiState.value.copy(
                    errorExpediente = "Solicitud SAIP no encontrada",
                    solicitudEncontrada = null
                )
                _events.emit(AppealFormEvent.ShowMessage("Solicitud SAIP no encontrada"))
                return@launch
            }

            // Verificar que pertenece al usuario actual
            val usuarioActual = getUsuarioActualUseCase().first()
            if (usuarioActual != null && solicitud.usuarioId != usuarioActual.id) {
                _uiState.value = _uiState.value.copy(
                    errorExpediente = "Este expediente no le pertenece",
                    solicitudEncontrada = null
                )
                _events.emit(AppealFormEvent.ShowMessage("Este expediente no le pertenece"))
                return@launch
            }

            // Verificar que puede ser apelada
            if (!solicitud.puedeSerApelada) {
                _uiState.value = _uiState.value.copy(
                    errorExpediente = "Solo puede apelar solicitudes denegadas o vencidas",
                    solicitudEncontrada = null
                )
                _events.emit(AppealFormEvent.ShowMessage("Solo puede apelar solicitudes denegadas o vencidas"))
                return@launch
            }

            // Verificar si ya tiene apelación
            val apelacionExistente = getApelacionPorSAIPUseCase(expediente).first()
            if (apelacionExistente != null) {
                _uiState.value = _uiState.value.copy(
                    errorExpediente = "Ya existe una apelación: ${apelacionExistente.expediente}",
                    solicitudEncontrada = null
                )
                _events.emit(AppealFormEvent.ShowMessage("Ya existe una apelación para este expediente"))
                return@launch
            }

            _uiState.value = _uiState.value.copy(
                solicitudEncontrada = solicitud,
                errorExpediente = null
            )
            _events.emit(AppealFormEvent.ShowMessage("Expediente encontrado"))
        }
    }

    fun actualizarFundamentoLegal(texto: String) {
        _uiState.value = _uiState.value.copy(
            fundamentoLegal = texto,
            errorFundamentoLegal = null
        )
    }

    fun actualizarExposicionHechos(texto: String) {
        _uiState.value = _uiState.value.copy(
            exposicionHechos = texto,
            errorHechos = null
        )
    }

    fun actualizarPretension(texto: String) {
        _uiState.value = _uiState.value.copy(
            pretension = texto,
            errorPretension = null
        )
    }

    fun toggleDeclaracionJurada() {
        _uiState.value = _uiState.value.copy(
            aceptaDeclaracion = !_uiState.value.aceptaDeclaracion
        )
    }

    fun validarYEnviar() {
        viewModelScope.launch {
            val state = _uiState.value
            var hasError = false

            if (state.solicitudEncontrada == null) {
                _events.emit(AppealFormEvent.ShowMessage("Primero busque un expediente válido"))
                return@launch
            }

            if (state.fundamentoLegal.isBlank()) {
                _uiState.value = _uiState.value.copy(errorFundamentoLegal = "El fundamento legal es obligatorio")
                hasError = true
            }

            if (state.exposicionHechos.isBlank()) {
                _uiState.value = _uiState.value.copy(errorHechos = "La exposición de hechos es obligatoria")
                hasError = true
            }

            if (state.pretension.isBlank()) {
                _uiState.value = _uiState.value.copy(errorPretension = "La pretensión es obligatoria")
                hasError = true
            }

            if (!state.aceptaDeclaracion) {
                _events.emit(AppealFormEvent.ShowMessage("Debe aceptar la declaración jurada"))
                hasError = true
            }

            if (hasError) {
                _events.emit(AppealFormEvent.ShowMessage("Por favor complete todos los campos obligatorios"))
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true)

            try {
                val usuario = getUsuarioActualUseCase().first()
                if (usuario == null) {
                    _events.emit(AppealFormEvent.ShowMessage("Error: usuario no encontrado"))
                    return@launch
                }

                val result = crearApelacionUseCase(
                    CrearApelacionUseCase.Params(
                        expedienteSAIP = state.expedienteSAIP,
                        usuarioId = usuario.id,
                        apelante = com.gestion.misaip.core.domain.model.Apelante(
                            nombre = usuario.nombre,
                            dni = usuario.dni ?: "",
                            email = usuario.email ?: ""
                        ),
                        fundamentoLegal = state.fundamentoLegal,
                        exposicionHechos = state.exposicionHechos,
                        pretension = state.pretension
                    )
                )

                when (result) {
                    is CrearApelacionUseCase.Result.Success -> {
                        val apelacion = result.apelacion
                        _events.emit(AppealFormEvent.ApelacionCreada(apelacion.expediente))
                        _events.emit(AppealFormEvent.ShowMessage("Apelación ${apelacion.expediente} presentada exitosamente"))

                        // Notificar al TTAIP sobre la nueva apelación
                        NotificationPushHelper.notificarNuevaApelacion(
                            expedienteApelacion = apelacion.expediente,
                            saipOrigen = state.expedienteSAIP,
                            recurrente = usuario.nombre,
                            entidadNombre = state.solicitudEncontrada?.entidad ?: ""
                        )

                        kotlinx.coroutines.delay(1500)
                        _events.emit(AppealFormEvent.NavigateBack)
                    }
                    is CrearApelacionUseCase.Result.Error -> {
                        _events.emit(AppealFormEvent.ShowMessage(result.mensaje))
                    }
                }

            } catch (e: Exception) {
                _events.emit(AppealFormEvent.ShowMessage("Error al crear la apelación: ${e.message}"))
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }
}

