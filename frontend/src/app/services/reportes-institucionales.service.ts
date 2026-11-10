import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type ModoReporte = 'entidad' | 'ttaip';
export interface ConteoReporte { etiqueta: string; cantidad: number; }
export interface ResumenInstitucional {
  modo: ModoReporte; ambito: string; entidadId: number | null; entidad: string | null;
  desde: string; hasta: string; consultado: string; total: number; conActuacion: number;
  estados: ConteoReporte[]; porMes: ConteoReporte[]; resultados: ConteoReporte[]; alcance: string;
}
export interface FilaReporte { id: number; expediente: string; fecha: string; asunto: string | null; entidad: string | null; estado: string; resultado: string | null; actuacionRegistrada: boolean; }
export interface PaginaReporte<T> { content: T[]; totalElements: number; totalPages: number; number: number; size: number; }
export interface BorradorInstitucional {
  id: string; modo: ModoReporte; desde: string; hasta: string; version: number;
  operacionId: string; cualitativo: Record<string, string>; resumen: ResumenInstitucional; actualizado: string; estado: 'BORRADOR';
}
export interface GuardarBorrador { operacionId: string; version: number | null; cualitativo: Record<string, string>; }
@Injectable({ providedIn: 'root' })
export class ReportesInstitucionalesService {
  private readonly http = inject(HttpClient);
  private url(modo: ModoReporte) { return `${environment.apiUrl}/reportes-institucionales/${modo}`; }
  private periodo(desde: string, hasta: string) { return new HttpParams().set('desde', desde).set('hasta', hasta); }
  resumen(modo: ModoReporte, desde: string, hasta: string) {
    return this.http.get<ResumenInstitucional>(`${this.url(modo)}/resumen`, { params: this.periodo(desde, hasta) });
  }
  detalle(modo: ModoReporte, desde: string, hasta: string, page = 0, query = '', estado = '') {
    let params = this.periodo(desde, hasta).set('page', page).set('size', 15);
    if (query.trim()) params = params.set('query', query.trim());
    if (estado) params = params.set('estado', estado);
    return this.http.get<PaginaReporte<FilaReporte>>(`${this.url(modo)}/detalle`, { params });
  }
  borrador(modo: ModoReporte, desde: string, hasta: string) {
    return this.http.get<BorradorInstitucional>(`${this.url(modo)}/borrador`, { params: this.periodo(desde, hasta) });
  }
  guardar(modo: ModoReporte, desde: string, hasta: string, body: GuardarBorrador) {
    return this.http.put<BorradorInstitucional>(`${this.url(modo)}/borrador`, body, { params: this.periodo(desde, hasta) });
  }
  historial(modo: ModoReporte, page = 0) {
    return this.http.get<PaginaReporte<BorradorInstitucional>>(`${this.url(modo)}/historial`, { params: { page, size: 15 } });
  }
}
