import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PanelApelacion, PanelPage, PanelQuery, PanelSolicitud } from '../models/panel-query.model';

@Injectable({ providedIn: 'root' })
export class PanelQueryService {
  private readonly http = inject(HttpClient);
  private params(query: PanelQuery): HttpParams {
    let params = new HttpParams().set('pagina', query.pagina).set('tamano', query.tamano);
    for (const key of ['busqueda', 'estado', 'etapa', 'orden', 'sala'] as const) {
      const value = query[key];
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    if (query.descargosPresentados) params = params.set('descargosPresentados', true);
    return params;
  }
  solicitudes(query: PanelQuery): Observable<PanelPage<PanelSolicitud>> {
    return this.http.get<PanelPage<PanelSolicitud>>(`${environment.apiUrl}/panel/solicitudes`, { params: this.params(query) });
  }
  apelaciones(query: PanelQuery): Observable<PanelPage<PanelApelacion>> {
    return this.http.get<PanelPage<PanelApelacion>>(`${environment.apiUrl}/panel/apelaciones`, { params: this.params(query) });
  }
}
