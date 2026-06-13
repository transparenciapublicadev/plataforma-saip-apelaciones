package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.TimelineItem
import com.gestion.misaip.core.domain.model.TipoUsuario
import com.gestion.misaip.core.domain.model.EstadoApelacion
import com.gestion.misaip.core.domain.model.ResultadoCalificacion
import com.gestion.misaip.core.domain.model.TipoRespuesta
import com.gestion.misaip.core.domain.model.AlcanceEncauzamiento
import com.gestion.misaip.core.domain.model.CanalNotificacion
import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.core.domain.model.ElevacionApelacion
import com.gestion.misaip.core.domain.model.EstadoElevacionApelacion
import com.gestion.misaip.core.domain.model.ComunicarOmisionElevacion
import com.gestion.misaip.core.domain.model.OperacionesSolicitudFuncionario
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.entidad.GetEntidadesActivasUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetSolicitudPorExpedienteUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.RefrescarSolicitudDetalleUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.CrearSolicitudUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.ResponderSolicitudUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.IniciarRevisionUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.EmitirLiquidacionCostoSolicitudUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetOperacionesSolicitudFuncionarioUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.RegistrarAmpliacionPlazoSolicitudUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.RegistrarEncauzamientoSolicitudUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.RegistrarObservacionSolicitudUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetApelacionPorExpedienteUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.RefrescarApelacionDetalleUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetApelacionPorSAIPUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.CalificarApelacionUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.IniciarCalificacionUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.PresentarSubsanacionUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.ComunicarOmisionElevacionUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetElevacionApelacionUseCase
import com.gestion.misaip.core.domain.usecase.sync.SincronizarDatosUseCase
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.io.IOException

@Immutable
data class RequestDetailUiState(
    val expediente: String = "",
    val esApelacion: Boolean = false,
    val esSolicitud: Boolean = true,
    val solicitud: Solicitud? = null,
    val apelacion: Apelacion? = null,
    val apelacionRelacionada: Apelacion? = null,
    val elevacion: ElevacionApelacion? = null,
    val estado: String = "",
    val diasRestantes: Int? = null,
    val asunto: String = "",
    val entidad: String = "",
    val fecha: String = "",
    val telefonoRecurrente: String = "",
    val timeline: List<TimelineItem> = emptyList(),
    val tipoUsuario: TipoUsuario = TipoUsuario.CIUDADANO,
    val silencioAdministrativoAutomatico: Boolean = false,
    val puedeApelar: Boolean = false,
    val puedeIniciarRevision: Boolean = false,
    val puedeResponder: Boolean = false,
    val puedeGestionarSaip: Boolean = false,
    val puedeCalificar: Boolean = false,
    val puedeSubsanar: Boolean = false,
    val puedeComunicarOmisionElevacion: Boolean = false,
    val isLoading: Boolean = false,
    val isSubmittingOperation: Boolean = false,
    val operacionesDisponiblesOnline: Boolean = true,
    val operacionesFuncionario: OperacionesSolicitudFuncionario = OperacionesSolicitudFuncionario(),
    val entidadesDestino: List<EntidadPublica> = emptyList(),
    val formularioOperacion: FormularioOperacionFuncionario? = null,
    val showResponseForm: Boolean = false,
    val showCalificacionForm: Boolean = false,
    val showSubsanacionForm: Boolean = false,
    val showOmisionElevacionForm: Boolean = false
)

enum class FormularioOperacionFuncionario {
    OBSERVACION,
    AMPLIACION,
    ENCAUZAMIENTO,
    LIQUIDACION
}

sealed class RequestDetailEvent {
    data class ShowMessage(val message: String) : RequestDetailEvent()
    data class RespuestaRegistrada(val respuestaId: String) : RequestDetailEvent()
    object NavigateBack : RequestDetailEvent()
    data class NavigateToAppeal(val expedienteSAIP: String) : RequestDetailEvent()
}

class RequestDetailViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val getSolicitudPorExpedienteUseCase: GetSolicitudPorExpedienteUseCase,
    private val refrescarSolicitudDetalleUseCase: RefrescarSolicitudDetalleUseCase,
    private val getApelacionPorExpedienteUseCase: GetApelacionPorExpedienteUseCase,
    private val refrescarApelacionDetalleUseCase: RefrescarApelacionDetalleUseCase,
    private val getApelacionPorSAIPUseCase: GetApelacionPorSAIPUseCase,
    private val responderSolicitudUseCase: ResponderSolicitudUseCase,
    private val iniciarRevisionUseCase: IniciarRevisionUseCase,
    private val getEntidadesActivasUseCase: GetEntidadesActivasUseCase,
    private val getOperacionesSolicitudFuncionarioUseCase: GetOperacionesSolicitudFuncionarioUseCase,
    private val registrarObservacionSolicitudUseCase: RegistrarObservacionSolicitudUseCase,
    private val registrarAmpliacionPlazoSolicitudUseCase: RegistrarAmpliacionPlazoSolicitudUseCase,
    private val registrarEncauzamientoSolicitudUseCase: RegistrarEncauzamientoSolicitudUseCase,
    private val emitirLiquidacionCostoSolicitudUseCase: EmitirLiquidacionCostoSolicitudUseCase,
    private val calificarApelacionUseCase: CalificarApelacionUseCase,
    private val iniciarCalificacionUseCase: IniciarCalificacionUseCase,
    private val presentarSubsanacionUseCase: PresentarSubsanacionUseCase,
    private val getElevacionApelacionUseCase: GetElevacionApelacionUseCase,
    private val comunicarOmisionElevacionUseCase: ComunicarOmisionElevacionUseCase,
    private val sincronizarDatosUseCase: SincronizarDatosUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(RequestDetailUiState())
    val uiState: StateFlow<RequestDetailUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<RequestDetailEvent>()
    val events: SharedFlow<RequestDetailEvent> = _events

    // Expediente actual para refrescar cuando llega una notificación push en tiempo real
    private var expedienteActual: String? = null

    init {
        // Escuchar señal de refresh cuando llegan notificaciones push mientras
        // el usuario ya está viendo la página de detalle
        viewModelScope.launch {
            NotificationPushHelper.refreshSignal.collect { _ ->
                expedienteActual?.let { exp ->
                    try {
                        sincronizarDatosUseCase()
                    } catch (_: Exception) { }
                    cargarDetalleSinSync(exp)
                }
            }
        }
    }

    fun cargarDetalle(expediente: String) {
        expedienteActual = expediente
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            // Sincronizar datos desde el backend REST antes de buscar localmente.
            // Esto asegura que los datos estén disponibles cuando se abre
            // desde una notificación push en otro dispositivo.
            try {
                sincronizarDatosUseCase()
            } catch (_: Exception) {
                // Si falla la sincronización, intentar con datos locales
            }

            val solicitudActualizada = runCatching {
                refrescarSolicitudDetalleUseCase(expediente)
            }.getOrNull()
            if (solicitudActualizada == null) {
                runCatching { refrescarApelacionDetalleUseCase(expediente) }
            }

            cargarDesdeLocal(expediente)
        }
    }

    /**
     * Recarga el detalle desde la BD local sin sincronizar primero.
     * Usado por el listener de refreshSignal que ya sincronizó antes de llamar aquí.
     */
    private fun cargarDetalleSinSync(expediente: String) {
        viewModelScope.launch {
            cargarDesdeLocal(expediente)
        }
    }

    /**
     * Carga los datos del expediente desde SQLDelight y actualiza el UI state.
     * Método compartido entre cargarDetalle() y cargarDetalleSinSync().
     */
    private suspend fun cargarDesdeLocal(expediente: String) {
            val usuario = getUsuarioActualUseCase().first()
            val tipoUsuario = usuario?.tipo ?: TipoUsuario.CIUDADANO

            // Buscar como solicitud SAIP
            val solicitud = getSolicitudPorExpedienteUseCase(expediente).first()

            // Buscar como apelación TTAIP
            val apelacion = if (solicitud == null) {
                getApelacionPorExpedienteUseCase(expediente).first()
            } else null

            // Si es solicitud, buscar si tiene apelación relacionada
            val apelacionRelacionada = if (solicitud != null) {
                getApelacionPorSAIPUseCase(solicitud.expediente).first()
            } else null

            if (solicitud != null) {
                val elevacion = obtenerElevacion(apelacionRelacionada)
                // Verificar permisos según rol
                val puedeApelar = tipoUsuario == TipoUsuario.CIUDADANO &&
                    solicitud.puedeSerApelada &&
                    apelacionRelacionada == null

                val esFuncionarioEntidad = tipoUsuario == TipoUsuario.FUNCIONARIO &&
                    usuario?.entidadId == solicitud.entidadId

                val silencioAdministrativoAutomatico = solicitud.silencioAdministrativo ||
                    (solicitud.respuestaEntidad == null && (solicitud.diasRestantes ?: Int.MAX_VALUE) <= 0)

                // Solo mostrar "Iniciar Revisión" cuando está RECEPCIONADA
                val puedeIniciarRevision = esFuncionarioEntidad &&
                    solicitud.estado == com.gestion.misaip.core.domain.model.EstadoSolicitud.RECEPCIONADA

                // Mostrar "Responder" cuando está pendiente (incluye RECEPCIONADA y EN_REVISION)
                val puedeResponder = esFuncionarioEntidad &&
                    solicitud.estaPendiente &&
                    !silencioAdministrativoAutomatico

                val puedeGestionarSaip = esFuncionarioEntidad &&
                    solicitud.estaPendiente &&
                    !silencioAdministrativoAutomatico

                val operacionesPrevias = _uiState.value
                    .takeIf { it.expediente == solicitud.expediente }
                    ?.operacionesFuncionario
                    ?: OperacionesSolicitudFuncionario()
                val operacionesResultado = if (esFuncionarioEntidad) {
                    runCatching { getOperacionesSolicitudFuncionarioUseCase(solicitud.id) }
                } else null
                val entidadesDestino = if (esFuncionarioEntidad) {
                    getEntidadesActivasUseCase().first()
                        .filter { it.id != solicitud.entidadId }
                } else emptyList()

                // Ciudadano: permitir subsanar desde la vista SAIP si la apelación lo requiere
                val puedeSubsanar = tipoUsuario == TipoUsuario.CIUDADANO &&
                    apelacionRelacionada?.requiereSubsanacion == true &&
                    usuario?.id == apelacionRelacionada.usuarioId

                // Estado actual: si hay apelación activa, mostrar el estado del flujo completo
                // para que el ciudadano vea el estado real, no el estado estático de la SAIP
                val estadoActual = if (apelacionRelacionada != null) {
                    if (apelacionRelacionada.estaResuelta) {
                        apelacionRelacionada.estado.toDisplayString()
                    } else {
                        when (apelacionRelacionada.estado) {
                            EstadoApelacion.PENDIENTE_ELEVACION -> "Pendiente de Elevación"
                            EstadoApelacion.EN_CALIFICACION_1 -> "En Primera Calificación"
                            EstadoApelacion.EN_SUBSANACION -> "Requiere Subsanación"
                            EstadoApelacion.EN_CALIFICACION_2 -> "En Segunda Calificación"
                            EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION -> "Notificación Segunda Calificación"
                            EstadoApelacion.EN_RESOLUCION -> "En Resolución"
                            else -> apelacionRelacionada.estado.toDisplayString()
                        }
                    }
                } else {
                    solicitud.estado.toDisplayString()
                }

                _uiState.value = RequestDetailUiState(
                    expediente = solicitud.expediente,
                    esSolicitud = true,
                    esApelacion = false,
                    solicitud = solicitud,
                    apelacionRelacionada = apelacionRelacionada,
                    elevacion = elevacion,
                    estado = estadoActual,
                    diasRestantes = solicitud.diasRestantes,
                    asunto = solicitud.asunto,
                    entidad = solicitud.entidad,
                    fecha = formatearFecha(solicitud.fechaCreacion),
                    telefonoRecurrente = solicitud.solicitante.telefono.ifEmpty { usuario?.telefono ?: "" },
                    timeline = solicitud.timeline,
                    tipoUsuario = tipoUsuario,
                    silencioAdministrativoAutomatico = silencioAdministrativoAutomatico,
                    puedeApelar = puedeApelar,
                    puedeIniciarRevision = puedeIniciarRevision,
                    puedeResponder = puedeResponder,
                    puedeGestionarSaip = puedeGestionarSaip,
                    puedeSubsanar = puedeSubsanar,
                    puedeComunicarOmisionElevacion = puedeComunicarOmision(tipoUsuario, usuario?.id, apelacionRelacionada, elevacion),
                    operacionesDisponiblesOnline = operacionesResultado?.isSuccess ?: true,
                    operacionesFuncionario = operacionesResultado?.getOrNull() ?: operacionesPrevias,
                    entidadesDestino = entidadesDestino,
                    isLoading = false
                )
            } else if (apelacion != null) {
                val elevacion = obtenerElevacion(apelacion)
                val puedeCalificar = tipoUsuario == TipoUsuario.TTAIP &&
                    apelacion.estado in listOf(
                        EstadoApelacion.EN_CALIFICACION_1,
                        EstadoApelacion.EN_CALIFICACION_2
                    )

                val puedeSubsanar = tipoUsuario == TipoUsuario.CIUDADANO &&
                    apelacion.requiereSubsanacion &&
                    usuario?.id == apelacion.usuarioId

                // Obtener teléfono del ciudadano desde la solicitud SAIP vinculada
                val solicitudVinculada = apelacion.expedienteSAIP
                    .takeIf { it.isNotBlank() }
                    ?.let { getSolicitudPorExpedienteUseCase(it).first() }
                val telefonoCiudadano = solicitudVinculada?.solicitante?.telefono ?: ""

                _uiState.value = RequestDetailUiState(
                    expediente = apelacion.expediente,
                    esSolicitud = false,
                    esApelacion = true,
                    apelacion = apelacion,
                    elevacion = elevacion,
                    estado = apelacion.estado.toDisplayString(),
                    diasRestantes = apelacion.diasRestantes,
                    asunto = apelacion.asunto,
                    entidad = apelacion.entidad,
                    fecha = formatearFecha(apelacion.fechaPresentacion),
                    telefonoRecurrente = telefonoCiudadano,
                    timeline = apelacion.timeline,
                    tipoUsuario = tipoUsuario,
                    puedeCalificar = puedeCalificar,
                    puedeSubsanar = puedeSubsanar,
                    puedeComunicarOmisionElevacion = puedeComunicarOmision(tipoUsuario, usuario?.id, apelacion, elevacion),
                    isLoading = false
                )
            } else {
                _uiState.value = _uiState.value.copy(isLoading = false)
                _events.emit(RequestDetailEvent.ShowMessage("Trámite no encontrado"))
            }
    }

    fun mostrarFormularioRespuesta() {
        val state = _uiState.value
        if (!state.puedeResponder) {
            viewModelScope.launch {
                if (state.silencioAdministrativoAutomatico) {
                    _events.emit(
                        RequestDetailEvent.ShowMessage(
                            "Silencio administrativo aplicado automáticamente por vencimiento de plazo"
                        )
                    )
                }
            }
            return
        }
        _uiState.value = state.copy(showResponseForm = true)
    }

    fun ocultarFormularioRespuesta() {
        _uiState.value = _uiState.value.copy(showResponseForm = false)
    }

    fun responderSolicitud(tipoRespuesta: String, fundamentacion: String) {
        viewModelScope.launch {
            val solicitud = _uiState.value.solicitud ?: return@launch
            val usuario = getUsuarioActualUseCase().first()

            try {
                // Usar fromString() que maneja acentos correctamente
                // (ej: "Denegación Total" → DENEGACION_TOTAL)
                val tipoRespuestaEnum = TipoRespuesta.fromString(tipoRespuesta)

                if (tipoRespuestaEnum == TipoRespuesta.SILENCIO_ADMINISTRATIVO) {
                    _events.emit(
                        RequestDetailEvent.ShowMessage(
                            "Silencio administrativo es automático y no se registra manualmente"
                        )
                    )
                    return@launch
                }

                val respuestaRegistrada = responderSolicitudUseCase(
                    ResponderSolicitudUseCase.Params(
                        expediente = solicitud.expediente,
                        funcionario = usuario?.nombre ?: "Funcionario",
                        tipoRespuesta = tipoRespuestaEnum,
                        fundamentacion = fundamentacion
                    )
                )

                _uiState.value = _uiState.value.copy(showResponseForm = false)
                _events.emit(
                    RequestDetailEvent.RespuestaRegistrada(respuestaRegistrada.id)
                )

                // Notificar al ciudadano sobre la respuesta de la entidad
                NotificationPushHelper.notificarRespuestaEntidad(
                    expedienteSaip = solicitud.expediente,
                    usuarioId = solicitud.usuarioId,
                    tipoRespuesta = tipoRespuestaEnum.name,
                    entidadNombre = solicitud.entidad
                )

                cargarDetalle(solicitud.expediente)
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun iniciarRevision() {
        viewModelScope.launch {
            val solicitud = _uiState.value.solicitud ?: return@launch
            try {
                iniciarRevisionUseCase(solicitud.expediente)
                _events.emit(RequestDetailEvent.ShowMessage("Solicitud marcada como En Revisión"))
                cargarDetalle(solicitud.expediente)
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun recargarOperacionesFuncionario() {
        expedienteActual?.let(::cargarDetalle)
    }

    fun mostrarFormularioOperacion(tipo: FormularioOperacionFuncionario) {
        val state = _uiState.value
        if (!state.puedeGestionarSaip) return
        if (!state.operacionesDisponiblesOnline) {
            viewModelScope.launch {
                _events.emit(RequestDetailEvent.ShowMessage("Esta operación requiere conexión. Actualice el detalle e inténtelo nuevamente."))
            }
            return
        }
        _uiState.value = state.copy(formularioOperacion = tipo)
    }

    fun ocultarFormularioOperacion() {
        _uiState.value = _uiState.value.copy(formularioOperacion = null)
    }

    fun registrarObservacion(motivo: String) {
        ejecutarOperacion("Observación registrada. La SAIP queda pendiente de subsanación.") { solicitud, responsable ->
            registrarObservacionSolicitudUseCase(solicitud.id, motivo, responsable)
        }
    }

    fun registrarAmpliacion(
        motivo: String,
        informe: String,
        fechaNotificacion: String,
        entregaDescripcion: String,
        entregaFechaProgramada: String
    ) {
        ejecutarOperacion("Ampliación registrada con cronograma de entrega parcial.") { solicitud, responsable ->
            registrarAmpliacionPlazoSolicitudUseCase(
                solicitudId = solicitud.id,
                motivo = motivo,
                informe = informe,
                fechaNotificacion = fechaNotificacion,
                responsable = responsable,
                entregaDescripcion = entregaDescripcion,
                entregaFechaProgramada = entregaFechaProgramada,
                entregaObservacion = null
            )
        }
    }

    fun registrarEncauzamiento(
        entidadDestinoId: String,
        motivo: String,
        alcance: AlcanceEncauzamiento,
        sustento: String
    ) {
        ejecutarOperacion("Encauzamiento $alcance registrado correctamente.") { solicitud, responsable ->
            registrarEncauzamientoSolicitudUseCase(
                solicitudId = solicitud.id,
                entidadDestinoId = entidadDestinoId,
                motivo = motivo,
                alcance = alcance,
                responsable = responsable,
                sustento = sustento
            )
        }
    }

    fun emitirLiquidacion(
        codigo: String,
        monto: String,
        concepto: String,
        fechaNotificacion: String,
        medioNotificacion: CanalNotificacion
    ) {
        ejecutarOperacion("Liquidación o cupón emitido correctamente.") { solicitud, responsable ->
            emitirLiquidacionCostoSolicitudUseCase(
                solicitudId = solicitud.id,
                codigo = codigo,
                monto = monto,
                concepto = concepto,
                fechaNotificacion = fechaNotificacion,
                medioNotificacion = medioNotificacion,
                responsable = responsable,
                observacion = null
            )
        }
    }

    private fun ejecutarOperacion(
        mensajeExito: String,
        operacion: suspend (Solicitud, String?) -> Unit
    ) {
        viewModelScope.launch {
            val solicitud = _uiState.value.solicitud ?: return@launch
            val responsable = getUsuarioActualUseCase().first()?.nombre
            _uiState.value = _uiState.value.copy(isSubmittingOperation = true)
            try {
                operacion(solicitud, responsable)
                _uiState.value = _uiState.value.copy(
                    formularioOperacion = null,
                    isSubmittingOperation = false
                )
                _events.emit(RequestDetailEvent.ShowMessage(mensajeExito))
                cargarDetalle(solicitud.expediente)
            } catch (_: IOException) {
                _uiState.value = _uiState.value.copy(isSubmittingOperation = false)
                _events.emit(RequestDetailEvent.ShowMessage("Esta operación administrativa requiere conexión con el servidor."))
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSubmittingOperation = false)
                _events.emit(RequestDetailEvent.ShowMessage(e.message ?: "No se pudo registrar la operación"))
            }
        }
    }

    fun mostrarFormularioCalificacion() {
        _uiState.value = _uiState.value.copy(showCalificacionForm = true)
    }

    fun ocultarFormularioCalificacion() {
        _uiState.value = _uiState.value.copy(showCalificacionForm = false)
    }

    fun calificarApelacion(tipoCalificacion: String, resultado: String, fundamentacion: String) {
        viewModelScope.launch {
            val apelacion = _uiState.value.apelacion ?: return@launch

            try {
                val resultadoCal = try {
                    ResultadoCalificacion.valueOf(resultado.uppercase().replace(" ", "_"))
                } catch (e: Exception) {
                    ResultadoCalificacion.INADMISIBLE
                }

                val result = calificarApelacionUseCase(
                    CalificarApelacionUseCase.Params(
                        expediente = apelacion.expediente,
                        tipoCalificacion = tipoCalificacion,
                        resultado = resultadoCal,
                        fundamentacion = fundamentacion
                    )
                )

                when (result) {
                    is CalificarApelacionUseCase.Result.Success -> {
                        _uiState.value = _uiState.value.copy(showCalificacionForm = false)
                        _events.emit(RequestDetailEvent.ShowMessage("Calificación $tipoCalificacion registrada: $resultado"))

                        // Notificar al ciudadano sobre la calificación del TTAIP
                        NotificationPushHelper.notificarCalificacionTTAIP(
                            expediente = apelacion.expediente,
                            usuarioId = apelacion.usuarioId,
                            resultado = resultado,
                            tipoCalificacion = tipoCalificacion
                        )

                        cargarDetalle(apelacion.expediente)
                    }
                    is CalificarApelacionUseCase.Result.Error -> {
                        _events.emit(RequestDetailEvent.ShowMessage(result.mensaje))
                    }
                }
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun iniciarCalificacion() {
        viewModelScope.launch {
            val apelacion = _uiState.value.apelacion ?: return@launch
            try {
                iniciarCalificacionUseCase(apelacion.expediente)
                _events.emit(RequestDetailEvent.ShowMessage("Apelación en calificación"))
                cargarDetalle(apelacion.expediente)
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun mostrarFormularioSubsanacion() {
        _uiState.value = _uiState.value.copy(showSubsanacionForm = true)
    }

    fun ocultarFormularioSubsanacion() {
        _uiState.value = _uiState.value.copy(showSubsanacionForm = false)
    }

    fun presentarSubsanacion(textoCorregido: String, fundamentoLegal: String) {
        viewModelScope.launch {
            // Soportar subsanación desde vista SAIP (apelacionRelacionada) y vista apelación (apelacion)
            val apelacion = _uiState.value.apelacion ?: _uiState.value.apelacionRelacionada ?: return@launch

            try {
                val result = presentarSubsanacionUseCase(
                    PresentarSubsanacionUseCase.Params(
                        expediente = apelacion.expediente,
                        textoCorregido = textoCorregido,
                        fundamentoLegalCorregido = fundamentoLegal
                    )
                )

                when (result) {
                    is PresentarSubsanacionUseCase.Result.Success -> {
                        _uiState.value = _uiState.value.copy(showSubsanacionForm = false)
                        _events.emit(RequestDetailEvent.ShowMessage("Subsanación presentada exitosamente"))

                        // Notificar al TTAIP que el ciudadano presentó subsanación
                        NotificationPushHelper.notificarSubsanacionPresentada(
                            expediente = apelacion.expediente,
                            recurrente = apelacion.apelante.nombre
                        )

                        // Recargar desde el expediente actual (SAIP o apelación)
                        cargarDetalle(_uiState.value.expediente)
                    }
                    is PresentarSubsanacionUseCase.Result.Error -> {
                        _events.emit(RequestDetailEvent.ShowMessage(result.mensaje))
                    }
                }
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun navegarAApelar() {
        viewModelScope.launch {
            val solicitud = _uiState.value.solicitud ?: return@launch
            _events.emit(RequestDetailEvent.NavigateToAppeal(solicitud.expediente))
        }
    }

    fun mostrarFormularioOmisionElevacion() {
        if (_uiState.value.puedeComunicarOmisionElevacion) {
            _uiState.value = _uiState.value.copy(showOmisionElevacionForm = true)
        }
    }

    fun ocultarFormularioOmisionElevacion() {
        _uiState.value = _uiState.value.copy(showOmisionElevacionForm = false)
    }

    fun comunicarOmisionElevacion(referenciaPrueba: String, observacion: String) {
        viewModelScope.launch {
            val apelacion = _uiState.value.apelacion ?: _uiState.value.apelacionRelacionada ?: return@launch
            try {
                comunicarOmisionElevacionUseCase(
                    apelacionId = apelacion.id,
                    request = ComunicarOmisionElevacion(
                        referenciaPruebaOmision = referenciaPrueba,
                        observacion = observacion.ifBlank { null }
                    )
                )
                _uiState.value = _uiState.value.copy(showOmisionElevacionForm = false)
                _events.emit(RequestDetailEvent.ShowMessage("Omisión de elevación comunicada al TTAIP"))
                cargarDetalle(_uiState.value.expediente)
            } catch (_: IOException) {
                _events.emit(RequestDetailEvent.ShowMessage("Esta operación requiere conexión con el servidor."))
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage(e.message ?: "No se pudo comunicar la omisión"))
            }
        }
    }

    private suspend fun obtenerElevacion(apelacion: Apelacion?): ElevacionApelacion? {
        if (apelacion?.estado != EstadoApelacion.PENDIENTE_ELEVACION) return apelacion?.elevacion
        return runCatching { getElevacionApelacionUseCase(apelacion.id) }.getOrNull() ?: apelacion.elevacion
    }

    private fun puedeComunicarOmision(
        tipoUsuario: TipoUsuario,
        usuarioId: String?,
        apelacion: Apelacion?,
        elevacion: ElevacionApelacion?
    ): Boolean {
        return tipoUsuario == TipoUsuario.CIUDADANO &&
            usuarioId == apelacion?.usuarioId &&
            elevacion?.estado in setOf(
                EstadoElevacionApelacion.PENDIENTE,
                EstadoElevacionApelacion.VENCIDA_NO_ELEVADA
            )
    }

    private fun formatearFecha(timestamp: Long): String {
        val sdf = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.forLanguageTag("es-PE"))
        return sdf.format(java.util.Date(timestamp))
    }
}

