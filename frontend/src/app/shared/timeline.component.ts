import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideCheckCircle,
  LucideFileCheck,
  LucideGavel,
  LucideMail,
  LucideScale,
  LucideSearch
} from '@lucide/angular';

export interface TimelineEvent {
  title: string;
  description: string;
  date: string;
  status: 'completed' | 'current' | 'pending';
  icon: 'mail' | 'search' | 'filecheck' | 'gavel' | 'scale' | 'check';
  instancia?: 1 | 2;
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [
    CommonModule,
    LucideMail,
    LucideSearch,
    LucideFileCheck,
    LucideGavel,
    LucideScale,
    LucideCheckCircle
  ],
  template: `
    <div class="space-y-0">
      @for (event of events(); track $index) {
        <div class="flex gap-4 relative">
          <!-- Línea vertical del timeline -->
          @if (!$last) {
            <div
              class="absolute left-[22px] top-[44px] bottom-0 w-[2px]"
              [class.bg-[#C8102E]/20]="event.status === 'completed'"
              [class.bg-border]="event.status !== 'completed'">
            </div>
          }

          <!-- Círculo de ícono -->
          <div
            class="relative z-10 w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            [ngClass]="getIconStyles(event.status, event.icon)"
            [class.animate-pulse]="event.status === 'current'">
            @switch (event.icon) {
              @case ('mail') {
                <svg lucideMail class="w-5 h-5"></svg>
              }
              @case ('search') {
                <svg lucideSearch class="w-5 h-5"></svg>
              }
              @case ('filecheck') {
                <svg lucideFileCheck class="w-5 h-5"></svg>
              }
              @case ('gavel') {
                <svg lucideGavel class="w-5 h-5"></svg>
              }
              @case ('scale') {
                <svg lucideScale class="w-5 h-5"></svg>
              }
              @case ('check') {
                <svg lucideCheckCircle class="w-5 h-5"></svg>
              }
              @default {
                <svg lucideMail class="w-5 h-5"></svg>
              }
            }
          </div>

          <!-- Contenido del evento -->
          <div class="flex-1 pb-6">
            <div
              class="rounded-lg p-4 transition-all"
              [class.bg-[color:var(--brand-muted)]]="event.status === 'current'"
              [class.border]="true"
              [class.border-[#C8102E]/15]="event.status === 'current'"
              [class.bg-[color:var(--card)]]="event.status === 'completed'"
              [class.border-border/50]="event.status === 'completed'"
              [class.bg-muted/40]="event.status === 'pending'"
              [class.border-dashed]="event.status === 'pending'"
              [class.border-border]="event.status === 'pending'">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                  <h4
                    class="text-sm font-medium"
                    [class.text-muted-foreground]="event.status === 'pending'"
                    [class.text-foreground]="event.status !== 'pending'">
                    {{ event.title }}
                  </h4>
                  <p
                    class="text-sm mt-1"
                    [class.text-muted-foreground/60]="event.status === 'pending'"
                    [class.text-muted-foreground]="event.status !== 'pending'">
                    {{ event.description }}
                  </p>
                </div>
                @if (event.date && event.date !== '—') {
                  <span
                    class="text-xs whitespace-nowrap px-2 py-0.5 rounded"
                    [class.bg-[#C8102E]/10]="event.status === 'current'"
                    [class.text-[#C8102E]]="event.status === 'current'"
                    [class.font-medium]="event.status === 'current'"
                    [class.text-muted-foreground]="event.status === 'completed'"
                    [class.text-muted-foreground/50]="event.status === 'pending'"
                    [class.italic]="event.status === 'pending'">
                    {{ event.date }}
                  </span>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineComponent {
  readonly events = input.required<TimelineEvent[]>();

  getIconStyles(status: string, iconName: string): string {
    if (status === 'completed') {
      const colorMap: Record<string, string> = {
        mail: 'bg-[#2563EB] text-white ring-4 ring-[#2563EB]/20',
        search: 'bg-[#D97706] text-white ring-4 ring-[#D97706]/20',
        filecheck: 'bg-[#059669] text-white ring-4 ring-[#059669]/20',
        gavel: 'bg-[#F97316] text-white ring-4 ring-[#F97316]/20',
        scale: 'bg-[#C8102E] text-white ring-4 ring-[#C8102E]/20',
        check: 'bg-[#059669] text-white ring-4 ring-[#059669]/20',
      };
      return colorMap[iconName] || colorMap['mail'];
    }
    if (status === 'current') {
      return 'bg-[#C8102E] text-white ring-4 ring-[#C8102E]/25';
    }
    return 'bg-muted text-muted-foreground';
  }
}
