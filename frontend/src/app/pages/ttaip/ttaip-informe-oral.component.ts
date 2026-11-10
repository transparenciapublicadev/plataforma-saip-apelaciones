import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AudienciaInformeOral,
  DesistirPrescindirPayload,
  ESTADOS_INFORME_ORAL_CONFIG,
  EstadoInformeOral,
  PlataformaVirtual,
  ProgramarAudienciaPayload,
  RegistrarActaAudienciaPayload,
  ReprogramarAudienciaPayload,
  SolicitanteInformeOral,
  desistirInformeOral,
  esEstadoTerminalInformeOral,
  extraerAudienciaDeSuspensiones,
  prescindirInformeOral,
  programarAudiencia,
  puedeTransicionarInformeOral,
  registrarInasistenciaAudiencia,
  registrarRealizacionAudiencia,
  reprogramarAudiencia,
  validarActaAudiencia,
  validarDesistirPrescindir,
  validarProgramacionAudiencia,
  validarReprogramacionAudiencia,
  validarSolicitudInformeOral
} from './ttaip-informe-oral.model';
import { RegistrarSuspensionTtaipPayload, SuspensionPlazoTtaip } from '../../models/resolucion.model';
import {
  LucideAlertCircle,
  LucideAlertTriangle,
  LucideCalendar,
  LucideCheckCircle2,
  LucideClock,
  LucideExternalLink,
  LucideFileText,
  LucideMonitor,
  LucideUser,
  LucideVideo,
  LucideXCircle
} from '@lucide/angular';

type ModalTipo = 'SOLICITAR' | 'PROGRAMAR' | 'REPROGRAMAR' | 'ACTA' | 'INASISTENCIA' | 'DESISTIR' | 'PRESCINDIR' | null;

