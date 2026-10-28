import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TtaipService } from '../../services/ttaip.service';
import { ProcesoDisciplinarioComponent } from './proceso-disciplinario.component';

describe('DisciplinaryProcess — capacidad real y antecedentes', () => {
  const resolution = { id: 32, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO', fechaResolucion: '2026-10-16T12:00:00', fundamentos: 'Fundamentos sintéticos', miembroTTAIPId: 9, miembroTTAIPNombre: 'Miembro sintético', iniciarProcesoDisciplinario: true };
  const appeal = { id: 7, expediente: '00007-2026-JUS/TTAIP', entidadId: 3, entidadNombre: 'Entidad sintética', resolucion: resolution, expedienteTtaip: { id: 91, numeroExpediente: '00007-2026-JUS/TTAIP' } };
  let service: { getResueltas: ReturnType<typeof vi.fn> }, token: string;
  const cambiosSesion = signal(0);
  beforeEach(() => {
    token = 'synthetic-session'; service = { getResueltas: vi.fn(() => of([appeal])) };
    TestBed.configureTestingModule({ imports: [ProcesoDisciplinarioComponent], providers: [provideRouter([]),
      { provide: TtaipService, useValue: service },
      { provide: AuthService, useValue: { cambiosSesion, getToken: () => token, getTipoUsuario: () => 'TTAIP', obtenerSesion: () => ({ usuarioId: 4, tipoUsuario: 'TTAIP' }) } }] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });
  function page() { const f = TestBed.createComponent(ProcesoDisciplinarioComponent); f.detectChanges(); return f; }
  it('un indicador booleano no crea una apertura del procedimiento en la línea de tiempo', () => {
    const c = page().componentInstance; expect(c.timeline().some(e => e.title === 'Apertura del proceso')).toBe(false);
  });
  it('una consulta vacía de resoluciones no acredita ausencia de procedimientos', () => {
    service.getResueltas.mockReturnValue(of([])); const f = page();
    expect(f.nativeElement.textContent).not.toContain('Sin procesos disciplinarios activos'); expect(f.nativeElement.textContent).toContain('Consulta de procedimientos no disponible');
  });
  it('la fecha de resolución no se reutiliza como fecha de notificación disciplinaria', () => {
    const f = page(); f.componentInstance.cambiarTab('notificacion'); f.detectChanges();
    const panel = f.nativeElement.querySelector('#disciplinary-panel-notificacion') ?? f.nativeElement.querySelector('.animate-fade-in');
    expect(panel.textContent).not.toContain(f.componentInstance.formatDate(resolution.fechaResolucion));
  });
  it('una consulta fallida limpia el recurso anterior', () => {
    const c = page().componentInstance; service.getResueltas.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    c.cargarProcesos(); expect(c.cases()).toEqual([]); expect(c.selectedCase()).toBeNull();
  });
  it('los errores no exponen detalles internos suministrados por el servidor', () => {
    service.getResueltas.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { mensaje: 'INTERNAL-SYNTHETIC-DETAIL' } })));
    expect(page().nativeElement.textContent).not.toContain('INTERNAL-SYNTHETIC-DETAIL');
  });
  it('una sesión distinta descarta la consulta y los antecedentes anteriores', () => {
    const source = new Subject(); service.getResueltas.mockReturnValue(source); const f = page();
    token = ''; cambiosSesion.update(v => v + 1); f.detectChanges(); source.next([appeal]);
    expect(f.componentInstance.cases()).toEqual([]); expect(f.componentInstance.selectedCase()).toBeNull();
  });
  it('destruir impide que una consulta tardía repueble datos', () => {
    const source = new Subject(); service.getResueltas.mockReturnValue(source); const f = page(); f.destroy(); source.next([appeal]); expect(f.componentInstance.cases()).toEqual([]);
  });
  it('un antecedente sin ID de resolución no se identifica por el código de apelación', () => {
    service.getResueltas.mockReturnValue(of([{ ...appeal, resolucion: { ...resolution, id: 0 } }])); expect(page().componentInstance.cases()).toEqual([]);
  });
  it('una selección ajena no activa ni sustituye el antecedente consultado', () => {
    const c = page().componentInstance, previous = c.selectedCaseId();
    c.selectCase({ apelacion: { ...appeal, id: 999 }, resolucion: resolution } as never); expect(c.selectedCaseId()).toBe(previous);
  });
  it('no presenta al miembro del Tribunal como funcionario investigado en el listado', () => {
    const f = page(), item = f.nativeElement.querySelector('aside button'); expect(item.textContent).not.toContain('Miembro sintético');
  });
  it('no publica un catálogo de sanciones sin capacidad ni reglas validadas del producto', () => {
    expect(page().nativeElement.textContent).not.toContain('0.5 a 2 UIT');
  });
  it('resolución fundada, vencimiento o cierre operativo no abren por sí mismos un antecedente marcado', () => {
    service.getResueltas.mockReturnValue(of([{ ...appeal, estado: 'RESUELTO_FUNDADO', resolucion: { ...resolution, iniciarProcesoDisciplinario: false }, expedienteTtaip: { ...appeal.expedienteTtaip, cumplimientosResolucion: [{ id: 66, estadoCumplimiento: 'VENCIDO' }] } }]));
    const f = page(); expect(f.componentInstance.cases()).toEqual([]); expect(f.nativeElement.textContent).toContain('Sin indicadores en las resoluciones consultadas');
  });
  it('la omisión del indicador no se convierte en falso ni en ausencia de procesos', () => {
    service.getResueltas.mockReturnValue(of([{ ...appeal, resolucion: { ...resolution, iniciarProcesoDisciplinario: null } }])); const f = page();
    expect(f.componentInstance.informacionIncompleta()).toBe(true); expect(f.componentInstance.estadoConsulta()).not.toBe('vacio'); expect(f.nativeElement.textContent).toContain('Información incompleta');
  });
  it('un agregado de otro expediente no se usa como contexto del antecedente', () => {
    service.getResueltas.mockReturnValue(of([{ ...appeal, expedienteTtaip: { id: 91, numeroExpediente: 'AJENO' } }])); const c = page().componentInstance;
    expect(c.cases()).toEqual([]); expect(c.informacionIncompleta()).toBe(true);
  });
  it('no acepta un ID explícito de apelación ajena en la resolución', () => {
    service.getResueltas.mockReturnValue(of([{ ...appeal, resolucion: { ...resolution, apelacionId: 999 } }])); expect(page().componentInstance.cases()).toEqual([]);
  });
  it('las resoluciones duplicadas no se eligen por posición', () => {
    service.getResueltas.mockReturnValue(of([appeal, { ...appeal, id: 8 }])); const c = page().componentInstance;
    expect(c.cases()).toEqual([]); expect(c.informacionIncompleta()).toBe(true);
  });
  it('una actuación de otro tipo no se transforma en resolución final ni procedimiento', () => {
    service.getResueltas.mockReturnValue(of([{ ...appeal, resolucion: { ...resolution, tipoResolucion: 'PRIMERA_CALIFICACION' } }])); expect(page().componentInstance.cases()).toEqual([]);
  });
  it('la selección usa ID de resolución y permite distinguir miembros o entidades con el mismo nombre', () => {
    const second = { ...appeal, id: 8, expediente: '00008-2026-JUS/TTAIP', expedienteTtaip: { id: 92, numeroExpediente: '00008-2026-JUS/TTAIP' }, resolucion: { ...resolution, id: 33 } };
    service.getResueltas.mockReturnValue(of([appeal, second])); const f = page(), c = f.componentInstance;
    expect(c.cases()).toHaveLength(2); c.cambiarTab('notificacion'); c.selectCase(c.cases()[1]); f.detectChanges();
    expect(c.selectedCaseId()).toBe(33); expect(c.selectedCase()?.apelacion.id).toBe(8); expect(c.activeTab()).toBe('resolucion');
    const link = f.nativeElement.querySelector('a[href="/ttaip/resolucion/00008-2026-JUS%2FTTAIP"]') ?? [...f.nativeElement.querySelectorAll('a')].find((a: unknown) => (a as HTMLAnchorElement).textContent?.includes('Consultar expediente TTAIP'));
    expect((link as HTMLAnchorElement).getAttribute('href')).toContain('00008-2026');
  });
  it('un cambio de contexto limpia la consulta previa durante carga y error, sin avisos de éxito', () => {
    const f = page(), c = f.componentInstance; const pending = new Subject(); service.getResueltas.mockReturnValue(pending); c.cargarProcesos(); f.detectChanges();
    expect(c.cases()).toEqual([]); expect(c.loading()).toBe(true); expect(f.nativeElement.textContent).not.toContain('Fundamentos sintéticos');
    pending.error(new HttpErrorResponse({ status: 404 })); f.detectChanges(); expect(c.estadoConsulta()).toBe('inexistente'); expect(c.selectedCase()).toBeNull(); expect(f.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('los datos temporales ausentes no se sustituyen por fechas de apelación ni por hoy', () => {
    service.getResueltas.mockReturnValue(of([{ ...appeal, fechaApelacion: '2000-01-01', resolucion: { ...resolution, fechaResolucion: null } }])); const c = page().componentInstance;
    expect(c.timeline()).toHaveLength(1); expect(c.timeline()[0].date).toBe('Fecha no informada'); expect(c.formatDate('not-a-date')).toBe('Fecha no informada'); expect(c.formatDate('2026-10-16')).toContain('16');
  });
  it('no copia los descargos de la entidad o notificaciones de apelación como actuaciones disciplinarias', () => {
    service.getResueltas.mockReturnValue(of([{ ...appeal, expedienteTtaip: { ...appeal.expedienteTtaip, descargosEntidad: [{ id: 65, resumenDescargo: 'NO-COPIAR-DESCARGO' }], notificaciones: [{ id: 66, estado: 'ENTREGADA' }] } }]));
    const f = page(); f.componentInstance.cambiarTab('descargos'); f.detectChanges(); expect(f.nativeElement.textContent).not.toContain('NO-COPIAR-DESCARGO');
    const button = f.nativeElement.querySelector('#disciplinary-panel-descargos button') as HTMLButtonElement; expect(button.disabled).toBe(true); button.click(); expect(service.getResueltas).toHaveBeenCalledTimes(1);
  });
  it('pestañas y foco recorren paneles identificados por teclado, sin ejecutar comandos', () => {
    const f = page(), first = f.nativeElement.querySelector('#disciplinary-tab-resolucion') as HTMLButtonElement;
    first.focus(); first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); f.detectChanges();
    const next = f.nativeElement.querySelector('#disciplinary-tab-sancion') as HTMLButtonElement;
    expect(document.activeElement).toBe(next); expect(next.getAttribute('aria-selected')).toBe('true'); expect(f.nativeElement.querySelector('#disciplinary-panel-sancion[role="tabpanel"]')).not.toBeNull();
    expect((f.nativeElement.querySelector('#disciplinary-panel-sancion button') as HTMLButtonElement).disabled).toBe(true); expect(service.getResueltas).toHaveBeenCalledTimes(1);
  });
  it('sin sesión o con rol ajeno no consulta antecedentes institucionales', () => {
    token = ''; const f = page(); expect(f.componentInstance.estadoConsulta()).toBe('autenticacion'); expect(service.getResueltas).not.toHaveBeenCalled();
    token = 'synthetic-session'; vi.spyOn(TestBed.inject(AuthService), 'getTipoUsuario').mockReturnValue('FUNCIONARIO'); cambiosSesion.update(v => v + 1); f.detectChanges();
    expect(f.componentInstance.estadoConsulta()).toBe('autorizacion'); expect(service.getResueltas).not.toHaveBeenCalled();
  });
  it('una sesión ilegible muestra un estado honesto sin iniciar consultas', () => {
    vi.spyOn(TestBed.inject(AuthService), 'getToken').mockImplementation(() => { throw new SyntaxError('synthetic'); });
    const f = page(); expect(f.componentInstance.cases()).toEqual([]); expect(service.getResueltas).not.toHaveBeenCalled();
  });
  it('no acepta respuestas de una sesión que cambió antes de renderizar', () => {
    const pending = new Subject(); service.getResueltas.mockReturnValue(pending); const f = page(); token = 'other-session'; pending.next([appeal]); expect(f.componentInstance.cases()).toEqual([]);
  });
  it('destruir impide reintentar consultas o seleccionar antecedentes', () => {
    const f = page(), c = f.componentInstance, old = c.cases()[0]; f.destroy(); service.getResueltas.mockClear(); c.cargarProcesos(); c.selectCase(old);
    expect(service.getResueltas).not.toHaveBeenCalled(); expect(c.selectedCase()).toBeNull();
  });
  it('conserva la ruta institucional y su guard existente, sin inventar aliases', async () => {
    const route = routes.find(r => r.path === 'ttaip/procesos-disciplinarios')!;
    expect(route.canActivate?.length).toBeGreaterThan(0); expect(await route.loadComponent!()).toBe(ProcesoDisciplinarioComponent);
  });
});

// Real Angular service with simulated HTTP transport; not Spring/security integration.
describe('DisciplinaryProcess — consultas autorizadas del consumidor', () => {
  const api = environment.apiUrl;
  const record = { id: 7, expediente: '00007-2026-JUS/TTAIP', entidadId: 3, entidadNombre: 'Entidad sintética',
    expedienteTtaip: { id: 91, numeroExpediente: '00007-2026-JUS/TTAIP' },
    resolucion: { id: 32, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO_EN_PARTE', iniciarProcesoDisciplinario: true, fechaResolucion: '2026-10-16T12:00:00' } };
  let http: HttpTestingController, token: string; const cambiosSesion = signal(0);
  beforeEach(() => {
    token = 'synthetic-session';
    TestBed.configureTestingModule({ imports: [ProcesoDisciplinarioComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { cambiosSesion, getToken: () => token, getTipoUsuario: () => 'TTAIP', obtenerSesion: () => ({ usuarioId: 4, tipoUsuario: 'TTAIP' }) } }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); } });
  function page() { const f = TestBed.createComponent(ProcesoDisciplinarioComponent); f.detectChanges(); return f; }
  it('utiliza la consulta real de resoluciones y sus IDs sin solicitudes de apertura, remisión o sanción', () => {
    const f = page(), req = http.expectOne(api + '/ttaip/resueltas'); expect(req.request.method).toBe('GET'); req.flush([record]); f.detectChanges();
    expect(f.componentInstance.selectedCaseId()).toBe(32); expect(f.nativeElement.textContent).toContain('FUNDADO EN PARTE');
    for (const tab of ['notificacion', 'descargos', 'sancion'] as const) { f.componentInstance.cambiarTab(tab); f.detectChanges(); const button = f.nativeElement.querySelector('[role="tabpanel"] button') as HTMLButtonElement; expect(button.disabled).toBe(true); button.click(); }
    expect(http.match(() => true)).toHaveLength(0); expect(f.nativeElement.querySelector('input[type="file"],[download],iframe')).toBeNull();
  });
  it.each([400, 401, 403, 404, 422, 500, 0])('error HTTP %s no aparece como ausencia de procedimientos ni filtra información interna', status => {
    const f = page(), req = http.expectOne(api + '/ttaip/resueltas');
    if (status === 0) req.error(new ProgressEvent('error')); else req.flush({ mensaje: 'INTERNAL-SYNTHETIC-DETAIL' }, { status, statusText: 'Synthetic error' });
    f.detectChanges(); expect(f.componentInstance.cases()).toEqual([]); expect(f.componentInstance.estadoConsulta()).not.toBe('vacio');
    expect(f.nativeElement.querySelector('[role="alert"]')).not.toBeNull(); expect(f.nativeElement.textContent).not.toContain('INTERNAL-SYNTHETIC-DETAIL'); expect(f.nativeElement.textContent).not.toContain('Sin indicadores en las resoluciones consultadas');
  });
  it('reintenta el GET fallido y recupera únicamente los datos del servidor', () => {
    const f = page(); http.expectOne(api + '/ttaip/resueltas').flush(null, { status: 503, statusText: 'Unavailable' }); f.detectChanges();
    const retry = [...f.nativeElement.querySelectorAll('button')].find((b: unknown) => (b as HTMLButtonElement).textContent?.includes('Reintentar')) as HTMLButtonElement; retry.click();
    http.expectOne(api + '/ttaip/resueltas').flush([record]); f.detectChanges(); expect(f.componentInstance.error()).toBe(''); expect(f.componentInstance.selectedCase()?.resolucion.id).toBe(32); expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });
  it('una nueva consulta cancela la anterior y no conserva el antecedente anterior ante un error', () => {
    const f = page(), first = http.expectOne(api + '/ttaip/resueltas'); f.componentInstance.cargarProcesos(); const next = http.expectOne(api + '/ttaip/resueltas');
    expect(first.cancelled).toBe(true); next.flush(null, { status: 404, statusText: 'Not found' }); f.detectChanges(); expect(f.componentInstance.selectedCase()).toBeNull();
  });
  it('cambiar sesión cancela el transporte y evita que datos anteriores reaparezcan', () => {
    const f = page(), req = http.expectOne(api + '/ttaip/resueltas'); token = ''; cambiosSesion.update(v => v + 1); f.detectChanges();
    expect(req.cancelled).toBe(true); expect(f.componentInstance.cases()).toEqual([]); expect(f.componentInstance.estadoConsulta()).toBe('autenticacion'); expect(http.match(() => true)).toHaveLength(0);
  });
  it('destruir cancela la consulta sin generar una continuación ni archivos sustitutos', () => {
    const f = page(), req = http.expectOne(api + '/ttaip/resueltas'); f.destroy(); expect(req.cancelled).toBe(true); f.componentInstance.cargarProcesos(); expect(http.match(() => true)).toHaveLength(0);
  });
});
