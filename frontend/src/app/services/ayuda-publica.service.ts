import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PreguntaAyudaPublica {
  pregunta: string;
  respuesta: string;
}

export interface CategoriaAyudaPublica {
  id: string;
  titulo: string;
  icono: string;
  colorAcento: string;
  preguntas: PreguntaAyudaPublica[];
}

export interface ContactoAyudaPublica {
  telefono: string;
  correo: string;
  direccion: string;
}

export interface AyudaPublica {
  categorias: CategoriaAyudaPublica[];
  contacto: ContactoAyudaPublica;
}

@Injectable({
  providedIn: 'root',
})
export class AyudaPublicaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/public/ayuda`;

  getAyuda(): Observable<AyudaPublica> {
    return this.http.get<AyudaPublica>(this.apiUrl);
  }
}
