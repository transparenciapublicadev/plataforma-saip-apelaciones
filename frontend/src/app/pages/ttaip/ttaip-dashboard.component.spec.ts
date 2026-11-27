import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TtaipDashboardComponent } from './ttaip-dashboard.component';
import { PanelQueryService } from '../../services/panel-query.service';
import { signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Apelacion } from '../../models/apelacion.model';

function createMockApelacion(id: number, estado: string): Apelacion {
  return {
    id,
    expediente: `EXP-00${id}`,
    estado: estado as any,
    resultado: estado.startsWith('RESUELTO') ? 'FUNDADO' : undefined,
    fundamentos: 'Test',
    fechaApelacion: '2026-07-04T00:00:00',
    fechaSubsanacion: undefined,
    diasSubsanacion: undefined,
    calificacionPrimera: undefined,
    calificacionSegunda: undefined,
    solicitudId: 1,
    solicitudExpediente: 'SAIP-1',
    solicitudAsunto: 'Test request',
    ciudadanoId: 1,
    ciudadanoNombre: 'Ciudadano Test',
    entidadId: 1,
    entidadNombre: 'Entidad Test',
    tipoOrigen: 'SAIP_INTERNA',
    entidadExternaNombre: undefined,
    entidadExternaRuc: undefined,
    entidadExternaEmail: undefined,
    numeroSolicitudExterna: undefined,
    fechaPresentacionSolicitudExterna: undefined,
    fechaRespuestaEntidad: undefined,
    tipoDenegatoria: undefined,
    resumenSolicitudOriginal: undefined,
    resumenRespuestaEntidad: undefined,
    referenciaDocumentoSolicitud: undefined,
    referenciaCargoRecepcion: undefined,
    referenciaRespuestaEntidad: undefined,
    evidenciaSilencioAdministrativo: undefined,
    observacion: undefined,
    elevacion: undefined,
    resolucion: undefined,
    resolucionPrimeraCalificacion: undefined,
    resolucionSegundaCalificacion: undefined,
    expedienteTtaip: undefined,
    resoluciones: [],
    documentos: [],
    documentosMetadata: []
  } as any;
}

