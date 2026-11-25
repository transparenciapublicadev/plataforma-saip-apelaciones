import '@angular/compiler';
import { ComponentFixture, TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { CiudadanoDashboardComponent } from './ciudadano-dashboard.component';
import { PanelQueryService } from '../../services/panel-query.service';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { PanelSolicitud as Solicitud, PanelPage, PanelQuery } from '../../models/panel-query.model';
import { esHabil, hoyLima, PLAZO_META_POR_CLAVE, sumarDias } from '../../models/calendario.model';

try {
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized
}

function toPanelPage(raw: any, query?: Partial<PanelQuery>): any {
  if (raw === null || raw === undefined) return raw;
  if (!Array.isArray(raw)) return raw;
  let contenido = [...raw] as Solicitud[];
  if (query?.etapa && query.etapa !== 'todas') {
    if (query.etapa === 'respondidas') contenido = contenido.filter(i => (i.estado || '').toUpperCase() === 'RESPONDIDA');
    else if (query.etapa === 'apelar') contenido = contenido.filter(i => (i.estado || '').toUpperCase() === 'DENEGADA' || (i.estado || '').toUpperCase() === 'VENCIDA' || (i as any).diasRestantes < 0);
    else if (query.etapa === 'tribunal') contenido = contenido.filter(i => !!i.apelacion);
    else if (query.etapa === 'proceso') contenido = contenido.filter(i => (i.estado || '').toUpperCase() === 'EN_REVISION' || (i.estado || '').toUpperCase() === 'RECEPCIONADA');
  }
  const porEtapa: Record<string, number> = {
    todas: raw.length,
    accion: 0,
    proceso: 0,
    respondidas: 0,
    apelar: 0,
    tribunal: 0,
    resueltas: 0
  };
  const porEstado: Record<string, number> = {};
  for (const item of raw) {
    const est = (item.estado || '').toUpperCase();
    porEstado[est] = (porEstado[est] || 0) + 1;
    const obsPending = item.observaciones?.some((o: any) => o.estado === 'PENDIENTE_SUBSANACION');
    const isAccion = est === 'EN_PRECISION'
      || (est === 'PENDIENTE_INFORMACION' && obsPending)
      || est === 'POR_RECOGER'
      || (item.apelacion?.estado === 'EN_SUBSANACION' && item.apelacion?.plazoSubsanacion?.estado !== 'VENCIDO');
    if (isAccion) porEtapa['accion']++;
    if (est === 'RESPONDIDA') porEtapa['respondidas']++;
    else if (est === 'DENEGADA' || est === 'VENCIDA' || (item as any).diasRestantes < 0) porEtapa['apelar']++;
    else if (item.apelacion) porEtapa['tribunal']++;
    else porEtapa['proceso']++;
  }
  return {
    contenido,
    pagina: query?.pagina ?? 0,
    tamano: query?.tamano ?? 4,
    totalElementos: raw.length,
    totalPaginas: Math.ceil(raw.length / (query?.tamano || 4)),
    ultima: true,
    resumen: {
      total: raw.length,
      porEstado,
      porEtapa,
    },
    entidades: [],
    alcance: 'CIUDADANO'
  };
}

describe('Panel ciudadano — inicio acreditado de subsanación TTAIP', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CiudadanoDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: PanelQueryService, useValue: { solicitudes: vi.fn().mockReturnValue(of(toPanelPage([], { pagina: 0, tamano: 4 }))) } },
        { provide: SolicitudService, useValue: { findById: () => of({ ampliacionesPlazo: [] }) } },
        { provide: AuthService, useValue: { obtenerSesion: () => null, cambiosSesion: signal(0) } },
        { provide: GuidedTourService, useValue: { isOpen: () => false, endTourFor() {}, isFirstVisit: () => false } },
      ],
    }).compileComponents();
  });

  function solicitud(plazo?: NonNullable<Solicitud['apelacion']>['plazoSubsanacion']): Solicitud {
    return { id: 1, expediente: 'SAIP-2026-00001', estado: 'DENEGADA', entidadNombre: 'Entidad sintética',
      asunto: 'Solicitud sintética', fechaRecepcion: '2026-09-01', documentos: [], observaciones: [],
      apelacion: { expediente: '00001-2026-JUS/TTAIP', estado: 'EN_SUBSANACION',
        fechaSubsanacion: '2000-01-01', diasSubsanacion: 2, plazoSubsanacion: plazo } } as unknown as Solicitud;
  }

  it('muestra inicio pendiente y permite consultar subsanación sin inventar vencimiento histórico', () => {
    const f = TestBed.createComponent(CiudadanoDashboardComponent); const c = f.componentInstance;
    const s = solicitud({ requerimientoId: 71, estado: 'PENDIENTE_INICIO', diasHabiles: 2 });
    f.detectChanges(); c.todasSolicitudes.set([s]); c.loading.set(false); c.error.set(''); f.detectChanges();
    expect(c.esSubsanacionVencida(s)).toBe(false);
    expect(c.subsanacionPrincipal()?.dias).toBeNull();
    expect(c.accionPrincipal()?.metricValue).toBe('Pendiente');
    expect(f.nativeElement.textContent).toContain('Plazo pendiente de inicio');
    expect(f.nativeElement.textContent).not.toContain('PLAZO DE SUBSANACIÓN VENCIDO');
  });

  it('mantiene habilitado el último día y respeta el vencimiento expresado por el servidor', () => {
    const c = TestBed.createComponent(CiudadanoDashboardComponent).componentInstance;
    c.todasSolicitudes.set([solicitud({ requerimientoId: 71, estado: 'EN_CURSO', diasHabiles: 2, diasHabilesRestantes: 0 })]);
    expect(c.accionPrincipal()?.ctaLabel).toBe('Completar subsanación');
    expect(c.subsanacionPrincipal()?.vencido).toBe(false);
    const vencida = solicitud({ requerimientoId: 71, estado: 'VENCIDO', diasHabiles: 2, diasHabilesRestantes: -1 });
    c.todasSolicitudes.set([vencida]);
    expect(c.subsanacionPrincipal()?.vencido).toBe(true); expect(c.accionPrincipal()).toBeNull();
    expect(c.filaUrgencia(vencida)?.value).toBe('Vencido');
  });

  it('informa la subsanación registrada y el plazo de la segunda calificación', () => {
    const c = TestBed.createComponent(CiudadanoDashboardComponent).componentInstance;
    const segunda = {
      id: 4, expediente: 'SAIP-2026-10008', estado: 'DENEGADA', entidadNombre: 'Entidad sintética',
      asunto: 'Solicitud sintética', fechaPresentacion: '2026-11-01',
      apelacion: { id: 8, expediente: '00004-2026-JUS/TTAIP', estado: 'EN_CALIFICACION_2', recepcionSubsanacion: hoyLima() },
    } as unknown as Solicitud;
    c.todasSolicitudes.set([segunda]);
    c.selectedSolicitudId.set(4);
    expect(c.ubicacionTramite(segunda).label).toBe('En segunda calificación');
    expect(c.filaUrgencia(segunda)).toMatchObject({
      value: PLAZO_META_POR_CLAVE.TTAIP_CALIFICACION_2.porDefecto,
      unit: 'días hábiles para la segunda calificación',
    });
    expect(c.accionPrincipal()?.titulo).toBe('El Tribunal califica su subsanación');
    expect(c.timelinePrincipal().map(paso => paso.label)).toEqual(expect.arrayContaining(['Subsanación presentada', 'Segunda calificación']));
    const sinFecha = { ...segunda, apelacion: { ...segunda.apelacion!, recepcionSubsanacion: null } } as Solicitud;
    expect(c.filaUrgencia(sinFecha)).toMatchObject({ value: 'En curso', unit: 'segunda calificación' });
    expect(c.timelinePrincipal().map(paso => paso.label)).not.toContain('Tribunal - En Calificacion 2');
  });
});

