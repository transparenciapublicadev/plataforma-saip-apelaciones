import { DatePipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of, switchMap } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { errorActuacion, type FaseCumplimientoTtaip, type PasoCumplimiento, TtaipActuacionesService } from '../../../services/ttaip-actuaciones.service';
import { DocumentPreviewModalComponent, type DocumentPreviewTarget } from '../../../shared/document-preview-modal.component';
import { MultiFileUploadZoneComponent } from '../../../shared/multi-file-upload-zone.component';
import { ReferenceSuccessModalComponent, type ReferenceSuccessMeta } from '../../../shared/reference-success-modal.component';
import { StatusBadgeComponent } from '../../../shared/status-badge.component';
import type { DocumentoMetadata } from '../../../models/documento.model';
import { buildDocWord, downloadBlob } from './official-docs.util';
import { TtaipDocumentoFilaComponent } from './ttaip-documento-fila.component';

const RECIBO = { entrega: 'operacionEntrega', 'validacion-entrega': 'operacionValidacion', remision: 'operacionRemision' } as const;
const PERMISO = { entrega: 'puedeEntregar', 'validacion-entrega': 'puedeValidar', remision: 'puedeRemitir' } as const;
const ADJUNTOS = {
  entrega: [{ nombre: 'respuesta', etiqueta: 'Respuesta al administrado' }],
  'validacion-entrega': [{ nombre: 'cargo', etiqueta: 'Cargo de notificación' }, { nombre: 'acuse', etiqueta: 'Acuse de notificación' }],
  remision: [{ nombre: 'oficio', etiqueta: 'Oficio de cumplimiento' }],
} as const;

interface Operacion {
  paso: PasoCumplimiento;
  faseId: number;
  id: string;
  datos: FormData;
}

