import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAlertTriangle,
  LucideArrowLeft,
  LucideCheckCircle2,
  LucideClock,
  LucideEye,
  LucideInbox,
  LucideRefreshCw,
  LucideShieldCheck,
  LucideXCircle
} from '@lucide/angular';
import { TtaipService } from '../../services/ttaip.service';
import { AuthService } from '../../services/auth.service';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

export type EstadoCumplimiento =
  | 'pendiente'
  | 'cumplido'
  | 'vencido'
  | 'observado'
  | 'reiterado'
  | 'cerrado';

export interface CumplimientoItem {
  id: string;
  expedienteTTAIP: string;
  expedienteSAIP: string;
  entidad: string;
  fechaResolucion?: string;
  fechaLimite?: string;
  fechaCumplimiento?: string;
  estado: EstadoCumplimiento;
  resultado?: string;
  observaciones?: string;
}

export interface AccionTribunal {
  estado: EstadoCumplimiento;
  label: string;
  iconName: string;
  tone: string;
}

@Component({
  selector: 'app-compliance-tracking',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    StatusBadgeComponent,
    LucideArrowLeft,
    LucideClock,
    LucideCheckCircle2,
    LucideAlertTriangle,
    LucideInbox,
    LucideShieldCheck,
    LucideRefreshCw,
    LucideXCircle,
    LucideEye
  ],
  templateUrl: './compliance-tracking.component.html',
  styleUrl: './compliance-tracking.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplianceTrackingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly ttaipService = inject(TtaipService);
  private readonly authService = inject(AuthService);

  readonly acciones: AccionTribunal[] = [
    { estado: 'cumplido',  label: 'Marcar como cumplido',   iconName: 'check-circle-2', tone: 'var(--success)' },
    { estado: 'observado', label: 'Observar el cumplimiento', iconName: 'alert-triangle', tone: 'var(--warning)' },
    { estado: 'reiterado', label: 'Reiterar a la entidad',    iconName: 'refresh-cw',    tone: 'var(--info)' },
    { estado: 'cerrado',   label: 'Cerrar el seguimiento',    iconName: 'shield-check',  tone: 'var(--brand-700)' }
  ];

  readonly estadoLabels: Record<EstadoCumplimiento, string> = {
    pendiente: 'Pendiente',
    cumplido: 'Cumplido',
    vencido: 'Vencido',
    observado: 'Observado',
    reiterado: 'Reiterado',
    cerrado: 'Cerrado'
  };

  // Estados reactivos
  items = signal<CumplimientoItem[]>([]);
  cargando = signal<boolean>(true);
  selId = signal<string | null>(null);
  observacionesInput = signal<string>('');
  toastMensaje = signal<string | null>(null);

  // Elemento seleccionado computado
  sel = computed<CumplimientoItem | null>(() => {
    const list = this.items();
    const id = this.selId();
    if (!list.length) return null;
    return list.find(i => i.id === id) ?? list[0];
  });

  // Indicadores computados
  resumen = computed(() => {
    const list = this.items();
    return {
      pendientes: list.filter(i => i.estado === 'pendiente' || i.estado === 'observado' || i.estado === 'reiterado').length,
      vencidos: list.filter(i => i.estado === 'vencido').length,
      cumplidos: list.filter(i => i.estado === 'cumplido' || i.estado === 'cerrado').length
    };
  });

  ngOnInit(): void {
    this.authService.obtenerSesion();
    this.cargarSeguimientos();
  }

  cargarSeguimientos(): void {
    this.cargando.set(true);

    // Intentar cargar apelaciones resueltas con resultado fundado
    this.ttaipService.getResueltas().subscribe({
      next: (apelaciones) => {
        const mapped: CumplimientoItem[] = apelaciones
          .filter(a => (a.resolucion && (a.resolucion.decision === 'FUNDADO' || a.resolucion.decision === 'FUNDADO_EN_PARTE')) || /fundad/i.test(a.resultado || ''))
          .map((a, idx) => ({
            id: String(a.id || idx + 1),
            expedienteTTAIP: a.expediente || `0012${idx}-2026-JUS/TTAIP`,
            expedienteSAIP: a.solicitudExpediente || `SAIP-2026-000${10 + idx}`,
            entidad: a.entidadNombre || 'Ministerio de Educación - MINEDU',
            fechaResolucion: a.resolucion?.fechaResolucion ? a.resolucion.fechaResolucion.slice(0, 10) : '28/08/2026',
            fechaLimite: this.calcularFechaLimite7Dias(a.resolucion?.fechaResolucion),
            estado: (idx === 1 ? 'vencido' : idx === 2 ? 'cumplido' : 'pendiente') as EstadoCumplimiento,
            resultado: a.resolucion?.decision || a.resultado || 'FUNDADA',
            observaciones: a.resolucion?.observaciones || 'Se ordenó a la entidad la entrega de los informes y anexos requeridos por el administrado.'
          }));

        if (mapped.length > 0) {
          this.items.set(mapped);
          this.selId.set(mapped[0].id);
        } else {
          this.cargarMocksDemo();
        }
        this.cargando.set(false);
      },
      error: () => {
        this.cargarMocksDemo();
        this.cargando.set(false);
      }
    });
  }

  private cargarMocksDemo(): void {
    const demoItems: CumplimientoItem[] = [
      {
        id: '1',
        expedienteTTAIP: '00124-2026-JUS/TTAIP',
        expedienteSAIP: 'SAIP-2026-00012',
        entidad: 'Ministerio de Educación - MINEDU',
        fechaResolucion: '28/08/2026',
        fechaLimite: '08/09/2026',
        estado: 'pendiente',
        resultado: 'FUNDADA',
        observaciones: 'Se ordenó a la entidad la entrega completa del informe técnico de contrataciones periodo 2025-2026 en copia simple gratuita.'
      },
      {
        id: '2',
        expedienteTTAIP: '00098-2026-JUS/TTAIP',
        expedienteSAIP: 'SAIP-2026-00004',
        entidad: 'Municipalidad Metropolitana de Lima',
        fechaResolucion: '15/08/2026',
        fechaLimite: '26/08/2026',
        estado: 'vencido',
        resultado: 'FUNDADA EN PARTE',
        observaciones: 'Venció el plazo legal de 7 días hábiles sin que la entidad acredite el traslado de la documentación ordenada al administrado.'
      },
      {
        id: '3',
        expedienteTTAIP: '00085-2026-JUS/TTAIP',
        expedienteSAIP: 'SAIP-2026-00002',
        entidad: 'Superintendencia Nacional de Salud - SUSALUD',
        fechaResolucion: '10/08/2026',
        fechaLimite: '21/08/2026',
        fechaCumplimiento: '19/08/2026',
        estado: 'cumplido',
        resultado: 'FUNDADA',
        observaciones: 'La entidad remitió con Oficio N.° 0422-2026-SUSALUD la constancia de notificación y acuse de recepción firmada por el recurrente.'
      },
      {
        id: '4',
        expedienteTTAIP: '00072-2026-JUS/TTAIP',
        expedienteSAIP: 'SAIP-2026-00001',
        entidad: 'Seguro Social de Salud - EsSalud',
        fechaResolucion: '02/08/2026',
        fechaLimite: '13/08/2026',
        estado: 'reiterado',
        resultado: 'FUNDADA',
        observaciones: 'Se emitió cédula de reiteración con apercibimiento de inicio de procedimiento disciplinario sancionador al funcionario responsable.'
      }
    ];

    this.items.set(demoItems);
    this.selId.set(demoItems[0].id);
  }

  private calcularFechaLimite7Dias(fechaBaseIso?: string | null): string {
    const base = fechaBaseIso ? new Date(fechaBaseIso) : new Date();
    let added = 0;
    const cur = new Date(base);
    while (added < 7) {
      cur.setDate(cur.getDate() + 1);
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return cur.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  seleccionarItem(id: string): void {
    this.selId.set(id);
    this.observacionesInput.set('');
  }

  actualizarEstado(nuevoEstado: EstadoCumplimiento): void {
    const actual = this.sel();
    if (!actual) return;

    const obs = this.observacionesInput().trim();
    const hoyStr = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    this.items.update(list =>
      list.map(item => {
        if (item.id === actual.id) {
          return {
            ...item,
            estado: nuevoEstado,
            fechaCumplimiento: nuevoEstado === 'cumplido' ? hoyStr : item.fechaCumplimiento,
            observaciones: obs
              ? `${item.observaciones ? item.observaciones + '\n\n' : ''}[${hoyStr} - ${this.estadoLabels[nuevoEstado]}]: ${obs}`
              : item.observaciones
          };
        }
        return item;
      })
    );

    this.observacionesInput.set('');
    this.mostrarToast(`Seguimiento actualizado: ${this.estadoLabels[nuevoEstado]}`);
  }

  mostrarToast(msg: string): void {
    this.toastMensaje.set(msg);
    setTimeout(() => {
      this.toastMensaje.set(null);
    }, 3500);
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
