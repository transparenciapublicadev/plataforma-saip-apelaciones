import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';

@Component({
  selector: 'app-nueva-apelacion',
  imports: [CommonModule, FormsModule, RouterLink],
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

  modoSeleccion = signal<boolean>(false);
  searchTerm = signal<string>('');
  file1 = signal<File | null>(null);
  file2 = signal<File | null>(null);
  file3 = signal<File | null>(null);

  fundamentos = '';

  readonly uploadedCount = computed(() => [this.file1(), this.file2(), this.file3()].filter((file) => file !== null).length);
  readonly allFilesUploaded = computed(() => this.uploadedCount() === 3);

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

  puedeEnviar(): boolean {
    return !!this.solicitud() && this.allFilesUploaded() && this.fundamentos.trim().length >= 50;
  }

  crearApelacion(): void {
    const sol = this.solicitud();
    if (!sol) {
      this.error.set('Debe seleccionar una solicitud para continuar');
      return;
    }

    if (!this.allFilesUploaded()) {
      this.error.set('Debe adjuntar los tres documentos obligatorios');
      return;
    }

    if (this.fundamentos.trim().length < 50) {
      this.error.set('Los fundamentos deben tener al menos 50 caracteres');
      return;
    }

    const sesion = this.authService.obtenerSesion();
    if (!sesion?.ciudadanoId) {
      this.error.set('Error de sesión');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.apelacionService.crear({
      solicitudId: sol.id,
      ciudadanoId: sesion.ciudadanoId,
      fundamentos: this.fundamentos.trim()
    }).subscribe({
      next: (resp) => {
        this.loading.set(false);
        this.mensaje.set(`Apelación creada correctamente. Expediente: ${resp.expediente}`);
        setTimeout(() => {
          this.router.navigate(['/ciudadano']);
        }, 2000);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.mensaje || 'Error al crear la apelación');
      }
    });
  }
}

