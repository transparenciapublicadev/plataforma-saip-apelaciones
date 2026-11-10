import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, of, Subscription, switchMap } from 'rxjs';
import {
  LucideArrowLeft,
  LucideFileChartColumn,
  LucideCalendarRange,
  LucideAlertTriangle,
  LucideInfo,
  LucideFileText,
  LucideLayers,
  LucideHistory,
  LucideSave,
  LucideDownload,
  LucideSearch,
} from '@lucide/angular';
import { AuthService } from '../../services/auth.service';
import { BorradorInstitucional, FilaReporte, GuardarBorrador, ModoReporte, PaginaReporte, ReportesInstitucionalesService, ResumenInstitucional } from '../../services/reportes-institucionales.service';
import { csvPagina, descargarBorradorPdf, descargarBorradorExcel, guardarArchivo } from './reportes-institucionales.export';

type Estado = 'carga' | 'listo' | 'error';
type Tab = 'resumen' | 'informe' | 'detalle' | 'historial';
interface Campo { key: string; label: string; ayuda?: string; largo?: boolean; numerico?: boolean; }
@Component({
  selector: 'app-reportes-institucionales', standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideArrowLeft,
    LucideFileChartColumn,
    LucideCalendarRange,
    LucideAlertTriangle,
    LucideInfo,
    LucideFileText,
    LucideLayers,
    LucideHistory,
    LucideSave,
    LucideDownload,
    LucideSearch,
  ],
  templateUrl: './reportes-institucionales.component.html', styleUrl: './reportes-institucionales.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportesInstitucionalesComponent {
  private readonly api = inject(ReportesInstitucionalesService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly modo: ModoReporte = this.route.snapshot.data['reportMode'] === 'ttaip' ? 'ttaip' : 'entidad';
  readonly panel = this.modo === 'entidad' ? '/funcionario' : '/ttaip';
  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'resumen', label: 'Resumen' }, { id: 'informe', label: 'Informe' },
    { id: 'detalle', label: 'Detalle' }, { id: 'historial', label: 'Historial' },
  ];
  readonly tab = signal<Tab>('resumen');
  readonly estado = signal<Estado>('carga');
  readonly error = signal('');
  readonly resumen = signal<ResumenInstitucional | null>(null);
  readonly detalle = signal<PaginaReporte<FilaReporte> | null>(null);
  readonly historial = signal<PaginaReporte<BorradorInstitucional> | null>(null);
  readonly borrador = signal<BorradorInstitucional | null>(null);
  readonly guardando = signal(false);
  readonly incierto = signal(false);
  readonly aviso = signal('');
  readonly exportando = signal(false);
  readonly detalleCarga = signal(false);
  readonly detalleError = signal('');
  readonly historialError = signal('');
  readonly historialCarga = signal(false);
  readonly campos: Campo[] = this.modo === 'entidad' ? [
    { key: 'frasaiNombre', label: 'Nombre completo del responsable (FRASAI)' }, { key: 'frasaiCargo', label: 'Cargo' },
    { key: 'frasaiDesignacion', label: 'Documento de designación', ayuda: 'Referencia declarada; no acredita firma ni valida la designación.' },
    { key: 'factores', label: 'Factores que afectaron la atención', largo: true }, { key: 'factoresOtros', label: 'Otros factores', largo: true },
    { key: 'buenasPracticas', label: 'Buenas prácticas implementadas', largo: true }, { key: 'necesidades', label: 'Necesidades institucionales', largo: true },
    { key: 'denunciasRecibidas', label: 'Denuncias recibidas fuera de la plataforma', numerico: true },
    { key: 'comunicacionesSTPAD', label: 'Comunicaciones a la STPAD declaradas', numerico: true },
    { key: 'pasInstaurados', label: 'PAS instaurados declarados', numerico: true }, { key: 'observaciones', label: 'Observaciones adicionales', largo: true },
  ] : [
    { key: 'responsable', label: 'Responsable del informe' }, { key: 'cargo', label: 'Cargo' },
    { key: 'conclusiones', label: 'Conclusiones del periodo', largo: true }, { key: 'recomendaciones', label: 'Recomendaciones', largo: true },
  ];
  cualitativo: Record<string, string> = {};
  desde = `${new Date().getFullYear()}-01-01`;
  hasta = `${new Date().getFullYear()}-12-31`;
  busqueda = '';
  filtro = '';
  get titulo(): string {
    if (this.modo === 'entidad') {
      const entidad = this.resumen()?.entidad || this.auth.obtenerSesion()?.entidadNombre;
      return entidad ? `Informe de solicitudes · ${entidad}` : 'Informe SAIP de la entidad';
    }
    return 'Informe estadístico del Tribunal';
  }
  readonly maxMes = computed(() => Math.max(1, ...(this.resumen()?.porMes.map(x => x.cantidad) ?? [])));
  private generation = 0;
  private reads = new Subscription();
  private detailRead?: Subscription;
  private write?: Subscription;
  private recovery?: Subscription;
  private historyRead?: Subscription;
  private operation: GuardarBorrador | null = null;
  private activePeriod = '';
  constructor() {
    effect(() => { this.auth.cambiosSesion(); this.cargar(); });
    inject(DestroyRef).onDestroy(() => this.cancelar());
  }
  private cancelar() {
    this.generation++; this.reads.unsubscribe(); this.reads = new Subscription();
    this.detailRead?.unsubscribe(); this.write?.unsubscribe(); this.recovery?.unsubscribe(); this.historyRead?.unsubscribe();
  }
  private autorizado() {
    return this.auth.estaLogueado() && this.auth.getTipoUsuario() === (this.modo === 'entidad' ? 'FUNCIONARIO' : 'TTAIP');
  }
  cargar() {
    this.cancelar(); const generation = this.generation;
    this.resumen.set(null); this.detalle.set(null); this.historial.set(null); this.borrador.set(null);
    this.cualitativo = {}; this.operation = null; this.incierto.set(false); this.guardando.set(false); this.aviso.set('');
    this.estado.set('carga'); this.error.set(''); this.detalleError.set(''); this.historialError.set('');
    if (!this.autorizado()) { this.estado.set('error'); this.error.set('Inicia sesión con el acceso institucional correspondiente.'); return; }
    if (!this.desde || !this.hasta || this.hasta < this.desde) { this.estado.set('error'); this.error.set('Selecciona un periodo válido.'); return; }
    this.activePeriod = `${this.desde}/${this.hasta}`;
    this.reads.add(forkJoin({
      resumen: this.api.resumen(this.modo, this.desde, this.hasta),
      borrador: this.api.borrador(this.modo, this.desde, this.hasta).pipe(catchError((e: HttpErrorResponse) => { if (e.status === 404) return of(null); throw e; })),
    }).subscribe({ next: data => {
      if (generation !== this.generation) return;
      if (!this.coincide(data.resumen) || (data.borrador && !this.coincide(data.borrador))) { this.estado.set('error'); this.error.set('La respuesta no corresponde al periodo o ámbito seleccionado.'); return; }
      this.resumen.set(data.resumen); this.borrador.set(data.borrador); this.cualitativo = { ...(data.borrador?.cualitativo ?? {}) };
      if (this.modo === 'entidad') {
        const sesion = this.auth.obtenerSesion();
        if (!this.cualitativo['frasaiNombre'] && sesion?.nombre) {
          this.cualitativo['frasaiNombre'] = sesion.nombre;
        }
        if (!this.cualitativo['frasaiCargo']) {
          this.cualitativo['frasaiCargo'] = 'Responsable de Acceso a la Información Pública';
        }
      }
      this.estado.set('listo'); this.consultarDetalle(); this.consultarHistorial();
    }, error: e => { if (generation === this.generation) { this.estado.set('error'); this.error.set(this.mensaje(e)); } } }));
  }
  private coincide(value: { modo: string; desde: string; hasta: string }) { return value.modo === this.modo && `${value.desde}/${value.hasta}` === this.activePeriod; }
  consultarDetalle(page = 0) {
    this.detailRead?.unsubscribe(); this.detalle.set(null); this.detalleError.set(''); this.detalleCarga.set(true);
    const generation = this.generation;
    this.detailRead = this.api.detalle(this.modo, this.desde, this.hasta, page, this.busqueda, this.filtro).subscribe({
      next: data => { if (generation === this.generation) { this.detalle.set(data); this.detalleCarga.set(false); } },
      error: e => { if (generation === this.generation) { this.detalleError.set(this.mensaje(e)); this.detalleCarga.set(false); } },
    });
  }
  consultarHistorial(page = 0) {
    this.historyRead?.unsubscribe(); this.historial.set(null); this.historialError.set(''); this.historialCarga.set(true);
    const generation = this.generation;
    this.historyRead = this.api.historial(this.modo, page).subscribe({
      next: data => { if (generation === this.generation) { this.historial.set(data); this.historialCarga.set(false); } },
      error: e => { if (generation === this.generation) { this.historialError.set(this.mensaje(e)); this.historialCarga.set(false); } },
    });
  }
  limpiarFiltro() { this.busqueda = ''; this.filtro = ''; this.consultarDetalle(); }
  abrirBorrador(value: BorradorInstitucional) { this.desde = value.desde; this.hasta = value.hasta; this.tab.set('informe'); this.cargar(); }
  guardar() {
    if (this.guardando() || this.incierto() || this.estado() !== 'listo' || !this.autorizado()) return;
    if (this.activePeriod !== `${this.desde}/${this.hasta}`) { this.aviso.set('Aplica primero el periodo seleccionado.'); return; }
    const invalid = this.campos.some(c => (this.cualitativo[c.key]?.length ?? 0) > 4000 || (c.numerico && !!this.cualitativo[c.key] && !/^\d{1,5}$/.test(this.cualitativo[c.key])));
    if (invalid) { this.aviso.set('Revisa los campos: máximo 4000 caracteres y conteos enteros de 0 a 99999.'); return; }
    const content = Object.fromEntries(this.campos.map(c => [c.key, (this.cualitativo[c.key] ?? '').trim()]));
    this.operation = { operacionId: crypto.randomUUID(), version: this.borrador()?.version ?? null, cualitativo: content };
    const generation = this.generation; const operation = this.operation;
    this.guardando.set(true); this.aviso.set('Guardando borrador…');
    this.write = this.api.guardar(this.modo, this.desde, this.hasta, operation).pipe(
      switchMap(() => this.api.borrador(this.modo, this.desde, this.hasta)),
    ).subscribe({ next: saved => { if (generation === this.generation) this.confirmar(saved, operation); }, error: e => {
      if (generation !== this.generation) return;
      this.guardando.set(false); this.incierto.set(e.status === 0 || e.status >= 500 || e.status === 409);
      this.aviso.set(this.incierto() ? 'No se pudo confirmar el guardado. Recupera el resultado antes de volver a guardar; el contenido permanece en memoria.' : this.mensaje(e));
    } });
  }
  recuperar() {
    if (this.guardando() || !this.operation || !this.autorizado()) return;
    const generation = this.generation; const operation = this.operation;
    this.guardando.set(true);
    this.recovery = this.api.borrador(this.modo, this.desde, this.hasta).subscribe({ next: saved => {
      if (generation !== this.generation) return;
      if (saved.operacionId === operation.operacionId) this.confirmar(saved, operation);
      else { this.guardando.set(false); this.aviso.set('Existe otra versión del periodo. Tu contenido sigue en memoria; recarga el periodo para revisar esa versión antes de editar.'); }
    }, error: e => {
      if (generation !== this.generation) return;
      this.guardando.set(false);
      if (e.status === 404) { this.incierto.set(false); this.operation = null; this.aviso.set('No existe un borrador persistido para el periodo consultado. Puedes guardar el contenido de nuevo.'); }
      else this.aviso.set(this.mensaje(e));
    } });
  }
  private confirmar(saved: BorradorInstitucional, operation: GuardarBorrador) {
    this.guardando.set(false);
    if (!this.coincide(saved) || saved.operacionId !== operation.operacionId || !saved.id || saved.estado !== 'BORRADOR') {
      this.incierto.set(true); this.aviso.set('La recuperación no confirmó esta operación. Conserva el contenido y consulta de nuevo.'); return;
    }
    this.borrador.set(saved); this.cualitativo = { ...saved.cualitativo }; this.incierto.set(false); this.operation = null;
    this.aviso.set('Borrador guardado y recuperado del servidor. No acredita emisión ni remisión.'); this.consultarHistorial();
  }
  async exportar(tipo: 'pdf' | 'excel') {
    const saved = this.borrador(); if (!saved || this.exportando()) return;
    const generation = this.generation; this.exportando.set(true); this.aviso.set('Preparando copia del borrador guardado…');
    try { if (tipo === 'pdf') await descargarBorradorPdf(saved, () => generation === this.generation); else await descargarBorradorExcel(saved, () => generation === this.generation);
      if (generation === this.generation) this.aviso.set('Copia del borrador guardado preparada. No es un documento emitido ni remitido.');
    } catch { if (generation === this.generation) this.aviso.set('No se pudo preparar la copia. No se generó un archivo sustituto.'); }
    finally { if (generation === this.generation) this.exportando.set(false); }
  }
  csv() { const page = this.detalle(); if (!page) return; guardarArchivo(new Blob([csvPagina(page.content)], { type: 'text/csv;charset=utf-8' }), `detalle-${this.modo}-pagina-${page.number + 1}.csv`); }
  destino(fila: FilaReporte) { return this.modo === 'entidad' ? ['/funcionario/solicitud', fila.expediente] : ['/ttaip/resolucion', fila.expediente]; }
  seleccionarTab(event: KeyboardEvent, current: number) {
    const move = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!move && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault(); const index = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (current + move + 4) % 4;
    this.tab.set(this.tabs[index].id); document.getElementById(`reporte-tab-${this.tabs[index].id}`)?.focus();
  }
  etiqueta(value: string) { return value.replaceAll('_', ' ').toLocaleLowerCase('es-PE'); }
  private mensaje(e: HttpErrorResponse) {
    if (e.status === 401) return 'La sesión no está vigente. Inicia sesión de nuevo.';
    if (e.status === 403) return 'Tu cuenta no tiene acceso a este ámbito institucional.';
    if (e.status === 400) return 'Revisa el periodo y los filtros. El intervalo admite hasta 367 días.';
    if (e.status === 404) return 'El recurso solicitado no está disponible.';
    if (e.status === 0) return 'No se pudo conectar. Reintenta cuando vuelva la conexión.';
    return 'No se pudo consultar el reporte. Reintenta sin interpretar el error como ausencia de registros.';
  }
}
