import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TtaipService } from './ttaip.service';

describe('TtaipService', () => {
  let service: TtaipService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/ttaip';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TtaipService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // --- Query endpoints ---

  it('should GET estadisticas', () => {
    service.getEstadisticas().subscribe(res => {
      expect(res.pendientesAdmision).toBe(5);
    });
    const req = httpMock.expectOne(`${apiUrl}/estadisticas`);
    expect(req.request.method).toBe('GET');
    req.flush({ pendientesAdmision: 5, enProceso: 3, enSubsanacion: 1, resueltas: 10 });
  });

  it('should GET pendientes', () => {
    service.getPendientes().subscribe(res => expect(res.length).toBe(2));
    const req = httpMock.expectOne(`${apiUrl}/pendientes`);
    req.flush([{ id: 1 }, { id: 2 }]);
  });

  it('should GET en-calificacion', () => {
    service.getEnAnalisis().subscribe();
    const req = httpMock.expectOne(`${apiUrl}/en-calificacion`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should GET subsanacion', () => {
    service.getSubsanacion().subscribe();
    const req = httpMock.expectOne(`${apiUrl}/subsanacion`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should GET segunda-calificacion', () => {
    service.getSegundaCalificacion().subscribe();
    const req = httpMock.expectOne(`${apiUrl}/segunda-calificacion`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should GET resueltas', () => {
    service.getResueltas().subscribe();
    const req = httpMock.expectOne(`${apiUrl}/resueltas`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // --- Calificacion endpoints ---

  it('should POST admitir apelacion', () => {
    const data = { fundamentacion: 'Cumple requisitos', miembroTtaipId: 1 } as any;
    service.admitirApelacion(5, data).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/calificacion/5/admitir`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({});
  });

  it('should POST requerir subsanacion', () => {
    const data = { fundamentacion: 'Falta doc', miembroTtaipId: 1 } as any;
    service.requerirSubsanacion(5, data).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/calificacion/5/subsanar`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('should POST inadmitir apelacion', () => {
    const data = { fundamentacion: 'No cumple', miembroTtaipId: 1 } as any;
    service.inadmitirApelacion(5, data).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/calificacion/5/inadmitir`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  // --- Resolucion endpoints ---

  it('should POST declarar fundado', () => {
    const data = { fundamentacion: 'Fundado', miembroTtaipId: 1 } as any;
    service.declararFundado(3, data).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/resolucion/3/fundado`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('should POST declarar infundado', () => {
    const data = { fundamentacion: 'Infundado', miembroTtaipId: 1 } as any;
    service.declararInfundado(3, data).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/resolucion/3/infundado`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('should POST declarar fundado en parte', () => {
    service.declararFundadoEnParte(3, {} as any).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/resolucion/3/fundado-en-parte`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('should POST declarar infundado en parte', () => {
    service.declararInfundadoEnParte(3, {} as any).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/resolucion/3/infundado-en-parte`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('should POST declarar improcedente', () => {
    service.declararImprocedente(3, {} as any).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/resolucion/3/improcedente`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('should POST declarar sustraccion materia', () => {
    service.declararSustraccionMateria(3, {} as any).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/resolucion/3/sustraccion-materia`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('should POST declarar desistimiento', () => {
    service.declararDesistimiento(3, {} as any).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/resolucion/3/desistimiento`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('should POST declarar no presentado', () => {
    service.declararNoPresentado(3, {} as any).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/resolucion/3/no-presentado`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  // --- Notificacion ---

  it('should POST notificar segunda calificacion', () => {
    service.notificarSegundaCalificacion(7).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/notificar-segunda-calificacion/7`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });
});
