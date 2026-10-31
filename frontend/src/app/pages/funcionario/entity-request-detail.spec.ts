import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { EntidadService } from '../../services/entidad.service';
import { SolicitudService } from '../../services/solicitud.service';
import { FuncionarioSolicitudDetalleComponent as Detail } from './funcionario-solicitud-detalle.component';

// UI regression evidence only: real Angular templates, mocked server and session.
describe('EntityRequestDetail — relaciones, registros y contexto', () => {
  const code = 'SAIP-2026-00101';
  const row = (patch: Record<string, unknown> = {}) => ({ id: 101, expediente: code, entidadId: 3,
    entidadNombre: 'Entidad sintética', ciudadanoId: 4, ciudadanoNombre: 'Persona sintética',
    asunto: 'Pedido sintético', descripcion: 'Descripción del pedido', estado: 'EN_REVISION',
    fechaPresentacion: '2026-10-01T10:00:00', fechaLimite: '2026-11-01', diasRestantes: 3,
    formatoDigital: true, formatoFisico: false, copiaSimple: false, copiaCertificada: false,
    respuesta: null, observaciones: [], ampliacionesPlazo: [], encauzamientos: [], liquidacionesCosto: [],
    documentos: [], documentosMetadata: [], apelacion: null, ...patch });
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>, solicitudes: any, documentos: any, auth: any;
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ expediente: code }));
    solicitudes = { findByExpediente: vi.fn(() => of(row())),
      obtenerSeguimientoPlazo: vi.fn(() => of({ diasRestantes: 5 })),
      findByCiudadanoId: vi.fn(() => of([])), observar: vi.fn() };
    documentos = { download: vi.fn() };
    auth = { cambiosSesion: signal(0), obtenerSesion: vi.fn(() => ({ token: 'sesion-sintetica', usuarioId: 7, funcionarioId: 7, entidadId: 3 })) };
    TestBed.configureTestingModule({ imports: [Detail], providers: [provideRouter([]),
      provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: SolicitudService, useValue: solicitudes }, { provide: DocumentoService, useValue: documentos },
      { provide: AuthService, useValue: auth }, { provide: EntidadService, useValue: { findActivas: () => of([]) } }] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });
  function page() { const f = TestBed.createComponent(Detail); f.detectChanges(); return f; }

  it('rechaza el resultado de un expediente diferente del solicitado', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ expediente: 'SAIP-2026-00102', asunto: 'Otro expediente' })));
    const f = page(); expect(f.componentInstance.solicitud()).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Otro expediente');
  });
  it('utiliza las modalidades explícitas y no extrae una modalidad del texto libre', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ formatoDigital: false, formatoFisico: true, descripcion: 'No enviar por correo ni digital' })));
    const f = page(); expect(f.componentInstance.formatosSolicitados()).toEqual(['Físico']);
  });
  it('un estado VENCIDA sin respuesta no fabrica una respuesta ni un hito fechado con el límite', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ estado: 'VENCIDA', diasRestantes: -2 })));
    const f = page(); expect(f.componentInstance.puedeVerRespuesta()).toBe(false);
    expect(f.componentInstance.historialItems().some(item => item.accion.includes('automático'))).toBe(false);
  });
  it('no muestra documentos de una respuesta ajena', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ estado: 'RESPONDIDA', respuesta: { id: 11, tipoRespuesta: 'ENTREGA_TOTAL',
      documentosMetadata: [{ id: 91, respuestaId: 99, nombreOriginal: 'ajeno.pdf' }] } })));
    const f = page(); expect(f.componentInstance.documentosRespuestaEntidad()).toEqual([]);
    expect(f.nativeElement.textContent).not.toContain('ajeno.pdf');
  });
  it('la observación pendiente impide ofrecer respuesta aunque el estado general sea EN_REVISION', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ observaciones: [{ id: 8, solicitudId: 101, estado: 'PENDIENTE_SUBSANACION' }] })));
    const f = page(); expect(f.componentInstance.puedeResponder()).toBe(false);
  });
  it('la consulta previa no autorizada para funcionarios no se presenta como ausencia confirmada de solicitudes', () => {
    solicitudes.findByCiudadanoId.mockReturnValue(new Subject()); const f = page(); f.componentInstance.activeTab.set('ciudadano'); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('no tiene otras solicitudes');
    expect(f.nativeElement.textContent).toMatch(/consultando|cargando|no disponible/i);
    expect(solicitudes.findByCiudadanoId).not.toHaveBeenCalled();
  });
  it('una escritura pendiente no vuelve a cargar el expediente anterior tras navegar', () => {
    const pending = new Subject(); solicitudes.observar.mockReturnValue(pending);
    const f = page(); f.componentInstance.observacionMotivo.set('Motivo sintético'); f.componentInstance.registrarObservacion();
    solicitudes.findByExpediente.mockReturnValue(of(row({ id: 102, expediente: 'SAIP-2026-00102' })));
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00102' })); f.detectChanges();
    pending.next({ id: 8 }); f.detectChanges(); expect(f.componentInstance.solicitud()?.expediente).toBe('SAIP-2026-00102');
    expect(solicitudes.findByExpediente.mock.calls.map((call: string[]) => call[0])).toEqual([code, 'SAIP-2026-00102']);
  });
  it('la relación de apelación no acredita cédula firmada ni notificación eficaz', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ apelacion: { id: 22, expediente: 'TTAIP-2026-00022', fechaApelacion: '2026-10-20' } })));
    const f = page(); f.componentInstance.activeTab.set('notificaciones'); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('documento oficial firmado');
    expect(f.nativeElement.textContent).not.toContain('notificó a la entidad');
  });
  it('un nombre de archivo no acredita que pertenezca a una subsanación', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ documentosMetadata: [{ id: 91, solicitudId: 101, tipoDocumento: 'DOCUMENTO_ADJUNTO', nombreOriginal: 'subsanacion-informativa.pdf' }] })));
    const f = page(); expect(f.componentInstance.grupoSubsanaciones()).toEqual([]);
  });
  it('rechaza actuaciones asociadas explícitamente a otra solicitud', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ liquidacionesCosto: [{ id: 15, solicitudId: 102, estadoLiquidacion: 'PAGADA', concepto: 'Concepto ajeno' }] })));
    const f = page(); expect(f.componentInstance.liquidaciones()).toEqual([]);
    expect(f.componentInstance.historialItems().some(item => item.detalle.includes('Concepto ajeno'))).toBe(false);
  });
  it('conserva encabezado, pestañas, retorno y enlace al comando específico con expediente persistido', () => {
    const f = page(); expect(f.nativeElement.querySelector('h1').textContent).toContain('Pedido sintético');
    expect(f.nativeElement.querySelector('a[href="/funcionario"]')).not.toBeNull();
    expect(f.nativeElement.querySelector(`a[href='/funcionario/responder/${code}']`)).not.toBeNull();
    expect(f.nativeElement.querySelector('[role=tablist]')).not.toBeNull();
    expect(solicitudes.findByExpediente).toHaveBeenCalledWith(code);
  });
  it('la carga de otro recurso retira el detalle, el visor, los datos de actuaciones y los mensajes anteriores', () => {
    const f = page(), pending = new Subject(); f.componentInstance.observacionMotivo.set('dato anterior');
    f.componentInstance.liquidacionSuccess.set('mensaje anterior'); f.componentInstance.previewTarget.set({ id: 91, nombre: 'viejo.pdf' });
    solicitudes.findByExpediente.mockReturnValue(pending); params.next(convertToParamMap({ expediente: 'SAIP-2026-00102' })); f.detectChanges();
    expect(f.componentInstance.solicitud()).toBeNull(); expect(f.componentInstance.previewTarget()).toBeNull();
    expect(f.componentInstance.observacionMotivo()).toBe(''); expect(f.componentInstance.liquidacionSuccess()).toBe('');
    expect(f.nativeElement.querySelector('[role=status]').textContent).toContain('Cargando');
  });
  it.each([0, 400, 401, 403, 404, 500])('un error %i no conserva el expediente ni inventa datos o documentos', status => {
    const f = page(); solicitudes.findByExpediente.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    f.componentInstance.cargarSolicitud('SAIP-2026-00102'); f.detectChanges();
    expect(f.componentInstance.solicitud()).toBeNull(); expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Persona sintética'); expect(f.componentInstance.previewTarget()).toBeNull();
    expect(f.componentInstance.reintentable()).toBe(status === 0 || status === 500);
  });
  it('una respuesta vacía confirmada mantiene el retorno sin construir otro expediente', () => {
    solicitudes.findByExpediente.mockReturnValue(of(null)); const f = page();
    expect(f.nativeElement.textContent).toContain('No se encontró la solicitud');
    expect(f.nativeElement.querySelector('a[href="/funcionario"]')).not.toBeNull();
    expect(solicitudes.obtenerSeguimientoPlazo).not.toHaveBeenCalled();
  });
  it('datos incompletos no se presentan como resultado atendido ni como modalidades supuestas', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ estado: 'CONCLUIDA', formatoDigital: undefined, formatoFisico: undefined,
      copiaSimple: undefined, copiaCertificada: undefined, tipoInformacion: null, respuesta: null, fechaPresentacion: 'fecha no válida' })));
    const f = page(); expect(f.componentInstance.puedeVerRespuesta()).toBe(false); expect(f.componentInstance.formatosSolicitados()).toEqual([]);
    expect(f.nativeElement.textContent).toContain('No informado'); expect(f.nativeElement.textContent).not.toContain('Atendida');
  });
  it('una denegatoria conserva causal y fundamento sin atribuir entrega o firma', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ estado: 'DENEGADA', respuesta: { id: 11, tipoRespuesta: 'DENEGACION_TOTAL',
      contenido: 'Contenido real', causalDenegatoria: 'Causal registrada', fundamentoLegal: 'Fundamento registrado', documentosMetadata: [] } })));
    const f = page(); const text = f.nativeElement.textContent;
    expect(text).toContain('Causal registrada'); expect(text).toContain('Fundamento registrado'); expect(text).toContain('No registrada');
    expect(text).not.toContain('documento oficial firmado'); expect(f.componentInstance.documentosRespuestaEntidad()).toEqual([]);
  });
  it('una respuesta parcial conserva sus datos y documentos realmente vinculados', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ estado: 'RESPONDIDA', respuesta: { id: 11, tipoRespuesta: 'ENTREGA_PARCIAL',
      contenido: 'Contenido parcial', causalDenegatoria: 'Causal parcial', fundamentoLegal: 'Fundamento parcial',
      documentosMetadata: [{ id: 91, respuestaId: 11, nombreOriginal: 'parcial.pdf', contentType: 'application/pdf', sizeBytes: 632 }] } })));
    const f = page(); expect(f.nativeElement.textContent).toContain('Causal parcial'); expect(f.nativeElement.textContent).toContain('Fundamento parcial');
    expect(f.nativeElement.textContent).toContain('parcial.pdf'); expect(f.nativeElement.textContent).toContain('Atendida dentro del plazo');
    expect(f.componentInstance.documentosRespuestaEntidad()[0].id).toBe(91);
  });
  it('los documentos históricos anidados sin FK conservan su asociación, pero no se usan rutas suministradas', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ documentosMetadata: undefined,
      documentos: [{ id: 91, nombreArchivo: 'historico.pdf', tipoArchivo: 'application/pdf', tamanio: 0, rutaArchivo: 'ruta-no-consumible' }] })));
    const f = page(); f.componentInstance.abrirDocPreview(f.componentInstance.grupoPrincipales()[0]);
    expect(f.componentInstance.previewTarget()).toMatchObject({ id: 91, nombre: 'historico.pdf', expediente: code });
    expect(f.componentInstance.previewTarget()?.url).toBeUndefined(); expect(f.componentInstance.grupoPrincipales()[0].tamano).toBe('0 B');
  });
  it('una lista metadata vacía no reactiva documentos históricos de otra lista', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ documentosMetadata: [], documentos: [{ id: 91, nombreArchivo: 'viejo.pdf' }] })));
    const f = page(); expect(f.componentInstance.todosDocumentosAdministrado()).toEqual([]);
  });
  it.each([
    { id: 91, solicitudId: 102 }, { id: 91, respuestaId: 11 }, { id: 91, solicitudId: 101, respuestaId: 11 }, { id: null, solicitudId: 101 },
  ])('una relación documental incompatible no habilita preview ni descarga: %j', doc => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ documentosMetadata: [{ ...doc, nombreOriginal: 'no-verificado.pdf' }] })));
    const f = page(); f.componentInstance.abrirDocPreview(doc); f.componentInstance.descargarDoc(doc);
    expect(f.componentInstance.previewTarget()).toBeNull(); expect(documentos.download).not.toHaveBeenCalled();
    expect(f.componentInstance.informacionIncompleta()).toBe(true);
  });
  it('una descarga pendiente se cancela al cambiar de solicitud, sin URL ni contenido anterior', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ documentosMetadata: [{ id: 91, solicitudId: 101, nombreOriginal: 'documento.pdf' }] })));
    const pending = new Subject(); documentos.download.mockReturnValue(pending); const f = page();
    f.componentInstance.descargarDoc(f.componentInstance.grupoPrincipales()[0]); expect(pending.observed).toBe(true);
    solicitudes.findByExpediente.mockReturnValue(of(row({ id: 102, expediente: 'SAIP-2026-00102' })));
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00102' })); f.detectChanges(); expect(pending.observed).toBe(false);
    expect(f.componentInstance.previewTarget()).toBeNull();
  });
  it('una descarga fallida no genera URL ni archivo sustituto y conserva el error accesible', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ documentosMetadata: [{ id: 91, solicitudId: 101, nombreOriginal: 'documento.pdf' }] })));
    documentos.download.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const f = page(); f.componentInstance.descargarDoc(f.componentInstance.grupoPrincipales()[0]); f.detectChanges();
    expect(documentos.download).toHaveBeenCalledWith(91, 'documento.pdf'); expect(f.nativeElement.querySelector('[role=alert]').textContent).toMatch(/documento/i);
  });
  it('no toma un documento seleccionado anteriormente al abrir otro recurso', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ documentosMetadata: [{ id: 91, solicitudId: 101, nombreOriginal: 'anterior.pdf' }] })));
    const f = page(); const anterior = f.componentInstance.grupoPrincipales()[0];
    solicitudes.findByExpediente.mockReturnValue(of(row({ id: 102, expediente: 'SAIP-2026-00102' })));
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00102' })); f.detectChanges();
    f.componentInstance.abrirDocPreview(anterior); expect(f.componentInstance.previewTarget()).toBeNull();
  });
  it('la consulta de solicitudes previas no acepta otra entidad o ciudadano', () => {
    solicitudes.findByCiudadanoId.mockReturnValue(of([row({ id: 102, expediente: 'SAIP-2026-00102', entidadId: 5 })]));
    const f = page(); f.componentInstance.activeTab.set('ciudadano'); f.detectChanges();
    expect(f.componentInstance.solicitudesPrevias()).toEqual([]); expect(f.componentInstance.previasError()).toContain('no disponible');
    expect(solicitudes.findByCiudadanoId).not.toHaveBeenCalled();
    expect(f.nativeElement.querySelector('a[href="/funcionario/solicitud/SAIP-2026-00102"]')).toBeNull();
  });
  it('el seguimiento ausente o fallido no toma el plazo de la solicitud ni calcula desde su límite', () => {
    solicitudes.obtenerSeguimientoPlazo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const f = page(); expect(f.componentInstance.getDiasRestantes()).toBeNull(); expect(f.nativeElement.textContent).toContain('Sin dato');
  });
  it('el seguimiento de plazos prioriza la respuesta del servicio especializado', () => {
    const f = page(); expect(f.componentInstance.getDiasRestantes()).toBe(5); expect(f.componentInstance.solicitud()?.diasRestantes).toBe(3);
  });
  it('el último día y la respuesta tardía conservan las condiciones del servidor', () => {
    solicitudes.obtenerSeguimientoPlazo.mockReturnValue(of({ diasRestantes: 0 }));
    solicitudes.findByExpediente.mockReturnValue(of(row({ estado: 'VENCIDA', diasRestantes: -1 })));
    const f = page(); expect(f.componentInstance.puedeResponder()).toBe(true); expect(f.componentInstance.getDiasRestantes()).toBe(0);
    expect(f.componentInstance.solicitud()?.estado).toBe('VENCIDA');
  });
  it('un registro sin fecha no usa la fecha de notificación ni el límite como hito de historial', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ ampliacionesPlazo: [{ id: 8, solicitudId: 101, fechaNotificacionAmpliacion: '2026-10-15' }] })));
    const f = page(); const act = f.componentInstance.historialItems().find(item => item.accion.startsWith('Ampliación'));
    expect(act?.fecha).toBeUndefined(); f.componentInstance.activeTab.set('historial'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Fecha no informada');
  });
  it('una observación pendiente con fecha antigua de subsanación no fabrica recepción exitosa', () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ observaciones: [{ id: 8, solicitudId: 101, estado: 'PENDIENTE_SUBSANACION', fechaSubsanacion: '2026-10-20' }] })));
    const f = page(); expect(f.componentInstance.historialItems().some(item => item.accion === 'Subsanación ciudadana recibida')).toBe(false);
    expect(f.nativeElement.textContent).toContain('Subsanación presentada · pendiente de evaluación');
  });
  it('las fechas de formularios no acreditadas no se rellenan con hoy ni con entregas calculadas', () => {
    const f = page(); expect(f.componentInstance.ampliacionFechaNotificacion()).toBe('');
    expect(f.componentInstance.liquidacionFechaNotificacion()).toBe(''); expect(f.componentInstance.ampliacionCronograma()[0].fechaProgramada).toBe('');
  });
  it('un cambio institucional de la misma sesión limpia y cancela sus consultas', () => {
    const f = page(), pending = new Subject(); solicitudes.findByExpediente.mockReturnValue(pending); f.componentInstance.cargarSolicitud(code);
    expect(pending.observed).toBe(true);
    auth.obtenerSesion.mockReturnValue({ token: 'sesion-sintetica', usuarioId: 7, funcionarioId: 7, entidadId: 4 }); auth.cambiosSesion.update((n: number) => n + 1); f.detectChanges();
    expect(f.componentInstance.solicitud()).toBeNull(); expect(pending.observed).toBe(false); expect(f.nativeElement.querySelector('[role=tablist]')).toBeNull();
  });
  it('destruir el detalle cancela consultas y comandos pendientes sin disparar continuaciones', () => {
    const pending = new Subject(); solicitudes.observar.mockReturnValue(pending); const f = page();
    f.componentInstance.observacionMotivo.set('Motivo sintético'); f.componentInstance.registrarObservacion(); f.destroy();
    expect(pending.observed).toBe(false); pending.next({ id: 8 }); expect(solicitudes.findByExpediente).toHaveBeenCalledTimes(1);
    f.componentInstance.registrarObservacion(); expect(solicitudes.observar).toHaveBeenCalledTimes(1);
  });
  it('las pestañas conservan flechas, Home/End y un único foco activo asociado al panel', () => {
    const f = page(); const tabs = f.nativeElement.querySelectorAll('[role=tab]') as NodeListOf<HTMLButtonElement>;
    tabs[0].focus(); tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })); f.detectChanges();
    expect(tabs[tabs.length - 1].getAttribute('aria-selected')).toBe('true'); expect(document.activeElement).toBe(tabs[tabs.length - 1]);
    tabs[tabs.length - 1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })); f.detectChanges();
    expect(tabs[0].getAttribute('aria-selected')).toBe('true'); expect(f.nativeElement.querySelectorAll('[role=tab][tabindex="0"]').length).toBe(1);
    expect(f.nativeElement.querySelector('[role=tabpanel]').getAttribute('aria-labelledby')).toBe(tabs[0].id);
  });
  it('abrir/cerrar el visor conserva foco opt-in, Escape y devolución al control real sin probar render PDF', async () => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ documentosMetadata: [{ id: 91, solicitudId: 101, nombreOriginal: 'documento.pdf', contentType: 'application/pdf' }] })));
    const pending = new Subject(); documentos.download.mockReturnValue(pending); const f = page();
    f.componentInstance.activeTab.set('adjuntos'); f.detectChanges();
    const trigger = f.nativeElement.querySelector('button[title="Ver documento"]') as HTMLButtonElement;
    trigger.focus(); trigger.click(); f.detectChanges(); await Promise.resolve();
    const dialog = document.body.querySelector('[role=dialog]')!; expect(dialog.getAttribute('aria-label')).toBe('documento.pdf');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const close = dialog.querySelector('button[title="Cerrar"]') as HTMLButtonElement; close.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(dialog.contains(document.activeElement)).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges();
    expect(f.componentInstance.previewTarget()).toBeNull(); expect(document.activeElement).toBe(trigger); expect(pending.observed).toBe(false);
  });
  it('un evento de subida de la solicitud anterior no vuelve a consultar el nuevo recurso', () => {
    const f = page(); f.componentInstance.onDocumentoSubido('adjuntos', 999); expect(solicitudes.findByExpediente).toHaveBeenCalledTimes(1);
  });
  it.each(['registrarAmpliacion', 'registrarEncauzamiento', 'emitirLiquidacion', 'actualizarLiquidacion'])('la continuación del comando %s no repuebla otra sesión', command => {
    solicitudes.findByExpediente.mockReturnValue(of(row({ liquidacionesCosto: [{ id: 15, solicitudId: 101, estadoLiquidacion: 'EMITIDA' }] })));
    const f = page(), c = f.componentInstance, pending = new Subject();
    solicitudes[command] = vi.fn(() => pending);
    if (command === 'registrarAmpliacion') {
      c.ampliacionMotivo.set('Motivo'); c.ampliacionInforme.set('Informe'); c.ampliacionFechaNotificacion.set('2026-10-20');
      c.ampliacionCronograma.set([{ numeroEntrega: 1, descripcion: 'Entrega registrada', fechaProgramada: '2026-10-25' }]); c.registrarAmpliacion();
    } else if (command === 'registrarEncauzamiento') { c.encauzamientoEntidadDestinoId.set(5); c.encauzamientoMotivo.set('Motivo'); c.registrarEncauzamiento(); }
    else if (command === 'emitirLiquidacion') { c.liquidacionMonto.set('1.50'); c.liquidacionConcepto.set('Concepto'); c.liquidacionFechaNotificacion.set('2026-10-20'); c.emitirLiquidacion(); }
    else c.actualizarLiquidacion(c.liquidaciones()[0], 'PAGADA');
    expect(pending.observed).toBe(true);
    auth.obtenerSesion.mockReturnValue({ token: 'sesion-nueva', usuarioId: 8, funcionarioId: 8, entidadId: 3 }); auth.cambiosSesion.update((n: number) => n + 1); f.detectChanges();
    expect(pending.observed).toBe(false); pending.next({ id: 8 }); expect(c.solicitud()).toBeNull(); expect(solicitudes.findByExpediente).toHaveBeenCalledTimes(1);
  });
});
