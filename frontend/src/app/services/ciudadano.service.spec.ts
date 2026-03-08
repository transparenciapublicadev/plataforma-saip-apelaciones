import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CiudadanoService } from './ciudadano.service';

describe('CiudadanoService', () => {
  let service: CiudadanoService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/ciudadanos';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CiudadanoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should GET all ciudadanos', () => {
    service.findAll().subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }]);
  });

  it('should GET ciudadano by id', () => {
    service.findById(3).subscribe(res => expect(res.id).toBe(3));
    const req = httpMock.expectOne(`${apiUrl}/3`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 3 });
  });

  it('should GET ciudadano by DNI', () => {
    service.findByDni('12345678').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/dni/12345678`);
    expect(req.request.method).toBe('GET');
    req.flush({ dni: '12345678' });
  });

  it('should GET ciudadano con estadisticas', () => {
    service.findByIdConEstadisticas(3).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/3/estadisticas`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should POST crear ciudadano', () => {
    const data = { dni: '11111111', nombreCompleto: 'Juan' };
    service.crear(data).subscribe();
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 10 });
  });

  it('should PUT actualizar ciudadano', () => {
    service.actualizar(2, { nombreCompleto: 'Updated' }).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/2`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('should PATCH cambiar estado', () => {
    service.cambiarEstado(2, true).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/2/estado`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activo: true });
    req.flush({});
  });
});
