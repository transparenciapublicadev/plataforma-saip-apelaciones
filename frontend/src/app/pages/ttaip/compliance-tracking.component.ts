import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, forkJoin, map, of, Subscription, switchMap, throwError, timeout } from 'rxjs';
import {
  LucideAlertTriangle, LucideArrowLeft, LucideCheckCircle2, LucideClock, LucideEye,
  LucideInbox, LucideRefreshCw, LucideShieldCheck, LucideXCircle
} from '@lucide/angular';
import { TtaipService } from '../../services/ttaip.service';
import { AuthService } from '../../services/auth.service';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { YaikuCargandoComponent } from '../../shared/yaiku-cargando.component';
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
  incompleto?: boolean;
}

interface GrupoConsultado { items: CumplimientoItem[]; fallo?: ReturnType<typeof falloConsulta>; }
interface ActuacionPendiente {
  actual: CumplimientoItem;
  estado: 'observado' | 'cerrado';
  observacion: string | null;
  respuesta?: CumplimientoResolucionTtaip;
}
const idValido = (id: unknown): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;

interface AccionTribunal {
  estado: EstadoCumplimiento;
  label: string;
  iconName: string;
  tone: string;
}

@Component({
  selector: 'app-compliance-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatusBadgeComponent, YaikuCargandoComponent, LucideArrowLeft,
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
  private sesion = this.sessionKey();
  private destroyed = false;
  private initialized = false;
  private pendiente: ActuacionPendiente | null = null;
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
  readonly expedientesConsultados = signal(0);
  readonly expedientesRecuperados = signal(0);
  readonly fallosParciales = signal<string[]>([]);
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
        const actual = this.sessionKey();
        if (this.initialized && actual !== this.sesion) {
          this.cargarSeguimientos();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      ++this.generacion;
      this.consulta?.unsubscribe();
      this.operacion?.unsubscribe();
      clearTimeout(this.temporizador);
      this.pendiente = null;
      this.observacionesInput.set('');
    });
  }

  ngOnInit(): void { this.initialized = true; this.cargarSeguimientos(); }

  private sessionKey(): string {
    try {
      const s = this.authService.obtenerSesion();
      return JSON.stringify([this.authService.getToken(), this.authService.getTipoUsuario(), s?.usuarioId, s?.entidadId]);
    } catch { return ''; }
  }
  private token(): string | null { try { return this.authService.getToken(); } catch { return null; } }

  cargarSeguimientos(): void {
    if (this.destroyed) return;
    if (this.sessionKey() === this.sesion && this.pendiente) {
      if (!this.enviando()) this.recuperarActuacion();
      return;
    }
    const generacion = ++this.generacion;
    const session = this.sessionKey(); this.sesion = session; this.pendiente = null;
    this.consulta?.unsubscribe();
    this.operacion?.unsubscribe();
    clearTimeout(this.temporizador);
    this.items.set([]);
    this.selId.set(null);
    this.observacionesInput.set('');
    this.toastMensaje.set(null);
    this.mensajeAccion.set('');
    this.enviando.set(false);
    this.requiereVerificacion.set(false);
    this.cargando.set(true);
    this.estadoConsulta.set('cargando');
    this.mensajeConsulta.set('');
    this.informacionIncompleta.set(false);
    this.fallosParciales.set([]); this.expedientesConsultados.set(0); this.expedientesRecuperados.set(0);
    this.reintentable.set(false);
    if (!this.token() || !this.esTribunal()) {
      this.fallarConsulta({ estado: this.token() ? 'autorizacion' : 'autenticacion', reintentable: false,
        mensaje: this.token() ? 'No tiene permiso para consultar el seguimiento TTAIP.' : 'Inicie sesión para consultar el seguimiento.' });
      return;
    }
    const parciales: GrupoConsultado[] = [];
    // The resolved-appeals query supplies actual aggregate IDs, never follow-up states.
    this.consulta = this.ttaipService.getResueltas().pipe(switchMap(apelaciones => {
      if (!this.vigente(generacion, session)) return EMPTY;
      if (!Array.isArray(apelaciones)) return throwError(() => new Error('Respuesta incompleta'));
      const expedientes = new Map<number, Apelacion>();
      const ambiguos = new Set<number>();
      for (const apelacion of apelaciones) {
        const id = apelacion?.expedienteTtaip?.id;
        if (idValido(id) && idValido(apelacion?.id) && apelacion.expediente &&
            (!apelacion.expedienteTtaip?.numeroExpediente || apelacion.expedienteTtaip.numeroExpediente === apelacion.expediente)) {
          if (expedientes.has(id)) { ambiguos.add(id); this.informacionIncompleta.set(true); }
          else expedientes.set(id, apelacion);
        }
        else this.informacionIncompleta.set(true);
      }
      ambiguos.forEach(id => expedientes.delete(id));
      this.expedientesConsultados.set(expedientes.size);
      const consultas = [...expedientes].map(([expedienteId, apelacion]) =>
        this.ttaipService.listarCumplimientos(expedienteId).pipe(map(registros => {
          if (!this.vigente(generacion, session)) return { items: [] };
          return { items: this.mapearLista(registros, apelacion, expedienteId) };
        }), catchError(error => of({ items: [], fallo: falloConsulta(error, `los seguimientos del expediente ${apelacion.expediente}`) })),
        map(grupo => { parciales.push(grupo); return grupo; })));
      return consultas.length ? forkJoin(consultas) : of([]);
    }), timeout(15_000)).subscribe({
      next: grupos => { if (this.vigente(generacion, session)) this.aplicarConsulta(grupos); },
      error: error => {
        if (!this.vigente(generacion, session)) return;
        // Preserve completed reads if the existing overall deadline expires.
        const fallo = falloConsulta(error, 'los seguimientos de cumplimiento');
        if (parciales.length) this.aplicarConsulta([...parciales, { items: [], fallo }]);
        else this.fallarConsulta(fallo);
      }
    });
  }

  private aplicarConsulta(grupos: GrupoConsultado[]): void {
    const correctos = grupos.filter(g => !g.fallo), fallos = grupos.flatMap(g => g.fallo ? [g.fallo] : []);
    this.expedientesRecuperados.set(correctos.length);
    this.fallosParciales.set(fallos.map(f => f.mensaje));
    const items = correctos.flatMap(g => g.items), ids = new Set<string>();
    const repetidos = new Set(items.filter(i => ids.has(i.id) || !ids.add(i.id)).map(i => i.id));
    const verificados = items.filter(i => !repetidos.has(i.id));
    if (fallos.length || repetidos.size || items.some(i => i.incompleto)) this.informacionIncompleta.set(true);
    if (!correctos.length && fallos.length) { this.fallarConsulta(fallos[0]); return; }
    this.items.set(verificados); this.selId.set(verificados[0]?.id ?? null); this.cargando.set(false);
    this.estadoConsulta.set(verificados.length || this.informacionIncompleta() ? 'disponible' : 'vacio');
  }

  private mapearLista(registros: CumplimientoResolucionTtaip[], apelacion: Apelacion, expedienteId: number): CumplimientoItem[] {
    if (!Array.isArray(registros)) throw new Error('Respuesta incompleta');
    const ids = new Set<number>();
    return registros.map(registro => {
      if (!idValido(registro?.id) || ids.has(registro.id)) throw new Error('Identificación duplicada');
      ids.add(registro.id); return this.mapear(registro, apelacion, expedienteId);
    });
  }

  private mapear(registro: CumplimientoResolucionTtaip, apelacion: Apelacion, expedienteId: number): CumplimientoItem {
    if (!idValido(registro?.id) || registro.expedienteTtaipId !== expedienteId || registro.apelacionId !== apelacion.id ||
        (registro.numeroExpediente != null && registro.numeroExpediente !== apelacion.expediente) ||
        (registro.entidadId != null && apelacion.entidadId != null && registro.entidadId !== apelacion.entidadId))
      throw new Error('Identificación del recurso incompleta o inconsistente');
    const estados: Record<string, EstadoCumplimiento> = { PENDIENTE: 'pendiente', CUMPLIDO: 'cumplido',
      CUMPLIDO_PARCIAL: 'cumplido_parcial', VENCIDO: 'vencido', OBSERVADO: 'observado', CERRADO: 'cerrado' };
    const estado = estados[registro.estadoCumplimiento ?? ''] ?? 'incompleto';
    const incompleto = estado === 'incompleto' || !registro.entidadNombre || !registro.numeroExpediente ||
      !idValido(registro.resolucionId) || !idValido(registro.entidadId) || !idValido(apelacion.entidadId);
    const resolucion = apelacion.expedienteTtaip?.resoluciones?.find(r => r.id === registro.resolucionId);
    return { id: String(registro.id), expedienteTTAIP: registro.numeroExpediente ?? 'Número no informado',
      expedienteSAIP: apelacion.solicitudExpediente, entidad: registro.entidadNombre ?? 'Entidad no informada',
      fechaResolucion: resolucion?.fechaResolucion, fechaLimite: registro.fechaLimiteCumplimiento,
      fechaCumplimiento: registro.fechaCumplimiento, estado, resultado: registro.decisionResolucion,
      observaciones: registro.observacion, apelacionId: apelacion.id, registro, incompleto };
  }

  private vigente(generacion: number, session: string): boolean {
    return !this.destroyed && generacion === this.generacion && session === this.sessionKey();
  }
  private esTribunal(): boolean {
    try { return ['TTAIP', 'ADMINISTRADOR'].includes(this.authService.getTipoUsuario() ?? ''); } catch { return false; }
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
    if (this.destroyed || this.selId() === id || !this.items().some(i => i.id === id)) return;
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
    if (this.destroyed || this.sesion !== this.sessionKey() || !actual || !this.esTribunal() || !this.token()) return 'La operación requiere una sesión TTAIP o administrador.';
    if (this.requiereVerificacion()) return 'Recargue los seguimientos para comprobar el resultado anterior antes de operar.';
    if (this.enviando()) return 'Hay una operación en curso.';
    if (actual.estado === 'cerrado') return 'El seguimiento ya está cerrado.';
    if (actual.registro.documental) return 'Consulte la remisión y sus documentos en el detalle del expediente.';
    if (actual.incompleto) return 'Faltan datos del seguimiento para realizar esta operación.';
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
    const session = this.sessionKey();
    const pendiente: ActuacionPendiente = { actual, estado: estado as 'observado' | 'cerrado', observacion: observacion || null };
    this.pendiente = pendiente;
    this.enviando.set(true);
    this.toastMensaje.set(null);
    this.mensajeAccion.set('');
    let comandoConfirmado = false;
    const comando = estado === 'observado'
      ? this.ttaipService.observarCumplimiento(expedienteTtaipId!, id!, { observacion })
      : this.ttaipService.cerrarCumplimiento(expedienteTtaipId!, id!, { observacion: observacion || null });
    this.operacion = comando.pipe(switchMap(respuesta => {
      if (!this.vigente(generacion, session) || this.selId() !== actual.id || this.pendiente !== pendiente) return EMPTY;
      comandoConfirmado = true;
      if (!this.mismoRecurso(respuesta, actual) || !this.efectoEsperado(respuesta, pendiente)) throw new Error('Respuesta sin confirmar');
      pendiente.respuesta = respuesta;
      return this.consultarPendiente(pendiente);
    }), timeout(15_000)).subscribe({
      next: recuperado => {
        if (!this.vigente(generacion, session) || this.selId() !== actual.id || this.pendiente !== pendiente) return;
        this.aplicarActuacion(recuperado, pendiente);
      },
      error: error => {
        if (!this.vigente(generacion, session) || this.selId() !== actual.id || this.pendiente !== pendiente) return;
        this.enviando.set(false);
        const fallo = falloConsulta(error, 'la actuación de cumplimiento');
        const incierto = comandoConfirmado || !['validacion', 'autenticacion', 'autorizacion', 'inexistente'].includes(fallo.estado);
        this.requiereVerificacion.set(incierto);
        if (!incierto) this.pendiente = null;
        this.mensajeAccion.set(incierto
          ? 'No se pudo comprobar el resultado. Recargue los seguimientos antes de repetir la operación.'
          : fallo.mensaje.replace('consultar', 'registrar'));
      }
    });
  }

  private mismoRecurso(r: CumplimientoResolucionTtaip, actual: CumplimientoItem): boolean {
    const previo = actual.registro;
    return !!r && r.id === previo.id && r.expedienteTtaipId === previo.expedienteTtaipId &&
      r.apelacionId === actual.apelacionId && r.resolucionId === previo.resolucionId &&
      r.entidadId === previo.entidadId && r.numeroExpediente === actual.expedienteTTAIP;
  }
  private efectoEsperado(r: CumplimientoResolucionTtaip, p: ActuacionPendiente): boolean {
    return r.estadoCumplimiento === p.estado.toUpperCase() && (r.observacion ?? null) === p.observacion;
  }
  private consultarPendiente(p: ActuacionPendiente) {
    return this.ttaipService.listarCumplimientos(p.actual.registro.expedienteTtaipId!).pipe(map(registros => {
      if (!Array.isArray(registros)) throw new Error('Consulta incompleta');
      const candidatos = registros.filter(r => r?.id === p.actual.registro.id);
      const r = candidatos[0];
      if (candidatos.length !== 1 || !this.mismoRecurso(r, p.actual) || !this.efectoEsperado(r, p) ||
          (p.respuesta && Object.entries(p.respuesta).some(([k, value]) =>
            (value == null || typeof value !== 'object') && (r[k as keyof CumplimientoResolucionTtaip] ?? null) !== (value ?? null)))) throw new Error('Resultado sin comprobar');
      return r;
    }));
  }
  recuperarActuacion(): void {
    const p = this.pendiente;
    if (!p || this.enviando() || this.destroyed || this.sessionKey() !== this.sesion) return;
    const generacion = this.generacion, session = this.sessionKey(); this.enviando.set(true); this.toastMensaje.set(null);
    this.operacion?.unsubscribe();
    this.operacion = this.consultarPendiente(p).pipe(timeout(15_000)).subscribe({ next: r => {
      if (this.vigente(generacion, session) && this.pendiente === p) this.aplicarActuacion(r, p);
    }, error: () => {
      if (!this.vigente(generacion, session) || this.pendiente !== p) return;
      this.enviando.set(false); this.requiereVerificacion.set(true);
      this.mensajeAccion.set('La consulta no acredita el resultado solicitado. Se conserva la observación en memoria y no se repite la escritura.');
    } });
  }
  private aplicarActuacion(r: CumplimientoResolucionTtaip, p: ActuacionPendiente): void {
    this.items.update(items => items.map(item => item.id === p.actual.id ? { ...item, registro: r,
      estado: p.estado, entidad: r.entidadNombre || 'Entidad no informada', resultado: r.decisionResolucion,
      fechaLimite: r.fechaLimiteCumplimiento, fechaCumplimiento: r.fechaCumplimiento, observaciones: r.observacion } : item));
    this.enviando.set(false); this.requiereVerificacion.set(false); this.pendiente = null;
    if (this.selId() !== p.actual.id) return;
    this.observacionesInput.set('');
    if (p.respuesta) { this.mensajeAccion.set(''); this.mostrarToast('Actuación registrada y recuperada del servidor.'); }
    else this.mensajeAccion.set('Estado y observación recuperados del servidor. Sin respuesta del comando, no se atribuye el registro a ese envío.');
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
    if (!this.destroyed && this.sesion === this.sessionKey() && this.sel()?.expedienteTTAIP === expedienteTtaip && this.sel()?.registro.numeroExpediente)
      this.router.navigate(['/ttaip/resolucion', expedienteTtaip]);
  }
}
