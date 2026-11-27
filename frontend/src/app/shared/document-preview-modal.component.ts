import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  LucideFileText,
  LucideDownload,
  LucideX,
  LucideLoader2,
} from '@lucide/angular';
import { BodyPortalDirective } from './body-portal.directive';
import { ModalFocusDirective } from './modal-focus.directive';
import { DocumentoService } from '../services/documento.service';
import { Subscription } from 'rxjs';
import { falloConsulta } from '../utils/consulta-remota.util';

export interface DocumentPreviewTarget {
  id?: number | null;
  nombre: string;
  url?: string | null;
  path?: string | null;
  blob?: Blob | null;
  file?: File | null;
  tipo?: string | null;
  expediente?: string | null;
  fecha?: string | null;
  entidad?: string | null;
  recurrente?: string | null;
}

/**
 * Previsualización in-page (modal) de un documento almacenado — misma experiencia
 * que la del administrado al cargar un archivo en design-reference (RemoteDocPreview.tsx):
 * el PDF o imagen real se muestra DENTRO de la página, sin abrir una pestaña nueva.
 */
@Component({
  selector: 'app-document-preview-modal',
  standalone: true,
  imports: [
    CommonModule,
    BodyPortalDirective,
    ModalFocusDirective,
    LucideFileText,
    LucideDownload,
    LucideX,
    LucideLoader2,
  ],
  templateUrl: './document-preview-modal.component.html',
  styleUrl: './document-preview-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPreviewModalComponent implements OnChanges, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly documentoService = inject(DocumentoService);

  @Input() doc: DocumentPreviewTarget | null = null;
  @Input() open = false;
  @Input() manageFocus = false;
  @Output() close = new EventEmitter<void>();

  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  rawUrl = signal<string | null>(null);
  safeUrl = signal<SafeResourceUrl | null>(null);
  isPdf = signal<boolean>(false);
  isImage = signal<boolean>(false);
  reintentable = signal(false);

  private activeObjectUrl: string | null = null;
  private currentBlob: Blob | null = null;
  private downloadSub?: Subscription;

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.open && !this.manageFocus) {
      this.onClose();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['doc']) {
      if (this.open && this.doc) {
        this.loadDocument(this.doc);
      } else {
        this.resetState();
      }
    }
  }

  ngOnDestroy(): void {
    this.resetState();
  }

  onClose(): void {
    this.resetState();
    this.close.emit();
  }

  descargar(): void {
    if (!this.doc) return;
    const nombre = this.doc.nombre || 'documento.pdf';

    if (this.currentBlob) {
      this.descargarBlob(this.currentBlob, nombre);
      return;
    }

    const url = this.rawUrl();
    if (!url) return;

    if (typeof window !== 'undefined') {
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  reintentar(): void {
    if (this.open && this.doc && this.reintentable()) this.loadDocument(this.doc);
  }

  private resetState(): void {
    if (this.downloadSub) {
      this.downloadSub.unsubscribe();
      this.downloadSub = undefined;
    }
    this.cleanupObjectUrl();
    this.loading.set(false);
    this.error.set(null);
    this.reintentable.set(false);
    this.rawUrl.set(null);
    this.safeUrl.set(null);
    this.isPdf.set(false);
    this.isImage.set(false);
    this.currentBlob = null;
  }

  private cleanupObjectUrl(): void {
    if (this.activeObjectUrl && typeof window !== 'undefined') {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
  }

  private setUrl(url: string): void {
    this.rawUrl.set(url);
    const vistaInicial = this.isPdf() ? `${url.split('#')[0]}#page=1&navpanes=0&view=FitH` : url;
    this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(vistaInicial));
  }

  private loadDocument(doc: DocumentPreviewTarget): void {
    this.resetState();
    this.loading.set(true);

    const nombre = doc.nombre || 'documento';
    const ext = nombre.split('.').pop()?.toLowerCase() || '';
    const tipo = (doc.tipo || '').toLowerCase();

    const esPdf = ext === 'pdf' || tipo.includes('pdf');
    const esImagen =
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) ||
      tipo.startsWith('image');

    this.isPdf.set(esPdf);
    this.isImage.set(esImagen);

    try {
      // 1. Archivo local cargado por el usuario (File o Blob)
      if (doc.file) {
        this.currentBlob = doc.file;
        const objectUrl = URL.createObjectURL(doc.file);
        this.activeObjectUrl = objectUrl;
        this.setUrl(objectUrl);
        this.loading.set(false);
        return;
      }

      if (doc.blob) {
        this.currentBlob = doc.blob;
        const objectUrl = URL.createObjectURL(doc.blob);
        this.activeObjectUrl = objectUrl;
        this.setUrl(objectUrl);
        this.loading.set(false);
        return;
      }

      // 2. Documento almacenado en backend con ID
      if (doc.id) {
        this.downloadSub = this.documentoService.download(doc.id, nombre).subscribe({
          next: ({ blob }) => {
            this.currentBlob = blob;
            const objectUrl = URL.createObjectURL(blob);
            this.activeObjectUrl = objectUrl;
            this.setUrl(objectUrl);
            this.loading.set(false);
          },
          error: (error: unknown) => {
            const fallo = falloConsulta(error, 'el documento');
            this.error.set(fallo.mensaje);
            this.reintentable.set(fallo.reintentable);
            this.loading.set(false);
          }
        });
        return;
      }

      // 3. Documento con URL directa
      if (doc.url) {
        this.setUrl(doc.url);
        this.loading.set(false);
        return;
      }

      this.error.set('Este documento no dispone de un archivo recuperable.');
      this.loading.set(false);
    } catch {
      this.error.set('No se pudo cargar el documento.');
      this.loading.set(false);
    }
  }

  private descargarBlob(blob: Blob, nombre: string): void {
    if (typeof window === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
