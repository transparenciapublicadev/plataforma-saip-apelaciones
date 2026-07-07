import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Solicitud } from '../../models/solicitud.model';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { SolicitudDetalleComponent } from './solicitud-detalle.component';

describe('SolicitudDetalleComponent puedeAdjuntarDocumentos', () => {
  const mockSolicitudService = {
    findByExpediente: vi.fn(() => of({} as Solicitud))
  };
  const mockApelacionService = {};
  const mockAuthService = {
    obtenerSesion: vi.fn(() => ({ id: 1, rol: 'CIUDADANO' }))
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [SolicitudDetalleComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'SAIP-2026-00012' } } } },
        { provide: SolicitudService, useValue: mockSolicitudService },
        { provide: ApelacionService, useValue: mockApelacionService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
      .overrideComponent(SolicitudDetalleComponent, { set: { template: '' } })
      .compileComponents();
  });

  it('debería retornar puedeAdjuntarDocumentos como true para estados activos', () => {
    const fixture = TestBed.createComponent(SolicitudDetalleComponent);
    const component = fixture.componentInstance;
    
    // Activo: RECEPCIONADA
    component.solicitud.set({ estado: 'RECEPCIONADA' } as Solicitud);
    expect(component.puedeAdjuntarDocumentos()).toBe(true);

    // Activo: EN_REVISION
    component.solicitud.set({ estado: 'EN_REVISION' } as Solicitud);
    expect(component.puedeAdjuntarDocumentos()).toBe(true);

    // Activo: PENDIENTE_INFORMACION
    component.solicitud.set({ estado: 'PENDIENTE_INFORMACION' } as Solicitud);
    expect(component.puedeAdjuntarDocumentos()).toBe(true);
  });

  it('debería retornar puedeAdjuntarDocumentos como false para estados cerrados', () => {
    const fixture = TestBed.createComponent(SolicitudDetalleComponent);
    const component = fixture.componentInstance;
    
    // Cerrado: RESPONDIDA
    component.solicitud.set({ estado: 'RESPONDIDA' } as Solicitud);
    expect(component.puedeAdjuntarDocumentos()).toBe(false);

    // Cerrado: VENCIDA
    component.solicitud.set({ estado: 'VENCIDA' } as Solicitud);
    expect(component.puedeAdjuntarDocumentos()).toBe(false);

    // Cerrado: DENEGADA
    component.solicitud.set({ estado: 'DENEGADA' } as Solicitud);
    expect(component.puedeAdjuntarDocumentos()).toBe(false);

    // Cerrado: CONCLUIDA
    component.solicitud.set({ estado: 'CONCLUIDA' } as Solicitud);
    expect(component.puedeAdjuntarDocumentos()).toBe(false);
  });
});
