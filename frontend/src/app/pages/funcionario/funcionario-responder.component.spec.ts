import '@angular/compiler';
import '../../../test-setup';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Entidad } from '../../models/entidad.model';
import { Solicitud } from '../../models/solicitud.model';
import { hoyLima } from '../../models/calendario.model';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { EntidadService } from '../../services/entidad.service';
import { RespuestaService, RespuestaSaipRecepcion } from '../../services/respuesta.service';
import { SolicitudService } from '../../services/solicitud.service';
import { FuncionarioResponderComponent } from './funcionario-responder.component';

try {
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized
}

/** HTTP/storage are mocked here. PostgreSQL/LOCAL and rollback have a separate real integration suite. */
describe('FuncionarioResponderComponent recepción coordinada', () => {
  const solicitudes = { findByExpediente: vi.fn(), preverAmpliacion: vi.fn(), registrarAmpliacion: vi.fn(),
    actualizarEntregaParcial: vi.fn(), registrarDocumentosEntregaParcial: vi.fn(), emitirLiquidacion: vi.fn(), observar: vi.fn(),
    registrarEncauzamiento: vi.fn() };
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
    solicitudes.registrarEncauzamiento.mockReturnValue(of({ id: 9, estadoEncauzamiento: 'DERIVADO' }));
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

  function vista(files = [file()]) {
    const fixture = TestBed.createComponent(FuncionarioResponderComponent); fixture.detectChanges();
    const c = fixture.componentInstance; c.decision.set('entrega_total');
    c.descripcionAceptacion = 'Se entrega la información solicitada.'; c.documentosEntrega.set(files); return fixture;
  }
  function pagina(files = [file()]) {
    return vista(files).componentInstance;
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
    if (decision === 'entrega_parcial') c.descripcionAceptacionParcial = c.descripcionAceptacion;
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
    const c = pagina();
    const almacenamiento = Object.hasOwn(sessionStorage, 'setItem') ? sessionStorage : Object.getPrototypeOf(sessionStorage);
    vi.spyOn(almacenamiento, 'setItem').mockImplementation(() => { throw new Error('sin almacenamiento'); });
    await c.enviarRespuesta(); expect(respuestas.registrarConDocumentos).not.toHaveBeenCalled(); expect(c.error()).toContain('recuperación');
  });
  it('no arrastra la causal ni el encauzamiento de la entrega parcial a la denegatoria', () => {
    const c = pagina();
    c.seleccionarDecision('entrega_parcial');
    c.causalDenegatoria = 'reservada';
    c.fundamentoLegal = 'Art. 17';
    c.encauzar = true;
    c.entidadDestino = 'SUNAT';
    c.seleccionarDecision('denegacion_total');
    expect(c.causalDenegatoria).toBe('');
    expect(c.fundamentoLegal).toBe('');
    expect(c.encauzar).toBe(false);
    expect(c.entidadDestino).toBe('');
    c.seleccionarDecision('entrega_parcial');
    expect(c.causalDenegatoria).toBe('reservada');
    expect(c.encauzar).toBe(true);
    expect(c.entidadDestino).toBe('SUNAT');
  });
  it('indica qué falta para habilitar el envío de la entrega total', () => {
    const c = pagina();
    c.descripcionAceptacion = '   ';
    expect(c.canSubmit()).toBe(false);
    expect(c.avisosEnvio().join(' ')).toMatch(/descripción/i);
  });
  it('permite denegar sin entidad destino y solo la exige si se elige encauzar', async () => {
    const c = pagina();
    c.decision.set('denegacion_total');
    c.descripcionDenegacion = 'Sustento de la denegatoria';
    c.causalDenegatoria = 'no_posee';
    c.fundamentoLegal = 'Artículo 15 de la Ley 27806';
    expect(c.canSubmit()).toBe(true);
    c.encauzar = true;
    c.motivoEncauzamiento = 'La materia corresponde a otra entidad pública';
    expect(c.canSubmit()).toBe(false);
    expect(c.avisosEnvio().join(' ')).toMatch(/entidad destino/i);
    await c.enviarRespuesta();
    expect(respuestas.registrarConDocumentos).not.toHaveBeenCalled();
    expect(solicitudes.registrarEncauzamiento).not.toHaveBeenCalled();
    expect(c.error()).toMatch(/entidad destino/i);
  });
  it('deriva la solicitud sin registrar denegatoria cuando el encauzamiento total está completo', async () => {
    const c = pagina();
    c.entidades.set([{ id: 8, nombre: 'SUNAT' } as Entidad]);
    c.decision.set('denegacion_total');
    c.descripcionDenegacion = 'No es competencia de esta entidad.';
    c.causalDenegatoria = 'no_posee';
    c.fundamentoLegal = 'Ley 27806';
    c.encauzar = true;
    c.entidadDestino = 'SUNAT';
    c.motivoEncauzamiento = 'La información corresponde a la administración tributaria.';
    expect(c.canSubmit()).toBe(true);
    await c.enviarRespuesta();
    expect(solicitudes.registrarEncauzamiento).toHaveBeenCalledWith(12, expect.objectContaining({ entidadDestinoId: 8, alcance: 'TOTAL' }));
    expect(respuestas.registrarConDocumentos).not.toHaveBeenCalled();
    expect(c.successModalAbierto()).toBe(true);
    expect(c.respuestaSuccessTitle()).toContain('derivada');
  });
  it('registra la denegatoria por información inexistente sin ofrecer encauzamiento', () => {
    const c = pagina();
    c.decision.set('denegacion_total');
    c.descripcionDenegacion = 'La solicitud pide producir información que no existe.';
    c.causalDenegatoria = 'inexistente';
    c.fundamentoLegal = 'Ley 27806';
    c.encauzar = true;
    expect(c.encauzamientoElegido()).toBe(false);
    expect(c.canSubmit()).toBe(true);
    expect(c.avisosEnvio().join(' ')).not.toMatch(/encauz/i);
  });
  it('conserva el bloqueo de respuestas mientras hay subsanación pendiente', async () => {
    const c = pagina(); c.solicitud.set({ ...inicial(), estado: 'PENDIENTE_INFORMACION' }); await c.enviarRespuesta();
    expect(respuestas.registrarConDocumentos).not.toHaveBeenCalled(); expect(c.successModalAbierto()).toBe(false);
  });
  it('informa el envío exitoso de la respuesta al ciudadano', () => {
    const c = pagina(); expect(c.respuestaSuccessTitle()).toContain('Respuesta enviada');
    expect(c.respuestaSuccessDescription()).toContain('entregada al ciudadano dentro del plazo');
  });
  it('gestiona y valida cronograma estructurado de hitos para prórroga', () => {
    const today = '2026-11-17';
    solicitudes.preverAmpliacion.mockReturnValue(of({
      hoy: today, fechaMaximaComunicacion: '2026-11-19', fechaLimiteAmpliada: '2026-11-27',
      disponible: true, requiereCronograma: false
    }));
    const fixture = vista();
    const c = fixture.componentInstance;
    c.via.set('prorroga');
    c.solicitud.set({ ...inicial(), fechaPresentacion: today, fechaLimite: '2026-11-20' });
    c.prorrogaMotivo = 'Búsqueda compleja de acervo documental';
    c.prorrogaDias = '5';
    c.usarCronograma.set(true);
    fixture.detectChanges();

    c.hitos.set([]);
    expect(c.errorHitos()).toContain('al menos una entrega');
    expect(c.canSubmit()).toBe(false);

    c.agregarHito();
    expect(c.hitos().length).toBe(1);
    const limite = c.nuevaFechaLimite() || today;
    c.actualizarHitoFecha(0, limite);
    c.actualizarHitoEntregable(0, 'Revisión en archivo central');
    expect(c.errorHitos()).toBeNull();
    expect(c.canSubmit()).toBe(true);

    c.agregarHito();
    expect(c.hitos().length).toBe(2);
    expect(c.errorHitos()).toBe('Complete la fecha y entregable de cada hito agregado o elimine los hitos vacíos.');
    expect(c.canSubmit()).toBe(false);
    c.quitarHito(1);
    expect(c.hitos().length).toBe(1);
    expect(c.errorHitos()).toBeNull();
    expect(c.canSubmit()).toBe(true);
  });

  it('inicializa via cronograma con fecha de hoy por defecto cuando existen hitos pendientes', () => {
    const hitoPendiente = { id: 40, ampliacionId: 91, numeroEntrega: 1, descripcion: 'Primer bloque',
      fechaProgramada: '2026-11-20', estado: 'PROGRAMADA' as const };
    const ampliacion = { id: 91, solicitudId: 12, estadoAmpliacion: 'REGISTRADA',
      fechaLimiteAmpliada: '2026-12-15', cronograma: [hitoPendiente] } as Solicitud['ampliacionesPlazo'][number];
    solicitudes.findByExpediente.mockReturnValue(of({ ...inicial(), ampliacionesPlazo: [ampliacion] }));

    const fixture = TestBed.createComponent(FuncionarioResponderComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;

    expect(c.via()).toBe('cronograma');
    expect(c.fechaEntrega()[40]).toBe(hoyLima());
  });

  it('valida sustento documental inline antes de registrar hito y ejecuta el envío multiparte', () => {
    const c = pagina();
    const hito = { id: 40, ampliacionId: 91, numeroEntrega: 1, descripcion: 'Primer bloque',
      fechaProgramada: '2026-11-20', estado: 'PROGRAMADA' as const };
    const ampliacion = { id: 91, solicitudId: 12, estadoAmpliacion: 'REGISTRADA',
      fechaLimiteAmpliada: '2026-12-15', cronograma: [hito] } as Solicitud['ampliacionesPlazo'][number];
    c.solicitud.set({ ...inicial(), ampliacionesPlazo: [ampliacion] });
    c.fechaEntrega.set({ 40: '2026-11-19' });

    c.registrarHito(ampliacion, hito);
    expect(solicitudes.registrarDocumentosEntregaParcial).not.toHaveBeenCalled();
    expect(c.cronogramaHitoError()).toEqual(expect.objectContaining({ hitoId: 40 }));

    const doc = file();
    const guardado = {
      ...hito,
      estado: 'ENTREGADA' as const,
      decision: 'ENTREGA_TOTAL' as const,
      fechaEntregaReal: '2026-11-19',
      documentos: [{ id: 88, nombreOriginal: 'respuesta.pdf', contentType: 'application/pdf', sizeBytes: 9 }]
    };
    solicitudes.registrarDocumentosEntregaParcial.mockReturnValue(of(guardado));
    solicitudes.findByExpediente.mockReturnValue(of({
      ...inicial(), ampliacionesPlazo: [{ ...ampliacion, cronograma: [guardado] }]
    }));

    c.registrarHito(ampliacion, hito, [doc], 'ENTREGA_TOTAL');
    expect(solicitudes.registrarDocumentosEntregaParcial).toHaveBeenCalledWith(12, 91, 40, '2026-11-19', [doc], 'ENTREGA_TOTAL', '');
    expect(c.hitoExitoId()).toBe(40);
    expect(c.cronogramaHitoError()).toBeNull();
    expect(c.ampliacionRegistrada()?.cronograma[0].estado).toBe('ENTREGADA');
    expect(respuestas.registrarConDocumentos).not.toHaveBeenCalled();
  });

  it('calcula y persiste cupón de entrega física reactivamente antes de registrar la respuesta', async () => {
    solicitudes.findByExpediente.mockReturnValue(of({
      ...inicial(), formatoFisico: true, formatoDigital: false, copiaSimple: true, copiaCertificada: true,
      descripcion: '[Modalidad requerida: Soportes magnéticos o digitales (CD/DVD/USB)]\n\nPedido'
    }));
    solicitudes.emitirLiquidacion.mockReturnValue(of({
      id: 301, solicitudId: 12, codigoLiquidacion: 'LIQ-2026-00012', monto: 4.2, moneda: 'PEN',
      estadoLiquidacion: 'EMITIDA', fechaEmision: '2026-11-17', fechaLimiteRecojo: '2026-12-17'
    }));
    const c = pagina();

    expect(c.cuponValido()).toBe(false);
    expect(c.faltantesRespuesta().some(msg => /cupón/i.test(msg))).toBe(true);
    expect(c.faltantesRespuesta().some(msg => /descripción/i.test(msg))).toBe(false);

    c.liqFolios = '2';
    c.liqCostoFolio = '0.10';
    c.liqCertificadas = '4';
    c.liqCostoCert = '0.50';
    c.liqSoporte = '2';
    c.cuponLugar = 'Mesa de Partes Central';
    c.cuponEnviado = true;

    expect(c.cuponMonto()).toBe('S/ 4.20');
    expect(c.cuponValido()).toBe(true);
    expect(c.canSubmit()).toBe(true);

    await c.enviarRespuesta();
    expect(solicitudes.emitirLiquidacion).toHaveBeenCalledTimes(1);
    expect(solicitudes.emitirLiquidacion).toHaveBeenCalledWith(12, expect.objectContaining({
      monto: 4.2,
      moneda: 'PEN',
      concepto: expect.stringContaining('2 folios simples (S/ 0.20)'),
      observacion: expect.stringContaining('Mesa de Partes Central')
    }));
    expect(respuestas.registrarConDocumentos).toHaveBeenCalledTimes(1);
  });

  it('detiene el envío de respuesta si emitirLiquidacion falla en el servidor', async () => {
    solicitudes.findByExpediente.mockReturnValue(of({
      ...inicial(), formatoFisico: true, formatoDigital: false, copiaSimple: true, copiaCertificada: false
    }));
    solicitudes.emitirLiquidacion.mockReturnValue(fallo(500));
    const c = pagina();
    c.liqFolios = '5';
    c.liqCostoFolio = '0.20';
    c.cuponLugar = 'Caja 1';
    c.cuponEnviado = true;

    await c.enviarRespuesta();
    expect(c.cuponError()).not.toBe('');
    expect(respuestas.registrarConDocumentos).not.toHaveBeenCalled();
    expect(c.successModalAbierto()).toBe(false);
  });

  it('envía el detalle de precisión como puntos numerados en el motivo existente', () => {
    solicitudes.observar.mockReturnValue(of({}));
    const c = pagina();
    c.via.set('precision');
    expect(c.canSubmit()).toBe(false);
    c.setPrecisionPunto(0, 'Precise el periodo');
    expect(c.canSubmit()).toBe(true);
    c.addPrecisionPunto();
    c.setPrecisionPunto(1, '  Indique el formato  ');
    c.addPrecisionPunto();
    c.removePrecisionPunto(2);
    c.confirmarAccion();
    expect(solicitudes.observar).toHaveBeenCalledWith(12, {
      motivoObservacion: '1. Precise el periodo\n2. Indique el formato',
      responsable: 'Funcionario'
    });
    expect(c.precisionPuntos()).toEqual(['Precise el periodo', '  Indique el formato  ']);
  });
});

