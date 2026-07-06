import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TtaipDashboardComponent } from './ttaip-dashboard.component';
import { TtaipService } from '../../services/ttaip.service';
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
  let mockTtaipService: any;
  let mockAuthService: any;
  let router: Router;

  const mockApelacionC1 = createMockApelacion(1, 'EN_CALIFICACION_1');
  const mockApelacionResuelta = createMockApelacion(2, 'RESUELTO_FUNDADO');

  beforeEach(() => {
    mockTtaipService = {
      getEnAnalisis: vi.fn().mockReturnValue(of([mockApelacionC1])),
      getSubsanacion: vi.fn().mockReturnValue(of([])),
      getSegundaCalificacion: vi.fn().mockReturnValue(of([])),
      getEnResolucion: vi.fn().mockReturnValue(of([])),
      getResueltas: vi.fn().mockReturnValue(of([mockApelacionResuelta])),
    };

    mockAuthService = {
      obtenerSesion: vi.fn().mockReturnValue({ nombre: 'Tatiana Alvarado' }),
    };
  });

  it('should select stage "resueltos" when focusStage is passed in navigation state', () => {
    TestBed.configureTestingModule({
      imports: [TtaipDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: TtaipService, useValue: mockTtaipService },
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
        { provide: TtaipService, useValue: mockTtaipService },
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
});
