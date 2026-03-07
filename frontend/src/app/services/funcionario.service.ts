import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Funcionario } from '../models/funcionario.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class FuncionarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/funcionarios`;

  findAll(): Observable<Funcionario[]> {
    return this.http.get<Funcionario[]>(this.apiUrl);
  }

  findById(id: number): Observable<Funcionario> {
    return this.http.get<Funcionario>(`${this.apiUrl}/${id}`);
  }

  findByEntidadId(entidadId: number): Observable<Funcionario[]> {
    return this.http.get<Funcionario[]>(`${this.apiUrl}/entidad/${entidadId}`);
  }

  crear(funcionario: Partial<Funcionario>): Observable<Funcionario> {
    return this.http.post<Funcionario>(this.apiUrl, funcionario);
  }

  actualizar(id: number, funcionario: Partial<Funcionario>): Observable<Funcionario> {
    return this.http.put<Funcionario>(`${this.apiUrl}/${id}`, funcionario);
  }

  cambiarEstado(id: number, activo: boolean): Observable<Funcionario> {
    return this.http.patch<Funcionario>(`${this.apiUrl}/${id}/estado`, { activo });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

