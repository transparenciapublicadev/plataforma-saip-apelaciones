import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { AmpliacionPlazoSolicitud, EncauzamientoSolicitud, ObservacionSolicitud, Solicitud } from '../../models/solicitud.model';
import { isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';

interface RequestTab {
  id: 'solicitud' | 'respuesta' | 'encauzamiento' | 'ampliacion' | 'adjuntos' | 'apelacion';
  label: string;
}

interface TimelineEvent {
  title: string;
  description: string;
  date?: string;
  status: 'completed' | 'current' | 'pending';
  icon: 'mail' | 'search' | 'check';
}

@Component({
  selector: 'app-solicitud-detalle',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './solicitud-detalle.component.html',
  styleUrl: './solicitud-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SolicitudDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly solicitudService = inject(SolicitudService);
  private readonly authService = inject(AuthService);

  solicitud = signal<Solicitud | null>(null);
  loading = signal<boolean>(true);
  error = signal<string>('');
  activeTab = signal<RequestTab['id']>('solicitud');
  subsanacionComentario = signal<string>('');
  subsanacionDocumentoNombre = signal<string>('');
  subsanacionLoading = signal<boolean>(false);
  subsanacionError = signal<string>('');
  subsanacionSuccess = signal<string>('');

  readonly tabs: RequestTab[] = [
    { id: 'solicitud', label: 'Solicitud' },
    { id: 'respuesta', label: 'Respuesta' },
    { id: 'encauzamiento', label: 'Encauzamiento' },
    { id: 'ampliacion', label: 'Ampliación' },
    { id: 'adjuntos', label: 'Adjuntos' },
    { id: 'apelacion', label: 'Apelación' }
  ];

  ngOnInit(): void {
    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (!expediente) {
      this.error.set('No se recibió el expediente de la solicitud.');
      this.loading.set(false);
      return;
    }
    this.cargarSolicitud(expediente);
  }

  cargarSolicitud(expediente: string): void {
    this.loading.set(true);
    this.solicitudService.findByExpediente(expediente).subscribe({
      next: (data) => {
        this.solicitud.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la solicitud');
        this.loading.set(false);
      }
    });
  }

  cambiarTab(tab: RequestTab['id']): void {
    this.activeTab.set(tab);
  }

  isTabActive(tab: RequestTab['id']): boolean {
    return this.activeTab() === tab;
  }

  getEstadoClass(estado: string): string {
    const classes: Record<string, string> = {
      RECEPCIONADA: 'pill pill-medium',
      EN_REVISION: 'pill pill-medium',
      PENDIENTE_INFORMACION: 'pill pill-medium',
      RESPONDIDA: 'pill pill-low',
      DENEGADA: 'pill pill-high',
      VENCIDA: 'pill pill-high',
      CONCLUIDA: 'pill'
    };
    return classes[estado] || 'pill';
  }

  getApelacionEstadoClass(estado: string): string {
    const classes: Record<string, string> = {
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
    return classes[estado] || 'pill';
  }

  getEstadoDisplay(value: string | undefined): string {
    if ((value || '').toUpperCase() === 'PENDIENTE_ELEVACION') {
      return 'EN CALIFICACION 1';
    }
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  observaciones(): ObservacionSolicitud[] {
    return this.solicitud()?.observaciones || [];
  }

  observacionPendiente(): ObservacionSolicitud | null {
    return this.observaciones().find((item) => item.estado === 'PENDIENTE_SUBSANACION') || null;
  }

  ampliaciones(): AmpliacionPlazoSolicitud[] {
    return this.solicitud()?.ampliacionesPlazo || [];
  }

  ampliacionActiva(): AmpliacionPlazoSolicitud | null {
    return this.ampliaciones().find((item) => item.estadoAmpliacion === 'REGISTRADA' || item.estadoAmpliacion === 'NOTIFICADA') || null;
  }

  encauzamientos(): EncauzamientoSolicitud[] {
    return this.solicitud()?.encauzamientos || [];
  }

  encauzamientoActivo(): EncauzamientoSolicitud | null {
    return this.encauzamientos().find((item) => item.estadoEncauzamiento === 'REGISTRADO' || item.estadoEncauzamiento === 'DERIVADO') || null;
  }

  subsanarObservacion(): void {
    const sol = this.solicitud();
    const observacion = this.observacionPendiente();
    const comentario = this.subsanacionComentario().trim();
    const documento = this.subsanacionDocumentoNombre().trim();

    if (!sol || !observacion) {
      return;
    }
    if (!comentario && !documento) {
      this.subsanacionError.set('Ingrese un comentario o referencia de documento para subsanar.');
      return;
    }

    this.subsanacionLoading.set(true);
    this.subsanacionError.set('');
    this.subsanacionSuccess.set('');

    this.solicitudService.subsanar(sol.id, observacion.id, {
      comentarioSubsanacion: comentario || undefined,
      documentoSubsanacionNombre: documento || undefined,
      responsable: this.getSolicitanteNombre()
    }).subscribe({
      next: () => {
        this.subsanacionComentario.set('');
        this.subsanacionDocumentoNombre.set('');
        this.subsanacionSuccess.set('Subsanación enviada. La solicitud volvió a revisión de la entidad.');
        this.subsanacionLoading.set(false);
        this.cargarSolicitud(sol.expediente);
      },
      error: (error) => {
        this.subsanacionError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo registrar la subsanación.');
        this.subsanacionLoading.set(false);
      }
    });
  }

  getSolicitanteNombre(): string {
    const sol = this.solicitud();
    return sol?.ciudadanoNombre || this.authService.obtenerSesion()?.nombre || 'Ciudadano';
  }

  getSolicitanteIniciales(): string {
    const base = this.getSolicitanteNombre()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
    return base || 'CI';
  }

  getSolicitanteDni(): string {
    return this.solicitud()?.ciudadanoDni || this.authService.obtenerSesion()?.dni || 'No disponible';
  }

  getSolicitanteEmail(): string {
    return this.authService.obtenerSesion()?.email || 'No disponible';
  }

  formatosSeleccionados(): string[] {
    const sol = this.solicitud();
    if (!sol) {
      return [];
    }

    const selected: string[] = [];
    if (sol.formatoDigital) selected.push('Digital');
    if (sol.formatoFisico) selected.push('Físico');
    if (sol.copiaSimple) selected.push('Copia simple');
    if (sol.copiaCertificada) selected.push('Copia certificada');
    return selected;
  }

  puedeApelar(): boolean {
    const sol = this.solicitud();
    return !!sol && (sol.estado === 'RESPONDIDA' || sol.estado === 'DENEGADA' || sol.estado === 'VENCIDA') && !sol.apelacion;
  }

  esSilencioAdministrativo(): boolean {
    return isSilencioAdministrativo(this.solicitud());
  }

  puedeVerRespuesta(): boolean {
    const sol = this.solicitud();
    return !!sol?.respuesta || this.esSilencioAdministrativo();
  }

  getTipoRespuestaDisplay(): string {
    const sol = this.solicitud();
    if (!sol) {
      return '';
    }

    return sol.respuesta?.tipoRespuesta || (this.esSilencioAdministrativo() ? 'SILENCIO_ADMINISTRATIVO' : '');
  }

  getRespuestaResumenTitulo(): string {
    const tipo = this.getTipoRespuestaDisplay();
    const titles: Record<string, string> = {
      DENEGACION_TOTAL: 'Solicitud denegada',
      ENTREGA_TOTAL: 'Solicitud atendida',
      ENTREGA_PARCIAL: 'Entrega parcial de información',
      SILENCIO_ADMINISTRATIVO: 'Silencio administrativo automático'
    };
    return titles[tipo] || 'Respuesta de la entidad';
  }

  getRespuestaResumenDescripcion(): string {
    const tipo = this.getTipoRespuestaDisplay();
    if (tipo === 'SILENCIO_ADMINISTRATIVO') {
      return 'La entidad no respondió dentro del plazo legal de 10 días hábiles.';
    }
    if (tipo === 'DENEGACION_TOTAL') {
      return 'La entidad denegó el acceso a la información solicitada.';
    }
    if (tipo === 'ENTREGA_PARCIAL') {
      return 'La entidad entregó parcialmente la información solicitada.';
    }
    if (tipo === 'ENTREGA_TOTAL') {
      return 'La entidad atendió su solicitud y remitió la información.';
    }
    return 'La entidad emitió una respuesta para su solicitud.';
  }

  getTimelineEvents(): TimelineEvent[] {
    const sol = this.solicitud();
    if (!sol) {
      return [];
    }

    const hasRespuesta = !!sol.respuesta || this.esSilencioAdministrativo();

    const events: TimelineEvent[] = [
      {
        title: 'Solicitud presentada',
        description: 'SAIP registrada y notificada a la entidad.',
        date: sol.fechaPresentacion,
        status: 'completed',
        icon: 'mail'
      },
      {
        title: 'En revisión',
        description: 'La entidad evalúa la solicitud.',
        date: sol.fechaPresentacion,
        status: hasRespuesta ? 'completed' : 'current',
        icon: 'search'
      },
      {
        title: 'Respuesta emitida',
        description: hasRespuesta ? this.getRespuestaResumenTitulo() : 'Pendiente de respuesta',
        date: sol.respuesta?.fechaRespuesta,
        status: hasRespuesta ? 'completed' : 'pending',
        icon: 'check'
      }
    ];

    for (const observacion of this.observaciones()) {
      events.push({
        title: observacion.estado === 'SUBSANADA' ? 'Observación subsanada' : 'Observación registrada',
        description: observacion.estado === 'SUBSANADA'
          ? 'La entidad recibió su subsanación y volvió a revisar la SAIP.'
          : `Debe subsanar hasta ${observacion.fechaLimiteSubsanacion || 'la fecha indicada'}.`,
        date: observacion.fechaSubsanacion || observacion.fechaObservacion,
        status: observacion.estado === 'SUBSANADA' ? 'completed' : 'current',
        icon: observacion.estado === 'SUBSANADA' ? 'check' : 'search'
      });
    }

    for (const ampliacion of this.ampliaciones()) {
      events.push({
        title: 'Ampliación notificada',
        description: `La entidad notificó un cronograma de ${ampliacion.cronograma.length} entrega(s) parcial(es).`,
        date: ampliacion.fechaNotificacionAmpliacion,
        status: ampliacion.estadoAmpliacion === 'COMPLETADA' ? 'completed' : 'current',
        icon: ampliacion.estadoAmpliacion === 'COMPLETADA' ? 'check' : 'search'
      });
    }

    for (const encauzamiento of this.encauzamientos()) {
      events.push({
        title: `Encauzamiento ${this.getEstadoDisplay(encauzamiento.alcance)}`,
        description: `${encauzamiento.entidadOrigenNombre} derivó competencia hacia ${encauzamiento.entidadDestinoNombre}.`,
        date: encauzamiento.fechaEncauzamiento,
        status: encauzamiento.estadoEncauzamiento === 'ATENDIDO' ? 'completed' : 'current',
        icon: encauzamiento.estadoEncauzamiento === 'ATENDIDO' ? 'check' : 'search'
      });
    }

    return events;
  }

  getApelacionResultadoDisplay(): string {
    const resultado = this.solicitud()?.apelacion?.resultado;
    return this.getEstadoDisplay(resultado);
  }

  isApelacionResuelta(): boolean {
    const estado = this.solicitud()?.apelacion?.estado || '';
    return estado.startsWith('RESUELTO') || estado.startsWith('CONCLUSION') || estado === 'TENER_POR_NO_PRESENTADO';
  }

  showSubsanarAction(): boolean {
    return this.solicitud()?.apelacion?.estado === 'EN_SUBSANACION';
  }
}
