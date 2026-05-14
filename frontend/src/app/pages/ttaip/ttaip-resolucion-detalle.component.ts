import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { Apelacion } from '../../models/apelacion.model';

type DetailTab = 'apelacion' | 'adjuntos';
type TimelineIcon = 'check' | 'x' | 'alert';

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

  readonly apelacion = signal<Apelacion | null>(null);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string>('');
  readonly activeTab = signal<DetailTab>('apelacion');

  private readonly routeExpediente = signal<string>('');
  private readonly estadoOverride = signal<string | null>(null);
  private readonly resultadoOverride = signal<string | null>(null);
  private readonly viaSubsanacion = signal<boolean>(false);

  readonly expedienteDisplay = computed(() => this.apelacion()?.expediente || this.routeExpediente() || '—');

  readonly estadoLabel = computed(() => this.formatEstado(this.apelacion()?.estado || this.estadoOverride() || 'PENDIENTE_ELEVACION'));

  readonly resultadoNormalizado = computed(() => {
    const raw = this.apelacion()?.resolucion?.decision || this.apelacion()?.resultado || this.resultadoOverride();
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
      causalDenegatoria: 'Informacion confidencial',
      fundamentoEntidad: 'Fundamento juridico invocado por la entidad en su respuesta original.',
      fundamentosApelacion: apelacion?.fundamentos || 'Fundamentos del recurso interpuesto por el administrado.',
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

    return [
      { nombre: 'SAIP_Original.pdf', meta: 'PDF · 345 KB' },
      { nombre: 'Respuesta_Entidad.pdf', meta: 'PDF · 512 KB' },
      { nombre: 'Recurso_Fundamentado.pdf', meta: 'PDF · 876 KB' },
      { nombre: 'Resolucion_Final.pdf', meta: 'PDF · 1.2 MB' }
    ];
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

    this.estadoOverride.set(this.route.snapshot.queryParamMap.get('estado'));
    this.resultadoOverride.set(this.route.snapshot.queryParamMap.get('resultado'));

    const viaSubsanacionRaw = this.route.snapshot.queryParamMap.get('viaSubsanacion');
    this.viaSubsanacion.set(viaSubsanacionRaw === 'true' || viaSubsanacionRaw === '1');

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
    const resultado = this.resultadoNormalizado();
    const estado = this.normalizeKey(this.apelacion()?.estado || this.estadoOverride());
    const fechaBase = this.formatDateLabel(this.apelacion()?.fechaApelacion, true);

    if ((resultado === 'IMPROCEDENTE' || resultado === 'RESUELTO_IMPROCEDENTE') && (estado === 'ARCHIVADO' || estado === 'RESUELTO_IMPROCEDENTE')) {
      return [
        { fecha: fechaBase, titulo: 'Apelacion presentada', descripcion: 'Recurso recibido y registrado en el sistema.', icon: 'check' },
        { fecha: '08/09/2025 10:15', titulo: '1ra calificacion · IMPROCEDENTE', descripcion: 'No cumple requisitos formales. Proceso archivado.', icon: 'x' }
      ];
    }

    if (resultado === 'TENER_POR_NO_PRESENTADO') {
      return [
        { fecha: fechaBase, titulo: 'Apelacion presentada', descripcion: 'Recurso recibido y registrado en el sistema.', icon: 'check' },
        { fecha: '08/09/2025 10:15', titulo: '1ra calificacion · INADMISIBLE', descripcion: 'Se detectaron observaciones por subsanar.', icon: 'alert' },
        { fecha: '08/09/2025 10:20', titulo: 'Notificacion de subsanacion', descripcion: 'Plazo de 2 dias habiles otorgado.', icon: 'check' },
        { fecha: '13/09/2025 18:00', titulo: '2da calificacion · NO PRESENTADO', descripcion: 'No se subsano en el plazo. Proceso archivado.', icon: 'x' }
      ];
    }

    if (resultado === 'IMPROCEDENTE' || resultado === 'RESUELTO_IMPROCEDENTE') {
      return [
        { fecha: fechaBase, titulo: 'Apelacion presentada', descripcion: 'Recurso recibido y registrado.', icon: 'check' },
        { fecha: '08/09/2025 10:15', titulo: '1ra calificacion · INADMISIBLE', descripcion: 'Se detectaron observaciones.', icon: 'alert' },
        { fecha: '10/09/2025 15:30', titulo: 'Subsanacion presentada', descripcion: 'Documentacion complementaria recibida.', icon: 'check' },
        { fecha: '11/09/2025 11:00', titulo: '2da calificacion · IMPROCEDENTE', descripcion: 'No cumple requisitos. Proceso archivado.', icon: 'x' }
      ];
    }

    if ((resultado.startsWith('FUNDADO') || resultado.startsWith('INFUNDADO')) && this.viaSubsanacion()) {
      return [
        { fecha: fechaBase, titulo: 'Apelacion presentada', descripcion: 'Recurso recibido y registrado.', icon: 'check' },
        { fecha: '08/09/2025 10:15', titulo: '1ra calificacion · INADMISIBLE', descripcion: 'Se detectaron observaciones.', icon: 'alert' },
        { fecha: '10/09/2025 15:30', titulo: 'Subsanacion presentada', descripcion: 'Documentacion complementaria.', icon: 'check' },
        { fecha: '11/09/2025 11:00', titulo: '2da calificacion · ADMITIDO A TRAMITE', descripcion: 'Subsanacion aprobada. Pasa a fondo.', icon: 'check' },
        {
          fecha: this.formatDateLabel(this.apelacion()?.resolucion?.fechaResolucion, true),
          titulo: `Resolucion final · ${this.resultadoMeta()?.label || 'RESUELTO'}`,
          descripcion: resultado.startsWith('FUNDADO')
            ? 'Apelacion amparada. Se ordena entrega en 10 dias habiles.'
            : 'Apelacion desestimada. Se confirma la conducta de la entidad.',
          icon: resultado.startsWith('FUNDADO') ? 'check' : 'x'
        }
      ];
    }

    if (resultado.startsWith('FUNDADO') || resultado.startsWith('INFUNDADO')) {
      return [
        { fecha: fechaBase, titulo: 'Apelacion presentada', descripcion: 'Recurso recibido y registrado.', icon: 'check' },
        { fecha: '08/09/2025 10:15', titulo: '1ra calificacion · ADMISIBLE', descripcion: 'Cumple requisitos formales. Pasa a fondo.', icon: 'check' },
        {
          fecha: this.formatDateLabel(this.apelacion()?.resolucion?.fechaResolucion, true),
          titulo: `Resolucion final · ${this.resultadoMeta()?.label || 'RESUELTO'}`,
          descripcion: resultado.startsWith('FUNDADO')
            ? 'Apelacion amparada. Se ordena entrega de la informacion solicitada.'
            : 'Apelacion desestimada y archivo del expediente.',
          icon: resultado.startsWith('FUNDADO') ? 'check' : 'x'
        }
      ];
    }

    return [
      { fecha: fechaBase, titulo: 'Apelacion presentada', descripcion: 'Recurso recibido y registrado en el Tribunal.', icon: 'check' }
    ];
  }

  private normalizeKey(value?: string | null): string {
    return (value || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
  }

  private formatEstado(value: string): string {
    switch (this.normalizeKey(value)) {
      case 'PENDIENTE_ELEVACION':
        return 'Pendiente de elevacion';
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

  private formatDateLabel(raw?: string, includeTime = false): string {
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
}
