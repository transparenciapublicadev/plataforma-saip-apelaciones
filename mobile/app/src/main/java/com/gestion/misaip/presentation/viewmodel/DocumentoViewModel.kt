package com.gestion.misaip.presentation.viewmodel

import android.net.Uri
import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.ArchivoDocumento
import com.gestion.misaip.core.domain.model.Documento
import com.gestion.misaip.core.domain.model.DocumentoRelacion
import com.gestion.misaip.core.domain.model.TipoDocumento
import com.gestion.misaip.core.domain.usecase.documento.DownloadDocumentoUseCase
import com.gestion.misaip.core.domain.usecase.documento.ListDocumentosPorRelacionUseCase
import com.gestion.misaip.core.domain.usecase.documento.UploadDocumentoUseCase
import com.gestion.misaip.core.domain.usecase.documento.ValidarArchivoDocumentoUseCase
import com.gestion.misaip.data.DocumentoContentResolver
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@Immutable
data class DocumentoUiState(
    val documentos: List<Documento> = emptyList(),
    val archivoSeleccionado: DocumentoSeleccionadoUi? = null,
    val puedeSubir: Boolean = false,
    val isLoading: Boolean = false,
    val isUploading: Boolean = false,
    val downloadingId: String? = null,
    val error: String? = null
)

@Immutable
data class DocumentoSeleccionadoUi(
    val nombre: String,
    val contentType: String,
    val sizeBytes: Long
)

sealed interface DocumentoEvent {
    data class ShowMessage(val message: String) : DocumentoEvent
}

class DocumentoViewModel(
    private val uploadDocumentoUseCase: UploadDocumentoUseCase,
    private val listDocumentosPorRelacionUseCase: ListDocumentosPorRelacionUseCase,
    private val downloadDocumentoUseCase: DownloadDocumentoUseCase,
    private val validarArchivoDocumentoUseCase: ValidarArchivoDocumentoUseCase,
    private val contentResolver: DocumentoContentResolver
) : ViewModel() {

    private val _uiState = MutableStateFlow(DocumentoUiState())
    val uiState: StateFlow<DocumentoUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<DocumentoEvent>()
    val events: SharedFlow<DocumentoEvent> = _events.asSharedFlow()

    private var relacion: DocumentoRelacion? = null
    private var tipoDocumento: TipoDocumento = TipoDocumento.DOCUMENTO_ADJUNTO
    private var archivoSeleccionado: ArchivoDocumento? = null

    fun configurar(
        relacion: DocumentoRelacion?,
        tipoDocumento: TipoDocumento,
        documentos: List<Documento>,
        puedeSubir: Boolean
    ) {
        val relacionCambio = this.relacion != relacion
        this.relacion = relacion
        this.tipoDocumento = tipoDocumento
        if (relacionCambio) {
            archivoSeleccionado = null
        }
        _uiState.update { state ->
            state.copy(
                documentos = (documentos + if (relacionCambio) emptyList() else state.documentos)
                    .distinctBy(Documento::id)
                    .sortedByDescending(Documento::fechaCreacion),
                archivoSeleccionado = if (relacionCambio) null else state.archivoSeleccionado,
                puedeSubir = puedeSubir && relacion != null,
                error = null
            )
        }
        if (relacionCambio && relacion != null) {
            cargarDocumentos(relacion, documentos)
        }
    }

    fun seleccionarArchivo(uri: Uri) {
        runCatching {
            contentResolver.resolveUpload(uri).also(validarArchivoDocumentoUseCase::invoke)
        }.onSuccess { archivo ->
            archivoSeleccionado = archivo
            _uiState.update {
                it.copy(
                    archivoSeleccionado = DocumentoSeleccionadoUi(
                        nombre = archivo.nombre,
                        contentType = archivo.contentType,
                        sizeBytes = archivo.sizeBytes
                    ),
                    error = null
                )
            }
        }.onFailure { error ->
            archivoSeleccionado = null
            _uiState.update {
                it.copy(
                    archivoSeleccionado = null,
                    error = error.message ?: "No se pudo leer el archivo seleccionado."
                )
            }
        }
    }

    fun limpiarSeleccion() {
        archivoSeleccionado = null
        _uiState.update { it.copy(archivoSeleccionado = null, error = null) }
    }

    fun upload(
        relacionDestino: DocumentoRelacion? = null,
        tipoDocumentoDestino: TipoDocumento? = null,
        successMessage: String = "Archivo subido correctamente.",
        failureMessage: String = "No se pudo subir el documento."
    ) {
        val archivo = archivoSeleccionado ?: return
        val relacionActual = relacionDestino ?: relacion ?: return
        val tipoActual = tipoDocumentoDestino ?: tipoDocumento
        viewModelScope.launch {
            _uiState.update { it.copy(isUploading = true, error = null) }
            runCatching {
                uploadDocumentoUseCase(archivo, tipoActual, relacionActual)
            }.onSuccess { documento ->
                archivoSeleccionado = null
                _uiState.update {
                    it.copy(
                        documentos = (listOf(documento) + it.documentos)
                            .distinctBy(Documento::id),
                        archivoSeleccionado = null,
                        isUploading = false
                    )
                }
                _events.emit(DocumentoEvent.ShowMessage(successMessage))
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isUploading = false,
                        error = error.message ?: failureMessage
                    )
                }
                _events.emit(
                    DocumentoEvent.ShowMessage(
                        error.message?.let { "$failureMessage $it" } ?: failureMessage
                    )
                )
            }
        }
    }

    fun download(documento: Documento, destino: Uri) {
        viewModelScope.launch {
            _uiState.update { it.copy(downloadingId = documento.id, error = null) }
            runCatching {
                downloadDocumentoUseCase(
                    documentoId = documento.id,
                    destino = contentResolver.resolveDownload(destino)
                )
            }.onSuccess {
                _uiState.update { state -> state.copy(downloadingId = null) }
                _events.emit(DocumentoEvent.ShowMessage("Documento descargado correctamente."))
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        downloadingId = null,
                        error = error.message ?: "No se pudo descargar el documento."
                    )
                }
                _events.tryEmit(
                    DocumentoEvent.ShowMessage(
                        error.message ?: "No se pudo descargar el documento."
                    )
                )
            }
        }
    }

    private fun cargarDocumentos(
        relacionConsultada: DocumentoRelacion,
        documentosEmbebidos: List<Documento>
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            runCatching {
                listDocumentosPorRelacionUseCase(relacionConsultada)
            }.onSuccess { documentosRemotos ->
                if (relacion == relacionConsultada) {
                    _uiState.update {
                        it.copy(
                            documentos = documentosRemotos
                                .distinctBy(Documento::id)
                                .sortedByDescending(Documento::fechaCreacion),
                            isLoading = false,
                            error = null
                        )
                    }
                }
            }.onFailure { error ->
                if (relacion == relacionConsultada) {
                    _uiState.update {
                        it.copy(
                            documentos = documentosEmbebidos
                                .distinctBy(Documento::id)
                                .sortedByDescending(Documento::fechaCreacion),
                            isLoading = false,
                            error = if (documentosEmbebidos.isEmpty()) {
                                error.message ?: "No se pudieron consultar los documentos."
                            } else {
                                null
                            }
                        )
                    }
                }
            }
        }
    }
}
