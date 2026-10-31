import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FuncionarioDashboardComponent } from './funcionario-dashboard.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { environment } from '../../../environments/environment';

describe('EntityDashboard — consulta institucional y estados reales', () => {
  const api = environment.apiUrl;
  const session = { success: true, token: 'sesion-sintetica-entidad', usuarioId: 7, funcionarioId: 7,
    tipoUsuario: 'FUNCIONARIO', entidadId: 3, entidadNombre: 'Entidad sintética', nombre: 'Operador sintético' };
  const row = { id: 101, expediente: 'SAIP-2026-00101', entidadId: 3, entidadNombre: 'Entidad sintética',
    ciudadanoNombre: 'Persona sintética', asunto: 'Asunto sintético', estado: 'EN_REVISION',
    diasRestantes: 3, fechaPresentacion: '2026-10-01T10:00:00', fechaLimite: '2026-11-01',
    respuesta: null, observaciones: [], prioridad: 'MEDIA' };
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [FuncionarioDashboardComponent], providers: [provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: GuidedTourService, useValue: { checkAutoStart() {}, endTourFor() {}, isFirstVisit: () => false, startTour() {} } }] });
    http = TestBed.inject(HttpTestingController); TestBed.inject(AuthService).guardarSesion(session);
  });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); } });
  function page() {
    const f = TestBed.createComponent(FuncionarioDashboardComponent); f.detectChanges();
    for (const req of http.match(`${api}/funcionarios/7`)) req.flush({ id: 7, entidadId: 3, entidadNombre: 'Entidad sintética', nombreCompleto: 'Operador sintético', activo: true });
    return f;
  }
  it('la carga no muestra cumplimiento legal de 100 por ciento sin datos', () => {
    const f = page(); const request = http.expectOne(`${api}/solicitudes/entidad/3`);
    expect(f.nativeElement.textContent).not.toContain('100%'); request.flush([]);
  });
  it('una respuesta registrada no se utiliza para transformar el estado que informa el servidor', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([{ ...row, respuesta: { id: 8, tipoRespuesta: 'ENTREGA_TOTAL' } }]); f.detectChanges();
    expect(f.componentInstance.solicitudes()[0].estado).toBe('EN_REVISION');
  });

  it('V6: tutorial institucional usa objetivos presentes y no activa escrituras; destruirlo cancela su ámbito', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([row]); f.detectChanges();
    for (const step of f.componentInstance.tourSteps) expect(f.nativeElement.querySelectorAll(step.selector)).toHaveLength(1);
    const tour = TestBed.inject(GuidedTourService), start = vi.spyOn(tour, 'startTour'), end = vi.spyOn(tour, 'endTourFor');
    f.componentInstance.startTour(); expect(start).toHaveBeenCalledWith('saip_tour_funcionario', f.componentInstance.tourSteps);
    http.expectNone(req => req.method !== 'GET'); end.mockClear(); f.destroy(); expect(end).toHaveBeenCalledWith('saip_tour_funcionario');
  });
  it('un plazo ausente no se calcula con fecha límite ni se convierte en hoy', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([{ ...row, diasRestantes: null }]); f.detectChanges();
    expect(f.componentInstance.queueItems()[0].diasRestantes).toBeNull();
  });
  it('no agrupa una conclusión sin respuesta como una respuesta registrada', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([{ ...row, estado: 'CONCLUIDA', respuesta: null }]);
    expect(f.componentInstance.counts().respondidas).toBe(0);
  });
  it('una recarga fallida limpia solicitudes y cifras de la consulta anterior', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([row]); f.componentInstance.cargarSolicitudes();
    for (const req of http.match(`${api}/funcionarios/7`)) req.flush({ id: 7, entidadId: 3, activo: true });
    http.expectOne(`${api}/solicitudes/entidad/3`).flush(null, { status: 503, statusText: 'Unavailable' }); f.detectChanges();
    expect(f.componentInstance.solicitudes()).toEqual([]); expect(f.nativeElement.textContent).not.toContain('100%');
  });
  it('destruir el panel cancela la consulta institucional pendiente', () => {
    const f = page(); const req = http.expectOne(`${api}/solicitudes/entidad/3`); f.destroy(); expect(req.cancelled).toBe(true);
  });
  it('no expone una fila que contradice la entidad autorizada de la consulta', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([{ ...row, entidadId: 999 }]); f.detectChanges();
    expect(f.componentInstance.solicitudes()).toEqual([]);
  });
  it('resuelve la entidad actual de la ficha y no reutiliza la entidad guardada en la sesión', () => {
    TestBed.inject(AuthService).guardarSesion({ ...session, entidadId: 99 });
    const f = page(); const request = http.expectOne(`${api}/solicitudes/entidad/3`);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${session.token}`);
    request.flush([row]); expect(f.componentInstance.entidadId()).toBe(3);
    http.expectNone(`${api}/solicitudes/paginadas`); http.expectNone(`${api}/solicitudes/entidad/99`);
  });
  it('una sesión incompleta no provoca una consulta global o institucional', () => {
    TestBed.inject(AuthService).guardarSesion({ ...session, funcionarioId: undefined });
    const f = page(); expect(f.componentInstance.errorTipo()).toBe('sesion');
    http.expectNone(request => request.url.startsWith(api));
  });
  it.each([
    { id: 8, entidadId: 3, activo: true },
    { id: 7, entidadId: null, activo: true },
    { id: 7, entidadId: 3, activo: false },
  ])('una ficha incoherente o inactiva impide consultar solicitudes: %j', profile => {
    const f = TestBed.createComponent(FuncionarioDashboardComponent); f.detectChanges();
    http.expectOne(`${api}/funcionarios/7`).flush(profile); f.detectChanges();
    expect(f.componentInstance.errorTipo()).toBe('incompleta');
    http.expectNone(request => request.url.includes('/solicitudes'));
  });
  it('el rechazo de la ficha no se sustituye por los datos de sesión', () => {
    const f = TestBed.createComponent(FuncionarioDashboardComponent); f.detectChanges();
    http.expectOne(`${api}/funcionarios/7`).flush({ detail: 'dato privado' }, { status: 403, statusText: 'Forbidden' }); f.detectChanges();
    expect(f.componentInstance.errorTipo()).toBe('autorizacion');
    expect(f.nativeElement.textContent).not.toContain('dato privado');
    http.expectNone(request => request.url.includes('/solicitudes'));
  });
  it('una respuesta vacía confirmada muestra cero registros sin inventar cumplimiento', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([]); f.detectChanges();
    expect(f.componentInstance.error()).toBe(''); expect(f.componentInstance.counts().todas).toBe(0);
    expect(f.nativeElement.textContent).toContain('Sin solicitudes en esta bandeja');
    expect(f.nativeElement.textContent).not.toContain('100%');
  });
  it.each([
    [400, 'validacion'], [401, 'autenticacion'], [403, 'autorizacion'],
    [404, 'no-encontrado'], [422, 'validacion'], [500, 'servidor'], [503, 'servidor'],
  ])('un error HTTP %i se distingue de vacío confirmado', (status, kind) => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush({ message: 'información interna' }, { status: Number(status), statusText: 'Failure' }); f.detectChanges();
    expect(f.componentInstance.errorTipo()).toBe(kind); expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Sin solicitudes en esta bandeja');
    expect(f.nativeElement.textContent).not.toContain('información interna');
    expect(f.nativeElement.querySelector('[role=list]')).toBeNull();
  });
  it('un error de red permite recuperar el listado mediante el botón de reintento', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).error(new ProgressEvent('error')); f.detectChanges();
    expect(f.componentInstance.errorTipo()).toBe('red');
    const retry = [...f.nativeElement.querySelectorAll('button')].find((node: any) => node.textContent.trim() === 'Reintentar') as HTMLButtonElement;
    retry.click(); f.detectChanges(); http.expectOne(`${api}/funcionarios/7`).flush({ id: 7, entidadId: 3, activo: true });
    http.expectOne(`${api}/solicitudes/entidad/3`).flush([row]); f.detectChanges();
    expect(f.componentInstance.error()).toBe(''); expect(f.nativeElement.textContent).toContain(row.expediente);
  });
  it.each([null, { content: [] }, [{ ...row, id: null }], [row, row], [{ ...row, expediente: 'otro recurso' }]])('rechaza datos sin relaciones verificables: %j', payload => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush(payload); f.detectChanges();
    expect(f.componentInstance.errorTipo()).toBe('incompleta'); expect(f.componentInstance.solicitudes()).toEqual([]);
  });
  it('días cero, ausentes o negativos se agrupan en sus bandejas oficiales sin reconstruir fechas', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([
      { ...row, diasRestantes: 0 }, { ...row, id: 102, expediente: 'SAIP-2026-00102', diasRestantes: -1 },
      { ...row, id: 103, expediente: 'SAIP-2026-00103', diasRestantes: null },
    ]); f.detectChanges();
    expect(f.componentInstance.counts().hoy).toBe(1); expect(f.componentInstance.counts().san).toBe(1);
    expect(f.componentInstance.counts().plazo).toBe(1);
    expect(f.componentInstance.distribucionDias().map(item => item.dia)).toEqual([0]);
  });
  it('la prioridad y el tipo proceden del contrato, sin inferirlos del plazo o asunto', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([{ ...row, asunto: 'Presupuesto urgente', diasRestantes: 0, prioridad: 'BAJA', tipoInformacion: 'Información registrada' }]); f.detectChanges();
    expect(f.componentInstance.queueItems()[0].prioridad).toBe('BAJA');
    expect(f.componentInstance.topTemas()).toEqual([['Información registrada', 1]]);
  });
  it('los datos opcionales ausentes no se convierten en nombres, tipos o fechas de demostración', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([{ ...row, ciudadanoNombre: null, prioridad: null, tipoInformacion: null, fechaPresentacion: 'fecha incorrecta' }]); f.detectChanges();
    expect(f.componentInstance.topTemas()).toEqual([]); expect(f.componentInstance.queueItems()[0].prioridad).toBeNull();
    expect(f.nativeElement.textContent).toContain('Identificación no informada');
    expect(f.nativeElement.textContent).toContain('Fecha de presentación no informada');
  });
  it('combina búsqueda, bandeja y estado, conservando el orden recibido y los conteos del conjunto', () => {
    const f = page(); const c = f.componentInstance;
    http.expectOne(`${api}/solicitudes/entidad/3`).flush([
      { ...row, ciudadanoNombre: 'Ángela Pérez', asunto: 'Informe anual', tipoInformacion: 'Datos' },
      { ...row, id: 102, expediente: 'SAIP-2026-00102', ciudadanoNombre: 'Ángela Pérez', estado: 'RESPONDIDA' },
      { ...row, id: 103, expediente: 'SAIP-2026-00103', ciudadanoNombre: 'Otra persona' },
    ]);
    c.busquedaModel = 'angela informe'; c.selectBucket('semana'); c.cambiarEstado('EN_REVISION');
    expect(c.filtradas().map(item => item.solicitud.id)).toEqual([101]); expect(c.counts().todas).toBe(3);
    c.limpiarFiltros(); expect(c.filtradas().map(item => item.solicitud.id)).toEqual([101, 102, 103]);
    expect(c.busqueda()).toBe(''); expect(c.filtroEstado()).toBe('');
    http.expectNone(request => request.url.startsWith(api));
  });
  it('pagina localmente sin presentar la página como total y reinicia al filtrar', () => {
    const f = page(); const c = f.componentInstance;
    http.expectOne(`${api}/solicitudes/entidad/3`).flush(Array.from({ length: 10 }, (_, index) => ({ ...row, id: 101 + index, expediente: `SAIP-2026-00${101 + index}` })));
    c.cambiarPagina(3); expect(c.filtradasVisibles().length).toBe(2); expect(c.counts().todas).toBe(10);
    expect(c.inicioRegistro()).toBe(9); expect(c.finRegistro()).toBe(10);
    c.busquedaModel = '00101'; expect(c.paginaSegura()).toBe(1); expect(c.filtradasVisibles().length).toBe(1);
    c.limpiarFiltros(); c.cambiarItemsPorPagina(8); expect(c.filtradasVisibles().length).toBe(8);
    c.cambiarPagina(100); expect(c.paginaSegura()).toBe(1);
    http.expectNone(request => request.url.startsWith(api));
  });
  it('busca por DNI en memoria sin almacenarlo ni enviarlo como parámetro de consulta', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([{ ...row, ciudadanoDni: '00000001' }]);
    const stored = localStorage.getItem('usuario'); f.componentInstance.busquedaModel = '00000001'; f.detectChanges();
    expect(f.componentInstance.filtradas().length).toBe(1); expect(localStorage.getItem('usuario')).toBe(stored);
    expect(localStorage.length).toBe(1); expect(sessionStorage.length).toBe(0);
    http.expectNone(request => request.url.startsWith(api));
  });
  it('navega con el expediente persistido y solo ofrece respuesta cuando constan sus precondiciones', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([row]); f.detectChanges();
    expect(f.nativeElement.querySelector(`a[href='/funcionario/solicitud/${row.expediente}']`)).not.toBeNull();
    expect(f.nativeElement.querySelector(`a[href='/funcionario/responder/${row.expediente}']`)).not.toBeNull();
    expect(f.componentInstance.canResponder(f.componentInstance.solicitudes()[0])).toBe(true);
  });
  it.each([
    { estado: 'PENDIENTE_INFORMACION' }, { estado: 'CONCLUIDA' },
    { respuesta: { id: 8 } }, { respuesta: undefined }, { observaciones: undefined },
    { observaciones: [{ estado: 'PENDIENTE_SUBSANACION' }] }, { observaciones: [null] },
  ])('una condición incompatible impide ofrecer el formulario de respuesta: %j', patch => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([{ ...row, ...patch }]); f.detectChanges();
    expect(f.componentInstance.canResponder(f.componentInstance.solicitudes()[0])).toBe(false);
    expect(f.nativeElement.querySelector('a[href^="/funcionario/responder/"]')).toBeNull();
  });
  it('el estado VENCIDA conserva la respuesta tardía permitida por el comando específico', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([{ ...row, estado: 'VENCIDA', diasRestantes: -2 }]);
    expect(f.componentInstance.canResponder(f.componentInstance.solicitudes()[0])).toBe(true);
    expect(f.componentInstance.counts().san).toBe(1);
  });
  it('cambiar de sesión cancela la consulta anterior y no conserva datos ni filtros de otra entidad', () => {
    const f = page(); const old = http.expectOne(`${api}/solicitudes/entidad/3`);
    f.componentInstance.busquedaModel = 'dato anterior';
    TestBed.inject(AuthService).guardarSesion({ ...session, token: 'otra-sesion', usuarioId: 8, funcionarioId: 8, entidadId: 4 }); f.detectChanges();
    expect(old.cancelled).toBe(true); expect(f.componentInstance.busqueda()).toBe('');
    http.expectOne(`${api}/funcionarios/8`).flush({ id: 8, entidadId: 4, entidadNombre: 'Otra institución', activo: true });
    http.expectOne(`${api}/solicitudes/entidad/4`).flush([{ ...row, entidadId: 4, id: 104, expediente: 'SAIP-2026-00104' }]); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain(row.expediente); expect(f.nativeElement.textContent).toContain('SAIP-2026-00104');
    expect(f.nativeElement.textContent).not.toContain('Entidad sintética');
  });
  it('un cambio de sesión durante la ficha impide continuar hacia la entidad anterior', () => {
    const f = TestBed.createComponent(FuncionarioDashboardComponent); f.detectChanges();
    const old = http.expectOne(`${api}/funcionarios/7`);
    TestBed.inject(AuthService).guardarSesion({ ...session, usuarioId: 8, funcionarioId: 8, token: 'otra-sesion' }); f.detectChanges();
    expect(old.cancelled).toBe(true); http.expectNone(`${api}/solicitudes/entidad/3`);
    http.expectOne(`${api}/funcionarios/8`).flush(null, { status: 401, statusText: 'Unauthorized' });
  });
  it('un evento de cierre en otra pestaña retira el listado anterior', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([row]); f.detectChanges();
    localStorage.removeItem('usuario'); window.dispatchEvent(new StorageEvent('storage', { key: 'usuario' })); f.detectChanges();
    expect(f.componentInstance.solicitudes()).toEqual([]); expect(f.componentInstance.errorTipo()).toBe('sesion');
    expect(f.nativeElement.querySelector('[role=list]')).toBeNull(); expect(f.nativeElement.textContent).not.toContain(row.expediente);
  });
  it('una recarga repetida durante la carga no duplica peticiones', () => {
    const f = page(); f.componentInstance.cargarSolicitudes(); f.componentInstance.cargarSolicitudes();
    http.expectOne(`${api}/solicitudes/entidad/3`).flush([row]);
    http.expectNone(request => request.url.startsWith(api));
  });
  it('ofrece búsqueda y filtros etiquetados, estado seleccionado y lista navegable con textos largos', () => {
    const f = page(); http.expectOne(`${api}/solicitudes/entidad/3`).flush([{ ...row, asunto: 'Asunto largo '.repeat(40) }]); f.detectChanges();
    for (const id of ['entity-search', 'entity-state', 'entity-page-size']) {
      expect(f.nativeElement.querySelector(`label[for='${id}']`)).not.toBeNull(); expect(f.nativeElement.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(f.nativeElement.querySelector('[aria-pressed=true]')).not.toBeNull();
    expect(f.nativeElement.querySelectorAll('h1').length).toBe(1);
    expect(f.nativeElement.querySelector('[role=listitem] h3').textContent).toContain('Asunto largo');
    expect(f.nativeElement.querySelector('[role=status][aria-live=polite]')).not.toBeNull();
  });
});
