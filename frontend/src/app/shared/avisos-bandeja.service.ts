import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { PanelQueryService } from '../services/panel-query.service';
import { Aviso, avisosDelActor } from './avisos-bandeja';

type Rol = 'CIUDADANO' | 'FUNCIONARIO' | 'TTAIP';
type Estado = 'sin-consultar' | 'cargando' | 'disponible' | 'vacio' | 'error';
const REFRESCO_MS = 60_000;

/** Una sola consulta compartida por las dos campanas del encabezado. */
@Injectable({ providedIn: 'root' })
export class AvisosBandejaService {
  private readonly panel = inject(PanelQueryService);
  private suscripcion?: Subscription;
  private timer?: ReturnType<typeof setInterval>;
  private clave: string | null = null;
  private primera = true;
  private conocidos = new Set<string>();
  readonly estado = signal<Estado>('sin-consultar');
  readonly avisos = signal<Aviso[]>([]);
  /** Avisos que aparecieron después de la primera consulta. La carga inicial no avisa. */
  readonly recienLlegados = signal<Aviso[]>([]);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  sincronizar(usuarioId: number, rol: Rol): void {
    const clave = `${usuarioId}:${rol}`;
    if (this.clave === clave && this.estado() !== 'sin-consultar') return;
    this.clave = clave;
    this.primera = true;
    this.conocidos.clear();
    this.recienLlegados.set([]);
    this.limpiarTimer();
    this.cargar(rol, clave);
    this.timer = setInterval(() => {
      if (this.clave === clave) this.cargar(rol, clave);
    }, REFRESCO_MS);
  }

  reintentar(usuarioId: number, rol: Rol): void {
    if (this.clave !== `${usuarioId}:${rol}`) return;
    this.clave = null;
    this.sincronizar(usuarioId, rol);
  }

  limpiarNovedades(): void {
    this.recienLlegados.set([]);
  }

  detener(): void {
    this.clave = null;
    this.primera = true;
    this.conocidos.clear();
    this.limpiarTimer();
    this.suscripcion?.unsubscribe();
    this.suscripcion = undefined;
    this.avisos.set([]);
    this.recienLlegados.set([]);
    this.estado.set('sin-consultar');
  }

  private cargar(rol: Rol, clave: string): void {
    this.suscripcion?.unsubscribe();
    if (this.primera) {
      this.estado.set('cargando');
      this.avisos.set([]);
    }
    this.suscripcion = forkJoin({
      solicitudes: this.panel.solicitudes({ pagina: 0, tamano: 100 }),
      apelaciones: this.panel.apelaciones({ pagina: 0, tamano: 100 }),
    }).subscribe({
      next: datos => {
        if (this.clave !== clave) return;
        const solicitudes = datos.solicitudes?.contenido;
        const apelaciones = datos.apelaciones?.contenido;
        if (!Array.isArray(solicitudes) || !Array.isArray(apelaciones)) {
          if (this.primera) this.estado.set('error');
          return;
        }
        this.publicar(avisosDelActor(rol, solicitudes, apelaciones));
      },
      error: () => {
        if (this.clave !== clave || !this.primera) return;
        this.avisos.set([]);
        this.estado.set('error');
      },
    });
  }

  private publicar(avisos: Aviso[]): void {
    if (!this.primera) {
      const nuevos = avisos.filter(aviso => !this.conocidos.has(aviso.id));
      if (nuevos.length) this.recienLlegados.set(nuevos);
    }
    this.conocidos = new Set(avisos.map(aviso => aviso.id));
    this.primera = false;
    this.avisos.set(avisos);
    this.estado.set(avisos.length ? 'disponible' : 'vacio');
  }

  private limpiarTimer(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
