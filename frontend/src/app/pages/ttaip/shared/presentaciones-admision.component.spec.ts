import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import type { ConsultaAdmision, InformacionComplementaria, SolicitudComplementaria } from '../../../services/ttaip-actuaciones.service';
import { InformacionComplementariaComponent } from './informacion-complementaria.component';
import { PresentacionesAdmisionComponent } from './presentaciones-admision.component';

describe('Presentaciones de admisión', () => {
  const url = `${environment.apiUrl}/ttaip/expedientes/41/presentaciones-admision`;
  const consulta: ConsultaAdmision = {
    puedePresentarSolicitudes: true, puedeResponderInformeOral: false, fechaLimiteResolucion: '2026-12-17',
    descargo: { id: 8, estado: 'REQUERIDO', fechaLimite: '2026-12-01', fechaPresentacion: null, resumen: null,
      referencia: null, puedePresentar: true },
    presentaciones: [],
  };
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PresentacionesAdmisionComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try { http.verify({ ignoreCancelled: true }); }
    finally { TestBed.resetTestingModule(); }
  });

  function cargar(contexto: 'entidad' | 'ciudadano', datos = consulta) {
    const fixture = TestBed.createComponent(PresentacionesAdmisionComponent);
    fixture.componentRef.setInput('expedienteId', 41);
    fixture.componentRef.setInput('contexto', contexto);
    fixture.detectChanges();
    http.expectOne(url).flush(datos);
    fixture.detectChanges();
    return fixture;
  }

  it('la entidad presenta el oficio y todos los anexos en una sola operación recuperable', () => {
    const fixture = cargar('entidad');
    const formulario = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('Descargos requeridos por el Tribunal');
    formulario.abrir('DESCARGOS', 8);
    formulario.oficio.setValue('123-ENTIDAD');
    formulario.archivo.set(new File(['oficio'], 'oficio.pdf'));
    formulario.anexos.set([new File(['a'], 'primero.pdf'), new File(['b'], 'segundo.pdf')]);
    fixture.detectChanges();
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    const envio = http.expectOne({ url, method: 'POST' });
    const body: FormData = envio.request.body;
    expect(body.get('descargoId')).toBe('8');
    expect(body.get('numeroOficio')).toBe('123-ENTIDAD');
    expect(body.getAll('anexos').map(file => (file as File).name)).toEqual(['primero.pdf', 'segundo.pdf']);
    envio.error(new ProgressEvent('error'));
    const recibida = { id: 22, operacion: body.get('operacion'), tipo: 'DESCARGOS', numeroOficio: '123-ENTIDAD',
      fechaPresentacion: '2026-11-21T15:11:00', documentos: [{ id: 1, nombreOriginal: 'oficio.pdf' }, { id: 2, nombreOriginal: 'primero.pdf' }] };
    http.expectOne({ url, method: 'GET' }).flush({ ...consulta,
      descargo: { ...consulta.descargo, estado: 'PRESENTADO', puedePresentar: false },
      presentaciones: [recibida],
    });
    fixture.detectChanges();
    expect(formulario.pendiente()).toBeNull();
    const dialogo = document.body.querySelector('[role="dialog"][aria-label="Descargos presentados"]');
    expect(dialogo?.textContent).toContain('123-ENTIDAD');
    expect(dialogo?.textContent).toContain('primero.pdf');
    expect(dialogo?.textContent).toContain('21/11/2026 15:11');
    expect(fixture.nativeElement.textContent).not.toContain('Presentar descargos');
    http.expectNone({ url, method: 'POST' });
  });

  it.each([
    ['INFORME_ORAL', 'Solicitar informe oral', 'Solicitud de informe oral presentada', 'Presentar otra solicitud de informe oral'],
    ['DOCUMENTACION_ADICIONAL', 'Presentar documentación adicional', 'Documentación adicional presentada', 'Presentar más documentación adicional'],
  ])('envía %s desde el botón y deja otra presentación disponible', (tipo, abrir, confirmado, nuevo) => {
    const fixture = cargar('entidad');
    const root = fixture.nativeElement as HTMLElement;
    Array.from(root.querySelectorAll('button')).find(b => b.textContent.includes(abrir))!.click();
    fixture.detectChanges();
    const componente = fixture.componentInstance;
    componente.texto.setValue('Detalle del escrito enviado');
    if (tipo === 'DOCUMENTACION_ADICIONAL') {
      componente.oficio.setValue('OF-002');
      componente.archivo.set(new File(['documento'], 'anexo.pdf', { type: 'application/pdf' }));
    }
    fixture.detectChanges();
    const form = root.querySelector('form')!;
    expect(form.querySelector('app-multi-file-upload-zone')).not.toBeNull();
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    const post = http.expectOne({ url, method: 'POST' });
    const body: FormData = post.request.body;
    expect(body.get('tipo')).toBe(tipo);
    expect(body.get('texto')).toBe('Detalle del escrito enviado');
    const registrado = { id: 23, operacion: body.get('operacion'), tipo, origen: 'ENTIDAD_PUBLICA',
      numeroOficio: body.get('numeroOficio'), texto: body.get('texto'),
      fechaPresentacion: '2026-11-21T15:12:00', documentos: tipo === 'INFORME_ORAL' ? [] : [{ id: 33, nombreOriginal: 'anexo.pdf' }] };
    post.flush(registrado);
    http.expectOne({ url, method: 'GET' }).flush({ ...consulta, presentaciones: [registrado] });
    fixture.detectChanges();
    const dialogo = document.body.querySelector('[role="dialog"][aria-label="' + confirmado + '"]');
    expect(dialogo?.textContent).toContain('Detalle del escrito enviado');
    (dialogo?.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.body.querySelector('[role="dialog"][aria-label="' + confirmado + '"]')).toBeNull();
    expect(root.querySelector('article')?.textContent).toContain('Detalle del escrito enviado');
    const boton = Array.from(root.querySelectorAll('button')).find(b => b.textContent.includes(nuevo))!;
    expect(boton.disabled).toBe(false);
    expect(root.querySelector('article')!.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('el administrado consulta la programación y solo ve el formulario después de la admisión acreditada', () => {
    const fixture = cargar('ciudadano', { ...consulta, puedePresentarSolicitudes: false, descargo: null });
    expect(fixture.nativeElement.textContent).not.toContain('Solicitar informe oral');
    fixture.componentInstance.consultar();
    http.expectOne(url).flush({ ...consulta, descargo: null, presentaciones: [{
      id: 22, tipo: 'INFORME_ORAL', origen: 'ENTIDAD_PUBLICA', aceptada: true, documentos: [],
      respuesta: { id: 71, nombreOriginal: 'programacion.pdf' },
    }] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Solicitar informe oral');
    expect(fixture.nativeElement.textContent).toContain('Informe oral programado');
    expect(fixture.nativeElement.querySelector('button[aria-label="Previsualizar programacion.pdf"]')).not.toBeNull();
  });
});


describe('Constancia de información complementaria', () => {
  const url = environment.apiUrl + '/ttaip/expedientes/41/informacion-complementaria';
  const solicitud: SolicitudComplementaria = {
    id: 29, etapa: 'RESOLUCION_FINAL', estado: 'PENDIENTE', solicitud: 'Acreditar la fecha de entrega',
    fechaSolicitud: '2026-11-21', fechaLimite: '2026-11-25', fechaRespuesta: null, respuesta: null,
    adjuntos: [], adjuntosRespuesta: [],
  };
  const datos: InformacionComplementaria = {
    etapa: 'RESOLUCION_FINAL', entidad: 'Entidad sintética', puedeSolicitar: true,
    fechaLimiteCalificacion: '2026-12-17', diasSuspendidos: 0, solicitudes: [],
  };
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [InformacionComplementariaComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try { http.verify(); }
    finally { TestBed.resetTestingModule(); }
  });

  function cargar(tribunal: boolean) {
    const fixture = TestBed.createComponent(InformacionComplementariaComponent);
    fixture.componentRef.setInput('expedienteId', 41);
    fixture.componentRef.setInput('tribunal', tribunal);
    fixture.detectChanges();
    http.expectOne(url).flush({ ...datos, solicitudes: tribunal ? [] : [solicitud] });
    fixture.detectChanges();
    return fixture;
  }

  it('confirma el requerimiento de resolución final con su fecha límite', () => {
    const fixture = cargar(true);
    fixture.componentInstance.abrir(null);
    fixture.componentInstance.texto.setValue(solicitud.solicitud);
    fixture.componentInstance.enviar();
    http.expectOne({ url, method: 'POST' }).flush({ ...datos, puedeSolicitar: false, solicitudes: [solicitud] });
    fixture.detectChanges();
    const dialogo = document.body.querySelector('[aria-label="Solicitud de información complementaria enviada"]');
    expect(dialogo?.textContent).toContain(solicitud.solicitud);
    expect(dialogo?.textContent).toContain('25/11/2026');
  });

  it('espera hasta recuperar la respuesta exacta antes de confirmar un envío incierto', () => {
    const fixture = cargar(false);
    const c = fixture.componentInstance;
    c.abrir(29);
    c.texto.setValue('Respuesta registrada');
    c.enviar();
    http.expectOne({ url: url + '/29/respuesta', method: 'POST' }).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(c.confirmado()).toBeNull();
    c.consultar();
    http.expectOne(url).flush({ ...datos, solicitudes: [{ ...solicitud, estado: 'RESPONDIDA',
      respuesta: 'Respuesta registrada', fechaRespuesta: '2026-11-21T17:00:00', adjuntosRespuesta: [
        { id: 42, nombreOriginal: 'respuesta.pdf' },
      ] }] });
    fixture.detectChanges();
    const dialogo = document.body.querySelector('[aria-label="Información complementaria presentada"]');
    expect(dialogo?.textContent).toContain('Respuesta registrada');
    expect(dialogo?.textContent).toContain('respuesta.pdf');
  });
});
