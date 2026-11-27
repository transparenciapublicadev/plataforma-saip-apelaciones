import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideBuilding2, LucideCheckCircle2, LucidePencil } from '@lucide/angular';
import { Solicitud } from '../models/solicitud.model';
import { SolicitudService } from '../services/solicitud.service';
import { problemDetailsMessage } from '../utils/problem-details.util';

const AREAS_COMUNES = [
  'Secretaría General',
  'Oficina de Administración',
  'Oficina de Asesoría Jurídica',
  'Oficina de Planeamiento y Presupuesto',
  'Oficina de Recursos Humanos',
  'Oficina de Tecnologías de la Información',
  'Órgano de Control Institucional',
];
const AREAS_POR_ENTIDAD: { claves: string[]; areas: string[] }[] = [
  {
    claves: ['osinergmin', 'organismo supervisor de la inversion en energia y mineria'],
    areas: ['Gerencia de Fiscalización Eléctrica', 'Gerencia de Supervisión Minera', 'Gerencia de Supervisión de Energía', 'Gerencia de Regulación de Tarifas', 'Gerencia de Atención al Ciudadano', ...AREAS_COMUNES],
  },
  {
    claves: ['minsa', 'ministerio de salud'],
    areas: ['Dirección General de Intervenciones Estratégicas en Salud Pública', 'Dirección General de Medicamentos, Insumos y Drogas', 'Dirección General de Operaciones en Salud', 'Oficina General de Comunicaciones', ...AREAS_COMUNES],
  },
  {
    claves: ['minedu', 'ministerio de educacion'],
    areas: ['Dirección General de Educación Básica Regular', 'Dirección General de Calidad de la Gestión Escolar', 'Programa Nacional de Infraestructura Educativa', ...AREAS_COMUNES],
  },
];

function normalizar(valor: string): string {
  return valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function fechaVisible(valor: string | null | undefined): string {
  if (!valor) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : valor;
}

@Component({
  selector: 'app-area-responsable-panel',
  imports: [FormsModule, LucideBuilding2, LucideCheckCircle2, LucidePencil],
  templateUrl: './area-responsable-panel.component.html',
  styleUrl: './area-responsable-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AreaResponsablePanelComponent {
  private readonly solicitudService = inject(SolicitudService);

  readonly expediente = input.required<string>();
  readonly entidad = input<string | null>(null);
  readonly solicitudId = input<number | null>(null);
  readonly readOnly = input(false);
  readonly oficinaIndicada = input<string | null | undefined>(null);
  readonly areaGuardada = input<string | null | undefined>(null);
  readonly encargadoGuardado = input<string | null | undefined>(null);
  readonly fechaGuardada = input<string | null | undefined>(null);
  readonly guardada = output<Solicitud>();

  readonly editando = signal(false);
  readonly guardando = signal(false);
  readonly aviso = signal('');
  readonly error = signal('');
  private readonly confirmada = signal<{ area: string; responsable: string; fecha: string } | null>(null);
  area = '';
  responsable = '';

  readonly sigla = computed(() => {
    const nombre = this.entidad()?.trim();
    if (!nombre) return 'la entidad';
    const clave = normalizar(nombre);
    if (clave.includes('minedu') || clave.includes('ministerio de educacion')) return 'MINEDU';
    if (clave.includes('minsa') || clave.includes('ministerio de salud')) return 'MINSA';
    if (clave.includes('osinergmin')) return 'OSINERGMIN';
    return nombre;
  });

  readonly areas = computed(() => {
    const clave = normalizar(this.entidad() ?? '');
    const grupo = AREAS_POR_ENTIDAD.find(item => item.claves.some(alias => clave.includes(alias)));
    const base = grupo?.areas ?? AREAS_COMUNES;
    const actual = this.areaGuardada()?.trim();
    return actual && !base.includes(actual) ? [actual, ...base] : base;
  });

  readonly asignada = computed(() => {
    const local = this.confirmada();
    if (local) return local;
    const area = this.areaGuardada()?.trim();
    if (!area) return null;
    return {
      area,
      responsable: this.encargadoGuardado()?.trim() ?? '',
      fecha: fechaVisible(this.fechaGuardada()),
    };
  });

  readonly mostrarFormulario = computed(() => !this.readOnly() && (!this.asignada() || this.editando()));

  constructor() {
    effect(() => {
      const area = this.areaGuardada() ?? '';
      const encargado = this.encargadoGuardado() ?? '';
      untracked(() => {
        this.confirmada.set(null);
        this.editando.set(false);
        this.error.set('');
        this.aviso.set('');
        this.area = area;
        this.responsable = encargado;
      });
    });
  }

  abrir(): void {
    this.area = this.areaGuardada() ?? this.asignada()?.area ?? '';
    this.responsable = this.encargadoGuardado() ?? this.asignada()?.responsable ?? '';
    this.error.set('');
    this.editando.set(true);
  }

  cancelar(): void {
    this.area = this.asignada()?.area ?? '';
    this.responsable = this.asignada()?.responsable ?? '';
    this.error.set('');
    this.editando.set(false);
  }

  guardar(event: Event): void {
    event.preventDefault();
    if (this.guardando()) return;
    const area = this.area.trim();
    if (!area) {
      this.error.set('Elija el área que tiene la información.');
      return;
    }
    const id = this.solicitudId();
    if (!id) {
      this.error.set('No se puede guardar el área porque la solicitud no está identificada.');
      return;
    }
    this.error.set('');
    this.guardando.set(true);
    const encargado = this.responsable.trim();
    this.solicitudService.asignarArea(id, { area, encargado: encargado || undefined }).subscribe({
      next: solicitud => {
        this.guardando.set(false);
        this.editando.set(false);
        this.confirmada.set({
          area: solicitud.areaResponsable?.trim() || area,
          responsable: solicitud.encargadoArea?.trim() ?? encargado,
          fecha: fechaVisible(solicitud.fechaAsignacionArea),
        });
        this.aviso.set(`Área registrada: ${solicitud.areaResponsable?.trim() || area}.`);
        this.guardada.emit(solicitud);
      },
      error: err => {
        this.guardando.set(false);
        this.error.set(problemDetailsMessage(err, 'No se pudo registrar el área responsable.'));
      },
    });
  }
}