@Component({
  selector: 'app-ttaip-informe-oral',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAlertCircle,
    LucideAlertTriangle,
    LucideCalendar,
    LucideCheckCircle2,
    LucideClock,
    LucideExternalLink,
    LucideFileText,
    LucideMonitor,
    LucideUser,
    LucideVideo,
    LucideXCircle
  ],
  templateUrl: './ttaip-informe-oral.component.html',
  styleUrl: './ttaip-informe-oral.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipInformeOralComponent {
  // Inputs
  readonly expedienteTtaipId = input<number | undefined | null>();
  readonly numeroExpediente = input<string>('');
  readonly estadoApelacion = input<string | undefined | null>();
  readonly suspensiones = input<SuspensionPlazoTtaip[]>([]);
  readonly puedeGestionar = input<boolean>(false);
  readonly puedeSolicitar = input<boolean>(false);
  readonly actorNombre = input<string>('');

  // Outputs
  readonly audienciaCambio = output<AudienciaInformeOral>();
  readonly solicitarSuspension = output<RegistrarSuspensionTtaipPayload>();
  readonly cancelarSuspension = output<number>();

  // Estado local
  private readonly localAudienciaOverride = signal<AudienciaInformeOral | null>(null);
  readonly modalActivo = signal<ModalTipo>(null);
  readonly modalError = signal<string>('');

  // Formularios
  solicitanteSeleccionado: SolicitanteInformeOral = 'CIUDADANO';
  motivoSolicitudInput = '';
  responsableSolicitudInput = '';

  // Form Programar
  progFecha = '';
  progHoraInicio = '09:00';
  progHoraFin = '09:30';
  progPlataforma: PlataformaVirtual = 'TEAMS';
  progEnlace = '';
  progDuracionMin = 10;
  progSala = '';
  progResponsable = '';
  progIndicaciones = '';

  // Form Reprogramar
  reprogMotivo = '';
  reprogFecha = '';
  reprogHoraInicio = '10:00';
  reprogHoraFin = '10:30';
  reprogEnlace = '';
  reprogResponsable = '';

  // Form Acta
  actaAsistioRecurrente = true;
  actaLetradoNombre = '';
  actaColegiatura = '';
  actaAsistioEntidad = true;
  actaRepresentanteEntidad = '';
  actaResumenAlegatos = '';
  actaIncidencias = '';
  actaDocumentoIdInput?: number;
  actaResponsable = '';

  // Form Desistir / Prescindir / Inasistencia
  desistirPrescindirMotivo = '';
  desistirPrescindirResponsable = '';

  // Computados
  readonly audiencia = computed<AudienciaInformeOral | null>(() => {
    const override = this.localAudienciaOverride();
    if (override) return override;
    const susp = this.suspensiones();
    const id = this.expedienteTtaipId() || 0;
    const exp = this.numeroExpediente() || '—';
    return extraerAudienciaDeSuspensiones(susp, id, exp);
  });

  readonly estadoActual = computed<EstadoInformeOral>(() => {
    return this.audiencia()?.estado || 'NO_SOLICITADA';
  });

  readonly configEstado = computed(() => {
    return ESTADOS_INFORME_ORAL_CONFIG[this.estadoActual()];
  });

  readonly esTerminal = computed(() => {
    return esEstadoTerminalInformeOral(this.estadoActual());
  });

  readonly suspensionActiva = computed<SuspensionPlazoTtaip | null>(() => {
    const suspList = this.suspensiones() || [];
    return suspList.find(s => s.motivoSuspension === 'INFORME_ORAL' && s.estadoSuspension === 'ACTIVA') || null;
  });

  readonly puedeProgramar = computed(() => {
    return this.puedeGestionar() && puedeTransicionarInformeOral(this.estadoActual(), 'CONCEDIDA_PROGRAMADA');
  });

  readonly puedeReprogramar = computed(() => {
    return this.puedeGestionar() && puedeTransicionarInformeOral(this.estadoActual(), 'REPROGRAMADA');
  });

  readonly puedeRealizar = computed(() => {
    return this.puedeGestionar() && puedeTransicionarInformeOral(this.estadoActual(), 'REALIZADA');
  });

  readonly puedeInasistencia = computed(() => {
    return this.puedeGestionar() && puedeTransicionarInformeOral(this.estadoActual(), 'NO_REALIZADA');
  });

  readonly puedeDesistir = computed(() => {
    return puedeTransicionarInformeOral(this.estadoActual(), 'DESISTIDA');
  });

  readonly puedePrescindir = computed(() => {
    return this.puedeGestionar() && puedeTransicionarInformeOral(this.estadoActual(), 'PRESCINDIDA_DENEGADA');
  });

  abrirModal(tipo: ModalTipo): void {
    this.modalError.set('');
    this.modalActivo.set(tipo);

    const actor = this.actorNombre() || 'Secretaría Técnica TTAIP';
    if (tipo === 'SOLICITAR') {
      this.solicitanteSeleccionado = 'CIUDADANO';
      this.motivoSolicitudInput = '';
      this.responsableSolicitudInput = actor;
    } else if (tipo === 'PROGRAMAR') {
      this.progFecha = '';
      this.progHoraInicio = '10:00';
      this.progHoraFin = '10:30';
      this.progPlataforma = 'TEAMS';
      this.progEnlace = '';
      this.progDuracionMin = 10;
      this.progSala = 'Primera Sala Colegiada';
      this.progResponsable = actor;
      this.progIndicaciones = 'Conectarse con 10 minutos de anticipación.';
    } else if (tipo === 'REPROGRAMAR') {
      this.reprogMotivo = '';
      this.reprogFecha = '';
      this.reprogHoraInicio = '11:00';
      this.reprogHoraFin = '11:30';
      this.reprogEnlace = this.audiencia()?.enlaceVirtual || '';
      this.reprogResponsable = actor;
    } else if (tipo === 'ACTA') {
      this.actaAsistioRecurrente = true;
      this.actaLetradoNombre = '';
      this.actaColegiatura = '';
      this.actaAsistioEntidad = true;
      this.actaRepresentanteEntidad = '';
      this.actaResumenAlegatos = '';
      this.actaIncidencias = '';
      this.actaDocumentoIdInput = undefined;
      this.actaResponsable = actor;
    } else if (tipo === 'DESISTIR' || tipo === 'PRESCINDIR' || tipo === 'INASISTENCIA') {
      this.desistirPrescindirMotivo = '';
      this.desistirPrescindirResponsable = actor;
    }
  }

  cerrarModal(): void {
    this.modalActivo.set(null);
    this.modalError.set('');
  }

  enviarSolicitud(): void {
    const val = validarSolicitudInformeOral(this.solicitanteSeleccionado, this.motivoSolicitudInput, this.responsableSolicitudInput);
    if (!val.valido) {
      this.modalError.set(val.errores.join(' '));
      return;
    }

    const payload: RegistrarSuspensionTtaipPayload = {
      solicitante: this.solicitanteSeleccionado === 'AMBAS_PARTES' ? 'CIUDADANO' : this.solicitanteSeleccionado,
      motivo: this.motivoSolicitudInput.trim(),
      responsable: this.responsableSolicitudInput.trim(),
      observacion: `Solicitud de informe oral por ${this.solicitanteSeleccionado}.`
    };

    const nuevaAudiencia: AudienciaInformeOral = {
      expedienteTtaipId: this.expedienteTtaipId() || 0,
      numeroExpediente: this.numeroExpediente(),
      estado: 'SOLICITADA',
      solicitante: this.solicitanteSeleccionado,
      motivoSolicitud: this.motivoSolicitudInput.trim(),
      fechaSolicitud: new Date().toISOString().slice(0, 10),
      diasSuspendidos: 3,
      responsable: this.responsableSolicitudInput.trim()
    };

    this.localAudienciaOverride.set(nuevaAudiencia);
    this.audienciaCambio.emit(nuevaAudiencia);
    this.solicitarSuspension.emit(payload);
    this.cerrarModal();
  }

  ejecutarProgramacion(): void {
    const aud = this.audiencia();
    if (!aud) return;

    const payload: ProgramarAudienciaPayload = {
      fechaAudiencia: this.progFecha,
      horaInicio: this.progHoraInicio,
      horaFin: this.progHoraFin,
      plataforma: this.progPlataforma,
      enlaceVirtual: this.progEnlace.trim(),
      duracionMinutosParte: Number(this.progDuracionMin) || 10,
      salaNombre: this.progSala.trim() || undefined,
      responsable: this.progResponsable.trim(),
      indicaciones: this.progIndicaciones.trim() || undefined
    };

    const val = validarProgramacionAudiencia(payload);
    if (!val.valido) {
      this.modalError.set(val.errores.join(' '));
      return;
    }

    try {
      const actualizada = programarAudiencia(aud, payload);
      this.localAudienciaOverride.set(actualizada);
      this.audienciaCambio.emit(actualizada);
      this.cerrarModal();
    } catch (err: unknown) {
      this.modalError.set(err instanceof Error ? err.message : 'Error al programar');
    }
  }

  ejecutarReprogramacion(): void {
    const aud = this.audiencia();
    if (!aud) return;

    const payload: ReprogramarAudienciaPayload = {
      motivo: this.reprogMotivo.trim(),
      nuevaFechaAudiencia: this.reprogFecha,
      nuevaHoraInicio: this.reprogHoraInicio,
      nuevaHoraFin: this.reprogHoraFin,
      nuevoEnlaceVirtual: this.reprogEnlace.trim(),
      responsable: this.reprogResponsable.trim()
    };

    const val = validarReprogramacionAudiencia(payload);
    if (!val.valido) {
      this.modalError.set(val.errores.join(' '));
      return;
    }

    try {
      const actualizada = reprogramarAudiencia(aud, payload);
      this.localAudienciaOverride.set(actualizada);
      this.audienciaCambio.emit(actualizada);
      this.cerrarModal();
    } catch (err: unknown) {
      this.modalError.set(err instanceof Error ? err.message : 'Error al reprogramar');
    }
  }

  ejecutarActa(): void {
    const aud = this.audiencia();
    if (!aud) return;

    const payload: RegistrarActaAudienciaPayload = {
      asistioRecurrente: this.actaAsistioRecurrente,
      letradoRecurrenteNombre: this.actaAsistioRecurrente ? this.actaLetradoNombre.trim() || undefined : undefined,
      colegiaturaLetrado: this.actaAsistioRecurrente ? this.actaColegiatura.trim() || undefined : undefined,
      asistioEntidad: this.actaAsistioEntidad,
      representanteEntidadNombre: this.actaAsistioEntidad ? this.actaRepresentanteEntidad.trim() || undefined : undefined,
      resumenAlegatos: this.actaResumenAlegatos.trim(),
      incidencias: this.actaIncidencias.trim() || undefined,
      actaDocumentoId: this.actaDocumentoIdInput ? Number(this.actaDocumentoIdInput) : undefined,
      responsable: this.actaResponsable.trim()
    };

    const val = validarActaAudiencia(payload);
    if (!val.valido) {
      this.modalError.set(val.errores.join(' '));
      return;
    }

    try {
      const actualizada = registrarRealizacionAudiencia(aud, payload);
      this.localAudienciaOverride.set(actualizada);
      this.audienciaCambio.emit(actualizada);
      this.cerrarModal();
    } catch (err: unknown) {
      this.modalError.set(err instanceof Error ? err.message : 'Error al registrar acta');
    }
  }

  ejecutarInasistencia(): void {
    const aud = this.audiencia();
    if (!aud) return;
    const motivo = this.desistirPrescindirMotivo.trim() || 'Inasistencia no justificada de las partes convocadas';
    const resp = this.desistirPrescindirResponsable.trim();
    if (!resp) {
      this.modalError.set('Indique el responsable.');
      return;
    }
    const actualizada = registrarInasistenciaAudiencia(aud, motivo, resp);
    this.localAudienciaOverride.set(actualizada);
    this.audienciaCambio.emit(actualizada);
    this.cerrarModal();
  }

  ejecutarDesistimiento(): void {
    const aud = this.audiencia();
    if (!aud) return;
    const payload: DesistirPrescindirPayload = {
      motivo: this.desistirPrescindirMotivo.trim(),
      responsable: this.desistirPrescindirResponsable.trim()
    };
    const val = validarDesistirPrescindir(payload);
    if (!val.valido) {
      this.modalError.set(val.errores.join(' '));
      return;
    }
    const actualizada = desistirInformeOral(aud, payload);
    this.localAudienciaOverride.set(actualizada);
    this.audienciaCambio.emit(actualizada);

    const susp = this.suspensionActiva();
    if (susp && susp.id) {
      this.cancelarSuspension.emit(susp.id);
    }
    this.cerrarModal();
  }

  ejecutarPrescindencia(): void {
    const aud = this.audiencia();
    if (!aud) return;
    const payload: DesistirPrescindirPayload = {
      motivo: this.desistirPrescindirMotivo.trim(),
      responsable: this.desistirPrescindirResponsable.trim()
    };
    const val = validarDesistirPrescindir(payload);
    if (!val.valido) {
      this.modalError.set(val.errores.join(' '));
      return;
    }
    const actualizada = prescindirInformeOral(aud, payload);
    this.localAudienciaOverride.set(actualizada);
    this.audienciaCambio.emit(actualizada);

    const susp = this.suspensionActiva();
    if (susp && susp.id) {
      this.cancelarSuspension.emit(susp.id);
    }
    this.cerrarModal();
  }
}
