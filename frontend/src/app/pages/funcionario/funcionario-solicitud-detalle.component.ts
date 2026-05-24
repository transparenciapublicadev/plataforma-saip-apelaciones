import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { AmpliacionPlazoSolicitud, ObservacionSolicitud, RegistrarEntregaParcialPayload, Solicitud } from '../../models/solicitud.model';
import { canSendManualResponse, isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';

type DetailTabId = 'respuesta' | 'solicitud' | 'observacion' | 'ampliacion' | 'ciudadano' | 'adjuntos' | 'historial';

interface DetailTab {
  id: DetailTabId;
  label: string;
}

interface HistorialItem {
  accion: string;
  fecha: string;
  responsable: string;
  detalle: string;
  color: 'brand' | 'warning' | 'success' | 'muted' | 'violet';
}

@Component({
  selector: 'app-funcionario-solicitud-detalle',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './funcionario-solicitud-detalle.component.html',
  styleUrl: './funcionario-solicitud-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuncionarioSolicitudDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly solicitudService = inject(SolicitudService);
  private readonly authService = inject(AuthService);

  solicitud = signal<Solicitud | null>(null);
  loading = signal<boolean>(true);
  error = signal<string>('');
  activeTab = signal<DetailTabId>('solicitud');
  observacionMotivo = signal<string>('');
  observacionLoading = signal<boolean>(false);
  observacionError = signal<string>('');
  observacionSuccess = signal<string>('');
  ampliacionMotivo = signal<string>('');
  ampliacionInforme = signal<string>('');
  ampliacionFechaNotificacion = signal<string>(this.toInputDate(new Date()));
  ampliacionCronograma = signal<RegistrarEntregaParcialPayload[]>([this.crearEntregaForm(1)]);
  ampliacionLoading = signal<boolean>(false);
  ampliacionError = signal<string>('');
  ampliacionSuccess = signal<string>('');

  readonly tabs = computed<DetailTab[]>(() => {
    const base: DetailTab[] = [
      { id: 'solicitud', label: 'Solicitud' },
      { id: 'observacion', label: 'Observación' },
      { id: 'ampliacion', label: 'Ampliación' },
      { id: 'ciudadano', label: 'Ciudadano' },
      { id: 'adjuntos', label: 'Adjuntos' },
      { id: 'historial', label: 'Historial' }
    ];

    if (this.puedeVerRespuesta()) {
      return [{ id: 'respuesta', label: 'Respuesta' }, ...base];
    }

    return base;
  });

  readonly historialItems = computed<HistorialItem[]>(() => {
    const sol = this.solicitud();
    if (!sol) {
      return [];
    }

    const items: HistorialItem[] = [
      {
        accion: 'Solicitud presentada',
        fecha: sol.fechaPresentacion,
        responsable: 'Sistema SAIP',
        detalle: 'Solicitud registrada y asignada a la entidad responsable.',
        color: 'brand'
      }
    ];

    if (sol.respuesta?.fechaRespuesta) {
      items.push({
        accion: `Respuesta emitida · ${this.getTipoRespuestaDisplay()}`,
        fecha: sol.respuesta.fechaRespuesta,
        responsable: 'Funcionario responsable',
        detalle: 'La entidad registró respuesta para el ciudadano.',
        color: this.esRespuestaEntrega() ? 'success' : 'warning'
      });
    } else if (this.esSilencioAdministrativo()) {
      items.push({
        accion: 'Silencio administrativo automático',
        fecha: sol.fechaLimite,
        responsable: 'Sistema SAIP',
        detalle: 'Se configuró por vencimiento de plazo sin respuesta manual.',
        color: 'muted'
      });
    }

    for (const observacion of this.observaciones()) {
      items.push({
        accion: `Observación SAIP · ${this.getObservacionEstadoDisplay(observacion.estado)}`,
        fecha: observacion.fechaObservacion,
        responsable: observacion.responsableObservacion || 'Entidad pública',
        detalle: observacion.motivoObservacion,
        color: observacion.estado === 'SUBSANADA' ? 'success' : (observacion.estado === 'NO_SUBSANADA' ? 'warning' : 'muted')
      });
      if (observacion.fechaSubsanacion) {
        items.push({
          accion: 'Subsanación ciudadana recibida',
          fecha: observacion.fechaSubsanacion,
          responsable: observacion.responsableSubsanacion || 'Ciudadano',
          detalle: observacion.comentarioSubsanacion || observacion.documentoSubsanacionNombre || 'Subsanación registrada.',
          color: 'success'
        });
      }
    }

    for (const ampliacion of this.ampliaciones()) {
      items.push({
        accion: `Ampliación de plazo · ${this.getAmpliacionEstadoDisplay(ampliacion.estadoAmpliacion)}`,
        fecha: ampliacion.fechaSolicitudAmpliacion || ampliacion.fechaNotificacionAmpliacion,
        responsable: ampliacion.responsable || 'Entidad pública',
        detalle: `Plazo ampliado de ${ampliacion.fechaLimiteOriginal} a ${ampliacion.fechaLimiteAmpliada}.`,
        color: ampliacion.estadoAmpliacion === 'COMPLETADA' ? 'success' : 'warning'
      });
    }

    if (sol.apelacion?.expediente) {
      items.push({
        accion: `Apelación presentada · ${this.getEstadoDisplay(sol.apelacion.estado || '')}`,
        fecha: sol.apelacion.fechaApelacion,
        responsable: 'Ciudadano recurrente',
        detalle: 'El recurso fue recibido por el TTAIP para primera calificación.',
        color: 'violet'
      });
    }

    return items;
  });

  readonly observaciones = computed<ObservacionSolicitud[]>(() => this.solicitud()?.observaciones || []);

  readonly ampliaciones = computed<AmpliacionPlazoSolicitud[]>(() => this.solicitud()?.ampliacionesPlazo || []);

  readonly observacionPendiente = computed<ObservacionSolicitud | null>(() =>
    this.observaciones().find((item) => item.estado === 'PENDIENTE_SUBSANACION') || null
  );

  readonly ampliacionActiva = computed<AmpliacionPlazoSolicitud | null>(() =>
    this.ampliaciones().find((item) => item.estadoAmpliacion === 'REGISTRADA' || item.estadoAmpliacion === 'NOTIFICADA') || null
  );

  ngOnInit(): void {
    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (!expediente) {
      this.error.set('No se recibió el expediente de la solicitud.');
      this.loading.set(false);
      return;
    }

    this.cargarSolicitud(expediente);
  }

  cargarSolicitud(expediente: string, preferredTab?: DetailTabId): void {
    this.loading.set(true);
    this.solicitudService.findByExpediente(expediente).subscribe({
      next: (data) => {
        this.solicitud.set(data);
        this.activeTab.set(preferredTab || (this.puedeVerRespuesta() ? 'respuesta' : 'solicitud'));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la solicitud');
        this.loading.set(false);
      }
    });
  }

  cambiarTab(tab: DetailTabId): void {
    this.activeTab.set(tab);
  }

  puedeResponder(): boolean {
    const sol = this.solicitud();
    if (!sol) {
      return false;
    }

    return canSendManualResponse(sol)
      && (sol.estado === 'RECEPCIONADA' || sol.estado === 'EN_REVISION' || sol.estado === 'PENDIENTE_INFORMACION');
  }

  puedeVerRespuesta(): boolean {
    const sol = this.solicitud();
    return !!sol?.respuesta?.tipoRespuesta || this.esSilencioAdministrativo();
  }

  esSilencioAdministrativo(): boolean {
    return isSilencioAdministrativo(this.solicitud());
  }

  getTipoRespuestaDisplay(): string {
    const sol = this.solicitud();
    if (!sol) {
      return '';
    }

    return sol.respuesta?.tipoRespuesta || (this.esSilencioAdministrativo() ? 'SILENCIO_ADMINISTRATIVO' : 'SIN_RESPUESTA');
  }

  getTituloRespuesta(): string {
    const tipo = this.getTipoRespuestaDisplay();

    if (tipo === 'SILENCIO_ADMINISTRATIVO') {
      return 'Silencio administrativo';
    }

    if (tipo === 'ENTREGA_TOTAL' || tipo === 'ENTREGA_PARCIAL') {
      return 'Solicitud aceptada';
    }

    if (tipo === 'SIN_RESPUESTA') {
      return 'Sin respuesta registrada';
    }

    return 'Solicitud denegada';
  }

  esRespuestaEntrega(): boolean {
    const tipo = this.getTipoRespuestaDisplay();
    return tipo === 'ENTREGA_TOTAL' || tipo === 'ENTREGA_PARCIAL';
  }

  getRespuestaAccentColor(): string {
    if (this.esRespuestaEntrega()) {
      return 'var(--success)';
    }

    if (this.getTipoRespuestaDisplay() === 'SILENCIO_ADMINISTRATIVO') {
      return 'var(--muted-foreground)';
    }

    return 'var(--brand-700)';
  }

  getEstadoDisplay(value: string | undefined): string {
    if ((value || '').toUpperCase() === 'PENDIENTE_ELEVACION') {
      return 'EN CALIFICACION 1';
    }
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  puedeObservar(): boolean {
    const sol = this.solicitud();
    return !!sol
      && (sol.estado === 'RECEPCIONADA' || sol.estado === 'EN_REVISION')
      && !this.observacionPendiente();
  }

  puedeAmpliar(): boolean {
    const sol = this.solicitud();
    return !!sol
      && (sol.estado === 'RECEPCIONADA' || sol.estado === 'EN_REVISION')
      && !this.ampliacionActiva();
  }

  registrarObservacion(): void {
    const sol = this.solicitud();
    const motivo = this.observacionMotivo().trim();
    if (!sol || !motivo) {
      this.observacionError.set('Ingrese el motivo de observación.');
      return;
    }

    this.observacionLoading.set(true);
    this.observacionError.set('');
    this.observacionSuccess.set('');

    this.solicitudService.observar(sol.id, {
      motivoObservacion: motivo,
      responsable: this.authService.obtenerSesion()?.nombre || 'Funcionario de entidad'
    }).subscribe({
      next: () => {
        this.observacionMotivo.set('');
        this.observacionSuccess.set('Observación registrada. El ciudadano tiene 2 días hábiles para subsanar.');
        this.observacionLoading.set(false);
        this.cargarSolicitud(sol.expediente, 'observacion');
      },
      error: (error) => {
        this.observacionError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo registrar la observación.');
        this.observacionLoading.set(false);
      }
    });
  }

  registrarAmpliacion(): void {
    const sol = this.solicitud();
    const motivo = this.ampliacionMotivo().trim();
    const informe = this.ampliacionInforme().trim();
    const fechaNotificacion = this.ampliacionFechaNotificacion();
    const cronograma = this.ampliacionCronograma()
      .map((item) => ({
        numeroEntrega: Number(item.numeroEntrega),
        descripcion: item.descripcion.trim(),
        fechaProgramada: item.fechaProgramada,
        observacion: item.observacion?.trim() || undefined
      }))
      .filter((item) => item.numeroEntrega && item.descripcion && item.fechaProgramada);

    if (!sol || !motivo || !informe || !fechaNotificacion || cronograma.length === 0) {
      this.ampliacionError.set('Complete motivo, informe, fecha de notificación y al menos una entrega parcial.');
      return;
    }

    this.ampliacionLoading.set(true);
    this.ampliacionError.set('');
    this.ampliacionSuccess.set('');

    this.solicitudService.registrarAmpliacion(sol.id, {
      motivoAmpliacion: motivo,
      informeAmpliacion: informe,
      fechaNotificacionAmpliacion: fechaNotificacion,
      responsable: this.authService.obtenerSesion()?.nombre || 'Funcionario de entidad',
      cronograma
    }).subscribe({
      next: () => {
        this.ampliacionMotivo.set('');
        this.ampliacionInforme.set('');
        this.ampliacionFechaNotificacion.set(this.toInputDate(new Date()));
        this.ampliacionCronograma.set([this.crearEntregaForm(1)]);
        this.ampliacionSuccess.set('Ampliación registrada y notificada con cronograma de entregas parciales.');
        this.ampliacionLoading.set(false);
        this.cargarSolicitud(sol.expediente, 'ampliacion');
      },
      error: (error) => {
        this.ampliacionError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo registrar la ampliación.');
        this.ampliacionLoading.set(false);
      }
    });
  }

  agregarEntregaCronograma(): void {
    const items = this.ampliacionCronograma();
    const next = items.reduce((max, item) => Math.max(max, Number(item.numeroEntrega) || 0), 0) + 1;
    this.ampliacionCronograma.set([...items, this.crearEntregaForm(next)]);
  }

  removerEntregaCronograma(index: number): void {
    const items = this.ampliacionCronograma();
    if (items.length <= 1) {
      return;
    }
    this.ampliacionCronograma.set(items.filter((_, current) => current !== index));
  }

  actualizarEntregaCronograma(index: number, field: keyof RegistrarEntregaParcialPayload, value: string | number): void {
    this.ampliacionCronograma.set(this.ampliacionCronograma().map((item, current) => {
      if (current !== index) {
        return item;
      }
      const updated: RegistrarEntregaParcialPayload = { ...item };
      if (field === 'numeroEntrega') {
        updated.numeroEntrega = Number(value);
      } else if (field === 'descripcion') {
        updated.descripcion = String(value);
      } else if (field === 'fechaProgramada') {
        updated.fechaProgramada = String(value);
      } else {
        updated.observacion = String(value);
      }
      return updated;
    }));
  }

  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      RECEPCIONADA: 'pill pill-medium',
      EN_REVISION: 'pill pill-medium',
      PENDIENTE_INFORMACION: 'pill pill-medium',
      RESPONDIDA: 'pill pill-low',
      DENEGADA: 'pill pill-high',
      VENCIDA: 'pill pill-high',
      CONCLUIDA: 'pill'
    };
    return map[estado] || 'pill';
  }

  getApelacionEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      PENDIENTE_ELEVACION: 'pill pill-medium',
      EN_CALIFICACION_1: 'pill pill-medium',
      EN_CALIFICACION_2: 'pill pill-medium',
      EN_SUBSANACION: 'pill pill-medium',
      NOTIFICACION_SEGUNDA_CALIFICACION: 'pill pill-medium',
      EN_RESOLUCION: 'pill pill-medium',
      RESUELTO: 'pill pill-low',
      RESUELTO_FUNDADO: 'pill pill-low',
      RESUELTO_FUNDADO_EN_PARTE: 'pill pill-low',
      RESUELTO_INFUNDADO: 'pill',
      RESUELTO_INFUNDADO_EN_PARTE: 'pill',
      RESUELTO_IMPROCEDENTE: 'pill pill-high',
      TENER_POR_NO_PRESENTADO: 'pill pill-high',
      CONCLUSION_SUSTRACCION_MATERIA: 'pill pill-low',
      CONCLUSION_DESISTIMIENTO: 'pill'
    };
    return map[estado] || 'pill';
  }

  getDiasRestantes(): number | null {
    const value = this.solicitud()?.diasRestantes;
    return typeof value === 'number' ? value : null;
  }

  getDiasRestantesColor(): string {
    const dias = this.getDiasRestantes();
    if (dias === null) {
      return 'var(--muted-foreground)';
    }
    if (dias < 0) {
      return 'var(--brand-700)';
    }
    if (dias <= 3) {
      return 'var(--warning)';
    }
    return 'var(--success)';
  }

  getDiasRestantesDisplay(): string {
    const dias = this.getDiasRestantes();
    if (dias === null) {
      return 'Sin dato';
    }

    if (dias < 0) {
      return `${Math.abs(dias)} días retraso`;
    }

    return `${dias} días`;
  }

  isUrgente(): boolean {
    const dias = this.getDiasRestantes();
    return dias !== null && dias >= 0 && dias <= 3 && !this.puedeVerRespuesta();
  }

  getInitials(name: string | undefined): string {
    const source = (name || 'Ciudadano').trim();
    if (!source) {
      return 'CI';
    }

    return source
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2) || 'CI';
  }

  getHistorialColorClass(color: HistorialItem['color']): string {
    const map: Record<HistorialItem['color'], string> = {
      brand: 'var(--brand-600)',
      warning: 'var(--warning)',
      success: 'var(--success)',
      muted: 'var(--muted-foreground)',
      violet: 'var(--accent-violet)'
    };
    return map[color];
  }

  getObservacionEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  getAmpliacionEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  getEntregaEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      PROGRAMADA: 'pill pill-medium',
      ENTREGADA: 'pill pill-low',
      OBSERVADA: 'pill pill-medium',
      CANCELADA: 'pill',
      VENCIDA: 'pill pill-high'
    };
    return map[estado] || 'pill';
  }

  private crearEntregaForm(numeroEntrega: number): RegistrarEntregaParcialPayload {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 15 * numeroEntrega);
    return {
      numeroEntrega,
      descripcion: '',
      fechaProgramada: this.toInputDate(fecha),
      observacion: ''
    };
  }

  private toInputDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
