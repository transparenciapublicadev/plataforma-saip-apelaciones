import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RespuestaService } from './respuesta.service';

describe('RespuestaService', () => {
  let service: RespuestaService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/respuestas';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RespuestaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should GET all respuestas', () => {
    service.findAll().subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }]);
  });

  it('should GET respuesta by id', () => {
    service.findById(4).subscribe(res => expect(res.id).toBe(4));
    const req = httpMock.expectOne(`${apiUrl}/4`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 4 });
  });

  it('should GET respuesta by solicitudId', () => {
    service.findBySolicitudId(8).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/solicitud/8`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should POST aceptar solicitud', () => {
    const data = { solicitudId: 1, tipoRespuesta: 'ENTREGA_TOTAL', contenido: 'Info' } as any;
    service.aceptarSolicitud(data).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/aceptar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({});
  });

  it('should POST denegar solicitud', () => {
    const data = { solicitudId: 1, tipoRespuesta: 'DENEGACION_TOTAL', contenido: 'Motivo' } as any;
    service.denegarSolicitud(data).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/denegar`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('should GET causales de denegacion', () => {
    service.getCausalesDenegacion().subscribe(res => expect(res.length).toBe(3));
    const req = httpMock.expectOne(`${apiUrl}/causales-denegacion`);
    expect(req.request.method).toBe('GET');
    req.flush(['Causal 1', 'Causal 2', 'Causal 3']);
  });
});
