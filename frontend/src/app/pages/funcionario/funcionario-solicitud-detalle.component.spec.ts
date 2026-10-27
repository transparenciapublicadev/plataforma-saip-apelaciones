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
    obtenerSeguimientoPlazo: vi.fn(() => of({} as any))
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
  it('no ofrece aprobar o archivar una subsanación mediante un cambio genérico', () => {
    mockSolicitudService.findByExpediente.mockReturnValue(of({ ...base, id: 12, estado: 'PENDIENTE_INFORMACION',
      documentosMetadata: [], observaciones: [{ id: 8, estado: 'PENDIENTE_SUBSANACION',
      comentarioSubsanacion: 'Dato histórico sin recepción acreditada', fechaSubsanacion: '2026-10-22T10:00:00' }] } as any));
    const fixture = TestBed.createComponent(FuncionarioSolicitudDetalleComponent);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Aceptar subsanación · pasar a trámite');
    expect(texto).not.toContain('No subsanada · archivar');
    expect(texto).toMatch(/no disponible|información inconsistente/i);
  });

});
