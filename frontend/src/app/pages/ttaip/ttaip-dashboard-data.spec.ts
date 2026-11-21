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
  const panelRequest = (req: { url: string }) => req.url === `${api}/panel/apelaciones`;
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
  afterEach(() => {
    try {
      http.match(req => req.url.endsWith('/calendario')).forEach(req => { if (!req.cancelled) req.flush({ plazos: {} }); });
      http.verify({ ignoreCancelled: true });
    } finally { TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); }
  });
  function page() { const f = TestBed.createComponent(TtaipDashboardComponent); f.detectChanges(); return f; }
  // Synthetic server pages: summaries describe the authorized aggregate, not the visible page.
  function payload(rows: ReturnType<typeof row>[], page = 0, size = 4, visible = rows) {
    const counts: Record<string, number> = {}, states: Record<string, number> = {}, results: Record<string, number> = {}, entities: Record<string, number> = {};
    const stage: Record<string, string> = { PENDIENTE_ELEVACION: 'elevacion', EN_CALIFICACION_1: 'calificacion1', EN_SUBSANACION: 'subsanacion', EN_CALIFICACION_2: 'calificacion2', NOTIFICACION_SEGUNDA_CALIFICACION: 'calificacion2', EN_RESOLUCION: 'resolucion' };
    for (const r of rows) {
      states[r.estado] = (states[r.estado] ?? 0) + 1;
      const key = stage[r.estado] ?? (/^(RESUELTO|CONCLUSION)/.test(r.estado) ? 'resueltos' : 'otras');
      counts[key] = (counts[key] ?? 0) + 1;
      const resolution = r.resolucion as { tipoResolucion?: string; decision?: string } | null;
      if (resolution?.tipoResolucion === 'RESOLUCION_FINAL' && resolution.decision) results[resolution.decision] = (results[resolution.decision] ?? 0) + 1;
      if (r.entidadId) entities[r.entidadId] = (entities[r.entidadId] ?? 0) + 1;
    }
    return { contenido: visible.slice(page * size, (page + 1) * size), pagina: page, tamano: size,
      totalElementos: visible.length, totalPaginas: Math.ceil(visible.length / size), ultima: (page + 1) * size >= visible.length,
      resumen: { total: rows.length, porEstado: states, porEtapa: counts, porResultado: results, porEntidad: entities },
      entidades: [{ id: 3, nombre: 'Entidad sintética' }, { id: 5, nombre: 'Entidad sintética' }],
      salas: [{ id: 8, nombre: 'Sala 1' }, { id: 9, nombre: 'Sala 1' }], alcance: 'Tribunal autorizado' };
  }
  function reply(rows: ReturnType<typeof row>[], visible = rows) {
    const req = http.expectOne(panelRequest);
    req.flush(payload(rows, Number(req.request.params.get('pagina')), Number(req.request.params.get('tamano')), visible));
    return req;
  }
  it('no calcula un plazo de etapa desde una fecha de ingreso antigua', () => {
    const f = page(); reply([row({ fechaApelacion: '2000-01-01' })]);
    expect(f.componentInstance.getDiasValor(f.componentInstance.queueItems()[0])).toMatch(/no informado|no disponible/i);
    expect(f.componentInstance.queueItems()[0].status.informado).toBe(false);
    expect(f.nativeElement.textContent).not.toMatch(/\d+d/);
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
    const f = page(); const req = reply([row()]);
    expect(req.request.params.get('sala')).toBeNull();
    expect(req.request.params.get('estado')).toBeNull();
    expect(f.componentInstance.nombreSala(f.componentInstance.apelaciones()[0])).toBe('No informada');
  });
  it('fundado en parte no se suma a fundado total', () => {
    const f = page(); reply([row({ estado: 'RESUELTO_FUNDADO_EN_PARTE', resultado: 'FUNDADO_EN_PARTE',
      resolucion: { id: 41, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO_EN_PARTE' } })]);
    expect(f.componentInstance.fundadasCount()).toBe(0);
  });
  it('un expediente resuelto muestra una sola decisión legible y no el código crudo', () => {
    const f = page(); reply([row({ estado: 'RESUELTO_FUNDADO_EN_PARTE', resultado: 'FUNDADO_EN_PARTE',
      resolucion: { id: 41, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO_EN_PARTE' } })]);
    f.detectChanges();
    const text = f.nativeElement.querySelector('.tribunal-row').textContent;
    expect(text).toContain('Fundado en parte');
    expect(text).not.toContain('FUNDADO_EN_PARTE');
    expect(text.match(/Fundado en parte/g)).toHaveLength(1);
    expect(text).not.toContain('RESUELTO');
  });
  function calendario(plazos: Record<string, number>) {
    const req = http.expectOne(r => r.url.endsWith('/calendario'));
    req.flush({ plazos });
  }
  it('cada etapa abierta cuenta el saldo desde el ingreso con el plazo oficial, y la fecha aparece una sola vez', () => {
    const f = page();
    f.componentInstance.hoyISO.set('2026-11-11');
    calendario({ TTAIP_ELEVACION: 2, TTAIP_CALIFICACION_1: 8, TTAIP_SUBSANACION: 2, TTAIP_CALIFICACION_2: 10, TTAIP_RESOLUCION: 10 });
    reply([
      row({ estado: 'EN_CALIFICACION_2', fechaApelacion: '2026-11-07' }),
      row({ id: 22, expediente: 'EXP-22', estado: 'PENDIENTE_ELEVACION', fechaApelacion: '2026-11-07' }),
      row({ id: 23, expediente: 'EXP-23', estado: 'EN_CALIFICACION_1', fechaApelacion: '2026-11-07' }),
      row({ id: 24, expediente: 'EXP-24', estado: 'EN_RESOLUCION', fechaApelacion: '2026-11-07', calificacionPrimera: 'ADMISIBLE' }),
    ]);
    f.detectChanges();
    const rows = [...f.nativeElement.querySelectorAll('.tribunal-row')].map((node: HTMLElement) => node.textContent);
    const cards = [...f.nativeElement.querySelectorAll('[data-tour="t-pipeline"] button')] as HTMLButtonElement[];
    const card = (label: string) => cards.find(node => node.textContent?.includes(label));
    expect(rows[0]).toContain('8d');
    expect(rows[0]).toContain('restantes');
    expect(rows[0]).toContain('límite 23/11/2026');
    expect(rows[0]).not.toContain('10 días háb.');
    expect(rows[0].match(/ingresó/gi)).toHaveLength(1);
    expect(rows[0]).not.toContain('En 2da Calificación');
    expect(rows[1]).toContain('Hoy');
    expect(rows[1]).toContain('vence hoy');
    expect(rows[1]).toContain('límite 11/11/2026');
    expect(rows[2]).toContain('6d');
    expect(rows[2]).not.toContain('7 días háb.');
    expect(rows[2]).not.toContain('8 días háb.');
    expect(rows[3]).toContain('8d');
    expect(rows[3]).toContain('restantes');
    expect(rows[3]).not.toContain('10 días háb.');
    expect(card('1ra Calif.')?.textContent).toContain('8 días háb.');
    expect(card('1ra Calif.')?.textContent).not.toContain('7 días háb.');
    expect(card('Res. Final')?.textContent).toContain('10 días háb.');
    expect(card('Subsanación')?.disabled).toBe(true);
    expect(card('Resueltos')?.disabled).toBe(true);
    expect(cards).toHaveLength(7);
    expect(card('Elevación')).toBeUndefined();
    f.componentInstance.selectStage('subsanacion');
    http.expectNone(panelRequest);
    expect(f.componentInstance.stageKey()).toBe('todos');
  });
  it('un ingreso antiguo con calendario oficial figura vencido', () => {
    const f = page();
    f.componentInstance.hoyISO.set('2026-11-11');
    calendario({ TTAIP_CALIFICACION_1: 8 });
    reply([row({ fechaApelacion: '2000-01-01', estado: 'EN_CALIFICACION_1' })]);
    f.detectChanges();
    const text = f.nativeElement.querySelector('.tribunal-row').textContent;
    expect(text).toContain('Vencido');
    expect(text).toContain('plazo vencido');
    expect(f.componentInstance.queueItems()[0].status.informado).toBe(true);
    expect(f.componentInstance.queueItems()[0].status.vencido).toBe(true);
  });
  it('la subsanación conserva el reloj del servidor', () => {
    const f = page();
    f.componentInstance.hoyISO.set('2026-11-11');
    calendario({ TTAIP_SUBSANACION: 2 });
    reply([row({ estado: 'EN_SUBSANACION', fechaApelacion: '2000-01-01', plazoSubsanacion: { diasHabilesRestantes: 1, diasHabiles: 2, estado: 'EN_CURSO', fechaLimite: '2026-11-12' } })]);
    f.detectChanges();
    const text = f.nativeElement.querySelector('.tribunal-row').textContent;
    expect(text).toContain('1d');
    expect(text).not.toContain('Vencido');
    expect(text).toContain('límite 12/11/2026');
  });
  it('sin calendario oficial no muestra un plazo inventado', () => {
    const f = page(); reply([row({ estado: 'EN_CALIFICACION_1' })]); f.detectChanges();
    const text = f.nativeElement.querySelector('.tribunal-row').textContent;
    expect(text).toContain('plazo no informado');
    expect(text).not.toContain('días háb.');
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
    f.componentInstance.cambiarPagina(2); const old = http.expectOne(panelRequest); f.componentInstance.searchModel = 'EXP-21'; expect(old.cancelled).toBe(true); expect(f.componentInstance.paginaActual()).toBe(1); f.destroy();
  });
  it('notificación de segunda calificación pendiente navega al detalle, sin adelantar el comando', () => {
    const f = page(); reply([row({ estado: 'NOTIFICACION_SEGUNDA_CALIFICACION', calificacionSegunda: 'ADMITIDO' })]);
    expect(f.componentInstance.getActionRoute(f.componentInstance.queueItems()[0])[0]).toBe('/ttaip/apelacion');
  });
  it('la elevación pendiente permanece visible con su propio estado', () => {
    const f = page(); reply([row({ estado: 'PENDIENTE_ELEVACION' })]); expect(f.componentInstance.queueItems().length).toBe(1);
  });
  it('consulta una sola lista autorizada con Bearer y no combina subconjuntos de estado', () => {
    const f = page(); const req = http.expectOne(panelRequest);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${session.token}`); req.flush(payload([row()]));
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
    http.expectOne(panelRequest).flush({ detail: 'detalle interno no publicable' }, { status, statusText: 'Failure' }); f.detectChanges();
    expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull(); expect(f.nativeElement.querySelector('[role=list]')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Persona sintética'); expect(f.nativeElement.textContent).not.toContain('detalle interno');
    expect(f.nativeElement.textContent).not.toContain('Sin coincidencias'); expect(f.componentInstance.reintentable()).toBe(status >= 500);
  });
  it('un fallo de red conserva reintento manual y la recuperación no duplica consultas', () => {
    const f = page(); http.expectOne(panelRequest).error(new ProgressEvent('error')); f.detectChanges();
    const retry = [...f.nativeElement.querySelectorAll('button')].find((node: any) => node.textContent.trim() === 'Reintentar') as HTMLButtonElement;
    retry.click(); f.detectChanges(); http.expectOne(panelRequest).flush(payload([row()])); f.detectChanges();
    expect(f.componentInstance.error()).toBe(''); expect(f.nativeElement.textContent).toContain('Persona sintética');
  });
  it.each([null, { content: [], totalElements: 50 }, [row(), row()], [row({ id: null })], [row({ ciudadanoNombre: {} })]].map(payload => [payload]))('no interpreta una respuesta incompatible como lista completa: %j', payload => {
    const f = page(); http.expectOne(panelRequest).flush(Array.isArray(payload) ? { ...{ contenido: payload, pagina: 0, tamano: 4, totalElementos: payload.length, totalPaginas: 1, ultima: true, resumen: { total: payload.length, porEstado: {}, porEtapa: {} }, entidades: [], alcance: 'Tribunal' } } : payload); f.detectChanges();
    expect(f.componentInstance.error()).toContain('incompleta'); expect(f.componentInstance.apelaciones()).toEqual([]);
  });
  it('cuenta todas las etapas, incluida notificación, y conserva un estado desconocido en Otros', () => {
    const states = ['PENDIENTE_ELEVACION', 'EN_CALIFICACION_1', 'EN_SUBSANACION', 'EN_CALIFICACION_2', 'NOTIFICACION_SEGUNDA_CALIFICACION', 'EN_RESOLUCION', 'RESUELTO', 'ESTADO_NO_RECONOCIDO'];
    const f = page(); reply(states.map((estado, i) => row({ id: 21 + i, expediente: `EXP-${21 + i}`, estado })));
    expect(f.componentInstance.counts()).toMatchObject({ todos: 8, elevacion: 1, calificacion1: 1, subsanacion: 1, calificacion2: 2, resolucion: 1, resueltos: 1, otras: 1 });
    f.componentInstance.selectStage('otras'); const req = reply(states.map((estado, i) => row({ id: 21 + i, expediente: `EXP-${21 + i}`, estado })), [row({ estado: 'ESTADO_NO_RECONOCIDO' })]); expect(req.request.params.get('etapa')).toBe('otras'); expect(f.componentInstance.filtered()[0].apelacion.estado).toBe('ESTADO_NO_RECONOCIDO');
  });
  it('la búsqueda y la etapa consultan el servidor sin sala ni estado', () => {
    const rows = [row({ ciudadanoNombre: 'Ángela Pérez', expedienteTtaip: { id: 51, sala: { id: 8, nombre: 'Sala A' } } }), row({ id: 22, expediente: 'EXP-22', estado: 'EN_SUBSANACION' })];
    const f = page(); reply(rows); const c = f.componentInstance;
    c.searchModel = 'angela informacion'; c.selectStage('subsanacion');
    const req = reply(rows, [rows[1]]);
    expect(req.request.params.get('busqueda')).toBe('angela informacion');
    expect(req.request.params.get('etapa')).toBe('subsanacion');
    expect(req.request.params.get('sala')).toBeNull();
    expect(req.request.params.get('estado')).toBeNull();
    expect(c.filtered().map(item => item.apelacion.id)).toEqual([22]);
    c.searchModel = ''; c.selectStage('todos'); reply(rows); expect(c.filtered().length).toBe(2); expect(c.search()).toBe('');
  });
  it('muestra la sala de cada expediente sin filtrar la consulta', () => {
    const rows = [row({ expedienteTtaip: { id: 51, sala: { id: 8, nombre: 'Sala 1' } } }), row({ id: 22, expediente: 'EXP-22', expedienteTtaip: { id: 52, sala: { id: 9, nombre: 'Sala 1' } } }), row({ id: 23, expediente: 'EXP-23' })];
    const f = page(); const req = reply(rows); const c = f.componentInstance;
    expect(req.request.params.get('sala')).toBeNull();
    expect(c.nombreSala(c.apelaciones()[0])).toBe('Sala 1');
    expect(c.nombreSala(c.apelaciones()[1])).toBe('Sala 1');
    expect(c.nombreSala(c.apelaciones()[2])).toBe('No informada');
  });
  it('la página no modifica el alcance de indicadores y búsqueda reinicia el rango', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row({ id: 21 + i, expediente: `EXP-${21 + i}` }));
    const f = page(); reply(rows); const c = f.componentInstance;
    c.cambiarPagina(3); const pageReq = reply(rows); expect(pageReq.request.params.get('pagina')).toBe('2'); expect(pageReq.request.params.get('tamano')).toBe('4'); expect(c.filteredVisibles().length).toBe(2); expect(c.totalExpedientes()).toBe(10);
    expect(c.inicioRegistro()).toBe(9); c.searchModel = 'EXP-21'; expect(c.paginaActual()).toBe(1); expect(c.apelaciones()).toEqual([]);
  });
  it('distingue resuelta/concluida de resolución final identificada y de cumplimiento', () => {
    const f = page(); reply([row({ estado: 'RESUELTO', resultado: 'FUNDADO' }), row({ id: 22, expediente: 'EXP-22', estado: 'CONCLUSION_DESISTIMIENTO' })]);
    expect(f.componentInstance.counts().resueltos).toBe(2); expect(f.componentInstance.resultados().length).toBe(0); expect(f.componentInstance.tasaFundadas()).toBeNull();
  });
  it('la distribución separa total, parcial y decisiones restantes con denominador explícito', () => {
    const f = page(); const decisions = ['FUNDADO', 'FUNDADO_EN_PARTE', 'INFUNDADO', 'IMPROCEDENTE'];
    reply(decisions.map((decision, i) => row({ id: 21 + i, expediente: `EXP-${21 + i}`, estado: 'RESUELTO', resolucion: { id: 41 + i, tipoResolucion: 'RESOLUCION_FINAL', decision } })));
    expect(f.componentInstance.fundadasCount()).toBe(1); expect(f.componentInstance.tasaFundadas()).toBe(25); expect(f.componentInstance.resultados().length).toBe(4);
  });
  it('un resultado de primera calificación no alimenta decisiones finales', () => {
    const f = page(); reply([row({ estado: 'RESUELTO', resolucion: { id: 41, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'IMPROCEDENTE' } })]);
    expect(f.componentInstance.resultados()).toEqual([]);
  });
  it('agrupa entidades por ID, no por nombres coincidentes o entidades externas sin ID', () => {
    const f = page(); reply([row(), row({ id: 22, expediente: 'EXP-22', entidadId: 5 }), row({ id: 23, expediente: 'EXP-23', entidadId: null, entidadExternaNombre: 'Entidad sintética' })]);
    expect(f.componentInstance.topEntidades().map(item => [item.id, item.count])).toEqual([[3, 1], [5, 1]]);
  });
  it.each([
    [undefined, 'Reloj no informado'],
    [{ requerimientoId: 71, estado: 'PENDIENTE_INICIO', diasHabiles: 2 }, 'Pendiente de inicio'],
    [{ requerimientoId: 71, estado: 'EN_CURSO', diasHabiles: 2 }, 'Reloj incompleto'],
    [{ requerimientoId: 71, estado: 'EN_CURSO', diasHabiles: 2, notificacionId: 81, fechaEficacia: '2026-10-22T09:00:00', fechaLimite: '2026-10-26', diasHabilesRestantes: 0 }, 'Vence hoy'],
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
    const f = page(); const old = http.expectOne(panelRequest); f.componentInstance.searchModel = 'dato anterior';
    TestBed.inject(AuthService).guardarSesion({ ...session, token: 'sesion-nueva', usuarioId: 8, miembroId: 8 }); f.detectChanges();
    expect(old.cancelled).toBe(true); expect(f.componentInstance.search()).toBe('');
    http.expectOne(panelRequest).flush(payload([row({ id: 22, expediente: 'EXP-22', ciudadanoNombre: 'Otro operador' })])); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Persona sintética'); expect(f.nativeElement.textContent).toContain('EXP-22');
  });
  it('cierre en otra pestaña retira el listado sin mantener métricas ni identidad previas', () => {
    const f = page(); reply([row()]); f.detectChanges(); localStorage.removeItem('usuario'); window.dispatchEvent(new StorageEvent('storage', { key: 'usuario' })); f.detectChanges();
    expect(f.componentInstance.apelaciones()).toEqual([]); expect(f.nativeElement.querySelector('[role=list]')).toBeNull();
  });
  it('cancela lecturas sustituidas y consolida la búsqueda antes de consultar', () => {
    vi.useFakeTimers();
    try {
      const f = page(); const old = http.expectOne(panelRequest); f.componentInstance.cargarDashboard(); expect(old.cancelled).toBe(true); reply([row()]);
      f.componentInstance.searchModel = 'per'; f.componentInstance.searchModel = 'persona'; http.expectNone(panelRequest);
      vi.advanceTimersByTime(250); expect(reply([row()]).request.params.get('busqueda')).toBe('persona'); f.destroy();
    } finally { vi.useRealTimers(); }
  });
  it('los controles nativos consultan el recurso sin escribir estados', () => {
    vi.useFakeTimers();
    try {
      const rows = [row(), row({ id: 22, expediente: 'EXP-22', estado: 'EN_SUBSANACION' })];
      const f = page(); reply(rows); f.detectChanges();
      const search = f.nativeElement.querySelector('#tribunal-search') as HTMLInputElement;
      search.value = 'EXP-22'; search.dispatchEvent(new Event('input')); f.detectChanges(); vi.advanceTimersByTime(250);
      expect(reply(rows, [rows[1]]).request.params.get('busqueda')).toBe('EXP-22'); f.detectChanges();
      expect(f.componentInstance.filtered().map(item => item.apelacion.id)).toEqual([22]);
      expect(f.nativeElement.querySelectorAll('[role=listitem]').length).toBe(1);
      expect(f.nativeElement.querySelector('[role=listitem] .code-chip').getAttribute('href')).toBe('/ttaip/apelacion/EXP-22');
      http.expectNone(req => req.method !== 'GET'); f.destroy();
    } finally { vi.useRealTimers(); }
  });
  it('expone etiquetas, selección, nombres largos y enlaces de consulta sin almacenar búsquedas', () => {
    const f = page(); reply([row({ solicitudAsunto: 'Asunto extenso '.repeat(40) })]); f.detectChanges();
    expect(f.nativeElement.querySelector(`label[for='tribunal-search']`)).not.toBeNull();
    for (const id of ['tribunal-state', 'tribunal-sala', 'tribunal-page-size', 'tribunal-order']) expect(f.nativeElement.querySelector(`#${id}`)).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Limpiar filtros');
    expect(f.nativeElement.textContent).not.toContain('Vocalía / Sala');
    expect(f.nativeElement.textContent).not.toContain('Estado legal');
    expect(f.nativeElement.textContent).not.toContain('Por página');
    expect(f.nativeElement.querySelectorAll('h1').length).toBe(1); expect(f.nativeElement.querySelector('[aria-pressed=true]')).not.toBeNull();
    expect(f.nativeElement.querySelector('[role=listitem] h3').textContent).toContain('Asunto extenso');
    expect(f.nativeElement.querySelector('a[href="/ttaip/cumplimiento"]')).not.toBeNull();
    const stored = localStorage.getItem('usuario'); f.componentInstance.searchModel = 'consulta sensible'; f.detectChanges();
    expect(localStorage.getItem('usuario')).toBe(stored); expect(localStorage.length).toBe(1); expect(sessionStorage.length).toBe(0);
  });
});
