import '@angular/compiler';
import { ComponentFixture, TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { CiudadanoDashboardComponent } from './ciudadano-dashboard.component';
import { NuevaSaipComponent } from './nueva-saip.component';
import { ReferenceSuccessModalComponent } from '../../shared/reference-success-modal.component';
import { ReferenceConfirmModalComponent } from '../../shared/reference-confirm-modal.component';
import { PanelQueryService } from '../../services/panel-query.service';
import { AuthService } from '../../services/auth.service';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { SolicitudService } from '../../services/solicitud.service';
import { EntidadService } from '../../services/entidad.service';
import { PanelSolicitud as Solicitud, PanelPage, PanelQuery } from '../../models/panel-query.model';

try {
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized
}

function toPanelPage(raw: any, query?: Partial<PanelQuery>): any {
  if (raw === null || raw === undefined) return raw;
  if (!Array.isArray(raw)) return raw;
  const contenido = [...raw] as Solicitud[];
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

function createSyntheticSolicitud(
  id: number,
  estado: string,
  extra: Partial<Solicitud> = {}
): Solicitud {
  return {
    id,
    expediente: `SAIP-2026-${String(id).padStart(5, '0')}`,
    estado,
    asunto: `Asunto sintético ${id}`,
    ciudadanoId: 7,
    entidadId: 4,
    entidadNombre: 'Ministerio de Justicia y Derechos Humanos',
    fechaPresentacion: '2026-10-01T09:00:00',
    diasRestantes: 5,
    documentos: [],
    observaciones: [],
    ...extra
  } as unknown as Solicitud;
}

describe('CHALLENGER STRESS-TEST — Milestone 2: Ciudadano Portal Parity', () => {
  let fixture: ComponentFixture<CiudadanoDashboardComponent>;
  let component: CiudadanoDashboardComponent;
  let session: any;
  let revision: ReturnType<typeof signal<number>>;
  let currentBackendList: Solicitud[] = [];

  beforeEach(async () => {
    revision = signal(0);
    session = {
      ciudadanoId: 7,
      tipoUsuario: 'CIUDADANO',
      token: 'synthetic-jwt-token-m2',
      nombreCompleto: 'Juan Pérez García'
    };
    currentBackendList = [];

    const panelServiceMock = {
      solicitudes: vi.fn((query: PanelQuery) => {
        let items = [...currentBackendList];
        if (query.busqueda) {
          const q = query.busqueda.toLowerCase();
          items = items.filter(s => (s.asunto || '').toLowerCase().includes(q) || (s.expediente || '').toLowerCase().includes(q));
        }
        return of(toPanelPage(items, query));
      })
    };

    await TestBed.configureTestingModule({
      imports: [CiudadanoDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: PanelQueryService, useValue: panelServiceMock },
        { provide: AuthService, useValue: { obtenerSesion: () => session, getToken: () => 'synthetic-jwt-token-m2', cambiosSesion: revision } },
        { provide: GuidedTourService, useValue: { isOpen: () => false, endTourFor() {}, isFirstVisit: () => false, checkAutoStart: vi.fn(), startTour: vi.fn() } },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CiudadanoDashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
    // Clean up any leaked portal elements in document.body
    document.body.querySelectorAll('.reference-modal-host').forEach(el => el.remove());
  });

  // =========================================================================
  // 1. URGENT ACTION SELECTION & PRIORITY LADDER
  // =========================================================================
  describe('1. Urgent Action Selection & Priority Ladder', () => {

    it('(1A-Score) EN_PRECISION (score 110) strictly beats any other request type in the raw priority score ladder', () => {
      const precisionReq = createSyntheticSolicitud(1, 'EN_PRECISION');
      const obsPrecisionReq = createSyntheticSolicitud(2, 'PENDIENTE_INFORMACION', {
        observaciones: [{ id: 10, solicitudId: 2, estado: 'PENDIENTE_SUBSANACION', descripcion: 'Aclarar periodo' }] as any
      });
      const ttaipSubsanacion1d = createSyntheticSolicitud(3, 'DENEGADA', {
        apelacion: {
          expediente: '00001-2026-JUS/TTAIP',
          estado: 'EN_SUBSANACION',
          plazoSubsanacion: { requerimientoId: 1, estado: 'EN_CURSO', diasHabiles: 2, diasHabilesRestantes: 1 }
        } as any
      });
      const ttaipSubsanacion0d = createSyntheticSolicitud(4, 'DENEGADA', {
        apelacion: {
          expediente: '00002-2026-JUS/TTAIP',
          estado: 'EN_SUBSANACION',
          plazoSubsanacion: { requerimientoId: 2, estado: 'EN_CURSO', diasHabiles: 2, diasHabilesRestantes: 0 }
        } as any
      });
      const denegadaConPlazo = createSyntheticSolicitud(5, 'DENEGADA', { diasRestantes: 1 });
      const sanVencida = createSyntheticSolicitud(6, 'VENCIDA');
      const porRecoger = createSyntheticSolicitud(7, 'POR_RECOGER', { diasRestantes: 20 });
      const enProceso2d = createSyntheticSolicitud(8, 'EN_REVISION', { diasRestantes: 1 });
      const enProceso10d = createSyntheticSolicitud(9, 'RECEPCIONADA', { diasRestantes: 9 });
      const respondida = createSyntheticSolicitud(10, 'RESPONDIDA');
      const tribunalEnTramite = createSyntheticSolicitud(11, 'DENEGADA', {
        apelacion: { expediente: '00003-2026-JUS/TTAIP', estado: 'EN_RESOLUCION' } as any
      });

      const scorePrecision = (component as any).calcularUrgenciaSolicitud(precisionReq);
      const scoreObsPrecision = (component as any).calcularUrgenciaSolicitud(obsPrecisionReq);
      const scoreTtaip1d = (component as any).calcularUrgenciaSolicitud(ttaipSubsanacion1d);
      const scoreTtaip0d = (component as any).calcularUrgenciaSolicitud(ttaipSubsanacion0d);
      const scoreDenegada = (component as any).calcularUrgenciaSolicitud(denegadaConPlazo);
      const scoreSan = (component as any).calcularUrgenciaSolicitud(sanVencida);
      const scorePorRecoger = (component as any).calcularUrgenciaSolicitud(porRecoger);
      const scoreEnProceso2d = (component as any).calcularUrgenciaSolicitud(enProceso2d);
      const scoreEnProceso10d = (component as any).calcularUrgenciaSolicitud(enProceso10d);
      const scoreRespondida = (component as any).calcularUrgenciaSolicitud(respondida);
      const scoreTribunal = (component as any).calcularUrgenciaSolicitud(tribunalEnTramite);

      expect(scorePrecision).toBe(110);
      expect(scoreObsPrecision).toBe(110);

      // Verify that score 110 strictly beats all other scores
      expect(scorePrecision).toBeGreaterThan(scoreTtaip1d);
      expect(scorePrecision).toBeGreaterThan(scoreTtaip0d);
      expect(scorePrecision).toBeGreaterThan(scoreDenegada);
      expect(scorePrecision).toBeGreaterThan(scoreSan);
      expect(scorePrecision).toBeGreaterThan(scorePorRecoger);
      expect(scorePrecision).toBeGreaterThan(scoreEnProceso2d);
      expect(scorePrecision).toBeGreaterThan(scoreEnProceso10d);
      expect(scorePrecision).toBeGreaterThan(scoreRespondida);
      expect(scorePrecision).toBeGreaterThan(scoreTribunal);
    });

    it('(1A-Remediated) solicitudesActivas includes EN_PRECISION, POR_RECOGER, and ENCAUZADA, selecting EN_PRECISION as solicitudPrincipal', () => {
      const precisionReq = createSyntheticSolicitud(1, 'EN_PRECISION');
      const porRecogerReq = createSyntheticSolicitud(2, 'POR_RECOGER', { diasRestantes: 15 });
      const encauzadaReq = createSyntheticSolicitud(4, 'ENCAUZADA');
      const ttaipSubsanacion1d = createSyntheticSolicitud(3, 'DENEGADA', {
        apelacion: {
          expediente: '00001-2026-JUS/TTAIP',
          estado: 'EN_SUBSANACION',
          plazoSubsanacion: { requerimientoId: 1, estado: 'EN_CURSO', diasHabiles: 2, diasHabilesRestantes: 1 }
        } as any
      });
      const respondida = createSyntheticSolicitud(10, 'RESPONDIDA');

      component.todasSolicitudes.set([respondida, porRecogerReq, encauzadaReq, precisionReq, ttaipSubsanacion1d]);

      const activas = component.solicitudesActivas();

      // Confirms all remediated states are active:
      expect(activas.some(s => s.id === precisionReq.id)).toBe(true);
      expect(activas.some(s => s.id === porRecogerReq.id)).toBe(true);
      expect(activas.some(s => s.id === encauzadaReq.id)).toBe(true);
      expect(activas.some(s => s.id === ttaipSubsanacion1d.id)).toBe(true);
      expect(activas.some(s => s.id === respondida.id)).toBe(false);

      // Priority ladder: EN_PRECISION (score 110) strictly selected over TTAIP subsanacion 1d (score 92) and POR_RECOGER (score 70)
      expect(component.solicitudPrincipal()?.id).toBe(precisionReq.id);
    });

    it('(1B) Subsanación TTAIP with 1 day remaining scores higher than a standard Denegada request', () => {
      const subsanacion1d = createSyntheticSolicitud(20, 'DENEGADA', {
        apelacion: {
          expediente: '00020-2026-JUS/TTAIP',
          estado: 'EN_SUBSANACION',
          plazoSubsanacion: { requerimientoId: 5, estado: 'EN_CURSO', diasHabiles: 2, diasHabilesRestantes: 1 }
        } as any
      });
      const denegadaStd = createSyntheticSolicitud(21, 'DENEGADA', { diasRestantes: 5 });
      const denegadaSinDias = createSyntheticSolicitud(22, 'DENEGADA', { diasRestantes: undefined });

      const scoreSubsanacion = (component as any).calcularUrgenciaSolicitud(subsanacion1d);
      const scoreDenegadaStd = (component as any).calcularUrgenciaSolicitud(denegadaStd);
      const scoreDenegadaSinDias = (component as any).calcularUrgenciaSolicitud(denegadaSinDias);

      // 100 - (1 * 8) = 92
      expect(scoreSubsanacion).toBe(92);
      // Denegada with 5 days: 80 - 5 = 75
      expect(scoreDenegadaStd).toBe(75);
      // Denegada without days: 78
      expect(scoreDenegadaSinDias).toBe(78);

      expect(scoreSubsanacion).toBeGreaterThan(scoreDenegadaStd);
      expect(scoreSubsanacion).toBeGreaterThan(scoreDenegadaSinDias);

      // Solicitud principal chooses subsanacion over denegada
      component.todasSolicitudes.set([denegadaStd, subsanacion1d, denegadaSinDias]);
      expect(component.solicitudPrincipal()?.id).toBe(subsanacion1d.id);
    });

    it('(1C) POR_RECOGER and ENCAUZADA map to proper CTA labels, eyebrows and tones', () => {
      const porRecogerReq = createSyntheticSolicitud(30, 'POR_RECOGER', { diasRestantes: 15 });
      const accionPorRecoger = (component as any).construirAccionPrincipal(porRecogerReq);

      expect(accionPorRecoger).not.toBeNull();
      // Design reference CitizenDashboard.tsx:132 has cta: { label: 'Ver cupón de pago', ... }
      // Check exact label and verify tone
      expect(accionPorRecoger?.eyebrow).toBe('Listo para recoger · entrega física');
      expect(accionPorRecoger?.toneColor).toBe('var(--gold-dark)');
      expect(accionPorRecoger?.metricUnit).toBe('días calendario');
      expect(accionPorRecoger?.metricValue).toBe('15');
      // Report exact ctaLabel observed in implementation (replicates CitizenDashboard.tsx:132)
      expect(accionPorRecoger?.ctaLabel).toBe('Ver cupón de pago');

      const encauzadaReq = createSyntheticSolicitud(31, 'ENCAUZADA');
      const accionEncauzada = (component as any).construirAccionPrincipal(encauzadaReq);

      expect(accionEncauzada).not.toBeNull();
      // Design reference CitizenDashboard.tsx:144 has cta: { label: 'Ver encauzamiento', ... }
      expect(accionEncauzada?.eyebrow).toBe('Solicitud encauzada a otra entidad');
      expect(accionEncauzada?.toneColor).toBe('var(--info)');
      expect(accionEncauzada?.metricUnit).toBe('derivada');
      expect(accionEncauzada?.metricValue).toBe('→');
      // Report exact ctaLabel observed in implementation (replicates CitizenDashboard.tsx:144)
      expect(accionEncauzada?.ctaLabel).toBe('Ver encauzamiento');
    });

    it('(1D) SAN requests display metricValue "Sin" and metricUnit "plazo perentorio" with legally sound wording', () => {
      const sanVencida = createSyntheticSolicitud(40, 'VENCIDA');
      const accionSanVencida = (component as any).construirAccionPrincipal(sanVencida);

      expect(accionSanVencida).not.toBeNull();
      expect(accionSanVencida?.metricValue).toBe('Sin');
      expect(accionSanVencida?.metricUnit).toBe('plazo perentorio');
      expect(accionSanVencida?.eyebrow).toBe('Silencio administrativo · puede apelar');
      expect(accionSanVencida?.detalle).toBe(
        'La entidad no respondió dentro del plazo legal. Puede presentar apelación por silencio administrativo negativo.'
      );
      expect(accionSanVencida?.ctaLabel).toBe('Apelar al Tribunal');
      expect(accionSanVencida?.route).toEqual(['/ciudadano/nueva-apelacion']);
      expect(accionSanVencida?.queryParams).toEqual({ solicitudId: 40 });

      // Check request with negative remaining days
      const sanDiasNegativos = createSyntheticSolicitud(41, 'EN_REVISION', { diasRestantes: -12 });
      const accionSanDiasNeg = (component as any).construirAccionPrincipal(sanDiasNegativos);
      expect(accionSanDiasNeg?.metricValue).toBe('Sin');
      expect(accionSanDiasNeg?.metricUnit).toBe('plazo perentorio');
      expect(accionSanDiasNeg?.eyebrow).toBe('Silencio administrativo · puede apelar');
    });
  });

  // =========================================================================
  // 2. GLOBAL SEARCH & DROPDOWN NAVIGATION
  // =========================================================================
  describe('2. Global Search & Dropdown Navigation', () => {

    it('(2A) Combobox keyboard navigation cycles correctly with ArrowDown, ArrowUp, Enter, and Escape', () => {
      const req1 = createSyntheticSolicitud(51, 'EN_REVISION', { asunto: 'Presupuesto regional 2026' });
      const req2 = createSyntheticSolicitud(52, 'EN_REVISION', { asunto: 'Plan de contrataciones' });
      const req3 = createSyntheticSolicitud(53, 'EN_REVISION', { asunto: 'Plan operativo institucional' });

      currentBackendList = [req1, req2, req3];
      fixture.detectChanges(); // calls cargarDatos -> populates todasSolicitudes with valid page

      const routerNavigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      // Search for 'Plan' -> matches req2 and req3 (2 results)
      component.onGlobalSearchChange('Plan');
      fixture.detectChanges();

      expect(component.globalResults().length).toBe(2);
      expect(component.globalIdx()).toBe(0);

      // ArrowDown -> idx becomes 1
      const arrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
      component.onGlobalKeyDown(arrowDown);
      expect(component.globalIdx()).toBe(1);

      // ArrowDown again -> wraps around to 0
      component.onGlobalKeyDown(arrowDown);
      expect(component.globalIdx()).toBe(0);

      // ArrowUp -> wraps around to 1 (last index)
      const arrowUp = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
      component.onGlobalKeyDown(arrowUp);
      expect(component.globalIdx()).toBe(1);

      // ArrowUp again -> back to 0
      component.onGlobalKeyDown(arrowUp);
      expect(component.globalIdx()).toBe(0);

      // Enter -> navigates to req2 (index 0)
      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      component.onGlobalKeyDown(enter);
      expect(routerNavigate).toHaveBeenCalledWith(['/ciudadano/solicitud', req2.expediente]);

      // Reopen and press Escape -> clears search
      component.onGlobalSearchChange('Plan');
      expect(component.globalOpen()).toBe(true);
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      component.onGlobalKeyDown(escape);
      expect(component.globalQuery()).toBe('');
      expect(component.globalOpen()).toBe(false);
      expect(component.globalResults()).toEqual([]);
    });

    it('(2B) Clicking outside #buscador-global-container resets globalOpen and clears search', () => {
      const req = createSyntheticSolicitud(60, 'EN_REVISION', { asunto: 'Auditoría ambiental' });
      currentBackendList = [req];
      fixture.detectChanges();

      component.onGlobalSearchChange('Auditoría');
      fixture.detectChanges();
      expect(component.globalOpen()).toBe(true);

      // Simulate click inside the container -> should NOT close
      const container = fixture.nativeElement.querySelector('#buscador-global-container');
      expect(container).not.toBeNull();

      const insideClick = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(insideClick, 'target', { value: container, writable: false });
      component.onDocumentClick(insideClick);
      expect(component.globalOpen()).toBe(true);
      expect(component.globalQuery()).toBe('Auditoría');

      // Simulate click outside the container (e.g. document body) -> should cleanly close
      const outsideClick = new MouseEvent('mousedown', { bubbles: true });
      const outsideDiv = document.createElement('div');
      document.body.appendChild(outsideDiv);
      Object.defineProperty(outsideClick, 'target', { value: outsideDiv, writable: false });

      component.onDocumentClick(outsideClick);
      expect(component.globalQuery()).toBe('');
      expect(component.globalOpen()).toBe(false);
      expect(component.globalResults()).toEqual([]);
      outsideDiv.remove();
    });

    it('(2C) Handles empty results safely without throwing during key navigation', () => {
      currentBackendList = [];
      fixture.detectChanges();

      component.onGlobalSearchChange('inexistente');
      expect(component.globalResults()).toEqual([]);

      const arrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
      expect(() => component.onGlobalKeyDown(arrowDown)).not.toThrow();

      const arrowUp = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
      expect(() => component.onGlobalKeyDown(arrowUp)).not.toThrow();

      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      expect(() => component.onGlobalKeyDown(enter)).not.toThrow();
    });
  });

  // =========================================================================
  // 3. MODAL FLOW & TELEPORTATION
  // =========================================================================
  describe('3. Modal Flow & Teleportation', () => {

    it('(3A) ReferenceSuccessModal renders tertiary button "Presentar otra solicitud" for saip-creada and emits close', () => {
      const successFixture = TestBed.createComponent(ReferenceSuccessModalComponent);
      const successComp = successFixture.componentInstance;

      successComp.open = true;
      successComp.variant = 'saip-creada';
      successComp.presentation = 'saip-response';
      successComp.title = 'Tu SAIP fue registrada';
      successComp.expediente = 'SAIP-2026-00099';
      successComp.primaryLabel = 'Ir a mi panel';
      successComp.secondaryLabel = 'Ver expediente';

      successFixture.detectChanges();

      const buttons = Array.from(document.body.querySelectorAll('button') as NodeListOf<HTMLButtonElement>);
      const tertiaryBtn = buttons.find(b => b.textContent?.trim().includes('Presentar otra solicitud'));

      expect(tertiaryBtn).toBeDefined();
      expect(tertiaryBtn?.textContent?.trim()).toBe('Presentar otra solicitud');

      let closeEmitted = false;
      successComp.close.subscribe(() => { closeEmitted = true; });

      tertiaryBtn?.click();
      expect(closeEmitted).toBe(true);

      successFixture.destroy();
    });

    it('(3B-Remediated) cerrarResultado clears all creation signals, unlocking form (bloqueado === false) and allowing subsequent submissions', async () => {
      const mockRegAlta = vi.fn().mockReturnValue(of({
        id: 301,
        claveOperacion: 'synthetic-key-301',
        declaraVeracidad: true,
        fechaRecepcion: '2026-10-28T10:00:00',
        solicitud: { id: 301, expediente: 'SAIP-2026-00301', asunto: 'Segunda solicitud' },
        documentos: []
      }));

      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [NuevaSaipComponent],
        providers: [
          provideRouter([]),
          { provide: SolicitudService, useValue: { registrarAlta: mockRegAlta, obtenerRecepcionAlta: vi.fn() } },
          { provide: EntidadService, useValue: { findActivas: vi.fn().mockReturnValue(of([{ id: 4, nombre: 'Entidad de prueba' }])) } },
          { provide: AuthService, useValue: { obtenerSesion: () => session, getToken: () => 'synthetic-jwt-token-m2', cambiosSesion: revision } },
        ]
      }).compileComponents();

      const saipFixture = TestBed.createComponent(NuevaSaipComponent);
      const saipComp = saipFixture.componentInstance;
      saipFixture.detectChanges();

      // Simulate a completed request creation
      saipComp.successModalAbierto.set(true);
      saipComp.solicitudCreada.set({ id: 99, expediente: 'SAIP-2026-00099' } as any);
      saipComp.estadoEnvio.set('confirmada');
      saipComp.expedienteCreado.set('SAIP-2026-00099');

      expect(saipComp.successModalAbierto()).toBe(true);
      expect(saipComp.bloqueado()).toBe(true);

      // Trigger cerrarResultado (invoked by modal tertiary button (close)="cerrarResultado()")
      saipComp.cerrarResultado();

      // Modal closed and step reset
      expect(saipComp.successModalAbierto()).toBe(false);
      expect(saipComp.step()).toBe(1);

      // Verify all signals are cleared and form is unlocked
      expect(saipComp.solicitudCreada()).toBeNull();
      expect(saipComp.expedienteCreado()).toBe('');
      expect(saipComp.estadoEnvio()).toBe('lista');
      expect(saipComp.bloqueado()).toBe(false);

      // Verify subsequent submission proceeds without silent abort
      saipComp.entidadId = 4;
      saipComp.asunto = 'Segunda solicitud';
      saipComp.descripcion = 'Detalle de segunda solicitud';
      saipComp.formatoRespuesta.correo = true;
      saipComp.medioNotificacion = 'correo';
      saipComp.aceptaCorreo = true;
      saipComp.consentimientoDatosPersonales = true;
      saipComp.declaraVeracidad = true;

      saipComp.crearSolicitud();
      await saipFixture.whenStable();

      expect(mockRegAlta).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ asunto: 'Segunda solicitud', entidadId: 4 }),
        true,
        []
      );

      saipFixture.destroy();
    });

    it('(3C) Modal components use BodyPortalDirective for teleportation without DOM collision', () => {
      // Test that Confirm and Success modals clean up their portal DOM nodes when destroyed
      const confirmFixture = TestBed.createComponent(ReferenceConfirmModalComponent);
      confirmFixture.componentRef.setInput('open', true);
      confirmFixture.componentRef.setInput('title', 'Confirmación sintética');
      confirmFixture.detectChanges();

      expect(document.body.querySelectorAll('.reference-confirm-panel').length).toBe(1);

      // Setting open to false removes the portal from body
      confirmFixture.componentRef.setInput('open', false);
      confirmFixture.detectChanges();
      expect(document.body.querySelectorAll('.reference-confirm-panel').length).toBe(0);

      confirmFixture.destroy();

      const successFixture = TestBed.createComponent(ReferenceSuccessModalComponent);
      successFixture.componentRef.setInput('open', true);
      successFixture.componentRef.setInput('variant', 'saip-creada');
      successFixture.detectChanges();

      expect(document.body.querySelectorAll('.reference-success-panel').length).toBe(1);

      successFixture.componentRef.setInput('open', false);
      successFixture.detectChanges();
      expect(document.body.querySelectorAll('.reference-success-panel').length).toBe(0);

      successFixture.destroy();
    });
  });
});
