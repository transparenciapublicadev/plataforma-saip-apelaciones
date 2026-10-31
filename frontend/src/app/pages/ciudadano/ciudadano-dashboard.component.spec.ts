import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { CiudadanoDashboardComponent } from './ciudadano-dashboard.component';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { Solicitud } from '../../models/solicitud.model';

describe('Panel ciudadano — inicio acreditado de subsanación TTAIP', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [CiudadanoDashboardComponent], providers: [provideRouter([]),
    { provide: SolicitudService, useValue: {} }, { provide: ApelacionService, useValue: {} },
    { provide: AuthService, useValue: { obtenerSesion: () => null, cambiosSesion: signal(0) } },
    { provide: GuidedTourService, useValue: { isOpen: () => false, endTourFor() {}, isFirstVisit: () => false } }] }));

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
});

describe('Panel ciudadano — consultas y presentación verificables', () => {
  let fixture: ComponentFixture<CiudadanoDashboardComponent>;
  let component: CiudadanoDashboardComponent;
  let session: any;
  let revision: ReturnType<typeof signal<number>>;
  let find: ReturnType<typeof vi.fn>;
  const request = (id = 71, estado: Solicitud['estado'] = 'EN_REVISION'): Solicitud => ({
    id, expediente: `SAIP-2026-${id}`, estado, asunto: `Consulta sintética ${id}`,
    ciudadanoId: 7, entidadId: 4, entidadNombre: 'Entidad sintética', fechaPresentacion: '2026-10-01T09:00:00',
    diasRestantes: 3, documentos: [], observaciones: [],
  } as unknown as Solicitud);

  beforeEach(async () => {
    revision = signal(0);
    session = { ciudadanoId: 7, tipoUsuario: 'CIUDADANO', token: 'synthetic-session-a', nombreCompleto: 'Persona sintética A' };
    find = vi.fn().mockReturnValue(of([request()]));
    await TestBed.configureTestingModule({ imports: [CiudadanoDashboardComponent], providers: [provideRouter([]),
      { provide: SolicitudService, useValue: { findByCiudadanoId: find } },
      { provide: ApelacionService, useValue: { findByCiudadanoId: vi.fn().mockReturnValue(of([])) } },
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
    component.selectStage('respondidas'); fixture.detectChanges();
    expect(component.stageVisible().map(s => s.id)).toEqual([89]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.onPrimary(component.stageVisible()[0]);
    expect(navigate).toHaveBeenCalledWith(['/ciudadano/solicitud', 'SAIP-2026-89']);
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
    expect(component.accionPrincipal()?.metricValue).toBe('Consultar');
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
    expect(urgencia?.unit).toBe('días para apelar');
    expect(urgencia?.unit).not.toContain('saldo');
    expect(String(urgencia?.value)).not.toContain('-60');

    component.todasSolicitudes.set([sanRequest]);
    component.selectedSolicitudId.set(100);
    const accion = component.accionPrincipal();
    expect(accion?.ctaLabel).toBe('Apelar al Tribunal');
    expect(accion?.detalle).toContain('silencio administrativo negativo');
    expect(accion?.metricUnit).toBe('días para apelar');

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
    expect(urgenciaPrec?.value).toBe(2);
    expect(urgenciaPrec?.unit).toBe('días háb. para precisar');
  });
});

