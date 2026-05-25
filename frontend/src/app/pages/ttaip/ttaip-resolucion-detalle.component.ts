import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';
import { SuspensionPlazoTtaip } from '../../models/resolucion.model';

type DetailTab = 'apelacion' | 'descargos' | 'adjuntos';
type TimelineIcon = 'check' | 'x' | 'alert';
type SuspensionAdicional = 'INFORME_ORAL' | 'INFORMACION_COMPLEMENTARIA';
type SuspensionSolicitante = 'CIUDADANO' | 'ENTIDAD_PUBLICA' | 'TTAIP';

interface TimelineItem {
  fecha: string;
  titulo: string;
  descripcion: string;
  icon: TimelineIcon;
}

interface AttachmentItem {
  nombre: string;
  meta: string;
}

interface ResultadoMeta {
  label: string;
  accent: string;
}

@Component({
  selector: 'app-ttaip-resolucion-detalle',
  imports: [CommonModule, RouterLink],
  templateUrl: './ttaip-resolucion-detalle.component.html',
  styleUrl: './ttaip-resolucion-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipResolucionDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);

  readonly apelacion = signal<Apelacion | null>(null);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string>('');
  readonly activeTab = signal<DetailTab>('apelacion');
  readonly descargoLoading = signal<boolean>(false);
  readonly descargoMessage = signal<string>('');
  readonly descargoError = signal<string>('');
  readonly tabs: { id: DetailTab; label: string }[] = [
    { id: 'apelacion', label: 'Apelacion' },
    { id: 'descargos', label: 'Descargos' },
    { id: 'adjuntos', label: 'Adjuntos' }
  ];

  private readonly routeExpediente = signal<string>('');

  readonly expedienteDisplay = computed(() => this.apelacion()?.expediente || this.routeExpediente() || '—');
  readonly expedienteTtaip = computed(() => this.apelacion()?.expedienteTtaip ?? null);
  readonly salaAsignada = computed(() => this.expedienteTtaip()?.sala?.nombre || 'Sala no asignada por el backend');
  readonly miembrosSala = computed(() => this.expedienteTtaip()?.miembros ?? []);
  readonly resolucionesExpediente = computed(() => this.expedienteTtaip()?.resoluciones ?? this.apelacion()?.resoluciones ?? []);
  readonly cedulasExpediente = computed(() => this.expedienteTtaip()?.cedulas ?? []);
  readonly notificacionesExpediente = computed(() => this.expedienteTtaip()?.notificaciones ?? []);
  readonly historialExpediente = computed(() => this.expedienteTtaip()?.historial ?? []);
  readonly reprocesosExpediente = computed(() => this.expedienteTtaip()?.reprocesos ?? []);
  readonly descargosExpediente = computed(() => this.expedienteTtaip()?.descargosEntidad ?? []);
  readonly suspensionesExpediente = computed(() => this.expedienteTtaip()?.suspensionesPlazo ?? []);
  readonly descargoActivo = computed(() =>
    this.descargosExpediente().find((descargo) => this.normalizeKey(descargo.estadoDescargo).includes('REQUERIDO')) ?? null
  );

  readonly estadoLabel = computed(() => this.formatEstado(this.apelacion()?.estado || 'EN_CALIFICACION_1'));

  readonly resultadoNormalizado = computed(() => {
    const raw = this.apelacion()?.resolucion?.decision || this.apelacion()?.resultado;
    return this.normalizeKey(raw);
  });

  readonly resultadoMeta = computed<ResultadoMeta | null>(() => {
    const resultado = this.resultadoNormalizado();
    switch (resultado) {
      case 'FUNDADO':
        return { label: 'FUNDADO', accent: 'var(--success)' };
      case 'FUNDADO_EN_PARTE':
        return { label: 'FUNDADO EN PARTE', accent: 'var(--success)' };
      case 'INFUNDADO':
        return { label: 'INFUNDADO', accent: 'var(--brand-700)' };
      case 'INFUNDADO_EN_PARTE':
        return { label: 'INFUNDADO EN PARTE', accent: 'var(--brand-700)' };
      case 'IMPROCEDENTE':
      case 'RESUELTO_IMPROCEDENTE':
        return { label: 'IMPROCEDENTE', accent: 'var(--muted-foreground)' };
      case 'TENER_POR_NO_PRESENTADO':
        return { label: 'NO PRESENTADO', accent: 'var(--warning)' };
      case 'CONCLUSION_SUSTRACCION_MATERIA':
        return { label: 'SUSTRACCION DE MATERIA', accent: 'var(--info)' };
      case 'CONCLUSION_DESISTIMIENTO':
        return { label: 'DESISTIMIENTO', accent: 'var(--gold-dark)' };
      case 'ADMISIBLE':
        return { label: 'ADMISIBLE', accent: 'var(--info)' };
      case 'INADMISIBLE':
        return { label: 'INADMISIBLE', accent: 'var(--warning)' };
      default:
        return null;
    }
  });

  readonly dataView = computed(() => {
    const apelacion = this.apelacion();
    return {
      ciudadano: apelacion?.ciudadanoNombre || 'Ciudadano',
      dni: '—',
      email: '—',
      telefono: '—',
      entidad: apelacion?.entidadNombre || 'Entidad publica',
      expedienteSAIP: apelacion?.solicitudExpediente || '—',
      asuntoSAIP: apelacion?.solicitudAsunto || 'Sin asunto registrado',
      causalDenegatoria: apelacion?.resolucionPrimeraCalificacion?.decision || 'No registrada por el backend',
      fundamentoEntidad: apelacion?.resolucionPrimeraCalificacion?.observaciones
        || apelacion?.resolucionPrimeraCalificacion?.fundamentos
        || 'No registrada por el backend',
      fundamentosApelacion: apelacion?.fundamentos || 'Sin fundamentos registrados.',
      fechaApelacion: apelacion?.fechaApelacion || ''
    };
  });

  readonly adjuntos = computed<AttachmentItem[]>(() => {
    const docs = this.apelacion()?.documentos;
    if (docs && docs.length > 0) {
      return docs.map((doc) => ({
        nombre: doc.nombreArchivo || 'Documento',
        meta: `${(doc.tipoArchivo || 'PDF').toUpperCase()} · Archivo` 
      }));
    }

    return [];
  });

  readonly timeline = computed<TimelineItem[]>(() => this.buildTimeline());

  readonly mostrarCajaResultado = computed(() => {
    const resultado = this.resultadoNormalizado();
    return resultado.startsWith('FUNDADO') || resultado.startsWith('INFUNDADO');
  });

  readonly resultadoCajaLabel = computed(() => {
    const resultado = this.resultadoNormalizado();
    if (resultado.startsWith('FUNDADO')) return 'APELACION FUNDADA';
    if (resultado.startsWith('INFUNDADO')) return 'APELACION INFUNDADA';
    return 'APELACION RESUELTA';
  });

  readonly resultadoCajaDetalle = computed(() => {
    const resultado = this.resultadoNormalizado();
    if (resultado.startsWith('FUNDADO')) {
      return 'Se ordena a la entidad entregar la informacion solicitada en el plazo establecido.';
    }
    if (resultado.startsWith('INFUNDADO')) {
      return 'La denegatoria de la entidad se mantiene conforme al marco normativo aplicable.';
    }
    return 'El expediente culmino su evaluacion en el Tribunal.';
  });

  readonly resultadoCajaColor = computed(() => {
    const resultado = this.resultadoNormalizado();
    return resultado.startsWith('FUNDADO') ? 'var(--success)' : 'var(--brand-700)';
  });

  ngOnInit(): void {
    const expediente = this.route.snapshot.paramMap.get('expediente') || '';
    this.routeExpediente.set(expediente);

    if (!expediente) {
      this.loading.set(false);
      this.error.set('No se encontro el expediente solicitado');
      return;
    }

    this.cargarApelacion(expediente);
  }

  cargarApelacion(expediente: string): void {
    this.loading.set(true);

    this.apelacionService.findByExpediente(expediente).subscribe({
      next: (data) => {
        this.apelacion.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la apelacion');
        this.loading.set(false);
      }
    });
  }

  cambiarTab(tab: DetailTab): void {
    this.activeTab.set(tab);
  }

  requerirDescargos(observacion: string): void {
    const expedienteId = this.expedienteTtaip()?.id;
    if (!expedienteId) {
      this.descargoError.set('No se encontro expediente TTAIP para requerir descargos.');
      return;
    }

    this.descargoLoading.set(true);
    this.descargoMessage.set('');
    this.descargoError.set('');
    this.ttaipService.requerirDescargos(expedienteId, {
      responsableTtaip: 'Secretaría Técnica TTAIP',
      observacion: observacion || 'Requerimiento de descargos y expediente administrativo.'
    }).subscribe({
      next: () => {
        this.descargoMessage.set('Descargos requeridos y plazo de resolución suspendido.');
        this.descargoLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.descargoError.set('No se pudo requerir descargos para este expediente.');
        this.descargoLoading.set(false);
      }
    });
  }

  presentarDescargo(
    descargoId: number | undefined,
    resumenDescargo: string,
    referenciaDocumento: string,
    responsableEntidad: string,
    observacion: string
  ): void {
    const expedienteId = this.expedienteTtaip()?.id;
    if (!expedienteId) {
      this.descargoError.set('No se encontro expediente TTAIP para presentar descargo.');
      return;
    }
    if (!descargoId) {
      this.descargoError.set('No se encontro el requerimiento de descargo activo.');
      return;
    }
    if (!resumenDescargo.trim() || !responsableEntidad.trim()) {
      this.descargoError.set('Complete resumen del descargo y responsable de la entidad.');
      return;
    }

    this.descargoLoading.set(true);
    this.descargoMessage.set('');
    this.descargoError.set('');
    this.ttaipService.presentarDescargo(expedienteId, descargoId, {
      resumenDescargo,
      referenciaDocumento: referenciaDocumento || null,
      responsableEntidad,
      observacion: observacion || null
    }).subscribe({
      next: () => {
        this.descargoMessage.set('Descargo presentado y suspensión cerrada.');
        this.descargoLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.descargoError.set('No se pudo presentar el descargo de la entidad.');
        this.descargoLoading.set(false);
      }
    });
  }

  registrarSuspensionAdicional(
    tipo: SuspensionAdicional,
    solicitante: string,
    motivo: string,
    responsable: string,
    observacion: string
  ): void {
    const expedienteId = this.expedienteTtaip()?.id;
    if (!expedienteId) {
      this.descargoError.set('No se encontro expediente TTAIP para registrar suspension.');
      return;
    }
    const solicitanteNormalizado = this.parseSuspensionSolicitante(solicitante);
    if (!solicitanteNormalizado) {
      this.descargoError.set('Seleccione un solicitante valido para la suspension.');
      return;
    }
    if (!motivo.trim() || !responsable.trim()) {
      this.descargoError.set('Complete motivo y responsable de la suspension.');
      return;
    }

    this.descargoLoading.set(true);
    this.descargoMessage.set('');
    this.descargoError.set('');
    const request = {
      solicitante: solicitanteNormalizado,
      motivo,
      responsable,
      observacion: observacion || null
    };
    const action = tipo === 'INFORME_ORAL'
      ? this.ttaipService.registrarInformeOral(expedienteId, request)
      : this.ttaipService.registrarInformacionComplementaria(expedienteId, request);

    action.subscribe({
      next: () => {
        this.descargoMessage.set(
          tipo === 'INFORME_ORAL'
            ? 'Informe oral registrado y plazo suspendido por 3 dias habiles.'
            : 'Informacion complementaria registrada y plazo suspendido por 3 dias habiles.'
        );
        this.descargoLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.descargoError.set('No se pudo registrar la suspension adicional del expediente.');
        this.descargoLoading.set(false);
      }
    });
  }

  cancelarSuspension(suspensionId: number | undefined, observacion: string): void {
    const expedienteId = this.expedienteTtaip()?.id;
    if (!expedienteId || !suspensionId) {
      this.descargoError.set('No se encontro la suspension activa para cancelar.');
      return;
    }

    this.descargoLoading.set(true);
    this.descargoMessage.set('');
    this.descargoError.set('');
    this.ttaipService.cancelarSuspension(expedienteId, suspensionId, {
      responsable: 'Secretaría Técnica TTAIP',
      observacion: observacion || 'Suspensión adicional dejada sin efecto.'
    }).subscribe({
      next: () => {
        this.descargoMessage.set('Suspensión cancelada y fecha límite de resolución recalculada.');
        this.descargoLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.descargoError.set('No se pudo cancelar la suspension adicional.');
        this.descargoLoading.set(false);
      }
    });
  }

  esSuspensionAdicionalActiva(suspension: SuspensionPlazoTtaip): boolean {
    const motivo = this.normalizeKey(suspension.motivoSuspension);
    return suspension.estadoSuspension === 'ACTIVA'
      && (motivo === 'INFORME_ORAL' || motivo === 'INFORMACION_COMPLEMENTARIA');
  }

  formatSuspensionLabel(value?: string | null): string {
    const normalized = this.normalizeKey(value);
    return normalized ? normalized.replaceAll('_', ' ') : 'SUSPENSION';
  }

  dotColor(icon: TimelineIcon): string {
    if (icon === 'x') return 'var(--brand-700)';
    if (icon === 'alert') return 'var(--warning)';
    return 'var(--success)';
  }

  ciudadanoIniciales(): string {
    const ciudadano = this.dataView().ciudadano.trim();
    const words = ciudadano.split(/\s+/).filter((word) => word.length > 0);

    if (words.length === 0) return 'CI';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  private buildTimeline(): TimelineItem[] {
    const apelacion = this.apelacion();
    if (!apelacion) {
      return [];
    }

    const historial = this.historialExpediente();
    if (historial.length > 0) {
      return historial.map((evento) => ({
        fecha: this.formatDateLabel(evento.fechaEvento, true),
        titulo: this.formatEventoTtaip(evento.tipoEvento),
        descripcion: evento.descripcion || evento.referencia || 'Evento registrado por el backend.',
        icon: this.iconForEventoTtaip(evento.tipoEvento)
      }));
    }

    const items: TimelineItem[] = [
      {
        fecha: this.formatDateLabel(apelacion.fechaApelacion, true),
        titulo: 'Apelación presentada',
        descripcion: 'Recurso recibido y registrado en el Tribunal.',
        icon: 'check'
      }
    ];

    const primera = apelacion.resolucionPrimeraCalificacion;
    if (primera) {
      items.push({
        fecha: this.formatDateLabel(primera.fechaResolucion, true),
        titulo: `1ra calificación · ${this.formatDecision(primera.decision)}`,
        descripcion: primera.observaciones || primera.fundamentos || 'Calificación registrada por el backend.',
        icon: this.iconForDecision(primera.decision)
      });
    }

    if (apelacion.fechaSubsanacion && this.normalizeKey(apelacion.estado) !== 'EN_SUBSANACION') {
      items.push({
        fecha: this.formatDateLabel(apelacion.fechaSubsanacion, false),
        titulo: 'Subsanación registrada',
        descripcion: 'El expediente avanzó a la revisión posterior a la subsanación.',
        icon: 'check'
      });
    }

    const segunda = apelacion.resolucionSegundaCalificacion;
    if (segunda) {
      items.push({
        fecha: this.formatDateLabel(segunda.fechaResolucion, true),
        titulo: `2da calificación · ${this.formatDecision(segunda.decision)}`,
        descripcion: segunda.observaciones || segunda.fundamentos || 'Segunda calificación registrada por el backend.',
        icon: this.iconForDecision(segunda.decision)
      });
    }

    const final = apelacion.resolucion;
    if (final) {
      items.push({
        fecha: this.formatDateLabel(final.fechaResolucion, true),
        titulo: `Resolución final · ${this.formatDecision(final.decision)}`,
        descripcion: final.fundamentos || 'Resolución final registrada por el backend.',
        icon: this.iconForDecision(final.decision)
      });
    }

    return items;
  }

  private normalizeKey(value?: string | null): string {
    return (value || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
  }

  private parseSuspensionSolicitante(value: string): SuspensionSolicitante | null {
    const normalized = this.normalizeKey(value);
    if (normalized === 'CIUDADANO' || normalized === 'ENTIDAD_PUBLICA' || normalized === 'TTAIP') {
      return normalized;
    }
    return null;
  }

  private formatEstado(value: string): string {
    switch (this.normalizeKey(value)) {
      case 'PENDIENTE_ELEVACION':
        return 'En primera calificacion';
      case 'EN_CALIFICACION_1':
        return 'En primera calificacion';
      case 'EN_SUBSANACION':
        return 'En subsanacion';
      case 'EN_CALIFICACION_2':
        return 'En segunda calificacion';
      case 'NOTIFICACION_SEGUNDA_CALIFICACION':
        return 'Notificacion de segunda calificacion';
      case 'EN_RESOLUCION':
        return 'En resolucion final';
      case 'RESUELTO':
        return 'Resuelto';
      case 'RESUELTO_FUNDADO':
        return 'Resuelto fundado';
      case 'RESUELTO_FUNDADO_EN_PARTE':
        return 'Resuelto fundado en parte';
      case 'RESUELTO_INFUNDADO':
        return 'Resuelto infundado';
      case 'RESUELTO_INFUNDADO_EN_PARTE':
        return 'Resuelto infundado en parte';
      case 'RESUELTO_IMPROCEDENTE':
        return 'Resuelto improcedente';
      case 'TENER_POR_NO_PRESENTADO':
        return 'No presentado';
      case 'CONCLUSION_SUSTRACCION_MATERIA':
        return 'Conclusion por sustraccion de materia';
      case 'CONCLUSION_DESISTIMIENTO':
        return 'Conclusion por desistimiento';
      default:
        return 'En tramite';
    }
  }

  private formatDateLabel(raw?: string | null, includeTime = false): string {
    if (!raw) return 'Pendiente';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return 'Pendiente';

    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: includeTime ? '2-digit' : undefined,
      minute: includeTime ? '2-digit' : undefined,
      hour12: false
    }).format(date);
  }

  private formatDecision(value?: string | null): string {
    const normalized = this.normalizeKey(value);
    return normalized ? normalized.replaceAll('_', ' ') : 'SIN DECISIÓN';
  }

  private formatEventoTtaip(value?: string | null): string {
    const normalized = this.normalizeKey(value);
    if (!normalized) return 'Evento TTAIP';
    return normalized
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^\w|\s\w/g, (letter) => letter.toUpperCase());
  }

  private iconForEventoTtaip(value?: string | null): TimelineIcon {
    const normalized = this.normalizeKey(value);
    if (normalized.includes('REPROCESO')) return 'alert';
    if (normalized.includes('DESCARGO') || normalized.includes('SUSPENSION')) return 'alert';
    if (normalized.includes('CAMBIO_ESTADO')) return 'check';
    return 'check';
  }

  private iconForDecision(value?: string | null): TimelineIcon {
    const normalized = this.normalizeKey(value);
    if (normalized.includes('INADMISIBLE')) {
      return 'alert';
    }
    if (normalized.includes('IMPROCEDENTE') || normalized.includes('INFUNDADO') || normalized.includes('NO_PRESENTADO')) {
      return 'x';
    }
    return 'check';
  }
}
