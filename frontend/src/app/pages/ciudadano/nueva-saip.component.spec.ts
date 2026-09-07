import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NuevaSaipComponent } from './nueva-saip.component';
import { SolicitudService } from '../../services/solicitud.service';
import { EntidadService } from '../../services/entidad.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { Solicitud } from '../../models/solicitud.model';

describe('NuevaSaipComponent', () => {
  const mockSolicitudService = {
    crear: vi.fn(() => of({ id: 101, expediente: 'SAIP-2026-00101' } as Partial<Solicitud>))
  };

  const mockEntidadService = {
    findActivas: vi.fn(() => of([
      { id: 1, nombre: 'Ministerio de Educación', acronimo: 'MINEDU', activa: true },
      { id: 2, nombre: 'Ministerio de Justicia', acronimo: 'MINJUS', activa: true }
    ]))
  };

  const mockAuthService = {
    obtenerSesion: vi.fn(() => ({
      ciudadanoId: 5,
      nombre: 'Juan Pérez Quispe',
      dni: '44556677',
      email: 'juan.perez@example.pe',
      tipoPersona: 'NATURAL'
    }))
  };

  const mockDocumentoService = {
    upload: vi.fn(() => of({ id: 99, nombreOriginal: 'archivo.pdf' }))
  };

  const mockRouter = {
    navigate: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [NuevaSaipComponent],
      providers: [
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: mockRouter },
        { provide: SolicitudService, useValue: mockSolicitudService },
        { provide: EntidadService, useValue: mockEntidadService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: DocumentoService, useValue: mockDocumentoService }
      ]
    }).compileComponents();
  });

  it('debería inicializar el componente y cargar sesión visual y entidades', () => {
    const fixture = TestBed.createComponent(NuevaSaipComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.sesionVisual().nombre).toBe('Juan Pérez Quispe');
    expect(component.sesionVisual().dni).toBe('44556677');
    expect(component.docLabel()).toBe('DNI');
    expect(component.docNumero()).toBe('44556677');
    expect(component.entidades().length).toBe(2);
  });

  it('debería validar canSubmit() correctamente según los campos obligatorios', () => {
    const fixture = TestBed.createComponent(NuevaSaipComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    // Al inicio está incompleto
    expect(component.canSubmit()).toBe(false);

    // Completar campos mínimos
    component.entidadId = 1;
    component.asunto = 'Solicitud de presupuesto anual';
    component.descripcion = 'Requiero detalle de partidas presupuestales 2025';
    component.medioNotificacion = 'correo';
    component.aceptaCorreo = true;

    expect(component.canSubmit()).toBe(true);

    // Si desmarca todos los formatos de entrega
    component.formatoRespuesta = {
      correo: false,
      copiaSimple: false,
      copiaCertificada: false,
      soporteMagnetico: false
    };
    expect(component.canSubmit()).toBe(false);

    // Volver a activar formato
    component.formatoRespuesta.correo = true;
    expect(component.canSubmit()).toBe(true);

    // Si selecciona Otros pero no escribe temaOtro
    component.tema = 'Otros';
    component.temaOtro = '';
    expect(component.canSubmit()).toBe(false);

    component.temaOtro = 'Procesos disciplinarios';
    expect(component.canSubmit()).toBe(true);
  });

  it('debería cambiar el medio de notificación y ajustar consentimientos', () => {
    const fixture = TestBed.createComponent(NuevaSaipComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.seleccionarMedioNotificacion('fisica');
    expect(component.medioNotificacion).toBe('fisica');
    expect(component.aceptaFisica).toBe(true);

    component.seleccionarMedioNotificacion('correo');
    expect(component.medioNotificacion).toBe('correo');
    expect(component.aceptaCorreo).toBe(true);
  });

  it('debería guardar y restaurar borrador en localStorage', () => {
    const fixture = TestBed.createComponent(NuevaSaipComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.entidadId = 2;
    component.asunto = 'Borrador de prueba';
    component.descripcion = 'Descripción preliminar';
    component.guardarBorrador();

    expect(component.draftModalAbierto()).toBe(true);
    const stored = JSON.parse(localStorage.getItem('saip.borrador') || '{}');
    expect(stored.asunto).toBe('Borrador de prueba');
    expect(stored.entidadId).toBe(2);
  });

  it('debería abrir modal de confirmación si handleSubmit(false) es válido', () => {
    const fixture = TestBed.createComponent(NuevaSaipComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.entidadId = 1;
    component.asunto = 'Asunto formal';
    component.descripcion = 'Descripción detallada';
    component.formatoRespuesta.correo = true;
    component.medioNotificacion = 'correo';
    component.aceptaCorreo = true;

    component.handleSubmit(false);
    expect(component.confirmModalAbierto()).toBe(true);
    expect(component.error()).toBe('');
  });

  it('debería registrar solicitud y subir adjuntos en crearSolicitud()', async () => {
    const fixture = TestBed.createComponent(NuevaSaipComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.entidadId = 1;
    component.asunto = 'Asunto para envío';
    component.descripcion = 'Descripción para envío';
    component.formatoRespuesta.correo = true;
    component.medioNotificacion = 'correo';
    component.aceptaCorreo = true;

    const dummyFile = new File(['dummy content'], 'sustento.pdf', { type: 'application/pdf' });
    component.adjunto.set(dummyFile);

    component.crearSolicitud();
    // Permitir resolución de microtareas asíncronas
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockSolicitudService.crear).toHaveBeenCalled();
    expect(mockDocumentoService.upload).toHaveBeenCalledWith(
      dummyFile,
      'SOLICITUD_ORIGINAL',
      { solicitudId: 101 }
    );
    expect(component.successModalAbierto()).toBe(true);
    expect(component.expedienteCreado()).toBe('SAIP-2026-00101');
  });

  it('debería resetear formulario correctamente en resetForm()', () => {
    const fixture = TestBed.createComponent(NuevaSaipComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.entidadId = 1;
    component.asunto = 'Texto';
    component.descripcion = 'Texto';
    component.resetForm();

    expect(component.entidadId).toBeNull();
    expect(component.asunto).toBe('');
    expect(component.descripcion).toBe('');
    expect(component.adjunto()).toBeNull();
  });
});
