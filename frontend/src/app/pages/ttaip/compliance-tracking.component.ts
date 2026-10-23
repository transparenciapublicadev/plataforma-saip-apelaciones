import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map, of, Subscription, switchMap, throwError, timeout } from 'rxjs';
import {
  LucideAlertTriangle, LucideArrowLeft, LucideCheckCircle2, LucideClock, LucideEye,
  LucideInbox, LucideRefreshCw, LucideShieldCheck, LucideXCircle
} from '@lucide/angular';
import { TtaipService } from '../../services/ttaip.service';
import { AuthService } from '../../services/auth.service';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { Apelacion } from '../../models/apelacion.model';
import { CumplimientoResolucionTtaip } from '../../models/resolucion.model';
import { EstadoConsulta, falloConsulta } from '../../utils/consulta-remota.util';

export type EstadoCumplimiento = 'pendiente' | 'cumplido' | 'cumplido_parcial' |
  'vencido' | 'observado' | 'reiterado' | 'cerrado' | 'incompleto';

export interface CumplimientoItem {
  id: string;
  expedienteTTAIP: string;
  expedienteSAIP?: string | null;
  entidad: string;
  fechaResolucion?: string | null;
  fechaLimite?: string | null;
  fechaCumplimiento?: string | null;
  estado: EstadoCumplimiento;
  resultado?: string | null;
  observaciones?: string | null;
  apelacionId: number;
  registro: CumplimientoResolucionTtaip;
}

interface AccionTribunal {
  estado: EstadoCumplimiento;
  label: string;
  iconName: string;
  tone: string;
}

