package com.gestion.misaip.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.gestion.misaip.core.network.datasource.TokenStorage

/**
 * Almacenamiento seguro de credenciales usando EncryptedSharedPreferences.
 * Permite guardar accesos para ciudadano y funcionario por separado.
 * Implementa TokenStorage para JWT tokens del backend REST.
 */
class CredentialStorage(context: Context) : TokenStorage {

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context.applicationContext,
        "misaip_credentials",
        MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    companion object {
        // Ciudadano
        private const val KEY_CIUDADANO_DNI = "ciudadano_dni"
        private const val KEY_CIUDADANO_PASS = "ciudadano_pass"
        private const val KEY_CIUDADANO_SAVED = "ciudadano_saved"
        // Funcionario
        private const val KEY_FUNCIONARIO_USER = "funcionario_user"
        private const val KEY_FUNCIONARIO_PASS = "funcionario_pass"
        private const val KEY_FUNCIONARIO_SAVED = "funcionario_saved"
        // JWT Token (REST API)
        private const val KEY_JWT_TOKEN = "jwt_token"
        private const val KEY_USER_ID = "rest_user_id"
        private const val KEY_TIPO_USUARIO = "rest_tipo_usuario"
        private const val KEY_ENTIDAD_ID = "rest_entidad_id"
    }

    // ═══════════════════════════════════════════
    // Ciudadano
    // ═══════════════════════════════════════════

    fun guardarCiudadano(dni: String, contrasena: String) {
        prefs.edit()
            .putString(KEY_CIUDADANO_DNI, dni)
            .putString(KEY_CIUDADANO_PASS, contrasena)
            .putBoolean(KEY_CIUDADANO_SAVED, true)
            .apply()
    }

    fun obtenerCiudadano(): Pair<String, String>? {
        if (!prefs.getBoolean(KEY_CIUDADANO_SAVED, false)) return null
        val dni = prefs.getString(KEY_CIUDADANO_DNI, "") ?: ""
        val pass = prefs.getString(KEY_CIUDADANO_PASS, "") ?: ""
        return if (dni.isNotEmpty()) Pair(dni, pass) else null
    }

    fun tieneCiudadanoGuardado(): Boolean = prefs.getBoolean(KEY_CIUDADANO_SAVED, false)

    fun borrarCiudadano() {
        prefs.edit()
            .remove(KEY_CIUDADANO_DNI)
            .remove(KEY_CIUDADANO_PASS)
            .putBoolean(KEY_CIUDADANO_SAVED, false)
            .apply()
    }

    // ═══════════════════════════════════════════
    // Funcionario / Entidad / TTAIP / Admin
    // ═══════════════════════════════════════════

    fun guardarFuncionario(usuario: String, contrasena: String) {
        prefs.edit()
            .putString(KEY_FUNCIONARIO_USER, usuario)
            .putString(KEY_FUNCIONARIO_PASS, contrasena)
            .putBoolean(KEY_FUNCIONARIO_SAVED, true)
            .apply()
    }

    fun obtenerFuncionario(): Pair<String, String>? {
        if (!prefs.getBoolean(KEY_FUNCIONARIO_SAVED, false)) return null
        val user = prefs.getString(KEY_FUNCIONARIO_USER, "") ?: ""
        val pass = prefs.getString(KEY_FUNCIONARIO_PASS, "") ?: ""
        return if (user.isNotEmpty()) Pair(user, pass) else null
    }

    fun tieneFuncionarioGuardado(): Boolean = prefs.getBoolean(KEY_FUNCIONARIO_SAVED, false)

    fun borrarFuncionario() {
        prefs.edit()
            .remove(KEY_FUNCIONARIO_USER)
            .remove(KEY_FUNCIONARIO_PASS)
            .putBoolean(KEY_FUNCIONARIO_SAVED, false)
            .apply()
    }

    // ═══════════════════════════════════════════
    // TokenStorage — JWT para REST API
    // ═══════════════════════════════════════════

    override fun saveToken(token: String) {
        prefs.edit().putString(KEY_JWT_TOKEN, token).apply()
    }

    override fun getToken(): String? {
        return prefs.getString(KEY_JWT_TOKEN, null)
    }

    override fun clearToken() {
        prefs.edit()
            .remove(KEY_JWT_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_TIPO_USUARIO)
            .remove(KEY_ENTIDAD_ID)
            .apply()
    }

    override fun saveUserId(id: Long) {
        prefs.edit().putLong(KEY_USER_ID, id).apply()
    }

    override fun getUserId(): Long? {
        val id = prefs.getLong(KEY_USER_ID, -1L)
        return if (id != -1L) id else null
    }

    override fun saveTipoUsuario(tipoUsuario: String?) {
        prefs.edit().putString(KEY_TIPO_USUARIO, tipoUsuario).apply()
    }

    override fun getTipoUsuario(): String? {
        return prefs.getString(KEY_TIPO_USUARIO, null)
    }

    override fun saveEntidadId(entidadId: Long?) {
        if (entidadId == null) {
            prefs.edit().remove(KEY_ENTIDAD_ID).apply()
            return
        }
        prefs.edit().putLong(KEY_ENTIDAD_ID, entidadId).apply()
    }

    override fun getEntidadId(): Long? {
        val id = prefs.getLong(KEY_ENTIDAD_ID, -1L)
        return if (id != -1L) id else null
    }
}
