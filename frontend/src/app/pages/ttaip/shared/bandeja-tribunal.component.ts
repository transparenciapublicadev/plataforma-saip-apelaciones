import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PanelQueryService } from '../../../services/panel-query.service';
import { AuthService } from '../../../services/auth.service';
import { PanelApelacion, PanelPage } from '../../../models/panel-query.model';
import { ActosNotificacionComponent } from './actos-notificacion.component';

@Component({
  selector: 'app-bandeja-tribunal',
  imports: [RouterLink, ActosNotificacionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="form-shell mb-6">
      <div class="form-section-header">
        <button type="button" class="btn-ghost-brand" [attr.aria-expanded]="abierta()" (click)="alternar()">
          {{ entidad() ? 'Comunicaciones del Tribunal' : 'Apelaciones y notificaciones del Tribunal' }}
        </button>
      </div>
      @if (abierta()) {
        <div class="p-4 space-y-3">
          @if (error()) {
            <p role="alert" class="text-sm text-destructive">No se pudieron consultar las apelaciones.</p>
            <button type="button" class="btn-ghost-brand" (click)="consultar(0)">Reintentar</button>
          } @else if (cargando()) {
            <p role="status" class="text-sm">Consultando apelaciones…</p>
          } @else if (pagina(); as p) {
            @for (ap of p.contenido; track ap.id) {
              <article class="border border-border rounded-lg p-3 text-sm">
                <div class="flex flex-wrap gap-2 justify-between items-center">
                  <span class="font-mono">{{ ap.expediente }}</span>
                  @if (entidad()) {
                    @if (ap.informacionComplementariaPendiente) {
                      <a class="btn-brand" [routerLink]="['/funcionario/apelaciones', ap.expediente]" [queryParams]="{ tab: 'subprocesos' }">
                        Responder información complementaria
                      </a>
                    }
                    <a class="btn-ghost-brand" [routerLink]="['/funcionario/apelaciones', ap.expediente]" [queryParams]="{ tab: 'notificaciones' }">
                      Ver expediente y notificaciones
                    </a>
                  } @else if (ap.expedienteTtaip?.id) {
                    <button type="button" class="btn-ghost-brand" [attr.aria-expanded]="seleccion() === ap.id"
                      (click)="seleccion.set(seleccion() === ap.id ? null : ap.id)">Ver notificaciones</button>
                  }
                </div>
                @if (seleccion() === ap.id && ap.expedienteTtaip?.id; as id) {
                  <div class="mt-3"><app-actos-notificacion [expedienteId]="id" [expediente]="ap.expediente" /></div>
                }
              </article>
            } @empty {
              <p class="text-sm text-muted-foreground">No hay apelaciones registradas para esta cuenta.</p>
            }
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
  private readonly panel = inject(PanelQueryService);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly abierta = signal(false);
  readonly cargando = signal(false);
  readonly error = signal(false);
  readonly pagina = signal<PanelPage<PanelApelacion> | null>(null);
  readonly seleccion = signal<number | null>(null);
  private revisionConsulta = 0;

  constructor() {
    effect(() => {
      this.auth.cambiosSesion?.();
      this.revisionConsulta++;
      this.abierta.set(false);
      this.pagina.set(null);
      this.seleccion.set(null);
    });
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
    this.panel.apelaciones({ pagina, tamano: 10 }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
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
