import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NuevaSaipComponent } from './nueva-saip.component';
import { SolicitudService } from '../../services/solicitud.service';
import { EntidadService } from '../../services/entidad.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { Solicitud, SolicitudCreate } from '../../models/solicitud.model';
import type { AltaSaipRecepcionDTO } from '../../api/types';
import type { TipoDocumento } from '../../models/documento.model';

describe('NuevaSaipComponent', () => {
  let ultimaRecepcion: AltaSaipRecepcionDTO;
  const mockSolicitudService = {
    registrarAlta: vi.fn((clave: string, datos: SolicitudCreate, declaraVeracidad: boolean, archivos: { file: File; tipo: TipoDocumento }[]) => {
      ultimaRecepcion = { id: 201, claveOperacion: clave, declaraVeracidad, fechaRecepcion: '2026-10-28T10:00:00',
        solicitud: { ...datos, id: 101, expediente: 'SAIP-2026-00101' }, documentos: archivos.map((a, i) => ({
          id: 99 + i, solicitudId: 101, tipoDocumento: a.tipo, nombreOriginal: a.file.name, estado: 'ACTIVO', sizeBytes: a.file.size, hashSha256: 'a'.repeat(64)
        })) };
      return of(ultimaRecepcion);
    }),
    obtenerRecepcionAlta: vi.fn(() => of(ultimaRecepcion))
  };

  const mockEntidadService = {
    findActivas: vi.fn(() => of([
      { id: 1, nombre: 'Ministerio de Educación', acronimo: 'MINEDU', activa: true },
      { id: 2, nombre: 'Ministerio de Justicia', acronimo: 'MINJUS', activa: true }
    ]))
  };

  const mockAuthService = {
    getToken: () => 'sesion-sintetica',
    cambiosSesion: signal(1),
    obtenerSesion: vi.fn(() => ({
      ciudadanoId: 5,
      nombre: 'Juan Pérez Quispe',
      dni: '44556677',
      email: 'juan.perez@example.pe',
      tipoPersona: 'NATURAL'
    }))
  };

  const mockDocumentoService = {
    upload: vi.fn(() => of({ id: 99, nombreOriginal: 'sustento.pdf', solicitudId: 101, tipoDocumento: 'SOLICITUD_ORIGINAL', estado: 'ACTIVO', sizeBytes: 13, hashSha256: 'a'.repeat(64) }))
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
    component.consentimientoDatosPersonales = true; component.declaraVeracidad = true;
    component.formatoRespuesta.correo = true;

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

    component.tema = 'x'.repeat(101);
    expect(component.canSubmit()).toBe(false);

    component.tema = 'Procesos disciplinarios';
    expect(component.canSubmit()).toBe(true);
  });

  it('debería cambiar el medio sin aceptar consentimientos silenciosamente', () => {
    const fixture = TestBed.createComponent(NuevaSaipComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.seleccionarMedioNotificacion('fisica');
    expect(component.medioNotificacion).toBe('fisica');
    expect(component.aceptaFisica).toBe(false);

    component.seleccionarMedioNotificacion('correo');
    expect(component.medioNotificacion).toBe('correo');
    expect(component.aceptaCorreo).toBe(false);
  });

  it('debería informar que el borrador permanece solo en memoria', () => {
    const fixture = TestBed.createComponent(NuevaSaipComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.entidadId = 2;
    component.asunto = 'Borrador de prueba';
    component.descripcion = 'Descripción preliminar';
    component.guardarBorrador();

    expect(component.draftModalAbierto()).toBe(true);
    expect(localStorage.getItem('saip.borrador')).toBeNull();
    expect(component.asunto).toBe('Borrador de prueba');
    expect(component.entidadId).toBe(2);
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
    component.consentimientoDatosPersonales = true; component.declaraVeracidad = true;

    component.handleSubmit(false);
    expect(component.confirmModalAbierto()).toBe(true);
    expect(component.error()).toBe('');
  });

  it('debería registrar solicitud y adjuntos coordinados y recuperar su recepción', async () => {
    const fixture = TestBed.createComponent(NuevaSaipComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.entidadId = 1;
    component.asunto = 'Asunto para envío';
    component.descripcion = 'Descripción para envío';
    component.formatoRespuesta.correo = true;
    component.medioNotificacion = 'correo';
    component.aceptaCorreo = true;
    component.consentimientoDatosPersonales = true; component.declaraVeracidad = true;

    const dummyFile = new File(['dummy content'], 'sustento.pdf', { type: 'application/pdf' });
    component.adjunto.set(dummyFile);

    component.crearSolicitud();
    // Permitir resolución de microtareas asíncronas
    await fixture.whenStable();

    expect(mockSolicitudService.registrarAlta).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ ciudadanoId: 5 }), true,
      [expect.objectContaining({ file: dummyFile, tipo: 'SOLICITUD_ORIGINAL' })]);
    expect(mockDocumentoService.upload).not.toHaveBeenCalled();
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
