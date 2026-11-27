import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, Injector, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter, forkJoin } from 'rxjs';
import { LucideAlertTriangle, LucideBell, LucideBellRing, LucideCheckCircle2, LucideGavel, LucideHourglass, LucideInbox, LucideScale, LucideX } from '@lucide/angular';
import { AuthService } from '../services/auth.service';
import { SolicitudService } from '../services/solicitud.service';
import { ApelacionService } from '../services/apelacion.service';
import { AvisosBandejaService } from './avisos-bandeja.service';
import { Aviso } from './avisos-bandeja';
import { YaikuCargandoComponent } from './yaiku-cargando.component';

type Rol = 'CIUDADANO' | 'FUNCIONARIO' | 'TTAIP' | 'ADMINISTRADOR';
type Estado = 'no-disponible' | 'sin-consultar' | 'cargando' | 'disponible' | 'vacio' | 'incompleto' | 'error';
interface Contexto {
  usuarioId: number; token: string; rol: Rol;
  entidadId?: number; funcionarioId?: number; miembroId?: number; administradorId?: number;
}
interface Indicadores { solicitudes: number; apelaciones: number; }
interface Consulta { contexto: Contexto | null; estado: Estado; datos?: Indicadores; mensaje: string; }
const ROLES: readonly string[] = ['CIUDADANO', 'FUNCIONARIO', 'TTAIP', 'ADMINISTRADOR'];
const PANELES: Record<Rol, string> = { CIUDADANO: '/ciudadano', FUNCIONARIO: '/funcionario', TTAIP: '/ttaip', ADMINISTRADOR: '/admin' };
let siguienteCampana = 0;

