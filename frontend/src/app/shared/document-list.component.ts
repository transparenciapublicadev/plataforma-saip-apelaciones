import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import {
  LucideDownload,
  LucideFileText,
  LucideLoaderCircle,
  LucideTrash2
} from '@lucide/angular';
import {
  DocumentoListItem,
  DocumentoMetadata,
  DocumentoRelation
} from '../models/documento.model';
import { DocumentoService } from '../services/documento.service';
import { problemDetailsMessage } from '../utils/problem-details.util';

@Component({
  selector: 'app-document-list',
  imports: [
    CommonModule,
    LucideDownload,
    LucideFileText,
    LucideLoaderCircle,
    LucideTrash2
  ],
  templateUrl: './document-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentListComponent {
  private readonly documentoService = inject(DocumentoService);

  readonly documents = input<readonly DocumentoListItem[]>([]);
  readonly relation = input<DocumentoRelation | null>(null);
  readonly readOnly = input(true);
  readonly allowDelete = input(false);
  readonly emptyMessage = input('No hay documentos adjuntos.');
  readonly deleted = output<number>();

  readonly relatedDocuments = signal<DocumentoMetadata[] | null>(null);
  readonly loadingDocuments = signal(false);
  readonly downloadingId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);
  readonly error = signal('');
  readonly displayedDocuments = computed<readonly DocumentoListItem[]>(
    () => this.relatedDocuments() ?? this.documents()
  );

  constructor() {
    effect(() => {
      const relation = this.relation();
      if (!relation) {
        this.relatedDocuments.set(null);
        return;
      }

      this.loadRelation(relation);
    });
  }

  download(documento: DocumentoListItem): void {
    if (!documento.id) {
      this.error.set('Este registro legacy no tiene un identificador disponible para descarga.');
      return;
    }

    this.downloadingId.set(documento.id);
    this.error.set('');
    this.documentoService.download(documento.id, this.documentName(documento)).subscribe({
      next: ({ blob, filename }) => {
        this.downloadingId.set(null);
        this.saveBlob(blob, filename);
      },
      error: (error) => {
        this.downloadingId.set(null);
        this.error.set(problemDetailsMessage(error, 'No se pudo descargar el documento.'));
      }
    });
  }

  delete(documento: DocumentoListItem): void {
    if (this.readOnly() || !this.allowDelete() || !documento.id || typeof window === 'undefined') {
      return;
    }

    const confirmed = window.confirm(`¿Eliminar el documento "${this.documentName(documento)}"?`);
    if (!confirmed) {
      return;
    }

    this.deletingId.set(documento.id);
    this.error.set('');
    this.documentoService.delete(documento.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.deleted.emit(documento.id!);
        const relation = this.relation();
        if (relation) {
          this.loadRelation(relation);
        }
      },
      error: (error) => {
        this.deletingId.set(null);
        this.error.set(problemDetailsMessage(error, 'No se pudo eliminar el documento.'));
      }
    });
  }

  formatFileSize(bytes: number): string {
    if (!bytes) {
      return 'Tamaño no disponible';
    }
    return bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  documentName(documento: DocumentoListItem): string {
    const metadata = documento as DocumentoMetadata;
    const legacy = documento as { nombreArchivo?: string };
    return metadata.nombreOriginal || legacy.nombreArchivo || 'Documento';
  }

  documentType(documento: DocumentoListItem): string {
    const metadata = documento as DocumentoMetadata;
    const legacy = documento as { tipoArchivo?: string; tipoDocumento?: string };
    return metadata.contentType || legacy.tipoArchivo || metadata.tipoDocumento
      || legacy.tipoDocumento || 'ARCHIVO';
  }

  documentSize(documento: DocumentoListItem): number | undefined {
    const metadata = documento as DocumentoMetadata;
    const legacy = documento as { tamanio?: number };
    return metadata.sizeBytes ?? legacy.tamanio;
  }

  documentDate(documento: DocumentoListItem): string | undefined {
    const metadata = documento as DocumentoMetadata;
    const legacy = documento as { fechaSubida?: string };
    return metadata.fechaCreacion || legacy.fechaSubida;
  }

  private loadRelation(relation: DocumentoRelation): void {
    this.loadingDocuments.set(true);
    this.error.set('');
    this.documentoService.listByRelation(relation).subscribe({
      next: (documents) => {
        this.relatedDocuments.set(documents);
        this.loadingDocuments.set(false);
      },
      error: (error) => {
        this.relatedDocuments.set(null);
        this.loadingDocuments.set(false);
        this.error.set(problemDetailsMessage(error, 'No se pudieron consultar los documentos.'));
      }
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }
}
