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

  it('should GET notificaciones by expediente', () => {
    service.listarNotificaciones(10).subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/notificaciones`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 40, estado: 'PENDIENTE' }]);
  });

  it('should GET notificacion with evidence', () => {
    service.obtenerNotificacion(10, 40).subscribe(res => expect(res.codigoConstancia).toBe('CONST-1'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/notificaciones/40`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 40, codigoConstancia: 'CONST-1' });
  });

  it('should POST registrar constancia envio', () => {
    const data = {
      medioNotificacion: 'CORREO_ELECTRONICO',
      codigoEnvio: 'MAIL-1',
      codigoConstancia: 'CONST-1',
      constanciaEnvio: 'Constancia de envío',
      responsable: 'Mesa de Partes TTAIP'
    };
    service.registrarConstanciaEnvio(10, 40, data).subscribe(res => expect(res.estado).toBe('ENVIADA'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/notificaciones/40/constancia-envio`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 40, estado: 'ENVIADA' });
  });

  it('should POST registrar acuse automatico', () => {
    const data = {
      estadoAcuse: 'ENTREGADO' as const,
      acuseAutomatico: 'Delivered',
      responsable: 'Sistema de notificaciones TTAIP'
    };
    service.registrarAcuseAutomatico(10, 40, data).subscribe(res => expect(res.estado).toBe('ENTREGADA'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/notificaciones/40/acuse-automatico`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 40, estado: 'ENTREGADA' });
  });

  it('should POST validar notificacion manualmente', () => {
    const data = {
      responsableValidacion: 'Secretaría Técnica TTAIP',
      observacionValidacion: 'Se verificó cargo alterno correcto.',
      referenciaEvidencia: 'CARGO-1'
    };
    service.validarNotificacionManualmente(10, 40, data).subscribe(res => expect(res.validadaManualmente).toBe(true));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/notificaciones/40/validacion-manual`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 40, validadaManualmente: true });
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

  // --- Cumplimiento de resolucion fundada ---

  it('should POST crear seguimiento de cumplimiento', () => {
    const data = {
      responsableTtaip: 'Secretaría Técnica TTAIP',
      observacion: 'Seguimiento de resolución fundada'
    };
    service.crearSeguimientoCumplimiento(10, 50, data).subscribe(res => expect(res.estadoCumplimiento).toBe('PENDIENTE'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/resoluciones/50/cumplimientos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 60, estadoCumplimiento: 'PENDIENTE' });
  });

  it('should GET cumplimientos by expediente', () => {
    service.listarCumplimientos(10).subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/cumplimientos`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 60 }]);
  });

  it('should GET cumplimiento activo', () => {
    service.obtenerCumplimientoActivo(10).subscribe(res => expect(res.id).toBe(60));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/cumplimientos/activo`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 60, estadoCumplimiento: 'PENDIENTE' });
  });

  it('should POST registrar cumplimiento', () => {
    const data = {
      tipoCumplimiento: 'TOTAL' as const,
      descripcionCumplimiento: 'La entidad entregó toda la información ordenada.',
      referenciaDocumento: 'CUMPLIMIENTO-1.pdf',
      responsableEntidad: 'Funcionario de Transparencia'
    };
    service.registrarCumplimiento(10, 60, data).subscribe(res => expect(res.estadoCumplimiento).toBe('CUMPLIDO'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/cumplimientos/60/registrar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 60, estadoCumplimiento: 'CUMPLIDO' });
  });

  it('should PATCH observar cumplimiento', () => {
    const data = {
      observacion: 'La evidencia no acredita entrega completa.',
      responsableTtaip: 'Secretaría Técnica TTAIP'
    };
    service.observarCumplimiento(10, 60, data).subscribe(res => expect(res.estadoCumplimiento).toBe('OBSERVADO'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/cumplimientos/60/observar`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 60, estadoCumplimiento: 'OBSERVADO' });
  });

  it('should PATCH cerrar cumplimiento', () => {
    const data = {
      responsableTtaip: 'Secretaría Técnica TTAIP',
      observacion: 'Seguimiento cerrado.'
    };
    service.cerrarCumplimiento(10, 60, data).subscribe(res => expect(res.estadoCumplimiento).toBe('CERRADO'));
    const req = httpMock.expectOne(`${apiUrl}/expedientes/10/cumplimientos/60/cerrar`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(data);
    req.flush({ id: 60, estadoCumplimiento: 'CERRADO' });
  });

  it('should POST procesar cumplimientos vencidos', () => {
    service.procesarCumplimientosVencidos().subscribe(res => expect(res.length).toBe(0));
    const req = httpMock.expectOne(`${apiUrl}/cumplimientos/vencidos/procesar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush([]);
  });
});
