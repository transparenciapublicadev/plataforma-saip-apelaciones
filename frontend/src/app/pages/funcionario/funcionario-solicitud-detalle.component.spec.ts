import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Solicitud } from '../../models/solicitud.model';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { EntidadService } from '../../services/entidad.service';
import { FuncionarioSolicitudDetalleComponent } from './funcionario-solicitud-detalle.component';

describe('FuncionarioSolicitudDetalleComponent puedeAdjuntarDocumentos', () => {
  const base: Partial<Solicitud> = { id: 12, expediente: 'SAIP-2026-00012', entidadId: 3, asunto: 'Pedido sintético',
    fechaPresentacion: '2026-10-01', respuesta: null, observaciones: [], documentosMetadata: [],
    ampliacionesPlazo: [], encauzamientos: [], liquidacionesCosto: [] };
  const mockSolicitudService = {
    findByExpediente: vi.fn(),
    obtenerSeguimientoPlazo: vi.fn(() => of({} as any)),
    actualizarLiquidacion: vi.fn((_id: number, liq: number, payload: any) => of({
      id: liq,
      solicitudId: 12,
      estadoLiquidacion: payload?.estado || 'CANCELADA'
    } as any)),
    cambiarEstado: vi.fn(() => of({} as any))
  };
  const mockAuthService = {
    obtenerSesion: vi.fn(() => ({ id: 1, rol: 'FUNCIONARIO' }))
  };
  const mockEntidadService = {
    findActivas: vi.fn(() => of([]))
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSolicitudService.findByExpediente.mockReturnValue(of(base as unknown as Solicitud));
    mockSolicitudService.obtenerSeguimientoPlazo.mockReturnValue(of({} as any));
    await TestBed.configureTestingModule({
      imports: [FuncionarioSolicitudDetalleComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'SAIP-2026-00012' } } } },
        { provide: SolicitudService, useValue: mockSolicitudService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: EntidadService, useValue: mockEntidadService }
      ]
    })
      .compileComponents();
  });

  it('debería retornar puedeAdjuntarDocumentos como true para estados activos', () => {
    mockSolicitudService.findByExpediente.mockReturnValue(of({
      ...base,
      id: 12,
      estado: 'RECEPCIONADA'
    } as Solicitud));
    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.puedeAdjuntarDocumentos()).toBe(true);

    fixture.componentInstance.solicitud.set({ estado: 'EN_REVISION' } as Solicitud);
    expect(fixture.componentInstance.puedeAdjuntarDocumentos()).toBe(true);

    fixture.componentInstance.solicitud.set({ estado: 'PENDIENTE_INFORMACION' } as Solicitud);
    expect(fixture.componentInstance.puedeAdjuntarDocumentos()).toBe(true);
  });

  it('debería retornar puedeAdjuntarDocumentos como false para estados cerrados', () => {
    mockSolicitudService.findByExpediente.mockReturnValue(of({
      ...base,
      id: 12,
      estado: 'RESPONDIDA'
    } as Solicitud));
    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.puedeAdjuntarDocumentos()).toBe(false);

    fixture.componentInstance.solicitud.set({ estado: 'VENCIDA' } as Solicitud);
    expect(fixture.componentInstance.puedeAdjuntarDocumentos()).toBe(false);

    fixture.componentInstance.solicitud.set({ estado: 'DENEGADA' } as Solicitud);
    expect(fixture.componentInstance.puedeAdjuntarDocumentos()).toBe(false);

    fixture.componentInstance.solicitud.set({ estado: 'CONCLUIDA' } as Solicitud);
    expect(fixture.componentInstance.puedeAdjuntarDocumentos()).toBe(false);
  });

  it('debería renderizar o remover el elemento <app-document-upload> en base a la regla de visibilidad', () => {
    // Return an active request
    const mockSol = { ...base, id: 12, estado: 'RECEPCIONADA', documentosMetadata: [] } as any;
    mockSolicitudService.findByExpediente.mockReturnValue(of(mockSol));

    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    const component = fixture.componentInstance;
    
    // Initial detectChanges sets the state and runs the synchronous lifecycle
    fixture.detectChanges();

    // Now change active tab to adjuntos so the block is evaluated
    component.activeTab.set('adjuntos');
    fixture.detectChanges();

    // Con estado RECEPCIONADA (activo): debe existir
    let uploadEl = fixture.nativeElement.querySelector('app-document-upload');
    expect(uploadEl).not.toBeNull();

    // Con estado RESPONDIDA (cerrado): debe ser removido del DOM
    component.solicitud.set({ id: 12, estado: 'RESPONDIDA', documentosMetadata: [] } as any);
    fixture.detectChanges();
    uploadEl = fixture.nativeElement.querySelector('app-document-upload');
    expect(uploadEl).toBeNull();
  });
  it('ofrece evaluar la subsanación presentada mediante las acciones oficiales', () => {
    mockSolicitudService.findByExpediente.mockReturnValue(of({ ...base, id: 12, estado: 'PENDIENTE_INFORMACION',
      documentosMetadata: [], observaciones: [{ id: 8, estado: 'PENDIENTE_SUBSANACION',
      comentarioSubsanacion: 'Dato histórico con subsanación registrada', fechaSubsanacion: '2026-10-22T10:00:00' }] } as any));
    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Aceptar subsanación · pasar a trámite');
    expect(texto).toContain('No subsanada · archivar');
  });

  it('debería incluir el panel de área responsable con el expediente de la solicitud', () => {
    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    const areaPanel = fixture.nativeElement.querySelector('app-area-responsable-panel');
    expect(areaPanel).not.toBeNull();
  });

  it('registra entrega física (recojo) con comprobante y documento de identidad pasando a estado RESPONDIDA', () => {
    const mockLiq = {
      id: 55,
      codigoLiquidacion: 'LIQ-001',
      monto: 15.50,
      estado: 'PAGADA',
      fechaEmision: '2026-10-15',
      fechaLimiteRecojo: '2026-11-20'
    };
    mockSolicitudService.findByExpediente.mockReturnValue(of({
      ...base,
      id: 12,
      estado: 'EN_REVISION',
      liquidacionesCosto: [mockLiq]
    } as any));

    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.activeTab.set('liquidacion');
    fixture.detectChanges();

    comp.confirmarRecojoFisico(mockLiq as any);
    expect(comp.liquidacionError()).toContain('comprobante de pago y el documento de identidad');
    expect(mockSolicitudService.actualizarLiquidacion).not.toHaveBeenCalled();

    comp.archivoComprobante.set(new File(['voucher'], 'voucher.pdf', { type: 'application/pdf' }));
    comp.archivoIdentidad.set(new File(['dni'], 'dni.pdf', { type: 'application/pdf' }));
    comp.confirmarRecojoFisico(mockLiq as any);

    expect(mockSolicitudService.actualizarLiquidacion).toHaveBeenCalledWith(12, 55, expect.objectContaining({
      estado: 'RECOGIDA'
    }));
    expect(mockSolicitudService.cambiarEstado).toHaveBeenCalledWith(12, 'RESPONDIDA');
  });

  it('cancelar liquidación no envía una observación fáctica inventada', () => {
    const expiredLiq = {
      id: 60,
      codigoLiquidacion: 'LIQ-EXP',
      monto: 20.00,
      estado: 'NOTIFICADA',
      fechaEmision: '2026-09-01',
      fechaLimiteRecojo: '2026-10-01'
    };
    mockSolicitudService.findByExpediente.mockReturnValue(of({
      ...base,
      id: 12,
      estado: 'EN_REVISION',
      liquidacionesCosto: [expiredLiq]
    } as any));

    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.activeTab.set('liquidacion');
    fixture.detectChanges();

    expect(comp.isRecojoVencido(expiredLiq as any)).toBe(true);

    comp.motivoArchivo.set('NO_RECOJO');
    comp.archivarLiquidacion(expiredLiq as any);
    expect(mockSolicitudService.actualizarLiquidacion).toHaveBeenCalledWith(12, 60, expect.objectContaining({
      estado: 'CANCELADA',
      responsable: expect.any(String),
      observacion: 'No recogió la información — Vencimiento de 30 días calendario'
    }));
    expect(comp.liquidacionSuccess()).toBe('Liquidación archivada por vencimiento del plazo de 30 días.');

    // Verificación de causal SIN_ACREDITACION_DE_PAGO
    comp.motivoArchivo.set('SIN_ACREDITACION_DE_PAGO');
    comp.archivarLiquidacion(expiredLiq as any);
    expect(mockSolicitudService.actualizarLiquidacion).toHaveBeenCalledWith(12, 60, expect.objectContaining({
      estado: 'CANCELADA',
      responsable: expect.any(String),
      observacion: 'No acreditó el pago — Vencimiento de 30 días calendario'
    }));
  });

});
