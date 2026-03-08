import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FuncionarioService } from './funcionario.service';

describe('FuncionarioService', () => {
  let service: FuncionarioService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/funcionarios';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FuncionarioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should GET all funcionarios', () => {
    service.findAll().subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }]);
  });

  it('should GET funcionario by id', () => {
    service.findById(4).subscribe(res => expect(res.id).toBe(4));
    const req = httpMock.expectOne(`${apiUrl}/4`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 4 });
  });

  it('should GET funcionarios by entidadId', () => {
    service.findByEntidadId(2).subscribe(res => expect(res.length).toBe(3));
    const req = httpMock.expectOne(`${apiUrl}/entidad/2`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('should POST crear funcionario', () => {
    const data = { nombreCompleto: 'Ana', cargo: 'Director', entidadId: 1 };
    service.crear(data).subscribe();
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 10 });
  });

  it('should PUT actualizar funcionario', () => {
    service.actualizar(1, { cargo: 'Subdirector' }).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('should PATCH cambiar estado', () => {
    service.cambiarEstado(1, false).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1/estado`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activo: false });
    req.flush({});
  });

  it('should DELETE eliminar funcionario', () => {
    service.eliminar(1).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
