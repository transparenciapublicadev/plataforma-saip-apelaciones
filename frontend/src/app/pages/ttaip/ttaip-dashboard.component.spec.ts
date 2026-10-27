import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TtaipDashboardComponent } from './ttaip-dashboard.component';
import { ApelacionService } from '../../services/apelacion.service';
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
    mockApelacionService = { findAll: vi.fn(() => of([mockApelacionC1, mockApelacionResuelta])) };
    mockAuthService = { cambiosSesion: signal(0),
      obtenerSesion: vi.fn().mockReturnValue({ nombre: 'Operador sintético', usuarioId: 7, token: 'sesion-sintetica', tipoUsuario: 'TTAIP' }),
    };
  });

  it('should select stage "resueltos" when focusStage is passed in navigation state', () => {
    TestBed.configureTestingModule({
      imports: [TtaipDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: ApelacionService, useValue: mockApelacionService },
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

  it('should select the first stage with data (calificacion1) under normal navigation', () => {
    TestBed.configureTestingModule({
      imports: [TtaipDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: ApelacionService, useValue: mockApelacionService },
        { provide: AuthService, useValue: mockAuthService },
      ]
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'getCurrentNavigation').mockReturnValue(null);

    const fixture = TestBed.createComponent(TtaipDashboardComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges(); // triggers ngOnInit and cargarDashboard()

    expect(component.activeStage().key).toBe('calificacion1');
  });
  it('mantiene pendiente el reloj sin usar la creación ni marcar urgencia', () => {
    TestBed.configureTestingModule({ imports: [TtaipDashboardComponent], providers: [provideRouter([]),
      { provide: ApelacionService, useValue: mockApelacionService }, { provide: AuthService, useValue: mockAuthService }] });
    const fixture = TestBed.createComponent(TtaipDashboardComponent); const c = fixture.componentInstance;
    const ap = createMockApelacion(3, 'EN_SUBSANACION'); ap.fechaSubsanacion = '2000-01-01'; ap.diasSubsanacion = 2;
    ap.plazoSubsanacion = { requerimientoId: 71, estado: 'PENDIENTE_INICIO', diasHabiles: 2 };
    c.apelaciones.set([ap]); c.stageKey.set('subsanacion'); c.loading.set(false);
    const item = c.queueItems()[0];
    expect(c.getDiasValor(item)).toBe('Pendiente de inicio');
    expect(c.getDiasValor(item)).not.toBe('0d');
  });

  it('muestra los días hábiles recibidos del backend para el requerimiento eficaz', () => {
    TestBed.configureTestingModule({ imports: [TtaipDashboardComponent], providers: [provideRouter([]),
      { provide: ApelacionService, useValue: mockApelacionService }, { provide: AuthService, useValue: mockAuthService }] });
    const c = TestBed.createComponent(TtaipDashboardComponent).componentInstance;
    const ap = createMockApelacion(3, 'EN_SUBSANACION'); ap.fechaSubsanacion = '2000-01-01';
    ap.plazoSubsanacion = { requerimientoId: 71, estado: 'EN_CURSO', diasHabiles: 2, diasHabilesRestantes: 2,
      notificacionId: 81, fechaEficacia: '2026-10-22T09:00:00', fechaLimite: '2026-10-26' };
    c.apelaciones.set([ap]); expect(c.getDiasValor(c.queueItems()[0])).toBe('2d');
    expect(c.apelaciones()[0].fechaSubsanacion).toBe('2000-01-01');
    c.apelaciones.set([{ ...ap, plazoSubsanacion: { ...ap.plazoSubsanacion!, estado: 'VENCIDO', diasHabilesRestantes: 0 } }]);
    expect(c.getDiasValor(c.queueItems()[0])).toBe('Vencido');
  });

});
