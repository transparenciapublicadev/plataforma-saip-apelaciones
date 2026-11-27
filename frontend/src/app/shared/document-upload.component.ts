import {
  ChangeDetectionStrategy, OnDestroy, effect,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { documentosDelRecurso } from './document-relation.util';
import {
  LucideCheckCircle2,
  LucideEye,
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
import {
  DocumentPreviewModalComponent,
  DocumentPreviewTarget
} from './document-preview-modal.component';

@Component({
  selector: 'app-document-upload',
  imports: [
    LucideCheckCircle2,
    LucideEye,
    LucideFileText,
    LucideLoaderCircle,
    LucideUpload,
    LucideX,
    DocumentPreviewModalComponent
  ],
  templateUrl: './document-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentUploadComponent implements OnDestroy {
  private readonly documentoService = inject(DocumentoService);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly relation = input.required<DocumentoRelation>();
  readonly tipoDocumento = input<TipoDocumento>('DOCUMENTO_ADJUNTO');
  readonly heading = input('Agregar documento');
  readonly disabled = input(false);
  readonly readOnly = input(false);
  readonly uploaded = output<DocumentoMetadata>();
  readonly verifiedContext = input<number | null>(null);
  readonly uncertain = signal(false);
  readonly returnedId = signal<number | null>(null);
  private tasks = new Subscription();
  private revision = 0;
  private context = '';
  private destroyed = false;
  private contextMatches(): boolean { return this.verifiedContext() == null || this.context === JSON.stringify([this.verifiedContext(), this.relation(), this.tipoDocumento()]); }
  constructor() {
    effect(() => {
      const scope = this.verifiedContext(); if (scope == null) return;
      const key = JSON.stringify([scope, this.relation(), this.tipoDocumento()]); if (key === this.context) return;
      this.context = key; this.revision++; this.tasks.unsubscribe(); this.tasks = new Subscription();
      this.loading.set(false); this.clearFile(); this.success.set(''); this.uncertain.set(false); this.returnedId.set(null); this.cerrarPreview();
    });
  }
  ngOnDestroy(): void { this.destroyed = true; this.revision++; this.tasks.unsubscribe(); this.cerrarPreview(); }

  readonly accept = DOCUMENTO_ACCEPT;
  readonly selectedFile = signal<File | null>(null);
  readonly previewTarget = signal<DocumentPreviewTarget | null>(null);
  readonly isPreviewOpen = signal(false);
  readonly loading = signal(false);
  readonly dragging = signal(false);
  readonly error = signal('');
  readonly errorDetail = signal('');
  readonly errorDiagnosticHint = signal('');
  readonly success = signal('');

  previewSelectedFile(): void {
    const file = this.selectedFile();
    if (!file) return;
    this.previewTarget.set({
      nombre: file.name,
      file: file,
      blob: file,
      tipo: file.type || 'application/pdf'
    });
    this.isPreviewOpen.set(true);
  }

  cerrarPreview(): void {
    this.isPreviewOpen.set(false);
    this.previewTarget.set(null);
  }

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
    if (!file || this.loading() || this.isDisabled() || this.uncertain()) {
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

    const revision = this.revision;
    this.tasks.add(this.documentoService.upload(formData).subscribe({
      next: (metadata) => {
        if (this.destroyed || revision !== this.revision || !this.contextMatches()) return;
        if (this.verifiedContext() != null) {
          if (!documentosDelRecurso([metadata], relation) || metadata.tipoDocumento !== this.tipoDocumento()) {
            this.loading.set(false); this.uncertain.set(true); this.error.set('No se recibió un documento asociado al recurso. Consulte sin repetir la subida.'); return;
          }
          this.returnedId.set(metadata.id!); this.recover(); return;
        }
        this.loading.set(false);
        this.success.set('Documento cargado correctamente.');
        this.clearFile();
        this.uploaded.emit(metadata);
      },
      error: (error) => {
        if (this.destroyed || revision !== this.revision || !this.contextMatches()) return;
        this.loading.set(false);
        if (this.verifiedContext() != null && ![400, 401, 403, 404, 409, 422].includes(error?.status)) {
          this.uncertain.set(true); this.error.set('Resultado de subida incierto, sin ID. Consulte el expediente antes de otra subida; no se repite automáticamente.'); return;
        }
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
    }));
  }
  recover(): void {
    const id = this.returnedId(); if (!id || this.destroyed || this.verifiedContext() == null) return;
    const revision = this.revision, relation = this.relation(); this.loading.set(true);
    this.tasks.add(this.documentoService.getMetadata(id).subscribe({ next: metadata => {
      if (this.destroyed || revision !== this.revision || !this.contextMatches()) return; this.loading.set(false);
      if (metadata?.id !== id || !documentosDelRecurso([metadata], relation) || metadata.tipoDocumento !== this.tipoDocumento()) {
        this.uncertain.set(true); this.error.set('La recuperación no acredita el documento del recurso actual.'); return;
      }
      this.uncertain.set(false); this.clearFile(); this.success.set('Documento registrado y recuperado por ID. No acredita firma ni recepción de una actuación.'); this.uploaded.emit(metadata);
    }, error: () => { if (this.destroyed || revision !== this.revision || !this.contextMatches()) return; this.loading.set(false); this.uncertain.set(true); this.error.set('La subida devolvió un ID, pero no pudo recuperarse. Consulte sin subirlo de nuevo.'); } }));
  }

  formatFileSize(bytes: number): string {
    return bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  isDisabled(): boolean {
    return this.disabled() || this.readOnly() || this.uncertain();
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
