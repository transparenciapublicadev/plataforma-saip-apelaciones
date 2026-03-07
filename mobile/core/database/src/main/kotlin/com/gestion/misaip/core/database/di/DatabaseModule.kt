package com.gestion.misaip.core.database.di

import android.content.Context
import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.gestion.misaip.core.database.SaipDatabase
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

/**
 * Módulo Koin para la Base de Datos (SQLDelight).
 *
 * Provee el driver de SQLite y la instancia de la base de datos.
 */
val databaseModule = module {

    // Driver de SQLite para Android — registrado como SqlDriver (interfaz)
    single<SqlDriver> {
        AndroidSqliteDriver(
            schema = SaipDatabase.Schema,
            context = androidContext(),
            name = "saip_database.db"
        )
    }

    // Base de datos SQLDelight
    single {
        SaipDatabase(get())
    }

    // Queries individuales para inyección directa (opcional)
    single { get<SaipDatabase>().usuarioQueries }
    single { get<SaipDatabase>().solicitudQueries }
    single { get<SaipDatabase>().apelacionQueries }
    single { get<SaipDatabase>().notificacionQueries }
}

/**
 * Extensión para crear la base de datos con datos iniciales.
 */
fun SaipDatabase.Companion.createWithInitialData(context: Context): SaipDatabase {
    val driver = AndroidSqliteDriver(
        schema = SaipDatabase.Schema,
        context = context,
        name = "saip_database.db"
    )
    return SaipDatabase(driver)
}

