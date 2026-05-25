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
    const req = httpMock.expectOne(`${apiUrl}/calificacion/3/no-presentado`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  // --- Notificacion ---

  it('should POST notificar segunda calificacion', () => {
    service.notificarSegundaCalificacion(7).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/7/notificar-segunda-calificacion`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  // --- Descargos y suspensiones ---

  it('should POST requerir descargos', () => {
    const data = { responsableTtaip: 'Secretaría Técnica TTAIP', observacion: 'Requerir expediente administrativo' };
    service.requerirDescargos(10, data).subscribe(res => expect(res.id).toBe(20));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/descargos/requerir`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 20 });
  });

  it('should GET descargos by expediente', () => {
    service.listarDescargos(10).subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/descargos`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 20 }]);
  });

  it('should GET descargo activo', () => {
    service.obtenerDescargoActivo(10).subscribe(res => expect(res.estadoDescargo).toBe('REQUERIDO'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/descargos/activo`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 20, estadoDescargo: 'REQUERIDO' });
  });

  it('should POST presentar descargo', () => {
    const data = {
      resumenDescargo: 'La entidad remite expediente administrativo.',
      referenciaDocumento: 'descargo.pdf',
      responsableEntidad: 'Funcionario'
    };
    service.presentarDescargo(10, 20, data).subscribe(res => expect(res.estadoDescargo).toBe('PRESENTADO'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/descargos/20/presentar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 20, estadoDescargo: 'PRESENTADO' });
  });

  it('should POST procesar descargos vencidos', () => {
    service.procesarDescargosVencidos().subscribe(res => expect(res.length).toBe(0));
    const req = httpMock.expectOne(`${apiUrl}/descargos/vencidos/procesar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush([]);
  });

  it('should GET suspensiones by expediente', () => {
    service.listarSuspensiones(10).subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/suspensiones`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 30, motivoSuspension: 'DESCARGOS_ENTIDAD' }]);
  });

  it('should POST registrar informe oral', () => {
    const data = {
      solicitante: 'CIUDADANO' as const,
      motivo: 'Solicitud de informe oral',
      responsable: 'Secretaría Técnica TTAIP',
      observacion: 'Registro de audiencia'
    };
    service.registrarInformeOral(10, data).subscribe(res => expect(res.motivoSuspension).toBe('INFORME_ORAL'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/suspensiones/informe-oral`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 31, motivoSuspension: 'INFORME_ORAL' });
  });

  it('should POST registrar informacion complementaria', () => {
    const data = {
      solicitante: 'TTAIP' as const,
      motivo: 'Se requiere información complementaria',
      responsable: 'Secretaría Técnica TTAIP'
    };
    service.registrarInformacionComplementaria(10, data).subscribe(res => {
      expect(res.motivoSuspension).toBe('INFORMACION_COMPLEMENTARIA');
    });
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/suspensiones/informacion-complementaria`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 32, motivoSuspension: 'INFORMACION_COMPLEMENTARIA' });
  });

  it('should PATCH cancelar suspension', () => {
    const data = {
      responsable: 'Secretaría Técnica TTAIP',
      observacion: 'Solicitud dejada sin efecto'
    };
    service.cancelarSuspension(10, 32, data).subscribe(res => expect(res.estadoSuspension).toBe('CANCELADA'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/suspensiones/32/cancelar`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 32, estadoSuspension: 'CANCELADA' });
  });
});
