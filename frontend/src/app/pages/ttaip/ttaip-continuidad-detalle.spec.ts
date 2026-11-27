import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';
import { TtaipResolucionDetalleComponent } from './ttaip-resolucion-detalle.component';
import { Apelacion } from '../../models/apelacion.model';
import { routes } from '../../app.routes';

const code = '00031-2026-JUS/TTAIP';
const first = { id: 71, apelacionId: 31, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'INADMISIBLE',
  fundamentos: 'Sustento del requerimiento', fechaResolucion: '2026-10-01T10:00:00', cedulas: [] };
const second = { id: 72, apelacionId: 31, tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'ADMITIDO',
  fundamentos: 'Segunda admisión', fechaResolucion: '2026-10-03T10:00:00',
  cedulas: [{ id: 61, destinatario: 'CIUDADANO' }, { id: 62, destinatario: 'ENTIDAD_PUBLICA' }] };
const notifications = [61, 62].map((cedulaId, i) => ({ id: 91 + i, cedulaId, destinatario: i ? 'ENTIDAD_PUBLICA' : 'CIUDADANO',
  estado: 'ENTREGADA', estadoAcuse: 'ENTREGADO', fechaAcuse: '2026-10-04T10:00:00', acuseAutomatico: 'Acuse sintético', medio: 'CASILLA_ELECTRONICA' }));
const history = notifications.map(n => ({ id: n.id + 100, tipoEvento: 'ACUSE_NOTIFICACION_REGISTRADO', referencia: `NOTIFICACION-${n.id}:ACUSE:ENTREGADO` }));
function appeal(final = false) {
  const acts = final ? [first, second] : [first];
  return { id: 31, expediente: code, estado: final ? 'EN_RESOLUCION' : 'EN_CALIFICACION_2', resuelta: false, resultado: null,
    ciudadanoId: 4, entidadId: 3, entidadNombre: 'Entidad sintética', tipoOrigen: 'EXTERNA', solicitudId: null,
    calificacionPrimera: 'INADMISIBLE', resolucionPrimeraCalificacion: first,
    calificacionSegunda: final ? 'ADMITIDO' : null, resolucionSegundaCalificacion: final ? second : null,
    resolucion: null, resoluciones: acts, documentos: [], documentosMetadata: [],
    expedienteTtaip: { id: 41, numeroExpediente: code, resoluciones: acts, cedulas: final ? second.cedulas : [],
      notificaciones: final ? notifications : [], historial: final ? history : [], reprocesos: [], suspensionesPlazo: [], cumplimientosResolucion: [],
      descargosEntidad: final ? [{ id: 81, expedienteTtaipId: 41, numeroExpediente: code, apelacionId: 31, entidadId: 3,
        estadoDescargo: 'PRESENTADO', fechaRequerimiento: '2026-10-04', fechaPresentacion: '2026-10-05', resumenDescargo: 'Descargo sintético' }] : [] } };
}
const received = () => ({ estado: 'RECIBIDA', expedienteTtaipId: 41, apelacionId: 31, requerimientoId: 71, expediente: code,
  recepcionId: 111, fechaRecepcion: '2026-10-02T10:00:00', fundamentosAdicionales: 'Fundamentos registrados', documentos: [] });

