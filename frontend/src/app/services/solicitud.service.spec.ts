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

  it('should POST observar solicitud', () => {
    const payload = { motivoObservacion: 'Debe precisar el pedido', responsable: 'Funcionario' };
    service.observar(1, payload).subscribe(res => expect(res.id).toBe(20));
    const req = httpMock.expectOne(`${apiUrl}/1/observaciones`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 20, estado: 'PENDIENTE_SUBSANACION' });
  });

  it('should GET observaciones de solicitud', () => {
    service.listarObservaciones(1).subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(`${apiUrl}/1/observaciones`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 20 }]);
  });

  it('should POST subsanar solicitud', () => {
    const payload = { comentarioSubsanacion: 'Precisión del pedido', responsable: 'Ciudadano' };
    service.subsanar(1, 20, payload).subscribe(res => expect(res.estado).toBe('SUBSANADA'));
    const req = httpMock.expectOne(`${apiUrl}/1/observaciones/20/subsanar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 20, estado: 'SUBSANADA' });
  });

  it('should POST registrar ampliacion de plazo', () => {
    const payload = {
      motivoAmpliacion: 'Pedido voluminoso',
      informeAmpliacion: 'Informe con cronograma',
      fechaNotificacionAmpliacion: '2026-05-25',
      responsable: 'Funcionario',
      cronograma: [{ numeroEntrega: 1, descripcion: 'Primer bloque', fechaProgramada: '2026-06-05' }]
    };
    service.registrarAmpliacion(1, payload).subscribe(res => expect(res.estadoAmpliacion).toBe('NOTIFICADA'));
    const req = httpMock.expectOne(`${apiUrl}/1/ampliaciones`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 30, estadoAmpliacion: 'NOTIFICADA' });
  });

  it('should GET ampliaciones de solicitud', () => {
    service.listarAmpliaciones(1).subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(`${apiUrl}/1/ampliaciones`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 30 }]);
  });

  it('should GET cronograma de ampliacion', () => {
    service.listarCronogramaAmpliacion(1).subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(`${apiUrl}/1/ampliaciones/cronograma`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 40 }]);
  });

  it('should POST registrar encauzamiento', () => {
    const payload = {
      entidadDestinoId: 2,
      motivoEncauzamiento: 'La información corresponde a otra entidad',
      alcance: 'TOTAL' as const,
      responsable: 'Funcionario'
    };
    service.registrarEncauzamiento(1, payload).subscribe(res => expect(res.estadoEncauzamiento).toBe('DERIVADO'));
    const req = httpMock.expectOne(`${apiUrl}/1/encauzamientos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 50, estadoEncauzamiento: 'DERIVADO' });
  });

  it('should GET encauzamientos de solicitud', () => {
    service.listarEncauzamientos(1).subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(`${apiUrl}/1/encauzamientos`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 50 }]);
  });

  it('should GET encauzamiento activo', () => {
    service.obtenerEncauzamientoActivo(1).subscribe(res => expect(res.id).toBe(50));
    const req = httpMock.expectOne(`${apiUrl}/1/encauzamientos/activo`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 50 });
  });

  it('should POST emitir liquidacion de costo', () => {
    const payload = {
      monto: 18.5,
      moneda: 'PEN',
      concepto: 'Copias simples',
      fechaNotificacion: '2026-05-25',
      medioNotificacion: 'CASILLA_ELECTRONICA' as const,
      responsable: 'Funcionario'
    };
    service.emitirLiquidacion(1, payload).subscribe(res => expect(res.estadoLiquidacion).toBe('NOTIFICADA'));
    const req = httpMock.expectOne(`${apiUrl}/1/liquidaciones`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 60, estadoLiquidacion: 'NOTIFICADA' });
  });

  it('should GET liquidaciones de solicitud', () => {
    service.listarLiquidaciones(1).subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(`${apiUrl}/1/liquidaciones`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 60 }]);
  });

  it('should GET liquidacion activa', () => {
    service.obtenerLiquidacionActiva(1).subscribe(res => expect(res.id).toBe(60));
    const req = httpMock.expectOne(`${apiUrl}/1/liquidaciones/activa`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 60 });
  });

  it('should PATCH liquidacion de costo', () => {
    const payload = { estado: 'PAGADA' as const, fechaPago: '2026-05-25', responsable: 'Funcionario' };
    service.actualizarLiquidacion(1, 60, payload).subscribe(res => expect(res.estadoLiquidacion).toBe('PAGADA'));
    const req = httpMock.expectOne(`${apiUrl}/1/liquidaciones/60`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 60, estadoLiquidacion: 'PAGADA' });
  });

  it('should POST procesar liquidaciones vencidas', () => {
    service.procesarLiquidacionesVencidas().subscribe(res => expect(res.length).toBe(1));
    const req = httpMock.expectOne(`${apiUrl}/liquidaciones/vencidas/procesar`);
    expect(req.request.method).toBe('POST');
    req.flush([{ id: 60, estadoLiquidacion: 'ARCHIVADA' }]);
  });

  it('should PATCH entrega parcial', () => {
    const payload = { estado: 'ENTREGADA' as const, fechaEntregaReal: '2026-06-05', observacion: 'Entregada' };
    service.actualizarEntregaParcial(1, 30, 40, payload).subscribe(res => expect(res.estado).toBe('ENTREGADA'));
    const req = httpMock.expectOne(`${apiUrl}/1/ampliaciones/30/cronograma/40`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 40, estado: 'ENTREGADA' });
  });

  it('should DELETE eliminar solicitud', () => {
    service.eliminar(1).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
