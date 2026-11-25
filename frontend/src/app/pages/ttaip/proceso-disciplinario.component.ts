import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, OnInit, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideArrowLeft, LucideAlertTriangle, LucideFileText, LucideMail, LucideGavel, LucideScale, LucideFolderOpen, LucideInbox } from '@lucide/angular';
import { TtaipService } from '../../services/ttaip.service';
import { AuthService } from '../../services/auth.service';
import { Apelacion } from '../../models/apelacion.model';
import { EstadoConsulta, falloConsulta } from '../../utils/consulta-remota.util';
import { YaikuCargandoComponent } from '../../shared/yaiku-cargando.component';

type ProcessTab = 'resolucion' | 'notificacion' | 'descargos' | 'sancion';
interface ResolucionConIndicador {
  id: number;
  tipoResolucion?: string | null;
  numeroResolucion?: string | null;
  decision?: string | null;
  fechaResolucion?: string | null;
  fundamentos?: string | null;
  fundamentoLegal?: string | null;
  miembroTTAIPId?: number | null;
  miembroTTAIPNombre?: string | null;
  iniciarProcesoDisciplinario?: boolean | null;
}
interface AntecedenteResolucion {
  apelacion: Apelacion;
  resolucion: ResolucionConIndicador;
}
const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

@Component({
  selector: 'app-proceso-disciplinario',
  imports: [CommonModule, RouterLink, YaikuCargandoComponent, LucideArrowLeft, LucideAlertTriangle, LucideFileText, LucideMail, LucideGavel, LucideScale, LucideFolderOpen, LucideInbox],
  templateUrl: './proceso-disciplinario.component.html',
  styleUrl: './proceso-disciplinario.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcesoDisciplinarioComponent implements OnInit {
  private readonly ttaipService = inject(TtaipService);
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private query?: Subscription;
  private generation = 0;
  private session = this.sessionKey();
  private initialized = false;
  private destroyed = false;

  readonly activeTab = signal<ProcessTab>('resolucion');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly estadoConsulta = signal<EstadoConsulta>('cargando');
  readonly reintentable = signal(false);
  readonly informacionIncompleta = signal(false);
  readonly resolucionesConsultadas = signal(0);
  // These are resolution antecedents, never persisted disciplinary proceedings.
  readonly cases = signal<AntecedenteResolucion[]>([]);
  readonly selectedCaseId = signal<number | null>(null);
  readonly selectedCase = computed(() => this.cases().find(c => c.resolucion.id === this.selectedCaseId()) ?? null);
  readonly tabs: { id: ProcessTab; label: string }[] = [
    { id: 'resolucion', label: 'Resolución TTAIP' }, { id: 'notificacion', label: 'Notificación' },
    { id: 'descargos', label: 'Descargos' }, { id: 'sancion', label: 'Sanción' }
  ];
  readonly capacidades = [
    { titulo: 'Comunicación o remisión', descripcion: 'No hay una operación disciplinaria disponible para acreditar una remisión a otra autoridad.' },
    { titulo: 'Registro del procedimiento', descripcion: 'El indicador de una resolución no identifica un procedimiento ni acredita su apertura.' },
    { titulo: 'Investigación y decisión', descripcion: 'No se dispone de registros ni comandos disciplinarios para consultar o ejecutar estas actuaciones.' },
    { titulo: 'Sanción y documentos', descripcion: 'No se ofrecen sanciones, numeración, firma o emisión de documentos disciplinarios desde esta pantalla.' }
  ];
  readonly timeline = computed(() => {
    const item = this.selectedCase();
    return item ? [{ id: item.resolucion.id, title: 'Resolución final registrada', date: this.formatDate(item.resolucion.fechaResolucion),
      desc: `ID ${item.resolucion.id} · ${this.formatDecision(item.resolucion.decision)}. No acredita apertura ni remisión disciplinaria.` }] : [];
  });

  constructor() {
    effect(() => {
      this.auth.cambiosSesion();
      if (this.initialized && this.sessionKey() !== this.session) untracked(() => this.cargarProcesos());
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true; this.generation++; this.query?.unsubscribe(); this.cases.set([]); this.selectedCaseId.set(null);
    });
  }
  ngOnInit(): void { this.initialized = true; this.cargarProcesos(); }
  private sessionKey(): string {
    try { const s = this.auth.obtenerSesion(); return JSON.stringify([this.auth.getToken(), this.auth.getTipoUsuario(), s?.usuarioId, s?.entidadId]); }
    catch { return ''; }
  }
  private acceso(): 'autenticacion' | 'autorizacion' | null {
    try { if (!this.auth.getToken()) return 'autenticacion'; return ['TTAIP', 'ADMINISTRADOR'].includes(this.auth.getTipoUsuario() || '') ? null : 'autorizacion'; }
    catch { return 'autenticacion'; }
  }
  contextoVigente(): boolean { return !this.destroyed && this.session === this.sessionKey() && !this.acceso(); }

  // The existing query only returns resolved appeals and their final-resolution flag.
  cargarProcesos(): void {
    if (this.destroyed) return;
    this.query?.unsubscribe(); const generation = ++this.generation; this.session = this.sessionKey();
    this.cases.set([]); this.selectedCaseId.set(null); this.activeTab.set('resolucion'); this.error.set('');
    this.loading.set(true); this.estadoConsulta.set('cargando'); this.reintentable.set(false); this.informacionIncompleta.set(false); this.resolucionesConsultadas.set(0);
    const acceso = this.acceso();
    if (acceso) { this.loading.set(false); this.estadoConsulta.set(acceso); this.error.set(acceso === 'autenticacion' ? 'Inicie sesión mediante el acceso interno para consultar antecedentes.' : 'Su sesión no permite consultar antecedentes TTAIP.'); return; }
    this.query = this.ttaipService.getResueltas().subscribe({ next: apelaciones => {
      if (generation !== this.generation || !this.contextoVigente()) return;
      if (!Array.isArray(apelaciones)) { this.fallar(new Error('Incomplete response')); return; }
      const list: AntecedenteResolucion[] = [], ids = new Set<number>(), duplicados = new Set<number>();
      for (const apelacion of apelaciones) {
        const r = apelacion?.resolucion as ResolucionConIndicador | null | undefined;
        if (!positiveId(apelacion?.id) || typeof apelacion.expediente !== 'string' || !apelacion.expediente.trim() || !r || !positiveId(r.id) || r.tipoResolucion !== 'RESOLUCION_FINAL' ||
            (apelacion.expedienteTtaip && (!positiveId(apelacion.expedienteTtaip.id) || apelacion.expedienteTtaip.numeroExpediente !== apelacion.expediente)) ||
            ((r as ResolucionConIndicador & { apelacionId?: number }).apelacionId != null && (r as ResolucionConIndicador & { apelacionId?: number }).apelacionId !== apelacion.id)) {
          this.informacionIncompleta.set(true); continue;
        }
        if (ids.has(r.id)) { duplicados.add(r.id); this.informacionIncompleta.set(true); } ids.add(r.id);
        if (typeof r.iniciarProcesoDisciplinario !== 'boolean') { this.informacionIncompleta.set(true); continue; }
        if (r.iniciarProcesoDisciplinario === true) list.push({ apelacion, resolucion: r });
      }
      const validos = list.filter(c => !duplicados.has(c.resolucion.id));
      this.resolucionesConsultadas.set(ids.size - duplicados.size); this.cases.set(validos); this.selectedCaseId.set(validos[0]?.resolucion.id ?? null);
      this.loading.set(false); this.estadoConsulta.set(validos.length || this.informacionIncompleta() ? 'disponible' : 'vacio');
    }, error: err => { if (generation === this.generation && this.contextoVigente()) this.fallar(err); } });
  }
  private fallar(err: unknown): void {
    const fallo = falloConsulta(err, 'los antecedentes de resoluciones'); this.cases.set([]); this.selectedCaseId.set(null);
    this.loading.set(false); this.error.set(fallo.mensaje); this.estadoConsulta.set(fallo.estado); this.reintentable.set(fallo.reintentable);
  }
  selectCase(item: AntecedenteResolucion): void {
    if (!this.contextoVigente() || !this.cases().includes(item)) return;
    this.selectedCaseId.set(item.resolucion.id); this.activeTab.set('resolucion');
  }
  isCaseSelected(item: AntecedenteResolucion): boolean { return this.selectedCaseId() === item.resolucion.id; }
  cambiarTab(tab: ProcessTab): void {
    if (this.contextoVigente() && this.tabs.some(t => t.id === tab)) this.activeTab.set(tab);
  }
  onTabKey(event: KeyboardEvent, tab: ProcessTab): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !this.contextoVigente()) return;
    event.preventDefault(); const i = this.tabs.findIndex(t => t.id === tab);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : (i + (event.key === 'ArrowLeft' ? -1 : 1) + this.tabs.length) % this.tabs.length;
    this.cambiarTab(this.tabs[index].id); this.host.nativeElement.querySelector<HTMLElement>('#disciplinary-tab-' + this.tabs[index].id)?.focus();
  }
  formatDecision(value?: string | null): string { return value ? value.replaceAll('_', ' ').toUpperCase() : 'DECISIÓN NO INFORMADA'; }
  formatDate(value?: string | null): string {
    if (!value) return 'Fecha no informada';
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00' : value);
    return Number.isNaN(date.getTime()) ? 'Fecha no informada' : new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }
}
