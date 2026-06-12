import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import {
  LucideDownload,
  LucideFileText,
  LucideLoaderCircle,
  LucideTrash2
} from '@lucide/angular';
import { Documento } from '../models/documento.model';
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

  readonly documents = input<readonly Documento[]>([]);
  readonly allowDelete = input(false);
  readonly emptyMessage = input('No hay documentos adjuntos.');
  readonly deleted = output<number>();

  readonly downloadingId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);
  readonly error = signal('');

  download(documento: Documento): void {
    if (!documento.id) {
      this.error.set('Este registro legacy no tiene un identificador disponible para descarga.');
      return;
    }

    this.downloadingId.set(documento.id);
    this.error.set('');
    this.documentoService.download(documento.id, documento.nombreArchivo || 'documento').subscribe({
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

  delete(documento: Documento): void {
    if (!this.allowDelete() || !documento.id || typeof window === 'undefined') {
      return;
    }

    const confirmed = window.confirm(`¿Eliminar el documento "${documento.nombreArchivo}"?`);
    if (!confirmed) {
      return;
    }

    this.deletingId.set(documento.id);
    this.error.set('');
    this.documentoService.delete(documento.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.deleted.emit(documento.id!);
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
