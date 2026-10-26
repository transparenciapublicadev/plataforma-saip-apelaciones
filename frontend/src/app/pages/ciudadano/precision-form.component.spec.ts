import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError, TimeoutError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrecisionFormComponent } from './precision-form.component';
import { SolicitudService } from '../../services/solicitud.service';
import { DocumentoService } from '../../services/documento.service';
import { AuthService } from '../../services/auth.service';
import { ObservacionSolicitud, Solicitud } from '../../models/solicitud.model';
import { PrecisionSaipRecepcion, PrecisionSaipService } from '../../services/precision-saip.service';

const comentario = 'Preciso el periodo solicitado.';
const observacion = {
  id: 9, solicitudId: 23, estado: 'PENDIENTE_SUBSANACION',
  motivoObservacion: 'Precise el periodo.', fechaObservacion: '2026-10-21T09:00:00', fechaLimiteSubsanacion: '2026-10-23'
} as ObservacionSolicitud;
const solicitud = {
  id: 23, expediente: 'SAIP-2026-00023', estado: 'PENDIENTE_INFORMACION',
  observaciones: [observacion], documentos: [], documentosMetadata: []
} as unknown as Solicitud;

function recepcion(claveOperacion: string): PrecisionSaipRecepcion {
  return {
    solicitudId: 23, observacionId: 9, claveOperacion, comentario, estado: 'SUBSANADA', fechaRecepcion: '2026-10-21T09:30:00',
    documento: {
      id: 88, solicitudId: 23, nombreOriginal: 'precision.pdf', tipoDocumento: 'SUBSANACION',
      contentType: 'application/pdf', sizeBytes: 18, hashSha256: 'a'.repeat(64), estado: 'ACTIVO', fechaCreacion: '2026-10-21T09:30:00'
    }
  };
}

