import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideGavel } from '@lucide/angular';
import { BandejaTribunalComponent } from '../ttaip/shared/bandeja-tribunal.component';

@Component({
  selector: 'app-comunicaciones-tribunal',
  imports: [RouterLink, LucideArrowLeft, LucideGavel, BandejaTribunalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comunicaciones-tribunal.component.html'
})
export class ComunicacionesTribunalComponent {
  private readonly route = inject(ActivatedRoute);
  readonly entidad = this.route.snapshot.data['entidad'] === true;
  readonly panel = this.entidad ? '/funcionario' : '/ciudadano';
}
