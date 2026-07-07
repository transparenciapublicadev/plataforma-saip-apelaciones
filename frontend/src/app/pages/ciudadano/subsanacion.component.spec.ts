import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Apelacion } from '../../models/apelacion.model';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { SubsanacionComponent } from './subsanacion.component';

describe('SubsanacionComponent', () => {
  const mockApelacionService = {
    findByExpediente: vi.fn()
  };
  const mockAuthService = {
    obtenerSesion: vi.fn(() => ({ id: 1, rol: 'CIUDADANO' }))
  };
  const mockRouter = {
    navigate: vi.fn()
  };
  const mockDocumentoService = {};

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [SubsanacionComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'EXP-2026-001' } } } },
        { provide: Router, useValue: mockRouter },
        { provide: ApelacionService, useValue: mockApelacionService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: DocumentoService, useValue: mockDocumentoService }
      ]
    })
      .compileComponents();
  });

  it('debería renderizar la zona de carga de documentos cuando el estado de la apelación es EN_SUBSANACION', () => {
    mockApelacionService.findByExpediente.mockReturnValue(of({
      id: 1,
      expediente: 'EXP-2026-001',
      estado: 'EN_SUBSANACION',
      fechaSubsanacion: '2026-07-07T12:00:00Z',
      fechaApelacion: '2026-07-07T12:00:00Z'
    } as Apelacion));

    const fixture = TestBed.createComponent(SubsanacionComponent);
    fixture.detectChanges();

    // The file input should be present in the DOM
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    // The "no habilitada" text block should NOT exist
    const noHabilitadaText = fixture.nativeElement.textContent;
    expect(noHabilitadaText).not.toContain('Subsanación no habilitada');
  });

  it('debería bloquear y ocultar el formulario de carga mostrando "Subsanación no habilitada" si el estado de la apelación NO es EN_SUBSANACION', () => {
    mockApelacionService.findByExpediente.mockReturnValue(of({
      id: 1,
      expediente: 'EXP-2026-001',
      estado: 'EN_CALIFICACION_2',
      fechaSubsanacion: '2026-07-07T12:00:00Z',
      fechaApelacion: '2026-07-07T12:00:00Z'
    } as Apelacion));

    const fixture = TestBed.createComponent(SubsanacionComponent);
    fixture.detectChanges();

    // The file input should be removed from the DOM
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
    expect(fileInput).toBeNull();

    // The "no habilitada" message should be rendered
    const noHabilitadaText = fixture.nativeElement.textContent;
    expect(noHabilitadaText).toContain('Subsanación no habilitada');
  });
});
