import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, Injector, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { LucideBell, LucideInbox, LucideX } from '@lucide/angular';
import { AuthService } from '../services/auth.service';
import { SolicitudService } from '../services/solicitud.service';
import { ApelacionService } from '../services/apelacion.service';

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
  imports: [LucideBell, LucideInbox, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-block text-left" (focusout)="alSalirFoco($event)">
      <button #trigger type="button" (click)="toggleOpen()" aria-label="Abrir avisos e indicadores"
        aria-haspopup="dialog" [attr.aria-expanded]="panelAbierto()" [attr.aria-controls]="panelAbierto() ? panelId : null"
        class="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2">
        <svg lucideBell class="w-4 h-4" aria-hidden="true"></svg>
      </button>
      @if (panelAbierto()) {
        @let vista = consultaActual();
        <section #panel [id]="panelId" role="dialog" aria-modal="false" [attr.aria-labelledby]="panelId + '-titulo'"
          [attr.aria-describedby]="panelId + '-limite'" tabindex="-1"
          class="absolute right-0 mt-2 rounded-xl border border-border bg-card shadow-xl z-50 overflow-auto"
          style="width: min(24rem, calc(100vw - 2rem)); max-height: min(480px, calc(100dvh - 8rem)); box-shadow: var(--shadow-xl)">
          <header class="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <h2 [id]="panelId + '-titulo'" class="text-sm font-semibold">Avisos e indicadores</h2>
            <button type="button" aria-label="Cerrar avisos e indicadores" (click)="cerrar()"
              class="w-8 h-8 rounded-md hover:bg-accent inline-flex items-center justify-center shrink-0">
              <svg lucideX class="w-4 h-4" aria-hidden="true"></svg>
            </button>
          </header>
          <div class="p-4 text-sm space-y-3" [attr.aria-busy]="vista.estado === 'cargando'">
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
            @if (puedeConsultar() && vista.estado !== 'cargando') {
              <button type="button" class="btn-ghost-brand !text-xs" (click)="consultar()">{{ vista.estado === 'error' || vista.estado === 'incompleto' ? 'Reintentar indicadores' : 'Actualizar indicadores' }}</button>
            }
          </div>
          @if (rutaPanel(); as destino) {
            <footer class="px-4 py-3 border-t border-border">
              <a [href]="destino" (click)="irAlPanel($event)" class="text-sm underline">Consultar mi panel</a>
            </footer>
          }
        </section>
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

  constructor() {
    effect(() => {
      const c = this.contexto();
      this.cancelar();
      this.abierto.set(false);
      this.apertura.set(null);
      this.consulta.set(inicial(c));
    });
    inject(DestroyRef).onDestroy(() => this.cancelar());
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
}
