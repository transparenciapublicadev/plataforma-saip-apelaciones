import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BorradoresSaipComponent } from './borradores-saip.component';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

describe('Borradores de SAIP', () => {
  let http: HttpTestingController;
  const revision = signal(1);
  const borrador = {
    id: 9, entidadId: 3, entidadNombre: 'Entidad sintética', asunto: 'Pedido guardado', descripcion: 'Texto',
    tipoInformacion: null, oficinaDestinataria: null, formatoCorreo: true, copiaSimple: false,
    copiaCertificada: false, soporteMagnetico: false, canalNotificacion: 'CORREO', aceptaCanal: true,
    consentimientoDatos: false, declaraVeracidad: false, paso: 1, actualizado: '2026-11-21T10:30:00',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BorradoresSaipComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthService, useValue: { getToken: () => 'sesion', cambiosSesion: revision } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function pagina() {
    const f = TestBed.createComponent(BorradoresSaipComponent);
    f.detectChanges();
    http.expectOne(`${environment.apiUrl}/borradores-saip`).flush([borrador]);
    f.detectChanges();
    return f;
  }

  it('muestra los borradores de la cuenta y continúa el elegido', () => {
    const f = pagina();
    expect(f.nativeElement.textContent).toContain('Pedido guardado');
    expect(f.nativeElement.textContent).toContain('21/11/2026 10:30');
    expect(f.nativeElement.textContent).toContain('no abre expediente');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const continuar = (Array.from(f.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(boton => boton.textContent?.includes('Continuar')) as HTMLButtonElement;
    continuar.click();
    expect(navigate).toHaveBeenCalledWith(['/ciudadano/nueva-saip'], { queryParams: { borrador: 9 } });
  });

  it('descarta un borrador y deja la lista vacía', () => {
    const f = pagina();
    const descartar = (Array.from(f.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(boton => boton.textContent?.includes('Descartar')) as HTMLButtonElement;
    descartar.click(); f.detectChanges();
    const confirmar = (Array.from(f.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(boton => boton.textContent?.includes('Sí, descartar')) as HTMLButtonElement;
    confirmar.click();
    const baja = http.expectOne(`${environment.apiUrl}/borradores-saip/9`);
    expect(baja.request.method).toBe('DELETE');
    baja.flush(null); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No tiene borradores');
  });
});
