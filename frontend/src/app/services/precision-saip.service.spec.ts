import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrecisionSaipService } from './precision-saip.service';

describe('PrecisionSaipService', () => {
  let service: PrecisionSaipService;
  let http: HttpTestingController;
  const base = 'http://localhost:8080/api/solicitudes/23/observaciones/9/precision';
  const clave = 'ab9057f4-b41f-4555-a3a7-ad6587bd8c52';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PrecisionSaipService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('transfiere el archivo con su contenido, comentario y clave de operación', async () => {
    const archivo = new File(['%PDF-1.4\nprecision'], 'precision.pdf', { type: 'application/pdf' });
    service.enviar(23, 9, clave, 'Preciso el periodo solicitado.', archivo).subscribe();

    const request = http.expectOne(base);
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    const enviado = body.get('archivo') as File;
    expect(enviado).toBeInstanceOf(File);
    expect(enviado.name).toBe('precision.pdf');
    expect(enviado.size).toBe(archivo.size);
    expect(body.get('comentario')).toBe('Preciso el periodo solicitado.');
    expect(body.get('claveOperacion')).toBe(clave);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({});
    const lector = new FileReader();
    const contenido = new Promise((resolve) => { lector.onload = () => resolve(lector.result); });
    lector.readAsText(enviado);
    expect(await contenido).toBe('%PDF-1.4\nprecision');
  });

  it('consulta la recepción por la misma solicitud, observación y clave sin volver a enviar', () => {
    service.consultar(23, 9, clave).subscribe();
    const request = http.expectOne(`${base}/${clave}`);
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it.each([400, 401, 403, 404, 409, 500])('conserva el error HTTP %s para su tratamiento en el formulario', (status) => {
    let errorStatus: number | undefined;
    service.enviar(23, 9, clave, 'Precisión', new File(['archivo'], 'precision.txt', { type: 'text/plain' }))
      .subscribe({ error: (error) => { errorStatus = error.status; } });
    http.expectOne(base).flush({ detail: 'Recepción rechazada' }, { status, statusText: 'Error' });
    expect(errorStatus).toBe(status);
  });

  it('un envío sin respuesta finaliza con timeout para poder consultar su recepción', () => {
    vi.useFakeTimers();
    try {
      let resultado = '';
      service.enviar(23, 9, clave, 'Precisión', new File(['archivo'], 'precision.txt', { type: 'text/plain' }))
        .subscribe({ error: (error: Error) => { resultado = error.name; } });
      const request = http.expectOne(base);
      vi.advanceTimersByTime(29_999);
      expect(resultado).toBe('');
      vi.advanceTimersByTime(1);
      expect(resultado).toBe('TimeoutError');
      expect(request.cancelled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