@Component({
  selector: 'app-cumplimiento-documental',
  imports: [DatePipe, ReactiveFormsModule, TtaipDocumentoFilaComponent, DocumentPreviewModalComponent,
    MultiFileUploadZoneComponent, ReferenceSuccessModalComponent, StatusBadgeComponent],
  templateUrl: './cumplimiento-documental.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CumplimientoDocumentalComponent {
  readonly expedienteId = input.required<number>();
  readonly ciudadano = input(false);
  readonly esperaNotificaciones = input(false);
  readonly cerrado = output<void>();
  private readonly api = inject(TtaipActuacionesService);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  private revision = 0;

  readonly fase = signal<FaseCumplimientoTtaip | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly paso = signal<PasoCumplimiento | null>(null);
  readonly pendiente = signal<Operacion | null>(null);
  readonly reintentoPermitido = signal(false);
  readonly preview = signal<DocumentPreviewTarget | null>(null);
  readonly adjuntos = ADJUNTOS;
  readonly archivos = signal<Partial<Record<string, File[]>>>({});
  readonly anexos = signal<File[]>([]);
  readonly remisionConfirmada = signal<FaseCumplimientoTtaip | null>(null);
  readonly detalleRemision = computed<ReferenceSuccessMeta[]>(() => {
    const fase = this.remisionConfirmada();
    if (!fase?.numeroOficio || !fase.fechaRemision) return [];
    return [
      { label: 'Número de oficio', value: fase.numeroOficio, mono: true },
      { label: 'Fecha de remisión', value: formatDate(fase.fechaRemision, 'dd/MM/yyyy', 'en-US'), mono: true },
      { label: 'Entidad', value: fase.entidad },
      { label: 'Documentos remitidos', value: String(fase.documentos.length) },
    ];
  });
  readonly campos = new FormGroup({
    fechaEficacia: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    numeroOficio: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    fundamento: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
  });
  readonly etiquetas = {
    RESPUESTA: 'Respuesta al administrado', ANEXO_RESPUESTA: 'Anexo de la respuesta',
    CARGO: 'Cargo de notificación', ACUSE: 'Acuse de notificación',
    OFICIO: 'Oficio de cumplimiento', ANEXO_OFICIO: 'Anexo del oficio',
  };

  constructor() {
    effect(() => {
      this.expedienteId();
      this.auth.cambiosSesion?.();
      this.fase.set(null);
      this.pendiente.set(null);
      this.paso.set(null);
      this.preview.set(null);
      this.remisionConfirmada.set(null);
      this.limpiarArchivos();
      this.mensaje.set('');
      this.campos.reset();
      untracked(() => this.consultar());
    });
  }

  consultar(): void {
    const vigente = this.contexto();
    this.ocupado.set(true);
    this.error.set('');
    this.reintentoPermitido.set(false);
    this.api.cumplimientoDocumental(this.expedienteId()).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: respuesta => {
        if (vigente()) this.confirmar(respuesta.cumplimiento);
      },
      error: error => {
        if (!vigente()) return;
        this.ocupado.set(false);
        this.error.set(errorActuacion(error, 'No se pudo consultar el cumplimiento.'));
      },
    });
  }

  private contexto(): () => boolean {
    const revision = ++this.revision;
    const expediente = this.expedienteId();
    const sesion = this.auth.cambiosSesion?.();
    return () => revision === this.revision && expediente === this.expedienteId() && sesion === this.auth.cambiosSesion?.();
  }

  private confirmar(fase: FaseCumplimientoTtaip | null): void {
    this.fase.set(fase);
    this.ocupado.set(false);
    const op = this.pendiente();
    if (!op) return;
    if (fase?.id === op.faseId && fase[RECIBO[op.paso]] === op.id) {
      this.paso.set(null);
      this.pendiente.set(null);
      this.error.set('');
      this.limpiarArchivos();
      this.mensaje.set(({ entrega: 'Respuesta y anexos disponibles para el administrado.',
        'validacion-entrega': 'Cargo y acuse validados. Se adjuntarán al remitir el oficio.',
        remision: fase.expedienteResuelto ? 'El Tribunal recibió el cumplimiento. El expediente está listo para archivo y publicación.'
          : 'El Tribunal recibió el cumplimiento. El expediente espera la última notificación de la resolución.' })[op.paso]);
      if (op.paso === 'remision') this.remisionConfirmada.set(fase);
    } else if (fase?.id === op.faseId && fase[PERMISO[op.paso]] && !fase[RECIBO[op.paso]]) {
      this.reintentoPermitido.set(true);
      if (!this.error()) this.error.set('El servidor aún no registra esta operación. Puede reintentar el mismo envío o corregir los datos.');
    } else {
      this.paso.set(null);
      this.pendiente.set(null);
      this.error.set('La consulta no confirmó esta operación. Revise el estado actual del expediente.');
    }
  }

  abrir(paso: PasoCumplimiento): void {
    if (this.ocupado() || this.pendiente() || !this.fase()?.[PERMISO[paso]]) return;
    this.error.set('');
    this.mensaje.set('');
    this.limpiarArchivos();
    this.paso.set(paso);
  }

  cancelar(): void {
    if (this.ocupado() || (this.pendiente() && !this.reintentoPermitido())) return;
    this.error.set('');
    this.pendiente.set(null);
    this.paso.set(null);
    this.limpiarArchivos();
  }

  private limpiarArchivos(): void {
    this.archivos.set({});
    this.anexos.set([]);
  }

  seleccionar(nombre: string, archivos: File[]): void {
    this.archivos.update(actual => ({ ...actual, [nombre]: archivos }));
  }

  cerrarConfirmacion(): void {
    const fase = this.remisionConfirmada();
    this.remisionConfirmada.set(null);
    if (fase?.expedienteResuelto) this.cerrado.emit();
  }

  enviar(): void {
    const paso = this.paso();
    const fase = this.fase();
    if (!paso || !fase || this.ocupado() || this.pendiente() || !fase[PERMISO[paso]]) return;
    const datos = new FormData();
    for (const adjunto of this.adjuntos[paso]) {
      const archivo = this.archivos()[adjunto.nombre]?.[0];
      if (!archivo) {
        this.error.set(`Adjunte el documento obligatorio «${adjunto.etiqueta}».`);
        return;
      }
      datos.set(adjunto.nombre, archivo);
    }
    const { fechaEficacia, numeroOficio, fundamento } = this.campos.getRawValue();
    if (paso === 'validacion-entrega') {
      if (!fechaEficacia) {
        this.error.set('Indique la fecha eficaz acreditada.');
        return;
      }
      datos.set('fechaEficacia', fechaEficacia);
    }
    if (paso === 'remision') {
      if (!numeroOficio.trim() || !fundamento.trim()) {
        this.error.set('Complete el número de oficio y el fundamento.');
        return;
      }
      datos.set('numeroOficio', numeroOficio.trim());
      datos.set('fundamento', fundamento.trim());
    }
    const id = crypto.randomUUID();
    if (paso !== 'validacion-entrega') {
      for (const anexo of this.anexos()) datos.append('anexos', anexo);
    }
    datos.set('operacion', id);
    this.ejecutar({ paso, faseId: fase.id, id, datos });
  }

  reintentar(): void {
    const op = this.pendiente();
    if (op && !this.ocupado() && this.reintentoPermitido()) this.ejecutar(op);
  }

  corregir(): void {
    if (this.reintentoPermitido() && !this.ocupado()) {
      this.pendiente.set(null);
      this.error.set('');
    }
  }

  private ejecutar(op: Operacion): void {
    const vigente = this.contexto();
    const expediente = this.expedienteId();
    this.pendiente.set(op);
    this.reintentoPermitido.set(false);
    this.ocupado.set(true);
    this.error.set('');
    this.api.registrarCumplimientoDocumental(expediente, op.paso, op.datos).pipe(
      catchError(error => {
        if (vigente()) this.error.set(errorActuacion(error, 'No se confirmó el envío.'));
        return of(null);
      }),
      switchMap(() => this.api.cumplimientoDocumental(expediente)),
      takeUntilDestroyed(this.destroy),
    ).subscribe({
      next: respuesta => {
        if (vigente()) this.confirmar(respuesta.cumplimiento);
      },
      error: () => {
        if (!vigente()) return;
        this.ocupado.set(false);
        this.error.set('No se pudo comprobar el resultado. Consulte el expediente antes de repetir el envío.');
      },
    });
  }

  borrador(): void {
    const fase = this.fase();
    if (!fase?.puedeRemitir) return;
    const { numeroOficio, fundamento } = this.campos.getRawValue();
    const { blob, filename } = buildDocWord('oficio-cumplimiento', 'final', undefined, {
      expediente: fase.numeroExpediente, entidad: fase.entidad, resolucionNro: fase.numeroResolucion,
      fechaCedula: fase.fechaEficaciaEntrega ?? undefined, numeroDocumento: numeroOficio.trim(),
      sumilla: fundamento.trim(),
    });
    downloadBlob(blob, filename);
  }

  ver(doc: DocumentoMetadata): void {
    if (doc.id) this.preview.set({ id: doc.id, nombre: doc.nombreOriginal || 'Documento registrado',
      tipo: doc.contentType, expediente: this.fase()?.numeroExpediente });
  }
}
