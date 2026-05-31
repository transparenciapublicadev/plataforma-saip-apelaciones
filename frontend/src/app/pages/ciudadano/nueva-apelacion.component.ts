import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { EntidadService } from '../../services/entidad.service';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import {
  CanalPresentacionApelacion,
  TipoDenegatoriaApelacion,
  TipoOrigenApelacion
} from '../../models/apelacion.model';
import { Entidad } from '../../models/entidad.model';
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
  private readonly entidadService = inject(EntidadService);
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
  tipoOrigen = signal<TipoOrigenApelacion>('SAIP_INTERNA');
  canalPresentacion = signal<CanalPresentacionApelacion>('DIRECTA_TTAIP');
  entidades = signal<Entidad[]>([]);

  fundamentos = '';
  entidadExternaId: number | null = null;
  entidadExternaNombre = '';
  entidadExternaRuc = '';
  entidadExternaEmail = '';
  numeroSolicitudExterna = '';
  fechaPresentacionSolicitudExterna = '';
  fechaRespuestaEntidad = '';
  tipoDenegatoriaExterna = signal<TipoDenegatoriaApelacion>('EXPRESA');
  resumenSolicitudOriginal = '';
  resumenRespuestaEntidad = '';
  referenciaCargoRecepcion = '';
  observacionExterna = '';
  fechaPresentacionAnteEntidad = this.fechaHoyIso();
  referenciaCargoPresentacionEntidad = '';
  observacionPresentacionEntidad = '';

  readonly uploadedCount = computed(() => [this.file1(), this.file2(), this.file3()].filter((file) => file !== null).length);
  readonly allFilesUploaded = computed(() => this.uploadedCount() === 3);
  readonly requiredDocuments = computed<RequiredAppealDocument[]>(() => [
      {
        n: '01',
        fileNum: 1,
        label: 'SAIP original',
        desc: 'Documento de su solicitud original presentada a la entidad.'
      },
      {
        n: '02',
        fileNum: 2,
        label: this.esApelacionExterna() && this.tipoDenegatoriaExterna() === 'TACITA'
          ? 'Sustento de silencio administrativo'
          : 'Respuesta de la entidad',
        desc: this.esApelacionExterna() && this.tipoDenegatoriaExterna() === 'TACITA'
          ? 'Constancia o declaración que sustenta la ausencia de respuesta dentro del plazo.'
          : 'Documento oficial de respuesta emitido por la entidad.'
      },
      {
        n: '03',
        fileNum: 3,
        label: 'Recurso fundamentado',
        desc: 'Documento donde fundamenta las razones de su apelación.'
      }
    ]);

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
    this.cargarEntidades();
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
    this.tipoOrigen.set('SAIP_INTERNA');
    this.canalPresentacion.set('DIRECTA_TTAIP');
    this.solicitud.set(solicitud);
    this.modoSeleccion.set(false);
    this.error.set('');

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  iniciarApelacionExterna(): void {
    this.tipoOrigen.set('EXTERNA');
    this.canalPresentacion.set('DIRECTA_TTAIP');
    this.solicitud.set(null);
    this.modoSeleccion.set(false);
    this.loadingSolicitud.set(false);
    this.error.set('');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  volverASeleccion(): void {
    this.solicitud.set(null);
    this.tipoOrigen.set('SAIP_INTERNA');
    this.canalPresentacion.set('DIRECTA_TTAIP');
    this.modoSeleccion.set(true);
    this.fundamentos = '';
    this.file1.set(null);
    this.file2.set(null);
    this.file3.set(null);
    this.searchTerm.set('');
    this.error.set('');
    this.mensaje.set('');
    this.resetDatosExternos();
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
    return (this.esApelacionExterna() ? this.datosExternosValidos() : !!this.solicitud())
      && (!this.esPresentacionAnteEntidad()
        || (!!this.fechaPresentacionAnteEntidad && this.referenciaCargoPresentacionEntidad.trim().length > 0))
      && this.allFilesUploaded()
      && this.fundamentos.trim().length >= 50;
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

    const sesion = this.authService.obtenerSesion();
    if (!sesion?.ciudadanoId) {
      this.error.set('Error de sesión');
      return;
    }

    this.confirmModalAbierto.set(false);
    this.loading.set(true);
    this.error.set('');

    const creacion$ = this.esApelacionExterna()
      ? this.apelacionService.crearExterna({
          ciudadanoId: sesion.ciudadanoId,
          entidadId: this.entidadExternaId ?? undefined,
          entidadExternaNombre: this.entidadExternaNombre.trim() || undefined,
          entidadExternaRuc: this.entidadExternaRuc.trim() || undefined,
          entidadExternaEmail: this.entidadExternaEmail.trim() || undefined,
          numeroSolicitudExterna: this.numeroSolicitudExterna.trim(),
          fechaPresentacionSolicitudExterna: this.fechaPresentacionSolicitudExterna,
          fechaRespuestaEntidad: this.tipoDenegatoriaExterna() === 'EXPRESA' ? this.fechaRespuestaEntidad : undefined,
          tipoDenegatoria: this.tipoDenegatoriaExterna(),
          resumenSolicitudOriginal: this.resumenSolicitudOriginal.trim(),
          resumenRespuestaEntidad: this.tipoDenegatoriaExterna() === 'EXPRESA'
            ? this.resumenRespuestaEntidad.trim() || undefined
            : undefined,
          referenciaDocumentoSolicitud: this.file1()?.name || '',
          referenciaCargoRecepcion: this.referenciaCargoRecepcion.trim() || undefined,
          referenciaRespuestaEntidad: this.tipoDenegatoriaExterna() === 'EXPRESA'
            ? this.file2()?.name || undefined
            : undefined,
          evidenciaSilencioAdministrativo: this.tipoDenegatoriaExterna() === 'TACITA'
            ? this.file2()?.name || undefined
            : undefined,
          fundamentos: this.fundamentos.trim(),
          observacion: this.observacionExterna.trim() || undefined
        })
      : this.esPresentacionAnteEntidad()
      ? this.apelacionService.crearAnteEntidad({
          solicitudId: this.solicitud()!.id,
          ciudadanoId: sesion.ciudadanoId,
          fundamentos: this.fundamentos.trim(),
          fechaPresentacionAnteEntidad: this.fechaPresentacionAnteEntidad,
          referenciaCargoPresentacion: this.referenciaCargoPresentacionEntidad.trim(),
          observacion: this.observacionPresentacionEntidad.trim() || undefined
        })
      : this.apelacionService.crear({
          solicitudId: this.solicitud()!.id,
          ciudadanoId: sesion.ciudadanoId,
          fundamentos: this.fundamentos.trim()
        });

    creacion$.subscribe({
      next: (resp) => {
        this.loading.set(false);
        this.expedienteTtaip.set(resp.expediente || '');
        this.mensaje.set(`Apelación creada correctamente. Expediente: ${resp.expediente}`);
        this.successModalAbierto.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.detail || err.error?.mensaje || 'Error al crear la apelación');
      }
    });
  }

  apelacionConfirmSummary(): ReferenceConfirmSummary[] {
    return [
      { label: this.esApelacionExterna() ? 'Solicitud externa' : 'Expediente', value: this.solicitudOrigenDisplay(), mono: true },
      { label: 'Entidad', value: this.entidadOrigenDisplay() },
      { label: 'Asunto original', value: this.asuntoOrigenDisplay() },
      { label: 'Documentos', value: `${this.uploadedCount()} de 3 adjuntos` },
      { label: 'Fundamentos', value: `${this.fundamentos.trim().length} caracteres` },
      { label: 'Ingreso', value: this.canalPresentacionDisplay() }
    ];
  }

  apelacionWarning(): ReferenceConfirmWarning {
    return {
      label: 'Recurso irrevocable',
      detail: 'Una vez elevada, la apelación no puede retirarse. El TTAIP resolverá según los plazos legales.'
    };
  }

  apelacionSuccessMetadata(): ReferenceSuccessMeta[] {
    return [
      { label: this.esApelacionExterna() ? 'Solicitud externa' : 'Expediente original', value: this.solicitudOrigenDisplay(), mono: true },
      { label: 'Entidad apelada', value: this.entidadOrigenDisplay() },
      { label: 'Documentos adjuntos', value: `${this.uploadedCount()} de 3` },
      { label: 'Fundamentos', value: `${this.fundamentos.length} caracteres` }
    ];
  }

  apelacionNextSteps(): ReferenceSuccessNextStep[] {
    if (this.esPresentacionAnteEntidad()) {
      return [
        {
          label: 'La entidad debe elevar el recurso al TTAIP en 2 días hábiles.',
          hint: 'El cargo presentado queda registrado para trazabilidad.'
        },
        { label: 'Si la entidad omite elevarlo, podrá comunicar la omisión al Tribunal con su prueba.' },
        { label: 'Al ingresar al TTAIP, el recurso pasará a primera calificación.' }
      ];
    }
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

  esApelacionExterna(): boolean {
    return this.tipoOrigen() === 'EXTERNA';
  }

  esPresentacionAnteEntidad(): boolean {
    return !this.esApelacionExterna() && this.canalPresentacion() === 'ANTE_ENTIDAD';
  }

  canalPresentacionDisplay(): string {
    return this.esPresentacionAnteEntidad() ? 'Ante la entidad pública' : 'Directo al TTAIP';
  }

  confirmDescription(): string {
    return this.esPresentacionAnteEntidad()
      ? 'Revise el expediente, cargo y fundamentos antes de registrar el recurso ante la entidad para su elevación.'
      : 'Revise el expediente, los documentos y los fundamentos antes de presentar el recurso al Tribunal.';
  }

  confirmLabel(): string {
    return this.esPresentacionAnteEntidad() ? 'Registrar ante entidad' : 'Presentar al Tribunal';
  }

  successEyebrow(): string {
    return this.esPresentacionAnteEntidad() ? 'Apelación registrada ante entidad' : 'Apelación presentada';
  }

  successTitle(): string {
    return this.esPresentacionAnteEntidad() ? 'Recurso pendiente de elevación' : 'Recurso recibido por el Tribunal';
  }

  successDescription(): string {
    return this.esPresentacionAnteEntidad()
      ? 'Su recurso quedó registrado ante la entidad pública. La entidad dispone de 2 días hábiles para elevarlo al TTAIP.'
      : 'Su recurso fue recibido por el Tribunal de Transparencia y pasará directamente a primera calificación. Recibirá notificaciones en cada etapa del procedimiento.';
  }

  successPlazoDias(): number {
    return this.esPresentacionAnteEntidad() ? 2 : 7;
  }

  successPlazoDescripcion(): string {
    return this.esPresentacionAnteEntidad()
      ? 'La entidad pública debe elevar el recurso al TTAIP dentro de este plazo.'
      : 'El TTAIP realizará la 1ra calificación de admisibilidad dentro de este plazo.';
  }

  solicitudOrigenDisplay(): string {
    return this.esApelacionExterna()
      ? this.numeroSolicitudExterna.trim() || 'Solicitud externa'
      : this.solicitud()?.expediente || '—';
  }

  entidadOrigenDisplay(): string {
    if (!this.esApelacionExterna()) {
      return this.solicitud()?.entidadNombre || '—';
    }
    const entidadCatalogo = this.entidades().find((entidad) => entidad.id === this.entidadExternaId);
    return entidadCatalogo?.nombre || this.entidadExternaNombre.trim() || '—';
  }

  asuntoOrigenDisplay(): string {
    return this.esApelacionExterna()
      ? this.resumenSolicitudOriginal.trim() || '—'
      : this.solicitud()?.asunto || '—';
  }

  origenVinculoDisplay(): string {
    return this.esApelacionExterna()
      ? `Solicitud externa · ${this.solicitudOrigenDisplay()}`
      : `Expediente vinculado · ${this.solicitudOrigenDisplay()}`;
  }

  successExpedienteHint(): string {
    return `Vinculado a ${this.solicitudOrigenDisplay()}`;
  }

  private validarApelacion(): boolean {
    if (!this.esApelacionExterna() && !this.solicitud()) {
      this.error.set('Debe seleccionar una solicitud para continuar');
      return false;
    }

    if (this.esApelacionExterna() && !this.datosExternosValidos()) {
      this.error.set('Complete los datos obligatorios de la solicitud externa y su tipo de denegatoria');
      return false;
    }

    if (this.esPresentacionAnteEntidad()
        && (!this.fechaPresentacionAnteEntidad || !this.referenciaCargoPresentacionEntidad.trim())) {
      this.error.set('Registre la fecha de presentación y la referencia del cargo entregado por la entidad');
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

  private cargarEntidades(): void {
    this.entidadService.findActivas().subscribe({
      next: (entidades) => this.entidades.set(entidades),
      error: () => this.entidades.set([])
    });
  }

  private datosExternosValidos(): boolean {
    const entidadRegistrada = !!this.entidadExternaId || this.entidadExternaNombre.trim().length > 0;
    const respuestaValida = this.tipoDenegatoriaExterna() === 'TACITA'
      || this.fechaRespuestaEntidad.length > 0;
    return entidadRegistrada
      && this.numeroSolicitudExterna.trim().length > 0
      && this.fechaPresentacionSolicitudExterna.length > 0
      && this.resumenSolicitudOriginal.trim().length > 0
      && respuestaValida;
  }

  private resetDatosExternos(): void {
    this.entidadExternaId = null;
    this.entidadExternaNombre = '';
    this.entidadExternaRuc = '';
    this.entidadExternaEmail = '';
    this.numeroSolicitudExterna = '';
    this.fechaPresentacionSolicitudExterna = '';
    this.fechaRespuestaEntidad = '';
    this.tipoDenegatoriaExterna.set('EXPRESA');
    this.resumenSolicitudOriginal = '';
    this.resumenRespuestaEntidad = '';
    this.referenciaCargoRecepcion = '';
    this.observacionExterna = '';
    this.fechaPresentacionAnteEntidad = this.fechaHoyIso();
    this.referenciaCargoPresentacionEntidad = '';
    this.observacionPresentacionEntidad = '';
  }

  private fechaHoyIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

