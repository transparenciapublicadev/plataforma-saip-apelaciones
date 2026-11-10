import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  signal,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  LucideCalendar, LucideClock, LucideScale, LucideGavel,
  LucideReceipt, LucideHistory, LucideSave, LucideRotateCcw,
  LucideTrash2, LucideInfo, LucideCalculator, LucideEye,
  LucideEyeOff, LucideAlertTriangle, LucideCheckCircle2, LucidePlus
} from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { EntidadService } from '../../services/entidad.service';
import { Entidad } from '../../models/entidad.model';
import {
  CalendarioConfig,
  Feriado,
  PlazoClave,
  TipoInhabil,
  PLAZOS_META,
  PLAZO_META_POR_CLAVE,
  configPorDefecto,
  normalizarCalendario,
  inhabilesDelAnio,
  hoyLima,
  aDMY,
  fechaLarga,
  sumarDias,
  diaSemana,
  feriadosPorDefecto,
  esHabil,
  sumarHabiles
} from '../../models/calendario.model';

export const TIPO_LABEL: Record<TipoInhabil, string> = {
  feriado: 'Feriado nacional',
  no_laborable: 'Día no laborable (sector público)',
  suspension: 'Suspensión de plazos'
};

export const TIPO_COLOR: Record<TipoInhabil, string> = {
  feriado: 'var(--brand-700)',
  no_laborable: 'var(--gold-dark)',
  suspension: '#6D28D9'
};

