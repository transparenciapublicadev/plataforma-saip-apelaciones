package com.gestion.misaip.presentation.di

import com.gestion.misaip.data.CredentialStorage
import com.gestion.misaip.presentation.viewmodel.*
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

/**
 * Módulo Koin para la Capa de Presentación.
 *
 * Define los ViewModels que serán inyectados en las Activities.
 * Todos los ViewModels usan Use Cases inyectados por Koin (Clean Architecture).
 */
val presentationModule = module {

    // ===========================================
    // SINGLETONS
    // ===========================================

    // ===========================================
    // VIEWMODELS - Activity-based (Use Cases)
    // ===========================================

    viewModel {
        LoginViewModel(
            autenticarUsuarioUseCase = get(),
            sincronizarDatosUseCase = get(),
            credentialStorage = get()
        )
    }

    viewModel {
        RegisterViewModel(
            registrarCiudadanoUseCase = get()
        )
    }

    viewModel {
        ProfileViewModel(
            getUsuarioActualUseCase = get(),
            cerrarSesionUseCase = get(),
            getSolicitudesUsuarioUseCase = get(),
            getSolicitudesEntidadUseCase = get(),
            getApelacionesUsuarioUseCase = get(),
            getTodasLasApelacionesUseCase = get()
        )
    }

    viewModel {
        CitizenDashboardViewModel(
            getUsuarioActualUseCase = get(),
            cargarSolicitudesUsuarioPaginaUseCase = get(),
            cargarApelacionesUsuarioPaginaUseCase = get()
        )
    }

    viewModel {
        EntityDashboardViewModel(
            getUsuarioActualUseCase = get(),
            cargarSolicitudesEntidadPaginaUseCase = get(),
            iniciarRevisionUseCase = get(),
            getPendientesElevacionEntidadUseCase = get(),
            elevarApelacionUseCase = get()
        )
    }

    viewModel {
        TTAIPDashboardViewModel(
            getUsuarioActualUseCase = get(),
            cargarApelacionesPaginaUseCase = get(),
            iniciarCalificacionUseCase = get(),
            calificarApelacionUseCase = get()
        )
    }

    viewModel {
        TTAIPExpedienteViewModel(
            getExpedienteTtaipUseCase = get(),
            gestionarExpedienteTtaipUseCase = get()
        )
    }

    viewModel {
        AdminDashboardViewModel(
            getUsuarioActualUseCase = get(),
            getTodasLasSolicitudesUseCase = get(),
            getTodasLasApelacionesUseCase = get(),
            getTodosLosUsuariosUseCase = get(),
            getEntidadesActivasUseCase = get(),
            sincronizarDatosUseCase = get()
        )
    }

    viewModel {
        SAIPFormViewModel(
            getUsuarioActualUseCase = get(),
            getEntidadesActivasUseCase = get(),
            crearSolicitudUseCase = get(),
            sincronizarDatosUseCase = get()
        )
    }

    viewModel {
        AppealFormViewModel(
            getUsuarioActualUseCase = get(),
            getSolicitudPorExpedienteUseCase = get(),
            getApelacionPorSAIPUseCase = get(),
            crearApelacionUseCase = get(),
            crearApelacionExternaUseCase = get(),
            crearApelacionAnteEntidadUseCase = get(),
            getEntidadesActivasUseCase = get()
        )
    }

    viewModel {
        DocumentoViewModel(
            uploadDocumentoUseCase = get(),
            downloadDocumentoUseCase = get(),
            validarArchivoDocumentoUseCase = get(),
            contentResolver = get()
        )
    }

    viewModel {
        RequestDetailViewModel(
            getUsuarioActualUseCase = get(),
            getSolicitudPorExpedienteUseCase = get(),
            refrescarSolicitudDetalleUseCase = get(),
            getApelacionPorExpedienteUseCase = get(),
            refrescarApelacionDetalleUseCase = get(),
            getApelacionPorSAIPUseCase = get(),
            responderSolicitudUseCase = get(),
            iniciarRevisionUseCase = get(),
            getEntidadesActivasUseCase = get(),
            getOperacionesSolicitudFuncionarioUseCase = get(),
            registrarObservacionSolicitudUseCase = get(),
            registrarAmpliacionPlazoSolicitudUseCase = get(),
            registrarEncauzamientoSolicitudUseCase = get(),
            emitirLiquidacionCostoSolicitudUseCase = get(),
            calificarApelacionUseCase = get(),
            iniciarCalificacionUseCase = get(),
            presentarSubsanacionUseCase = get(),
            getElevacionApelacionUseCase = get(),
            comunicarOmisionElevacionUseCase = get(),
            sincronizarDatosUseCase = get()
        )
    }

    viewModel {
        NotificationsViewModel(
            getUsuarioActualUseCase = get(),
            getSolicitudesUsuarioUseCase = get(),
            getSolicitudesEntidadUseCase = get(),
            getApelacionesUsuarioUseCase = get(),
            getTodasLasApelacionesUseCase = get(),
            notificacionReadTracker = get(),
            sincronizarDatosUseCase = get()
        )
    }

}

