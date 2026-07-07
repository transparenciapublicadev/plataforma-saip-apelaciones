import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';
import { CumplimientoResolucionTtaip, NotificacionTtaip, SuspensionPlazoTtaip } from '../../models/resolucion.model';
import { DocumentoRelation } from '../../models/documento.model';
import { DocumentListComponent } from '../../shared/document-list.component';
import { DocumentUploadComponent } from '../../shared/document-upload.component';

type DetailTab = 'apelacion' | 'descargos' | 'cumplimiento' | 'adjuntos';
type TimelineIcon = 'check' | 'x' | 'alert';
type SuspensionAdicional = 'INFORME_ORAL' | 'INFORMACION_COMPLEMENTARIA';
type SuspensionSolicitante = 'CIUDADANO' | 'ENTIDAD_PUBLICA' | 'TTAIP';
type TipoCumplimiento = 'TOTAL' | 'PARCIAL' | 'NO_CUMPLE';

interface TimelineItem {
  fecha: string;
  titulo: string;
  descripcion: string;
  icon: TimelineIcon;
}

interface ResultadoMeta {
  label: string;
  accent: string;
}

@Component({
  selector: 'app-ttaip-resolucion-detalle',
  imports: [CommonModule, RouterLink, DocumentListComponent, DocumentUploadComponent],
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
  readonly notificacionLoading = signal<boolean>(false);
  readonly notificacionMessage = signal<string>('');
  readonly notificacionError = signal<string>('');
  readonly cumplimientoLoading = signal<boolean>(false);
  readonly cumplimientoMessage = signal<string>('');
  readonly cumplimientoError = signal<string>('');
  readonly tabs: { id: DetailTab; label: string }[] = [
    { id: 'apelacion', label: 'Apelacion' },
    { id: 'descargos', label: 'Descargos' },
    { id: 'cumplimiento', label: 'Cumplimiento' },
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
  readonly cumplimientosExpediente = computed(() => this.expedienteTtaip()?.cumplimientosResolucion ?? []);
  readonly descargoActivo = computed(() =>
    this.descargosExpediente().find((descargo) => this.normalizeKey(descargo.estadoDescargo).includes('REQUERIDO')) ?? null
  );
  readonly cumplimientoActivo = computed(() =>
    this.cumplimientosExpediente().find((cumplimiento) =>
      ['PENDIENTE', 'OBSERVADO'].includes(this.normalizeKey(cumplimiento.estadoCumplimiento))
    ) ?? null
  );
  readonly resolucionFinalFundada = computed(() =>
    this.resolucionesExpediente().find((resolucion) =>
      this.normalizeKey(resolucion.tipoResolucion) === 'RESOLUCION_FINAL'
      && ['FUNDADO', 'FUNDADO_EN_PARTE'].includes(this.normalizeKey(resolucion.decision))
    ) ?? null
  );

  readonly estadoLabel = computed(() => this.formatEstado(this.apelacion()?.estado || 'EN_CALIFICACION_1'));

  readonly puedeAdjuntarDocumentos = computed(() => {
    const estado = this.normalizeKey(this.apelacion()?.estado);
    const closedStates = [
      'RESUELTO_FUNDADO',
      'RESUELTO_INFUNDADO',
      'CONCLUSION_SUSTRACCION_MATERIA',
      'TENER_POR_NO_PRESENTADO',
      'RESUELTO_IMPROCEDENTE',
      'CONCLUSION_DESISTIMIENTO',
      'ESTESE_A_LO_RESUELTO',
      'RESUELTO_ESTESE_A_LO_RESUELTO',
      'RESUELTO_NULIDAD',
      'NULIDAD_DEL_ACTO'
    ];
    return estado ? !closedStates.includes(estado) : true;
  });

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
      case 'ESTESE_A_LO_RESUELTO':
      case 'RESUELTO_ESTESE_A_LO_RESUELTO':
        return { label: 'ESTESE A LO RESUELTO', accent: 'var(--info)' };
      case 'NULIDAD_DEL_ACTO':
      case 'RESUELTO_NULIDAD_ACTO':
        return { label: 'NULIDAD DEL ACTO', accent: 'var(--warning)' };
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
      expedienteSAIP: apelacion?.solicitudExpediente || apelacion?.numeroSolicitudExterna || '—',
      asuntoSAIP: apelacion?.solicitudAsunto || apelacion?.resumenSolicitudOriginal || 'Sin asunto registrado',
      causalDenegatoria: apelacion?.resolucionPrimeraCalificacion?.decision || 'No registrada por el backend',
      fundamentoEntidad: apelacion?.resolucionPrimeraCalificacion?.observaciones
        || apelacion?.resolucionPrimeraCalificacion?.fundamentos
        || 'No registrada por el backend',
      fundamentosApelacion: apelacion?.fundamentos || 'Sin fundamentos registrados.',
      fechaApelacion: apelacion?.fechaApelacion || ''
    };
  });

  readonly documentoRelation = computed<DocumentoRelation | null>(() => {
    const apelacionId = this.apelacion()?.id;
    return apelacionId ? { apelacionId } : null;
  });

  readonly expedienteDocumentoRelation = computed<DocumentoRelation | null>(() => {
    const expedienteTtaipId = this.expedienteTtaip()?.id;
    return expedienteTtaipId ? { expedienteTtaipId } : null;
  });

  resolucionDocumentoRelation(resolucionId?: number | null): DocumentoRelation | null {
    return resolucionId ? { resolucionId } : null;
  }

  cedulaDocumentoRelation(cedulaId?: number | null): DocumentoRelation | null {
    return cedulaId ? { cedulaNotificacionId: cedulaId } : null;
  }

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

  onDocumentoSubido(): void {
    const expediente = this.expedienteDisplay();
    if (expediente && expediente !== '—') {
      this.cargarApelacion(expediente);
    }
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

  crearSeguimientoCumplimiento(observacion: string): void {
    const expedienteId = this.expedienteTtaip()?.id;
    const resolucion = this.resolucionFinalFundada();
    if (!expedienteId || !resolucion?.id) {
      this.cumplimientoError.set('No se encontro una resolucion final fundada para iniciar seguimiento.');
      return;
    }

    this.cumplimientoLoading.set(true);
    this.cumplimientoMessage.set('');
    this.cumplimientoError.set('');
    this.ttaipService.crearSeguimientoCumplimiento(expedienteId, resolucion.id, {
      responsableTtaip: 'Secretaría Técnica TTAIP',
      observacion: observacion || 'Seguimiento de cumplimiento de resolución fundada.'
    }).subscribe({
      next: () => {
        this.cumplimientoMessage.set('Seguimiento creado con plazo de 7 días hábiles.');
        this.cumplimientoLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.cumplimientoError.set('No se pudo crear el seguimiento de cumplimiento.');
        this.cumplimientoLoading.set(false);
      }
    });
  }

  registrarCumplimiento(
    cumplimientoId: number | undefined,
    tipoCumplimiento: string,
    descripcion: string,
    evidencia: string,
    responsable: string,
    observacion: string
  ): void {
    const expedienteId = this.expedienteTtaip()?.id;
    if (!expedienteId || !cumplimientoId) {
      this.cumplimientoError.set('No se encontro seguimiento activo para registrar cumplimiento.');
      return;
    }
    const tipo = this.parseTipoCumplimiento(tipoCumplimiento);
    if (!tipo) {
      this.cumplimientoError.set('Seleccione un tipo de cumplimiento valido.');
      return;
    }
    if (!descripcion.trim() || !responsable.trim()) {
      this.cumplimientoError.set('Complete descripción del cumplimiento y responsable de la entidad.');
      return;
    }

    this.cumplimientoLoading.set(true);
    this.cumplimientoMessage.set('');
    this.cumplimientoError.set('');
    this.ttaipService.registrarCumplimiento(expedienteId, cumplimientoId, {
      tipoCumplimiento: tipo,
      descripcionCumplimiento: descripcion,
      evidenciaCumplimiento: this.isUrl(evidencia) ? evidencia : null,
      referenciaDocumento: this.isUrl(evidencia) ? null : evidencia || null,
      responsableEntidad: responsable,
      observacion: observacion || null
    }).subscribe({
      next: () => {
        this.cumplimientoMessage.set('Cumplimiento comunicado por la entidad.');
        this.cumplimientoLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.cumplimientoError.set('No se pudo registrar el cumplimiento de la entidad.');
        this.cumplimientoLoading.set(false);
      }
    });
  }

  observarCumplimiento(cumplimientoId: number | undefined, observacion: string): void {
    const expedienteId = this.expedienteTtaip()?.id;
    if (!expedienteId || !cumplimientoId) {
      this.cumplimientoError.set('No se encontro seguimiento para observar.');
      return;
    }
    if (!observacion.trim()) {
      this.cumplimientoError.set('Complete el sustento de observación.');
      return;
    }

    this.cumplimientoLoading.set(true);
    this.cumplimientoMessage.set('');
    this.cumplimientoError.set('');
    this.ttaipService.observarCumplimiento(expedienteId, cumplimientoId, {
      responsableTtaip: 'Secretaría Técnica TTAIP',
      observacion
    }).subscribe({
      next: () => {
        this.cumplimientoMessage.set('Cumplimiento observado por el TTAIP.');
        this.cumplimientoLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.cumplimientoError.set('No se pudo observar el cumplimiento.');
        this.cumplimientoLoading.set(false);
      }
    });
  }

  cerrarCumplimiento(cumplimientoId: number | undefined, observacion: string): void {
    const expedienteId = this.expedienteTtaip()?.id;
    if (!expedienteId || !cumplimientoId) {
      this.cumplimientoError.set('No se encontro seguimiento para cerrar.');
      return;
    }

    this.cumplimientoLoading.set(true);
    this.cumplimientoMessage.set('');
    this.cumplimientoError.set('');
    this.ttaipService.cerrarCumplimiento(expedienteId, cumplimientoId, {
      responsableTtaip: 'Secretaría Técnica TTAIP',
      observacion: observacion || 'Seguimiento de cumplimiento cerrado.'
    }).subscribe({
      next: () => {
        this.cumplimientoMessage.set('Seguimiento de cumplimiento cerrado.');
        this.cumplimientoLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.cumplimientoError.set('No se pudo cerrar el seguimiento de cumplimiento.');
        this.cumplimientoLoading.set(false);
      }
    });
  }

  registrarConstanciaNotificacion(
    notificacionId: number | undefined,
    medioNotificacion: string,
    codigoEnvio: string,
    codigoConstancia: string,
    constanciaEnvio: string,
    evidencia: string
  ): void {
    const expedienteId = this.expedienteTtaip()?.id;
    if (!expedienteId || !notificacionId) {
      this.notificacionError.set('No se encontro la notificacion para registrar constancia.');
      return;
    }
    if (!medioNotificacion.trim() || !constanciaEnvio.trim()) {
      this.notificacionError.set('Complete medio y constancia de envio.');
      return;
    }

    this.notificacionLoading.set(true);
    this.notificacionMessage.set('');
    this.notificacionError.set('');
    this.ttaipService.registrarConstanciaEnvio(expedienteId, notificacionId, {
      medioNotificacion,
      codigoEnvio: codigoEnvio || null,
      codigoConstancia: codigoConstancia || null,
      constanciaEnvio,
      evidenciaUrl: this.isUrl(evidencia) ? evidencia : null,
      referenciaEvidencia: this.isUrl(evidencia) ? null : evidencia || null,
      responsable: 'Mesa de Partes TTAIP',
      observacion: 'Constancia registrada desde el detalle TTAIP.'
    }).subscribe({
      next: () => {
        this.notificacionMessage.set('Constancia de envio registrada.');
        this.notificacionLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.notificacionError.set('No se pudo registrar la constancia de envio.');
        this.notificacionLoading.set(false);
      }
    });
  }

  registrarAcuseNotificacion(
    notificacionId: number | undefined,
    estadoAcuse: string,
    acuseAutomatico: string,
    evidencia: string
  ): void {
    const expedienteId = this.expedienteTtaip()?.id;
    if (!expedienteId || !notificacionId) {
      this.notificacionError.set('No se encontro la notificacion para registrar acuse.');
      return;
    }
    const estado = this.parseEstadoAcuse(estadoAcuse);
    if (!estado) {
      this.notificacionError.set('Seleccione un estado de acuse valido.');
      return;
    }
    if (!acuseAutomatico.trim()) {
      this.notificacionError.set('Complete el detalle del acuse automatico.');
      return;
    }

    this.notificacionLoading.set(true);
    this.notificacionMessage.set('');
    this.notificacionError.set('');
    this.ttaipService.registrarAcuseAutomatico(expedienteId, notificacionId, {
      estadoAcuse: estado,
      acuseAutomatico,
      evidenciaUrl: this.isUrl(evidencia) ? evidencia : null,
      referenciaEvidencia: this.isUrl(evidencia) ? null : evidencia || null,
      responsable: 'Sistema de notificaciones TTAIP',
      observacion: 'Acuse registrado desde el detalle TTAIP.'
    }).subscribe({
      next: () => {
        this.notificacionMessage.set(estado === 'ENTREGADO'
          ? 'Acuse entregado registrado.'
          : 'Acuse fallido u observado registrado; la notificacion queda disponible para reproceso.');
        this.notificacionLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.notificacionError.set('No se pudo registrar el acuse automatico.');
        this.notificacionLoading.set(false);
      }
    });
  }

  validarNotificacionManual(
    notificacionId: number | undefined,
    observacion: string,
    evidencia: string
  ): void {
    const expedienteId = this.expedienteTtaip()?.id;
    if (!expedienteId || !notificacionId) {
      this.notificacionError.set('No se encontro la notificacion para validar.');
      return;
    }
    if (!observacion.trim()) {
      this.notificacionError.set('Complete el sustento de validacion manual.');
      return;
    }

    this.notificacionLoading.set(true);
    this.notificacionMessage.set('');
    this.notificacionError.set('');
    this.ttaipService.validarNotificacionManualmente(expedienteId, notificacionId, {
      responsableValidacion: 'Secretaría Técnica TTAIP',
      observacionValidacion: observacion,
      evidenciaUrl: this.isUrl(evidencia) ? evidencia : null,
      referenciaEvidencia: this.isUrl(evidencia) ? null : evidencia || null
    }).subscribe({
      next: () => {
        this.notificacionMessage.set('Notificacion validada manualmente.');
        this.notificacionLoading.set(false);
        this.cargarApelacion(this.expedienteDisplay());
      },
      error: () => {
        this.notificacionError.set('No se pudo validar manualmente la notificacion.');
        this.notificacionLoading.set(false);
      }
    });
  }

  notificationStatusClass(notificacion: NotificacionTtaip): string {
    const estado = this.normalizeKey(notificacion.estado);
    if (estado === 'FALLIDA' || estado === 'OBSERVADA') return 'pill pill-high';
    if (estado === 'VALIDADA' || estado === 'ENTREGADA') return 'pill pill-low';
    return 'pill pill-medium';
  }

  notificationEvidenceLabel(notificacion: NotificacionTtaip): string {
    return notificacion.evidenciaUrl || notificacion.referenciaEvidencia || notificacion.codigoConstancia || 'Sin evidencia registrada';
  }

  cumplimientoStatusClass(cumplimiento: CumplimientoResolucionTtaip): string {
    const estado = this.normalizeKey(cumplimiento.estadoCumplimiento);
    if (estado === 'VENCIDO' || estado === 'OBSERVADO') return 'pill pill-high';
    if (estado === 'CUMPLIDO' || estado === 'CERRADO') return 'pill pill-low';
    return 'pill pill-medium';
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

  private parseEstadoAcuse(value: string): 'ENTREGADO' | 'FALLIDO' | 'NO_RECIBIDO' | 'OBSERVADO' | null {
    const normalized = this.normalizeKey(value);
    if (normalized === 'ENTREGADO' || normalized === 'FALLIDO' || normalized === 'NO_RECIBIDO' || normalized === 'OBSERVADO') {
      return normalized;
    }
    return null;
  }

  private parseTipoCumplimiento(value: string): TipoCumplimiento | null {
    const normalized = this.normalizeKey(value);
    if (normalized === 'TOTAL' || normalized === 'PARCIAL' || normalized === 'NO_CUMPLE') {
      return normalized;
    }
    return null;
  }

  private isUrl(value: string): boolean {
    return /^https?:\/\//i.test(value.trim());
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
        descripcion: final.observaciones || final.fundamentos || 'Resolución final registrada por el backend.',
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
        return 'Pendiente de elevacion al TTAIP';
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
      case 'RESUELTO_ESTESE_A_LO_RESUELTO':
        return 'Estese a lo resuelto';
      case 'RESUELTO_NULIDAD_ACTO':
        return 'Nulidad del acto';
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
    if (normalized.includes('DESCARGO') || normalized.includes('SUSPENSION') || normalized.includes('CUMPLIMIENTO')) return 'alert';
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
