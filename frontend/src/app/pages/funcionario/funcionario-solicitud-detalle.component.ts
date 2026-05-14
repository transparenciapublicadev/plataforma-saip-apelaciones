import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { Solicitud } from '../../models/solicitud.model';
import { canSendManualResponse, isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';

type DetailTabId = 'respuesta' | 'solicitud' | 'ciudadano' | 'adjuntos' | 'historial';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './funcionario-solicitud-detalle.component.html',
  styleUrl: './funcionario-solicitud-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuncionarioSolicitudDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly solicitudService = inject(SolicitudService);

  solicitud = signal<Solicitud | null>(null);
  loading = signal<boolean>(true);
  error = signal<string>('');
  activeTab = signal<DetailTabId>('solicitud');

  readonly tabs = computed<DetailTab[]>(() => {
    const base: DetailTab[] = [
      { id: 'solicitud', label: 'Solicitud' },
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

    if (sol.apelacion?.expediente) {
      items.push({
        accion: `Apelación presentada · ${this.getEstadoDisplay(sol.apelacion.estado || '')}`,
        fecha: sol.apelacion.fechaApelacion,
        responsable: 'Ciudadano recurrente',
        detalle: 'El expediente fue elevado para revisión del TTAIP.',
        color: 'violet'
      });
    }

    return items;
  });

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
        this.activeTab.set(this.puedeVerRespuesta() ? 'respuesta' : 'solicitud');
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
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
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
}
