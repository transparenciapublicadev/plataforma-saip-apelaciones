import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PlazosConfig {
  saipRespuesta: number;
  saipProrroga: number;
  subsanacion: number;
  recojoInformacion: number;
  apelacionInterposicion: number;
  ttaipResolucion: number;
  ttaipCalificacion: number;
  ttaipSubsanacion: number;
}

export interface NotifConfig {
  vencidas: boolean;
  proximos: boolean;
  registros: boolean;
  umbralProximo: number;
}

export interface TarifasConfig {
  costoPorCopia: number;
}

export interface SystemConfig {
  plazos: PlazosConfig;
  notif: NotifConfig;
  tarifas: TarifasConfig;
}

export interface PlazoDef {
  key: keyof PlazosConfig;
  label: string;
  hint: string;
  fase: 'SAIP' | 'TTAIP';
}

export const DEFAULT_CONFIG: SystemConfig = {
  plazos: {
    saipRespuesta: 10,
    saipProrroga: 7,
    subsanacion: 2,
    recojoInformacion: 5,
    apelacionInterposicion: 15,
    ttaipResolucion: 10,
    ttaipCalificacion: 3,
    ttaipSubsanacion: 2,
  },
  notif: {
    vencidas: true,
    proximos: true,
    registros: false,
    umbralProximo: 2,
  },
  tarifas: {
    costoPorCopia: 0.10,
  },
};

export const PLAZO_DEFS: PlazoDef[] = [
  { key: 'saipRespuesta', label: 'Respuesta a la SAIP', hint: 'Días hábiles de la entidad para atender.', fase: 'SAIP' },
  { key: 'saipProrroga', label: 'Prórroga excepcional', hint: 'Días hábiles adicionales justificados.', fase: 'SAIP' },
  { key: 'subsanacion', label: 'Subsanación de la SAIP', hint: 'Días hábiles del administrado para subsanar.', fase: 'SAIP' },
  { key: 'recojoInformacion', label: 'Recojo de información', hint: 'Días hábiles para recoger la información física.', fase: 'SAIP' },
  { key: 'apelacionInterposicion', label: 'Interposición de apelación', hint: 'Días hábiles para apelar ante el TTAIP.', fase: 'TTAIP' },
  { key: 'ttaipResolucion', label: 'Resolución del TTAIP', hint: 'Días hábiles del Tribunal para resolver.', fase: 'TTAIP' },
  { key: 'ttaipCalificacion', label: 'Calificación de apelación', hint: 'Días hábiles para calificar la apelación.', fase: 'TTAIP' },
  { key: 'ttaipSubsanacion', label: 'Subsanación de apelación', hint: 'Días hábiles para subsanar la apelación.', fase: 'TTAIP' },
];

export const SETTINGS_KEY = 'saip.admin.settings';

@Injectable({
  providedIn: 'root',
})
export class SystemConfigService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly apiUrl = `${environment.apiUrl}/configuracion`;

  private readonly configState = signal<SystemConfig>(this.loadStoredConfig());
  private readonly savedState = signal<SystemConfig>(this.clone(this.configState()));
  private readonly savingState = signal<boolean>(false);

  readonly config = this.configState.asReadonly();
  readonly savedConfig = this.savedState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly loadState = signal<'loading' | 'ready' | 'error' | 'unavailable'>('loading');

  readonly isDirty = computed<boolean>(() => {
    return JSON.stringify(this.configState()) !== JSON.stringify(this.savedState());
  });

  constructor() {
    this.cargarDesdeBackend();
  }

  private clone<T>(val: T): T {
    return JSON.parse(JSON.stringify(val));
  }

  private isServerConfig(value: SystemConfig | null): value is SystemConfig {
    return !!value && (['plazos', 'notif', 'tarifas'] as const).every(section =>
      !!value[section] && Object.keys(DEFAULT_CONFIG[section]).every(key => {
        const field = (value[section] as unknown as Record<string, unknown>)[key];
        const expected = (DEFAULT_CONFIG[section] as unknown as Record<string, unknown>)[key];
        return typeof field === typeof expected && (typeof field !== 'number' || Number.isFinite(field));
      }));
  }

  cargarDesdeBackend(): void {
    if (!this.http) { this.loadState.set('unavailable'); return; }
    this.loadState.set('loading');
    this.http.get<SystemConfig>(this.apiUrl).subscribe({
      next: (data) => {
        if (this.isServerConfig(data)) {
          const merged: SystemConfig = {
            plazos: { ...DEFAULT_CONFIG.plazos, ...(data.plazos || {}) },
            notif: { ...DEFAULT_CONFIG.notif, ...(data.notif || {}) },
            tarifas: { ...DEFAULT_CONFIG.tarifas, ...(data.tarifas || {}) },
          };
          this.configState.set(merged);
          this.savedState.set(this.clone(merged));
          this.loadState.set('ready');
        } else {
          this.loadState.set('unavailable');
        }
      },
      error: () => {
        this.loadState.set('error');
      }
    });
  }

  loadStoredConfig(): SystemConfig {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            plazos: { ...DEFAULT_CONFIG.plazos, ...(parsed.plazos || {}) },
            notif: { ...DEFAULT_CONFIG.notif, ...(parsed.notif || {}) },
            tarifas: { ...DEFAULT_CONFIG.tarifas, ...(parsed.tarifas || {}) },
          };
        }
      } catch {
        // Fallback al default
      }
    }
    return this.clone(DEFAULT_CONFIG);
  }

  updatePlazo(key: keyof PlazosConfig, value: number): void {
    const safeVal = Math.max(0, Number(value) || 0);
    this.configState.update((current) => ({
      ...current,
      plazos: {
        ...current.plazos,
        [key]: safeVal,
      },
    }));
  }

  updateNotif<K extends keyof NotifConfig>(key: K, value: NotifConfig[K]): void {
    const safeVal = key === 'umbralProximo' ? (Math.max(1, Number(value) || 1) as NotifConfig[K]) : value;
    this.configState.update((current) => ({
      ...current,
      notif: {
        ...current.notif,
        [key]: safeVal,
      },
    }));
  }

  toggleNotif(key: 'vencidas' | 'proximos' | 'registros'): void {
    this.configState.update((current) => ({
      ...current,
      notif: {
        ...current.notif,
        [key]: !current.notif[key],
      },
    }));
  }

  updateTarifas(key: keyof TarifasConfig, value: number): void {
    const safeVal = Math.max(0, Number(value) || 0);
    this.configState.update((current) => ({
      ...current,
      tarifas: {
        ...current.tarifas,
        [key]: safeVal,
      },
    }));
  }

  save(): Observable<boolean> {
    this.savingState.set(true);
    const toSave = this.clone(this.configState());

    if (this.http) {
      return this.http.put<SystemConfig>(this.apiUrl, toSave).pipe(
        map((saved) => {
          if (!this.isServerConfig(saved)) {
            this.savingState.set(false);
            return false;
          }
          const cfg = saved;
          if (JSON.stringify(this.configState()) === JSON.stringify(toSave)) {
            this.configState.set(this.clone(cfg));
          }
          this.savedState.set(this.clone(cfg));
          this.savingState.set(false);
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg));
            } catch {
              // Cache local secundario
            }
          }
          return true;
        }),
        catchError(() => {
          this.savingState.set(false);
          return of(false);
        })
      );
    }

    this.savingState.set(false);
    return of(false);
  }

  cancel(): void {
    this.configState.set(this.clone(this.savedState()));
  }

  resetToDefaults(): void {
    this.configState.set(this.clone(DEFAULT_CONFIG));
  }
}