function mismoContexto(a: Contexto | null, b: Contexto | null): boolean {
  return a === null || b === null ? a === b : a.usuarioId === b.usuarioId && a.token === b.token
    && a.rol === b.rol && a.entidadId === b.entidadId && a.funcionarioId === b.funcionarioId
    && a.miembroId === b.miembroId && a.administradorId === b.administradorId;
}
function inicial(contexto: Contexto | null): Consulta {
  return { contexto, estado: contexto?.rol === 'ADMINISTRADOR' ? 'sin-consultar' : 'no-disponible',
    mensaje: contexto?.rol === 'ADMINISTRADOR' ? 'Abra la consulta de indicadores administrativos.'
      : 'Bandeja personal no disponible en esta campana. Consulte las actuaciones desde su panel autorizado.' };
}
function total(value: unknown): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const n = (value as Record<string, unknown>)['total'];
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** Read-only administrative indicators; not a personal notification inbox. */
@Component({
  selector: 'app-notification-bell',
  imports: [LucideAlertTriangle, LucideBell, LucideBellRing, LucideCheckCircle2, LucideGavel, LucideHourglass, LucideInbox, LucideScale, LucideX, YaikuCargandoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-block text-left" (focusout)="alSalirFoco($event)">
      <button #trigger type="button" (click)="toggleOpen()" aria-label="Abrir avisos e indicadores"
        aria-haspopup="dialog" [attr.aria-expanded]="panelAbierto()" [attr.aria-controls]="panelAbierto() ? panelId : null"
        class="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-[color:var(--brand-subtle)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
        [style.color]="noLeidos() > 0 ? 'var(--brand-700)' : 'var(--muted-foreground)'">
        <svg lucideBell class="w-[18px] h-[18px]" aria-hidden="true"></svg>
        @if (noLeidos() > 0) {
          <span class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-white text-[10px] font-semibold leading-4 text-center"
            style="background: var(--gold-dark); box-shadow: 0 0 0 2px var(--background)"
            [attr.aria-label]="noLeidos() + ' avisos sin leer'">{{ noLeidos() > 9 ? '9+' : noLeidos() }}</span>
        }
      </button>
      @if (panelAbierto()) {
        @let vista = consultaActual();
        <section #panel [id]="panelId" role="dialog" aria-modal="false" [attr.aria-labelledby]="panelId + '-titulo'"
          [attr.aria-describedby]="panelId + '-limite'" tabindex="-1"
          class="absolute right-0 mt-2 rounded-xl border border-border bg-card shadow-xl z-50 overflow-auto"
          style="width: min(24rem, calc(100vw - 2rem)); max-height: min(480px, calc(100dvh - 8rem)); box-shadow: var(--shadow-xl)">
          <header class="px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-10"
            [style.background]="puedeConsultar() ? 'var(--card)' : 'var(--brand-subtle)'"
            [style.border-bottom]="puedeConsultar() ? '1px solid var(--border)' : '1px solid var(--brand-200)'">
            @if (puedeConsultar()) {
              <h2 [id]="panelId + '-titulo'" class="text-sm font-semibold">Avisos e indicadores</h2>
            } @else {
              <div class="flex items-center gap-2 min-w-0">
                <svg lucideBellRing class="w-4 h-4 shrink-0" style="color: var(--brand-700)" aria-hidden="true"></svg>
                <h2 [id]="panelId + '-titulo'" class="text-sm font-medium" style="color: var(--brand-700)">Notificaciones</h2>
                @if (noLeidos() > 0) {
                  <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style="background: var(--gold-dark)">{{ noLeidos() }} nuevas</span>
                }
              </div>
            }
            <div class="flex items-center gap-1 shrink-0">
              @if (!puedeConsultar() && noLeidos() > 0) {
                <button type="button" (click)="marcarLeidos()" class="text-[11px] font-medium px-1" style="color: var(--brand-700)">Marcar leídas</button>
              }
              <button type="button" aria-label="Cerrar avisos e indicadores" (click)="cerrar()"
                class="w-8 h-8 rounded-md hover:bg-accent inline-flex items-center justify-center shrink-0">
                <svg lucideX class="w-4 h-4" aria-hidden="true"></svg>
              </button>
            </div>
          </header>
          <div class="p-4 text-sm space-y-3" [attr.aria-busy]="vista.estado === 'cargando' || bandeja.estado() === 'cargando'">
            @if (puedeConsultar()) {
              <p [id]="panelId + '-limite'" class="text-xs text-muted-foreground">
                Esta campana no consulta una bandeja de notificaciones personales ni acredita entrega o notificación eficaz. No hay contador de no leídas.
              </p>
              <div [attr.role]="vista.estado === 'error' || vista.estado === 'incompleto' ? 'alert' : 'status'" aria-live="polite">
                @if (vista.estado === 'no-disponible') { <svg lucideInbox class="w-5 h-5 mb-2 text-muted-foreground" aria-hidden="true"></svg> }
                <p>{{ vista.mensaje }}</p>
              </div>
              @if (vista.datos; as datos) {
                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border p-3">
                  <div><dt class="text-xs text-muted-foreground">Solicitudes registradas</dt><dd class="font-mono font-semibold">{{ datos.solicitudes }}</dd></div>
                  <div><dt class="text-xs text-muted-foreground">Apelaciones registradas</dt><dd class="font-mono font-semibold">{{ datos.apelaciones }}</dd></div>
                </dl>
                <p class="text-xs text-muted-foreground">Indicadores derivados de las estadísticas administrativas de solicitudes y apelaciones del servidor. Son totales globales de registros, no actividad personal, notificaciones, vencimientos legales ni lecturas pendientes.</p>
              }
              @if (vista.estado !== 'cargando') {
                <button type="button" class="btn-ghost-brand !text-xs" (click)="consultar()">{{ vista.estado === 'error' || vista.estado === 'incompleto' ? 'Reintentar indicadores' : 'Actualizar indicadores' }}</button>
              }
            } @else if (bandeja.estado() === 'sin-consultar') {
              <p [id]="panelId + '-limite'" class="text-xs text-muted-foreground">No hay una sesión válida para consultar avisos.</p>
            } @else {
              <p [id]="panelId + '-limite'" class="sr-only">
                Avisos de los expedientes que ya puede consultar. Marcar leído solo los oculta en este navegador y no acredita notificación eficaz.
              </p>
              @if (bandeja.estado() === 'cargando') { <app-yaiku-cargando mensaje="Consultando sus avisos…" [compacto]="true" /> }
              @if (bandeja.estado() === 'error') {
                <p role="alert">No se pudieron consultar sus avisos. No se muestra una lista sustituta.</p>
                <button type="button" class="btn-ghost-brand !text-xs" (click)="reintentarAvisos()">Reintentar avisos</button>
              }
              @if (bandeja.estado() === 'vacio') {
                <div class="px-2 py-8 text-center" role="status">
                  <svg lucideCheckCircle2 class="w-8 h-8 mx-auto mb-2 text-muted-foreground" aria-hidden="true"></svg>
                  <p>No tiene avisos pendientes.</p>
                  <p class="text-xs text-muted-foreground mt-1">Te avisaremos cuando haya novedades en sus expedientes.</p>
                </div>
              }
              @if (bandeja.estado() === 'disponible') {
                <ul class="-mx-4">
                  @for (aviso of avisosVisibles(); track aviso.id; let anterior = $index) {
                    @if (cambiaGrupo(anterior, aviso)) {
                      <li class="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
                        {{ leido(aviso) ? 'Ya vistas' : 'Nuevas' }}
                      </li>
                    }
                    <li style="border-bottom: 1px solid var(--border)" [style.background]="leido(aviso) ? 'transparent' : 'color-mix(in srgb, var(--brand-50) 55%, transparent)'">
                      @if (expedienteEnPantalla(aviso)) {
                        <div class="px-4 py-3 flex items-start gap-3">
                          <span class="w-9 h-9 rounded-md flex items-center justify-center shrink-0 mt-0.5" style="background: var(--brand-subtle); border: 1px solid var(--brand-200)">
                            @switch (aviso.icono) {
                              @case ('alerta') { <svg lucideAlertTriangle class="w-4 h-4" style="color: var(--gold-dark)" aria-hidden="true"></svg> }
                              @case ('balanza') { <svg lucideScale class="w-4 h-4" style="color: var(--brand-700)" aria-hidden="true"></svg> }
                              @case ('mazo') { <svg lucideGavel class="w-4 h-4" style="color: var(--brand-700)" aria-hidden="true"></svg> }
                              @case ('reloj') { <svg lucideHourglass class="w-4 h-4" style="color: var(--gold-dark)" aria-hidden="true"></svg> }
                              @case ('ok') { <svg lucideCheckCircle2 class="w-4 h-4" style="color: var(--success)" aria-hidden="true"></svg> }
                              @default { <svg lucideInbox class="w-4 h-4" style="color: var(--info)" aria-hidden="true"></svg> }
                            }
                          </span>
                          <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium">{{ aviso.titulo }}</p>
                            <p class="text-xs text-muted-foreground mt-0.5">{{ aviso.detalle }}</p>
                            <p class="text-[11px] mt-1" style="color: var(--brand-700)">En esta pantalla</p>
                          </div>
                        </div>
                      } @else {
                        <a [href]="aviso.ruta" (click)="abrirAviso($event, aviso)"
                          class="px-4 py-3 flex items-start gap-3 hover:bg-[color:var(--muted)]">
                          <span class="w-9 h-9 rounded-md flex items-center justify-center shrink-0 mt-0.5" style="background: var(--brand-subtle); border: 1px solid var(--brand-200)">
                            @switch (aviso.icono) {
                              @case ('alerta') { <svg lucideAlertTriangle class="w-4 h-4" style="color: var(--gold-dark)" aria-hidden="true"></svg> }
                              @case ('balanza') { <svg lucideScale class="w-4 h-4" style="color: var(--brand-700)" aria-hidden="true"></svg> }
                              @case ('mazo') { <svg lucideGavel class="w-4 h-4" style="color: var(--brand-700)" aria-hidden="true"></svg> }
                              @case ('reloj') { <svg lucideHourglass class="w-4 h-4" style="color: var(--gold-dark)" aria-hidden="true"></svg> }
                              @case ('ok') { <svg lucideCheckCircle2 class="w-4 h-4" style="color: var(--success)" aria-hidden="true"></svg> }
                              @default { <svg lucideInbox class="w-4 h-4" style="color: var(--info)" aria-hidden="true"></svg> }
                            }
                          </span>
                          <div class="min-w-0 flex-1">
                            <span class="flex items-center gap-1.5">
                              @if (aviso.urgente && !leido(aviso)) {
                                <span class="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded" style="background: rgba(176,136,66,0.15); color: var(--gold-dark)">Acción</span>
                              }
                              <span class="text-sm font-medium truncate">{{ aviso.titulo }}</span>
                            </span>
                            <span class="block text-xs text-muted-foreground mt-0.5 truncate">{{ aviso.detalle }}</span>
                            <span class="flex items-center gap-2 mt-1">
                              @if (aviso.expediente) { <span class="text-[10px] font-mono" style="color: var(--brand-700)">{{ aviso.expediente }}</span> }
                              @if (relativa(aviso.cuando); as cuando) { <span class="text-[11px] text-muted-foreground">{{ cuando }}</span> }
                            </span>
                          </div>
                          @if (!leido(aviso)) { <span class="w-2 h-2 rounded-full shrink-0 mt-2" style="background: var(--brand-600)"></span> }
                        </a>
                      }
                    </li>
                  }
                </ul>
              }
            }
          </div>
          @if (rutaPanel(); as destino) {
            <footer class="px-4 py-3 border-t border-border space-y-1 sticky bottom-0 bg-card">
              @if (avisosRestantes() > 0) {
                <p class="text-xs text-muted-foreground">Hay {{ avisosRestantes() }} avisos más. El resto sigue en su panel.</p>
              }
              <a [href]="destino" (click)="irAlPanel($event)" class="text-sm underline">Consultar mi panel</a>
            </footer>
          }
        </section>
      }
      @if (emergente(); as aviso) {
        <div role="status" aria-live="polite" class="fixed z-40 rounded-lg border border-border bg-card p-3 shadow-lg"
          style="top: 4.75rem; right: 1rem; width: min(20rem, calc(100vw - 2rem)); box-shadow: var(--shadow-lg)">
          <p class="text-xs font-semibold" style="color: var(--brand-700)">Llegó un aviso</p>
          <p class="text-sm font-medium mt-1">{{ aviso.titulo }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">{{ aviso.detalle }}</p>
          @if (extraEmergente() > 0) {
            <p class="text-xs text-muted-foreground mt-1">y {{ extraEmergente() }} más en la campana</p>
          }
          <div class="mt-2 flex items-center gap-3">
            <a [href]="aviso.ruta" (click)="abrirEmergente($event, aviso)" class="text-xs font-medium underline" style="color: var(--brand-700)">Abrir expediente</a>
            <button type="button" class="text-xs text-muted-foreground" (click)="cerrarEmergente()" aria-label="Cerrar aviso reciente">Cerrar</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class NotificationBellComponent {
  readonly userType = input<string | null>(null);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly solicitudes = inject(SolicitudService);
  private readonly apelaciones = inject(ApelacionService);
  readonly bandeja = inject(AvisosBandejaService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  readonly panelId = `saip-avisos-${++siguienteCampana}`;
  private readonly abierto = signal(false);
  private readonly apertura = signal<Contexto | null>(null);
  private readonly consulta = signal<Consulta>(inicial(null));
  private suscripcion?: Subscription;
  private generacion = 0;
  private readonly contexto = computed(() => this.leerContexto());
  readonly panelAbierto = computed(() => this.abierto() && mismoContexto(this.apertura(), this.contexto()));
  readonly consultaActual = computed(() => mismoContexto(this.consulta().contexto, this.contexto())
    ? this.consulta() : inicial(this.contexto()));
  readonly puedeConsultar = computed(() => this.contexto()?.rol === 'ADMINISTRADOR');
  readonly rutaPanel = computed(() => { const c = this.contexto(); return c ? PANELES[c.rol] : null; });
  private readonly leidosTick = signal(0);
  private readonly rutaActual = signal('');
  readonly emergente = signal<Aviso | null>(null);
  readonly extraEmergente = signal(0);
  private avisoTimer?: ReturnType<typeof setTimeout>;
  readonly avisosOrdenados = computed(() => {
    this.rutaActual();
    this.leidosTick();
    const porReciente = (a: Aviso, b: Aviso) => (b.cuando ?? '').localeCompare(a.cuando ?? '') || Number(b.urgente) - Number(a.urgente);
    const ordenar = (avisos: Aviso[]) => [
      ...avisos.filter(aviso => !this.leido(aviso)).sort(porReciente),
      ...avisos.filter(aviso => this.leido(aviso)).sort(porReciente),
    ];
    const otros: Aviso[] = [];
    const actuales: Aviso[] = [];
    for (const aviso of this.bandeja.avisos()) (this.expedienteEnPantalla(aviso) ? actuales : otros).push(aviso);
    return [...ordenar(otros), ...ordenar(actuales)];
  });
  readonly avisosVisibles = computed(() => this.avisosOrdenados().slice(0, 8));
  readonly avisosRestantes = computed(() => Math.max(0, this.avisosOrdenados().length - this.avisosVisibles().length));
  readonly noLeidos = computed(() => {
    this.leidosTick();
    const c = this.contexto();
    if (!c || c.rol === 'ADMINISTRADOR') return 0;
    const leidos = leerLeidos(c.usuarioId);
    return this.bandeja.avisos().filter(aviso => !leidos.has(aviso.id)).length;
  });

  constructor() {
    this.rutaActual.set(this.router.url);
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(evento => this.rutaActual.set(evento.urlAfterRedirects));
    effect(() => {
      const c = this.contexto();
      this.cancelar();
      this.abierto.set(false);
      this.apertura.set(null);
      this.consulta.set(inicial(c));
      if (c && c.rol !== 'ADMINISTRADOR') this.bandeja.sincronizar(c.usuarioId, c.rol);
      else this.bandeja.detener();
    });
    effect(() => {
      const nuevos = this.bandeja.recienLlegados();
      if (!nuevos.length) return;
      const ajenos = nuevos.filter(aviso => !this.expedienteEnPantalla(aviso));
      untracked(() => {
        this.bandeja.limpiarNovedades();
        const primero = ajenos[0];
        if (!primero) return;
        this.emergente.set(primero);
        this.extraEmergente.set(Math.max(0, ajenos.length - 1));
        clearTimeout(this.avisoTimer);
        this.avisoTimer = setTimeout(() => this.emergente.set(null), 8000);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.cancelar();
      clearTimeout(this.avisoTimer);
    });
  }

  private leerContexto(): Contexto | null {
    this.auth.cambiosSesion();
    const rolVisible = this.userType();
    try {
      const s = this.auth.obtenerSesion();
      if (!s?.token || !Number.isSafeInteger(s.usuarioId) || s.usuarioId! <= 0
        || !s.tipoUsuario || !ROLES.includes(s.tipoUsuario) || rolVisible !== s.tipoUsuario) return null;
      return { usuarioId: s.usuarioId!, token: s.token, rol: s.tipoUsuario as Rol,
        entidadId: s.entidadId, funcionarioId: s.funcionarioId, miembroId: s.miembroId, administradorId: s.administradorId };
    } catch { return null; }
  }

  toggleOpen(): void {
    if (this.panelAbierto()) { this.cerrar(); return; }
    const c = this.leerContexto();
    this.apertura.set(c);
    this.abierto.set(true);
    this.consulta.set(inicial(c));
    this.consultar();
    afterNextRender(() => {
      if (this.panelAbierto() && mismoContexto(c, this.leerContexto())) this.panel()?.nativeElement.querySelector<HTMLButtonElement>('button')?.focus();
    }, { injector: this.injector });
  }

  cerrar(restaurarFoco = true): void {
    this.cancelar();
    this.abierto.set(false);
    this.consulta.set(inicial(this.leerContexto()));
    if (restaurarFoco) this.trigger()?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  alClickExterior(event: MouseEvent): void {
    if (this.panelAbierto() && !this.host.nativeElement.contains(event.target as Node)) this.cerrar(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  alEscape(event: Event): void {
    if (!this.panelAbierto()) return;
    event.preventDefault(); event.stopPropagation(); this.cerrar();
  }

  alSalirFoco(event: FocusEvent): void {
    if (this.panelAbierto() && event.relatedTarget && !this.host.nativeElement.contains(event.relatedTarget as Node)) this.cerrar(false);
  }

  irAlPanel(event: MouseEvent): void {
    const c = this.leerContexto();
    if (!c || !this.panelAbierto() || !mismoContexto(c, this.apertura())) {
      event.preventDefault(); this.cerrar(false); return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.cerrar(false);
    void this.router.navigate([PANELES[c.rol]]);
  }

  reintentarAvisos(): void {
    const c = this.leerContexto();
    if (!c || c.rol === 'ADMINISTRADOR' || !this.panelAbierto()) return;
    this.bandeja.reintentar(c.usuarioId, c.rol);
  }

  cambiaGrupo(indice: number, aviso: Aviso): boolean {
    if (indice === 0) return true;
    const previo = this.avisosVisibles()[indice - 1];
    return !previo || this.leido(previo) !== this.leido(aviso);
  }
  leido(aviso: Aviso): boolean {
    this.leidosTick();
    const c = this.contexto();
    return !!c && c.rol !== 'ADMINISTRADOR' && leerLeidos(c.usuarioId).has(aviso.id);
  }

  expedienteEnPantalla(aviso: Aviso): boolean {
    const expediente = aviso.expediente;
    if (!expediente) return false;
    let actual = (this.rutaActual() || this.router.url).split('?')[0];
    try { actual = decodeURIComponent(actual); } catch { /* la ruta visible ya sirve para comparar */ }
    const marca = `/${expediente}`;
    return actual.endsWith(marca) || actual.includes(`${marca}/`);
  }

  relativa(iso?: string): string {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [anio, mes, dia] = iso.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((hoy.getTime() - fecha.getTime()) / 86_400_000);
    if (dias <= 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    if (dias < 7) return `Hace ${dias} días`;
    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
  }

  cerrarEmergente(): void {
    clearTimeout(this.avisoTimer);
    this.emergente.set(null);
  }

  abrirEmergente(event: MouseEvent, aviso: Aviso): void {
    const c = this.leerContexto();
    if (!c || c.rol === 'ADMINISTRADOR') { event.preventDefault(); return; }
    this.recordarLeido(c.usuarioId, aviso.id);
    this.cerrarEmergente();
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (this.expedienteEnPantalla(aviso)) return;
    void this.router.navigate(aviso.segmentos);
  }

  abrirAviso(event: MouseEvent, aviso: Aviso): void {
    const c = this.leerContexto();
    if (!c || c.rol === 'ADMINISTRADOR' || !this.panelAbierto() || !mismoContexto(c, this.apertura())) {
      event.preventDefault();
      return;
    }
    this.recordarLeido(c.usuarioId, aviso.id);
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.cerrar(false);
    void this.router.navigate(aviso.segmentos);
  }

  marcarLeidos(): void {
    const c = this.leerContexto();
    if (!c || c.rol === 'ADMINISTRADOR' || !this.panelAbierto()) return;
    const leidos = leerLeidos(c.usuarioId);
    for (const aviso of this.bandeja.avisos()) leidos.add(aviso.id);
    guardarLeidos(c.usuarioId, leidos);
    this.leidosTick.update(valor => valor + 1);
  }

  consultar(): void {
    this.cancelar();
    const c = this.leerContexto();
    if (!this.panelAbierto() || c?.rol !== 'ADMINISTRADOR') { this.consulta.set(inicial(c)); return; }
    const generacion = this.generacion;
    const vigente = () => generacion === this.generacion && this.panelAbierto() && mismoContexto(c, this.leerContexto());
    this.consulta.set({ contexto: c, estado: 'cargando', mensaje: 'Consultando indicadores administrativos…' });
    let recibido = false;
    this.suscripcion = forkJoin({ solicitudes: this.solicitudes.getEstadisticas(), apelaciones: this.apelaciones.getEstadisticas() }).subscribe({
      next: datos => {
        recibido = true;
        if (!vigente()) return;
        const solicitudes = total(datos.solicitudes), apelaciones = total(datos.apelaciones);
        if (solicitudes === null || apelaciones === null) { this.incompleta(c); return; }
        this.consulta.set({ contexto: c, estado: solicitudes === 0 && apelaciones === 0 ? 'vacio' : 'disponible',
          datos: { solicitudes, apelaciones }, mensaje: solicitudes === 0 && apelaciones === 0
            ? 'Sin registros en estos indicadores. Esto no confirma ausencia de notificaciones.'
            : 'Indicadores derivados del servidor. No representan notificaciones personales.' });
      },
      error: () => {
        if (vigente()) this.consulta.set({ contexto: c, estado: 'error', mensaje: 'No se pudieron consultar los indicadores. No se confirma ausencia de actividad ni de notificaciones.' });
      },
      complete: () => { if (!recibido && vigente()) this.incompleta(c); },
    });
  }

  private incompleta(contexto: Contexto): void {
    this.consulta.set({ contexto, estado: 'incompleto', mensaje: 'Información incompleta: el servidor no proporcionó totales válidos para ambos indicadores. No se sustituyen por cero ni por avisos.' });
  }
  private cancelar(): void { ++this.generacion; this.suscripcion?.unsubscribe(); this.suscripcion = undefined; }

  private recordarLeido(usuarioId: number, id: string): void {
    const leidos = leerLeidos(usuarioId);
    leidos.add(id);
    guardarLeidos(usuarioId, leidos);
    this.leidosTick.update(valor => valor + 1);
  }
}

function claveLeidos(usuarioId: number): string {
  return `saip:avisos:leidos:v1:${usuarioId}`;
}

function leerLeidos(usuarioId: number): Set<string> {
  try {
    const guardado = localStorage.getItem(claveLeidos(usuarioId));
    const lista = guardado ? JSON.parse(guardado) as unknown : [];
    return new Set(Array.isArray(lista) ? lista.filter((id): id is string => typeof id === 'string' && id.length < 180) : []);
  } catch {
    return new Set();
  }
}

function guardarLeidos(usuarioId: number, ids: Set<string>): void {
  localStorage.setItem(claveLeidos(usuarioId), JSON.stringify([...ids].slice(-200)));
}
