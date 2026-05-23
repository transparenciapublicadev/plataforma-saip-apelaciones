package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.auth.GetTodosLosUsuariosUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetTodasLasSolicitudesUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetTodasLasApelacionesUseCase
import com.gestion.misaip.core.domain.usecase.entidad.GetEntidadesActivasUseCase
import com.gestion.misaip.core.domain.usecase.sync.SincronizarDatosUseCase
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.Usuario
import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

// =============================================================================
// Estado UI del Panel de Administración
// =============================================================================

@Immutable
data class AdminDashboardUiState(
    val nombreUsuario: String = "",
    // Estadísticas principales
    val totalSolicitudes: Int = 0,
    val totalUsuarios: Int = 0,
    val totalApelaciones: Int = 0,
    val apelacionesResueltas: Int = 0,
    // Desglose de solicitudes por estado
    val solicitudesPendientes: Int = 0,
    val solicitudesRespondidas: Int = 0,
    val solicitudesDenegadas: Int = 0,
    val solicitudesVencidas: Int = 0,
    // Desglose de apelaciones por estado
    val apelacionesPendientes: Int = 0,
    val apelacionesEnCalificacion: Int = 0,
    val apelacionesFundadas: Int = 0,
    val apelacionesInfundadas: Int = 0,
    // Desglose de usuarios por tipo
    val ciudadanos: Int = 0,
    val funcionarios: Int = 0,
    val vocalesTTAIP: Int = 0,
    // Datos dinámicos
    val actividadReciente: List<ActividadItem> = emptyList(),
    val entidadesConStats: List<EntidadStatsItem> = emptyList(),
    val ultimaActualizacion: String = "",
    val isLoading: Boolean = false,
    // Datos crudos para exportación
    val solicitudesRaw: List<Solicitud> = emptyList(),
    val apelacionesRaw: List<Apelacion> = emptyList(),
    val usuariosRaw: List<Usuario> = emptyList(),
    val entidadesRaw: List<EntidadPublica> = emptyList()
)

data class ActividadItem(
    val tipo: String,
    val descripcion: String,
    val usuario: String,
    val fecha: String,
    val timestamp: Long = 0L
)

data class EntidadStatsItem(
    val nombre: String,
    val solicitudes: Int,
    val pendientes: Int,
    val respondidas: Int = 0,
    val vencidas: Int = 0
)

// =============================================================================
// Eventos one-shot del Panel de Administración
// =============================================================================

sealed class AdminDashboardEvent {
    data class ShowMessage(val message: String) : AdminDashboardEvent()
    data class ExportReady(val filePath: String, val mimeType: String) : AdminDashboardEvent()
    data class ExportError(val message: String) : AdminDashboardEvent()
}

// =============================================================================
// ViewModel del Panel de Administración
// =============================================================================

class AdminDashboardViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val getTodasLasSolicitudesUseCase: GetTodasLasSolicitudesUseCase,
    private val getTodasLasApelacionesUseCase: GetTodasLasApelacionesUseCase,
    private val getTodosLosUsuariosUseCase: GetTodosLosUsuariosUseCase,
    private val getEntidadesActivasUseCase: GetEntidadesActivasUseCase,
    private val sincronizarDatosUseCase: SincronizarDatosUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(AdminDashboardUiState())
    val uiState: StateFlow<AdminDashboardUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<AdminDashboardEvent>()
    val events: SharedFlow<AdminDashboardEvent> = _events

    init {
        cargarDatos()
        // Escuchar señal de refresh cuando llegan notificaciones push
        viewModelScope.launch {
            NotificationPushHelper.refreshSignal.collect { tipo ->
                if (tipo in listOf(
                        "nueva_solicitud", "respuesta_entidad", "nueva_apelacion",
                        "calificacion_ttaip", "subsanacion_presentada",
                        "vencimiento_plazo", "silencio_administrativo"
                    )
                ) {
                    sincronizarYRecargar()
                }
            }
        }
    }

    /**
     * Carga todos los datos desde la BD local (SQLDelight).
     * Los datos fueron previamente sincronizados desde el backend REST.
     */
    fun cargarDatos() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            try {
                val usuario = getUsuarioActualUseCase().first()
                val solicitudes = getTodasLasSolicitudesUseCase().first()
                val apelaciones = getTodasLasApelacionesUseCase().first()
                val usuarios = getTodosLosUsuariosUseCase().first()
                val entidades = getEntidadesActivasUseCase().first()

                // Desglose de solicitudes por estado
                val solPendientes = solicitudes.count { it.estaPendiente }
                val solRespondidas = solicitudes.count { it.fueRespondida }
                val solDenegadas = solicitudes.count { it.fueDenegada }
                val solVencidas = solicitudes.count { it.estaVencida }

                // Desglose de apelaciones por estado
                val apelPendientes = 0
                val apelEnCalif = apelaciones.count {
                    it.estado == com.gestion.misaip.core.domain.model.EstadoApelacion.EN_CALIFICACION_1 ||
                    it.estado == com.gestion.misaip.core.domain.model.EstadoApelacion.EN_CALIFICACION_2
                }
                val apelFundadas = apelaciones.count { it.esFundada }
                val apelInfundadas = apelaciones.count { it.esInfundada }

                // Desglose de usuarios por tipo
                val ciudadanos = usuarios.count {
                    it.tipo == com.gestion.misaip.core.domain.model.TipoUsuario.CIUDADANO
                }
                val funcionarios = usuarios.count {
                    it.tipo == com.gestion.misaip.core.domain.model.TipoUsuario.FUNCIONARIO
                }
                val vocalesTTAIP = usuarios.count {
                    it.tipo == com.gestion.misaip.core.domain.model.TipoUsuario.TTAIP
                }

                // Actividad reciente — combinar solicitudes y apelaciones, ordenar por fecha
                val actividadReciente = mutableListOf<ActividadItem>()

                solicitudes.sortedByDescending { it.fechaCreacion }.take(5).forEach { sol ->
                    actividadReciente.add(
                        ActividadItem(
                            tipo = "solicitud",
                            descripcion = "Solicitud ${sol.expediente} — ${sol.estado.toDisplayString()}",
                            usuario = sol.solicitante.nombre,
                            fecha = formatearTiempoRelativo(sol.fechaCreacion),
                            timestamp = sol.fechaCreacion
                        )
                    )
                }

                apelaciones.sortedByDescending { it.fechaPresentacion }.take(5).forEach { apel ->
                    actividadReciente.add(
                        ActividadItem(
                            tipo = "apelacion",
                            descripcion = "Apelación ${apel.expediente} — ${apel.estado.toDisplayString()}",
                            usuario = apel.apelante.nombre,
                            fecha = formatearTiempoRelativo(apel.fechaPresentacion),
                            timestamp = apel.fechaPresentacion
                        )
                    )
                }

                // Ordenar por más reciente y tomar las 8 más recientes
                val actividadOrdenada = actividadReciente
                    .sortedByDescending { it.timestamp }
                    .take(8)

                // Estadísticas por entidad
                val entidadesConStats = entidades.mapNotNull { ent ->
                    val solicitudesEnt = solicitudes.filter { it.entidadId == ent.id }
                    if (solicitudesEnt.isEmpty()) null
                    else EntidadStatsItem(
                        nombre = ent.nombre,
                        solicitudes = solicitudesEnt.size,
                        pendientes = solicitudesEnt.count { it.estaPendiente },
                        respondidas = solicitudesEnt.count { it.fueRespondida },
                        vencidas = solicitudesEnt.count { it.estaVencida }
                    )
                }.sortedByDescending { it.solicitudes }

                _uiState.value = AdminDashboardUiState(
                    nombreUsuario = usuario?.nombre ?: "Administrador",
                    totalSolicitudes = solicitudes.size,
                    totalUsuarios = usuarios.size,
                    totalApelaciones = apelaciones.size,
                    apelacionesResueltas = apelaciones.count { it.estaResuelta },
                    solicitudesPendientes = solPendientes,
                    solicitudesRespondidas = solRespondidas,
                    solicitudesDenegadas = solDenegadas,
                    solicitudesVencidas = solVencidas,
                    apelacionesPendientes = apelPendientes,
                    apelacionesEnCalificacion = apelEnCalif,
                    apelacionesFundadas = apelFundadas,
                    apelacionesInfundadas = apelInfundadas,
                    ciudadanos = ciudadanos,
                    funcionarios = funcionarios,
                    vocalesTTAIP = vocalesTTAIP,
                    actividadReciente = actividadOrdenada,
                    entidadesConStats = entidadesConStats,
                    ultimaActualizacion = formatearFechaHora(System.currentTimeMillis()),
                    isLoading = false,
                    solicitudesRaw = solicitudes,
                    apelacionesRaw = apelaciones,
                    usuariosRaw = usuarios,
                    entidadesRaw = entidades
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                _events.emit(AdminDashboardEvent.ShowMessage("Error al cargar datos: ${e.message}"))
            }
        }
    }

    /**
     * Emite evento de exportación exitosa o error.
     */
    fun notificarExportacion(filePath: String?, mimeType: String) {
        viewModelScope.launch {
            if (filePath != null) {
                _events.emit(AdminDashboardEvent.ExportReady(filePath, mimeType))
            } else {
                _events.emit(AdminDashboardEvent.ExportError("No se pudo generar el archivo"))
            }
        }
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
                // Ignorar errores de sincronización — modo offline
            }
            cargarDatos()
        }
    }

    // =========================================================================
    // Utilidades de formato
    // =========================================================================

    private fun formatearTiempoRelativo(timestamp: Long): String {
        val ahora = System.currentTimeMillis()
        val diferencia = ahora - timestamp
        val minutos = diferencia / 60_000
        val horas = diferencia / 3_600_000
        val dias = diferencia / 86_400_000

        return when {
            minutos < 1 -> "Justo ahora"
            minutos < 60 -> "Hace $minutos min"
            horas < 24 -> "Hace $horas h"
            dias < 7 -> "Hace $dias días"
            else -> formatearFecha(timestamp)
        }
    }

    private fun formatearFecha(timestamp: Long): String {
        val sdf = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.forLanguageTag("es-PE"))
        return sdf.format(java.util.Date(timestamp))
    }

    private fun formatearFechaHora(timestamp: Long): String {
        val sdf = java.text.SimpleDateFormat("dd MMM, HH:mm", java.util.Locale.forLanguageTag("es-PE"))
        return sdf.format(java.util.Date(timestamp))
    }
}

