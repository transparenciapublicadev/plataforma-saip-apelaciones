import { Component, ChangeDetectionStrategy, OnInit, computed, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { EntidadService } from '../../services/entidad.service';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { UsuarioAdmin, UsuarioService } from '../../services/usuario.service';
import { Entidad } from '../../models/entidad.model';
import { Solicitud } from '../../models/solicitud.model';
import { Apelacion } from '../../models/apelacion.model';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { TourStep } from '../../core/guided-tour/guided-tour.model';

interface ChartDatum {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

interface DonutChartDatum extends ChartDatum {
  dashArray: string;
  dashOffset: string;
}

type AdminTab = 'resumen' | 'entidades' | 'usuarios' | 'reportes' | 'configuracion' | 'solicitudes';
type ActivityTone = 'success' | 'info' | 'warning' | 'danger' | 'brand';

interface RecentActivity {
  tone: ActivityTone;
  label: string;
  detail: string;
  date: Date;
}

import {
  LucideShield, LucideFileText, LucideUsers, LucideBuilding2, LucideAward,
  LucideClock, LucideCheckCircle2, LucideAlertTriangle, LucideScale, LucideBarChart,
  LucideDownload, LucideSettings
} from '@lucide/angular';

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    FormsModule, DatePipe, DecimalPipe,
    LucideShield, LucideFileText, LucideUsers, LucideBuilding2, LucideAward,
    LucideClock, LucideCheckCircle2, LucideAlertTriangle, LucideScale, LucideBarChart,
    LucideDownload, LucideSettings
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit {
  private readonly entidadService = inject(EntidadService);
  private readonly solicitudService = inject(SolicitudService);
  private readonly apelacionService = inject(ApelacionService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly tourService = inject(GuidedTourService);

  readonly tourSteps: TourStep[] = [
    { selector: '[data-tour="a-kpis"]', title: 'Indicadores principales', body: 'La salud global del sistema de un vistazo: total de solicitudes, usuarios activos, entidades y cumplimiento promedio.' },
    { selector: '[data-tour="a-status"]', title: 'Estado de las solicitudes', body: 'El desglose por estado: en proceso, respondidas, vencidas y apelaciones en curso.' },
    { selector: '[data-tour="a-tabs"]', title: 'Áreas de administración', body: 'Navega entre Resumen, Entidades, Usuarios, Reportes y Configuración. Te mostraremos cada una.' },
    { selector: '[data-tour="a-overview"]', title: 'Resumen operativo', body: 'Ranking de mejor desempeño, entidades con solicitudes vencidas y la actividad reciente del sistema.', align: 'start', onEnter: () => this.cambiarTab('resumen') },
    { selector: '[data-tour="a-entities"]', title: 'Entidades públicas', body: 'Gestiona las entidades: cargas, cumplimiento y estado. Aquí puedes crear, editar o dar de baja.', align: 'start', onEnter: () => this.cambiarTab('entidades') },
    { selector: '[data-tour="a-users"]', title: 'Usuarios del sistema', body: 'Administra ciudadanos, funcionarios y personal del Tribunal, con filtros por tipo y actividad.', align: 'start', onEnter: () => this.cambiarTab('usuarios') },
    { selector: '[data-tour="a-reports"]', title: 'Reportes exportables', body: 'Genera reportes en PDF, Excel o CSV de solicitudes, entidades, usuarios, apelaciones y consolidados.', align: 'start', onEnter: () => this.cambiarTab('reportes') },
    { selector: '[data-tour="a-settings"]', title: 'Configuración', body: 'Ajusta plazos legales por etapa y las reglas de notificación del sistema.', align: 'start', onEnter: () => this.cambiarTab('configuracion') },
  ];

  loading = signal<boolean>(true);
  loadingUsuarios = signal<boolean>(false);
  loadingSolicitudes = signal<boolean>(false);

  error = signal<string>('');
  mensaje = signal<string>('');

  entidades = signal<Entidad[]>([]);
  usuarios = signal<UsuarioAdmin[]>([]);
  solicitudes = signal<Solicitud[]>([]);
  apelaciones = signal<Apelacion[]>([]);

  totalEntidades = signal<number>(0);
  entidadesActivas = signal<number>(0);
  totalSolicitudes = signal<number>(0);
  totalUsuarios = signal<number>(0);
  totalApelaciones = signal<number>(0);
  tasaCumplimiento = signal<number>(0);

  pendientes = signal<number>(0);
  enProceso = signal<number>(0);
  respondidas = signal<number>(0);
  denegadas = signal<number>(0);
  vencidas = signal<number>(0);

  apelacionesPendientes = signal<number>(0);
  apelacionesEnAnalisis = signal<number>(0);
  apelacionesResueltas = signal<number>(0);

  ciudadanos = signal<number>(0);
  funcionarios = signal<number>(0);
  miembrosTTAIP = signal<number>(0);
  administradores = signal<number>(0);

  tabActual = signal<AdminTab>('resumen');
  modalEntidadAbierto = signal<boolean>(false);
  modalUsuarioAbierto = signal<boolean>(false);
  entidadEditando = signal<boolean>(false);

  busquedaEntidad = '';
  busquedaUsuario = '';
  busquedaSolicitud = '';
  filtroTipoUsuario = '';
  filtroEstadoSolicitud = '';

  nuevaEntidad: Partial<Entidad> = {
    nombre: '',
    acronimo: '',
    direccion: '',
    telefono: '',
    email: '',
    descripcion: ''
  };

  nuevoUsuario = {
    email: '',
    password: '',
    tipoUsuario: ''
  };

  readonly donutCircumference = 2 * Math.PI * 42;
  readonly plazoSaipDias = 10;
  readonly plazoTtaipResolucionDias = 10;

  private entidadIdEditando: number | null = null;

  readonly actividadReciente = computed<RecentActivity[]>(() => {
    const items: RecentActivity[] = [];

    for (const solicitud of this.solicitudes()) {
      items.push({
        tone: this.activityToneForSolicitud(solicitud.estado),
        label: this.activityLabelForSolicitud(solicitud.estado),
        detail: `${solicitud.expediente || 'Sin expediente'} · ${this.fechaRelativa(solicitud.fechaPresentacion)}`,
        date: this.parseDate(solicitud.fechaPresentacion)
      });
    }

    for (const apelacion of this.apelaciones()) {
      items.push({
        tone: this.activityToneForApelacion(apelacion.estado),
        label: this.activityLabelForApelacion(apelacion.estado),
        detail: `${apelacion.expediente || 'Sin expediente'} · ${this.fechaRelativa(apelacion.fechaApelacion)}`,
        date: this.parseDate(apelacion.fechaApelacion)
      });
    }

    for (const usuario of this.usuarios()) {
      items.push({
        tone: 'warning',
        label: 'Usuario registrado',
        detail: `${usuario.tipoUsuario} · ${this.fechaRelativa(usuario.fechaRegistro)}`,
        date: this.parseDate(usuario.fechaRegistro)
      });
    }

    return items
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5);
  });

  ngOnInit(): void {
    this.cargarDatos();
    this.tourService.checkAutoStart('saip_tour_admin', this.tourSteps);
  }

  cargarDatos(): void {
    this.loading.set(true);

    this.entidadService.findAll().subscribe({
      next: (data) => {
        this.entidades.set(data);
        this.totalEntidades.set(data.length);
        this.entidadesActivas.set(data.filter(e => e.activa).length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar entidades');
        this.loading.set(false);
      }
    });

    this.solicitudService.getEstadisticas().subscribe({
      next: (data) => {
        this.totalSolicitudes.set(data.total || 0);
        this.pendientes.set(data.pendientes || 0);
        this.enProceso.set(data.enProceso || 0);
        this.respondidas.set(data.respondidas || 0);
        this.denegadas.set(data.denegadas || 0);
        this.vencidas.set(data.vencidas || 0);

        const total = data.total || 0;
        const respondidas = (data.respondidas || 0) + (data.denegadas || 0);
        const vencidas = data.vencidas || 0;
        if (total > 0) {
          const tasa = Math.round(((respondidas) / (total - vencidas)) * 100) || 0;
          this.tasaCumplimiento.set(Math.min(tasa, 100));
        }
      }
    });

    this.apelacionService.getEstadisticas().subscribe({
      next: (data) => {
        this.totalApelaciones.set(data.total || 0);
        this.apelacionesPendientes.set(data.pendientes || 0);
        this.apelacionesEnAnalisis.set(data.enAnalisis || 0);
        this.apelacionesResueltas.set(data.resueltas || 0);
      }
    });

    this.cargarUsuarios();
    this.cargarSolicitudes();
    this.cargarApelaciones();
  }

  cargarUsuarios(): void {
    this.loadingUsuarios.set(true);
    this.usuarioService.findAll().subscribe({
      next: (usuarios) => {
        this.usuarios.set(usuarios);
        this.totalUsuarios.set(usuarios.length);
        this.ciudadanos.set(usuarios.filter(u => u.tipoUsuario === 'CIUDADANO').length);
        this.funcionarios.set(usuarios.filter(u => u.tipoUsuario === 'FUNCIONARIO').length);
        this.miembrosTTAIP.set(usuarios.filter(u => u.tipoUsuario === 'TTAIP').length);
        this.administradores.set(usuarios.filter(u => u.tipoUsuario === 'ADMINISTRADOR').length);
        this.loadingUsuarios.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.mensaje || 'Error al cargar usuarios');
        this.loadingUsuarios.set(false);
      }
    });
  }

  cargarSolicitudes(): void {
    this.loadingSolicitudes.set(true);
    this.solicitudService.findAll().subscribe({
      next: (data) => {
        this.solicitudes.set(data);
        this.loadingSolicitudes.set(false);
      },
      error: () => {
        this.error.set('Error al cargar solicitudes');
        this.loadingSolicitudes.set(false);
      }
    });
  }

  cargarApelaciones(): void {
    this.apelacionService.findAll().subscribe({
      next: (data) => this.apelaciones.set(data),
      error: () => {
        this.apelaciones.set([]);
      }
    });
  }

  cambiarTab(tab: AdminTab): void {
    this.tabActual.set(tab);
    if (tab === 'usuarios' && this.usuarios().length === 0) {
      this.cargarUsuarios();
    }
    if (tab === 'solicitudes' && this.solicitudes().length === 0) {
      this.cargarSolicitudes();
    }
  }

  startTour(): void {
    this.tourService.startTour('saip_tour_admin', this.tourSteps);
  }

  entidadesFiltradas(): Entidad[] {
    let resultado = this.entidades();
    if (this.busquedaEntidad) {
      const busqueda = this.busquedaEntidad.toLowerCase();
      resultado = resultado.filter(e =>
        e.nombre.toLowerCase().includes(busqueda) ||
        e.acronimo.toLowerCase().includes(busqueda)
      );
    }
    return resultado;
  }

  usuariosFiltrados(): UsuarioAdmin[] {
    let resultado = this.usuarios();
    if (this.busquedaUsuario) {
      const busqueda = this.busquedaUsuario.toLowerCase();
      resultado = resultado.filter(u => u.email.toLowerCase().includes(busqueda));
    }
    if (this.filtroTipoUsuario) {
      resultado = resultado.filter(u => u.tipoUsuario === this.filtroTipoUsuario);
    }
    return resultado;
  }

  solicitudesFiltradas(): Solicitud[] {
    let resultado = this.solicitudes();
    if (this.busquedaSolicitud) {
      const busqueda = this.busquedaSolicitud.toLowerCase();
      resultado = resultado.filter(s =>
        s.expediente.toLowerCase().includes(busqueda)
      );
    }
    if (this.filtroEstadoSolicitud) {
      resultado = resultado.filter(s => s.estado === this.filtroEstadoSolicitud);
    }
    return resultado;
  }

  topEntidades(): Entidad[] {
    return [...this.entidades()]
      .sort((a, b) => (b.solicitudesAsignadas || 0) - (a.solicitudesAsignadas || 0))
      .slice(0, 5);
  }

  solicitudesChartData(): ChartDatum[] {
    const total = this.totalSolicitudes();
    const source = [
      { label: 'Pendientes', value: this.pendientes(), color: 'var(--estado-ambar)' },
      { label: 'En proceso', value: this.enProceso(), color: 'var(--estado-azul)' },
      { label: 'Respondidas', value: this.respondidas(), color: 'var(--estado-verde)' },
      { label: 'Denegadas', value: this.denegadas(), color: 'var(--accent-violet)' },
      { label: 'Vencidas', value: this.vencidas(), color: 'var(--estado-rojo)' },
    ];

    return source.map((item) => ({
      ...item,
      percentage: this.toPercent(item.value, total),
    }));
  }

  apelacionesChartData(): ChartDatum[] {
    const total = this.totalApelaciones();
    const source = [
      { label: 'Pendientes', value: this.apelacionesPendientes(), color: 'var(--estado-ambar)' },
      { label: 'En analisis', value: this.apelacionesEnAnalisis(), color: 'var(--estado-azul)' },
      { label: 'Resueltas', value: this.apelacionesResueltas(), color: 'var(--estado-verde)' },
    ];

    return source.map((item) => ({
      ...item,
      percentage: this.toPercent(item.value, total),
    }));
  }

  apelacionesDonutChartData(): DonutChartDatum[] {
    const segments = this.apelacionesChartData().filter((item) => item.value > 0);
    let accumulated = 0;

    return segments.map((item) => {
      const arc = this.donutCircumference * (item.percentage / 100);
      const donutItem: DonutChartDatum = {
        ...item,
        dashArray: `${arc} ${this.donutCircumference - arc}`,
        dashOffset: `-${accumulated}`,
      };
      accumulated += arc;
      return donutItem;
    });
  }

  usuariosChartData(): ChartDatum[] {
    const total = this.totalUsuarios();
    const source = [
      { label: 'Ciudadanos', value: this.ciudadanos(), color: 'var(--estado-azul)' },
      { label: 'Funcionarios', value: this.funcionarios(), color: 'var(--accent-violet)' },
      { label: 'Miembros TTAIP', value: this.miembrosTTAIP(), color: 'var(--estado-ambar)' },
      { label: 'Administradores', value: this.administradores(), color: 'var(--estado-rojo)' },
    ];

    return source.map((item) => ({
      ...item,
      percentage: this.toPercent(item.value, total),
    }));
  }

  abrirModalEntidad(): void {
    this.nuevaEntidad = { nombre: '', acronimo: '', direccion: '', telefono: '', email: '', descripcion: '' };
    this.entidadEditando.set(false);
    this.entidadIdEditando = null;
    this.modalEntidadAbierto.set(true);
  }

  editarEntidad(entidad: Entidad): void {
    this.nuevaEntidad = { ...entidad };
    this.entidadEditando.set(true);
    this.entidadIdEditando = entidad.id;
    this.modalEntidadAbierto.set(true);
  }

  cerrarModalEntidad(): void {
    this.modalEntidadAbierto.set(false);
  }

  guardarEntidad(): void {
    if (!this.nuevaEntidad.nombre || !this.nuevaEntidad.acronimo) {
      this.error.set('Nombre y acrónimo son obligatorios');
      return;
    }

    if (this.entidadEditando() && this.entidadIdEditando) {
      this.entidadService.actualizar(this.entidadIdEditando, this.nuevaEntidad).subscribe({
        next: () => {
          this.mostrarMensaje('Entidad actualizada correctamente');
          this.cerrarModalEntidad();
          this.cargarDatos();
        },
        error: (err) => this.error.set(err.error?.mensaje || 'Error al actualizar entidad')
      });
    } else {
      this.entidadService.crear(this.nuevaEntidad).subscribe({
        next: () => {
          this.mostrarMensaje('Entidad creada correctamente');
          this.cerrarModalEntidad();
          this.cargarDatos();
        },
        error: (err) => this.error.set(err.error?.mensaje || 'Error al crear entidad')
      });
    }
  }

  cambiarEstadoEntidad(entidad: Entidad): void {
    const nuevoEstado = entidad.activa ? 'Inactiva' : 'Activa';
    this.entidadService.cambiarEstado(entidad.id, nuevoEstado).subscribe({
      next: () => {
        this.mostrarMensaje('Estado actualizado');
        this.cargarDatos();
      },
      error: () => this.error.set('Error al cambiar estado')
    });
  }

  abrirModalUsuario(): void {
    this.nuevoUsuario = { email: '', password: '', tipoUsuario: '' };
    this.modalUsuarioAbierto.set(true);
  }

  cerrarModalUsuario(): void {
    this.modalUsuarioAbierto.set(false);
  }

  crearUsuario(): void {
    if (!this.nuevoUsuario.email || !this.nuevoUsuario.password || !this.nuevoUsuario.tipoUsuario) {
      this.error.set('Todos los campos son obligatorios');
      return;
    }

    this.usuarioService.crear({
      email: this.nuevoUsuario.email,
      password: this.nuevoUsuario.password,
      tipoUsuario: this.nuevoUsuario.tipoUsuario as UsuarioAdmin['tipoUsuario']
    }).subscribe({
      next: () => {
        this.mostrarMensaje('Usuario creado correctamente');
        this.cerrarModalUsuario();
        this.cargarUsuarios();
      },
      error: (err) => this.error.set(err.error?.mensaje || 'Error al crear usuario')
    });
  }

  cambiarEstadoUsuario(usuario: UsuarioAdmin): void {
    this.usuarioService.cambiarEstado(usuario.id, !usuario.activo).subscribe({
      next: () => {
        this.mostrarMensaje('Estado de usuario actualizado');
        this.cargarUsuarios();
      },
      error: (err) => this.error.set(err.error?.mensaje || 'Error al cambiar estado del usuario')
    });
  }

  eliminarUsuario(usuario: UsuarioAdmin): void {
    if (confirm('¿Está seguro de eliminar este usuario?')) {
      this.usuarioService.eliminar(usuario.id).subscribe({
        next: () => {
          this.mostrarMensaje('Usuario eliminado');
          this.cargarUsuarios();
        },
        error: (err) => this.error.set(err.error?.mensaje || 'Error al eliminar usuario')
      });
    }
  }

  exportarReporte(tipo: string, formato: string): void {
    this.mostrarMensaje(`Generando reporte de ${tipo} en formato ${formato.toUpperCase()}...`);
  }

  userInitials(email: string): string {
    const localPart = email.split('@')[0] ?? '';
    const segments = localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase());

    if (segments.length > 0) {
      return segments.join('');
    }

    return email.slice(0, 2).toUpperCase();
  }

  actividadUsuario(usuario: UsuarioAdmin): string {
    const activityByType: Record<string, string> = {
      CIUDADANO: 'Solicitudes activas',
      FUNCIONARIO: 'Gestion institucional',
      TTAIP: 'Evaluacion de apelaciones',
      ADMINISTRADOR: 'Administracion del sistema',
    };

    return activityByType[usuario.tipoUsuario] ?? 'Actividad no registrada';
  }

  getTipoUsuarioClass(tipo: string): string {
    const clases: { [key: string]: string } = {
      'CIUDADANO': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--estado-azul-suave)] text-[var(--estado-azul)]',
      'FUNCIONARIO': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--accent-violet-soft)] text-[var(--accent-violet)]',
      'TTAIP': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'ADMINISTRADOR': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--estado-rojo-suave)] text-[var(--estado-rojo)]'
    };
    return clases[tipo] || 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--nieve)] text-[var(--carbon-suave)]';
  }

  getEstadoSolicitudClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'RECEPCIONADA': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'EN_REVISION': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--estado-azul-suave)] text-[var(--estado-azul)]',
      'PENDIENTE_INFORMACION': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'RESPONDIDA': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--estado-verde-suave)] text-[var(--estado-verde)]',
      'DENEGADA': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--estado-rojo-suave)] text-[var(--estado-rojo)]',
      'VENCIDA': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--nieve)] text-[var(--humo)]',
      'CONCLUIDA': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--nieve)] text-[var(--humo)]'
    };
    return clases[estado] || 'px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--nieve)] text-[var(--humo)]';
  }

  private mostrarMensaje(msg: string): void {
    this.mensaje.set(msg);
    setTimeout(() => this.mensaje.set(''), 3000);
  }

  private toPercent(value: number, total: number): number {
    if (value <= 0 || total <= 0) {
      return 0;
    }
    return Number(((value / total) * 100).toFixed(1));
  }

  activityToneClass(tone: ActivityTone): string {
    const colors: Record<ActivityTone, string> = {
      success: 'var(--success)',
      info: 'var(--info)',
      warning: 'var(--gold)',
      danger: 'var(--brand-700)',
      brand: 'var(--brand-500)'
    };

    return colors[tone];
  }

  private activityLabelForSolicitud(estado: string): string {
    const normalized = (estado || '').toUpperCase();
    if (normalized === 'RESPONDIDA') return 'Solicitud SAIP respondida';
    if (normalized === 'DENEGADA') return 'Solicitud SAIP denegada';
    if (normalized === 'VENCIDA') return 'Solicitud vencida detectada';
    return 'Nueva solicitud SAIP registrada';
  }

  private activityToneForSolicitud(estado: string): ActivityTone {
    const normalized = (estado || '').toUpperCase();
    if (normalized === 'RESPONDIDA') return 'success';
    if (normalized === 'DENEGADA' || normalized === 'VENCIDA') return 'danger';
    if (normalized === 'EN_REVISION' || normalized === 'PENDIENTE_INFORMACION') return 'info';
    return 'brand';
  }

  private activityLabelForApelacion(estado: string): string {
    const normalized = (estado || '').toUpperCase();
    if (normalized.includes('RESUELTO') || normalized.includes('CONCLUSION') || normalized === 'TENER_POR_NO_PRESENTADO') {
      return 'Resolución TTAIP emitida';
    }
    return 'Apelación presentada';
  }

  private activityToneForApelacion(estado: string): ActivityTone {
    const normalized = (estado || '').toUpperCase();
    if (normalized.includes('RESUELTO') || normalized.includes('CONCLUSION') || normalized === 'TENER_POR_NO_PRESENTADO') {
      return 'info';
    }
    if (normalized === 'EN_SUBSANACION') return 'warning';
    return 'brand';
  }

  private fechaRelativa(value?: string): string {
    const date = this.parseDate(value);
    const diffMs = Date.now() - date.getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) {
      return 'fecha reciente';
    }

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `hace ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;

    const days = Math.floor(hours / 24);
    return `hace ${days} d`;
  }

  private parseDate(value?: string): Date {
    if (!value) {
      return new Date(0);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }
}

