import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { Apelacion } from '../../models/apelacion.model';

interface ObservacionSubsanacion {
  numero: number;
  descripcion: string;
}

@Component({
  selector: 'app-subsanacion',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './subsanacion.component.html',
  styleUrl: './subsanacion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubsanacionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly authService = inject(AuthService);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');
  documentoSeleccionado = signal<File | null>(null);

  fundamentosAdicionales = '';

  readonly observacionesTtaip: ObservacionSubsanacion[] = [
    {
      numero: 1,
      descripcion: 'Falta fundamentación legal específica del artículo vulnerado de la Ley N° 27806.'
    },
    {
      numero: 2,
      descripcion: 'No se adjunta copia de la respuesta denegatoria de la entidad.'
    },
    {
      numero: 3,
      descripcion: 'Falta indicar el domicilio procesal para notificaciones.'
    }
  ];

  readonly pasosSubsanacion: string[] = [
    'Lea cada observación señalada por el TTAIP.',
    'Prepare los documentos que subsanan las observaciones.',
    'Describa claramente las correcciones realizadas.',
    'Adjunte los documentos complementarios.',
    'Envíe la subsanación antes del plazo límite.'
  ];

  readonly documentosOriginales: string[] = [
    'Recurso_Apelacion.pdf',
    'DNI_Copia.pdf',
    'Calificacion_Inadmisible.pdf'
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

  enviarSubsanacion(): void {
    const ap = this.apelacion();
    if (!ap) {
      return;
    }

    if (!this.fundamentosAdicionales.trim()) {
      this.error.set('Debe ingresar los fundamentos adicionales o correcciones');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.apelacionService.subsanar(ap.id, this.fundamentosAdicionales).subscribe({
      next: () => {
        this.loading.set(false);
        this.mensaje.set('Subsanación enviada correctamente. El TTAIP revisará su apelación en la segunda calificación.');
        setTimeout(() => this.router.navigate(['/ciudadano']), 2000);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.mensaje || err.error?.message || 'Error al enviar la subsanación');
      }
    });
  }
}
