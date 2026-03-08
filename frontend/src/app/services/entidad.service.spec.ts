import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EntidadService } from './entidad.service';

describe('EntidadService', () => {
  let service: EntidadService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/entidades';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EntidadService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should GET all entidades', () => {
    service.findAll().subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }]);
  });

  it('should GET entidades activas', () => {
    service.findActivas().subscribe();
    const req = httpMock.expectOne(`${apiUrl}/activas`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should GET entidad by id', () => {
    service.findById(2).subscribe(res => expect(res.id).toBe(2));
    const req = httpMock.expectOne(`${apiUrl}/2`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 2 });
  });

  it('should GET entidad con estadisticas', () => {
    service.findByIdConEstadisticas(2).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/2/estadisticas`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should GET buscar por nombre', () => {
    service.buscarPorNombre('Ministerio').subscribe(res => expect(res.length).toBe(2));
    const req = httpMock.expectOne(r => r.url === `${apiUrl}/buscar`);
    expect(req.request.params.get('nombre')).toBe('Ministerio');
    req.flush([{ id: 1 }, { id: 2 }]);
  });

  it('should POST crear entidad', () => {
    const data = { nombre: 'Nueva Entidad', acronimo: 'NE' };
    service.crear(data).subscribe();
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 10 });
  });

  it('should PUT actualizar entidad', () => {
    service.actualizar(1, { nombre: 'Updated' }).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('should PATCH cambiar estado', () => {
    service.cambiarEstado(1, 'ACTIVA').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1/estado`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ estado: 'ACTIVA' });
    req.flush({});
  });

  it('should DELETE eliminar entidad', () => {
    service.eliminar(1).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
