import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Solicitud } from '../../models/solicitud.model';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { EntidadService } from '../../services/entidad.service';
import { RespuestaService, RespuestaSaipRecepcion } from '../../services/respuesta.service';
import { SolicitudService } from '../../services/solicitud.service';
import { FuncionarioResponderComponent } from './funcionario-responder.component';

/** HTTP/storage are mocked here. PostgreSQL/LOCAL and rollback have a separate real integration suite. */
describe('FuncionarioResponderComponent recepción coordinada', () => {
  const solicitudes = { findByExpediente: vi.fn() };
  const respuestas = { registrarConDocumentos: vi.fn(), consultarRecepcion: vi.fn(),
    crear: vi.fn(), aceptarSolicitud: vi.fn(), denegarSolicitud: vi.fn(), getCausalesDenegacion: vi.fn() };
  const documentos = { upload: vi.fn() };
  const auth = { obtenerSesion: vi.fn() };
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let persistida: RespuestaSaipRecepcion | null;
  const file = () => new File(['respuesta'], 'respuesta.pdf', { type: 'application/pdf' });
  const inicial = () => ({ id: 12, expediente: 'SAIP-2026-00012', estado: 'EN_REVISION', diasRestantes: 5,
    formatoDigital: true, respuesta: null } as Solicitud);
  const fallo = (status: number) => throwError(() => new HttpErrorResponse({ status }));

  beforeEach(async () => {
    vi.resetAllMocks(); sessionStorage.clear(); persistida = null;
    params = new BehaviorSubject(convertToParamMap({ expediente: 'SAIP-2026-00012' }));
    auth.obtenerSesion.mockReturnValue({ funcionarioId: 5, usuarioId: 5, token: 'sesion-a', nombre: 'Funcionario' });
    respuestas.getCausalesDenegacion.mockReturnValue(of([]));
    respuestas.registrarConDocumentos.mockImplementation((_id, clave, datos, files) => {
      persistida = recibo(clave, files, datos.tipoRespuesta); return of(persistida);
    });
    respuestas.consultarRecepcion.mockImplementation((_id, clave) => persistida?.claveOperacion === clave ? of(persistida) : fallo(404));
    solicitudes.findByExpediente.mockImplementation(() => of(persistida ? {
      ...inicial(), estado: persistida.respuesta.tipoRespuesta === 'DENEGACION_TOTAL' ? 'DENEGADA' : 'RESPONDIDA', respuesta: persistida.respuesta
    } : inicial()));
    await TestBed.configureTestingModule({ imports: [FuncionarioResponderComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: SolicitudService, useValue: solicitudes }, { provide: RespuestaService, useValue: respuestas },
      { provide: EntidadService, useValue: { findActivas: () => of([]) } },
      { provide: DocumentoService, useValue: documentos }, { provide: AuthService, useValue: auth }
    ] }).overrideComponent(FuncionarioResponderComponent, { set: { template: '' } }).compileComponents();
  });
  afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

  function pagina(files = [file()]) {
    const fixture = TestBed.createComponent(FuncionarioResponderComponent); fixture.detectChanges();
    const c = fixture.componentInstance; c.decision.set('entrega_total');
    c.descripcionAceptacion = 'Se entrega la información solicitada.'; c.documentosEntrega.set(files); return c;
  }
  function recibo(clave: string, files: readonly File[], tipo = 'ENTREGA_TOTAL'): RespuestaSaipRecepcion {
    const docs = files.map((f, i) => ({ id: 71+i, respuestaId: 44, nombreOriginal: f.name, sizeBytes: f.size,
      hashSha256: 'a'.repeat(64), estado: 'ACTIVO', tipoDocumento: 'RESPUESTA_ENTIDAD', contentType: f.type }));
    return { id: 77, solicitudId: 12, claveOperacion: clave, fechaRecepcion: '2026-10-23T10:00:00', documentos: docs,
      respuesta: { id: 44, tipoRespuesta: tipo, funcionarioId: 5, contenido: 'Se entrega la información solicitada.',
        causalDenegatoria: tipo !== 'ENTREGA_TOTAL' ? 'Causal aportada' : undefined,
        fundamentoLegal: tipo !== 'ENTREGA_TOTAL' ? 'Fundamento aportado' : undefined, documentosMetadata: docs } } as RespuestaSaipRecepcion;
  }

  it('envía todos los bytes en un único comando y confirma tras recuperar recepción y solicitud', async () => {
    const files = [file(), new File(['segundo'], 'segundo.txt', { type: 'text/plain' })]; const c = pagina(files);
    await c.enviarRespuesta();
    expect(respuestas.registrarConDocumentos).toHaveBeenCalledWith(12, expect.stringMatching(/^[a-f0-9-]{36}$/), expect.objectContaining({ tipoRespuesta: 'ENTREGA_TOTAL' }), files);
    expect(respuestas.consultarRecepcion).toHaveBeenCalledTimes(1);
    expect(c.successModalAbierto()).toBe(true); expect(c.recepcionRespuesta()?.documentos.length).toBe(2);
    expect(c.solicitud()?.estado).toBe('RESPONDIDA'); expect(c.documentUploadWarning()).toBe('');
    expect(documentos.upload).not.toHaveBeenCalled(); expect(respuestas.aceptarSolicitud).not.toHaveBeenCalled();
  });
  it('no completa la operación cuando falla un archivo seleccionado', async () => {
    const f = file(); const c = pagina([f]); respuestas.registrarConDocumentos.mockReturnValue(fallo(500));
    await c.enviarRespuesta();
    expect(c.solicitud()?.estado).toBe('EN_REVISION'); expect(c.successModalAbierto()).toBe(false);
    expect(c.documentosEntrega()).toEqual([f]); expect(c.descripcionAceptacion).not.toBe('');
    expect(c.respuestaPendienteVerificacion()).toBe(true); expect(c.puedeReintentarRespuesta()).toBe(true);
    expect(documentos.upload).not.toHaveBeenCalled();
  });
  it('conserva tipo, causal y fundamento de entrega parcial en el comando coordinado', async () => {
    const c = pagina(); c.decision.set('entrega_parcial'); c.causalDenegatoria = 'Causal aportada'; c.fundamentoLegal = 'Fundamento aportado';
    await c.enviarRespuesta();
    expect(respuestas.registrarConDocumentos).toHaveBeenCalledWith(12, expect.any(String), expect.objectContaining({
      tipoRespuesta: 'ENTREGA_PARCIAL', causalDenegatoria: 'Causal aportada', fundamentoLegal: 'Fundamento aportado'
    }), expect.any(Array)); expect(c.solicitud()?.respuesta?.tipoRespuesta).toBe('ENTREGA_PARCIAL');
    expect(respuestas.crear).not.toHaveBeenCalled(); expect(respuestas.aceptarSolicitud).not.toHaveBeenCalled();
  });
  it.each(['entrega_total', 'entrega_parcial', 'denegacion_total'] as const)('mantiene adjuntos opcionales en %s', async decision => {
    const c = pagina([]); c.decision.set(decision); c.descripcionDenegacion = 'Sustento de denegatoria';
    c.causalDenegatoria = 'Causal aportada'; c.fundamentoLegal = 'Fundamento aportado';
    expect(c.canSubmit()).toBe(true); await c.enviarRespuesta();
    expect(c.successModalAbierto()).toBe(true); expect(c.recepcionRespuesta()?.documentos).toEqual([]);
  });
  it.each([400, 401, 403, 404, 409, 422, 413, 415, 500, 0])('el error %i conserva el formulario sin confirmación', async status => {
    const f = file(); const c = pagina([f]); respuestas.registrarConDocumentos.mockReturnValue(fallo(status));
    await c.enviarRespuesta(); expect(c.successModalAbierto()).toBe(false); expect(c.solicitud()?.estado).toBe('EN_REVISION');
    expect(c.documentosEntrega()).toEqual([f]); expect(c.error()).not.toBe('');
    if (status === 0 || status >= 500) {
      await c.enviarRespuesta(); expect(respuestas.registrarConDocumentos).toHaveBeenCalledTimes(1);
      expect(respuestas.consultarRecepcion).toHaveBeenCalledTimes(1);
    } else expect(c.resultadoRespuesta()).toBe('rechazado');
  });
  it('recupera la confirmación perdida después del commit sin repetir POST', async () => {
    const c = pagina(); respuestas.registrarConDocumentos.mockImplementation((_id, clave, datos, files) => {
      persistida = recibo(clave, files, datos.tipoRespuesta); return fallo(0);
    }); await c.enviarRespuesta();
    expect(c.successModalAbierto()).toBe(true); expect(c.resultadoRespuesta()).toBe('recibido');
    expect(respuestas.registrarConDocumentos).toHaveBeenCalledTimes(1); expect(respuestas.consultarRecepcion).toHaveBeenCalledTimes(1);
  });
  it('no interpreta fallo de consulta como ausencia y permite comprobar sin reescribir', async () => {
    const c = pagina(); respuestas.consultarRecepcion.mockReturnValue(fallo(503)); await c.enviarRespuesta();
    expect(c.successModalAbierto()).toBe(false); expect(c.puedeReintentarRespuesta()).toBe(false);
    expect(c.error()).toContain('no demuestra ausencia');
    respuestas.consultarRecepcion.mockImplementation(() => of(persistida)); await c.comprobarRecepcionRespuesta();
    expect(c.successModalAbierto()).toBe(true); expect(respuestas.registrarConDocumentos).toHaveBeenCalledTimes(1);
  });
  it('consulta antes del reintento y conserva clave y contenido originales incluso si se editan campos', async () => {
    const original = file(); const c = pagina([original]); const registrar = respuestas.registrarConDocumentos.getMockImplementation()!;
    respuestas.registrarConDocumentos.mockReturnValue(fallo(0)); await c.enviarRespuesta();
    const primero = respuestas.registrarConDocumentos.mock.calls[0];
    c.descripcionAceptacion = 'Otra edición posterior'; c.documentosEntrega.set([]);
    respuestas.registrarConDocumentos.mockImplementation(registrar); await c.reintentarRespuesta();
    expect(respuestas.registrarConDocumentos.mock.calls[1]).toEqual(primero);
    expect(respuestas.consultarRecepcion).toHaveBeenCalledTimes(3); expect(c.successModalAbierto()).toBe(true);
  });
  it('no reenvía un intento anterior si cambia la sesión mientras comprueba su recepción', async () => {
    const c = pagina(); respuestas.registrarConDocumentos.mockReturnValue(fallo(0));
    await c.enviarRespuesta();
    const consulta = new Subject<RespuestaSaipRecepcion>(); respuestas.consultarRecepcion.mockReturnValue(consulta);
    const reintento = c.reintentarRespuesta();
    auth.obtenerSesion.mockReturnValue({ funcionarioId: 6, usuarioId: 6, token: 'sesion-b' });
    consulta.error(new HttpErrorResponse({ status: 404 })); await reintento;
    expect(respuestas.registrarConDocumentos).toHaveBeenCalledTimes(1);
    expect(c.successModalAbierto()).toBe(false);
  });
  it.each(['solicitud', 'documento-ajeno', 'manifiesto-incompleto', 'hash-invalido'])('no confirma recepción incompatible: %s', async caso => {
    const c = pagina(); respuestas.consultarRecepcion.mockImplementation((_id, clave) => {
      const dto = recibo(clave, [file()]);
      if (caso === 'solicitud') dto.solicitudId = 99;
      if (caso === 'documento-ajeno') dto.documentos[0].respuestaId = 99;
      if (caso === 'manifiesto-incompleto') dto.documentos = [];
      if (caso === 'hash-invalido') dto.documentos[0].hashSha256 = '';
      return of(dto);
    }); await c.enviarRespuesta(); expect(c.successModalAbierto()).toBe(false); expect(c.solicitud()?.estado).toBe('EN_REVISION');
  });
  it('no confirma si la recuperación posterior corresponde a otro expediente', async () => {
    const c = pagina(); solicitudes.findByExpediente.mockReturnValue(of({ ...inicial(), id: 99 }));
    await c.enviarRespuesta(); expect(c.successModalAbierto()).toBe(false); expect(c.solicitud()?.id).toBe(12);
  });
  it.each(['expediente', 'sesion', 'destruccion'])('descarta el resultado tardío al cambiar %s', async cambio => {
    const c = pagina(); const pendiente = new Subject<RespuestaSaipRecepcion>(); respuestas.registrarConDocumentos.mockReturnValue(pendiente);
    const envio = c.enviarRespuesta(); const clave = respuestas.registrarConDocumentos.mock.calls[0][1];
    if (cambio === 'expediente') c.solicitud.set({ ...inicial(), id: 99 });
    if (cambio === 'sesion') auth.obtenerSesion.mockReturnValue({ funcionarioId: 6, usuarioId: 6, token: 'sesion-b' });
    if (cambio === 'destruccion') c.ngOnDestroy();
    pendiente.next(recibo(clave, [file()])); pendiente.complete(); await envio;
    expect(c.successModalAbierto()).toBe(false); expect(respuestas.consultarRecepcion).not.toHaveBeenCalled();
  });
  it('cambiar de ruta limpia los datos anteriores y descarta la operación pendiente', async () => {
    const c = pagina(); const pendiente = new Subject<RespuestaSaipRecepcion>(); respuestas.registrarConDocumentos.mockReturnValue(pendiente);
    const envio = c.enviarRespuesta(); const clave = respuestas.registrarConDocumentos.mock.calls[0][1];
    solicitudes.findByExpediente.mockReturnValue(of({ ...inicial(), id: 99, expediente: 'SAIP-OTRO' }));
    params.next(convertToParamMap({ expediente: 'SAIP-OTRO' }));
    pendiente.next(recibo(clave, [file()])); pendiente.complete(); await envio;
    expect(c.solicitud()?.id).toBe(99); expect(c.documentosEntrega()).toEqual([]); expect(c.successModalAbierto()).toBe(false);
  });
  it('recarga recupera solo por IDs persistidos localmente, sin repetir escrituras', async () => {
    const clave = crypto.randomUUID(); persistida = recibo(clave, [file()]);
    sessionStorage.setItem('yaiku:respuesta:5:12', JSON.stringify({ solicitudId: 12, claveOperacion: clave }));
    const c = pagina(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(c.successModalAbierto()).toBe(true); expect(respuestas.registrarConDocumentos).not.toHaveBeenCalled();
  });
  it('guarda solo identificadores, nunca contenido, archivos o JWT', async () => {
    const c = pagina(); const pendiente = new Subject<RespuestaSaipRecepcion>(); respuestas.registrarConDocumentos.mockReturnValue(pendiente);
    const envio = c.enviarRespuesta(); const raw = sessionStorage.getItem('yaiku:respuesta:5:12')!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['claveOperacion','solicitudId']);
    expect(raw).not.toContain('sesion-a'); expect(raw).not.toContain('Se entrega');
    const clave = JSON.parse(raw).claveOperacion; persistida = recibo(clave, [file()]); pendiente.next(persistida); pendiente.complete(); await envio;
  });
  it('no escribe si no puede conservar la identificación de recuperación', async () => {
    const c = pagina(); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('sin almacenamiento'); });
    await c.enviarRespuesta(); expect(respuestas.registrarConDocumentos).not.toHaveBeenCalled(); expect(c.error()).toContain('recuperación');
  });
  it('mantiene indisponible el compuesto con encauzamiento', async () => {
    const c = pagina(); c.encauzar = true; await c.enviarRespuesta();
    expect(respuestas.registrarConDocumentos).not.toHaveBeenCalled(); expect(c.error()).toContain('encauzamiento');
  });
  it('conserva el bloqueo de respuestas mientras hay subsanación pendiente', async () => {
    const c = pagina(); c.solicitud.set({ ...inicial(), estado: 'PENDIENTE_INFORMACION' }); await c.enviarRespuesta();
    expect(respuestas.registrarConDocumentos).not.toHaveBeenCalled(); expect(c.successModalAbierto()).toBe(false);
  });
  it('informa el envío exitoso de la respuesta al ciudadano', () => {
    const c = pagina(); expect(c.respuestaSuccessTitle()).toContain('Respuesta enviada');
    expect(c.respuestaSuccessDescription()).toContain('entregada al ciudadano dentro del plazo');
  });
});
