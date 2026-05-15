import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';
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

interface RequiredAppealDocument {
  n: string;
  fileNum: 1 | 2 | 3;
  label: string;
  desc: string;
}

@Component({
  selector: 'app-nueva-apelacion',
  imports: [CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent],
  templateUrl: './nueva-apelacion.component.html',
  styleUrl: './nueva-apelacion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NuevaApelacionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly solicitudService = inject(SolicitudService);
  private readonly authService = inject(AuthService);

  solicitud = signal<Solicitud | null>(null);
  solicitudesApelables = signal<Solicitud[]>([]);
  loading = signal<boolean>(false);
  loadingSolicitud = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);
  expedienteTtaip = signal<string>('');

  modoSeleccion = signal<boolean>(false);
  searchTerm = signal<string>('');
  file1 = signal<File | null>(null);
  file2 = signal<File | null>(null);
  file3 = signal<File | null>(null);

  fundamentos = '';

  readonly uploadedCount = computed(() => [this.file1(), this.file2(), this.file3()].filter((file) => file !== null).length);
  readonly allFilesUploaded = computed(() => this.uploadedCount() === 3);
  readonly requiredDocuments: RequiredAppealDocument[] = [
    {
      n: '01',
      fileNum: 1,
      label: 'SAIP original',
      desc: 'Documento de su solicitud original presentada a la entidad.'
    },
    {
      n: '02',
      fileNum: 2,
      label: 'Respuesta de la entidad',
      desc: 'Documento oficial de respuesta emitido por la entidad.'
    },
    {
      n: '03',
      fileNum: 3,
      label: 'Recurso fundamentado',
      desc: 'Documento donde fundamenta las razones de su apelación.'
    }
  ];

  readonly filteredSolicitudes = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const solicitudes = this.solicitudesApelables();
    if (!term) {
      return solicitudes;
    }

    return solicitudes.filter((sol) => {
      const expediente = (sol.expediente || '').toLowerCase();
      const entidad = (sol.entidadNombre || '').toLowerCase();
      const asunto = (sol.asunto || '').toLowerCase();
      return expediente.includes(term) || entidad.includes(term) || asunto.includes(term);
    });
  });

  ngOnInit(): void {
    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (expediente) {
      this.cargarSolicitud(expediente);
      return;
    }

    this.route.queryParams.subscribe((params) => {
      if (params['solicitudId']) {
        this.cargarSolicitudPorId(parseInt(params['solicitudId'], 10));
      } else if (params['expediente']) {
        this.cargarSolicitud(params['expediente']);
      } else {
        this.modoSeleccion.set(true);
        this.cargarSolicitudesApelables();
      }
    });
  }

  cargarSolicitud(expediente: string): void {
    this.loadingSolicitud.set(true);
    this.modoSeleccion.set(false);
    this.solicitudService.findByExpediente(expediente).subscribe({
      next: (data) => {
        this.solicitud.set(data);
        this.loadingSolicitud.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la solicitud');
        this.loadingSolicitud.set(false);
      }
    });
  }

  cargarSolicitudPorId(id: number): void {
    this.loadingSolicitud.set(true);
    this.modoSeleccion.set(false);
    this.solicitudService.findById(id).subscribe({
      next: (data) => {
        this.solicitud.set(data);
        this.loadingSolicitud.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la solicitud');
        this.loadingSolicitud.set(false);
      }
    });
  }

  cargarSolicitudesApelables(): void {
    this.loadingSolicitud.set(true);
    const sesion = this.authService.obtenerSesion();
    if (!sesion?.ciudadanoId) {
      this.error.set('Error de sesión');
      this.loadingSolicitud.set(false);
      return;
    }

    this.solicitudService.findByCiudadanoId(sesion.ciudadanoId).subscribe({
      next: (data) => {
        const estadosApelables = new Set(['DENEGADA', 'RESPONDIDA', 'VENCIDA']);
        const apelables = data.filter((sol) => estadosApelables.has(sol.estado) && !sol.apelacion);
        this.solicitudesApelables.set(apelables);
        this.loadingSolicitud.set(false);

        if (apelables.length === 0) {
          this.error.set('No tiene solicitudes apelables en este momento.');
        }
      },
      error: () => {
        this.error.set('Error al cargar las solicitudes');
        this.loadingSolicitud.set(false);
      }
    });
  }

  seleccionarSolicitud(solicitud: Solicitud): void {
    this.solicitud.set(solicitud);
    this.modoSeleccion.set(false);
    this.error.set('');

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  volverASeleccion(): void {
    this.solicitud.set(null);
    this.modoSeleccion.set(true);
    this.fundamentos = '';
    this.file1.set(null);
    this.file2.set(null);
    this.file3.set(null);
    this.searchTerm.set('');
    this.error.set('');
    this.mensaje.set('');
  }

  actualizarBusqueda(value: string): void {
    this.searchTerm.set(value);
  }

  onFileChange(event: Event, fileNum: 1 | 2 | 3): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (fileNum === 1) {
      this.file1.set(file);
    } else if (fileNum === 2) {
      this.file2.set(file);
    } else {
      this.file3.set(file);
    }
  }

  removeFile(fileNum: 1 | 2 | 3): void {
    if (fileNum === 1) {
      this.file1.set(null);
    } else if (fileNum === 2) {
      this.file2.set(null);
    } else {
      this.file3.set(null);
    }
  }

  getEstadoBadgeClass(estado: string): string {
    if (estado === 'DENEGADA' || estado === 'VENCIDA') {
      return 'pill pill-high';
    }
    if (estado === 'RESPONDIDA') {
      return 'pill';
    }
    return 'pill pill-medium';
  }

  getEstadoDisplay(estado: string): string {
    return estado.replaceAll('_', ' ');
  }

  fileFor(fileNum: 1 | 2 | 3): File | null {
    if (fileNum === 1) return this.file1();
    if (fileNum === 2) return this.file2();
    return this.file3();
  }

  fileSizeLabel(file: File): string {
    return `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }

  puedeEnviar(): boolean {
    return !!this.solicitud() && this.allFilesUploaded() && this.fundamentos.trim().length >= 50;
  }

  abrirConfirmacionApelacion(): void {
    if (!this.validarApelacion()) {
      return;
    }

    this.confirmModalAbierto.set(true);
  }

  crearApelacion(): void {
    if (!this.validarApelacion()) {
      return;
    }

    const sol = this.solicitud()!;
    const sesion = this.authService.obtenerSesion();
    if (!sesion?.ciudadanoId) {
      this.error.set('Error de sesión');
      return;
    }

    this.confirmModalAbierto.set(false);
    this.loading.set(true);
    this.error.set('');

    this.apelacionService.crear({
      solicitudId: sol.id,
      ciudadanoId: sesion.ciudadanoId,
      fundamentos: this.fundamentos.trim()
    }).subscribe({
      next: (resp) => {
        this.loading.set(false);
        this.expedienteTtaip.set(resp.expediente || '');
        this.mensaje.set(`Apelación creada correctamente. Expediente: ${resp.expediente}`);
        this.successModalAbierto.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.mensaje || 'Error al crear la apelación');
      }
    });
  }

  apelacionConfirmSummary(): ReferenceConfirmSummary[] {
    const sol = this.solicitud();
    return [
      { label: 'Expediente', value: sol?.expediente || '—', mono: true },
      { label: 'Entidad', value: sol?.entidadNombre || '—' },
      { label: 'Asunto original', value: sol?.asunto || '—' },
      { label: 'Documentos', value: `${this.uploadedCount()} de 3 adjuntos` },
      { label: 'Fundamentos', value: `${this.fundamentos.trim().length} caracteres` }
    ];
  }

  apelacionWarning(): ReferenceConfirmWarning {
    return {
      label: 'Recurso irrevocable',
      detail: 'Una vez elevada, la apelación no puede retirarse. El TTAIP resolverá según los plazos legales.'
    };
  }

  apelacionSuccessMetadata(): ReferenceSuccessMeta[] {
    const sol = this.solicitud();
    return [
      { label: 'Expediente original', value: sol?.expediente || '—', mono: true },
      { label: 'Entidad apelada', value: sol?.entidadNombre || '—' },
      { label: 'Documentos adjuntos', value: `${this.uploadedCount()} de 3` },
      { label: 'Fundamentos', value: `${this.fundamentos.length} caracteres` }
    ];
  }

  apelacionNextSteps(): ReferenceSuccessNextStep[] {
    return [
      {
        label: '1ra calificación: el TTAIP determinará admisibilidad.',
        hint: 'ADMISIBLE / INADMISIBLE / IMPROCEDENTE · 7 días háb.'
      },
      { label: 'Si es declarado INADMISIBLE, dispondrá de 2 días hábiles para subsanar.' },
      { label: 'De ser admitido, el Tribunal emitirá resolución final en 10 días hábiles.' }
    ];
  }

  irPanelCiudadano(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/ciudadano']);
  }

  verSolicitudOrigen(): void {
    const expediente = this.solicitud()?.expediente;
    this.successModalAbierto.set(false);
    this.router.navigate(expediente ? ['/ciudadano/solicitud', expediente] : ['/ciudadano']);
  }

  private validarApelacion(): boolean {
    if (!this.solicitud()) {
      this.error.set('Debe seleccionar una solicitud para continuar');
      return false;
    }

    if (!this.allFilesUploaded()) {
      this.error.set('Debe adjuntar los tres documentos obligatorios');
      return false;
    }

    if (this.fundamentos.trim().length < 50) {
      this.error.set('Los fundamentos deben tener al menos 50 caracteres');
      return false;
    }

    this.error.set('');
    return true;
  }
}