export const NATURALEZA: Record<string, { label: string; color: string }> = {
  legal: { label: 'Legal', color: 'var(--brand-700)' },
  operativo: { label: 'Operativo', color: 'var(--info)' },
  umbral: { label: 'Umbral', color: 'var(--gold-dark)' }
};

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function nuevoId(): string {
  return `adm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

@Component({
  selector: 'app-admin-plazos-calendario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    LucideCalendar,
    LucideClock,
    LucideScale,
    LucideGavel,
    LucideReceipt,
    LucideHistory,
    LucideSave,
    LucideRotateCcw,
    LucideTrash2,
    LucideInfo,
    LucideCalculator,
    LucideEye,
    LucideEyeOff,
    LucideAlertTriangle,
    LucideCheckCircle2,
    LucidePlus
  ],
  templateUrl: './admin-plazos-calendario.component.html',
  styleUrl: './admin-plazos-calendario.component.css'
})
export class AdminPlazosCalendarioComponent implements OnInit {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly entidadService = inject(EntidadService);
  private readonly apiUrl = `${environment.apiUrl}/calendario`;
  private readonly STORAGE_KEY = 'saip.admin.calendario';

  readonly mesesNombres = MESES;
  readonly diasNombres = DIAS;
  readonly plazosMeta = PLAZOS_META;
  readonly tipoLabels = TIPO_LABEL;
  readonly tipoColors = TIPO_COLOR;
  readonly naturalezaMap = NATURALEZA;

  obtenerTipoLabel(tipo: any): string {
    return (this.tipoLabels as Record<string, string>)[String(tipo)] || String(tipo);
  }

  obtenerTipoColor(tipo: any): string {
    return (this.tipoColors as Record<string, string>)[String(tipo)] || 'var(--brand-600)';
  }

  // Estado del calendario
  readonly hoy = hoyLima();
  readonly anio = signal<number>(Number(hoyLima().slice(0, 4)));
  readonly aniosDisponibles = computed<number[]>(() => {
    const y = this.anio();
    return [y - 1, y, y + 1, y + 2];
  });

  readonly cal = signal<CalendarioConfig>(configPorDefecto());
  readonly guardado = signal<CalendarioConfig>(configPorDefecto());
  readonly norma = signal<string>('');
  readonly guardando = signal<boolean>(false);
  readonly mensajeExito = signal<string | null>(null);
  readonly mensajeError = signal<string | null>(null);

  // Formulario de alta
  readonly formTipo = signal<TipoInhabil>('no_laborable');
  readonly formNombre = signal<string>('');
  readonly formFecha = signal<string>('');
  readonly formHasta = signal<string>('');
  readonly formRecurrente = signal<boolean>(false);
  readonly formBaseLegal = signal<string>('');

  // Ámbito de suspensión
  readonly ambito = signal<'nacional' | 'entidades'>('nacional');
  readonly entidadesSel = signal<{ id: string; nombre: string }[]>([]);
  readonly buscaEntidad = signal<string>('');
  readonly catalogo = signal<Entidad[]>([]);

  // Simulador
  readonly simInicio = signal<string>(hoyLima());
  readonly simClave = signal<PlazoClave>('SAIP_ATENCION');

  // Cálculos reactivos
  readonly dias = computed(() => inhabilesDelAnio(this.anio(), this.cal()));
  readonly porFecha = computed(() => new Map(this.dias().map((d) => [d.fecha, d])));

  readonly habilesAnio = computed(() => {
    const y = this.anio();
    const c = this.cal();
    let n = 0;
    for (let d = `${y}-01-01`; d <= `${y}-12-31`; d = sumarDias(d, 1)) {
      if (esHabil(d, c)) n++;
    }
    return n;
  });

  readonly listaAnio = computed(() => {
    const y = this.anio();
    return this.cal().feriados
      .filter((f) => f.recurrente || (f.fecha && (f.fecha.startsWith(`${y}-`) || (f.hasta ?? '').startsWith(`${y}-`))))
      .sort((a, b) =>
        (a.recurrente ? `${y}-${a.mmdd}` : a.fecha ?? '').localeCompare(
          b.recurrente ? `${y}-${b.mmdd}` : b.fecha ?? ''
        )
      );
  });

  readonly moviles = computed(() => this.dias().filter((d) => d.movil));

  readonly entidadesFiltradas = computed(() => {
    const q = this.buscaEntidad().trim().toLowerCase();
    const list = this.catalogo();
    if (!q) return list.slice(0, 50);
    return list
      .filter(
        (e) =>
          e.nombre.toLowerCase().includes(q) ||
          (e.acronimo ?? '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  });

  readonly fechaFinDeSemana = computed(() => {
    const f = this.formFecha();
    return !!f && [0, 6].includes(diaSemana(f));
  });

  readonly cambiosLegales = computed(() => {
    const c = this.cal();
    const g = this.guardado();
    return PLAZOS_META.filter((m) => {
      if (m.naturaleza !== 'legal') return false;
      const v = c.plazos[m.clave] ?? m.porDefecto;
      const gv = g.plazos[m.clave] ?? m.porDefecto;
      return v !== gv;
    });
  });

  readonly sucio = computed(() => {
    const c = { ...this.cal(), historial: [] };
    const g = { ...this.guardado(), historial: [] };
    return JSON.stringify(c) !== JSON.stringify(g);
  });

  readonly simMeta = computed(() => PLAZO_META_POR_CLAVE[this.simClave()]);

  readonly simVence = computed<string | null>(() => {
    const ini = this.simInicio();
    if (!ini) return null;
    const meta = this.simMeta();
    const c = this.cal();
    const dias = c.plazos[this.simClave()] ?? meta.porDefecto;
    return meta.unidad === 'calendario'
      ? sumarDias(ini, dias)
      : sumarHabiles(ini, dias, c);
  });

  readonly simVenceLargo = computed<string>(() => {
    const v = this.simVence();
    return v ? fechaLarga(v) : '—';
  });

  ngOnInit(): void {
    this.cargarCatalogoEntidades();
    this.cargarCalendario();
  }

  cargarCatalogoEntidades(): void {
    if (this.entidadService && typeof this.entidadService.findActivas === 'function') {
      this.entidadService.findActivas().subscribe({
        next: (list) => this.catalogo.set(list),
        error: () => {
          if (typeof this.entidadService.findAll === 'function') {
            this.entidadService.findAll().subscribe({
              next: (list) => this.catalogo.set(list),
              error: () => {}
            });
          }
        }
      });
    } else if (this.entidadService && typeof this.entidadService.findAll === 'function') {
      this.entidadService.findAll().subscribe({
        next: (list) => this.catalogo.set(list),
        error: () => {}
      });
    }
  }

  cargarCalendario(): void {
    // 1. Cargar almacenamiento local si existe
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const norm = normalizarCalendario(parsed);
          this.guardado.set(norm);
          this.cal.set(norm);
        }
      } catch {}
    }

    // 2. Sincronizar desde backend
    if (this.http) {
      this.http.get<CalendarioConfig>(this.apiUrl).subscribe({
        next: (data) => {
          if (data && typeof data === 'object') {
            const norm = normalizarCalendario(data);
            this.guardado.set(norm);
            this.cal.set(norm);
            if (typeof localStorage !== 'undefined') {
              try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(norm));
              } catch {}
            }
          }
        },
        error: () => {}
      });
    }
  }

  conteoTipo(t: TipoInhabil): number {
    return this.dias().filter(
      (d) => d.tipo === t && [1, 2, 3, 4, 5].includes(diaSemana(d.fecha))
    ).length;
  }

  setAnio(v: string | number): void {
    this.anio.set(Number(v));
  }

  seleccionarFechaEnGrid(iso: string): void {
    this.formFecha.set(iso);
    this.mensajeError.set(null);
    const inhabil = this.porFecha().get(iso);
    if (inhabil) {
      this.formNombre.set(inhabil.nombre);
      this.formTipo.set(inhabil.tipo);
      if (inhabil.baseLegal) {
        this.formBaseLegal.set(inhabil.baseLegal);
      }
    } else {
      this.formNombre.set('');
    }
  }

  alternarEntidad(e: Entidad): void {
    const sel = this.entidadesSel();
    const id = String(e.id);
    if (sel.some((x) => x.id === id)) {
      this.entidadesSel.set(sel.filter((x) => x.id !== id));
    } else {
      this.entidadesSel.set([...sel, { id, nombre: e.nombre }]);
    }
  }

  estaEntidadSeleccionada(id: string | number): boolean {
    return this.entidadesSel().some((x) => x.id === String(id));
  }

  agregar(): void {
    const nombre = this.formNombre().trim();
    const fecha = this.formFecha();
    const tipo = this.formTipo();
    const hasta = this.formHasta();
    const recurrente = tipo === 'feriado' && this.formRecurrente();

    if (!nombre || !fecha) {
      this.mostrarError('Indique el nombre y la fecha del día inhábil.');
      return;
    }
    if (tipo === 'suspension' && hasta && hasta < fecha) {
      this.mostrarError('La fecha final no puede ser anterior a la inicial.');
      return;
    }
    if (recurrente && fecha.slice(5) === '02-29') {
      this.mostrarError('Un feriado recurrente no puede caer el 29 de febrero.');
      return;
    }

    const limitada = tipo === 'suspension' && this.ambito() === 'entidades';
    if (limitada && this.entidadesSel().length === 0) {
      this.mostrarError('Seleccione al menos una entidad afectada por la suspensión.');
      return;
    }

    const c = this.cal();
    const dup = !limitada && c.feriados.some((f) =>
      f.activo &&
      !f.entidades?.length &&
      (recurrente
        ? f.recurrente && f.mmdd === fecha.slice(5)
        : !f.recurrente && f.fecha === fecha)
    );
    if (dup) {
      this.mostrarError('Ya existe un día inhábil registrado en esa fecha.');
      return;
    }

    const f: Feriado = {
      id: nuevoId(),
      nombre,
      tipo,
      recurrente,
      ...(recurrente
        ? { mmdd: fecha.slice(5) }
        : { fecha, ...(tipo === 'suspension' && hasta ? { hasta } : {}) }),
      ...(limitada ? { entidades: this.entidadesSel() } : {}),
      baseLegal: this.formBaseLegal().trim() || undefined,
      activo: true,
      origen: 'admin'
    };

    this.cal.update((curr) => ({
      ...curr,
      feriados: [...curr.feriados, f]
    }));

    // Reset form
    this.formNombre.set('');
    this.formFecha.set('');
    this.formHasta.set('');
    this.formBaseLegal.set('');
    this.entidadesSel.set([]);
    this.mostrarExito('Día inhábil agregado al borrador. Guarde los cambios para aplicar.');
  }

  alternarFeriado(id: string): void {
    this.cal.update((curr) => ({
      ...curr,
      feriados: curr.feriados.map((f) =>
        f.id === id ? { ...f, activo: !f.activo } : f
      )
    }));
  }

  quitarFeriado(id: string): void {
    this.cal.update((curr) => ({
      ...curr,
      feriados: curr.feriados.filter((f) => f.id !== id)
    }));
  }

  restaurarNacionales(): void {
    const base = feriadosPorDefecto();
    this.cal.update((curr) => ({
      ...curr,
      semanaSanta: true,
      feriados: [...base, ...curr.feriados.filter((f) => f.origen === 'admin')]
    }));
    this.mostrarExito('Feriados nacionales restablecidos en el borrador.');
  }

  setSemanaSanta(checked: boolean): void {
    this.cal.update((curr) => ({
      ...curr,
      semanaSanta: checked
    }));
  }

  valorPlazo(k: PlazoClave): number {
    return this.cal().plazos[k] ?? PLAZO_META_POR_CLAVE[k].porDefecto;
  }

  valorGuardado(k: PlazoClave): number {
    return this.guardado().plazos[k] ?? PLAZO_META_POR_CLAVE[k].porDefecto;
  }

  setPlazo(k: PlazoClave, raw: string): void {
    const m = PLAZO_META_POR_CLAVE[k];
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return;

    this.cal.update((curr) => {
      const plazos = { ...curr.plazos };
      if (n === m.porDefecto) {
        delete plazos[k];
      } else {
        plazos[k] = Math.min(m.max, Math.max(m.min, n));
      }
      return { ...curr, plazos };
    });
  }

  actualizarTarifa(k: 'copiaSimple' | 'copiaCertificada' | 'soporteDigital', val: string): void {
    const n = Math.max(0, Number(val) || 0);
    this.cal.update((curr) => ({
      ...curr,
      tarifas: { ...curr.tarifas, [k]: n }
    }));
  }

  describirCambios(): string {
    const partes: string[] = [];
    const guard = this.guardado();
    const curr = this.cal();
    const antes = new Map(guard.feriados.map((f) => [f.id, f]));

    for (const f of curr.feriados) {
      const a = antes.get(f.id);
      if (!a) {
        partes.push(`Agrega ${TIPO_LABEL[f.tipo].toLowerCase()}: ${f.nombre}`);
      } else if (a.activo !== f.activo) {
        partes.push(`${f.activo ? 'Activa' : 'Desactiva'}: ${f.nombre}`);
      }
    }
    for (const a of guard.feriados) {
      if (!curr.feriados.some((f) => f.id === a.id)) {
        partes.push(`Elimina: ${a.nombre}`);
      }
    }
    if (curr.semanaSanta !== guard.semanaSanta) {
      partes.push(`Semana Santa automática: ${curr.semanaSanta ? 'sí' : 'no'}`);
    }
    for (const m of PLAZOS_META) {
      const cv = this.valorPlazo(m.clave);
      const gv = this.valorGuardado(m.clave);
      if (cv !== gv) {
        partes.push(`${m.etiqueta}: ${gv} -> ${cv} días`);
      }
    }
    const t = curr.tarifas, g = guard.tarifas;
    if (t.copiaSimple !== g.copiaSimple || t.copiaCertificada !== g.copiaCertificada || t.soporteDigital !== g.soporteDigital) {
      partes.push('Actualiza tarifas de reproducción');
    }
    return partes.join(' · ') || 'Sin cambios';
  }

  guardar(): void {
    if (this.cambiosLegales().length > 0 && !this.norma().trim()) {
      this.mostrarError('Indique la norma que sustenta el cambio de un plazo legal.');
      return;
    }

    this.guardando.set(true);
    const ahora = new Date().toISOString();
    const nuevo: CalendarioConfig = {
      ...this.cal(),
      historial: [
        {
          fecha: ahora,
          detalle: this.describirCambios(),
          norma: this.norma().trim() || undefined
        },
        ...this.guardado().historial
      ].slice(0, 100),
      actualizado: { fecha: ahora }
    };
    this.cal.set(nuevo);

    if (this.http) {
      this.http.put<CalendarioConfig>(this.apiUrl, nuevo).subscribe({
        next: (saved) => {
          const vigente = normalizarCalendario(saved || nuevo);
          if (nuevo.historial?.length && (!vigente.historial || vigente.historial.length === 0)) {
            vigente.historial = nuevo.historial;
          }
          this.guardado.set(vigente);
          this.cal.set(vigente);
          this.norma.set('');
          this.guardando.set(false);
          this.persistirLocal(vigente);
          this.mostrarExito('Calendario y plazos oficiales actualizados y vigentes.');
        },
        error: () => {
          // Si el servidor falla o no responde, persistimos localmente
          const vigente = normalizarCalendario(nuevo);
          this.guardado.set(vigente);
          this.cal.set(vigente);
          this.norma.set('');
          this.guardando.set(false);
          this.persistirLocal(vigente);
          this.mostrarExito('Cambios aplicados localmente en esta sesión.');
        }
      });
    } else {
      const vigente = normalizarCalendario(nuevo);
      this.guardado.set(vigente);
      this.cal.set(vigente);
      this.norma.set('');
      this.guardando.set(false);
      this.persistirLocal(vigente);
      this.mostrarExito('Calendario guardado localmente.');
    }
  }

  descartar(): void {
    this.cal.set(this.guardado());
    this.norma.set('');
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
  }

  private persistirLocal(cfg: CalendarioConfig): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cfg));
      } catch {}
    }
  }

  private mostrarExito(msg: string): void {
    this.mensajeExito.set(msg);
    this.mensajeError.set(null);
    setTimeout(() => this.mensajeExito.set(null), 5000);
  }

  private mostrarError(msg: string): void {
    this.mensajeError.set(msg);
    this.mensajeExito.set(null);
    setTimeout(() => this.mensajeError.set(null), 6000);
  }

  obtenerDiasDelMes(mi: number): { iso: string; dia: number; inhabil?: any; esFinde: boolean; esHoy: boolean }[] {
    const y = this.anio();
    const diasMes = new Date(Date.UTC(y, mi + 1, 0)).getUTCDate();
    const res = [];
    const porF = this.porFecha();

    for (let i = 1; i <= diasMes; i++) {
      const iso = `${y}-${String(mi + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const ih = porF.get(iso);
      const dw = diaSemana(iso);
      const esFinde = dw === 0 || dw === 6;
      const esHoy = iso === this.hoy;
      res.push({ iso, dia: i, inhabil: ih, esFinde, esHoy });
    }
    return res;
  }

  obtenerOffsetDelMes(mi: number): number {
    const y = this.anio();
    const primero = `${y}-${String(mi + 1).padStart(2, '0')}-01`;
    return (diaSemana(primero) + 6) % 7;
  }

  crearArray(len: number): number[] {
    return Array.from({ length: Math.max(0, len) }, (_, i) => i);
  }

  formatearFechaCorta(f?: string): string {
    return aDMY(f);
  }
}
