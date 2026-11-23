import { Injectable, inject, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { PanelQueryService } from '../services/panel-query.service';
import { Aviso, avisosDelActor } from './avisos-bandeja';

type Rol = 'CIUDADANO' | 'FUNCIONARIO' | 'TTAIP';
type Estado = 'sin-consultar' | 'cargando' | 'disponible' | 'vacio' | 'error';

/** Una sola consulta compartida por las dos campanas del encabezado. */
@Injectable({ providedIn: 'root' })
export class AvisosBandejaService {
  private readonly panel = inject(PanelQueryService);
  private suscripcion?: Subscription;
  private clave: string | null = null;
  readonly estado = signal<Estado>('sin-consultar');
  readonly avisos = signal<Aviso[]>([]);

  sincronizar(usuarioId: number, rol: Rol): void {
    const clave = `${usuarioId}:${rol}`;
    if (this.clave === clave && this.estado() !== 'sin-consultar') return;
    this.clave = clave;
    this.suscripcion?.unsubscribe();
    this.estado.set('cargando');
    this.avisos.set([]);
    this.suscripcion = forkJoin({
      solicitudes: this.panel.solicitudes({ pagina: 0, tamano: 100 }),
      apelaciones: this.panel.apelaciones({ pagina: 0, tamano: 100 }),
    }).subscribe({
      next: datos => {
        if (this.clave !== clave) return;
        const solicitudes = datos.solicitudes?.contenido;
        const apelaciones = datos.apelaciones?.contenido;
        if (!Array.isArray(solicitudes) || !Array.isArray(apelaciones)) {
          this.estado.set('error');
          return;
        }
        const avisos = avisosDelActor(rol, solicitudes, apelaciones);
        this.avisos.set(avisos);
        this.estado.set(avisos.length ? 'disponible' : 'vacio');
      },
      error: () => {
        if (this.clave === clave) {
          this.avisos.set([]);
          this.estado.set('error');
        }
      },
    });
  }

  reintentar(usuarioId: number, rol: Rol): void {
    if (this.clave !== `${usuarioId}:${rol}`) return;
    this.clave = null;
    this.sincronizar(usuarioId, rol);
  }

  detener(): void {
    this.clave = null;
    this.suscripcion?.unsubscribe();
    this.suscripcion = undefined;
    this.avisos.set([]);
    this.estado.set('sin-consultar');
  }
}