@Component({
  selector: 'app-compliance-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatusBadgeComponent, LucideArrowLeft,
    LucideClock, LucideCheckCircle2, LucideAlertTriangle, LucideInbox, LucideShieldCheck,
    LucideRefreshCw, LucideXCircle, LucideEye],
  templateUrl: './compliance-tracking.component.html',
  styleUrl: './compliance-tracking.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplianceTrackingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly ttaipService = inject(TtaipService);
  private readonly authService = inject(AuthService);
  private consulta?: Subscription;
  private operacion?: Subscription;
  private generacion = 0;
  private sesion = this.authService.getToken();
  private temporizador?: ReturnType<typeof setTimeout>;

  readonly acciones: AccionTribunal[] = [
    { estado: 'cumplido', label: 'Marcar como cumplido', iconName: 'check-circle-2', tone: 'var(--success)' },
    { estado: 'observado', label: 'Observar el cumplimiento', iconName: 'alert-triangle', tone: 'var(--warning)' },
    { estado: 'reiterado', label: 'Reiterar a la entidad', iconName: 'refresh-cw', tone: 'var(--info)' },
    { estado: 'cerrado', label: 'Cerrar el seguimiento', iconName: 'shield-check', tone: 'var(--brand-700)' }
  ];
  readonly estadoLabels: Record<EstadoCumplimiento, string> = {
    pendiente: 'Pendiente', cumplido: 'Cumplido', cumplido_parcial: 'Cumplido parcial',
    vencido: 'Vencido', observado: 'Observado', reiterado: 'Reiterado', cerrado: 'Cerrado',
    incompleto: 'Estado no informado'
  };
  readonly items = signal<CumplimientoItem[]>([]);
  readonly cargando = signal(true);
  readonly estadoConsulta = signal<EstadoConsulta>('cargando');
  readonly mensajeConsulta = signal('');
  readonly reintentable = signal(false);
  readonly informacionIncompleta = signal(false);
  readonly enviando = signal(false);
  readonly requiereVerificacion = signal(false);
  readonly mensajeAccion = signal('');
  readonly selId = signal<string | null>(null);
  readonly observacionesInput = signal('');
  readonly toastMensaje = signal<string | null>(null);
  readonly sel = computed(() => this.items().find(i => i.id === this.selId()) ?? null);
  readonly resumen = computed(() => ({
    pendientes: this.items().filter(i => i.estado === 'pendiente' || i.estado === 'observado').length,
    vencidos: this.items().filter(i => i.estado === 'vencido').length,
    cumplidos: this.items().filter(i => i.estado === 'cumplido' || i.estado === 'cerrado').length
  }));

  constructor() {
    effect(() => {
      this.authService.cambiosSesion();
      untracked(() => {
        const actual = this.authService.getToken();
        if (actual !== this.sesion) {
          this.sesion = actual;
          this.cargarSeguimientos();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => {
      ++this.generacion;
      this.consulta?.unsubscribe();
      this.operacion?.unsubscribe();
      clearTimeout(this.temporizador);
    });
  }

  ngOnInit(): void { this.cargarSeguimientos(); }

  cargarSeguimientos(): void {
    const generacion = ++this.generacion;
    const token = this.authService.getToken();
    this.consulta?.unsubscribe();
    this.operacion?.unsubscribe();
    clearTimeout(this.temporizador);
    this.items.set([]);
    this.selId.set(null);
    this.observacionesInput.set('');
    this.toastMensaje.set(null);
    this.mensajeAccion.set('');
    this.enviando.set(false);
    this.cargando.set(true);
    this.estadoConsulta.set('cargando');
    this.mensajeConsulta.set('');
    this.informacionIncompleta.set(false);
    if (!token || !this.esTribunal()) {
      this.fallarConsulta({ estado: token ? 'autorizacion' : 'autenticacion', reintentable: false,
        mensaje: token ? 'No tiene permiso para consultar el seguimiento TTAIP.' : 'Inicie sesión para consultar el seguimiento.' });
      return;
    }
    // The resolved-appeals query supplies actual aggregate IDs, never follow-up states.
    this.consulta = this.ttaipService.getResueltas().pipe(switchMap(apelaciones => {
      if (!Array.isArray(apelaciones)) return throwError(() => new Error('Respuesta incompleta'));
      const expedientes = new Map<number, Apelacion>();
      for (const apelacion of apelaciones) {
        const id = apelacion.expedienteTtaip?.id;
        if (id && apelacion.id) expedientes.set(id, apelacion);
        else this.informacionIncompleta.set(true);
      }
      const consultas = [...expedientes].map(([expedienteId, apelacion]) =>
        this.ttaipService.listarCumplimientos(expedienteId).pipe(map(registros => {
          if (!Array.isArray(registros)) throw new Error('Respuesta incompleta');
          return registros.map(registro => this.mapear(registro, apelacion, expedienteId));
        })));
      return consultas.length ? forkJoin(consultas).pipe(map(listas => listas.flat())) : of([]);
    }), timeout(15_000)).subscribe({
      next: items => {
        if (!this.vigente(generacion, token)) return;
        this.items.set(items);
        this.selId.set(items[0]?.id ?? null);
        this.cargando.set(false);
        this.estadoConsulta.set(items.length ? 'disponible' : 'vacio');
        this.requiereVerificacion.set(false);
      },
      error: error => {
        if (this.vigente(generacion, token)) this.fallarConsulta(falloConsulta(error, 'los seguimientos de cumplimiento'));
      }
    });
  }

  private mapear(registro: CumplimientoResolucionTtaip, apelacion: Apelacion, expedienteId: number): CumplimientoItem {
    if (!registro.id || registro.expedienteTtaipId !== expedienteId || registro.apelacionId !== apelacion.id)
      throw new Error('Identificación del recurso incompleta o inconsistente');
    const estados: Record<string, EstadoCumplimiento> = { PENDIENTE: 'pendiente', CUMPLIDO: 'cumplido',
      CUMPLIDO_PARCIAL: 'cumplido_parcial', VENCIDO: 'vencido', OBSERVADO: 'observado', CERRADO: 'cerrado' };
    const estado = estados[registro.estadoCumplimiento ?? ''] ?? 'incompleto';
    if (estado === 'incompleto' || !registro.entidadNombre || !registro.numeroExpediente || !registro.resolucionId)
      this.informacionIncompleta.set(true);
    const resolucion = apelacion.expedienteTtaip?.resoluciones?.find(r => r.id === registro.resolucionId);
    return { id: String(registro.id), expedienteTTAIP: registro.numeroExpediente ?? 'Número no informado',
      expedienteSAIP: apelacion.solicitudExpediente, entidad: registro.entidadNombre ?? 'Entidad no informada',
      fechaResolucion: resolucion?.fechaResolucion, fechaLimite: registro.fechaLimiteCumplimiento,
      fechaCumplimiento: registro.fechaCumplimiento, estado, resultado: registro.decisionResolucion,
      observaciones: registro.observacion, apelacionId: apelacion.id, registro };
  }

  private vigente(generacion: number, token: string | null): boolean {
    return generacion === this.generacion && token === this.authService.getToken();
  }
  private esTribunal(): boolean {
    return ['TTAIP', 'ADMINISTRADOR'].includes(this.authService.getTipoUsuario() ?? '');
  }
  private fallarConsulta(fallo: ReturnType<typeof falloConsulta>): void {
    this.items.set([]);
    this.selId.set(null);
    this.cargando.set(false);
    this.estadoConsulta.set(fallo.estado);
    this.mensajeConsulta.set(fallo.mensaje);
    this.reintentable.set(fallo.reintentable);
  }

  seleccionarItem(id: string): void {
    if (this.selId() === id) return;
    ++this.generacion;
    this.operacion?.unsubscribe();
    if (this.enviando()) this.requiereVerificacion.set(true);
    this.enviando.set(false);
    this.selId.set(id);
    this.observacionesInput.set('');
    this.mensajeAccion.set('');
    this.toastMensaje.set(null);
  }

  motivoNoDisponible(estado: EstadoCumplimiento): string | null {
    if (estado === 'cumplido') return 'El cumplimiento lo comunica la entidad con evidencia; el Tribunal no puede imponerlo.';
    if (estado === 'reiterado') return 'No hay un comando de reiteración disponible. La emisión documental está pendiente.';
    const actual = this.sel();
    if (!actual || !this.esTribunal() || !this.authService.getToken()) return 'La operación requiere una sesión TTAIP o administrador.';
    if (this.requiereVerificacion()) return 'Recargue los seguimientos para comprobar el resultado anterior antes de operar.';
    if (this.enviando()) return 'Hay una operación en curso.';
    if (actual.estado === 'cerrado') return 'El seguimiento ya está cerrado.';
    if (actual.estado === 'incompleto' || !actual.registro.resolucionId) return 'Faltan datos del seguimiento para realizar esta operación.';
    if (estado !== 'observado' && estado !== 'cerrado') return 'No hay un comando disponible para este estado.';
    return null;
  }

  actualizarEstado(estado: EstadoCumplimiento): void {
    if (this.motivoNoDisponible(estado)) return;
    const actual = this.sel()!;
    const observacion = this.observacionesInput().trim();
    if ((estado === 'observado' && !observacion) || observacion.length > 2000) {
      this.mensajeAccion.set('Para observar, escriba un motivo. El texto no puede exceder 2000 caracteres.');
      return;
    }
    const { id, expedienteTtaipId } = actual.registro;
    const generacion = this.generacion;
    const token = this.authService.getToken();
    this.enviando.set(true);
    this.toastMensaje.set(null);
    this.mensajeAccion.set('');
    let comandoConfirmado = false;
    const comando = estado === 'observado'
      ? this.ttaipService.observarCumplimiento(expedienteTtaipId!, id!, { observacion })
      : this.ttaipService.cerrarCumplimiento(expedienteTtaipId!, id!, { observacion: observacion || null });
    this.operacion = comando.pipe(switchMap(respuesta => {
      comandoConfirmado = true;
      if (respuesta.id !== id || respuesta.expedienteTtaipId !== expedienteTtaipId ||
          respuesta.estadoCumplimiento !== estado.toUpperCase()) throw new Error('Respuesta sin confirmar');
      return this.ttaipService.listarCumplimientos(expedienteTtaipId!).pipe(map(registros => {
        const recuperado = registros.find(r => r.id === id);
        if (!recuperado || recuperado.expedienteTtaipId !== expedienteTtaipId ||
            recuperado.apelacionId !== actual.apelacionId || recuperado.estadoCumplimiento !== respuesta.estadoCumplimiento ||
            recuperado.observacion !== respuesta.observacion) throw new Error('Resultado sin comprobar');
        return recuperado;
      }));
    }), timeout(15_000)).subscribe({
      next: recuperado => {
        if (!this.vigente(generacion, token) || this.selId() !== actual.id) return;
        this.items.update(items => items.map(item => item.id === actual.id ? { ...item, registro: recuperado,
          estado, fechaLimite: recuperado.fechaLimiteCumplimiento, fechaCumplimiento: recuperado.fechaCumplimiento,
          observaciones: recuperado.observacion } : item));
        this.enviando.set(false);
        this.observacionesInput.set('');
        this.mostrarToast('Actuación registrada y recuperada del servidor.');
      },
      error: error => {
        if (!this.vigente(generacion, token) || this.selId() !== actual.id) return;
        this.enviando.set(false);
        const fallo = falloConsulta(error, 'la actuación de cumplimiento');
        const incierto = comandoConfirmado || !['validacion', 'autenticacion', 'autorizacion', 'inexistente'].includes(fallo.estado);
        this.requiereVerificacion.set(incierto);
        this.mensajeAccion.set(incierto
          ? 'No se pudo comprobar el resultado. Recargue los seguimientos antes de repetir la operación.'
          : fallo.mensaje.replace('consultar', 'registrar'));
      }
    });
  }

  private mostrarToast(mensaje: string): void {
    this.toastMensaje.set(mensaje);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.toastMensaje.set(null), 3500);
  }

  // Token styling para StatusBadge (idéntico a StatusBadge.tsx de design-reference)
  getBadgeTone(estado: EstadoCumplimiento): { bg: string; fg: string; border: string; dot: string } {
    switch (estado) {
      case 'cumplido':
        return { bg: '#E7F6EC', fg: '#15803D', border: '#BFE3CB', dot: '#15803D' };
      case 'pendiente':
        return { bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A', dot: '#B45309' };
      case 'vencido':
        return { bg: '#1A1410', fg: '#FBF9F6', border: '#1A1410', dot: '#DD5862' };
      case 'observado':
        return { bg: '#FAF3E2', fg: '#7A5A1F', border: '#EAD8A8', dot: '#B08842' };
      case 'reiterado':
        return { bg: '#E6EFFE', fg: '#1D4ED8', border: '#BFD3F8', dot: '#1D4ED8' };
      case 'cerrado':
        return { bg: 'var(--brand-50)', fg: 'var(--brand-700)', border: 'var(--brand-200)', dot: 'var(--brand-600)' };
      default:
        return { bg: '#F1F5F9', fg: '#475569', border: '#E2E8F0', dot: '#64748B' };
    }
  }

  verResolucion(expedienteTtaip: string): void {
    this.router.navigate(['/ttaip/resolucion', expedienteTtaip]);
  }
}
