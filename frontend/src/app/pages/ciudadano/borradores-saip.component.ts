import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideArrowLeft, LucideFileText, LucideTrash2 } from '@lucide/angular';
import { AuthService } from '../../services/auth.service';
import { BorradorSaip, BorradorSaipService } from '../../services/borrador-saip.service';

@Component({
  selector: 'app-borradores-saip',
  imports: [RouterLink, LucideArrowLeft, LucideFileText, LucideTrash2],
  templateUrl: './borradores-saip.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BorradoresSaipComponent implements OnDestroy {
  private readonly borradores = inject(BorradorSaipService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private consultas = new Subscription();
  private token = this.auth.getToken();
  private revision = this.auth.cambiosSesion();
  readonly lista = signal<BorradorSaip[]>([]);
  readonly estado = signal<'cargando' | 'disponible' | 'vacio' | 'error'>('cargando');
  readonly error = signal('');
  readonly confirmado = signal<number | null>(null);

  constructor() {
    effect(() => {
      this.auth.cambiosSesion();
      untracked(() => this.cargar());
    });
  }

  ngOnDestroy(): void { this.consultas.unsubscribe(); }

  cargar(): void {
    this.consultas.unsubscribe();
    this.consultas = new Subscription();
    this.token = this.auth.getToken();
    this.revision = this.auth.cambiosSesion();
    this.lista.set([]);
    this.confirmado.set(null);
    this.error.set('');
    if (!this.token) {
      this.estado.set('error');
      this.error.set('Inicie sesión para ver sus borradores.');
      return;
    }
    const token = this.token;
    const revision = this.revision;
    this.estado.set('cargando');
    this.consultas.add(this.borradores.listar().subscribe({
      next: data => {
        if (!this.vigente(token, revision)) return;
        if (!Array.isArray(data) || data.some(item => !item || !Number.isSafeInteger(item.id) || item.id <= 0)) {
          this.estado.set('error');
          this.error.set('No se pudo mostrar la lista de borradores.');
          return;
        }
        this.lista.set(data);
        this.estado.set(data.length ? 'disponible' : 'vacio');
      },
      error: () => {
        if (!this.vigente(token, revision)) return;
        this.estado.set('error');
        this.error.set('No se pudieron consultar sus borradores.');
      },
    }));
  }

  continuar(borrador: BorradorSaip): void {
    void this.router.navigate(['/ciudadano/nueva-saip'], { queryParams: { borrador: borrador.id } });
  }

  pedirDescarte(id: number): void { this.confirmado.set(id); }

  descartar(borrador: BorradorSaip): void {
    const token = this.token;
    const revision = this.revision;
    this.consultas.add(this.borradores.eliminar(borrador.id).subscribe({
      next: () => {
        if (!this.vigente(token, revision)) return;
        this.lista.update(actual => actual.filter(item => item.id !== borrador.id));
        this.confirmado.set(null);
        this.estado.set(this.lista().length ? 'disponible' : 'vacio');
      },
      error: () => {
        if (!this.vigente(token, revision)) return;
        this.error.set('No se pudo descartar el borrador. Sigue en su cuenta.');
      },
    }));
  }

  titulo(borrador: BorradorSaip): string {
    return borrador.asunto?.trim() || 'Solicitud sin asunto';
  }

  detalle(borrador: BorradorSaip): string {
    const entidad = borrador.entidadNombre?.trim() || 'Sin entidad elegida';
    return `${entidad} · ${this.fecha(borrador.actualizado)}`;
  }

  private fecha(valor: string): string {
    const marca = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor || '');
    return marca ? `${marca[3]}/${marca[2]}/${marca[1]} ${marca[4]}:${marca[5]}` : 'Fecha no disponible';
  }

  private vigente(token: string | null, revision: number): boolean {
    return token === this.auth.getToken() && revision === this.auth.cambiosSesion();
  }
}
