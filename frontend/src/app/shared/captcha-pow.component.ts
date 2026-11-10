import {
  Component,
  OnInit,
  OnDestroy,
  input,
  output,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface RetoConsulta {
  algorithm: string;
  challenge: string;
  salt: string;
  maxnumber: number;
  signature: string;
  local?: boolean;
}

const CODIGO_WORKER = `
self.onmessage = async (e) => {
  const { salt, challenge, max } = e.data;
  const enc = new TextEncoder();
  const objetivo = new Uint8Array(challenge.match(/.{2}/g).map((h) => parseInt(h, 16)));
  for (let n = 0; n <= max; n++) {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(salt + n)));
    let igual = true;
    for (let i = 0; i < 32; i++) { if (d[i] !== objetivo[i]) { igual = false; break; } }
    if (igual) { self.postMessage({ n }); return; }
  }
  self.postMessage({ n: -1 });
};`;

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function retoLocal(): Promise<RetoConsulta> {
  const rnd = crypto.getRandomValues(new Uint8Array(12));
  const salt = `${hex(rnd.buffer)}?e=${Date.now() + 5 * 60000}`;
  const numero = Math.floor(Math.random() * 40000);
  const challenge = hex(await crypto.subtle.digest('SHA-256', enc.encode(`${salt}${numero}`)));
  return { algorithm: 'SHA-256', challenge, salt, maxnumber: 40000, signature: 'local', local: true };
}

export async function resolverEnHilo(reto: RetoConsulta): Promise<number> {
  const objetivo = reto.challenge;
  for (let n = 0; n <= reto.maxnumber; n++) {
    if (hex(await crypto.subtle.digest('SHA-256', enc.encode(`${reto.salt}${n}`))) === objetivo) return n;
    if (n % 400 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return -1;
}

export function resolver(reto: RetoConsulta): { promesa: Promise<number>; cancelar: () => void } {
  if (typeof Worker === 'undefined') return { promesa: resolverEnHilo(reto), cancelar: () => {} };
  let worker: Worker | null = null;
  let url = '';
  try {
    url = URL.createObjectURL(new Blob([CODIGO_WORKER], { type: 'text/javascript' }));
    worker = new Worker(url);
  } catch {
    return { promesa: resolverEnHilo(reto), cancelar: () => {} };
  }
  const w = worker;
  const promesa = new Promise<number>((resolve) => {
    w.onmessage = (e) => {
      resolve(Number(e.data?.n ?? -1));
      w.terminate();
      URL.revokeObjectURL(url);
    };
    w.onerror = () => {
      w.terminate();
      URL.revokeObjectURL(url);
      resolverEnHilo(reto).then(resolve);
    };
    w.postMessage({ salt: reto.salt, challenge: reto.challenge, max: reto.maxnumber });
  });
  return {
    promesa,
    cancelar: () => {
      w.terminate();
      URL.revokeObjectURL(url);
    }
  };
}

export type CaptchaEstado = 'verificando' | 'verificado' | 'error' | 'espera';

@Component({
  selector: 'app-captcha-pow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="rounded-lg px-4 py-3 flex items-center gap-3 transition-colors duration-200"
      [style.background]="'var(--paper)'"
      [style.border]="'1px solid ' + bordeColor()"
    >
      <span
        class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
        [style.border]="'2px solid ' + tonoColor()"
        [style.background]="estado() === 'verificado' ? tonoColor() : 'transparent'"
        aria-hidden="true"
      >
        @if (estado() === 'verificando') {
          <svg class="w-3.5 h-3.5 animate-spin" [style.color]="tonoColor()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
        }
        @if (estado() === 'verificado') {
          <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="m9 12 2 2 4-4"></path>
          </svg>
        }
        @if (estado() === 'error' || estado() === 'espera') {
          <svg class="w-3.5 h-3.5" [style.color]="tonoColor()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 8V4H8"></path>
            <rect width="16" height="12" x="4" y="8" rx="2"></rect>
            <path d="M2 14h2"></path>
            <path d="M20 14h2"></path>
            <path d="M15 13v2"></path>
            <path d="M9 13v2"></path>
          </svg>
        }
      </span>

      <div class="flex-1 min-w-0" aria-live="polite">
        <div class="text-sm font-medium text-foreground">
          @if (estado() === 'verificando') { Comprobando que no es un robot… }
          @if (estado() === 'verificado') { No soy un robot · verificado }
          @if (estado() === 'error') { No se pudo completar la verificación }
          @if (estado() === 'espera') { Demasiadas consultas seguidas. Espere {{ espera() }} s }
        </div>
        <div class="text-[11px] text-muted-foreground">
          Verificación automática y accesible, sin imágenes ni datos personales.
        </div>
      </div>

      @if (estado() === 'error' || estado() === 'verificado') {
        <button
          type="button"
          (click)="iniciar()"
          class="p-1.5 rounded-md hover:bg-[color:var(--brand-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
          title="Generar una nueva verificación"
          aria-label="Generar una nueva verificación"
        >
          <svg class="w-4 h-4 text-muted-foreground hover:text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
            <path d="M8 16H3v5"></path>
          </svg>
        </button>
      }
    </div>
  `
})
export class CaptchaPoWComponent implements OnInit, OnDestroy {
  readonly reinicio = input<number>(0);
  readonly pruebaChange = output<string | null>();

  readonly estado = signal<CaptchaEstado>('verificando');
  readonly espera = signal<number>(0);

  private cancelarActual: () => void = () => {};
  private timerEspera: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      // Re-trigger when reinicio changes
      const _ = this.reinicio();
      this.iniciar();
    });
  }

  ngOnInit(): void {
    // Handled by effect
  }

  ngOnDestroy(): void {
    this.cancelarActual();
    if (this.timerEspera) {
      clearInterval(this.timerEspera);
    }
  }

  tonoColor(): string {
    const est = this.estado();
    if (est === 'verificado') return 'var(--success)';
    if (est === 'error') return 'var(--brand-700)';
    return 'var(--info)';
  }

  bordeColor(): string {
    const tono = this.tonoColor();
    return `color-mix(in srgb, ${tono} 35%, var(--border))`;
  }

  async iniciar(): Promise<void> {
    this.cancelarActual();
    this.pruebaChange.emit(null);
    this.estado.set('verificando');

    try {
      const reto = await retoLocal();
      const t0 = performance.now();
      const { promesa, cancelar } = resolver(reto);
      this.cancelarActual = cancelar;

      const n = await promesa;
      if (n < 0) {
        this.estado.set('error');
        return;
      }

      // Duración mínima perceptible: evita parpadeos y marca interacción humana
      const resto = 600 - (performance.now() - t0);
      if (resto > 0) {
        await new Promise((r) => setTimeout(r, resto));
      }

      const tokenObj = {
        algorithm: reto.algorithm,
        challenge: reto.challenge,
        number: n,
        salt: reto.salt,
        signature: reto.signature
      };
      const token = btoa(JSON.stringify(tokenObj));
      this.pruebaChange.emit(token);
      this.estado.set('verificado');
    } catch {
      this.estado.set('error');
    }
  }
}