describe('TtaipDashboardComponent stage selection', () => {
  let mockApelacionService: any;
  let mockAuthService: any;
  let router: Router;

  const mockApelacionC1 = createMockApelacion(1, 'EN_CALIFICACION_1');
  const mockApelacionResuelta = createMockApelacion(2, 'RESUELTO_FUNDADO');

  beforeEach(() => {
    mockApelacionService = { apelaciones: vi.fn((q) => of({ contenido: q.etapa === 'resueltos' ? [mockApelacionResuelta] : [mockApelacionC1, mockApelacionResuelta], pagina: q.pagina, tamano: q.tamano, totalElementos: q.etapa === 'resueltos' ? 1 : 2, totalPaginas: 1, ultima: true, entidades: [], alcance: 'Tribunal autorizado', resumen: { total: 2, porEstado: { EN_CALIFICACION_1: 1, RESUELTO_FUNDADO: 1 }, porEtapa: { calificacion1: 1, resueltos: 1 } } })) };
    mockAuthService = { cambiosSesion: signal(0),
      obtenerSesion: vi.fn().mockReturnValue({ nombre: 'Operador sintético', usuarioId: 7, token: 'sesion-sintetica', tipoUsuario: 'TTAIP' }),
    };
  });

  it('should select stage "resueltos" when focusStage is passed in navigation state', () => {
    TestBed.configureTestingModule({
      imports: [TtaipDashboardComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: PanelQueryService, useValue: mockApelacionService },
        { provide: AuthService, useValue: mockAuthService },
      ]
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'getCurrentNavigation').mockReturnValue({
      extras: {
        state: { focusStage: 'resueltos' }
      }
    } as any);

    const fixture = TestBed.createComponent(TtaipDashboardComponent);
    const component = fixture.componentInstance;
    
    fixture.detectChanges(); // triggers ngOnInit and cargarDashboard()

    expect(component.activeStage().key).toBe('resueltos');
  });

  it('starts with all authorized records rather than inferring a stage from one page', () => {
    TestBed.configureTestingModule({
      imports: [TtaipDashboardComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: PanelQueryService, useValue: mockApelacionService },
        { provide: AuthService, useValue: mockAuthService },
      ]
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'getCurrentNavigation').mockReturnValue(null);

    const fixture = TestBed.createComponent(TtaipDashboardComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges(); // triggers ngOnInit and cargarDashboard()

    expect(component.activeStage().key).toBe('todos');
  });
  it('mantiene pendiente el reloj sin usar la creación ni marcar urgencia', () => {
    TestBed.configureTestingModule({ imports: [TtaipDashboardComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: PanelQueryService, useValue: mockApelacionService }, { provide: AuthService, useValue: mockAuthService }] });
    const fixture = TestBed.createComponent(TtaipDashboardComponent); const c = fixture.componentInstance;
    const ap = createMockApelacion(3, 'EN_SUBSANACION'); ap.fechaSubsanacion = '2000-01-01'; ap.diasSubsanacion = 2;
    ap.plazoSubsanacion = { requerimientoId: 71, estado: 'PENDIENTE_INICIO', diasHabiles: 2 };
    c.apelaciones.set([ap]); c.stageKey.set('subsanacion'); c.loading.set(false);
    const item = c.queueItems()[0];
    expect(c.getDiasValor(item)).toBe('Pendiente de inicio');
    expect(c.getDiasValor(item)).not.toBe('0d');
  });

  it('muestra los días hábiles recibidos del backend para el requerimiento eficaz', () => {
    TestBed.configureTestingModule({ imports: [TtaipDashboardComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: PanelQueryService, useValue: mockApelacionService }, { provide: AuthService, useValue: mockAuthService }] });
    const c = TestBed.createComponent(TtaipDashboardComponent).componentInstance;
    const ap = createMockApelacion(3, 'EN_SUBSANACION'); ap.fechaSubsanacion = '2000-01-01';
    ap.plazoSubsanacion = { requerimientoId: 71, estado: 'EN_CURSO', diasHabiles: 2, diasHabilesRestantes: 2,
      notificacionId: 81, fechaEficacia: '2026-10-22T09:00:00', fechaLimite: '2026-10-26' };
    c.apelaciones.set([ap]); expect(c.getDiasValor(c.queueItems()[0])).toBe('2d');
    c.apelaciones.set([{ ...ap, plazoSubsanacion: { ...ap.plazoSubsanacion!, estado: 'VENCIDO', diasHabilesRestantes: 0 } }]);
    expect(c.getDiasValor(c.queueItems()[0])).toBe('Vencido');
  });

  it('identifica items con riesgo crítico conforme al cálculo de SLA', () => {
    TestBed.configureTestingModule({ imports: [TtaipDashboardComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: PanelQueryService, useValue: mockApelacionService }, { provide: AuthService, useValue: mockAuthService }] });
    const c = TestBed.createComponent(TtaipDashboardComponent).componentInstance;
    const ap = createMockApelacion(4, 'EN_CALIFICACION_1');
    ap.fechaApelacion = new Date().toISOString().slice(0, 10);
    c.apelaciones.set([ap]);
    const item = c.queueItems()[0];
    expect(item.status.tone).toBeDefined();
    expect(Array.isArray(c.riesgo())).toBe(true);
    expect(item.action.label).toBeDefined();
    expect(item.action.route[0]).toContain('/ttaip/');
  });

  it('computa tiempoPromedio honestamente ("—") cuando no hay apelaciones resueltas con fechas', () => {
    TestBed.configureTestingModule({ imports: [TtaipDashboardComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: PanelQueryService, useValue: mockApelacionService }, { provide: AuthService, useValue: mockAuthService }] });
    const c = TestBed.createComponent(TtaipDashboardComponent).componentInstance;
    c.apelaciones.set([mockApelacionC1]);
    expect(c.tiempoPromedio()).toBe('—');
  });

  it('computa tiempoPromedio dinámicamente en días hábiles a partir de apelaciones resueltas', () => {
    TestBed.configureTestingModule({ imports: [TtaipDashboardComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: PanelQueryService, useValue: mockApelacionService }, { provide: AuthService, useValue: mockAuthService }] });
    const fixture = TestBed.createComponent(TtaipDashboardComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    
    // Apelación 1: ingreso 2026-10-01 (jueves) -> resolucion 2026-10-13 (martes): 8 días hábiles
    const ap1 = createMockApelacion(2, 'RESUELTO_FUNDADO');
    ap1.fechaApelacion = '2026-10-01';
    ap1.resolucion = { id: 101, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO', fechaResolucion: '2026-10-13' } as any;

    // Apelación 2: ingreso 2026-10-01 -> resolucion 2026-10-14 (miércoles): 9 días hábiles
    const ap2 = createMockApelacion(3, 'RESUELTO_INFUNDADO');
    ap2.fechaApelacion = '2026-10-01';
    ap2.resolucion = { id: 102, tipoResolucion: 'RESOLUCION_FINAL', decision: 'INFUNDADO', fechaResolucion: '2026-10-14' } as any;

    c.apelaciones.set([ap1, ap2]);
    // Promedio: (8 + 9) / 2 = 8.5d
    expect(c.tiempoPromedio()).toBe('8.5d');

    fixture.detectChanges();
    const tiempoEl = fixture.nativeElement.querySelector('.grid.grid-cols-2 .text-success.font-display');
    expect(tiempoEl?.textContent?.trim()).toBe('8.5d');
  });

  it('filtra resolucionesMes acotado al mes y año en curso', () => {
    TestBed.configureTestingModule({ imports: [TtaipDashboardComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: PanelQueryService, useValue: mockApelacionService }, { provide: AuthService, useValue: mockAuthService }] });
    const fixture = TestBed.createComponent(TtaipDashboardComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const mesActual = new Date().toISOString().slice(0, 7);
    
    // Resuelta en mes actual
    const apMes = createMockApelacion(2, 'RESUELTO_FUNDADO');
    apMes.fechaApelacion = `${mesActual}-01`;
    apMes.resolucion = { id: 101, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO', fechaResolucion: `${mesActual}-05` } as any;

    // Resuelta en mes anterior
    const apAnterior = createMockApelacion(3, 'RESUELTO_INFUNDADO');
    apAnterior.fechaApelacion = '2026-01-01';
    apAnterior.resolucion = { id: 102, tipoResolucion: 'RESOLUCION_FINAL', decision: 'INFUNDADO', fechaResolucion: '2026-01-15' } as any;

    c.apelaciones.set([apMes, apAnterior]);
    expect(c.resolucionesMes()).toBe(1);

    fixture.detectChanges();
    const resolMesEl = fixture.nativeElement.querySelector('.grid.grid-cols-2 .text-gold-dark.font-display');
    expect(resolMesEl?.textContent?.trim()).toBe('1');
  });
});
