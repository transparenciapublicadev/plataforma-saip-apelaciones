import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApelacionService } from './apelacion.service';

describe('ApelacionService', () => {
  let service: ApelacionService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/apelaciones';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApelacionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should GET all apelaciones', () => {
    service.findAll().subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }]);
  });

  it('should GET apelacion by id', () => {
    service.findById(3).subscribe(res => expect(res.id).toBe(3));
    const req = httpMock.expectOne(`${apiUrl}/3`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 3 });
  });

  it('should GET apelacion by expediente', () => {
    service.findByExpediente('01560-2025-JUS/TTAIP').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/expediente/01560-2025-JUS/TTAIP`);
    expect(req.request.method).toBe('GET');
    req.flush({ expediente: '01560-2025-JUS/TTAIP' });
  });

  it('should GET apelaciones by estado', () => {
    service.findByEstado('EN_CALIFICACION_1').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/estado/EN_CALIFICACION_1`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should GET apelaciones by ciudadanoId', () => {
    service.findByCiudadanoId(5).subscribe(res => expect(res.length).toBe(0));
    const req = httpMock.expectOne(`${apiUrl}/ciudadano/5`);
    req.flush([]);
  });

  it('should GET estadisticas', () => {
    service.getEstadisticas().subscribe();
    const req = httpMock.expectOne(`${apiUrl}/estadisticas`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should POST crear apelacion', () => {
    const data = { solicitudId: 1, fundamentoLegal: 'Art. 11' } as any;
    service.crear(data).subscribe(res => expect(res.id).toBe(10));
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 10 });
  });

  it('should POST crear apelacion externa', () => {
    const data = {
      ciudadanoId: 5,
      entidadExternaNombre: 'Entidad fuera de plataforma',
      numeroSolicitudExterna: 'EXT-2026-001',
      fechaPresentacionSolicitudExterna: '2026-05-01',
      tipoDenegatoria: 'TACITA',
      resumenSolicitudOriginal: 'Solicitud original',
      referenciaDocumentoSolicitud: 'solicitud.pdf',
      evidenciaSilencioAdministrativo: 'Declaración de ausencia de respuesta',
      fundamentos: 'Fundamentos suficientes'
    } as any;
    service.crearExterna(data).subscribe(res => expect(res.id).toBe(11));
    const req = httpMock.expectOne(`${apiUrl}/externa`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 11 });
  });

  it('should PUT actualizar apelacion', () => {
    service.actualizar(2, { estado: 'EN_CALIFICACION_1' } as any).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/2`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('should PATCH cambiar estado', () => {
    service.cambiarEstado(2, 'EN_SUBSANACION').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/2/estado`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ estado: 'EN_SUBSANACION' });
    req.flush({});
  });

  it('should POST subsanar apelacion', () => {
    service.subsanar(2, 'Fundamentos adicionales').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/2/subsanacion`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ fundamentosAdicionales: 'Fundamentos adicionales' });
    req.flush({});
  });

  it('should DELETE eliminar apelacion', () => {
    service.eliminar(1).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
