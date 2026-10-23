import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import type { components } from '../api/schema';

export type RecepcionSubsanacionTtaip = Required<components['schemas']['SubsanacionTtaipRecepcionDTO']>;
export type RequerimientoSubsanacionTtaip = components['schemas']['RequerimientoSubsanacionTtaipDTO'];

@Injectable({ providedIn: 'root' })
export class SubsanacionTtaipService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/apelaciones`;
  requerimiento(apelacionId: number) {
    return this.http.get<RequerimientoSubsanacionTtaip>(`${this.base}/${apelacionId}/subsanacion/requerimiento`).pipe(timeout(30_000));
  }
  enviar(apelacionId: number, requerimientoId: number, clave: string, fundamentos: string, archivos: File[]) {
    const body = new FormData();
    body.append('claveOperacion', clave);
    body.append('fundamentosAdicionales', fundamentos);
    for (const archivo of archivos) body.append('archivos', archivo, archivo.name);
    return this.http.post<RecepcionSubsanacionTtaip>(this.url(apelacionId, requerimientoId), body).pipe(timeout(30_000));
  }
  consultar(apelacionId: number, requerimientoId: number, clave: string) {
    return this.http.get<RecepcionSubsanacionTtaip>(`${this.url(apelacionId, requerimientoId)}/${clave}`).pipe(timeout(30_000));
  }
  private url(apelacionId: number, requerimientoId: number) {
    return `${this.base}/${apelacionId}/subsanacion/${requerimientoId}/recepcion`;
  }
}
