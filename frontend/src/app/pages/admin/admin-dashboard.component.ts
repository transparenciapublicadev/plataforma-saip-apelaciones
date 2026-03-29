import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { EntidadService } from '../../services/entidad.service';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { Entidad } from '../../models/entidad.model';
import { Solicitud } from '../../models/solicitud.model';

interface Usuario {
  id: number;
  email: string;
  tipoUsuario: string;
  fechaRegistro: string;
  activo: boolean;
}

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

@Component({
  selector: 'app-admin-dashboard',
  imports: [FormsModule, DatePipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit {
  private readonly entidadService = inject(EntidadService);
  private readonly solicitudService = inject(SolicitudService);
  private readonly apelacionService = inject(ApelacionService);

  loading = signal<boolean>(true);
  loadingUsuarios = signal<boolean>(false);
  loadingSolicitudes = signal<boolean>(false);

  error = signal<string>('');
  mensaje = signal<string>('');

  entidades = signal<Entidad[]>([]);
  usuarios = signal<Usuario[]>([]);
  solicitudes = signal<Solicitud[]>([]);

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

  tabActual = signal<string>('resumen');
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

  private entidadIdEditando: number | null = null;

  ngOnInit(): void {
    this.cargarDatos();
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
  }

  cargarUsuarios(): void {
    this.loadingUsuarios.set(true);
    const usuariosSimulados: Usuario[] = [
      { id: 1, email: 'juan.perez@gmail.com', tipoUsuario: 'CIUDADANO', fechaRegistro: '2024-02-01', activo: true },
      { id: 2, email: 'maria.lopez@gmail.com', tipoUsuario: 'CIUDADANO', fechaRegistro: '2024-02-02', activo: true },
      { id: 3, email: 'carlos.ramirez@hotmail.com', tipoUsuario: 'CIUDADANO', fechaRegistro: '2024-02-03', activo: true },
      { id: 4, email: 'andrea.silva@outlook.com', tipoUsuario: 'CIUDADANO', fechaRegistro: '2024-02-04', activo: true },
      { id: 5, email: 'roberto.flores@yahoo.com', tipoUsuario: 'CIUDADANO', fechaRegistro: '2024-02-05', activo: true },
      { id: 6, email: 'ciudadano@test.com', tipoUsuario: 'CIUDADANO', fechaRegistro: '2024-03-01', activo: true },
      { id: 7, email: 'ana.garcia@entidad1.test', tipoUsuario: 'FUNCIONARIO', fechaRegistro: '2024-02-06', activo: true },
      { id: 8, email: 'pedro.sanchez@entidad2.test', tipoUsuario: 'FUNCIONARIO', fechaRegistro: '2024-02-07', activo: true },
      { id: 9, email: 'luis.torres@entidad3.test', tipoUsuario: 'FUNCIONARIO', fechaRegistro: '2024-02-08', activo: true },
      { id: 10, email: 'carmen.vega@entidad4.test', tipoUsuario: 'FUNCIONARIO', fechaRegistro: '2024-02-09', activo: true },
      { id: 11, email: 'fernando.rios@entidad5.test', tipoUsuario: 'FUNCIONARIO', fechaRegistro: '2024-02-10', activo: true },
      { id: 12, email: 'funcionario@test.com', tipoUsuario: 'FUNCIONARIO', fechaRegistro: '2024-03-02', activo: true },
      { id: 13, email: 'rosa.mendez@ttaip.test', tipoUsuario: 'TTAIP', fechaRegistro: '2024-02-11', activo: true },
      { id: 14, email: 'jorge.castro@ttaip.test', tipoUsuario: 'TTAIP', fechaRegistro: '2024-02-12', activo: true },
      { id: 15, email: 'silvia.diaz@ttaip.test', tipoUsuario: 'TTAIP', fechaRegistro: '2024-02-13', activo: true },
      { id: 16, email: 'miguel.ruiz@ttaip.test', tipoUsuario: 'TTAIP', fechaRegistro: '2024-02-14', activo: true },
      { id: 17, email: 'patricia.morales@ttaip.test', tipoUsuario: 'TTAIP', fechaRegistro: '2024-02-15', activo: true },
      { id: 18, email: 'admin@sistema.test', tipoUsuario: 'ADMINISTRADOR', fechaRegistro: '2024-01-10', activo: true },
      { id: 19, email: 'superadmin@sistema.test', tipoUsuario: 'ADMINISTRADOR', fechaRegistro: '2024-01-11', activo: true },
      { id: 20, email: 'sysadmin@sistema.test', tipoUsuario: 'ADMINISTRADOR', fechaRegistro: '2024-01-12', activo: true },
    ];

    this.usuarios.set(usuariosSimulados);
    this.totalUsuarios.set(usuariosSimulados.length);
    this.ciudadanos.set(usuariosSimulados.filter(u => u.tipoUsuario === 'CIUDADANO').length);
    this.funcionarios.set(usuariosSimulados.filter(u => u.tipoUsuario === 'FUNCIONARIO').length);
    this.miembrosTTAIP.set(usuariosSimulados.filter(u => u.tipoUsuario === 'TTAIP').length);
    this.administradores.set(usuariosSimulados.filter(u => u.tipoUsuario === 'ADMINISTRADOR').length);
    this.loadingUsuarios.set(false);
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

  cambiarTab(tab: string): void {
    this.tabActual.set(tab);
    if (tab === 'usuarios' && this.usuarios().length === 0) {
      this.cargarUsuarios();
    }
    if (tab === 'solicitudes' && this.solicitudes().length === 0) {
      this.cargarSolicitudes();
    }
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

  usuariosFiltrados(): Usuario[] {
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
      { label: 'Pendientes', value: this.pendientes(), color: '#D97706' },
      { label: 'En proceso', value: this.enProceso(), color: '#2563EB' },
      { label: 'Respondidas', value: this.respondidas(), color: '#059669' },
      { label: 'Denegadas', value: this.denegadas(), color: '#7C3AED' },
      { label: 'Vencidas', value: this.vencidas(), color: '#DC2626' },
    ];

    return source.map((item) => ({
      ...item,
      percentage: this.toPercent(item.value, total),
    }));
  }

  apelacionesChartData(): ChartDatum[] {
    const total = this.totalApelaciones();
    const source = [
      { label: 'Pendientes', value: this.apelacionesPendientes(), color: '#D97706' },
      { label: 'En analisis', value: this.apelacionesEnAnalisis(), color: '#2563EB' },
      { label: 'Resueltas', value: this.apelacionesResueltas(), color: '#059669' },
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
      { label: 'Ciudadanos', value: this.ciudadanos(), color: '#2563EB' },
      { label: 'Funcionarios', value: this.funcionarios(), color: '#7C3AED' },
      { label: 'Miembros TTAIP', value: this.miembrosTTAIP(), color: '#D97706' },
      { label: 'Administradores', value: this.administradores(), color: '#DC2626' },
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

    this.mostrarMensaje('Usuario creado correctamente');
    this.cerrarModalUsuario();
    this.cargarUsuarios();
  }

  cambiarEstadoUsuario(usuario: Usuario): void {
    usuario.activo = !usuario.activo;
    this.mostrarMensaje('Estado de usuario actualizado');
  }

  eliminarUsuario(usuario: Usuario): void {
    if (confirm('¿Está seguro de eliminar este usuario?')) {
      const index = this.usuarios().findIndex(u => u.id === usuario.id);
      if (index > -1) {
        const actualizados = [...this.usuarios()];
        actualizados.splice(index, 1);
        this.usuarios.set(actualizados);
        this.mostrarMensaje('Usuario eliminado');
      }
    }
  }

  exportarReporte(tipo: string, formato: string): void {
    this.mostrarMensaje(`Generando reporte de ${tipo} en formato ${formato.toUpperCase()}...`);
  }

  getTipoUsuarioClass(tipo: string): string {
    const clases: { [key: string]: string } = {
      'CIUDADANO': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[#EFF6FF] text-[#2563EB]',
      'FUNCIONARIO': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[#F5F3FF] text-[#7C3AED]',
      'TTAIP': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[#FFFBEB] text-[#D97706]',
      'ADMINISTRADOR': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[#FEF2F2] text-[#DC2626]'
    };
    return clases[tipo] || 'px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800';
  }

  getEstadoSolicitudClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'RECEPCIONADA': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[#FFFBEB] text-[#92400E]',
      'EN_REVISION': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[#EFF6FF] text-[#1E40AF]',
      'PENDIENTE_INFORMACION': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[#FFF7ED] text-[#9A3412]',
      'RESPONDIDA': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[#DCFCE7] text-[#065F46]',
      'DENEGADA': 'px-2.5 py-1 text-xs font-medium rounded-full bg-[#FEE2E2] text-[#991B1B]',
      'VENCIDA': 'px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700',
      'CONCLUIDA': 'px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700'
    };
    return clases[estado] || 'px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700';
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
}

