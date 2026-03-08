import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SolicitudService } from './solicitud.service';

describe('SolicitudService', () => {
  let service: SolicitudService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/solicitudes';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SolicitudService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should GET all solicitudes', () => {
    service.findAll().subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }]);
  });

  it('should GET solicitud by id', () => {
    service.findById(5).subscribe(res => expect(res.id).toBe(5));
    const req = httpMock.expectOne(`${apiUrl}/5`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 5 });
  });

  it('should GET solicitud by expediente', () => {
    service.findByExpediente('SAIP-2025-00001').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/expediente/SAIP-2025-00001`);
    expect(req.request.method).toBe('GET');
    req.flush({ expediente: 'SAIP-2025-00001' });
  });

  it('should GET solicitudes by ciudadanoId', () => {
    service.findByCiudadanoId(3).subscribe(res => expect(res.length).toBe(2));
    const req = httpMock.expectOne(`${apiUrl}/ciudadano/3`);
    req.flush([{ id: 1 }, { id: 2 }]);
  });

  it('should GET solicitudes by entidadId', () => {
    service.findByEntidadId(7).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/entidad/7`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should GET solicitudes by estado', () => {
    service.findByEstado('RECEPCIONADA').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/estado/RECEPCIONADA`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should GET estadisticas', () => {
    service.getEstadisticas().subscribe();
    const req = httpMock.expectOne(`${apiUrl}/estadisticas`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should GET estadisticas ciudadano', () => {
    service.getEstadisticasCiudadano(2).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/ciudadano/2/estadisticas`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should GET estadisticas entidad', () => {
    service.getEstadisticasEntidad(4).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/entidad/4/estadisticas`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should POST crear solicitud', () => {
    const sol = { asunto: 'Test', descripcion: 'Desc', entidadId: 1 } as any;
    service.crear(sol).subscribe(res => expect(res.id).toBe(10));
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(sol);
    req.flush({ id: 10 });
  });

  it('should PUT actualizar solicitud', () => {
    service.actualizar(1, { asunto: 'Updated' } as any).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('should PATCH cambiar estado', () => {
    service.cambiarEstado(1, 'EN_REVISION').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1/estado`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ estado: 'EN_REVISION' });
    req.flush({});
  });

  it('should DELETE eliminar solicitud', () => {
    service.eliminar(1).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
