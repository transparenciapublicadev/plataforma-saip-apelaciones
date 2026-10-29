import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtaipDashboardComponent } from './ttaip-dashboard.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { environment } from '../../../environments/environment';

describe('TTAIPDashboard — datos y etapas respaldados', () => {
  const api = environment.apiUrl;
  const session = { success: true, token: 'sesion-sintetica-tribunal', usuarioId: 7, miembroId: 7, tipoUsuario: 'TTAIP', nombre: 'Operador sintético' };
  const row = (patch: Record<string, unknown> = {}) => ({ id: 21, expediente: '00021-2026-JUS/TTAIP', estado: 'EN_CALIFICACION_1',
    fechaApelacion: '2026-10-01', ciudadanoId: 4, ciudadanoNombre: 'Persona sintética', entidadId: 3, entidadNombre: 'Entidad sintética',
    fundamentos: 'Pedido sintético', solicitudAsunto: 'Información solicitada', calificacionPrimera: null,
    calificacionSegunda: null, resolucionPrimeraCalificacion: null, resolucionSegundaCalificacion: null, resolucion: null, ...patch });
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); TestBed.configureTestingModule({ imports: [TtaipDashboardComponent], providers: [provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: GuidedTourService, useValue: { checkAutoStart() {}, endTourFor() {}, isFirstVisit: () => false, startTour() {} } }] });
    http = TestBed.inject(HttpTestingController); TestBed.inject(AuthService).guardarSesion(session);
  });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); } });
  function page() { const f = TestBed.createComponent(TtaipDashboardComponent); f.detectChanges(); return f; }
  // Allows RED against the published five-query flow; the final implementation uses one authorized list.
  function reply(rows: ReturnType<typeof row>[]) {
    const all = http.match(`${api}/apelaciones`); if (all.length) { all.forEach(req => req.flush(rows)); return; }
    const paths = ['en-calificacion', 'subsanacion', 'segunda-calificacion', 'en-resolucion', 'resueltas'];
    paths.forEach((path, index) => http.match(`${api}/ttaip/${path}`).forEach(req => req.flush(index === 0 ? rows : [])));
  }
  it('no calcula un plazo de etapa desde una fecha de ingreso antigua', () => {
    const f = page(); reply([row({ fechaApelacion: '2000-01-01' })]);
    expect(f.componentInstance.getDiasValor(f.componentInstance.queueItems()[0])).toMatch(/no informado|no disponible/i);
  });

  it('V6: pasos del Tribunal localizan el panel actual sin transiciones ni consultas nuevas', () => {
    const f = page(); reply([row()]); f.detectChanges();
    for (const step of f.componentInstance.tourSteps) expect(f.nativeElement.querySelectorAll(step.selector)).toHaveLength(1);
    const tour = TestBed.inject(GuidedTourService), start = vi.spyOn(tour, 'startTour'), end = vi.spyOn(tour, 'endTourFor');
    f.componentInstance.startTour(); expect(start).toHaveBeenCalledWith('saip_tour_ttaip', f.componentInstance.tourSteps);
    http.expectNone(req => req.method !== 'GET'); end.mockClear(); f.destroy(); expect(end).toHaveBeenCalledWith('saip_tour_ttaip');
  });
  it('un estado desconocido no se clasifica como resuelto', () => {
    const f = page(); reply([row({ estado: 'ESTADO_NO_RECONOCIDO' })]); expect(f.componentInstance.counts().resueltos).toBe(0);
  });
  it('una sala ausente no se atribuye a la primera sala', () => {
    const f = page(); reply([row()]); f.componentInstance.cambiarSala('PRIMERA'); expect(f.componentInstance.filtered()).toEqual([]);
  });
  it('fundado en parte no se suma a fundado total', () => {
    const f = page(); reply([row({ estado: 'RESUELTO_FUNDADO_EN_PARTE', resultado: 'FUNDADO_EN_PARTE',
      resolucion: { id: 41, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO_EN_PARTE' } })]);
    expect(f.componentInstance.fundadasCount()).toBe(0);
  });
  it('durante la carga no muestra ceros institucionales ni ausencia de críticos como datos confirmados', () => {
    const f = page(); expect(f.nativeElement.textContent).not.toContain('0%'); expect(f.nativeElement.textContent).not.toContain('sin críticos'); reply([]);
  });
  it('una recarga fallida elimina registros y cifras anteriores', () => {
    const f = page(); reply([row()]); f.componentInstance.cargarDashboard();
    const requests = http.match(req => req.url.startsWith(api)); requests.forEach(req => { if (!req.cancelled) req.flush(null, { status: 503, statusText: 'Unavailable' }); });
    expect(f.componentInstance.apelaciones()).toEqual([]);
  });
  it('destruir cancela las consultas de la bandeja', () => {
    const f = page(); const requests = http.match(req => req.url.startsWith(api)); f.destroy();
    expect(requests.length).toBeGreaterThan(0); expect(requests.every(req => req.cancelled)).toBe(true);
  });
  it('cambiar la búsqueda vuelve a la primera página', () => {
    const f = page(); reply(Array.from({ length: 12 }, (_, index) => row({ id: 21 + index, expediente: `EXP-${21 + index}` })));
    f.componentInstance.cambiarPagina(2); f.componentInstance.searchModel = 'EXP-21'; expect(f.componentInstance.paginaActual()).toBe(1);
  });
  it('notificación de segunda calificación pendiente navega al detalle, sin adelantar el comando', () => {
    const f = page(); reply([row({ estado: 'NOTIFICACION_SEGUNDA_CALIFICACION', calificacionSegunda: 'ADMITIDO' })]);
    expect(f.componentInstance.getActionRoute(f.componentInstance.queueItems()[0])[0]).toBe('/ttaip/apelacion');
  });
  it('la elevación pendiente permanece visible con su propio estado', () => {
    const f = page(); reply([row({ estado: 'PENDIENTE_ELEVACION' })]); expect(f.componentInstance.queueItems().length).toBe(1);
  });
  it('consulta una sola lista autorizada con Bearer y no combina subconjuntos de estado', () => {
    const f = page(); const req = http.expectOne(`${api}/apelaciones`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${session.token}`); req.flush([row()]);
    expect(f.componentInstance.counts().todos).toBe(1); http.expectNone(req => req.url.includes('/ttaip/'));
  });
  it('no consulta con una sesión que no corresponde al Tribunal', () => {
    TestBed.inject(AuthService).guardarSesion({ ...session, tipoUsuario: 'FUNCIONARIO' }); const f = page();
    expect(f.componentInstance.error()).toContain('sesión'); http.expectNone(req => req.url.startsWith(api));
  });
  it('una lista vacía confirmada no equivale a un porcentaje de fundadas medido', () => {
    const f = page(); reply([]); f.detectChanges(); expect(f.componentInstance.counts().todos).toBe(0);
    expect(f.componentInstance.tasaFundadas()).toBeNull(); expect(f.nativeElement.textContent).toContain('Sin coincidencias');
    expect(f.nativeElement.textContent).not.toContain('0%');
  });
  it.each([400, 401, 403, 404, 422, 500, 503])('HTTP %i presenta error, sin datos anteriores ni vacío confirmado', status => {
    const f = page(); reply([row()]); f.componentInstance.cargarDashboard();
    http.expectOne(`${api}/apelaciones`).flush({ detail: 'detalle interno no publicable' }, { status, statusText: 'Failure' }); f.detectChanges();
    expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull(); expect(f.nativeElement.querySelector('[role=list]')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Persona sintética'); expect(f.nativeElement.textContent).not.toContain('detalle interno');
    expect(f.nativeElement.textContent).not.toContain('Sin coincidencias'); expect(f.componentInstance.reintentable()).toBe(status >= 500);
  });
  it('un fallo de red conserva reintento manual y la recuperación no duplica consultas', () => {
    const f = page(); http.expectOne(`${api}/apelaciones`).error(new ProgressEvent('error')); f.detectChanges();
    const retry = [...f.nativeElement.querySelectorAll('button')].find((node: any) => node.textContent.trim() === 'Reintentar') as HTMLButtonElement;
    retry.click(); f.detectChanges(); http.expectOne(`${api}/apelaciones`).flush([row()]); f.detectChanges();
    expect(f.componentInstance.error()).toBe(''); expect(f.nativeElement.textContent).toContain('Persona sintética');
  });
  it.each([null, { content: [], totalElements: 50 }, [row(), row()], [row({ id: null })], [row({ ciudadanoNombre: {} })]].map(payload => [payload]))('no interpreta una respuesta incompatible como lista completa: %j', payload => {
    const f = page(); http.expectOne(`${api}/apelaciones`).flush(payload); f.detectChanges();
    expect(f.componentInstance.error()).toContain('incompleta'); expect(f.componentInstance.apelaciones()).toEqual([]);
  });
  it('cuenta todas las etapas, incluida notificación, y conserva un estado desconocido en Otros', () => {
    const states = ['PENDIENTE_ELEVACION', 'EN_CALIFICACION_1', 'EN_SUBSANACION', 'EN_CALIFICACION_2', 'NOTIFICACION_SEGUNDA_CALIFICACION', 'EN_RESOLUCION', 'RESUELTO', 'ESTADO_NO_RECONOCIDO'];
    const f = page(); reply(states.map((estado, i) => row({ id: 21 + i, expediente: `EXP-${21 + i}`, estado })));
    expect(f.componentInstance.counts()).toMatchObject({ todos: 8, elevacion: 1, calificacion1: 1, subsanacion: 1, calificacion2: 2, resolucion: 1, resueltos: 1, otras: 1 });
    f.componentInstance.selectStage('otras'); expect(f.componentInstance.filtered()[0].apelacion.estado).toBe('ESTADO_NO_RECONOCIDO');
  });
  it('combina etapa, búsqueda normalizada, estado y sala por ID sin nuevas peticiones', () => {
    const f = page(); reply([row({ ciudadanoNombre: 'Ángela Pérez', expedienteTtaip: { id: 51, sala: { id: 8, nombre: 'Sala A' } } }),
      row({ id: 22, expediente: 'EXP-22', estado: 'EN_SUBSANACION', ciudadanoNombre: 'Ángela Pérez', expedienteTtaip: { id: 52, sala: { id: 9, nombre: 'Sala B' } } })]);
    const c = f.componentInstance; c.selectStage('todos'); c.searchModel = 'angela informacion'; c.cambiarSala(8); c.cambiarEstado('EN_CALIFICACION_1');
    expect(c.filtered().map(item => item.apelacion.id)).toEqual([21]); expect(c.counts().todos).toBe(2);
    c.limpiarFiltros(); expect(c.filtered().length).toBe(2); expect(c.search()).toBe(''); http.expectNone(req => req.url.startsWith(api));
  });
  it('no confunde salas con el mismo nombre ni registros sin asignación', () => {
    const f = page(); reply([row({ expedienteTtaip: { id: 51, sala: { id: 8, nombre: 'Sala 1' } } }), row({ id: 22, expediente: 'EXP-22', expedienteTtaip: { id: 52, sala: { id: 9, nombre: 'Sala 1' } } }), row({ id: 23, expediente: 'EXP-23' })]);
    const c = f.componentInstance; c.cambiarSala(9); expect(c.filtered().map(item => item.apelacion.id)).toEqual([22]);
    c.cambiarSala('SIN_SALA'); expect(c.filtered().map(item => item.apelacion.id)).toEqual([23]); expect(c.salas().length).toBe(2);
  });
  it('la página no modifica el alcance de indicadores y búsqueda reinicia el rango', () => {
    const f = page(); reply(Array.from({ length: 10 }, (_, i) => row({ id: 21 + i, expediente: `EXP-${21 + i}` })));
    const c = f.componentInstance; c.cambiarPagina(3); expect(c.filteredVisibles().length).toBe(2); expect(c.totalExpedientes()).toBe(10);
    expect(c.inicioRegistro()).toBe(9); c.searchModel = 'EXP-21'; expect(c.inicioRegistro()).toBe(1); expect(c.totalExpedientes()).toBe(10);
    c.limpiarFiltros(); c.cambiarItemsPorPagina(8); expect(c.filteredVisibles().length).toBe(8);
  });
  it('distingue resuelta/concluida de resolución final identificada y de cumplimiento', () => {
    const f = page(); reply([row({ estado: 'RESUELTO', resultado: 'FUNDADO' }), row({ id: 22, expediente: 'EXP-22', estado: 'CONCLUSION_DESISTIMIENTO' })]);
    expect(f.componentInstance.resueltas().length).toBe(2); expect(f.componentInstance.finales().length).toBe(0); expect(f.componentInstance.tasaFundadas()).toBeNull();
  });
  it('la distribución separa total, parcial y decisiones restantes con denominador explícito', () => {
    const f = page(); const decisions = ['FUNDADO', 'FUNDADO_EN_PARTE', 'INFUNDADO', 'IMPROCEDENTE'];
    reply(decisions.map((decision, i) => row({ id: 21 + i, expediente: `EXP-${21 + i}`, estado: 'RESUELTO', resolucion: { id: 41 + i, tipoResolucion: 'RESOLUCION_FINAL', decision } })));
    expect(f.componentInstance.fundadasCount()).toBe(1); expect(f.componentInstance.tasaFundadas()).toBe(25); expect(f.componentInstance.resultados().length).toBe(4);
  });
  it('un resultado de primera calificación no alimenta decisiones finales', () => {
    const f = page(); reply([row({ estado: 'RESUELTO', resolucion: { id: 41, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'IMPROCEDENTE' } })]);
    expect(f.componentInstance.finales()).toEqual([]);
  });
  it('agrupa entidades por ID, no por nombres coincidentes o entidades externas sin ID', () => {
    const f = page(); reply([row(), row({ id: 22, expediente: 'EXP-22', entidadId: 5 }), row({ id: 23, expediente: 'EXP-23', entidadId: null, entidadExternaNombre: 'Entidad sintética' })]);
    expect(f.componentInstance.topEntidades().map(item => [item.id, item.count])).toEqual([[3, 1], [5, 1]]);
  });
  it.each([
    [undefined, 'Reloj no informado'],
    [{ requerimientoId: 71, estado: 'PENDIENTE_INICIO', diasHabiles: 2 }, 'Pendiente de inicio'],
    [{ requerimientoId: 71, estado: 'EN_CURSO', diasHabiles: 2 }, 'Reloj incompleto'],
    [{ requerimientoId: 71, estado: 'EN_CURSO', diasHabiles: 2, notificacionId: 81, fechaEficacia: '2026-10-22T09:00:00', fechaLimite: '2026-10-26', diasHabilesRestantes: 0 }, '0d'],
    [{ requerimientoId: 71, estado: 'VENCIDO', diasHabiles: 2, notificacionId: 81, fechaEficacia: '2026-10-22T09:00:00', fechaLimite: '2026-10-26', diasHabilesRestantes: 0 }, 'Vencido'],
  ])('muestra el reloj explícito sin usar fechas históricas: %j', (clock, label) => {
    const f = page(); reply([row({ estado: 'EN_SUBSANACION', fechaSubsanacion: '2000-01-01', plazoSubsanacion: clock })]); f.detectChanges();
    expect(f.componentInstance.getDiasValor(f.componentInstance.queueItems()[0])).toBe(label);
  });
  it('un reloj de otro requerimiento no se atribuye al actual', () => {
    const f = page(); reply([row({ estado: 'EN_SUBSANACION', resolucionPrimeraCalificacion: { id: 72, decision: 'INADMISIBLE' }, plazoSubsanacion: { requerimientoId: 71, estado: 'PENDIENTE_INICIO', diasHabiles: 2 } })]);
    expect(f.componentInstance.getDiasValor(f.componentInstance.queueItems()[0])).toBe('Reloj incompleto');
  });
  it.each(['EN_CALIFICACION_2', 'NOTIFICACION_SEGUNDA_CALIFICACION', 'EN_RESOLUCION', 'PENDIENTE_ELEVACION'])('el estado %s sin evidencia necesaria dirige a revisión y no ejecuta un comando', estado => {
    const f = page(); reply([row({ estado })]); f.detectChanges();
    expect(f.componentInstance.getActionRoute(f.componentInstance.queueItems()[0])).toEqual(['/ttaip/apelacion', '00021-2026-JUS/TTAIP']);
    expect(f.nativeElement.querySelector('a[href^="/ttaip/resolver/"]')).toBeNull(); expect(f.nativeElement.querySelector('a[href^="/ttaip/segunda-calificacion/"]')).toBeNull();
    http.expectNone(req => req.method !== 'GET');
  });
  it('primera calificación sin actuación previa conserva navegación al caso de uso existente', () => {
    const f = page(); reply([row()]); expect(f.componentInstance.getActionRoute(f.componentInstance.queueItems()[0])).toEqual(['/ttaip/calificar', '00021-2026-JUS/TTAIP']);
  });
  it('primera calificación ya registrada no se ofrece otra vez aunque el estado sea inconsistente', () => {
    const f = page(); reply([row({ calificacionPrimera: 'ADMISIBLE', resolucionPrimeraCalificacion: { id: 71 } })]);
    expect(f.componentInstance.getActionRoute(f.componentInstance.queueItems()[0])[0]).toBe('/ttaip/apelacion');
  });
  it('un cambio de sesión cancela la lectura anterior y retira datos y filtros', () => {
    const f = page(); const old = http.expectOne(`${api}/apelaciones`); f.componentInstance.searchModel = 'dato anterior';
    TestBed.inject(AuthService).guardarSesion({ ...session, token: 'sesion-nueva', usuarioId: 8, miembroId: 8 }); f.detectChanges();
    expect(old.cancelled).toBe(true); expect(f.componentInstance.search()).toBe('');
    http.expectOne(`${api}/apelaciones`).flush([row({ id: 22, expediente: 'EXP-22', ciudadanoNombre: 'Otro operador' })]); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Persona sintética'); expect(f.nativeElement.textContent).toContain('EXP-22');
  });
  it('cierre en otra pestaña retira el listado sin mantener métricas ni identidad previas', () => {
    const f = page(); reply([row()]); f.detectChanges(); localStorage.removeItem('usuario'); window.dispatchEvent(new StorageEvent('storage', { key: 'usuario' })); f.detectChanges();
    expect(f.componentInstance.apelaciones()).toEqual([]); expect(f.nativeElement.querySelector('[role=list]')).toBeNull();
  });
  it('no duplica lecturas al pulsar recarga durante carga ni al filtrar', () => {
    const f = page(); f.componentInstance.cargarDashboard(); f.componentInstance.cargarDashboard(); http.expectOne(`${api}/apelaciones`).flush([row()]);
    f.componentInstance.searchModel = 'persona'; f.componentInstance.selectStage('todos'); http.expectNone(req => req.url.startsWith(api));
  });
  it('los controles nativos de búsqueda y etapa filtran por el recurso sin escribir estados', () => {
    const f = page(); reply([row(), row({ id: 22, expediente: 'EXP-22', estado: 'EN_SUBSANACION' })]); f.detectChanges();
    const all = [...f.nativeElement.querySelectorAll('button')].find((button: any) => button.textContent.includes('Todos')) as HTMLButtonElement;
    all.click(); f.detectChanges();
    const search = f.nativeElement.querySelector('#tribunal-search') as HTMLInputElement;
    search.value = 'EXP-22'; search.dispatchEvent(new Event('input')); f.detectChanges();
    expect(f.componentInstance.filtered().map(item => item.apelacion.id)).toEqual([22]);
    expect(f.nativeElement.querySelectorAll('[role=listitem]').length).toBe(1);
    expect(f.nativeElement.querySelector('[role=listitem] .code-chip').getAttribute('href')).toBe('/ttaip/apelacion/EXP-22');
    http.expectNone(req => req.url.startsWith(api));
  });
  it('expone etiquetas, selección, nombres largos y enlaces de consulta sin almacenar búsquedas', () => {
    const f = page(); reply([row({ solicitudAsunto: 'Asunto extenso '.repeat(40) })]); f.detectChanges();
    for (const id of ['tribunal-search', 'tribunal-state', 'tribunal-sala', 'tribunal-page-size']) expect(f.nativeElement.querySelector(`label[for='${id}']`)).not.toBeNull();
    expect(f.nativeElement.querySelectorAll('h1').length).toBe(1); expect(f.nativeElement.querySelector('[aria-pressed=true]')).not.toBeNull();
    expect(f.nativeElement.querySelector('[role=listitem] h3').textContent).toContain('Asunto extenso');
    expect(f.nativeElement.querySelector('a[href="/ttaip/cumplimiento"]')).not.toBeNull();
    const stored = localStorage.getItem('usuario'); f.componentInstance.searchModel = 'consulta sensible'; f.detectChanges();
    expect(localStorage.getItem('usuario')).toBe(stored); expect(localStorage.length).toBe(1); expect(sessionStorage.length).toBe(0);
  });
});
