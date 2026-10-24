import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideBuilding2, LucideInfo } from '@lucide/angular';

/** Reference area panel, without pretending that its prototype-only local assignment is persisted. */
@Component({
  selector: 'app-response-context',
  imports: [LucideBuilding2, LucideInfo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="form-shell" aria-label="Área responsable">
      <div class="form-section-header">
        <span class="eyebrow flex items-center gap-2"><svg lucideBuilding2 class="w-3 h-3" aria-hidden="true"></svg>Atención interna</span>
        <h2 class="font-display" style="font-size: 18px; letter-spacing: -0.01em">Área responsable de su atención</h2>
      </div>
      <p class="p-5 text-sm text-muted-foreground flex items-start gap-3">
        <svg lucideInfo class="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true"></svg>
        La asignación de área y responsable no está disponible en el servicio actual. No se ha registrado una asignación desde esta pantalla.
      </p>
    </section>`
})
export class ResponseContextComponent {}
