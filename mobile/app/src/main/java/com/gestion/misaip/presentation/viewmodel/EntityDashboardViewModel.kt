package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.CargarSolicitudesEntidadPaginaUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.IniciarRevisionUseCase
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
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val puedeCargarMas: Boolean = false,
    val errorMessage: String? = null
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
    private val cargarSolicitudesEntidadPaginaUseCase: CargarSolicitudesEntidadPaginaUseCase,
    private val iniciarRevisionUseCase: IniciarRevisionUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(EntityDashboardUiState())
    val uiState: StateFlow<EntityDashboardUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<EntityDashboardEvent>()
    val events: SharedFlow<EntityDashboardEvent> = _events
    private var solicitudesCargadas = emptyList<Solicitud>()
    private var paginaSolicitudes = -1
    private var hayMasSolicitudes = true
    private var totalSolicitudes = 0L

    init {
        // Escuchar señal de refresh cuando llegan notificaciones push
        viewModelScope.launch {
            NotificationPushHelper.refreshSignal.collect { tipo ->
                if (tipo in listOf("nueva_solicitud", "respuesta_entidad", "vencimiento_plazo", "silencio_administrativo")) {
                    cargarDatos()
                }
            }
        }
    }

    fun cargarDatos() = cargarPagina(reiniciar = true)

    fun cargarSiguientePagina() = cargarPagina(reiniciar = false)

    private fun cargarPagina(reiniciar: Boolean) {
        viewModelScope.launch {
            if (!reiniciar && (_uiState.value.isLoadingMore || !_uiState.value.puedeCargarMas)) {
                return@launch
            }
            _uiState.value = _uiState.value.copy(
                isLoading = reiniciar,
                isLoadingMore = !reiniciar,
                errorMessage = null
            )

            val usuario = getUsuarioActualUseCase().first()
            val entidadId = usuario?.entidadId
            if (usuario == null || entidadId.isNullOrBlank()) {
                _uiState.value = _uiState.value.copy(isLoading = false, isLoadingMore = false)
                return@launch
            }

            try {
                val pagina = cargarSolicitudesEntidadPaginaUseCase(
                    entidadId = entidadId,
                    pagina = if (reiniciar) 0 else paginaSolicitudes + 1,
                    tamano = TAMANO_PAGINA
                )
                solicitudesCargadas = combinarPaginas(
                    actual = solicitudesCargadas,
                    nuevos = pagina.contenido,
                    reiniciar = reiniciar,
                    key = { it.id.ifBlank { it.expediente } }
                )
                paginaSolicitudes = pagina.pagina
                hayMasSolicitudes = pagina.tieneSiguiente
                totalSolicitudes = pagina.totalElementos
                actualizarVista(usuario.nombre, usuario.entidad ?: "", usuario.cargo ?: "")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isLoadingMore = false,
                    errorMessage = e.message ?: "No se pudo actualizar la bandeja"
                )
            }
        }
    }

    private fun actualizarVista(nombreUsuario: String, entidad: String, cargo: String) {
            val solicitudes = solicitudesCargadas
            // Calcular estadísticas desde los datos
            val estadisticas = EstadisticasEntidad(
                pendientes = solicitudes.count { it.estaPendiente },
                vencidas = solicitudes.count { it.estaVencida },
                respondidas = solicitudes.count { it.fueRespondida },
                total = totalSolicitudes.toInt()
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

            val current = _uiState.value
            val nuevoEstado = current.copy(
                nombreUsuario = nombreUsuario,
                entidad = entidad,
                cargo = cargo,
                estadisticas = estadisticas,
                solicitudes = solicitudesItems,
                solicitudesUrgentes = urgentes,
                solicitudesNotificarCostos = notificarCostos,
                isLoading = false,
                isLoadingMore = false,
                puedeCargarMas = hayMasSolicitudes
            )
            _uiState.value = nuevoEstado.copy(
                solicitudesFiltradas = filtrarSolicitudes(
                    solicitudes = solicitudesItems,
                    filtro = nuevoEstado.filtroActual,
                    busqueda = nuevoEstado.busqueda
                )
            )
    }

    fun aplicarFiltro(filtro: String) {
        _uiState.value = _uiState.value.copy(
            filtroActual = filtro,
            solicitudesFiltradas = filtrarSolicitudes(
                solicitudes = _uiState.value.solicitudes,
                filtro = filtro,
                busqueda = _uiState.value.busqueda
            )
        )
    }

    fun buscar(query: String) {
        _uiState.value = _uiState.value.copy(busqueda = query)
        aplicarFiltro(_uiState.value.filtroActual)
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

    private fun filtrarSolicitudes(
        solicitudes: List<SolicitudEntidadItem>,
        filtro: String,
        busqueda: String
    ): List<SolicitudEntidadItem> {
        val query = busqueda.lowercase()
        return solicitudes.filter { sol ->
            val matchesBusqueda = query.isEmpty() ||
                sol.expediente.lowercase().contains(query) ||
                sol.solicitante.lowercase().contains(query) ||
                sol.asunto.lowercase().contains(query)

            val matchesFiltro = when (filtro) {
                "Pendiente" -> sol.estado == "Recepcionada"
                "En Revisión" -> sol.estado == "En Revisión"
                "Vencida" -> sol.estado == "Vencida"
                "Respondida" -> sol.estado in listOf("Respondida", "Concluida")
                else -> true
            }
            matchesBusqueda && matchesFiltro
        }
    }

    private companion object {
        const val TAMANO_PAGINA = 20
    }
}

private fun <T> combinarPaginas(
    actual: List<T>,
    nuevos: List<T>,
    reiniciar: Boolean,
    key: (T) -> String
): List<T> {
    return (if (reiniciar) nuevos else actual + nuevos).distinctBy(key)
}
