import '@angular/compiler';
import '../../../test-setup';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FuncionarioDashboardComponent } from './funcionario-dashboard.component';
import { FuncionarioResponderComponent } from './funcionario-responder.component';
import { FuncionarioSolicitudDetalleComponent } from './funcionario-solicitud-detalle.component';
import { SolicitudService } from '../../services/solicitud.service';
import { FuncionarioService } from '../../services/funcionario.service';
import { RespuestaService } from '../../services/respuesta.service';
import { DocumentoService } from '../../services/documento.service';
import { EntidadService } from '../../services/entidad.service';
import { AuthService } from '../../services/auth.service';
import { PanelQueryService } from '../../services/panel-query.service';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';
import { PanelPage, PanelSolicitud } from '../../models/panel-query.model';
import { Solicitud, LiquidacionCostoSolicitud } from '../../models/solicitud.model';
import { BucketKey, queueItem } from './funcionario-dashboard.model';

describe('Adversarial Challenger M3 — Behavioral & Legal Constraints Stress Suite', () => {
  const api = environment.apiUrl;

  const mockAuthService = {
    obtenerSesion: vi.fn(() => ({
      success: true,
      token: 'jwt-token-test',
      usuarioId: 7,
      funcionarioId: 7,
      tipoUsuario: 'FUNCIONARIO',
      entidadId: 3,
      entidadNombre: 'Entidad de Prueba',
      nombre: 'Funcionario Certificado'
    })),
    cambiosSesion: vi.fn(() => 1),
    guardarSesion: vi.fn()
  };

  describe('1. SLA Trays Empty Disabled State and aria-labels Guarding', () => {
    let http: HttpTestingController;

    const session = {
      success: true,
      token: 'sesion-sintetica-entidad',
      usuarioId: 7,
      funcionarioId: 7,
      tipoUsuario: 'FUNCIONARIO',
      entidadId: 3,
      entidadNombre: 'Entidad sintética',
      nombre: 'Operador sintético'
    };

    const sampleRow: PanelSolicitud = {
      id: 101,
      expediente: 'SAIP-2026-00101',
      ciudadanoId: 1,
      entidadId: 3,
      entidadNombre: 'Entidad sintética',
      ciudadanoNombre: 'Persona sintética',
      ciudadanoDni: '12345678',
      asunto: 'Asunto sintético',
      estado: 'EN_REVISION',
      diasRestantes: 3,
      fechaPresentacion: '2026-10-01T10:00:00',
      fechaLimite: '2026-11-01',
      respuesta: null,
      observaciones: [],
      prioridad: 'MEDIA',
      tipoInformacion: 'Información general'
    };

    function mockPanelPage(items: PanelSolicitud[] = [], override: Partial<PanelPage<PanelSolicitud>> = {}): PanelPage<PanelSolicitud> {
      const size = override.tamano ?? 4;
      const page = override.pagina ?? 0;
      const total = override.totalElementos ?? items.length;
      const totalPaginas = Math.ceil(total / size);
      const porEstado: Record<string, number> = {
        RECEPCIONADA: 0, EN_REVISION: 0, PENDIENTE_INFORMACION: 0,
        RESPONDIDA: 0, DENEGADA: 0, CONCLUIDA: 0, VENCIDA: 0
      };
      const porEtapa: Record<string, number> = {
        san: 0, hoy: 0, semana: 0, plazo: 0, respondidas: 0
      };
      for (const it of items) {
        if (it.estado) porEstado[it.estado] = (porEstado[it.estado] || 0) + 1;
        const q = queueItem(it);
        porEtapa[q.bucket] = (porEtapa[q.bucket] || 0) + 1;
      }
      return {
        contenido: items,
        pagina: page,
        tamano: size,
        totalElementos: total,
        totalPaginas,
        ultima: totalPaginas === 0 || page >= totalPaginas - 1,
        resumen: {
          total,
          porEstado,
          porEtapa,
          porTipoInformacion: { 'Información general': items.length },
          porDiasRestantes: { '3': items.length }
        },
        entidades: [{ id: 3, nombre: 'Entidad sintética', total }],
        alcance: 'ENTIDAD',
        ...override
      };
    }

    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
      TestBed.configureTestingModule({
        imports: [FuncionarioDashboardComponent],
        providers: [
          provideRouter([]),
          provideHttpClient(withInterceptors([authInterceptor])),
          provideHttpClientTesting(),
          {
            provide: GuidedTourService,
            useValue: {
              checkAutoStart() {},
              endTourFor() {},
              isFirstVisit: () => false,
              startTour() {}
            }
          }
        ]
      });
      http = TestBed.inject(HttpTestingController);
      TestBed.inject(AuthService).guardarSesion(session);
    });

    afterEach(() => {
      try {
        http.verify({ ignoreCancelled: true });
      } finally {
        TestBed.resetTestingModule();
        localStorage.clear();
        sessionStorage.clear();
      }
    });

    function createDashboardPage() {
      const f = TestBed.createComponent(FuncionarioDashboardComponent);
      f.detectChanges();
      for (const req of http.match(`${api}/funcionarios/7`)) {
        req.flush({
          id: 7,
          entidadId: 3,
          entidadNombre: 'Entidad sintética',
          nombreCompleto: 'Operador sintético',
          activo: true
        });
      }
      return f;
    }

    it('disables every tray, including precision, when the entity has no requests', () => {
      const f = createDashboardPage();
      const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
      req.flush(mockPanelPage([])); // Zero items
      f.detectChanges();

      const buttons = f.nativeElement.querySelectorAll('[data-tour="e-buckets"] button');
      expect([...buttons].some((button: HTMLButtonElement) => button.textContent.includes('En precisión'))).toBe(true);

      buttons.forEach((btn: HTMLButtonElement) => {
        expect(btn.disabled).toBe(true);
      });
    });

    it('empirically verifies aria-label includes ": sin solicitudes" for empty trays and null for active ones', () => {
      const f = createDashboardPage();
      const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
      // sampleRow is in bucket 'semana' (diasRestantes: 3)
      req.flush(mockPanelPage([sampleRow]));
      f.detectChanges();

      const buttons = f.nativeElement.querySelectorAll('[data-tour="e-buckets"] button');
      // Tray 1: san (Vencidas) -> count 0
      const btnSan = [...buttons].find((b: any) => b.textContent.includes('Vencidas')) as HTMLButtonElement;
      expect(btnSan).toBeTruthy();
      expect(btnSan.disabled).toBe(true);
      expect(btnSan.getAttribute('aria-label')).toContain('sin solicitudes');

      // Tray 2: hoy (Hoy o mañana) -> count 0
      const btnHoy = [...buttons].find((b: any) => b.textContent.includes('Hoy o mañana')) as HTMLButtonElement;
      expect(btnHoy).toBeTruthy();
      expect(btnHoy.disabled).toBe(true);
      expect(btnHoy.getAttribute('aria-label')).toContain('sin solicitudes');

      const btnPrecision = [...buttons].find((button: HTMLButtonElement) =>
        button.textContent.includes('En precisión')) as HTMLButtonElement;
      expect(btnPrecision.disabled).toBe(true);
      expect(btnPrecision.getAttribute('aria-label')).toBe('En precisión: sin solicitudes');

      // Tray 3: semana (Esta semana) -> count 1 (active)
      const btnSemana = [...buttons].find((b: any) => b.textContent.includes('Esta semana')) as HTMLButtonElement;
      expect(btnSemana).toBeTruthy();
      expect(btnSemana.disabled).toBe(false);
      expect(btnSemana.getAttribute('aria-label')).toBeNull();

      // Tray 0: todas -> count 1 (active)
      const btnTodas = [...buttons].find((b: any) => b.textContent.includes('Todas las solicitudes')) as HTMLButtonElement;
      expect(btnTodas).toBeTruthy();
      expect(btnTodas.disabled).toBe(false);
      expect(btnTodas.getAttribute('aria-label')).toBeNull();
    });

    it('adversarially stress tests selectBucket: clicking an empty tray never switches bucket or triggers redundant queries', () => {
      const f = createDashboardPage();
      const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
      req.flush(mockPanelPage([sampleRow]));
      f.detectChanges();

      expect(f.componentInstance.selectedBucket()).toBe('todas');

      // Attempt to invoke selectBucket on empty buckets
      f.componentInstance.selectBucket('san');
      expect(f.componentInstance.selectedBucket()).toBe('todas');
      http.expectNone(r => r.url === `${api}/panel/solicitudes`);

      f.componentInstance.selectBucket('hoy');
      expect(f.componentInstance.selectedBucket()).toBe('todas');
      http.expectNone(r => r.url === `${api}/panel/solicitudes`);

      f.componentInstance.selectBucket('plazo');
      expect(f.componentInstance.selectedBucket()).toBe('todas');
      http.expectNone(r => r.url === `${api}/panel/solicitudes`);

      f.componentInstance.selectBucket('respondidas');
      expect(f.componentInstance.selectedBucket()).toBe('todas');
      http.expectNone(r => r.url === `${api}/panel/solicitudes`);

      // In contrast, invoking on non-empty bucket 'semana' switches bucket and triggers query
      f.componentInstance.selectBucket('semana');
      expect(f.componentInstance.selectedBucket()).toBe('semana');
      const reqSemana = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
      expect(reqSemana.request.params.get('etapa')).toBe('semana');
      reqSemana.flush(mockPanelPage([sampleRow]));
    });
  });

  describe('2. Prórroga: disponibilidad informada por Spring', () => {
    let mockSolicitudes: { findByExpediente: ReturnType<typeof vi.fn>; preverAmpliacion: ReturnType<typeof vi.fn>; registrarAmpliacion: ReturnType<typeof vi.fn> };
    let mockRespuestas: { registrarConDocumentos: ReturnType<typeof vi.fn>; getCausalesDenegacion: ReturnType<typeof vi.fn> };

    const baseSolicitud = {
      id: 12,
      expediente: 'SAIP-2026-00012',
      entidadId: 3,
      entidadNombre: 'Entidad de Prueba',
      asunto: 'Solicitud de prueba',
      estado: 'EN_REVISION',
      diasRestantes: 7,
      fechaPresentacion: '2026-11-01',
      fechaLimite: '2026-11-15',
      respuesta: null,
      observaciones: [],
      documentosMetadata: [],
      ampliacionesPlazo: [],
      encauzamientos: [],
      liquidacionesCosto: []
    } as unknown as Solicitud;

    beforeEach(async () => {
      vi.clearAllMocks();
      mockSolicitudes = {
        findByExpediente: vi.fn().mockReturnValue(of(baseSolicitud)),
        preverAmpliacion: vi.fn().mockImplementation((_id, dias) => of({
          hoy: '2026-11-17', fechaMaximaComunicacion: '2026-11-19',
          fechaLimiteAmpliada: dias === 8 ? '2026-12-10' : '2026-12-04',
          disponible: true, requiereCronograma: dias > 30
        })),
        registrarAmpliacion: vi.fn().mockReturnValue(of({}))
      };
      mockRespuestas = {
        registrarConDocumentos: vi.fn(),
        getCausalesDenegacion: vi.fn().mockReturnValue(of([]))
      };

      await TestBed.configureTestingModule({
        imports: [FuncionarioResponderComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ expediente: 'SAIP-2026-00012' })) } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: SolicitudService, useValue: mockSolicitudes },
          { provide: RespuestaService, useValue: mockRespuestas },
          { provide: EntidadService, useValue: { findActivas: () => of([]) } },
          { provide: DocumentoService, useValue: { upload: vi.fn() } },
          { provide: AuthService, useValue: mockAuthService }
        ]
      }).compileComponents();
    });

    it('solo habilita el envío después de recibir la previsión del expediente', () => {
      const fixture = TestBed.createComponent(FuncionarioResponderComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      expect(comp.prorrogaPermitida()).toBe(false);
      comp.setVia('prorroga');
      fixture.detectChanges();
      expect(mockSolicitudes.preverAmpliacion).toHaveBeenCalledWith(12, 5);
      expect(comp.prorrogaPermitida()).toBe(true);
      expect(comp.fechaLimiteProrroga()).toBe('2026-11-19');
    });

    it('muestra el rechazo de disponibilidad sin abrir el modal ni registrar', () => {
      mockSolicitudes.preverAmpliacion.mockReturnValue(of({
        hoy: '2026-11-20', fechaMaximaComunicacion: '2026-11-19', disponible: false, requiereCronograma: false
      }));
      const fixture = TestBed.createComponent(FuncionarioResponderComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      comp.setVia('prorroga');
      comp.prorrogaMotivo = 'Búsqueda exhaustiva en archivos descentralizados';
      fixture.detectChanges();
      fixture.detectChanges();
      comp.handleSubmit();
      expect(comp.confirmModalAbierto()).toBe(false);
      expect(mockSolicitudes.registrarAmpliacion).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('La solicitud ya no admite una ampliación');
    });
  });

  describe('3. Structured Hitos Array Validation & Boundaries', () => {
    let mockSolicitudes: { findByExpediente: ReturnType<typeof vi.fn>; preverAmpliacion: ReturnType<typeof vi.fn>; registrarAmpliacion: ReturnType<typeof vi.fn> };
    let mockRespuestas: { registrarConDocumentos: ReturnType<typeof vi.fn>; getCausalesDenegacion: ReturnType<typeof vi.fn> };

    const baseSolicitud = {
      id: 12,
      expediente: 'SAIP-2026-00012',
      entidadId: 3,
      entidadNombre: 'Entidad de Prueba',
      asunto: 'Solicitud con cronograma',
      estado: 'EN_REVISION',
      diasRestantes: 8,
      fechaPresentacion: '2026-11-13',
      fechaLimite: '2026-11-10',
      respuesta: null,
      observaciones: [],
      documentosMetadata: [],
      ampliacionesPlazo: [],
      encauzamientos: [],
      liquidacionesCosto: []
    } as unknown as Solicitud;

    beforeEach(async () => {
      vi.clearAllMocks();
      mockSolicitudes = {
        findByExpediente: vi.fn().mockReturnValue(of(baseSolicitud)),
        preverAmpliacion: vi.fn().mockImplementation((_id, dias) => of({
          hoy: '2026-11-17', fechaMaximaComunicacion: '2026-11-19',
          fechaLimiteAmpliada: dias === 8 ? '2026-12-10' : '2026-12-04',
          disponible: true, requiereCronograma: dias > 30
        })),
        registrarAmpliacion: vi.fn().mockReturnValue(of({}))
      };
      mockRespuestas = {
        registrarConDocumentos: vi.fn(),
        getCausalesDenegacion: vi.fn().mockReturnValue(of([]))
      };

      await TestBed.configureTestingModule({
        imports: [FuncionarioResponderComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ expediente: 'SAIP-2026-00012' })) } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: SolicitudService, useValue: mockSolicitudes },
          { provide: RespuestaService, useValue: mockRespuestas },
          { provide: EntidadService, useValue: { findActivas: () => of([]) } },
          { provide: DocumentoService, useValue: { upload: vi.fn() } },
          { provide: AuthService, useValue: mockAuthService }
        ]
      }).compileComponents();
    });

    it('empirically verifies adding, updating and removing hitos with lower bound protection', () => {
      const fixture = TestBed.createComponent(FuncionarioResponderComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      expect(comp.hitos().length).toBe(1);

      comp.agregarHito();
      expect(comp.hitos().length).toBe(2);

      comp.agregarHito();
      expect(comp.hitos().length).toBe(3);

      comp.quitarHito(1);
      expect(comp.hitos().length).toBe(2);

      // Attempt to remove down to zero: must stay at 1
      comp.quitarHito(0);
      expect(comp.hitos().length).toBe(1);
      comp.quitarHito(0);
      expect(comp.hitos().length).toBe(1); // Protected minimum of 1 hito
    });

    it('empirically verifies date validations: past dates and dates beyond nuevaFechaLimite produce errors', () => {
      const fixture = TestBed.createComponent(FuncionarioResponderComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      comp.setVia('prorroga');
      comp.prorrogaDias = '5';
      comp.prorrogaMotivo = 'Búsqueda exhaustiva en archivos descentralizados';
      comp.usarCronograma.set(true);
      fixture.detectChanges();

      const limite = comp.nuevaFechaLimite();
      expect(limite).not.toBeNull();
      const fecha = fixture.nativeElement.querySelector('input[aria-label="Fecha de la entrega 1"]') as HTMLInputElement | null;
      expect(fecha).not.toBeNull();
      expect(fecha!.max).toBe(limite);
      comp.prorrogaDias = '8';
      expect(comp.nuevaFechaLimite()).toBeNull();
      fixture.detectChanges();
      const ampliado = comp.nuevaFechaLimite();
      expect(ampliado).not.toBeNull();
      expect(ampliado! > limite!).toBe(true);
      comp.prorrogaDias = '5';
      fixture.detectChanges();

      // Subtest A: Hito with date in the past
      comp.hitos.set([{ fecha: '2020-01-01', entregable: 'Entrega en el pasado' }]);
      expect(comp.errorHitos()).toBe('Esta entrega no puede ser anterior a hoy.');
      expect(comp.canSubmit()).toBe(false);

      // Subtest B: Hito with date beyond computed nuevaFechaLimite
      const farFutureDate = '2099-12-31';
      comp.hitos.set([{ fecha: farFutureDate, entregable: 'Entrega muy tardía' }]);
      expect(comp.errorHitos()).toContain('Las entregas deben programarse hasta la nueva fecha límite');
      expect(comp.canSubmit()).toBe(false);

      // Subtest C: Hito with valid date within limit and valid deliverable
      comp.hitos.set([{ fecha: limite!, entregable: 'Entrega dentro de plazo ampliado' }]);
      expect(comp.errorHitos()).toBeNull();
      expect(comp.canSubmit()).toBe(true);
    });

    it('adversarially stress tests empty deliverable strings blocking behavior', () => {
      const fixture = TestBed.createComponent(FuncionarioResponderComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      comp.setVia('prorroga');
      comp.prorrogaDias = '5';
      comp.prorrogaMotivo = 'Búsqueda exhaustiva en archivos descentralizados';
      comp.usarCronograma.set(true);
      fixture.detectChanges();

      const limite = comp.nuevaFechaLimite()!;

      // Case 1: Empty deliverable string on single hito blocks submission
      comp.hitos.set([{ fecha: limite, entregable: '' }]);
      expect(comp.errorHitos()).toBe('Registre al menos una entrega con fecha y descripción.');
      expect(comp.canSubmit()).toBe(false);

      // Case 2: Whitespace-only deliverable string blocks submission
      comp.hitos.set([{ fecha: limite, entregable: '     ' }]);
      expect(comp.errorHitos()).toBe('Registre al menos una entrega con fecha y descripción.');
      expect(comp.canSubmit()).toBe(false);

      // Case 3: Empty date on single hito blocks submission
      comp.hitos.set([{ fecha: '', entregable: 'Descripción válida' }]);
      expect(comp.errorHitos()).toBe('Registre al menos una entrega con fecha y descripción.');
      expect(comp.canSubmit()).toBe(false);

      // Verified remediation: When multiple hitos exist and any has an empty or whitespace deliverable,
      // errorHitos() reports incomplete entries and blocks submission.
      comp.hitos.set([
        { fecha: '2026-11-25', entregable: 'Primera parte válida' },
        { fecha: limite, entregable: '' } // second hito empty
      ]);
      expect(comp.hitosValidos().length).toBe(1);
      expect(comp.errorHitos()).toBe('Complete la fecha y entregable de cada hito agregado o elimine los hitos vacíos.');
      expect(comp.canSubmit()).toBe(false);

      // Whitespace deliverable on second hito
      comp.hitos.set([
        { fecha: '2026-11-25', entregable: 'Primera parte válida' },
        { fecha: limite, entregable: '   ' }
      ]);
      expect(comp.errorHitos()).toBe('Complete la fecha y entregable de cada hito agregado o elimine los hitos vacíos.');
      expect(comp.canSubmit()).toBe(false);

      // Missing date on second hito
      comp.hitos.set([
        { fecha: '2026-11-25', entregable: 'Primera parte válida' },
        { fecha: '', entregable: 'Segunda entrega válida' }
      ]);
      expect(comp.errorHitos()).toBe('Complete la fecha y entregable de cada hito agregado o elimine los hitos vacíos.');
      expect(comp.canSubmit()).toBe(false);

      // Both hitos complete and valid
      comp.hitos.set([
        { fecha: '2026-11-25', entregable: 'Primera parte válida' },
        { fecha: limite, entregable: 'Segunda entrega válida' }
      ]);
      expect(comp.errorHitos()).toBeNull();
      expect(comp.canSubmit()).toBe(true);
    });
  });

  describe('4. Physical Delivery Recojo Workflow & 30-Day Expiration Archiving', () => {
    let mockSolicitudes: {
      findByExpediente: ReturnType<typeof vi.fn>;
      obtenerSeguimientoPlazo: ReturnType<typeof vi.fn>;
      actualizarLiquidacion: ReturnType<typeof vi.fn>;
      cambiarEstado: ReturnType<typeof vi.fn>;
    };

    const activeLiquidacion = {
      id: 55,
      solicitudId: 12,
      expediente: 'SAIP-2026-00012',
      codigoLiquidacion: 'LIQ-2026-00055',
      monto: '3.50',
      moneda: 'PEN',
      concepto: '35 copias simples',
      fechaEmision: '2026-11-01',
      fechaNotificacion: '2026-11-01',
      fechaLimiteRecojo: '2099-12-31', // Active, not expired
      medioNotificacion: 'CASILLA_ELECTRONICA',
      estadoLiquidacion: 'EMITIDA'
    } as unknown as LiquidacionCostoSolicitud;

    const expiredLiquidacion = {
      id: 60,
      solicitudId: 12,
      expediente: 'SAIP-2026-00012',
      codigoLiquidacion: 'LIQ-2026-00060',
      monto: '5.00',
      moneda: 'PEN',
      concepto: '50 copias simples',
      fechaEmision: '2026-09-01',
      fechaNotificacion: '2026-09-01',
      fechaLimiteRecojo: '2026-10-01', // Expired (> 30 calendar days ago)
      medioNotificacion: 'CASILLA_ELECTRONICA',
      estadoLiquidacion: 'EMITIDA'
    } as unknown as LiquidacionCostoSolicitud;

    const baseSolicitud = {
      id: 12,
      expediente: 'SAIP-2026-00012',
      entidadId: 3,
      entidadNombre: 'Entidad de Prueba',
      asunto: 'Solicitud con entrega física',
      estado: 'EN_REVISION',
      diasRestantes: 5,
      fechaPresentacion: '2026-10-01',
      respuesta: null,
      observaciones: [],
      documentosMetadata: [],
      ampliacionesPlazo: [],
      encauzamientos: [],
      liquidacionesCosto: [activeLiquidacion, expiredLiquidacion]
    } as unknown as Solicitud;

    beforeEach(async () => {
      vi.clearAllMocks();
      mockSolicitudes = {
        findByExpediente: vi.fn().mockReturnValue(of(baseSolicitud)),
        obtenerSeguimientoPlazo: vi.fn().mockReturnValue(of({} as any)),
        actualizarLiquidacion: vi.fn().mockReturnValue(of({} as any)),
        cambiarEstado: vi.fn().mockReturnValue(of({} as any))
      };

      await TestBed.configureTestingModule({
        imports: [FuncionarioSolicitudDetalleComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ expediente: 'SAIP-2026-00012' }) } } },
        { provide: SolicitudService, useValue: mockSolicitudes },
        { provide: DocumentoService, useValue: { upload: vi.fn(() => of({ id: 1 })), download: vi.fn() } },
        { provide: AuthService, useValue: mockAuthService },
        { provide: EntidadService, useValue: { findActivas: () => of([]) } }
        ]
      }).compileComponents();
    });

    it('empirically enforces that confirming recojo requires BOTH voucher and ID document', () => {
      const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      const dummyFile1 = new File(['voucher'], 'voucher.pdf', { type: 'application/pdf' });
      const dummyFile2 = new File(['dni'], 'dni.jpg', { type: 'image/jpeg' });
      const dummyCargo = new File(['cargo'], 'cargo.pdf', { type: 'application/pdf' });
      const mensaje = 'Adjunte el cargo de entrega, la foto del comprobante de pago y la copia del DNI de quien recibe.';

      comp.archivoCargo.set(null);
      comp.archivoComprobante.set(null);
      comp.archivoIdentidad.set(null);
      comp.confirmarRecojoFisico(activeLiquidacion);
      expect(comp.liquidacionError()).toBe(mensaje);
      expect(mockSolicitudes.actualizarLiquidacion).not.toHaveBeenCalled();

      comp.archivoComprobante.set(dummyFile1);
      comp.archivoIdentidad.set(null);
      comp.confirmarRecojoFisico(activeLiquidacion);
      expect(comp.liquidacionError()).toBe(mensaje);
      expect(mockSolicitudes.actualizarLiquidacion).not.toHaveBeenCalled();

      comp.archivoComprobante.set(null);
      comp.archivoIdentidad.set(dummyFile2);
      comp.confirmarRecojoFisico(activeLiquidacion);
      expect(comp.liquidacionError()).toBe(mensaje);
      expect(mockSolicitudes.actualizarLiquidacion).not.toHaveBeenCalled();

      comp.archivoCargo.set(null);
      comp.archivoComprobante.set(dummyFile1);
      comp.archivoIdentidad.set(dummyFile2);
      comp.confirmarRecojoFisico(activeLiquidacion);
      expect(comp.liquidacionError()).toBe(mensaje);
      expect(mockSolicitudes.actualizarLiquidacion).not.toHaveBeenCalled();

      comp.archivoCargo.set(dummyCargo);
      comp.archivoComprobante.set(dummyFile1);
      comp.archivoIdentidad.set(dummyFile2);
      comp.confirmarRecojoFisico(activeLiquidacion);
      expect(mockSolicitudes.actualizarLiquidacion).toHaveBeenCalledWith(12, 55, expect.objectContaining({
        estado: 'RECOGIDA'
      }));
      expect(mockSolicitudes.cambiarEstado).not.toHaveBeenCalled();
      expect(comp.archivoCargo()).toBeNull();
      expect(comp.archivoComprobante()).toBeNull();
      expect(comp.archivoIdentidad()).toBeNull();
    });

    it('empirically verifies 30-day expiration detection and documents archiving legal reason omission', () => {
      const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      // Verification of isRecojoVencido oracle
      expect(comp.isRecojoVencido(activeLiquidacion)).toBe(false);
      expect(comp.isRecojoVencido(expiredLiquidacion)).toBe(true);

      // Mount expired liquidation into component
      comp.solicitud.set({
        ...baseSolicitud,
        liquidacionesCosto: [expiredLiquidacion]
      });

      mockSolicitudes.actualizarLiquidacion.mockReturnValue(of({
        id: 60,
        solicitudId: 12,
        estadoLiquidacion: 'CANCELADA'
      } as any));

      // Verified remediation: Setting motivoArchivo to 'NO_RECOJO' and calling archivarLiquidacion
      // sends observacion with statutory 30-day description and sets confirmation message.
      comp.motivoArchivo.set('NO_RECOJO');
      comp.archivarLiquidacion(expiredLiquidacion);

      expect(mockSolicitudes.actualizarLiquidacion).toHaveBeenCalledWith(12, 60, expect.objectContaining({
        estado: 'CANCELADA',
        responsable: 'Funcionario Certificado',
        observacion: 'No recogió la información — Vencimiento de 30 días calendario'
      }));
      expect(comp.liquidacionSuccess()).toBe('Liquidación archivada por vencimiento del plazo de 30 días.');

      // Verify alternative legal ground: SIN_ACREDITACION_DE_PAGO
      comp.motivoArchivo.set('SIN_ACREDITACION_DE_PAGO');
      comp.archivarLiquidacion(expiredLiquidacion);
      expect(mockSolicitudes.actualizarLiquidacion).toHaveBeenCalledWith(12, 60, expect.objectContaining({
        estado: 'CANCELADA',
        responsable: 'Funcionario Certificado',
        observacion: 'No acreditó el pago — Vencimiento de 30 días calendario'
      }));
    });
  });

  describe('5. Appeal Advice Text: Strict Legal Requirement ("15 días hábiles", not "calendario")', () => {
    let mockSolicitudes: { findByExpediente: ReturnType<typeof vi.fn>; registrarAmpliacion: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      vi.clearAllMocks();
      mockSolicitudes = {
        findByExpediente: vi.fn().mockReturnValue(of({
          id: 12,
          expediente: 'SAIP-2026-00012',
          entidadId: 3,
          asunto: 'Consulta apelación',
          estado: 'EN_REVISION',
          diasRestantes: 5,
          fechaPresentacion: '2026-11-01',
          respuesta: null,
          observaciones: [],
          documentosMetadata: [],
          ampliacionesPlazo: [],
          encauzamientos: [],
          liquidacionesCosto: []
        } as unknown as Solicitud)),
        registrarAmpliacion: vi.fn()
      };

      await TestBed.configureTestingModule({
        imports: [FuncionarioResponderComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ expediente: 'SAIP-2026-00012' })) } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: SolicitudService, useValue: mockSolicitudes },
          { provide: RespuestaService, useValue: { registrarConDocumentos: vi.fn(), getCausalesDenegacion: () => of([]) } },
          { provide: EntidadService, useValue: { findActivas: () => of([]) } },
          { provide: DocumentoService, useValue: { upload: vi.fn() } },
          { provide: AuthService, useValue: mockAuthService }
        ]
      }).compileComponents();
    });

    it('empirically verifies appeal advice text asserts "15 días hábiles" and never mentions "calendario" in appeal context', () => {
      const fixture = TestBed.createComponent(FuncionarioResponderComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      // 1. In denegación total: notificacion oficial detail
      comp.decision.set('denegacion_total');
      const notifDenegacion = comp.respuestaWarning();
      expect(notifDenegacion.detail).toContain('15 días hábiles');
      expect(notifDenegacion.detail.toLowerCase()).not.toContain('calendario');

      // 2. In denegación total: next steps list hint
      const nextStepsDenegacion = comp.respuestaNextSteps();
      const appealStepDenegacion = nextStepsDenegacion.find((s: { label: string; hint?: string }) => s.hint?.includes('15 días'));
      expect(appealStepDenegacion).toBeDefined();
      expect(appealStepDenegacion!.hint).toBe('15 días hábiles');
      expect(appealStepDenegacion!.hint!.toLowerCase()).not.toContain('calendario');

      // 3. In entrega total/parcial: next steps list hint
      comp.decision.set('entrega_total');
      const nextStepsEntrega = comp.respuestaNextSteps();
      const appealStepEntrega = nextStepsEntrega.find((s: { label: string; hint?: string }) => s.hint?.includes('15 días'));
      expect(appealStepEntrega).toBeDefined();
      expect(appealStepEntrega!.hint).toBe('15 días hábiles para apelar');
      expect(appealStepEntrega!.hint!.toLowerCase()).not.toContain('calendario');

      // 4. In DOM template: normative advice list
      const templateText = fixture.nativeElement.textContent;
      expect(templateText).toContain('15 días hábiles corresponde a la apelación por una respuesta expresa');
      expect(templateText).not.toContain('15 días calendario ante el TTAIP');
    });
  });
});
