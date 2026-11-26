import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy, OnDestroy,
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
  LucideEye,
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
import { Subscription } from 'rxjs';
import { documentosDelRecurso } from './document-relation.util';
import {
  DocumentPreviewModalComponent,
  DocumentPreviewTarget
} from './document-preview-modal.component';

@Component({
  selector: 'app-document-list',
  imports: [
    CommonModule,
    LucideDownload,
    LucideEye,
    LucideFileText,
    LucideLoaderCircle,
    LucideTrash2,
    DocumentPreviewModalComponent
  ],
  templateUrl: './document-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentListComponent implements OnDestroy {
  private readonly documentoService = inject(DocumentoService);
  /** Opt-in for institutional details: clear, validate and cancel per resource/session. */
  readonly verifiedContext = input<number | null>(null);
  private requests = new Subscription();
  private revision = 0;
  private context = '';
  private destroyed = false;
  private contextMatches(): boolean { return this.verifiedContext() == null || this.context === JSON.stringify([this.relation(), this.verifiedContext()]); }
  readonly search = signal('');

  readonly documents = input<readonly DocumentoListItem[]>([]);
  readonly relation = input<DocumentoRelation | null>(null);
  readonly readOnly = input(true);
  readonly allowDelete = input(false);
  readonly emptyMessage = input('No hay documentos adjuntos.');
  readonly clasificacion = input('');
  readonly deleted = output<number>();

  readonly relatedDocuments = signal<DocumentoMetadata[] | null>(null);
  readonly loadingDocuments = signal(false);
  readonly downloadingId = signal<number | null>(null);
  readonly previewingId = signal<number | null>(null);
  readonly previewTarget = signal<DocumentPreviewTarget | null>(null);
  readonly isPreviewOpen = signal(false);
  readonly deletingId = signal<number | null>(null);
  readonly error = signal('');
  readonly displayedDocuments = computed<readonly DocumentoListItem[]>(
    () => this.relatedDocuments() ?? this.documents()
  );
  readonly visibleDocuments = computed(() => {
    const docs = this.displayedDocuments();
    if (this.verifiedContext() == null) return docs;
    const normalize = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
    const query = normalize(this.search().trim());
    return docs.filter(d => !query || normalize(this.documentName(d) + ' ' + this.documentType(d)).includes(query));
  });

  constructor() {
    effect(() => {
      const relation = this.relation();
      const scope = this.verifiedContext();
      if (scope != null) {
        const key = JSON.stringify([relation, scope]);
        if (key === this.context) return;
        this.context = key; this.revision++;
        this.requests.unsubscribe(); this.requests = new Subscription();
        this.relatedDocuments.set([]); this.search.set(''); this.cerrarPreview();
        this.downloadingId.set(null); this.previewingId.set(null); this.error.set('');
      }
      if (!relation) {
        this.relatedDocuments.set(scope == null ? null : []);
        this.loadingDocuments.set(false);
        if (scope != null) this.error.set('No se ha identificado la relación documental.');
        return;
      }

      this.loadRelation(relation);
    });
  }
  ngOnDestroy(): void { this.destroyed = true; this.revision++; this.requests.unsubscribe(); this.cerrarPreview(); }
  retry(): void { const relation = this.relation(); if (relation && !this.loadingDocuments()) this.loadRelation(relation); }
  private usable(doc: DocumentoListItem): boolean { return this.verifiedContext() == null || this.displayedDocuments().some(d => d === doc && Number.isSafeInteger(d.id) && d.id! > 0); }

  download(documento: DocumentoListItem): void {
    if (!this.usable(documento)) { this.error.set('Consulte un documento identificado del recurso actual.'); return; }
    if (!documento.id) {
      this.error.set('Este registro legacy no tiene un identificador disponible para descarga.');
      return;
    }

    this.downloadingId.set(documento.id);
    this.error.set('');
    const revision = this.revision;
    this.requests.add(this.documentoService.download(documento.id, this.documentName(documento)).subscribe({
      next: ({ blob, filename }) => {
        if (this.destroyed || revision !== this.revision || !this.contextMatches()) return;
        this.downloadingId.set(null);
        this.saveBlob(blob, filename);
      },
      error: (error) => {
        if (this.destroyed || revision !== this.revision || !this.contextMatches()) return;
        this.downloadingId.set(null);
        this.error.set(problemDetailsMessage(error, 'No se pudo descargar el documento.'));
      }
    }));
  }

  preview(documento: DocumentoListItem): void {
    if (!this.usable(documento)) { this.error.set('Consulte un documento identificado del recurso actual.'); return; }
    const nombre = this.documentName(documento);
    const tipo = this.documentType(documento);
    if (this.verifiedContext() != null && documento.id) {
      this.previewTarget.set({ id: documento.id, nombre, tipo }); this.isPreviewOpen.set(true); return;
    }

    if (!documento.id) {
      this.previewTarget.set({
        nombre,
        tipo,
        fecha: this.documentDate(documento) || ''
      });
      this.isPreviewOpen.set(true);
      return;
    }

    this.previewingId.set(documento.id);
    this.requests.add(this.documentoService.download(documento.id, nombre).subscribe({
      next: ({ blob, filename }) => {
        this.previewingId.set(null);
        this.previewTarget.set({
          id: documento.id,
          nombre: filename || nombre,
          blob,
          tipo
        });
        this.isPreviewOpen.set(true);
      },
      error: () => {
        this.previewingId.set(null);
        this.previewTarget.set({
          id: documento.id,
          nombre,
          tipo,
          fecha: this.documentDate(documento) || ''
        });
        this.isPreviewOpen.set(true);
      }
    }));
  }

  cerrarPreview(): void {
    this.isPreviewOpen.set(false);
    this.previewTarget.set(null);
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
    if (this.verifiedContext() != null) this.relatedDocuments.set([]);
    const revision = this.revision;
    this.requests.add(this.documentoService.listByRelation(relation).subscribe({
      next: (documents) => {
        if (this.destroyed || revision !== this.revision || !this.contextMatches()) return;
        const checked = this.verifiedContext() == null ? documents : documentosDelRecurso(documents, relation);
        if (checked == null) { this.relatedDocuments.set([]); this.error.set('Información documental incompleta o asociada a otro recurso.'); }
        else this.relatedDocuments.set(checked);
        this.loadingDocuments.set(false);
      },
      error: (error) => {
        if (this.destroyed || revision !== this.revision || !this.contextMatches()) return;
        this.relatedDocuments.set(this.verifiedContext() == null ? null : []);
        this.loadingDocuments.set(false);
        this.error.set(problemDetailsMessage(error, 'No se pudieron consultar los documentos.'));
      }
    }));
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
