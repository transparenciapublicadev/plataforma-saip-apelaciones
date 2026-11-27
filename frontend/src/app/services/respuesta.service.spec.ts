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

  it('registra una entrega parcial en el comando general conservando sus datos', () => {
    const data = { solicitudId: 12, funcionarioId: 5, tipoRespuesta: 'ENTREGA_PARCIAL' as const, contenido: 'Parte disponible', causalDenegatoria: 'Causal aportada' };
    service.crear(data).subscribe();
    const req = httpMock.expectOne(apiUrl); expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data); req.flush({ id: 44, tipoRespuesta: 'ENTREGA_PARCIAL' });
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
  it('transfiere los archivos reales y los campos del contrato en un único multipart', () => {
    const archivos = [new File(['primero'], 'uno.txt', { type: 'text/plain' }), new File(['segundo'], 'dos.pdf', { type: 'application/pdf' })];
    service.registrarConDocumentos(12, 'clave-sintetica', { solicitudId: 12, funcionarioId: 5, tipoRespuesta: 'ENTREGA_PARCIAL', contenido: 'Datos reales', causalDenegatoria: 'Causal', fundamentoLegal: 'Fundamento' }, archivos).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/solicitud/12/recepciones`); const body = req.request.body as FormData;
    expect(req.request.method).toBe('POST'); expect(body.getAll('archivos')).toEqual(archivos);
    expect(body.get('contenido')).toBe('Datos reales'); expect(body.get('causalDenegatoria')).toBe('Causal');
    expect(body.get('claveOperacion')).toBe('clave-sintetica'); expect(body.get('solicitudId')).toBeNull();
    expect(req.request.headers.has('Content-Type')).toBe(false); req.flush({});
  });
  it('permite enviar sin adjuntos y consulta la operación exacta sin reescribirla', () => {
    service.registrarConDocumentos(12, 'clave', { solicitudId: 12, tipoRespuesta: 'DENEGACION_TOTAL', contenido: 'Fundamentos' }, []).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/solicitud/12/recepciones`); expect((req.request.body as FormData).getAll('archivos')).toEqual([]); req.flush({});
    service.consultarRecepcion(12, 'clave').subscribe();
    const consulta = httpMock.expectOne(`${apiUrl}/solicitud/12/recepciones/clave`); expect(consulta.request.method).toBe('GET'); consulta.flush({});
  });

});
