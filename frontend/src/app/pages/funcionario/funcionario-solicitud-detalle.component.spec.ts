import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Solicitud } from '../../models/solicitud.model';
import { SolicitudService } from '../../services/solicitud.service';
import { DocumentoService } from '../../services/documento.service';
import { AuthService } from '../../services/auth.service';
import { EntidadService } from '../../services/entidad.service';
import { FuncionarioSolicitudDetalleComponent } from './funcionario-solicitud-detalle.component';

describe('FuncionarioSolicitudDetalleComponent', () => {
  const base: Partial<Solicitud> = { id: 12, expediente: 'SAIP-2026-00012', entidadId: 3, asunto: 'Pedido sintético',
    fechaPresentacion: '2026-10-01', respuesta: null, observaciones: [], documentosMetadata: [],
    ampliacionesPlazo: [], encauzamientos: [], liquidacionesCosto: [] };
  const mockSolicitudService = {
    findByExpediente: vi.fn(),
    obtenerSeguimientoPlazo: vi.fn(() => of({} as any)),
    registrarDocumentosEntregaParcial: vi.fn(),
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
  const mockDocumentoService = {
    upload: vi.fn(() => of({ id: 1 })),
    download: vi.fn()
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
        { provide: DocumentoService, useValue: mockDocumentoService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: EntidadService, useValue: mockEntidadService }
      ]
    })
      .compileComponents();
  });

  it.each(['RECEPCIONADA', 'EN_REVISION', 'PENDIENTE_INFORMACION', 'RESPONDIDA'] as const)(
    'permite consultar y descargar documentos del administrado sin adjuntar archivos en %s', estado => {
      mockSolicitudService.findByExpediente.mockReturnValue(of({
        ...base, estado, documentosMetadata: [{ id: 45, solicitudId: 12, nombreOriginal: 'adjunto.pdf' }]
      } as Solicitud));
      const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
      fixture.detectChanges();
      fixture.componentInstance.activeTab.set('adjuntos');
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('[role=tabpanel]');
      expect(panel.textContent).toContain('adjunto.pdf');
      expect(panel.querySelector('button[title="Ver documento"]')).not.toBeNull();
      expect(panel.textContent).toContain('Descargar');
      expect(panel.querySelector('input[type="file"]')).toBeNull();
      expect(panel.textContent).not.toContain('Adjuntar documento a la solicitud');
    }
  );
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

  it('guarda el cronograma completado en su pestaña y abre la respuesta', () => {
    mockSolicitudService.findByExpediente.mockReturnValue(of({
      ...base,
      estado: 'DENEGADA',
      tipoInformacion: 'Presupuesto',
      respuesta: { id: 4, tipoRespuesta: 'DENEGACION_TOTAL', causalDenegatoria: 'inexistente' },
      ampliacionesPlazo: [{
        id: 9, solicitudId: 12, estadoAmpliacion: 'COMPLETADA', fechaLimiteAmpliada: '2026-12-30',
        cronograma: [{ id: 41, numeroEntrega: 1, estado: 'ENTREGADA', descripcion: 'Primera parte', fechaProgramada: '2026-12-01' }]
      }]
    } as Solicitud));
    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    const tabs = [...fixture.nativeElement.querySelectorAll('[role="tab"]')].map((tab: HTMLElement) => tab.textContent?.trim());
    expect(tabs).toContain('Cronograma');
    expect(fixture.componentInstance.activeTab()).toBe('respuesta');
    expect(fixture.nativeElement.querySelector('app-cronograma-entregas-panel')).toBeNull();
    fixture.componentInstance.cambiarTab('cronograma');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-cronograma-entregas-panel')).not.toBeNull();
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
      estadoLiquidacion: 'PAGADA',
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
    expect(fixture.nativeElement.textContent).not.toContain('Cargo de entrega');
    expect(comp.tabs().some(tab => tab.id === 'liquidacion')).toBe(true);
    comp.activeTab.set('liquidacion');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargo de entrega');

    comp.confirmarRecojoFisico(mockLiq as any);
    expect(comp.liquidacionError()).toContain('cargo de entrega, la foto del comprobante de pago y la copia del DNI');
    expect(mockSolicitudService.actualizarLiquidacion).not.toHaveBeenCalled();

    comp.archivoCargo.set(new File(['cargo'], 'cargo.pdf', { type: 'application/pdf' }));
    comp.archivoComprobante.set(new File(['voucher'], 'voucher.pdf', { type: 'application/pdf' }));
    comp.archivoIdentidad.set(new File(['dni'], 'dni.pdf', { type: 'application/pdf' }));
    comp.confirmarRecojoFisico(mockLiq as any);

    expect(mockDocumentoService.upload).toHaveBeenCalledTimes(3);
    expect(mockDocumentoService.upload).toHaveBeenCalledWith(expect.any(File), 'DOCUMENTO_ADJUNTO', { solicitudId: 12 });
    expect(mockSolicitudService.actualizarLiquidacion).toHaveBeenCalledWith(12, 55, expect.objectContaining({
      estado: 'RECOGIDA'
    }));
    expect(mockSolicitudService.cambiarEstado).not.toHaveBeenCalled();
  });

  it('asocia las constancias a la respuesta cuando el expediente ya está respondido', () => {
    const mockLiq = {
      id: 55,
      codigoLiquidacion: 'LIQ-001',
      monto: 36.8,
      estadoLiquidacion: 'NOTIFICADA',
      fechaLimiteRecojo: '2027-01-04'
    };
    mockSolicitudService.findByExpediente.mockReturnValue(of({
      ...base,
      id: 12,
      estado: 'RESPONDIDA',
      respuesta: { id: 9 },
      liquidacionesCosto: [mockLiq]
    } as any));

    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.estadoExpedienteVisible()).toBe('Información puesta a disposición');
    comp.archivoCargo.set(new File(['cargo'], 'cargo.pdf', { type: 'application/pdf' }));
    comp.archivoComprobante.set(new File(['voucher'], 'voucher.pdf', { type: 'application/pdf' }));
    comp.archivoIdentidad.set(new File(['dni'], 'dni.pdf', { type: 'application/pdf' }));
    comp.confirmarRecojoFisico(mockLiq as any);

    expect(mockDocumentoService.upload).toHaveBeenCalledWith(expect.any(File), 'DOCUMENTO_ADJUNTO', { respuestaId: 9 });
    expect(mockDocumentoService.upload).not.toHaveBeenCalledWith(expect.any(File), 'DOCUMENTO_ADJUNTO', { solicitudId: 12 });
    expect(mockSolicitudService.actualizarLiquidacion).toHaveBeenCalledWith(12, 55, expect.objectContaining({
      estado: 'RECOGIDA'
    }));
    expect(mockSolicitudService.cambiarEstado).not.toHaveBeenCalled();
  });

  it('abre y descarga las constancias cuando la entrega física ya fue atendida', () => {
    mockDocumentoService.download.mockReturnValue(NEVER);
    mockSolicitudService.findByExpediente.mockReturnValue(of({
      ...base,
      id: 12,
      estado: 'RESPONDIDA',
      descripcion: '[Oficina destinataria: Oficina de Hidrocarburo] [Modalidad requerida: Soportes magnéticos o digitales (CD/DVD/USB)]\n\nCopia de actas',
      respuesta: {
        id: 9,
        documentosMetadata: [
          { id: 77, respuestaId: 9, nombreOriginal: 'cargo-entrega-acta.pdf', contentType: 'application/pdf', sizeBytes: 16 },
          { id: 78, respuestaId: 9, nombreOriginal: 'comprobante-pago-acta.pdf', contentType: 'application/pdf', sizeBytes: 16 },
          { id: 79, respuestaId: 9, nombreOriginal: 'dni-receptor-acta.pdf', contentType: 'application/pdf', sizeBytes: 16 }
        ]
      },
      liquidacionesCosto: [{ id: 55, estadoLiquidacion: 'RECOGIDA', monto: 36.8, moneda: 'PEN', concepto: 'Copias' }]
    } as any));

    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.descripcionVisible()).toBe('Copia de actas');
    comp.activeTab.set('solicitud');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Copia de actas');
    expect(fixture.nativeElement.textContent).not.toContain('[Oficina destinataria:');
    expect(fixture.nativeElement.textContent).not.toContain('[Modalidad requerida:');

    comp.activeTab.set('liquidacion');
    fixture.detectChanges();
    const ver = [...fixture.nativeElement.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.getAttribute('aria-label') === 'Ver cargo-entrega-acta.pdf') as HTMLButtonElement;
    expect(ver).toBeTruthy();
    ver.click();
    expect(comp.previewTarget()?.id).toBe(77);
    expect(comp.documentoError()).toBe('');

    const descargar = [...fixture.nativeElement.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.getAttribute('aria-label') === 'Descargar cargo-entrega-acta.pdf') as HTMLButtonElement;
    descargar.click();
    expect(mockDocumentoService.download).toHaveBeenCalledWith(77, 'cargo-entrega-acta.pdf');
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

  it('permite registrar entrega parcial con documentos desde el panel de cronograma y muestra advertencia inline si falta sustento', () => {
    const hito1 = {
      id: 41,
      ampliacionId: 91,
      numeroEntrega: 1,
      descripcion: 'Primer entregable',
      fechaProgramada: '2026-12-01',
      estado: 'PROGRAMADA' as const
    };
    const ampliacion = {
      id: 91,
      solicitudId: 12,
      estadoAmpliacion: 'REGISTRADA',
      fechaSolicitudAmpliacion: '2026-11-01',
      fechaLimiteOriginal: '2026-11-15',
      fechaLimiteAmpliada: '2026-12-20',
      fechaNotificacionAmpliacion: '2026-11-02',
      motivoAmpliacion: 'Volumen de información',
      cronograma: [hito1]
    };
    mockSolicitudService.findByExpediente.mockReturnValue(of({
      ...base,
      id: 12,
      estado: 'EN_REVISION',
      ampliacionesPlazo: [ampliacion]
    } as any));

    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.registrarEntregaDesdePanel(ampliacion as any, { hito: hito1 as any, fecha: '2026-11-05', archivos: [], decision: "ENTREGA_TOTAL", fundamentoDecision: "" });
    expect(mockSolicitudService.registrarDocumentosEntregaParcial).not.toHaveBeenCalled();
    expect(comp.cronogramaHitoError()).toEqual(expect.objectContaining({ hitoId: 41 }));
    fixture.detectChanges();
    const hitoEl = fixture.nativeElement.querySelector('[data-hito-id="41"]') as HTMLElement;
    expect(hitoEl?.querySelector('[role="alert"]')?.textContent).toContain('documento');

    const archivo = new File(['acta'], 'acta-hito-1.pdf', { type: 'application/pdf' });
    const actualizado = {
      ...hito1,
      estado: 'ENTREGADA' as const,
      fechaEntregaReal: '2026-11-05',
      decision: 'ENTREGA_TOTAL' as const,
      documentos: [{ id: 310, nombreOriginal: 'acta-hito-1.pdf', contentType: 'application/pdf', sizeBytes: 4 }]
    };
    mockSolicitudService.registrarDocumentosEntregaParcial.mockReturnValue(of(actualizado));
    mockSolicitudService.findByExpediente.mockReturnValue(of({
      ...base,
      id: 12,
      estado: 'EN_REVISION',
      ampliacionesPlazo: [{ ...ampliacion, estadoAmpliacion: 'COMPLETADA', cronograma: [actualizado] }]
    } as any));

    comp.registrarEntregaDesdePanel(ampliacion as any, { hito: hito1 as any, fecha: '2026-11-05', archivos: [archivo], decision: "ENTREGA_TOTAL", fundamentoDecision: "" });
    fixture.detectChanges();

    expect(mockSolicitudService.registrarDocumentosEntregaParcial).toHaveBeenCalledWith(12, 91, 41, '2026-11-05', [archivo], 'ENTREGA_TOTAL', '');
    expect(comp.hitoExitoId()).toBe(41);
    expect(comp.cronogramaHitoError()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('acta-hito-1.pdf');
    expect(fixture.nativeElement.textContent).toContain('Entrega total del hito · 05/11/2026');
  });

});
