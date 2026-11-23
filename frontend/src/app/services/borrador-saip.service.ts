import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Texto de una SAIP que todavía no se presenta. No es un expediente. */
export interface BorradorSaip {
  id: number;
  entidadId: number | null;
  entidadNombre?: string | null;
  asunto: string | null;
  descripcion: string | null;
  tipoInformacion: string | null;
  oficinaDestinataria: string | null;
  formatoCorreo: boolean;
  copiaSimple: boolean;
  copiaCertificada: boolean;
  soporteMagnetico: boolean;
  canalNotificacion: string | null;
  aceptaCanal: boolean;
  consentimientoDatos: boolean;
  declaraVeracidad: boolean;
  paso: number;
  actualizado: string;
}

export type GuardarBorradorSaip = Omit<BorradorSaip, 'id' | 'entidadNombre' | 'actualizado'>;

@Injectable({ providedIn: 'root' })
export class BorradorSaipService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/borradores-saip`;

  listar(): Observable<BorradorSaip[]> {
    return this.http.get<BorradorSaip[]>(this.base);
  }

  obtener(id: number): Observable<BorradorSaip> {
    return this.http.get<BorradorSaip>(`${this.base}/${id}`);
  }

  crear(datos: GuardarBorradorSaip): Observable<BorradorSaip> {
    return this.http.post<BorradorSaip>(this.base, datos);
  }

  actualizar(id: number, datos: GuardarBorradorSaip): Observable<BorradorSaip> {
    return this.http.put<BorradorSaip>(`${this.base}/${id}`, datos);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
