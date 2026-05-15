import { Injectable } from '@angular/core';

interface EntityRef {
  id?: number | null;
  expediente?: string | null;
}

interface StateOverride {
  estado: string;
  updatedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocalStateOverrideService {
  private readonly solicitudKey = 'saip.estado.override.solicitudes';
  private readonly apelacionKey = 'saip.estado.override.apelaciones';
  private readonly maxAgeMs = 7 * 24 * 60 * 60 * 1000;

  setSolicitudEstado(entity: EntityRef, estado: string): void {
    this.setEstado(this.solicitudKey, entity, estado);
  }

  getSolicitudEstado(entity: EntityRef): string | null {
    return this.getEstado(this.solicitudKey, entity);
  }

  setApelacionEstado(entity: EntityRef, estado: string): void {
    this.setEstado(this.apelacionKey, entity, estado);
  }

  getApelacionEstado(entity: EntityRef): string | null {
    return this.getEstado(this.apelacionKey, entity);
  }

  private setEstado(storageKey: string, entity: EntityRef, estado: string): void {
    const keys = this.entityKeys(entity);
    if (keys.length === 0) {
      return;
    }

    const overrides = this.read(storageKey);
    const entry: StateOverride = { estado, updatedAt: Date.now() };
    for (const key of keys) {
      overrides[key] = entry;
    }

    this.write(storageKey, overrides);
  }

  private getEstado(storageKey: string, entity: EntityRef): string | null {
    const overrides = this.read(storageKey);
    for (const key of this.entityKeys(entity)) {
      const entry = overrides[key];
      if (entry?.estado) {
        return entry.estado;
      }
    }

    return null;
  }

  private entityKeys(entity: EntityRef): string[] {
    const keys: string[] = [];
    if (typeof entity.id === 'number') {
      keys.push(`id-${entity.id}`);
    }

    const expediente = entity.expediente?.trim();
    if (expediente) {
      keys.push(`exp-${expediente}`);
    }

    return keys;
  }

  private read(storageKey: string): Record<string, StateOverride> {
    const storage = this.storage();
    if (!storage) {
      return {};
    }

    try {
      const raw = storage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) as Record<string, StateOverride> : {};
      return this.pruneExpired(storageKey, parsed);
    } catch {
      return {};
    }
  }

  private write(storageKey: string, overrides: Record<string, StateOverride>): void {
    const storage = this.storage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(storageKey, JSON.stringify(overrides));
    } catch {
      // Storage can be unavailable in private mode or SSR hydration.
    }
  }

  private pruneExpired(storageKey: string, overrides: Record<string, StateOverride>): Record<string, StateOverride> {
    const now = Date.now();
    const active: Record<string, StateOverride> = {};
    let changed = false;

    for (const [key, entry] of Object.entries(overrides)) {
      if (!entry?.estado || now - entry.updatedAt > this.maxAgeMs) {
        changed = true;
        continue;
      }

      active[key] = entry;
    }

    if (changed) {
      this.write(storageKey, active);
    }

    return active;
  }

  private storage(): Storage | null {
    return typeof localStorage === 'undefined' ? null : localStorage;
  }
}
