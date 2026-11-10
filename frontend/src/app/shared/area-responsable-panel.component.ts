import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideBuilding2 } from '@lucide/angular';

/** The current contract identifies the entity, not an internal assignment per request. */
@Component({
  selector: 'app-area-responsable-panel',
  imports: [LucideBuilding2],
  templateUrl: './area-responsable-panel.component.html',
  styleUrl: './area-responsable-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AreaResponsablePanelComponent {
  readonly expediente = input.required<string>();
  readonly entidad = input<string | null>(null);
  readonly readOnly = input<boolean>(false);
}
