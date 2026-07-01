import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  LucideCheckCircle2,
  LucideFileText,
  LucideLoaderCircle,
  LucideUpload,
  LucideX
} from '@lucide/angular';
import {
  DOCUMENTO_ACCEPT,
  DocumentoMetadata,
  DocumentoRelation,
  TipoDocumento,
  validarDocumento,
  getDocumentoRelationEntry
} from '../models/documento.model';
import { DocumentoService } from '../services/documento.service';
import { problemDetailsMessage } from '../utils/problem-details.util';

@Component({
  selector: 'app-document-upload',
  imports: [
    LucideCheckCircle2,
    LucideFileText,
    LucideLoaderCircle,
    LucideUpload,
    LucideX
  ],
  templateUrl: './document-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentUploadComponent {
  private readonly documentoService = inject(DocumentoService);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly relation = input.required<DocumentoRelation>();
  readonly tipoDocumento = input<TipoDocumento>('DOCUMENTO_ADJUNTO');
  readonly heading = input('Agregar documento');
  readonly disabled = input(false);
  readonly readOnly = input(false);
  readonly uploaded = output<DocumentoMetadata>();

  readonly accept = DOCUMENTO_ACCEPT;
  readonly selectedFile = signal<File | null>(null);
  readonly loading = signal(false);
  readonly dragging = signal(false);
  readonly error = signal('');
  readonly errorDetail = signal('');
  readonly errorDiagnosticHint = signal('');
  readonly success = signal('');

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectFile(input.files?.[0] ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.isDisabled()) {
      this.dragging.set(true);
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (!this.isDisabled()) {
      this.selectFile(event.dataTransfer?.files?.[0] ?? null);
    }
  }

  clearFile(): void {
    this.selectedFile.set(null);
    this.error.set('');
    this.errorDetail.set('');
    this.errorDiagnosticHint.set('');
    const input = this.fileInput()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  upload(): void {
    const file = this.selectedFile();
    if (!file || this.loading() || this.isDisabled()) {
      return;
    }

    const validationError = validarDocumento(file);
    if (validationError) {
      this.error.set(validationError);
      this.errorDetail.set('');
      this.errorDiagnosticHint.set('');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.errorDetail.set('');
    this.errorDiagnosticHint.set('');
    this.success.set('');

    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('tipoDocumento', this.tipoDocumento());

    const relation = this.relation();
    const [relationKey, relationId] = getDocumentoRelationEntry(relation);
    formData.append(relationKey, relationId.toString());

    this.documentoService.upload(formData).subscribe({
      next: (metadata) => {
        this.loading.set(false);
        this.success.set('Documento cargado correctamente.');
        this.clearFile();
        this.uploaded.emit(metadata);
      },
      error: (error) => {
        this.loading.set(false);
        const msg = problemDetailsMessage(error, 'No se pudo cargar el documento.');
        let detail = '';
        let diagnosticHint = '';
        
        if (error instanceof HttpErrorResponse) {
          const body = error.error;
          if (body && typeof body === 'object') {
            if (typeof body.detail === 'string' && body.detail.trim()) {
              detail = body.detail;
            }
            if (typeof body.diagnosticHint === 'string' && body.diagnosticHint.trim()) {
              diagnosticHint = body.diagnosticHint;
            }
          }
        }
        
        this.error.set(msg);
        this.errorDetail.set(detail);
        this.errorDiagnosticHint.set(diagnosticHint);
      }
    });
  }

  formatFileSize(bytes: number): string {
    return bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  isDisabled(): boolean {
    return this.disabled() || this.readOnly();
  }

  private selectFile(file: File | null): void {
    this.success.set('');
    if (!file) {
      this.clearFile();
      return;
    }

    const validationError = validarDocumento(file);
    if (validationError) {
      this.selectedFile.set(null);
      this.error.set(validationError);
      this.errorDetail.set('');
      this.errorDiagnosticHint.set('');
      const input = this.fileInput()?.nativeElement;
      if (input) {
        input.value = '';
      }
      return;
    }

    this.selectedFile.set(file);
    this.error.set('');
    this.errorDetail.set('');
    this.errorDiagnosticHint.set('');
  }
}
