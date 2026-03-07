package com.gestion.misaip.core.network.di

import com.gestion.misaip.core.network.datasource.ApelacionFirebaseDataSource
import com.gestion.misaip.core.network.datasource.ApelacionRemoteDataSource
import com.gestion.misaip.core.network.datasource.EntidadPublicaFirebaseDataSource
import com.gestion.misaip.core.network.datasource.EntidadPublicaRemoteDataSource
import com.gestion.misaip.core.network.datasource.SolicitudFirebaseDataSource
import com.gestion.misaip.core.network.datasource.SolicitudRemoteDataSource
import com.gestion.misaip.core.network.datasource.UsuarioFirebaseDataSource
import com.gestion.misaip.core.network.datasource.UsuarioRemoteDataSource
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.Firebase
import com.google.firebase.firestore.firestore
import com.google.firebase.auth.FirebaseAuth
import org.koin.dsl.module

/**
 * Módulo Koin para la Capa de Red (Firebase).
 *
 * Provee las instancias de Firebase y los DataSources remotos.
 * Se conecta a la base de datos Firestore con nombre 'misaipdb'.
 */
val networkModule = module {

    // ===========================================
    // FIREBASE
    // ===========================================

    single { Firebase.firestore("misaipdb") }
    single { FirebaseAuth.getInstance() }

    // ===========================================
    // DATA SOURCES REMOTOS
    // ===========================================

    single<SolicitudRemoteDataSource> {
        SolicitudFirebaseDataSource(firestore = get())
    }

    single<ApelacionRemoteDataSource> {
        ApelacionFirebaseDataSource(firestore = get())
    }

    single<UsuarioRemoteDataSource> {
        UsuarioFirebaseDataSource(auth = get(), firestore = get())
    }

    single<EntidadPublicaRemoteDataSource> {
        EntidadPublicaFirebaseDataSource(firestore = get())
    }
}

