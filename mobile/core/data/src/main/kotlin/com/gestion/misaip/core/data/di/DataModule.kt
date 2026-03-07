package com.gestion.misaip.core.data.di

import com.gestion.misaip.core.data.repository.ApelacionRepositoryImpl
import com.gestion.misaip.core.data.repository.EntidadPublicaRepositoryImpl
import com.gestion.misaip.core.data.repository.NotificacionRepositoryImpl
import com.gestion.misaip.core.data.repository.SolicitudRepositoryImpl
import com.gestion.misaip.core.data.repository.UsuarioRepositoryImpl
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import com.gestion.misaip.core.domain.repository.EntidadPublicaRepository
import com.gestion.misaip.core.domain.repository.NotificacionRepository
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import com.gestion.misaip.core.domain.repository.UsuarioRepository
import org.koin.dsl.module

/**
 * Módulo Koin para la Capa de Datos.
 *
 * Provee las implementaciones de los repositorios definidos en el dominio.
 */
val dataModule = module {

    // ===========================================
    // REPOSITORIOS
    // ===========================================

    single<SolicitudRepository> {
        SolicitudRepositoryImpl(database = get(), remoteDataSource = get())
    }

    single<ApelacionRepository> {
        ApelacionRepositoryImpl(database = get(), remoteDataSource = get())
    }

    single<UsuarioRepository> {
        UsuarioRepositoryImpl(database = get(), remoteDataSource = get())
    }

    single<EntidadPublicaRepository> {
        EntidadPublicaRepositoryImpl(database = get(), remoteDataSource = get())
    }

    single<NotificacionRepository> {
        NotificacionRepositoryImpl(database = get())
    }
}

