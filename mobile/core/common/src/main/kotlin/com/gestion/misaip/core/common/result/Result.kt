package com.gestion.misaip.core.common.result

/**
 * Clase sellada que representa el resultado de una operación.
 * Permite manejar estados de éxito, error y carga de forma tipada.
 *
 * Diseñado para ser KMP-Ready (Kotlin Puro).
 */
sealed class Result<out T> {

    /**
     * Representa una operación exitosa con datos.
     */
    data class Success<out T>(val data: T) : Result<T>()

    /**
     * Representa un error en la operación.
     */
    data class Error(
        val exception: Throwable? = null,
        val message: String? = null,
        val code: ErrorCode = ErrorCode.UNKNOWN
    ) : Result<Nothing>()

    /**
     * Representa una operación en progreso.
     */
    data object Loading : Result<Nothing>()

    /**
     * Indica si el resultado es exitoso.
     */
    val isSuccess: Boolean get() = this is Success

    /**
     * Indica si el resultado es un error.
     */
    val isError: Boolean get() = this is Error

    /**
     * Indica si está cargando.
     */
    val isLoading: Boolean get() = this is Loading

    /**
     * Obtiene los datos si el resultado es exitoso, null en caso contrario.
     */
    fun getOrNull(): T? = when (this) {
        is Success -> data
        else -> null
    }

    /**
     * Obtiene los datos si el resultado es exitoso, o lanza una excepción.
     */
    fun getOrThrow(): T = when (this) {
        is Success -> data
        is Error -> throw exception ?: IllegalStateException(message ?: "Unknown error")
        is Loading -> throw IllegalStateException("Operation is still loading")
    }

    /**
     * Obtiene los datos o un valor por defecto.
     */
    fun getOrDefault(defaultValue: @UnsafeVariance T): T = when (this) {
        is Success -> data
        else -> defaultValue
    }

    /**
     * Transforma los datos si el resultado es exitoso.
     */
    inline fun <R> map(transform: (T) -> R): Result<R> = when (this) {
        is Success -> Success(transform(data))
        is Error -> this
        is Loading -> this
    }

    /**
     * Transforma los datos si el resultado es exitoso, permitiendo operaciones que pueden fallar.
     */
    inline fun <R> flatMap(transform: (T) -> Result<R>): Result<R> = when (this) {
        is Success -> transform(data)
        is Error -> this
        is Loading -> this
    }

    /**
     * Ejecuta una acción si el resultado es exitoso.
     */
    inline fun onSuccess(action: (T) -> Unit): Result<T> {
        if (this is Success) action(data)
        return this
    }

    /**
     * Ejecuta una acción si el resultado es un error.
     */
    inline fun onError(action: (Error) -> Unit): Result<T> {
        if (this is Error) action(this)
        return this
    }

    /**
     * Ejecuta una acción si está cargando.
     */
    inline fun onLoading(action: () -> Unit): Result<T> {
        if (this is Loading) action()
        return this
    }
}

/**
 * Códigos de error estandarizados para la aplicación.
 */
enum class ErrorCode {
    UNKNOWN,
    NETWORK_ERROR,
    SERVER_ERROR,
    NOT_FOUND,
    UNAUTHORIZED,
    FORBIDDEN,
    VALIDATION_ERROR,
    DATABASE_ERROR,
    CACHE_ERROR,
    TIMEOUT,
    SYNC_ERROR
}

/**
 * Extensión para ejecutar un bloque de forma segura y retornar un Result.
 */
inline fun <T> runCatching(block: () -> T): Result<T> {
    return try {
        Result.Success(block())
    } catch (e: Exception) {
        Result.Error(exception = e, message = e.message)
    }
}

/**
 * Extensión para convertir un nullable a Result.
 */
fun <T> T?.toResult(errorMessage: String = "Value is null"): Result<T> {
    return this?.let { Result.Success(it) } ?: Result.Error(message = errorMessage, code = ErrorCode.NOT_FOUND)
}

