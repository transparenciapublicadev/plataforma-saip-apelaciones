package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetSolicitudesUsuarioUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetApelacionesUsuarioUseCase
import com.gestion.misaip.core.domain.usecase.sync.SincronizarDatosUseCase
import com.gestion.misaip.data.EstadisticasCiudadano
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Immutable
data class CitizenDashboardUiState(
    val nombreUsuario: String = "",
    val estadisticas: EstadisticasCiudadano = EstadisticasCiudadano(0, 0, 0, 0),
    val expedientes: List<ExpedienteItem> = emptyList(),
    val expedientesFiltrados: List<ExpedienteItem> = emptyList(),
    val filtroActual: String = "todas",
    val busqueda: String = "",
    val solicitudesApelables: List<Solicitud> = emptyList(),
    val apelacionesPendientesSubsanacion: List<Apelacion> = emptyList(),
    val isLoading: Boolean = false
)

data class ExpedienteItem(
    val expediente: String,
    val asunto: String,
    val entidad: String,
    val fecha: String,
    val estado: String,
    val diasRestantes: Int?,
    val tipo: String, // "SAIP" o "Apelación"
    val apelacionVinculada: ApelacionVinculada? = null // Apelación derivada de esta SAIP
)

/**
 * Información resumida de la apelación vinculada a una solicitud SAIP.
 * Se muestra como sub-sección dentro de la tarjeta SAIP.
 */
data class ApelacionVinculada(
    val expediente: String,  // Formato NNNNN-AAAA-JUS/TTAIP
    val estado: String,
    val fecha: String
)

class CitizenDashboardViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val getSolicitudesUsuarioUseCase: GetSolicitudesUsuarioUseCase,
    private val getApelacionesUsuarioUseCase: GetApelacionesUsuarioUseCase,
    private val sincronizarDatosUseCase: SincronizarDatosUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(CitizenDashboardUiState())
    val uiState: StateFlow<CitizenDashboardUiState> = _uiState.asStateFlow()

    init {
        sincronizarYRecargar()
        // Escuchar señal de refresh cuando llegan notificaciones push
        viewModelScope.launch {
            NotificationPushHelper.refreshSignal.collect { tipo ->
                if (tipo in listOf("respuesta_entidad", "calificacion_ttaip", "subsanacion_requerida", "silencio_administrativo")) {
                    sincronizarYRecargar()
                }
            }
        }
    }

    fun cargarDatos() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            val usuario = getUsuarioActualUseCase().first()
            if (usuario == null) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return@launch
            }

            val solicitudes = getSolicitudesUsuarioUseCase(usuario.id).first()
            val apelaciones = getApelacionesUsuarioUseCase(usuario.id).first()

            // Calcular estadísticas desde los datos
            val estadisticas = EstadisticasCiudadano(
                total = solicitudes.size,
                enProceso = solicitudes.count { it.estaPendiente },
                respondidas = solicitudes.count { it.fueRespondida },
                denegadas = solicitudes.count { it.fueDenegada }
            )

            val expedientes = mutableListOf<ExpedienteItem>()

            // Mapa de apelaciones indexadas por expedienteSAIP para búsqueda rápida
            val apelacionesPorSAIP = apelaciones.associateBy { it.expedienteSAIP }

            // Agregar solicitudes (con apelación vinculada si existe)
            solicitudes.forEach { sol ->
                val apelVinculada = apelacionesPorSAIP[sol.expediente]

                // Estado estratégico del flujo: mostrar al ciudadano qué está ocurriendo
                // con su trámite de forma clara, evitando confusión entre estado SAIP y apelación
                val estadoFlujo = if (apelVinculada != null) {
                    if (apelVinculada.estaResuelta) {
                        apelVinculada.estado.toDisplayString()
                    } else {
                        when (apelVinculada.estado) {
                            com.gestion.misaip.core.domain.model.EstadoApelacion.EN_SUBSANACION ->
                                "Requiere Subsanación"
                            com.gestion.misaip.core.domain.model.EstadoApelacion.EN_CALIFICACION_2 ->
                                "En Segunda Calificación"
                            com.gestion.misaip.core.domain.model.EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION ->
                                "Notificación Segunda Calificación"
                            com.gestion.misaip.core.domain.model.EstadoApelacion.EN_RESOLUCION ->
                                "En Resolución"
                            else -> "En Apelación"
                        }
                    }
                } else {
                    sol.estado.toDisplayString()
                }

                expedientes.add(
                    ExpedienteItem(
                        expediente = sol.expediente,
                        asunto = sol.asunto,
                        entidad = sol.entidad,
                        fecha = formatearFecha(sol.fechaCreacion),
                        estado = estadoFlujo,
                        diasRestantes = sol.diasRestantes,
                        tipo = "SAIP",
                        apelacionVinculada = apelVinculada?.let {
                            ApelacionVinculada(
                                expediente = it.expediente,
                                estado = it.estado.toDisplayString(),
                                fecha = formatearFecha(it.fechaPresentacion)
                            )
                        }
                    )
                )
            }

            // Agregar solo apelaciones huérfanas (sin solicitud SAIP vinculada en local)
            val expedientesSAIP = solicitudes.map { it.expediente }.toSet()
            apelaciones.filter { it.expedienteSAIP !in expedientesSAIP }.forEach { apel ->
                expedientes.add(
                    ExpedienteItem(
                        expediente = apel.expediente,
                        asunto = apel.asunto,
                        entidad = apel.entidad,
                        fecha = formatearFecha(apel.fechaPresentacion),
                        estado = apel.estado.toDisplayString(),
                        diasRestantes = apel.diasRestantes,
                        tipo = "Apelación"
                    )
                )
            }

            // Solicitudes que pueden ser apeladas
            val apelables = solicitudes.filter {
                it.puedeSerApelada &&
                apelaciones.none { apel -> apel.expedienteSAIP == it.expediente }
            }

            // Apelaciones pendientes de subsanación
            val pendientesSubsanacion = apelaciones.filter { it.requiereSubsanacion }

            _uiState.value = CitizenDashboardUiState(
                nombreUsuario = usuario.nombre,
                estadisticas = estadisticas,
                expedientes = expedientes,
                expedientesFiltrados = expedientes,
                solicitudesApelables = apelables,
                apelacionesPendientesSubsanacion = pendientesSubsanacion,
                isLoading = false
            )
        }
    }

    /**
     * Sincroniza datos desde Firestore y recarga la UI.
     * Se ejecuta cuando se recibe una notificación push relevante.
     */
    private fun sincronizarYRecargar() {
        viewModelScope.launch {
            try {
                sincronizarDatosUseCase()
            } catch (_: Exception) { }
            cargarDatos()
        }
    }

    fun aplicarFiltro(filtro: String) {
        val expedientes = _uiState.value.expedientes
        val busqueda = _uiState.value.busqueda.lowercase()

        val filtrados = expedientes.filter { exp ->
            val matchesBusqueda = busqueda.isEmpty() ||
                exp.expediente.lowercase().contains(busqueda) ||
                exp.asunto.lowercase().contains(busqueda) ||
                exp.apelacionVinculada?.expediente?.lowercase()?.contains(busqueda) == true

            val matchesFiltro = when (filtro) {
                "SAIP" -> exp.tipo == "SAIP" && exp.apelacionVinculada == null
                "Apelación" -> exp.tipo == "Apelación" || exp.apelacionVinculada != null
                "En Proceso" -> {
                    val estadosEnProceso = listOf("En Revisión", "Recepcionada", "En Calificación", "Pendiente", "En Subsanación")
                    exp.estado in estadosEnProceso || exp.apelacionVinculada?.estado?.let { it in estadosEnProceso } == true
                }
                "Respondida" -> exp.estado == "Respondida"
                "Denegada" -> exp.estado in listOf("Denegada", "Vencida")
                else -> true
            }

            matchesBusqueda && matchesFiltro
        }

        _uiState.value = _uiState.value.copy(
            filtroActual = filtro,
            expedientesFiltrados = filtrados
        )
    }

    fun buscar(query: String) {
        _uiState.value = _uiState.value.copy(busqueda = query)
        aplicarFiltro(_uiState.value.filtroActual)
    }

    private fun formatearFecha(timestamp: Long): String {
        val sdf = SimpleDateFormat("dd MMM yyyy", Locale.forLanguageTag("es-PE"))
        return sdf.format(Date(timestamp))
    }
}

