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
import { DocumentoService } from '../services/documento.service';
import { Subscription } from 'rxjs';

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
  @Output() close = new EventEmitter<void>();

  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  rawUrl = signal<string | null>(null);
  safeUrl = signal<SafeResourceUrl | null>(null);
  isPdf = signal<boolean>(false);
  isImage = signal<boolean>(false);

  private activeObjectUrl: string | null = null;
  private currentBlob: Blob | null = null;
  private downloadSub?: Subscription;

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.open) {
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

  private resetState(): void {
    if (this.downloadSub) {
      this.downloadSub.unsubscribe();
      this.downloadSub = undefined;
    }
    this.cleanupObjectUrl();
    this.loading.set(false);
    this.error.set(null);
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
    this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
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
          error: () => {
            const fallbackUrl = this.resolveCanonicalUrl(nombre);
            if (fallbackUrl) {
              this.setUrl(fallbackUrl);
            } else {
              this.error.set('No se pudo generar el enlace del documento.');
            }
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

      // 4. Documento canónico / oficial en storage estático
      const canonicalUrl = this.resolveCanonicalUrl(nombre);
      if (canonicalUrl) {
        this.setUrl(canonicalUrl);
        this.loading.set(false);
        return;
      }

      this.error.set('No se pudo generar el enlace del documento.');
      this.loading.set(false);
    } catch (err) {
      this.error.set(`No se pudo cargar el documento: ${err}`);
      this.loading.set(false);
    }
  }

  private resolveCanonicalUrl(nombre: string): string | null {
    const n = (nombre || '').toLowerCase();
    if (n.includes('resolucion') || n.includes('final') || n.includes('ttaip-res') || n.includes('2325') || n.includes('2299') || n.includes('001079')) {
      return '/assets/docs/RESOLUCION_001079-2026_JUS-TTAIP-SEGUNDA SALA.pdf';
    }
    if (n.includes('cedula') || n.includes('notificacion') || n.includes('admision') || n.includes('calificacion') || n.includes('9925') || n.includes('9926')) {
      return '/assets/docs/ADMISION - RECURRENTE.pdf';
    }
    if (n.includes('respuesta') || n.includes('oficio') || n.includes('fundado') || n.includes('entrega')) {
      return '/assets/docs/FUNDADO O FUNDADO EN PARTE - RECURRENTE.pdf';
    }
    if (n.includes('saip') || n.includes('solicitud') || n.includes('original') || n.includes('cargo') || n.includes('dni')) {
      return '/assets/docs/SAIP-OFICIAL.pdf';
    }
    if (n.includes('mapa') || n.includes('proceso') || n.includes('flujo')) {
      return '/assets/docs/Mapa_Integral_Procesos_SAIP_TTAIP_OFICIAL.pdf';
    }
    if (n.endsWith('.pdf')) {
      return '/assets/docs/SAIP-OFICIAL.pdf';
    }
    return null;
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
