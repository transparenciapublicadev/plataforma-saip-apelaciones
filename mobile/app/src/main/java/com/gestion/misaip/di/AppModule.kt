package com.gestion.misaip.di

import com.gestion.misaip.data.CredentialStorage
import com.gestion.misaip.data.NotificacionReadTracker
import com.gestion.misaip.core.network.datasource.TokenStorage
import com.gestion.misaip.messaging.PushTokenSyncCoordinator
import org.koin.dsl.module

/**
 * Módulo Koin de la capa App.
 *
 * Los repositorios reales se registran en dataModule.
 * Este módulo registra bindings específicos de la capa app,
 * incluyendo TokenStorage para JWT del backend REST.
 */
val appModule = module {

    // Almacenamiento seguro de credenciales y tokens
    single { CredentialStorage(get()) }

    // Rastreador de lectura de notificaciones (SharedPreferences)
    single { NotificacionReadTracker(get()) }

    // TokenStorage — puente entre CredentialStorage y la capa de red REST
    single<TokenStorage> { get<CredentialStorage>() }

    single { PushTokenSyncCoordinator(context = get(), registrarDispositivoPushUseCase = get(), revocarDispositivoPushActualUseCase = get()) }
}