describe('PrecisionFormComponent — recepción verificable', () => {
  const solicitudService = { subsanar: vi.fn(), findByExpediente: vi.fn() };
  const precisionService = { enviar: vi.fn(), consultar: vi.fn() };
  const documentoService = { download: vi.fn() };
  const auth = { obtenerSesion: vi.fn(), getToken: vi.fn(), cambiosSesion: signal(0) };
  const route = { snapshot: { paramMap: convertToParamMap({ expediente: 'SAIP-2026-00023' }) },
    paramMap: new BehaviorSubject(convertToParamMap({ expediente: 'SAIP-2026-00023' })) };

  beforeEach(async () => {
    vi.resetAllMocks();
    sessionStorage.clear();
    route.snapshot.paramMap = convertToParamMap({ expediente: 'SAIP-2026-00023' });
    route.paramMap.next(route.snapshot.paramMap);
    auth.cambiosSesion.set(0);
    auth.getToken.mockReturnValue('sesion-sintetica');
    auth.obtenerSesion.mockReturnValue({ usuarioId: 17, tipoUsuario: 'CIUDADANO' });
    solicitudService.findByExpediente.mockReturnValue(of(solicitud));
    precisionService.consultar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    precisionService.enviar.mockImplementation((_s: number, _o: number, clave: string) => of(recepcion(clave)));
    await TestBed.configureTestingModule({
      imports: [PrecisionFormComponent],
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: SolicitudService, useValue: solicitudService },
        { provide: DocumentoService, useValue: documentoService },
        { provide: AuthService, useValue: auth },
        { provide: PrecisionSaipService, useValue: precisionService }
      ]
    }).overrideComponent(PrecisionFormComponent, { set: { template: '' } }).compileComponents();
  });

  function formulario(): PrecisionFormComponent {
    const component = TestBed.createComponent(PrecisionFormComponent).componentInstance;
    component.cargarDatos(solicitud.expediente);
    component.respuesta.set(comentario);
    component.archivoSeleccionado.set(new File(['%PDF-1.4\nprecision'], 'precision.pdf', { type: 'application/pdf' }));
    return component;
  }

  it('no confirma éxito cuando el backend rechaza el envío', () => {
    const component = formulario();
    const archivo = component.archivoSeleccionado();
    precisionService.enviar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component.confirmarEnvio();
    expect(component.successModalAbierto()).toBe(false);
    expect(component.documentosExpediente()).toEqual([]);
    expect(component.respuesta()).toBe(comentario);
    expect(component.archivoSeleccionado()).toBe(archivo);
    expect(precisionService.consultar).toHaveBeenCalledOnce();
    expect(solicitudService.subsanar).not.toHaveBeenCalled();
  });

  it('confirma únicamente una recepción con observación y documento registrados en el servidor', () => {
    const component = formulario();
    const archivo = component.archivoSeleccionado();
    component.confirmarEnvio();
    expect(precisionService.enviar).toHaveBeenCalledWith(23, 9, expect.any(String), comentario, archivo);
    expect(component.successModalAbierto()).toBe(true);
    expect(component.recepcion()?.documento.id).toBe(88);
    expect(component.documentosExpediente()).toEqual([expect.objectContaining({ id: 88, nombre: 'precision.pdf' })]);
    expect(component.solicitud()?.estado).toBe('PENDIENTE_INFORMACION');
    expect(component.subsanacionSuccessMetadata()).toContainEqual({ label: 'Documento registrado', value: '88', mono: true });
  });

  it.each([400, 401, 403, 404, 409, 413, 415, 422])('un error HTTP %s conserva el formulario y no confirma éxito', (status) => {
    const component = formulario();
    const archivo = component.archivoSeleccionado();
    precisionService.enviar.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error: { detail: 'No recibido' } })));
    component.confirmarEnvio();
    expect(component.successModalAbierto()).toBe(false);
    expect(component.recepcion()).toBeNull();
    expect(component.documentosExpediente()).toEqual([]);
    expect(component.error()).not.toBe('');
    expect(component.loadingEnvio()).toBe(false);
    expect(component.respuesta()).toBe(comentario);
    expect(component.archivoSeleccionado()).toBe(archivo);
    expect(precisionService.consultar).not.toHaveBeenCalled();
  });

  it.each([0, 500, 503])('consulta la recepción tras error incierto %s antes de permitir repetir', (status) => {
    const component = formulario();
    precisionService.enviar.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    component.confirmarEnvio();
    const clave = precisionService.enviar.mock.calls[0][2];
    expect(precisionService.consultar).toHaveBeenCalledWith(23, 9, clave);
    expect(component.successModalAbierto()).toBe(false);
    expect(component.verificacionPendiente()).toBe(false);
    expect(component.error()).toContain('misma clave');
    precisionService.enviar.mockImplementation((_s: number, _o: number, key: string) => of(recepcion(key)));
    component.confirmarEnvio();
    expect(precisionService.enviar.mock.calls[1][2]).toBe(clave);
    expect(component.successModalAbierto()).toBe(true);
    expect(component.documentosExpediente()).toHaveLength(1);
  });

  it('un timeout mantiene la operación incierta si tampoco puede comprobarla y no repite POST', () => {
    const component = formulario();
    const archivo = component.archivoSeleccionado();
    precisionService.enviar.mockReturnValue(throwError(() => new TimeoutError()));
    precisionService.consultar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    component.confirmarEnvio();
    expect(component.verificacionPendiente()).toBe(true);
    expect(component.formularioBloqueado()).toBe(true);
    component.confirmarEnvio();
    component.removerArchivo();
    expect(precisionService.enviar).toHaveBeenCalledOnce();
    expect(precisionService.consultar).toHaveBeenCalledTimes(2);
    expect(component.archivoSeleccionado()).toBe(archivo);
    expect(component.successModalAbierto()).toBe(false);
  });

  it('tras un envío incierto y consulta 404 conserva el contenido y rechaza cambiar el archivo del reintento', () => {
    const component = formulario();
    const archivo = component.archivoSeleccionado();
    precisionService.enviar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    component.confirmarEnvio();
    expect(component.formularioBloqueado()).toBe(true);
    expect(component.puedeEnviar()).toBe(true);
    component.removerArchivo();
    expect(component.archivoSeleccionado()).toBe(archivo);
    component.archivoSeleccionado.set(new File(['otro'], 'otro.txt', { type: 'text/plain' }));
    component.confirmarEnvio();
    expect(precisionService.enviar).toHaveBeenCalledOnce();
    expect(component.successModalAbierto()).toBe(false);
    expect(component.error()).toContain('mismo comentario y archivo');
  });

  it('recupera una recepción confirmada tras pérdida de respuesta sin volver a enviar', () => {
    const component = formulario();
    precisionService.enviar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    precisionService.consultar.mockImplementation((_s: number, _o: number, clave: string) => of(recepcion(clave)));
    component.confirmarEnvio();
    expect(precisionService.enviar).toHaveBeenCalledOnce();
    expect(component.successModalAbierto()).toBe(true);
    expect(component.documentosExpediente()[0].id).toBe(88);
    component.confirmarEnvio();
    expect(precisionService.enviar).toHaveBeenCalledOnce();
  });

  it('bloquea el doble clic mientras la transferencia sigue en curso', () => {
    const component = formulario();
    const pendiente = new Subject<PrecisionSaipRecepcion>();
    precisionService.enviar.mockReturnValue(pendiente);
    component.confirmarEnvio();
    component.confirmarEnvio();
    expect(precisionService.enviar).toHaveBeenCalledOnce();
    expect(component.successModalAbierto()).toBe(false);
    pendiente.next(recepcion(precisionService.enviar.mock.calls[0][2]));
    expect(component.successModalAbierto()).toBe(true);
  });

  it.each(['solicitud', 'observacion', 'clave', 'documento', 'hash', 'null', 'tamano', 'fecha'])('no acepta una recepción incorrecta de %s', (campo) => {
    const component = formulario();
    precisionService.enviar.mockImplementation((_s: number, _o: number, clave: string) => {
      const result = recepcion(clave);
      if (campo === 'solicitud') result.solicitudId = 24;
      if (campo === 'observacion') result.observacionId = 10;
      if (campo === 'clave') result.claveOperacion = crypto.randomUUID();
      if (campo === 'documento') result.documento.solicitudId = 24;
      if (campo === 'hash') result.documento.hashSha256 = '';
      if (campo === 'tamano') result.documento.sizeBytes = 99;
      if (campo === 'fecha') result.fechaRecepcion = 'fecha inválida';
      if (campo === 'null') return of(null);
      return of(result);
    });
    component.confirmarEnvio();
    expect(component.successModalAbierto()).toBe(false);
    expect(component.documentosExpediente()).toEqual([]);
    expect(component.verificacionPendiente()).toBe(true);
  });

  it.each(['comentario', 'largo', 'archivo', 'vacio', 'tipo', 'observacion', 'sesion'])('rechaza validación %s sin realizar ninguna recepción', (campo) => {
    const component = formulario();
    if (campo === 'comentario') component.respuesta.set(' ');
    if (campo === 'largo') component.respuesta.set('a'.repeat(3001));
    if (campo === 'archivo') component.archivoSeleccionado.set(null);
    if (campo === 'vacio') component.archivoSeleccionado.set(new File([], 'vacio.pdf', { type: 'application/pdf' }));
    if (campo === 'tipo') component.archivoSeleccionado.set(new File(['x'], 'archivo.zip', { type: 'application/zip' }));
    if (campo === 'observacion') component.observacionSeleccionada.set(null);
    if (campo === 'sesion') auth.obtenerSesion.mockReturnValue(null);
    component.confirmarEnvio();
    expect(precisionService.enviar).not.toHaveBeenCalled();
    expect(component.successModalAbierto()).toBe(false);
    expect(component.error()).not.toBe('');
  });

  it('acepta el límite backend de 3000 caracteres', () => {
    const component = formulario();
    component.respuesta.set('a'.repeat(3000));
    precisionService.enviar.mockImplementation((_s: number, _o: number, clave: string, comentarioRecibido: string) =>
      of({ ...recepcion(clave), comentario: comentarioRecibido }));
    component.confirmarEnvio();
    expect(component.successModalAbierto()).toBe(true);
  });

  it('persiste solo identificadores para recuperar la recepción al recargar', () => {
    const component = formulario();
    component.confirmarEnvio();
    const clave = precisionService.enviar.mock.calls[0][2];
    const almacenado = sessionStorage.getItem('yaiku:precision:17:23:9')!;
    expect(JSON.parse(almacenado)).toEqual({ solicitudId: 23, observacionId: 9, claveOperacion: clave });
    expect(almacenado).not.toContain(comentario);
    expect(almacenado).not.toContain('precision.pdf');
    solicitudService.findByExpediente.mockReturnValue(of({ ...solicitud, observaciones: [{ ...observacion, estado: 'SUBSANADA' }] }));
    precisionService.consultar.mockReturnValue(of(recepcion(clave)));
    const recargado = TestBed.createComponent(PrecisionFormComponent).componentInstance;
    recargado.ngOnInit();
    expect(precisionService.consultar).toHaveBeenCalledWith(23, 9, clave);
    expect(recargado.recepcion()?.documento.id).toBe(88);
    expect(recargado.successModalAbierto()).toBe(true);
    expect(precisionService.enviar).toHaveBeenCalledOnce();
  });

  it('tras recargar una recepción ausente reintenta con la misma clave y archivo seleccionado de nuevo', () => {
    const clave = crypto.randomUUID();
    sessionStorage.setItem('yaiku:precision:17:23:9', JSON.stringify({ solicitudId: 23, observacionId: 9, claveOperacion: clave }));
    const component = formulario();
    component.ngOnInit();
    component.respuesta.set(comentario);
    component.archivoSeleccionado.set(new File(['%PDF-1.4\nprecision'], 'precision.pdf', { type: 'application/pdf' }));
    component.confirmarEnvio();
    expect(precisionService.enviar).toHaveBeenCalledWith(23, 9, clave, comentario, component.archivoSeleccionado());
  });

  it('una sesión distinta no recupera la clave del ciudadano anterior', () => {
    sessionStorage.setItem('yaiku:precision:17:23:9', JSON.stringify({ solicitudId: 23, observacionId: 9, claveOperacion: crypto.randomUUID() }));
    auth.obtenerSesion.mockReturnValue({ usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    const component = formulario();
    component.ngOnInit();
    expect(precisionService.consultar).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 500])('no inventa una solicitud ni documentos al fallar su carga con %s', (status) => {
    solicitudService.findByExpediente.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    const component = TestBed.createComponent(PrecisionFormComponent).componentInstance;
    component.ngOnInit();
    expect(component.solicitud()).toBeNull();
    expect(component.documentosExpediente()).toEqual([]);
    expect(component.puedeEnviar()).toBe(false);
    expect(component.successModalAbierto()).toBe(false);
  });

  it('no inventa ID de observación cuando no existe una pendiente', () => {
    solicitudService.findByExpediente.mockReturnValue(of({ ...solicitud, observaciones: [] }));
    const component = formulario();
    component.ngOnInit();
    component.confirmarEnvio();
    expect(precisionService.enviar).not.toHaveBeenCalled();
    expect(component.observacion()).toBe('');
  });

  it('muestra la fecha límite del servidor sin recalcularla ni desplazarla por zona horaria', () => {
    const component = formulario();
    component.ngOnInit();
    expect(component.fechaLimite()).toBe('23/10/2026');
  });

  it('rechaza acceso directo sin código SAIP en la ruta', () => {
    route.snapshot.paramMap = convertToParamMap({});
    route.paramMap.next(route.snapshot.paramMap);
    const component = TestBed.createComponent(PrecisionFormComponent).componentInstance;
    component.ngOnInit();
    expect(solicitudService.findByExpediente).not.toHaveBeenCalled();
    expect(component.puedeEnviar()).toBe(false);
    expect(component.error()).toContain('identificado');
  });

  it('recupera para vista previa los bytes del documento registrado mediante DocumentoService', () => {
    const component = formulario();
    component.confirmarEnvio();
    const blob = new Blob(['%PDF-1.4\nprecision'], { type: 'application/pdf' });
    documentoService.download.mockReturnValue(of({ blob, filename: 'precision.pdf' }));
    component.abrirDoc(component.documentosExpediente()[0], false);
    expect(documentoService.download).toHaveBeenCalledWith(88, 'precision.pdf');
    expect(component.previewTarget()?.blob).toBe(blob);
  });

  it('un fallo de descarga no abre un PDF canónico ni otro archivo', () => {
    const component = formulario();
    component.documentosExpediente.set([{ id: 88, nombre: 'precision.pdf', kind: 'subsanacion' }]);
    documentoService.download.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    component.abrirDoc({ id: 88, nombre: 'precision.pdf', kind: 'subsanacion' }, false);
    expect(component.isPreviewOpen()).toBe(false);
    expect(component.previewTarget()).toBeNull();
    expect(component.error()).toContain('permiso');
  });
});
