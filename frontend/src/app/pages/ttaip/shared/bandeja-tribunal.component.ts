import { PresentacionesAdmisionComponent } from './presentaciones-admision.component';
import { CumplimientoDocumentalComponent } from './cumplimiento-documental.component';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PanelQueryService } from '../../../services/panel-query.service';
import { AuthService } from '../../../services/auth.service';
import { PanelApelacion, PanelPage } from '../../../models/panel-query.model';
import { ActosNotificacionComponent } from './actos-notificacion.component';
import { StatusBadgeComponent } from '../../../shared/status-badge.component';

@Component({
  selector: 'app-bandeja-tribunal',
  imports: [RouterLink, ActosNotificacionComponent, PresentacionesAdmisionComponent, CumplimientoDocumentalComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [class.form-shell]="!integrada()" [class.mb-6]="!integrada()">
      @if (!integrada()) {
        <div class="form-section-header">
          <button type="button" class="btn-ghost-brand" [attr.aria-expanded]="abierta()" (click)="alternar()">Actuaciones</button>
        </div>
      }
      @if (integrada() || abierta()) {
        <div class="space-y-3" [class.p-4]="!integrada()">
          <div class="flex items-center gap-2 rounded-lg px-3 py-2" style="background: var(--card); border: 1px solid var(--border)">
            <svg class="w-4 h-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <label class="sr-only" for="bandeja-busqueda">Buscar actuaciones</label>
            <input id="bandeja-busqueda" type="search" maxlength="120" autocomplete="off" [value]="busqueda()" (input)="buscar($any($event.target).value)" placeholder="Número SAIP, expediente del Tribunal o asunto" class="w-full bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/70" />
            @if (busqueda()) {
              <button type="button" (click)="limpiarBusqueda()" aria-label="Limpiar búsqueda" class="w-6 h-6 rounded flex items-center justify-center shrink-0 text-muted-foreground">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            }
          </div>
          @if (error()) {
            <p role="alert" class="text-sm text-destructive">No se pudieron consultar las apelaciones.</p>
            <button type="button" class="btn-ghost-brand" (click)="consultar(0)">Reintentar</button>
          } @else if (cargando() && !pagina()) {
            <p role="status" class="text-sm">Consultando apelaciones…</p>
          } @else if (pagina(); as p) {
            <div class="space-y-2">
              @for (ap of p.contenido; track ap.id) {
                <article class="rounded-lg p-4" style="background: var(--card); border: 1px solid var(--border); border-left: 3px solid var(--brand-700)">
                  <div class="flex flex-nowrap items-center gap-4">
                    <div class="min-w-0 flex-1 space-y-2">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center gap-1.5 rounded-md pl-0.5 pr-2 py-0.5" style="background: var(--brand-subtle); border: 1px solid var(--brand-200)">
                          <span class="text-[9px] font-bold tracking-widest uppercase px-1.5 py-[3px] rounded" style="background: var(--brand-700); color: #fff">TTAIP</span>
                          <span class="font-mono text-[11px]">{{ ap.expediente }}</span>
                        </span>
                        @if (ap.solicitudExpediente) {
                          <span class="inline-flex items-center gap-1.5 rounded-md pl-0.5 pr-2 py-0.5" style="background: var(--card); border: 1px solid var(--border)">
                            <span class="text-[9px] font-bold tracking-widest uppercase px-1.5 py-[3px] rounded" style="background: var(--muted); color: var(--muted-foreground)">SAIP</span>
                            <span class="font-mono text-[11px]">{{ ap.solicitudExpediente }}</span>
                          </span>
                        }
                        <app-status-badge [status]="ap.estado || 'Sin estado'" />
                        @if (!entidad() && ap.respuestaCumplimientoDisponible) {
                          <app-status-badge status="Cumplimiento" toneOverride="success" />
                        }
                      </div>
                      <p class="text-sm font-medium leading-snug">{{ ap.solicitudAsunto || ap.resumenSolicitudOriginal || 'Apelación ante el Tribunal' }}</p>
                      <p class="text-xs text-muted-foreground">{{ ap.entidadNombre || ap.entidadExternaNombre || 'Entidad no registrada' }}</p>
                    </div>
                    <div class="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap">
                      @if (entidad()) {
                        @if (ap.estado === 'EN_CUMPLIMIENTO') {
                          <a class="btn-brand" [routerLink]="['/funcionario/apelaciones', ap.expediente]" [queryParams]="{ tab: 'subprocesos', desde: 'actuaciones' }">Cumplimiento</a>
                        }
                        @if (ap.descargosPendientes) {
                          <a class="btn-brand" [routerLink]="['/funcionario/apelaciones', ap.expediente]" [queryParams]="{ tab: 'subprocesos', desde: 'actuaciones' }">Descargos</a>
                        }
                        @if (ap.informacionComplementariaPendiente) {
                          <a class="btn-brand" [routerLink]="['/funcionario/apelaciones', ap.expediente]" [queryParams]="{ tab: 'subprocesos', desde: 'actuaciones' }">Información complementaria</a>
                        }
                        <a class="btn-ghost-brand" [routerLink]="['/funcionario/apelaciones', ap.expediente]" [queryParams]="{ tab: 'notificaciones', desde: 'actuaciones' }">Ver expediente</a>
                      } @else if (ap.expedienteTtaip?.id) {
                        <button type="button" class="btn-ghost-brand" [attr.aria-expanded]="seleccion() === ap.id"
                          (click)="seleccion.set(seleccion() === ap.id ? null : ap.id)">{{ seleccion() === ap.id ? 'Ocultar actuaciones' : 'Ver actuaciones' }}</button>
                      }
                    </div>
                  </div>
                  @if (seleccion() === ap.id && ap.expedienteTtaip?.id; as id) {
                    <div class="mt-4 space-y-4 rounded-lg p-4" style="background: var(--paper); border: 1px solid var(--border)">
                      @if (ap.estado === 'EN_CUMPLIMIENTO' || ap.estado === 'RESUELTO_FUNDADO' || ap.estado === 'RESUELTO_FUNDADO_EN_PARTE') {
                        <app-cumplimiento-documental [expedienteId]="id" [ciudadano]="true" />
                      }
                      <app-actos-notificacion [expedienteId]="id" [expediente]="ap.expediente" />
                      <app-presentaciones-admision [expedienteId]="id" [numeroExpediente]="ap.expediente"
                        contexto="ciudadano" [ocultarSinAdmision]="true" />
                    </div>
                  }
                </article>
              } @empty {
                <div class="rounded-lg p-8 text-center" style="background: var(--card); border: 1px solid var(--border)">
                  @if (busqueda().trim()) {
                    <p class="text-sm font-medium">Ninguna actuación coincide con «{{ busqueda() }}».</p>
                    <p class="text-xs text-muted-foreground mt-1">Pruebe con el número SAIP, el expediente del Tribunal o el asunto.</p>
                  } @else {
                    <p class="text-sm font-medium">No hay apelaciones en esta cuenta</p>
                    <p class="text-xs text-muted-foreground mt-1">Cuando el Tribunal registre una comunicación, aparecerá en esta vista.</p>
                  }
                </div>
              }
            </div>
            @if (p.totalPaginas > 1) {
              <div class="flex gap-2">
                <button type="button" class="btn-ghost-brand" [disabled]="!p.pagina" (click)="consultar(p.pagina - 1)">Anterior</button>
                <button type="button" class="btn-ghost-brand" [disabled]="p.pagina + 1 >= p.totalPaginas" (click)="consultar(p.pagina + 1)">Siguiente</button>
              </div>
            }
          }
        </div>
      }
    </section>
  `,
})
export class BandejaTribunalComponent {
  readonly entidad = input(false);
  readonly integrada = input(false);
  private readonly panel = inject(PanelQueryService);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly abierta = signal(false);
  readonly cargando = signal(false);
  readonly error = signal(false);
  readonly pagina = signal<PanelPage<PanelApelacion> | null>(null);
  readonly seleccion = signal<number | null>(null);
  readonly busqueda = signal('');
  private revisionConsulta = 0;
  private busquedaTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroy.onDestroy(() => clearTimeout(this.busquedaTimer));
    effect(() => {
      this.auth.cambiosSesion?.();
      const integrada = this.integrada();
      clearTimeout(this.busquedaTimer);
      this.busqueda.set('');
      this.revisionConsulta++;
      this.abierta.set(integrada);
      this.pagina.set(null);
      this.seleccion.set(null);
      if (integrada) this.consultar(0);
    });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor.slice(0, 120));
    clearTimeout(this.busquedaTimer);
    this.busquedaTimer = setTimeout(() => this.consultar(0), 250);
  }

  limpiarBusqueda(): void {
    clearTimeout(this.busquedaTimer);
    this.busqueda.set('');
    this.consultar(0);
  }

  alternar(): void {
    this.abierta.update(abierta => !abierta);
    this.seleccion.set(null);
    if (this.abierta()) this.consultar(0);
  }

  consultar(pagina: number): void {
    const revision = ++this.revisionConsulta;
    this.cargando.set(true);
    this.error.set(false);
    this.seleccion.set(null);
    const texto = untracked(() => this.busqueda().trim());
    this.panel.apelaciones({ pagina, tamano: 10, ...(texto ? { busqueda: texto } : {}) }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: respuesta => {
        if (revision !== this.revisionConsulta) return;
        this.pagina.set(respuesta);
        this.cargando.set(false);
      },
      error: () => {
        if (revision !== this.revisionConsulta) return;
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }
}
