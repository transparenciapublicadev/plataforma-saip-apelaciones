import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Solicitud } from '../../models/solicitud.model';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { EntidadService } from '../../services/entidad.service';
import { FuncionarioSolicitudDetalleComponent } from './funcionario-solicitud-detalle.component';

describe('FuncionarioSolicitudDetalleComponent puedeAdjuntarDocumentos', () => {
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
    mockSolicitudService.findByExpediente.mockReturnValue(of({} as Solicitud));
    mockSolicitudService.obtenerSeguimientoPlazo.mockReturnValue(of({} as any));
    await TestBed.configureTestingModule({
      imports: [FuncionarioSolicitudDetalleComponent],
      providers: [
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
    const mockSol = { id: 12, estado: 'RECEPCIONADA', documentosMetadata: [] } as any;
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
});
