import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  LucideAlertTriangle,
  LucideBell,
  LucideCheckCheck,
  LucideCheckCircle2,
  LucideClock,
  LucideGavel,
  LucideHourglass,
  LucideInbox,
  LucideScale
} from '@lucide/angular';

export interface NotificationItem {
  id: string;
  iconName: 'alert' | 'scale' | 'gavel' | 'hourglass' | 'check' | 'clock';
  titulo: string;
  detalle: string;
  fecha?: string;
  ruta: string;
  expediente?: string;
  tone: 'brand' | 'gold' | 'info' | 'success' | 'danger';
  urgente?: boolean;
}

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [
    CommonModule,
    LucideBell,
    LucideCheckCheck,
    LucideInbox,
    LucideAlertTriangle,
    LucideScale,
    LucideGavel,
    LucideHourglass,
    LucideCheckCircle2,
    LucideClock
  ],
  template: `
    <div class="relative inline-block text-left" #container>
      <!-- Botón de la campanita -->
      <button
        type="button"
        (click)="toggleOpen()"
        class="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
        [attr.aria-expanded]="abierto()"
        aria-label="Ver notificaciones">
        <svg lucideBell class="w-4 h-4"></svg>

        <!-- Badge de contador de no leídas -->
        @if (noLeidasCount() > 0) {
          <span
            class="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse"
            style="background: var(--brand-600); box-shadow: 0 0 0 2px var(--background);">
            {{ noLeidasCount() > 9 ? '9+' : noLeidasCount() }}
          </span>
        }
      </button>

      <!-- Menú desplegable / Popover -->
      @if (abierto()) {
        <div
          class="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden animate-fade-in-down"
          style="box-shadow: var(--shadow-xl); max-height: 480px; display: flex; flex-direction: column;">

          <!-- Cabecera del popover -->
          <div class="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-foreground">Notificaciones</span>
              @if (noLeidasCount() > 0) {
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" style="background: var(--brand-subtle); color: var(--brand-700); border: 1px solid var(--brand-200)">
                  {{ noLeidasCount() }} nueva{{ noLeidasCount() === 1 ? '' : 's' }}
                </span>
              }
            </div>

            @if (noLeidasCount() > 0) {
              <button
                type="button"
                (click)="marcarTodasComoLeidas()"
                class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                title="Marcar todas como leídas">
                <svg lucideCheckCheck class="w-3.5 h-3.5"></svg>
                <span>Leídas</span>
              </button>
            }
          </div>

          <!-- Listado de notificaciones -->
          <div class="overflow-y-auto divide-y divide-border/60 max-h-[380px] custom-scrollbar">
            @if (items().length === 0) {
              <div class="p-8 text-center">
                <div class="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style="background: var(--brand-subtle)">
                  <svg lucideInbox class="w-5 h-5" style="color: var(--brand-700)"></svg>
                </div>
                <p class="text-sm font-medium text-foreground">Sin notificaciones pendientes</p>
                <p class="text-xs text-muted-foreground mt-1">Le avisaremos ante cualquier novedad sobre sus expedientes.</p>
              </div>
            } @else {
              @for (notif of items(); track notif.id) {
                <div
                  (click)="seleccionarNotificacion(notif)"
                  class="p-3.5 transition-colors cursor-pointer flex items-start gap-3 hover:bg-[color:var(--brand-subtle)]"
                  [style.background]="esLeida(notif.id) ? 'var(--card)' : 'color-mix(in srgb, var(--brand-subtle) 40%, var(--card))'">

                  <!-- Ícono temático -->
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    [style.background]="getToneBg(notif.tone)"
                    [style.border]="'1px solid ' + getToneBorder(notif.tone)">
                    @switch (notif.iconName) {
                      @case ('alert') {
                        <svg lucideAlertTriangle class="w-4 h-4" [style.color]="getToneFg(notif.tone)"></svg>
                      }
                      @case ('scale') {
                        <svg lucideScale class="w-4 h-4" [style.color]="getToneFg(notif.tone)"></svg>
                      }
                      @case ('gavel') {
                        <svg lucideGavel class="w-4 h-4" [style.color]="getToneFg(notif.tone)"></svg>
                      }
                      @case ('hourglass') {
                        <svg lucideHourglass class="w-4 h-4" [style.color]="getToneFg(notif.tone)"></svg>
                      }
                      @case ('check') {
                        <svg lucideCheckCircle2 class="w-4 h-4" [style.color]="getToneFg(notif.tone)"></svg>
                      }
                      @default {
                        <svg lucideClock class="w-4 h-4" [style.color]="getToneFg(notif.tone)"></svg>
                      }
                    }
                  </div>

                  <!-- Contenido textual -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                      <p class="text-xs font-semibold text-foreground truncate" [class.font-bold]="!esLeida(notif.id)">
                        {{ notif.titulo }}
                      </p>
                      @if (!esLeida(notif.id)) {
                        <span class="w-2 h-2 rounded-full flex-shrink-0" style="background: var(--brand-600)"></span>
                      }
                    </div>

                    <p class="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {{ notif.detalle }}
                    </p>

                    <div class="flex items-center gap-2 mt-1.5">
                      @if (notif.urgente) {
                        <span class="text-[10px] font-semibold px-1.5 py-0.2 rounded" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A">
                          Plazo en curso
                        </span>
                      }
                      <span class="text-[10.5px] text-muted-foreground font-mono">
                        {{ notif.fecha || 'Hoy' }}
                      </span>
                    </div>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Pie del popover -->
          <div class="px-4 py-2 border-t border-border bg-card/60 text-center">
            <span class="text-[10.5px] tracking-wider uppercase text-muted-foreground">
              Sistema de Alertas SAIP · Ley N° 27806
            </span>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBellComponent implements OnInit {
  readonly userType = input<string | null>(null);

  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  abierto = signal<boolean>(false);
  readIds = signal<Set<string>>(new Set());

  // Notificaciones contextuales según el rol
  items = signal<NotificationItem[]>([]);

  noLeidasCount = computed(() => {
    const ids = this.readIds();
    return this.items().filter(i => !ids.has(i.id)).length;
  });

  ngOnInit(): void {
    this.cargarEstadoLeidas();
    this.generarNotificacionesPorRol();
  }

  private getStorageKey(): string {
    return `saip.notif.read.${this.userType() || 'anon'}`;
  }

  private cargarEstadoLeidas(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        this.readIds.set(new Set(JSON.parse(raw)));
      }
    } catch {
      // Ignorar fallo de almacenamiento
    }
  }

  private persistirLeidas(s: Set<string>): void {
    this.readIds.set(new Set(s));
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify([...s]));
    } catch {
      // Ignorar
    }
  }

  toggleOpen(): void {
    this.abierto.set(!this.abierto());
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.abierto.set(false);
    }
  }

  esLeida(id: string): boolean {
    return this.readIds().has(id);
  }

  marcarTodasComoLeidas(): void {
    const s = new Set(this.readIds());
    this.items().forEach(i => s.add(i.id));
    this.persistirLeidas(s);
  }

  seleccionarNotificacion(n: NotificationItem): void {
    const s = new Set(this.readIds());
    s.add(n.id);
    this.persistirLeidas(s);
    this.abierto.set(false);

    if (n.expediente) {
      this.router.navigate([n.ruta, n.expediente]);
    } else {
      this.router.navigate([n.ruta]);
    }
  }

  private generarNotificacionesPorRol(): void {
    const rol = (this.userType() || '').toUpperCase();

    if (rol === 'CIUDADANO') {
      this.items.set([
        {
          id: 'notif-ciu-1',
          iconName: 'alert',
          titulo: 'Precisión requerida en su solicitud',
          detalle: 'Ministerio de Educación · Dispone de 2 días hábiles para aclarar su pedido.',
          fecha: 'Hoy',
          ruta: '/precision-form',
          expediente: 'SAIP-2026-00012',
          tone: 'gold',
          urgente: true
        },
        {
          id: 'notif-ciu-2',
          iconName: 'scale',
          titulo: 'Plazo para apelar disponible',
          detalle: 'Municipalidad de Lima emitió respuesta parcial. Puede apelar ante el Tribunal.',
          fecha: 'Ayer',
          ruta: '/ciudadano/nueva-apelacion',
          expediente: 'SAIP-2026-00004',
          tone: 'brand',
          urgente: true
        },
        {
          id: 'notif-ciu-3',
          iconName: 'check',
          titulo: 'Respuesta recibida',
          detalle: 'SUSALUD ha entregado la documentación solicitada en copia digital.',
          fecha: 'Hace 3 días',
          ruta: '/ciudadano/solicitud',
          expediente: 'SAIP-2026-00002',
          tone: 'success'
        }
      ]);
    } else if (rol === 'FUNCIONARIO') {
      this.items.set([
        {
          id: 'notif-fun-1',
          iconName: 'hourglass',
          titulo: 'Solicitud por vencer (plazo 10 días)',
          detalle: 'Expediente SAIP-2026-00018 vence en 2 días hábiles. Prepare la respuesta.',
          fecha: 'Hoy',
          ruta: '/funcionario/responder',
          expediente: 'SAIP-2026-00018',
          tone: 'gold',
          urgente: true
        },
        {
          id: 'notif-fun-2',
          iconName: 'gavel',
          titulo: 'Requerimiento de cumplimiento TTAIP',
          detalle: 'Tribunal declaró fundada apelación. Plazo legal de 7 días para entregar información.',
          fecha: 'Ayer',
          ruta: '/funcionario',
          tone: 'danger',
          urgente: true
        }
      ]);
    } else if (rol === 'TTAIP') {
      this.items.set([
        {
          id: 'notif-ttaip-1',
          iconName: 'scale',
          titulo: 'Apelación por calificar (1ra calificación)',
          detalle: 'Expediente 00124-2026-JUS/TTAIP asignado a su sala para evaluación preliminar.',
          fecha: 'Hoy',
          ruta: '/ttaip/calificar',
          expediente: '00124-2026-JUS/TTAIP',
          tone: 'brand',
          urgente: true
        },
        {
          id: 'notif-ttaip-2',
          iconName: 'hourglass',
          titulo: 'Cumplimiento vencido de entidad',
          detalle: 'Muni Lima no acreditó entrega en 7 días. Corresponde abrir proceso disciplinario.',
          fecha: 'Ayer',
          ruta: '/ttaip/cumplimiento',
          tone: 'danger',
          urgente: true
        }
      ]);
    } else {
      this.items.set([
        {
          id: 'notif-gen-1',
          iconName: 'clock',
          titulo: 'Bienvenido al Sistema SAIP',
          detalle: 'Consulte el estado de sus trámites o presente una nueva solicitud.',
          fecha: 'Hoy',
          ruta: '/ayuda',
          tone: 'info'
        }
      ]);
    }
  }

  getToneBg(tone: string): string {
    switch (tone) {
      case 'gold': return '#FAF3E2';
      case 'success': return '#E7F6EC';
      case 'info': return '#E6EFFE';
      case 'danger': return '#FCEDF1';
      default: return 'var(--brand-subtle)';
    }
  }

  getToneFg(tone: string): string {
    switch (tone) {
      case 'gold': return '#7A5A1F';
      case 'success': return '#15803D';
      case 'info': return '#1D4ED8';
      case 'danger': return '#BE123C';
      default: return 'var(--brand-700)';
    }
  }

  getToneBorder(tone: string): string {
    switch (tone) {
      case 'gold': return '#EAD8A8';
      case 'success': return '#BFE3CB';
      case 'info': return '#BFD3F8';
      case 'danger': return '#F1C2D0';
      default: return 'var(--brand-200)';
    }
  }
}