describe('FuncionarioResponderComponent UI integrada (cronograma y cupón de pago)', () => {
  const file = () => new File(['documento'], 'entrega-hito.pdf', { type: 'application/pdf' });
  let solicitudes: any;
  let respuestas: any;

  beforeEach(async () => {
    sessionStorage.clear();
    solicitudes = {
      findByExpediente: vi.fn(),
      preverAmpliacion: vi.fn(),
      registrarAmpliacion: vi.fn(),
      actualizarEntregaParcial: vi.fn(),
      registrarDocumentosEntregaParcial: vi.fn(),
      emitirLiquidacion: vi.fn(),
      observar: vi.fn()
    };
    respuestas = {
      registrarConDocumentos: vi.fn(),
      consultarRecepcion: vi.fn(),
      crear: vi.fn(),
      aceptarSolicitud: vi.fn(),
      denegarSolicitud: vi.fn(),
      getCausalesDenegacion: vi.fn(() => of([]))
    };

    await TestBed.configureTestingModule({
      imports: [FuncionarioResponderComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ expediente: 'SAIP-2026-00012' })).asObservable() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: SolicitudService, useValue: solicitudes },
        { provide: RespuestaService, useValue: respuestas },
        { provide: EntidadService, useValue: { findActivas: () => of([]) } },
        { provide: DocumentoService, useValue: { upload: vi.fn() } },
        { provide: AuthService, useValue: { obtenerSesion: () => ({ funcionarioId: 5, usuarioId: 5, token: 'sesion-a', nombre: 'Funcionario' }) } }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('deja el vencimiento en la última entrega y ubica cada parcial antes de esa fecha', () => {
    solicitudes.preverAmpliacion.mockReturnValue(of({
      hoy: '2026-11-17', fechaMaximaComunicacion: '2026-11-19', fechaLimiteAmpliada: '2027-02-11',
      disponible: true, requiereCronograma: true
    }));
    solicitudes.registrarAmpliacion.mockReturnValue(of({
      id: 91, solicitudId: 12, fechaLimiteAmpliada: '2027-02-11', estadoAmpliacion: 'REGISTRADA', cronograma: [
        { id: 10, ampliacionId: 91, descripcion: 'Primer bloque' },
        { id: 11, ampliacionId: 91, descripcion: 'Segundo bloque' },
        { id: 12, ampliacionId: 91, descripcion: 'Cierre del cronograma' }
      ]
    }));
    solicitudes.findByExpediente.mockReturnValue(of({
      id: 12, expediente: 'SAIP-2026-00012', estado: 'EN_REVISION', fechaPresentacion: '2026-11-17',
      diasRestantes: 5, formatoDigital: true, respuesta: null, ampliacionesPlazo: []
    }));
    const fixture = TestBed.createComponent(FuncionarioResponderComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.setVia('prorroga');
    c.prorrogaDias = '50';
    c.prorrogaMotivo = 'Digitalización de expedientes';
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#fecha-comunicacion-ampliacion')).toBeNull();
    expect(root.textContent).toContain('Se comunica hoy');
    expect(root.textContent).toContain('17/11/2026');
    expect(root.querySelector('#cronograma-fecha-0')?.getAttribute('min')).toBe('2026-11-17');
    expect(root.querySelector('#cronograma-fecha-0')?.getAttribute('max')).toBe('2026-12-17');
    expect(root.textContent).toContain('Desde hoy, 17/11/2026');
    expect(root.textContent).toContain('como máximo 30 días');
    expect(c.hitos().at(-1)).toEqual({ fecha: '2027-02-11', entregable: '', cierre: true });
    expect(root.textContent).not.toContain('Elija una fecha posterior a la entrega 1');

    c.actualizarHitoFecha(0, '2026-12-20');
    fixture.detectChanges();
    expect(root.querySelector('#cronograma-fecha-error-0')?.textContent).toContain('30 días desde hoy');
    expect(root.querySelector('#cronograma-fecha-error-0')?.textContent).toContain('17/12/2026');

    c.actualizarHitoFecha(0, '2027-02-12');
    fixture.detectChanges();
    expect(root.querySelector('#cronograma-fecha-error-0')?.textContent).toContain('11/02/2027');
    expect(root.querySelector('#cronograma-fecha-error-0')?.textContent).not.toContain('posterior a la entrega 1');
    c.handleSubmit();
    expect(c.confirmModalAbierto()).toBe(false);

    c.actualizarHitoFecha(0, '2026-12-15');
    c.actualizarHitoEntregable(0, 'Primer bloque');
    c.actualizarHitoEntregable(1, 'Cierre del cronograma');
    c.agregarHito();
    expect(c.hitos().at(-1)?.fecha).toBe('2027-02-11');
    expect(c.hitos()[1].fecha).toBe('');
    fixture.detectChanges();
    expect(root.querySelector('#cronograma-fecha-1')?.getAttribute('min')).toBe('2027-01-12');
    expect(root.querySelector('#cronograma-fecha-1')?.getAttribute('max')).toBe('2027-01-14');
    c.actualizarHitoFecha(1, '2026-12-15');
    fixture.detectChanges();
    expect(root.querySelector('#cronograma-fecha-error-1')?.textContent).toContain('15/12/2026');

    c.actualizarHitoFecha(1, '2027-01-15');
    fixture.detectChanges();
    expect(root.querySelector('#cronograma-fecha-error-1')?.textContent).toContain('30 días');
    c.actualizarHitoFecha(1, '2027-01-14');
    c.actualizarHitoEntregable(1, 'Segundo bloque');
    c.handleSubmit();
    expect(c.confirmModalAbierto()).toBe(true);
    expect(c.respuestaConfirmSummary()).toContainEqual({ label: 'Entrega 2 · 14/01/2027', value: 'Segundo bloque' });
    c.confirmarAccion();
    expect(solicitudes.registrarAmpliacion).toHaveBeenCalledWith(12, expect.objectContaining({
      fechaNotificacionAmpliacion: '2026-11-17',
      diasHabilesAdicionales: 50,
      cronograma: [
        expect.objectContaining({ numeroEntrega: 1, fechaProgramada: '2026-12-15' }),
        expect.objectContaining({ numeroEntrega: 2, fechaProgramada: '2027-01-14' }),
        expect.objectContaining({ numeroEntrega: 3, fechaProgramada: '2027-02-11' })
      ]
    }));
    expect(c.respuestaSuccessTitle()).toBe('Ampliación del plazo registrada');
    expect(c.successModalAbierto()).toBe(true);
  });

  it('permite revisar o quitar archivos antes de confirmar la entrega parcial y evita duplicar el adjuntado al cerrar', () => {
    const hito = {
      id: 40, ampliacionId: 91, numeroEntrega: 1, descripcion: 'Entregable 01',
      fechaProgramada: '2026-12-20', estado: 'PROGRAMADA' as const
    };
    const ampliacion = {
      id: 91, solicitudId: 12, estadoAmpliacion: 'REGISTRADA',
      fechaLimiteAmpliada: '2026-12-30', cronograma: [hito]
    };
    solicitudes.findByExpediente.mockReturnValue(of({
      id: 12, expediente: 'SAIP-2026-00012', estado: 'EN_REVISION', diasRestantes: 5,
      formatoDigital: true, respuesta: null, ampliacionesPlazo: [ampliacion]
    }));

    const fixture = TestBed.createComponent(FuncionarioResponderComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Paso 1 · Entregas parciales del cronograma');
    expect(root.textContent).toContain('Paso 2 · Resolución definitiva del expediente');
    expect(root.textContent).not.toContain('Decisión institucional');
    expect(root.querySelector('[data-hito-id="40"]')).not.toBeNull();

    const pdfEquivocado = new File(['malo'], 'equivocado.pdf', { type: 'application/pdf' });
    const pdfCorrecto = new File(['ok'], 'entrega-hito.pdf', { type: 'application/pdf' });

    const inputEl = root.querySelector('input[data-hito-file-input="40"]') as HTMLInputElement;
    Object.defineProperty(inputEl, 'files', { value: [pdfEquivocado], configurable: true });
    inputEl.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // No debe registrar automáticamente al solo adjuntar; permite revisar o quitar.
    expect(solicitudes.registrarDocumentosEntregaParcial).not.toHaveBeenCalled();
    expect(root.textContent).toContain('equivocado.pdf');
    expect(root.querySelector('button[aria-label="Previsualizar equivocado.pdf"]')).not.toBeNull();

    const btnQuitar = root.querySelector('button[aria-label="Quitar equivocado.pdf"]') as HTMLButtonElement | null;
    expect(btnQuitar).not.toBeNull();
    btnQuitar!.click();
    fixture.detectChanges();
    expect(root.textContent).not.toContain('equivocado.pdf');

    Object.defineProperty(inputEl, 'files', { value: [pdfCorrecto], configurable: true });
    inputEl.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(solicitudes.registrarDocumentosEntregaParcial).not.toHaveBeenCalled();

    const guardado = {
      ...hito, estado: 'ENTREGADA' as const, decision: 'ENTREGA_TOTAL' as const, fechaEntregaReal: hoyLima(),
      documentos: [{ id: 88, nombreOriginal: 'entrega-hito.pdf', contentType: 'application/pdf', sizeBytes: 9 }]
    };
    solicitudes.registrarDocumentosEntregaParcial.mockReturnValue(of(guardado));
    solicitudes.findByExpediente.mockReturnValue(of({
      id: 12, expediente: 'SAIP-2026-00012', estado: 'EN_REVISION', diasRestantes: 5,
      formatoDigital: true, respuesta: null,
      ampliacionesPlazo: [{ ...ampliacion, estadoAmpliacion: 'COMPLETADA', cronograma: [guardado] }]
    }));

    const btnConfirmar = root.querySelector('button[data-hito-confirm="40"]') as HTMLButtonElement | null;
    expect(btnConfirmar).not.toBeNull();
    expect(btnConfirmar!.disabled).toBe(true);
    const decision = root.querySelector<HTMLSelectElement>('#hito-decision-40')!;
    decision.value = 'ENTREGA_PARCIAL';
    decision.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(btnConfirmar!.disabled).toBe(true);
    decision.value = 'ENTREGA_TOTAL';
    decision.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(btnConfirmar!.disabled).toBe(false);
    btnConfirmar!.click();
    fixture.detectChanges();

    expect(solicitudes.registrarDocumentosEntregaParcial).toHaveBeenCalledWith(12, 91, 40, hoyLima(), [pdfCorrecto], 'ENTREGA_TOTAL', '');
    expect(root.textContent).toContain('entrega-hito.pdf');
    expect(root.textContent).toContain('Continuar con respuesta final');

    // Pasar al Paso 2: seleccionar Entrega total debe mostrar lo entregado y no duplicar de entrada la zona de arrastre.
    const btnPaso2 = Array.from(root.querySelectorAll('button')).find(b => b.textContent?.includes('Continuar con respuesta final')) as HTMLButtonElement | undefined;
    expect(btnPaso2).toBeDefined();
    btnPaso2!.click();
    fixture.detectChanges();

    const btnEntregaTotal = Array.from(root.querySelectorAll('button')).find(b => b.textContent?.includes('Entrega total')) as HTMLButtonElement | undefined;
    expect(btnEntregaTotal).toBeDefined();
    btnEntregaTotal!.click();
    fixture.detectChanges();

    expect(root.textContent).toContain('Documentos registrados en el cronograma');
    expect(root.textContent).toContain('entrega-hito.pdf');
    expect(root.textContent).not.toContain('Documentos adicionales de cierre (opcional)');

    const btnOpcionales = root.querySelector('button[data-toggle-adicionales-cierre]') as HTMLButtonElement | null;
    expect(btnOpcionales).not.toBeNull();
    btnOpcionales!.click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Documentos adicionales de cierre (opcional)');
  });

  it('refleja en tiempo real el cálculo del cupón de pago con OnPush y decimales con coma', () => {
    solicitudes.findByExpediente.mockReturnValue(of({
      id: 12, expediente: 'SAIP-2026-00012', estado: 'EN_REVISION', diasRestantes: 5,
      formatoFisico: true, formatoDigital: false, copiaSimple: true, copiaCertificada: true,
      descripcion: '[Modalidad requerida: Soportes magnéticos o digitales (CD/DVD/USB)]\n\nPedido',
      respuesta: null, ampliacionesPlazo: []
    }));

    const fixture = TestBed.createComponent(FuncionarioResponderComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;

    c.decision.set('entrega_total');
    c.descripcionAceptacion = 'Disponible en mesa de partes.';
    c.liqFolios = '2';
    c.liqCostoFolio = '0.10';
    c.liqCertificadas = '4';
    c.liqCostoCert = '0.50';
    c.liqSoporte = '2';
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('S/ 4.20');

    c.liqCostoFolio = '0,10';
    c.liqCostoCert = '0,50';
    fixture.detectChanges();
    expect(root.textContent).toContain('S/ 4.20');
  });

  it('liquida solo la copia simple cuando esa es la modalidad pedida', () => {
    solicitudes.findByExpediente.mockReturnValue(of({
      id: 12, expediente: 'SAIP-2026-00012', estado: 'EN_REVISION', diasRestantes: 5,
      formatoFisico: true, formatoDigital: true, copiaSimple: true, copiaCertificada: false,
      descripcion: '[Oficina destinataria: Oficina de Hidrocarburo]\n\nSolo copias',
      respuesta: null, ampliacionesPlazo: []
    }));

    const fixture = TestBed.createComponent(FuncionarioResponderComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.decision.set('entrega_total');
    c.descripcionAceptacion = 'Disponible en mesa de partes.';
    c.liqFolios = '3';
    c.liqCostoFolio = '0.10';
    c.liqCertificadas = '4';
    c.liqCostoCert = '0.50';
    c.liqSoporte = '34';
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#liq-folios')).not.toBeNull();
    expect(root.querySelector('#liq-certificadas')).toBeNull();
    expect(root.querySelector('#liq-soporte')).toBeNull();
    expect(root.textContent).toContain('copia simple');
    expect(root.textContent).not.toContain('copia certificada');
    expect(root.textContent).not.toContain('soporte CD/USB');
    expect(c.liqTotal()).toBe(0.3);
    expect(c.descripcionVisible()).toBe('Solo copias');
  });

  it('oculta el cupón cuando la modalidad es solo correo electrónico', () => {
    solicitudes.findByExpediente.mockReturnValue(of({
      id: 12, expediente: 'SAIP-2026-00012', estado: 'EN_REVISION', diasRestantes: 5,
      formatoFisico: false, formatoDigital: true, copiaSimple: false, copiaCertificada: false,
      descripcion: 'Por correo', respuesta: null, ampliacionesPlazo: []
    }));

    const fixture = TestBed.createComponent(FuncionarioResponderComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.decision.set('entrega_total');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Cupón de pago (entrega física)');
    expect(c.requiereFisico()).toBe(false);
  });
});
