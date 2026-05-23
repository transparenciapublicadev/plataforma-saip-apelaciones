package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetSolicitudesEntidadUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.IniciarRevisionUseCase
import com.gestion.misaip.core.domain.usecase.sync.SincronizarDatosUseCase
import com.gestion.misaip.data.EstadisticasEntidad
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Immutable
data class EntityDashboardUiState(
    val nombreUsuario: String = "",
    val entidad: String = "",
    val cargo: String = "",
    val estadisticas: EstadisticasEntidad = EstadisticasEntidad(0, 0, 0, 0),
    val solicitudes: List<SolicitudEntidadItem> = emptyList(),
    val solicitudesFiltradas: List<SolicitudEntidadItem> = emptyList(),
    val filtroActual: String = "todas",
    val busqueda: String = "",
    val solicitudesUrgentes: List<Solicitud> = emptyList(),
    val solicitudesNotificarCostos: List<Solicitud> = emptyList(),
    val isLoading: Boolean = false
)

data class SolicitudEntidadItem(
    val expediente: String,
    val asunto: String,
    val solicitante: String,
    val fecha: String,
    val estado: String,
    val diasRestantes: Int?,
    val prioridad: String
)

sealed class EntityDashboardEvent {
    data class ShowMessage(val message: String) : EntityDashboardEvent()
    data class NavigateToDetail(val expediente: String) : EntityDashboardEvent()
}

class EntityDashboardViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val getSolicitudesEntidadUseCase: GetSolicitudesEntidadUseCase,
    private val iniciarRevisionUseCase: IniciarRevisionUseCase,
    private val sincronizarDatosUseCase: SincronizarDatosUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(EntityDashboardUiState())
    val uiState: StateFlow<EntityDashboardUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<EntityDashboardEvent>()
    val events: SharedFlow<EntityDashboardEvent> = _events

    init {
        sincronizarYRecargar()
        // Escuchar señal de refresh cuando llegan notificaciones push
        viewModelScope.launch {
            NotificationPushHelper.refreshSignal.collect { tipo ->
                if (tipo in listOf("nueva_solicitud", "respuesta_entidad", "vencimiento_plazo", "silencio_administrativo")) {
                    sincronizarYRecargar()
                }
            }
        }
    }

    fun cargarDatos() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            val usuario = getUsuarioActualUseCase().first()
            val entidadId = usuario?.entidadId
            if (usuario == null || entidadId.isNullOrBlank()) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return@launch
            }

            val solicitudes = getSolicitudesEntidadUseCase(entidadId).first()

            // Calcular estadísticas desde los datos
            val estadisticas = EstadisticasEntidad(
                pendientes = solicitudes.count { it.estaPendiente },
                vencidas = solicitudes.count { it.estaVencida },
                respondidas = solicitudes.count { it.fueRespondida },
                total = solicitudes.size
            )

            val solicitudesItems = solicitudes.map { sol ->
                SolicitudEntidadItem(
                    expediente = sol.expediente,
                    asunto = sol.asunto,
                    solicitante = sol.solicitante.nombre,
                    fecha = formatearFecha(sol.fechaCreacion),
                    estado = sol.estado.toDisplayString(),
                    diasRestantes = sol.diasRestantes,
                    prioridad = sol.prioridad.name.lowercase()
                )
            }

            // Solicitudes urgentes (vencidas)
            val urgentes = solicitudes.filter { it.estaVencida }

            // Solicitudes que necesitan notificar liquidación de costos (día 9)
            val notificarCostos = solicitudes.filter {
                it.diasRestantes == 1 && it.estaPendiente
            }

            _uiState.value = EntityDashboardUiState(
                nombreUsuario = usuario.nombre,
                entidad = usuario.entidad ?: "",
                cargo = usuario.cargo ?: "",
                estadisticas = estadisticas,
                solicitudes = solicitudesItems,
                solicitudesFiltradas = solicitudesItems,
                solicitudesUrgentes = urgentes,
                solicitudesNotificarCostos = notificarCostos,
                isLoading = false
            )
        }
    }

    fun aplicarFiltro(filtro: String) {
        val solicitudes = _uiState.value.solicitudes
        val busqueda = _uiState.value.busqueda.lowercase()

        val filtradas = solicitudes.filter { sol ->
            val matchesBusqueda = busqueda.isEmpty() ||
                sol.expediente.lowercase().contains(busqueda) ||
                sol.solicitante.lowercase().contains(busqueda) ||
                sol.asunto.lowercase().contains(busqueda)

            val matchesFiltro = when (filtro) {
                "Pendiente" -> sol.estado == "Recepcionada"
                "En Revisión" -> sol.estado == "En Revisión"
                "Vencida" -> sol.estado == "Vencida"
                "Respondida" -> sol.estado in listOf("Respondida", "Concluida")
                else -> true
            }

            matchesBusqueda && matchesFiltro
        }

        _uiState.value = _uiState.value.copy(
            filtroActual = filtro,
            solicitudesFiltradas = filtradas
        )
    }

    fun buscar(query: String) {
        _uiState.value = _uiState.value.copy(busqueda = query)
        aplicarFiltro(_uiState.value.filtroActual)
    }

    /**
     * Sincroniza datos desde el backend REST y recarga la UI.
     * Se ejecuta cuando se recibe una notificación push relevante.
     */
    private fun sincronizarYRecargar() {
        viewModelScope.launch {
            try {
                sincronizarDatosUseCase()
            } catch (_: Exception) {
                // Si falla la sincronización, intentar recargar datos locales de todas formas
            }
            cargarDatos()
        }
    }

    fun iniciarRevision(expediente: String) {
        viewModelScope.launch {
            try {
                iniciarRevisionUseCase(expediente)
                _events.emit(EntityDashboardEvent.ShowMessage("Solicitud marcada como En Revisión"))
                // Recargar datos; cargarDatos() lanza otro coroutine,
                // pero lo llamamos directamente aquí para que la UI se actualice
                cargarDatos()
            } catch (e: Exception) {
                _events.emit(EntityDashboardEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    private fun formatearFecha(timestamp: Long): String {
        val sdf = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.forLanguageTag("es-PE"))
        return sdf.format(java.util.Date(timestamp))
    }
}