describe('Panel ciudadano — consultas y presentación verificables', () => {
  let fixture: ComponentFixture<CiudadanoDashboardComponent>;
  let component: CiudadanoDashboardComponent;
  let session: any;
  let revision: ReturnType<typeof signal<number>>;
  let find: any;
  let detalle: any;
  const request = (id = 71, estado: Solicitud['estado'] = 'EN_REVISION'): Solicitud => ({
    id, expediente: `SAIP-2026-${id}`, estado, asunto: `Consulta sintética ${id}`,
    ciudadanoId: 7, entidadId: 4, entidadNombre: 'Entidad sintética', fechaPresentacion: '2026-10-01T09:00:00',
    diasRestantes: 3, documentos: [], observaciones: [],
  } as unknown as Solicitud);

  beforeEach(async () => {
    revision = signal(0);
    session = { ciudadanoId: 7, tipoUsuario: 'CIUDADANO', token: 'synthetic-session-a', nombreCompleto: 'Persona sintética A' };
    find = vi.fn().mockReturnValue(of([request()]));
    detalle = vi.fn().mockReturnValue(of({ ampliacionesPlazo: [] }));
    const panelServiceMock = {
      solicitudes: vi.fn((query: PanelQuery) => {
        const raw = find(session?.ciudadanoId);
        if (!raw) return of(toPanelPage([], query));
        return raw.pipe(map((val: any) => toPanelPage(val, query)));
      })
    };
    await TestBed.configureTestingModule({ imports: [CiudadanoDashboardComponent], providers: [provideRouter([]),
      { provide: PanelQueryService, useValue: panelServiceMock },
      { provide: SolicitudService, useValue: { findById: detalle } },
      { provide: AuthService, useValue: { obtenerSesion: () => session, cambiosSesion: revision } },
      { provide: GuidedTourService, useValue: { isOpen: () => false, endTourFor() {}, isFirstVisit: () => false, checkAutoStart: vi.fn(), startTour: vi.fn() } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(CiudadanoDashboardComponent); component = fixture.componentInstance;
  });

  afterEach(() => { fixture.destroy(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('opens the shared own-profile consultation from the citizen panel, without a local save', () => {
    const open = vi.spyOn(component.profileDialog, 'abrir'); fixture.detectChanges();
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(b => b.textContent?.trim() === 'Mi perfil')!;
    expect(button.disabled).toBe(false); expect(button.getAttribute('aria-haspopup')).toBe('dialog'); button.click(); expect(open).toHaveBeenCalledOnce();
  });

  it('V6: los pasos del ciudadano apuntan a su panel real y no prometen soporte o trazabilidad completos', () => {
    fixture.detectChanges();
    const steps = component.tourSteps();
    for (const step of steps) expect(fixture.nativeElement.querySelectorAll(step.selector)).toHaveLength(1);
    expect(steps.find(step => step.selector === '[data-tour="ayuda"]')!.body).toContain('no disponibles');
    expect(steps.map(step => step.body).join(' ')).not.toContain('trazabilidad completa');
    const start = vi.spyOn(TestBed.inject(GuidedTourService), 'startTour'); component.startTour();
    expect(start).toHaveBeenCalledWith('saip_tour_done', steps);
    const end = vi.spyOn(TestBed.inject(GuidedTourService), 'endTourFor'); fixture.destroy();
    expect(end).toHaveBeenCalledWith('saip_tour_done');
  });

  it('recovers after a failed query without preserving the old error', () => {
    find.mockReturnValueOnce(throwError(() => ({ status: 503 })));
    fixture.detectChanges(); expect(component.error()).not.toBe('');
    component.cargarDatos(); fixture.detectChanges();
    expect(component.error()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('SAIP-2026-71');
  });

  it('does not let a previous reload overwrite the current query', () => {
    const old = new Subject<Solicitud[]>(), current = new Subject<Solicitud[]>();
    find.mockReturnValueOnce(old).mockReturnValueOnce(current);
    fixture.detectChanges(); component.cargarDatos();
    current.next([request(89)]); current.complete(); old.next([request(71)]); old.complete();
    expect(component.todasSolicitudes().map(s => s.id)).toEqual([89]);
  });

  it('clears the previous account and rejects its late result after changing session', () => {
    const old = new Subject<Solicitud[]>(), current = new Subject<Solicitud[]>();
    find.mockReturnValueOnce(old).mockReturnValueOnce(current);
    fixture.detectChanges(); component.globalQuery.set('anterior');
    session = { ...session, ciudadanoId: 8, token: 'synthetic-session-b', nombreCompleto: 'Persona sintética B' };
    revision.update(v => v + 1); fixture.detectChanges();
    expect(find).toHaveBeenLastCalledWith(8);
    expect(component.globalQuery()).toBe('');
    const next = { ...request(89), ciudadanoId: 8 };
    current.next([next]); current.complete(); old.next([request(71)]); old.complete(); fixture.detectChanges();
    expect(component.todasSolicitudes().map(s => s.id)).toEqual([89]);
    expect(fixture.nativeElement.textContent).not.toContain('Persona sintética A');
  });

  it('does not calculate a missing deadline or a percentage from a fixed duration', () => {
    const unknown = { ...request(), diasRestantes: undefined, fechaLimite: '2000-01-01' } as unknown as Solicitud;
    find.mockReturnValue(of([unknown])); fixture.detectChanges();
    expect(component.filaUrgencia(unknown)?.value).toBe('No disponible');
    expect(component.accionPrincipal()?.metricValue).toBe('No disponible');
    expect(fixture.nativeElement.textContent).not.toMatch(/\d+%/);
  });

  it('announces loading without claiming that no requests exist', () => {
    find.mockReturnValue(new Subject<Solicitud[]>()); fixture.detectChanges();
    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Cargando');
    expect(fixture.nativeElement.textContent).not.toContain('no ha presentado solicitudes');
    expect(fixture.nativeElement.textContent).not.toContain('no tiene solicitudes activas');
    expect(fixture.nativeElement.querySelector('[data-tour="resumen"]')).toBeNull();
  });

  it('renders a confirmed empty response without turning it into a query error', () => {
    find.mockReturnValue(of([])); fixture.detectChanges();
    expect(component.error()).toBe(''); expect(component.totalSolicitudes()).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Aún no ha presentado solicitudes');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it.each([
    [0, 'red'], [400, 'validacion'], [401, 'sesion'], [403, 'permiso'], [404, 'inexistente'], [503, 'servidor'],
  ])('distinguishes status %s without showing an empty registry or old data', (status, kind) => {
    fixture.detectChanges();
    find.mockReturnValue(throwError(() => ({ status, error: { message: 'PRIVATE_ERROR_DO_NOT_DISPLAY' } })));
    component.cargarDatos(); fixture.detectChanges();
    expect(component.errorTipo()).toBe(kind);
    expect(component.todasSolicitudes()).toEqual([]);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('SAIP-2026-71');
    expect(fixture.nativeElement.textContent).not.toContain('no ha presentado solicitudes');
    expect(fixture.nativeElement.textContent).not.toContain('PRIVATE_ERROR_DO_NOT_DISPLAY');
  });

  it.each([null, [{ id: 99 }], [{ ...request(), ciudadanoId: 999 }]])('shows incomplete or unrelated payloads as unavailable', payload => {
    find.mockReturnValue(of(payload)); fixture.detectChanges();
    expect(component.errorTipo()).toBe('incompleta');
    expect(component.todasSolicitudes()).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('no ha presentado solicitudes');
  });

  it('derives counts from the authorized records and filters the list without changing resource identity', () => {
    find.mockReturnValue(of([request(), request(89, 'RESPONDIDA')])); fixture.detectChanges();
    expect(find).toHaveBeenCalledWith(7);
    expect(component.pipeline().find(p => p.key === 'todas')?.count).toBe(2);
    expect(component.pipeline().find(p => p.key === 'respondidas')?.count).toBe(1);
    component.resumen.set({ total: 6, porEstado: {}, porEtapa: { accion: 1, proceso: 4, respondidas: 1 }, porResultado: {}, porTipoInformacion: {}, porEntidad: {} });
    component.todasSolicitudes.set([request(), request(72), request(73), request(74)]);
    expect(component.pipeline().find(p => p.key === 'todas')?.count).toBe(6);
    component.selectedStageKey.set('respondidas');
    component.todasSolicitudes.set([request(89, 'RESPONDIDA')]);
    expect(component.pipeline().find(p => p.key === 'todas')?.count).toBe(6);
    expect(component.pipeline().find(p => p.key === 'respondidas')?.count).toBe(1);
    component.selectStage('respondidas'); fixture.detectChanges();
    expect(component.stageVisible().map(s => s.id)).toEqual([89]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const respondida = { ...component.stageVisible()[0], respuesta: { tipoRespuesta: 'ENTREGA_TOTAL', fechaRespuesta: '2026-11-12' } };
    component.todasSolicitudes.set([respondida]);
    component.onPrimary(respondida);
    expect(navigate).not.toHaveBeenCalled();
    expect(component.solicitudPrincipal()?.id).toBe(89);
    const pasos = component.timelinePrincipal().map(paso => paso.label);
    expect(pasos).toContain('Respuesta - Entrega Total');
    expect(pasos).not.toContain('Respuesta registrada');
  });

  it('muestra Plazo ampliado en la lista y en la búsqueda cuando el panel informa la ampliación', () => {
    const ampliada = { ...request(10006, 'EN_REVISION'), plazoAmpliado: true, diasRestantes: 60 };
    const ordinaria = request(10008, 'EN_REVISION');
    find.mockReturnValue(of([ampliada, ordinaria]));
    fixture.detectChanges();
    const fila = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(boton => boton.textContent?.includes('SAIP-2026-10006'));
    expect(fila?.textContent).toContain('Plazo ampliado');
    expect(component.ubicacionTramite(ordinaria).label).toBe('En revisión de la entidad');
    const respondida = { ...ampliada, estado: 'RESPONDIDA' as const, respuesta: { id: 3 } };
    expect(component.estadoInsignia(respondida)).toBe('Respondida');
    const input = fixture.nativeElement.querySelector('[role="combobox"]') as HTMLInputElement;
    input.value = 'sa';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#citizen-result-10006')?.textContent).toContain('Plazo ampliado');
    expect(fixture.nativeElement.querySelector('#citizen-result-10008')?.textContent).toContain('En revisión');
    expect(fixture.nativeElement.querySelector('#citizen-result-10008')?.textContent).not.toContain('Plazo ampliado');
  });

  it('mantiene los días de respuesta de la entidad al seleccionar un plazo ampliado', () => {
    const ampliada = { ...request(10006, 'EN_REVISION'), plazoAmpliado: true, diasRestantes: 60 };
    find.mockReturnValue(of([ampliada]));
    detalle.mockReturnValue(of({
      id: 10006,
      ampliacionesPlazo: [{
        id: 4, solicitudId: 10006, estadoAmpliacion: 'NOTIFICADA',
        fechaLimiteOriginal: '2026-12-04', fechaLimiteAmpliada: '2027-02-04',
        cronograma: [{
          id: 1, ampliacionId: 4, numeroEntrega: 1, descripcion: 'Primer bloque',
          fechaProgramada: hoyLima(), estado: 'ENTREGADA', fechaEntregaReal: hoyLima(),
        }],
      }],
    }));
    fixture.detectChanges();
    fixture.detectChanges();
    const principal = component.solicitudPrincipal();
    expect(component.filaUrgencia(principal!)).toMatchObject({
      value: 60, unit: 'días háb. para que la entidad responda',
    });
    expect(component.accionPrincipal()?.metricValue).toBe('15');
    expect(component.accionPrincipal()?.metricUnit).toBe('días hábiles para apelar');
  });

  it('muestra el plazo prolongado dentro del plazo de la entidad, sin un paso aparte', () => {
    const enRevision = { ...request(10006, 'EN_REVISION'), fechaLimite: '2027-01-20', diasRestantes: 43 };
    find.mockReturnValue(of([enRevision]));
    detalle.mockReturnValue(of({
      id: 10006,
      ampliacionesPlazo: [
        {
          id: 9, solicitudId: 10006, estadoAmpliacion: 'CANCELADA',
          fechaNotificacionAmpliacion: '2026-11-17', fechaLimiteOriginal: '2026-12-01',
          fechaLimiteAmpliada: '2028-01-01', cronograma: [],
        },
        {
          id: 4, solicitudId: 10006, estadoAmpliacion: 'NOTIFICADA',
          fechaNotificacionAmpliacion: '2026-11-16', fechaLimiteOriginal: '2026-12-01',
          fechaLimiteAmpliada: '2027-01-20',
          cronograma: [
            { id: 2, ampliacionId: 4, numeroEntrega: 2, descripcion: 'Cierre', fechaProgramada: '2027-01-20', estado: 'PROGRAMADA' },
            { id: 1, ampliacionId: 4, numeroEntrega: 1, descripcion: 'Primer bloque', fechaProgramada: '2026-12-15', estado: 'ENTREGADA', fechaEntregaReal: '2026-12-15', decision: 'ENTREGA_PARCIAL' },
          ],
        },
      ],
    }));
    fixture.detectChanges();
    fixture.detectChanges();

    const pasos = component.timelinePrincipal();
    const plazo = pasos.filter(paso => paso.key === 'plazo-entidad' || paso.key === 'plazo-prolongado');
    expect(plazo).toEqual([expect.objectContaining({
      key: 'plazo-entidad',
      label: 'Plazo de la entidad',
      status: 'active',
    })]);
    expect(plazo[0].meta).toContain('43 días hábiles');
    expect(plazo[0].meta).toContain('prolongado de 01/12/2026 a 20/01/2027');
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Plazo de la entidad');
    expect(texto).not.toContain('Plazo prolongado');
    expect(texto).toContain('01/12/2026');
    expect(texto).toContain('20/01/2027');
    expect(texto).not.toContain('01/01/2028');
    expect(texto).not.toContain('Comunicado el 16/11/2026');
    expect(texto).not.toContain('Primer bloque');
    expect(texto).not.toContain('Entrega parcial del hito');
  });

  it('cuenta los días hábiles para apelar desde la respuesta registrada', () => {
    const denied = {
      ...request(91, 'DENEGADA'),
      respuesta: { id: 3, tipoRespuesta: 'DENEGACION_TOTAL', fechaRespuesta: hoyLima() },
    } as Solicitud;
    expect(component.filaUrgencia(denied)).toMatchObject({ value: 15, unit: 'días hábiles para apelar' });
    component.todasSolicitudes.set([denied]);
    component.selectedSolicitudId.set(91);
    expect(component.accionPrincipal()?.metricValue).toBe('15');
    expect(component.accionPrincipal()?.metricUnit).toBe('días hábiles para apelar');
  });

  it('supports keyboard result selection, stable option IDs, Escape and focus after clearing', () => {
    fixture.detectChanges();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const input = fixture.nativeElement.querySelector('[role="combobox"]') as HTMLInputElement;
    input.focus(); input.value = 'sintética'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    const active = input.getAttribute('aria-activedescendant');
    expect(active).toBe('citizen-result-71');
    expect(fixture.nativeElement.querySelector('#' + active)).not.toBeNull();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(navigate).toHaveBeenCalledWith(['/ciudadano/solicitud', 'SAIP-2026-71']);
    input.value = 'sintética'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    fixture.nativeElement.querySelector('[aria-label="Limpiar búsqueda"]').click(); fixture.detectChanges();
    expect(document.activeElement).toBe(input); expect(component.globalQuery()).toBe('');
    input.value = 'sintética'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('groups both case numbers before the status in a linked appeal search result', () => {
    const linked = { ...request(71), apelacion: { id: 4, expediente: '00004-2026-JUS/TTAIP', estado: 'EN_CALIFICACION_1' } } as Solicitud;
    find.mockReturnValue(of([linked]));
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('[role="combobox"]') as HTMLInputElement;
    input.value = 'sintética';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('#citizen-result-71') as HTMLElement;
    expect(row.textContent).toMatch(/SAIP-2026-71.*00004-2026-JUS\/TTAIP.*En primera calificación/s);
  });

  it('does not turn a closed request into invented ongoing work or an appeal into a calculated countdown', () => {
    const closed = request(89, 'CONCLUIDA'); find.mockReturnValue(of([closed])); fixture.detectChanges();
    expect(component.accionPrincipal()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('preparando su respuesta');
    const denied = { ...request(91, 'DENEGADA'), fechaLimite: '2000-01-01' };
    component.todasSolicitudes.set([denied]); component.selectedSolicitudId.set(denied.id);
    expect(component.filaUrgencia(denied)?.value).toBe('No disponible');
    expect(component.accionPrincipal()?.metricValue).toBe('No disponible');
  });

  it('keeps the accredited TTAIP clock without requiring a legacy duration', () => {
    const appeal = { ...request(91, 'DENEGADA'), apelacion: { expediente: 'TTAIP-SYNTHETIC-91', estado: 'EN_SUBSANACION',
      plazoSubsanacion: { requerimientoId: 24, estado: 'PENDIENTE_INICIO', diasHabiles: 2 } } } as unknown as Solicitud;
    find.mockReturnValue(of([appeal])); fixture.detectChanges();
    expect(component.pipeline().find(p => p.key === 'accion')?.count).toBe(1);
    expect(component.accionPrincipal()?.metricValue).toBe('Pendiente');
    expect(component.filaUrgencia(appeal)?.unit).toBe('notificación eficaz');
  });
  it('shows the days for first qualification reported for this appeal', () => {
    const appeal = { ...request(91, 'DENEGADA'), apelacion: {
      id: 19, expediente: 'TTAIP-SYNTHETIC-91', estado: 'EN_CALIFICACION_1',
      plazoPrimeraCalificacion: { diasRestantes: 4, vencido: false },
    } } as unknown as Solicitud;
    expect(component.filaUrgencia(appeal)).toMatchObject({ value: 4, unit: 'días hábiles para la primera calificación' });
    const lastDay = { ...appeal, apelacion: { ...appeal.apelacion!, plazoPrimeraCalificacion: { diasRestantes: 1, vencido: false } } };
    expect(component.filaUrgencia(lastDay)?.unit).toBe('día hábil para la primera calificación');
    const expired = { ...appeal, apelacion: { ...appeal.apelacion!, plazoPrimeraCalificacion: { diasRestantes: 0, vencido: true } } };
    expect(component.filaUrgencia(expired)?.value).toBe('Plazo vencido');
    const missing = { ...appeal, apelacion: { ...appeal.apelacion!, plazoPrimeraCalificacion: undefined } };
    expect(component.filaUrgencia(missing)).toMatchObject({ value: 'Por confirmar', unit: 'plazo de primera calificación' });
    const pending = { ...appeal, apelacion: { ...appeal.apelacion!, estado: 'PENDIENTE_ELEVACION' } } as Solicitud;
    expect(component.filaUrgencia(pending)).toMatchObject({ value: 'Pendiente', unit: 'remisión al Tribunal' });
    const decided = { ...appeal, apelacion: { ...appeal.apelacion!, resolucionPrimeraCalificacion: { id: 14 } } };
    expect(component.filaUrgencia(decided)?.value).toBe('En revisión');
  });

  it('distinguishes a missing clock from an explicitly pending start', () => {
    const appeal = { ...request(91, 'DENEGADA'), apelacion: { expediente: 'TTAIP-SYNTHETIC-91', estado: 'EN_SUBSANACION' } } as unknown as Solicitud;
    find.mockReturnValue(of([appeal])); fixture.detectChanges();
    expect(component.accionPrincipal()?.metricValue).toBe('No disponible');
    expect(component.filaUrgencia(appeal)?.value).toBe('No disponible');
    expect(component.subsanacionPrincipal()?.pendiente).toBe(false);
  });

  it('links a recorded pending observation to the existing precision form for that request', () => {
    const observed = { ...request(91, 'PENDIENTE_INFORMACION'), observaciones: [
      { id: 22, solicitudId: 91, estado: 'PENDIENTE_SUBSANACION', descripcion: 'Observación sintética' },
    ] } as unknown as Solicitud;
    find.mockReturnValue(of([observed])); fixture.detectChanges();
    expect(component.pipeline().find(p => p.key === 'accion')?.count).toBe(1);
    expect(component.accionPrincipal()?.route).toEqual(['/ciudadano/precision', 'SAIP-2026-91']);
    expect(component.accionPrincipal()?.metricValue).toBe('Plazo no disponible');
  });

  it('muestra el requerimiento del expediente enfocado sin usar su plazo ordinario ni observaciones ajenas', () => {
    const observed: Solicitud = { ...request(91, 'PENDIENTE_INFORMACION'), diasRestantes: -5,
      fechaLimite: '2026-10-29', observaciones: [
        { id: 21, solicitudId: 99, estado: 'PENDIENTE_SUBSANACION', fechaLimiteSubsanacion: '2026-11-30' },
        { id: 22, solicitudId: 91, estado: 'PENDIENTE_SUBSANACION', fechaObservacion: '2026-10-07',
          fechaLimiteSubsanacion: '2026-10-09', diasRestantes: 2 }
      ] };
    find.mockReturnValue(of([observed, request(92)]));
    fixture.detectChanges();
    component.selectedSolicitudId.set(91);
    fixture.detectChanges();
    const seguimiento = fixture.nativeElement.querySelector('#seccion-timeline');
    expect(seguimiento.textContent).toContain('Debe precisar su solicitud');
    expect(seguimiento.textContent).toContain('Solicitud de precisión');
    expect(seguimiento.textContent).toContain('07/10/2026');
    expect(seguimiento.textContent).toContain('Fecha registrada para precisar: 09/10/2026');
    expect(seguimiento.textContent).not.toMatch(/29\/10\/2026|30\/11\/2026|Plazo de respuesta|Silencio administrativo/);
    expect(seguimiento.querySelector('a[href="/ciudadano/precision/SAIP-2026-91"]')).not.toBeNull();
    expect(component.accionPrincipal()?.metricValue).toBe('2');
    component.selectedSolicitudId.set(92);
    fixture.detectChanges();
    expect(seguimiento.textContent).not.toContain('07/10/2026');
    expect(seguimiento.textContent).toContain('Plazo de respuesta');
  });

  it('distingue una observación subsanada de un requerimiento pendiente y retoma el seguimiento de la entidad', () => {
    find.mockReturnValue(of([{ ...request(91), observaciones: [
      { id: 22, solicitudId: 91, estado: 'SUBSANADA', fechaObservacion: '2026-10-07', fechaSubsanacion: '2026-10-08' }
    ] }]));
    fixture.detectChanges();
    const seguimiento = fixture.nativeElement.querySelector('#seccion-timeline');
    expect(seguimiento.textContent).toContain('Solicitud de precisión');
    expect(seguimiento.textContent).toContain('Precisión registrada');
    expect(seguimiento.textContent).toContain('08/10/2026');
    expect(seguimiento.textContent).toContain('Plazo de respuesta');
    expect(seguimiento.querySelector('a[href*="/ciudadano/precision/"]')).toBeNull();
  });

  it('avisa cuando falta la observación en el resumen sin inventar el paso ni su fecha', () => {
    find.mockReturnValue(of([{ ...request(91, 'PENDIENTE_INFORMACION'), fechaLimite: '2026-10-29' }]));
    fixture.detectChanges();
    const seguimiento = fixture.nativeElement.querySelector('#seccion-timeline');
    expect(seguimiento.textContent).toContain('El requerimiento no está disponible en este resumen');
    expect(seguimiento.querySelector('ol').textContent).not.toContain('Solicitud de precisión');
    expect(seguimiento.textContent).not.toContain('29/10/2026');
    expect(seguimiento.querySelector('a[href*="/ciudadano/precision/"]')).toBeNull();
  });

  it('clears the view on logout and ignores pending callbacks and stale navigation', () => {
    const pending = new Subject<Solicitud[]>();
    fixture.detectChanges(); const old = component.todasSolicitudes()[0];
    find.mockReturnValue(pending); component.cargarDatos();
    session = null; revision.update(v => v + 1); fixture.detectChanges();
    pending.next([old]); pending.complete();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.abrirExpediente(old);
    expect(navigate).not.toHaveBeenCalled(); expect(component.ciudadanoId()).toBe(0);
    expect(component.nombreCompleto()).toBe(''); expect(component.todasSolicitudes()).toEqual([]);
    expect(component.errorTipo()).toBe('sesion'); expect(find).not.toHaveBeenCalledWith(0);
  });

  it('cancels reads when the component is destroyed', () => {
    const pending = new Subject<Solicitud[]>(); find.mockReturnValue(pending);
    fixture.detectChanges(); fixture.destroy(); pending.next([request()]); pending.complete();
    expect(component.todasSolicitudes()).toEqual([]);
  });

  it('labels unavailable profile and contact actions without active demo links', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href^="tel:"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('#profile-readonly')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/ayuda"]')).not.toBeNull();
  });

  it('no muestra botón apelar en hero header y alinea acción secundaria presentar apelación en timeline', () => {
    component.tieneApelables.set(true);
    fixture.detectChanges();
    const heroApelar = Array.from(fixture.nativeElement.querySelectorAll('.citizen-actions a, .citizen-actions button') as NodeListOf<HTMLElement>)
      .find(el => el.textContent?.trim() === 'Apelar');
    expect(heroApelar).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.citizen-actions .animate-ping')).toBeNull();

    const denied = { ...request(95, 'DENEGADA'), apelacion: null } as unknown as Solicitud;
    component.todasSolicitudes.set([denied]);
    component.selectedSolicitudId.set(95);
    fixture.detectChanges();

    expect(component.puedePresentarApelacion(denied)).toBe(true);
    const timelineAppealBtn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(b => b.textContent?.includes('Presentar apelación'));
    expect(timelineAppealBtn).toBeDefined();
    expect(timelineAppealBtn?.classList.contains('btn-ghost-brand')).toBe(true);
    expect(timelineAppealBtn?.classList.contains('bg-amber-600')).toBe(false);

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    timelineAppealBtn?.click();
    expect(navigate).toHaveBeenCalledWith(['/ciudadano/nueva-apelacion'], {
      queryParams: { solicitudId: 95 }
    });

    const vencida = { ...request(96, 'VENCIDA'), apelacion: null } as unknown as Solicitud;
    expect(component.puedePresentarApelacion(vencida)).toBe(true);

    const inProcess = { ...request(97, 'EN_REVISION'), apelacion: null } as unknown as Solicitud;
    expect(component.puedePresentarApelacion(inProcess)).toBe(false);

    const hoy = hoyLima();
    let anterior = sumarDias(hoy, -1);
    while (!esHabil(anterior)) anterior = sumarDias(anterior, -1);
    const ampliada = { ...request(100, 'EN_REVISION'), apelacion: null, diasRestantes: 40, ampliacionesPlazo: [{
      id: 4, solicitudId: 100, estadoAmpliacion: 'NOTIFICADA', fechaLimiteOriginal: anterior, cronograma: []
    }] } as unknown as Solicitud;
    expect(component.puedePresentarApelacion(ampliada)).toBe(true);
    const temprana = { ...request(101, 'EN_REVISION'), apelacion: null, diasRestantes: 40, ampliacionesPlazo: [{
      id: 5, solicitudId: 101, estadoAmpliacion: 'NOTIFICADA', fechaLimiteOriginal: hoy, cronograma: []
    }] } as unknown as Solicitud;
    expect(component.puedePresentarApelacion(temprana)).toBe(false);

    const sanRequest = { ...request(96, 'EN_REVISION'), diasRestantes: -60, apelacion: null } as unknown as Solicitud;
    expect(component.puedePresentarApelacion(sanRequest)).toBe(true);

    const responded = { ...request(98, 'RESPONDIDA'), apelacion: null } as unknown as Solicitud;
    expect(component.puedePresentarApelacion(responded)).toBe(false);

    const alreadyAppealed = { ...request(99, 'DENEGADA'), apelacion: { id: 12, expediente: 'TTAIP-0012' } } as unknown as Solicitud;
    expect(component.puedePresentarApelacion(alreadyAppealed)).toBe(false);

    expect(component.puedePresentarApelacion(null)).toBe(false);
  });

  it('aplica silencio administrativo negativo y no muestra saldo defensivo cuando el plazo legal ha vencido', () => {
    const sanRequest = {
      ...request(100, 'EN_REVISION'),
      diasRestantes: -60,
      fechaLimite: '2026-08-01',
      apelacion: null
    } as unknown as Solicitud;

    expect(component.esSilencioAdministrativo(sanRequest)).toBe(true);
    expect(component.puedePresentarApelacion(sanRequest)).toBe(true);

    const urgencia = component.filaUrgencia(sanRequest);
    expect(urgencia).toMatchObject({ value: 'Plazo vencido', unit: 'silencio administrativo negativo' });
    expect(urgencia?.unit).not.toContain('saldo');
    expect(String(urgencia?.value)).not.toContain('-60');

    component.todasSolicitudes.set([sanRequest]);
    component.selectedSolicitudId.set(100);
    const accion = component.accionPrincipal();
    expect(accion?.ctaLabel).toBe('Apelar al Tribunal');
    expect(['plazo perentorio', 'días para apelar']).toContain(accion?.metricUnit);
    expect(accion?.metricValue).toBe('Sin');

    const timeline = (component as any).buildTimeline(sanRequest);
    const sanStep = timeline.find((t: any) => t.key === 'plazo-entidad');
    expect(sanStep?.label).toBe('Plazo vencido - SAN');
    expect(sanStep?.meta).toContain('Silencio administrativo negativo');
    expect(timeline.some((t: any) => (t.meta || '').includes('saldo'))).toBe(false);

    expect(component.pipeline().find(p => p.key === 'apelar')?.count).toBe(1);
    expect(component.pipeline().find(p => p.key === 'proceso')?.count).toBe(0);
  });

  it('muestra unidades oficiales y limpias de plazos sin texto de saldo en solicitudes en proceso', () => {
    const enProceso5 = { ...request(101, 'EN_REVISION'), diasRestantes: 5 } as unknown as Solicitud;
    const urgencia5 = component.filaUrgencia(enProceso5);
    expect(urgencia5?.value).toBe(5);
    expect(urgencia5?.unit).toBe('días háb. para que la entidad responda');

    const enProceso1 = { ...request(102, 'EN_REVISION'), diasRestantes: 1 } as unknown as Solicitud;
    const urgencia1 = component.filaUrgencia(enProceso1);
    expect(urgencia1?.value).toBe(1);
    expect(urgencia1?.unit).toBe('día háb. para que la entidad responda');

    const precision = { ...request(103, 'PENDIENTE_INFORMACION') } as unknown as Solicitud;
    const urgenciaPrec = component.filaUrgencia(precision);
    expect(urgenciaPrec?.value).toBe('Plazo no disponible');
    expect(urgenciaPrec?.unit).toBe('solicitud de precisión');
  });

  it('usa los días de la observación vinculada y no el plazo ordinario de respuesta', () => {
    const solicitud: Solicitud = { ...request(101, 'PENDIENTE_INFORMACION'), diasRestantes: 9, observaciones: [
      { id: 71, solicitudId: 102, estado: 'PENDIENTE_SUBSANACION', diasRestantes: 5 },
      { id: 72, solicitudId: 101, estado: 'PENDIENTE_SUBSANACION', diasRestantes: 1 }
    ] };
    expect(component.filaUrgencia(solicitud)).toMatchObject({
      value: 1, unit: 'día hábil para precisar', nota: 'Según la fecha registrada'
    });
  });

  it('distingue el último día para precisar, el vencimiento y el archivo registrado', () => {
    const solicitud: Solicitud = { ...request(101, 'PENDIENTE_INFORMACION'),
      diasRestantes: -9, observaciones: [{ id: 72, solicitudId: 101, estado: 'PENDIENTE_SUBSANACION', diasRestantes: 0 }] };
    expect(component.filaUrgencia(solicitud)).toMatchObject({ value: 'Último día', unit: 'para precisar' });
    const vencida = { ...solicitud, observaciones: [{ ...solicitud.observaciones![0], diasRestantes: -1 }] };
    expect(component.filaUrgencia(vencida)).toMatchObject({ value: 'Fecha registrada vencida', unit: 'precisión pendiente' });
    expect(component.puedePresentarApelacion(vencida)).toBe(false);
    const archivada: Solicitud = { ...vencida, estado: 'CONCLUIDA',
      observaciones: [{ ...vencida.observaciones![0], estado: 'NO_SUBSANADA' }] };
    expect(component.filaUrgencia(archivada)).toMatchObject({ value: 'Archivada', unit: 'sin precisión presentada' });
    expect(component.puedePresentarApelacion(archivada)).toBe(false);
  });

  it('muestra Último día para responder cuando Spring informa cero y mantiene abierta la solicitud', () => {
    const solicitud = { ...request(103), diasRestantes: 0, fechaLimite: '2026-10-29' };
    find.mockReturnValue(of([solicitud]));
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('#seccion-timeline');
    expect(component.filaUrgencia(solicitud)).toMatchObject({ value: 'Último día', unit: 'para que la entidad responda' });
    expect(panel.textContent).toContain('Último día');
    expect(panel.textContent).not.toMatch(/0 días hábiles|Plazo vencido/);
    expect(component.puedePresentarApelacion(solicitud)).toBe(false);
  });

  it('incluye EN_PRECISION, POR_RECOGER y ENCAUZADA en solicitudesActivas y excluye solicitudes históricas respondidas', () => {
    const prec = { ...request(201, 'EN_PRECISION' as any), id: 201 } as unknown as Solicitud;
    const recoger = { ...request(202, 'POR_RECOGER' as any), id: 202, diasRestantes: 20 } as unknown as Solicitud;
    const encauzada = { ...request(203, 'ENCAUZADA' as any), id: 203 } as unknown as Solicitud;
    const enRevision = { ...request(204, 'EN_REVISION'), id: 204 } as unknown as Solicitud;
    const denegada = { ...request(205, 'DENEGADA'), id: 205 } as unknown as Solicitud;
    const vencida = { ...request(206, 'VENCIDA'), id: 206 } as unknown as Solicitud;
    const respondida = { ...request(207, 'RESPONDIDA'), id: 207, apelacion: null } as unknown as Solicitud;

    component.todasSolicitudes.set([prec, recoger, encauzada, enRevision, denegada, vencida, respondida]);

    const activas = component.solicitudesActivas();
    const activasIds = activas.map(s => s.id);

    // Verify all active lifecycle states are included
    expect(activasIds).toContain(201); // EN_PRECISION
    expect(activasIds).toContain(202); // POR_RECOGER
    expect(activasIds).toContain(203); // ENCAUZADA
    expect(activasIds).toContain(204); // EN_REVISION
    expect(activasIds).toContain(205); // DENEGADA
    expect(activasIds).toContain(206); // VENCIDA

    // Verify historical respondida without appeal is excluded
    expect(activasIds).not.toContain(207);
    expect(activas.length).toBe(6);
  });

  it('prioriza EN_PRECISION (score 110) en solicitudPrincipal y accionPrincipal sobre solicitudes en proceso y en apelación', () => {
    const reqRevisionUrgente = { ...request(210, 'EN_REVISION'), id: 210, diasRestantes: 1 } as unknown as Solicitud; // Score 60
    const reqApelacionEnResolucion = {
      ...request(211, 'DENEGADA'),
      id: 211,
      apelacion: { id: 80, expediente: '00080-2026-JUS/TTAIP', estado: 'EN_RESOLUCION' } as any
    } as unknown as Solicitud; // Score 25
    const reqPorRecoger = { ...request(212, 'POR_RECOGER' as any), id: 212, diasRestantes: 15 } as unknown as Solicitud; // Score 70
    const reqPrecision: Solicitud = { ...request(213, 'PENDIENTE_INFORMACION'), expediente: 'SAIP-2026-00213',
      observaciones: [{ id: 52, solicitudId: 213, estado: 'PENDIENTE_SUBSANACION' }] };

    component.selectedSolicitudId.set(null);
    component.todasSolicitudes.set([reqRevisionUrgente, reqApelacionEnResolucion, reqPorRecoger, reqPrecision]);

    // Solicitud principal must strictly pick EN_PRECISION (score 110)
    expect(component.solicitudPrincipal()?.id).toBe(213);

    // Accion principal must build the precision urgent action card
    const accion = component.accionPrincipal();
    expect(accion).not.toBeNull();
    expect(accion?.ctaLabel).toBe('Revisar precisión');
    expect(accion?.eyebrow).toBe('Subsanación · 1ª instancia (entidad)');
    expect(accion?.route).toEqual(['/ciudadano/precision', 'SAIP-2026-00213']);
  });
});