describe('V4: continuidad del detalle TTAIP', () => {
  const api = environment.apiUrl;
  const receiptUrl = `${api}/ttaip/expedientes/41/requerimientos/71/subsanacion/recepcion`;
  const session = { success: true, token: 'synthetic-ttaip-session', usuarioId: 7, miembroId: 7, tipoUsuario: 'TTAIP' };
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    localStorage.clear(); params = new BehaviorSubject(convertToParamMap({ expediente: code }));
    TestBed.configureTestingModule({ imports: [TtaipResolucionDetalleComponent], providers: [provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } }] });
    http = TestBed.inject(HttpTestingController); TestBed.inject(AuthService).guardarSesion(session);
  });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); localStorage.clear(); vi.restoreAllMocks(); } });
  function pending(data = appeal()) {
    const f = TestBed.createComponent(TtaipResolucionDetalleComponent); f.detectChanges();
    http.expectOne(`${api}/apelaciones/expediente/${code}`).flush(data); f.detectChanges(); return f;
  }
  function page(data = appeal(), receipt: object | null = received()) {
    const f = pending(data);
    http.match(receiptUrl).forEach(r => r.flush(receipt)); f.detectChanges(); return f;
  }
  function abrirSubsanacion(f: { nativeElement: HTMLElement; detectChanges(): void }): void {
    const tab = Array.from(f.nativeElement.querySelectorAll('[role="tab"]')).find(boton => boton.textContent?.includes('Subsanación')) as HTMLButtonElement;
    tab.click();
    f.detectChanges();
  }
  it('no declara inexistente una consulta institucional ya disponible', () => {
    expect(page().nativeElement.textContent).not.toContain('La consulta institucional de recepción de subsanación no está disponible');
  });
  it('ofrece segunda calificación con la recepción del requerimiento, sin escribir', () => {
    const f = page(); const link = f.nativeElement.querySelector('a[href^="/ttaip/segunda-calificacion/"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe(TestBed.inject(Router).serializeUrl(TestBed.inject(Router).createUrlTree(['/ttaip/segunda-calificacion', code])));
    http.expectNone(r => r.method !== 'GET');
  });
  it('evalúa la resolución final con la recepción y las demás evidencias recuperadas', () => {
    const f = page(appeal(true));
    expect(f.componentInstance.navegacionFinal()).toBe(true);
    expect(f.nativeElement.querySelector('a[href^="/ttaip/resolver/"]')).not.toBeNull();
  });

  it.each(['ausente', 'cruzada', 'error'])('segunda admisión con recepción %s no habilita resolución final aunque las otras evidencias existan', issue => {
    const f = pending(appeal(true)), req = http.expectOne(receiptUrl);
    expect(f.componentInstance.navegacionFinal()).toBe(false);
    if (issue === 'error') req.flush(null, { status: 503, statusText: 'Unavailable' });
    else req.flush(issue === 'ausente' ? { ...received(), estado: 'AUSENTE', recepcionId: null, fechaRecepcion: null, fundamentosAdicionales: null }
      : { ...received(), requerimientoId: 999 });
    f.detectChanges(); expect(f.componentInstance.navegacionFinal()).toBe(false);
    expect(f.nativeElement.querySelector('a[href^="/ttaip/resolver/"]')).toBeNull();
    http.expectNone(r => r.method !== 'GET');
  });

  it('reconsulta fallida elimina la recepción recuperada y sus enlaces', () => {
    const f = page(); expect(f.componentInstance.navegacionSegunda()).toBe(true);
    f.componentInstance.reintentarRecepcion(); f.detectChanges();
    expect(f.componentInstance.recepcion().datos).toBeUndefined();
    http.expectOne(`${api}/apelaciones/expediente/${code}`).flush(null, { status: 403, statusText: 'Forbidden' }); f.detectChanges();
    expect(f.componentInstance.recepcion().datos).toBeUndefined();
    expect(f.nativeElement.textContent).not.toContain('Fundamentos registrados');
    expect(f.componentInstance.navegacionSegunda()).toBe(false); http.expectNone(receiptUrl);
  });

  it('consulta solo el agregado y el requerimiento identificados; carga no equivale a recepción', () => {
    const f = pending(); const req = http.expectOne(receiptUrl);
    expect(req.request.method).toBe('GET'); expect(req.request.headers.get('Authorization')).toBe('Bearer synthetic-ttaip-session');
    expect(f.componentInstance.recepcion().estado).toBe('cargando');
    abrirSubsanacion(f);
    expect(f.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(f.componentInstance.navegacionSegunda()).toBe(false);
    http.expectNone(r => r.method !== 'GET'); http.expectNone(`${api}/apelaciones`);
    req.flush(received()); f.detectChanges(); expect(f.componentInstance.navegacionSegunda()).toBe(true);
  });

  it.each([{ documentos: [] }, { documentos: [{ id: 203, apelacionId: 31, nombreOriginal: 'Anexo sintético.pdf', tipoDocumento: 'SUBSANACION', estado: 'ACTIVO' }] }])(
    'recepción recibida con adjuntos opcionales %j mantiene la misma capacidad', ({ documentos }) => {
      const f = page(appeal(), { ...received(), documentos });
      expect(f.componentInstance.recepcion().estado).toBe('disponible');
      expect(f.componentInstance.recepcion().datos?.recepcionId).toBe(111);
      expect(f.componentInstance.navegacionSegunda()).toBe(true);
      abrirSubsanacion(f);
      expect(f.nativeElement.textContent).toContain(documentos.length ? 'Anexo sintético.pdf' : 'Recepción sin adjuntos');
      expect(f.nativeElement.textContent).not.toContain('Recepción · ID');
      // The authorized appeal includes two recorded milestones. The newest one is shown first.
      expect(f.componentInstance.timeline().map(event => [event.id, event.titulo])).toEqual([
        [71, '1ra calificación · INADMISIBLE'], [31, 'Apelación presentada'],
      ]);
      http.expectNone(r => r.method !== 'GET');
    });

  it('solo un AUSENTE compatible confirma ausencia y permite reconsultar, sin habilitar registro', () => {
    const f = page(appeal(), { ...received(), estado: 'AUSENTE', recepcionId: null, fechaRecepcion: null, fundamentosAdicionales: null });
    expect(f.componentInstance.recepcion().estado).toBe('ausente');
    abrirSubsanacion(f);
    expect(f.nativeElement.textContent).toContain('No hay una subsanación registrada');
    expect(f.nativeElement.textContent).not.toContain('El servidor no registra recepción');
    expect(f.componentInstance.navegacionSegunda()).toBe(false);
    const retry = Array.from(f.nativeElement.querySelectorAll('button')).find((b: any) => b.textContent.includes('Actualizar consulta')) as HTMLButtonElement;
    retry.click(); f.detectChanges(); http.expectOne(`${api}/apelaciones/expediente/${code}`).flush(appeal()); f.detectChanges();
    http.expectOne(receiptUrl).flush(received()); f.detectChanges(); expect(f.componentInstance.navegacionSegunda()).toBe(true);
    http.expectNone(r => r.method !== 'GET');
  });

  it.each([null, [], {}, { ...received(), documentos: undefined }, { ...received(), estado: 'DESCONOCIDO' }].map(response => ({ response })))(
    'respuesta incompleta %j no se confunde con ausencia ni recurso verificado', ({ response }) => {
      const f = page(appeal(), response);
      expect(f.componentInstance.recepcion().estado).toBe('incompleto');
      expect(f.componentInstance.recepcion().datos).toBeUndefined();
      expect(f.componentInstance.navegacionSegunda()).toBe(false);
      expect(f.nativeElement.textContent).not.toContain('El servidor no registra recepción');
      abrirSubsanacion(f);
      expect(f.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    });

  it.each([
    { apelacionId: 32 }, { expedienteTtaipId: 42 }, { requerimientoId: 73 }, { expediente: 'AJENO' },
    { documentos: [{ id: 203, apelacionId: 999, tipoDocumento: 'SUBSANACION' }] },
    { documentos: [{ id: 203, apelacionId: 31, resolucionId: 71, tipoDocumento: 'SUBSANACION' }] },
    { documentos: [{ id: 203, apelacionId: 31, tipoDocumento: 'SOLICITUD_ORIGINAL' }] },
  ])('relación incompatible %j bloquea navegación y no expone fundamentos ajenos', patch => {
    const f = page(appeal(), { ...received(), ...patch, fundamentosAdicionales: 'CONTENIDO-AJENO' });
    expect(f.componentInstance.recepcion().estado).toBe('incompatible');
    expect(f.componentInstance.recepcion().datos).toBeUndefined();
    expect(f.nativeElement.textContent).not.toContain('CONTENIDO-AJENO');
    expect(f.componentInstance.navegacionSegunda()).toBe(false); expect(f.componentInstance.navegacionFinal()).toBe(false);
  });

  it.each([401, 403, 404, 409, 422, 500, 503, 0])('fallo de consulta %i no habilita enlace ni confirma ausencia', status => {
    const f = pending(); const req = http.expectOne(receiptUrl);
    if (status) req.flush(null, { status, statusText: 'Synthetic failure' }); else req.error(new ProgressEvent('error'));
    f.detectChanges(); expect(f.componentInstance.recepcion().estado).toBe('error');
    expect(f.componentInstance.navegacionSegunda()).toBe(false); expect(f.componentInstance.navegacionFinal()).toBe(false);
    expect(f.nativeElement.textContent).not.toContain('El servidor no registra recepción');
    http.expectNone(r => r.method !== 'GET');
  });

  it('primera calificación sin identificar no se sustituye por el primer registro de una lista', () => {
    const data = appeal(); data.resolucionPrimeraCalificacion = null as any;
    const f = pending(data);
    http.expectNone(receiptUrl); expect(f.componentInstance.recepcion().estado).toBe('incompleto');
    expect(f.componentInstance.navegacionSegunda()).toBe(false);
  });

  it('un requerimiento de otra apelación se rechaza antes de consultar la recepción', () => {
    const data = appeal(); const foreign = { ...first, apelacionId: 999 };
    data.resolucionPrimeraCalificacion = foreign; data.resoluciones = [foreign]; data.expedienteTtaip.resoluciones = [foreign];
    const f = pending(data); http.expectNone(receiptUrl);
    expect(f.componentInstance.recepcion().estado).toBe('incompatible'); expect(f.componentInstance.navegacionSegunda()).toBe(false);
  });

  it('agregado ausente es información incompleta y no genera un ID sustituto', () => {
    const data = { ...appeal(), expedienteTtaip: null } as any; const f = pending(data);
    http.expectNone(r => r.url.includes('/subsanacion/recepcion'));
    expect(f.componentInstance.recepcion().estado).toBe('incompleto'); expect(f.componentInstance.navegacionSegunda()).toBe(false);
  });

  it.each(['EN_SUBSANACION', 'EN_CALIFICACION_1', 'RESUELTO_IMPROCEDENTE'])('una recepción no fuerza segunda desde %s', estado => {
    const f = page({ ...appeal(), estado });
    expect(f.componentInstance.navegacionSegunda()).toBe(false); expect(f.componentInstance.navegacionFinal()).toBe(false);
    http.expectNone(r => r.method !== 'GET');
  });

  it('segunda previamente registrada no ofrece otra ni permite final antes del avance del servidor', () => {
    const f = page({ ...appeal(true), estado: 'NOTIFICACION_SEGUNDA_CALIFICACION' });
    expect(f.componentInstance.navegacionSegunda()).toBe(false); expect(f.componentInstance.navegacionFinal()).toBe(false);
    expect(f.nativeElement.textContent).toContain('Ya hay una segunda calificación registrada');
    expect(f.nativeElement.textContent).toContain('Confirmar el avance es una operación del servidor');
    http.expectNone(r => r.method !== 'GET');
  });

  it('una segunda admisión histórica con ambas notificaciones acreditadas permite acceder a resolución final', () => {
    const data = appeal(true);
    const segunda = { ...data.resolucionSegundaCalificacion!, fechaValidacionActos: '2026-10-02T10:30:00' };
    const f = page({ ...data, resolucionSegundaCalificacion: segunda, estado: 'NOTIFICACION_SEGUNDA_CALIFICACION' });
    expect(f.componentInstance.navegacionFinal()).toBe(true);
  });

  it.each(['PENDIENTE', 'FALLIDA', 'OBSERVADA'])('notificación %s mantiene bloqueada la final aunque exista recepción', estado => {
    const data = appeal(true); data.expedienteTtaip.notificaciones = notifications.map((n, i) => i ? n : { ...n, estado });
    const f = page(data); expect(f.componentInstance.navegacionFinal()).toBe(false);
    expect(f.componentInstance.motivoResolucionFinal()).toContain('ambas notificaciones');
  });

  it('etiqueta de proveedor y trazas antiguas no acreditan eficacia', () => {
    const data = appeal(true); data.expedienteTtaip.notificaciones = notifications.map(n => ({ ...n, resultadoNotificacion: 'ENTREGADA_POR_MOCK' }));
    expect(page(data).componentInstance.navegacionFinal()).toBe(false);
  });

  it.each(['sin-descargos', 'pendiente', 'otra-apelacion', 'sin-traza'])('la emisión requiere notificaciones válidas y admite cualquier estado de descargos: %s', issue => {
    const data = appeal(true);
    if (issue === 'sin-descargos') data.expedienteTtaip.descargosEntidad = [];
    if (issue === 'pendiente') data.expedienteTtaip.descargosEntidad[0].estadoDescargo = 'REQUERIDO';
    if (issue === 'otra-apelacion') data.expedienteTtaip.descargosEntidad[0].apelacionId = 999;
    if (issue === 'sin-traza') data.expedienteTtaip.historial = [];
    const f = page(data); expect(f.componentInstance.navegacionFinal()).toBe(issue !== 'sin-traza');
  });

  it('resolución final previa impide ofrecer otro registro aunque el estado diga EN_RESOLUCION', () => {
    const data = { ...appeal(true), resolucion: { id: 101, tipoResolucion: 'RESOLUCION_FINAL', decision: 'INFUNDADO', cedulas: [] } } as any;
    expect(page(data).componentInstance.navegacionFinal()).toBe(false);
  });

  it('una inadmisible ya resuelta no consulta ni muestra la ausencia de subsanación', () => {
    const f = pending({ ...appeal(), estado: 'RESUELTO_FUNDADO_EN_PARTE', resuelta: true });
    http.expectNone(receiptUrl);
    expect(f.componentInstance.requiereRecepcion()).toBe(false);
    expect(f.nativeElement.textContent).not.toContain('No hay una subsanación');
  });

  it('la primera calificación improcedente no consulta una subsanación', () => {
    const data = appeal();
    data.estado = 'RESUELTO_IMPROCEDENTE';
    data.calificacionPrimera = 'IMPROCEDENTE';
    data.resolucionPrimeraCalificacion = { ...first, decision: 'IMPROCEDENTE' };
    const f = pending(data);
    http.expectNone(receiptUrl);
    expect(f.componentInstance.requiereRecepcion()).toBe(false);
    expect(f.nativeElement.textContent).not.toContain('Recepción de subsanación');
  });

  it('primera admisión conserva su continuidad sin inventar un requerimiento de subsanación', () => {
    const data = appeal(true); const admitted = { ...first, decision: 'ADMISIBLE', cedulas: second.cedulas };
    data.calificacionPrimera = 'ADMISIBLE'; data.resolucionPrimeraCalificacion = admitted as any;
    data.calificacionSegunda = null; data.resolucionSegundaCalificacion = null;
    data.resoluciones = [admitted]; data.expedienteTtaip.resoluciones = [admitted];
    const f = pending(data); http.expectNone(receiptUrl);
    expect(f.componentInstance.navegacionFinal()).toBe(true); expect(f.componentInstance.requiereRecepcion()).toBe(false);
  });

  it.each([['segunda', false, '/ttaip/segunda-calificacion'], ['final', true, '/ttaip/resolver']] as const)(
    'enlace %s utiliza la ruta real sin transportar recepción ni escribir', (_name, final, route) => {
      const f = page(appeal(final)), router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      const link = f.nativeElement.querySelector(`a[href^="${route}/"]`) as HTMLAnchorElement;
      expect(routes.find(r => r.path === `${route.slice(1)}/:expediente`)?.canActivate?.length).toBeGreaterThan(0);
      expect(link.getAttribute('aria-describedby')).toBe('detail-navigation-scope');
      expect(f.nativeElement.querySelector('#detail-navigation-scope')?.textContent).toContain('comprueba los requisitos');
      link.click(); expect(navigate).toHaveBeenCalledOnce();
      expect(router.serializeUrl(navigate.mock.calls[0][0] as any)).toBe(router.serializeUrl(router.createUrlTree([route, code])));
      expect(navigate.mock.calls[0][1]?.state).toBeUndefined(); http.expectNone(r => r.method !== 'GET');
    });

  it('revisar notificaciones solo selecciona y enfoca la pestaña, sin confirmar avance', () => {
    const f = page({ ...appeal(true), estado: 'NOTIFICACION_SEGUNDA_CALIFICACION' });
    const button = Array.from(f.nativeElement.querySelectorAll('button')).find((b: any) => b.textContent.includes('Revisar evidencias de notificación')) as HTMLButtonElement;
    button.click(); f.detectChanges(); expect(f.componentInstance.activeTab()).toBe('notificaciones');
    http.expectOne(api + '/ttaip/expedientes/41/actos-notificacion').flush([]);
    for (const [key, id, count] of [['resolucionId', 71, 1], ['resolucionId', 72, 1], ['cedulaNotificacionId', 61, 1], ['cedulaNotificacionId', 62, 1]] as const) {
      const documents = http.match(`${api}/documentos?${key}=${id}`);
      expect(documents).toHaveLength(count); documents.forEach(r => r.flush([]));
    }
    f.detectChanges();
    expect(document.activeElement).toBe(f.nativeElement.querySelector('#detail-tab-notificaciones'));
    expect(f.componentInstance.apelacion()?.estado).toBe('NOTIFICACION_SEGUNDA_CALIFICACION'); http.expectNone(r => r.method !== 'GET');
  });

  it('petición incierta previa bloquea continuidad sin repetir escrituras', () => {
    const f = page(); f.componentInstance.actionUncertain.set(true); f.detectChanges();
    expect(f.componentInstance.navegacionSegunda()).toBe(false); http.expectNone(r => r.method !== 'GET');
  });

  it('cambiar expediente cancela recepción pendiente y no muestra la anterior tras un rechazo', () => {
    const f = pending(); const old = http.expectOne(receiptUrl);
    params.next(convertToParamMap({ expediente: 'OTRO' })); f.detectChanges(); expect(old.cancelled).toBe(true);
    http.expectOne(`${api}/apelaciones/expediente/OTRO`).flush(null, { status: 403, statusText: 'Forbidden' }); f.detectChanges();
    expect(f.componentInstance.recepcion().datos).toBeUndefined(); expect(f.componentInstance.navegacionSegunda()).toBe(false);
  });

  it('cambio de requerimiento descarta una respuesta ya en vuelo antes del siguiente render', () => {
    const f = pending(); const old = http.expectOne(receiptUrl); const next = appeal();
    const requirement = { ...first, id: 73 }; next.resolucionPrimeraCalificacion = requirement;
    next.resoluciones = [requirement]; next.expedienteTtaip.resoluciones = [requirement];
    f.componentInstance.apelacion.set(next as unknown as Apelacion);
    old.flush({ ...received(), fundamentosAdicionales: 'ANTIGUA-RECEPCION' });
    expect(f.componentInstance.recepcion().datos).toBeUndefined(); f.detectChanges();
    http.expectOne(`${api}/ttaip/expedientes/41/requerimientos/73/subsanacion/recepcion`).flush({ ...received(), requerimientoId: 73, recepcionId: 112 });
    f.detectChanges(); expect(f.componentInstance.recepcion().datos?.requerimientoId).toBe(73);
    expect(f.nativeElement.textContent).not.toContain('ANTIGUA-RECEPCION');
  });

  it.each(['token', 'usuario', 'entidad', 'miembro', 'rol', 'logout'])('cambio de %s limpia recepción y cancela consulta anterior', change => {
    const f = pending(); const old = http.expectOne(receiptUrl); const auth = TestBed.inject(AuthService);
    if (change === 'logout') { localStorage.removeItem('usuario'); window.dispatchEvent(new StorageEvent('storage', { key: 'usuario' })); }
    else auth.guardarSesion({ ...session, ...(change === 'token' ? { token: 'synthetic-new-token' } : change === 'usuario' ? { usuarioId: 8 }
      : change === 'miembro' ? { miembroId: 8 } : change === 'rol' ? { tipoUsuario: 'FUNCIONARIO', entidadId: 3 } : { entidadId: 9 }) });
    expect(f.componentInstance.navegacionSegunda()).toBe(false); expect(f.componentInstance.recepcion().datos).toBeUndefined();
    f.detectChanges(); expect(old.cancelled).toBe(true);
    http.match(`${api}/apelaciones/expediente/${code}`).forEach(r => r.flush(null, { status: 403, statusText: 'Forbidden' })); f.detectChanges();
    http.expectNone(r => r.url.includes('/subsanacion/recepcion')); expect(f.componentInstance.recepcion().datos).toBeUndefined();
  });

  it.each(['FUNCIONARIO', 'CIUDADANO', 'ADMINISTRADOR'])('rol %s no recibe enlaces que sus guards no permiten', role => {
    TestBed.inject(AuthService).guardarSesion({ ...session, tipoUsuario: role, entidadId: 3 });
    if (role === 'CIUDADANO') {
      const f = TestBed.createComponent(TtaipResolucionDetalleComponent); f.detectChanges(); http.expectNone(() => true); expect(f.componentInstance.navegacionSegunda()).toBe(false); return;
    }
    const f = pending();
    if (role === 'ADMINISTRADOR') { http.expectOne(receiptUrl).flush(received()); f.detectChanges(); }
    else http.expectNone(receiptUrl);
    expect(f.componentInstance.navegacionSegunda()).toBe(false); expect(f.componentInstance.navegacionFinal()).toBe(false);
    expect(f.nativeElement.querySelector('a[href^="/ttaip/segunda-calificacion/"]')).toBeNull();
  });

  it('destruir cancela recepción pendiente; no hay comandos por limpieza', () => {
    const f = pending(); const req = http.expectOne(receiptUrl); f.destroy(); expect(req.cancelled).toBe(true); http.expectNone(r => r.method !== 'GET');
  });
});
