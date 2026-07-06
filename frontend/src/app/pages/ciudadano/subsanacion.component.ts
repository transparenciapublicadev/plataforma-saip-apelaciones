import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { Apelacion } from '../../models/apelacion.model';
import {
  ReferenceConfirmModalComponent,
  ReferenceConfirmSummary,
  ReferenceConfirmWarning
} from '../../shared/reference-confirm-modal.component';
import {
  ReferenceSuccessMeta,
  ReferenceSuccessModalComponent,
  ReferenceSuccessNextStep
} from '../../shared/reference-success-modal.component';
import { DocumentoService } from '../../services/documento.service';
import { Documento } from '../../models/documento.model';

interface ObservacionSubsanacion {
  numero: number;
  descripcion: string;
}

@Component({
  selector: 'app-subsanacion',
  imports: [CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent],
  templateUrl: './subsanacion.component.html',
  styleUrl: './subsanacion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubsanacionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly authService = inject(AuthService);
  private readonly documentoService = inject(DocumentoService);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);
  documentoSeleccionado = signal<File | null>(null);

  fundamentosAdicionales = '';

  readonly pasosSubsanacion: string[] = [
    'Lea cada observación señalada por el TTAIP.',
    'Prepare los documentos que subsanan las observaciones.',
    'Describa claramente las correcciones realizadas.',
    'Adjunte los documentos complementarios.',
    'Envíe la subsanación antes del plazo límite.'
  ];

  ngOnInit(): void {
    this.authService.obtenerSesion();

    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (!expediente) {
      this.error.set('No se recibió el expediente para subsanar.');
      this.loadingApelacion.set(false);
      return;
    }

    this.cargarApelacion(expediente);
  }

  cargarApelacion(expediente: string): void {
    this.loadingApelacion.set(true);
    this.apelacionService.findByExpediente(expediente).subscribe({
      next: (data) => {
        this.apelacion.set(data);
        this.loadingApelacion.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la apelación');
        this.loadingApelacion.set(false);
      }
    });
  }

  calcularDiasRestantes(): number {
    const ap = this.apelacion();
    if (!ap || !ap.fechaSubsanacion) {
      return 0;
    }

    const fechaLimite = new Date(ap.fechaSubsanacion);
    fechaLimite.setDate(fechaLimite.getDate() + this.getPlazoSubsanacionDias());
    const hoy = new Date();
    const diff = Math.ceil((fechaLimite.getTime() - hoy.getTime()) / 86400000);
    return Math.max(diff, 0);
  }

  getPlazoSubsanacionDias(): number {
    return this.apelacion()?.diasSubsanacion || 2;
  }

  getFechaNotificacion(): Date | null {
    const ap = this.apelacion();
    if (!ap) {
      return null;
    }
    return ap.fechaSubsanacion ? new Date(ap.fechaSubsanacion) : new Date(ap.fechaApelacion);
  }

  getFechaLimite(): Date | null {
    const notificacion = this.getFechaNotificacion();
    if (!notificacion) {
      return null;
    }

    const limite = new Date(notificacion);
    limite.setDate(limite.getDate() + this.getPlazoSubsanacionDias());
    return limite;
  }

  seleccionarDocumento(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.documentoSeleccionado.set(file);
  }

  getDocumentoTamanoKb(): string {
    const file = this.documentoSeleccionado();
    if (!file) {
      return '0.0';
    }

    return (file.size / 1024).toFixed(1);
  }

  abrirConfirmacionSubsanacion(): void {
    if (!this.validarSubsanacion()) {
      return;
    }

    this.confirmModalAbierto.set(true);
  }

  descargarDocumento(doc: any): void {
    if (!doc.id) {
      this.error.set('No se puede descargar un documento sin ID.');
      return;
    }
    this.error.set('');
    this.documentoService.download(doc.id, doc.nombreArchivo || 'documento').subscribe({
      next: ({ blob, filename }) => {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.rel = 'noopener';
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      },
      error: (err) => {
        this.error.set('Error al descargar el documento.');
      }
    });
  }

  enviarSubsanacion(): void {
    const ap = this.apelacion();
    if (!ap) {
      return;
    }

    if (!this.validarSubsanacion()) {
      return;
    }

    this.confirmModalAbierto.set(false);
    this.loading.set(true);
    this.error.set('');

    this.apelacionService.subsanar(ap.id, this.fundamentosAdicionales).subscribe({
      next: (updated) => {
        const file = this.documentoSeleccionado();
        if (file) {
          this.documentoService.upload(file, 'SUBSANACION', { apelacionId: ap.id }).subscribe({
            next: () => {
              this.apelacion.set(updated ?? ap);
              this.loading.set(false);
              this.mensaje.set('Subsanación enviada correctamente y documento adjunto subido.');
              this.successModalAbierto.set(true);
            },
            error: (uploadErr) => {
              this.apelacion.set(updated ?? ap);
              this.loading.set(false);
              // Si la subida falla, advertir al usuario del fallo parcial:
              this.mensaje.set('Subsanación registrada, pero hubo un error al subir el archivo adjunto. Por favor, intente subir el documento nuevamente desde su panel.');
              this.successModalAbierto.set(true);
            }
          });
        } else {
          this.apelacion.set(updated ?? ap);
          this.loading.set(false);
          this.mensaje.set('Subsanación enviada correctamente. El TTAIP revisará su apelación en la segunda calificación.');
          this.successModalAbierto.set(true);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.mensaje || err.error?.message || 'Error al enviar la subsanación');
      }
    });
  }

  subsanacionConfirmSummary(): ReferenceConfirmSummary[] {
    const ap = this.apelacion();
    return [
      { label: 'Expediente', value: ap?.expediente || '—', mono: true },
      { label: 'Observaciones', value: `${this.observacionesTtaip().length} observaciones del TTAIP` },
      { label: 'Descripción', value: `${this.fundamentosAdicionales.trim().length} caracteres` },
      { label: 'Documento', value: this.documentoSeleccionado()?.name || '—' }
    ];
  }

  subsanacionWarning(): ReferenceConfirmWarning {
    return {
      label: 'Plazo de subsanación',
      detail: `Cuenta con ${this.getPlazoSubsanacionDias()} días hábiles desde la notificación. Una subsanación incompleta puede causar el archivo del expediente.`
    };
  }

  subsanacionSuccessMetadata(): ReferenceSuccessMeta[] {
    return [
      { label: 'Observaciones cubiertas', value: `${this.observacionesTtaip().length} de ${this.observacionesTtaip().length}` },
      { label: 'Documento adjunto', value: this.documentoSeleccionado()?.name || '—' },
      { label: 'Fundamentación', value: `${this.fundamentosAdicionales.length} caracteres` }
    ];
  }

  observacionesTtaip(): ObservacionSubsanacion[] {
    const observaciones = this.apelacion()?.resolucionPrimeraCalificacion?.observaciones?.trim();
    if (!observaciones) {
      return [];
    }

    return observaciones
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((descripcion, index) => ({ numero: index + 1, descripcion }));
  }

  documentosOriginales(): ReadonlyArray<Documento> {
    const documentos = this.apelacion()?.documentos ?? [];
    return documentos.filter(doc => doc.tipoDocumento !== 'SUBSANACION');
  }

  subsanacionNextSteps(): ReferenceSuccessNextStep[] {
    return [
      {
        label: 'Si la subsanación es válida, su apelación pasará a Resolución Final.',
        hint: 'Plazo del Tribunal: 10 días hábiles'
      },
      { label: 'Recibirá notificación con la 2da calificación.' }
    ];
  }

  irPanelCiudadano(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/ciudadano']);
  }

  private validarSubsanacion(): boolean {
    if (!this.apelacion()) {
      this.error.set('No se encontró la apelación para subsanar.');
      return false;
    }

    if (!this.fundamentosAdicionales.trim()) {
      this.error.set('Debe ingresar los fundamentos adicionales o correcciones');
      return false;
    }

    this.error.set('');
    return true;
  }
}
