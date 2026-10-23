import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ComplianceTrackingComponent } from './compliance-tracking.component';
import { TtaipService } from '../../services/ttaip.service';
import { AuthService } from '../../services/auth.service';

describe('Cumplimiento TTAIP: datos y actuaciones del servidor', () => {
  const apelacion = { id: 7, expediente: '00007-2026-JUS/TTAIP', expedienteTtaip: { id: 91 },
    resolucion: { decision: 'FUNDADO' } };
  const registro = { id: 45, expedienteTtaipId: 91, apelacionId: 7, resolucionId: 32,
    numeroExpediente: '00007-2026-JUS/TTAIP', entidadNombre: 'Entidad de prueba',
    decisionResolucion: 'FUNDADO', estadoCumplimiento: 'CUMPLIDO',
    fechaLimiteCumplimiento: '2026-10-29', trazabilidad: 'Comunicación registrada' };
  let servicio: { getResueltas: ReturnType<typeof vi.fn>; listarCumplimientos: ReturnType<typeof vi.fn>;
    observarCumplimiento: ReturnType<typeof vi.fn>; cerrarCumplimiento: ReturnType<typeof vi.fn> };
  let token: string;
  const cambiosSesion = signal(0);
  beforeEach(() => {
    token = 'sesion-a';
    servicio = { getResueltas: vi.fn(() => of([apelacion])), listarCumplimientos: vi.fn(() => of([registro])),
      observarCumplimiento: vi.fn(() => of({ ...registro, estadoCumplimiento: 'OBSERVADO' })),
      cerrarCumplimiento: vi.fn(() => of({ ...registro, estadoCumplimiento: 'CERRADO' })) };
    TestBed.configureTestingModule({ imports: [ComplianceTrackingComponent], providers: [provideRouter([]),
      { provide: TtaipService, useValue: servicio },
      { provide: AuthService, useValue: { obtenerSesion: () => ({ tipoUsuario: 'TTAIP' }), getTipoUsuario: () => 'TTAIP',
        getToken: () => token, cambiosSesion } }] });
  });
  function pagina() {
    const fixture = TestBed.createComponent(ComplianceTrackingComponent);
    fixture.detectChanges();
    return fixture;
  }
  it('el vacío no se convierte en expedientes de demostración', () => {
    servicio.getResueltas.mockReturnValue(of([]));
    expect(pagina().componentInstance.items()).toEqual([]);
  });
  it('un error no se convierte en expedientes encontrados', () => {
    servicio.getResueltas.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    expect(pagina().componentInstance.items()).toEqual([]);
  });
  it('el estado procede del seguimiento persistido, no de la posición en la lista', () => {
    expect(pagina().componentInstance.items()[0].estado).toBe('cumplido');
    expect(servicio.listarCumplimientos).toHaveBeenCalledWith(91);
  });
  it('observar exige un comando y recuperación, sin confirmar cambios locales', () => {
    const c = pagina().componentInstance;
    const respuesta = new Subject();
    servicio.observarCumplimiento.mockReturnValue(respuesta);
    c.observacionesInput.set('La evidencia no acredita entrega completa');
    c.actualizarEstado('observado');
    expect(servicio.observarCumplimiento).toHaveBeenCalledWith(91, 45,
      { observacion: 'La evidencia no acredita entrega completa' });
    expect(c.items()[0].estado).toBe('cumplido');
    expect(c.toastMensaje()).toBeNull();
  });
  it.each([400, 401, 403, 404, 500, 503, 0])('distingue error %s sin datos anteriores ni un vacío confirmado', status => {
    const fixture = pagina();
    servicio.listarCumplimientos.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    fixture.componentInstance.cargarSeguimientos();
    fixture.detectChanges();
    expect(fixture.componentInstance.items()).toEqual([]);
    expect(fixture.componentInstance.estadoConsulta()).not.toBe('vacio');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Entidad de prueba');
    expect(fixture.nativeElement.textContent).not.toContain('Sin seguimientos recuperados');
  });
  it('la consulta vacía de un expediente no inventa el seguimiento de su resolución fundada', () => {
    servicio.listarCumplimientos.mockReturnValue(of([]));
    const c = pagina().componentInstance;
    expect(c.items()).toEqual([]);
    expect(c.estadoConsulta()).toBe('vacio');
  });
  it('distingue carga de resultado vacío y oculta contadores durante la carga', () => {
    servicio.getResueltas.mockReturnValue(new Subject());
    const fixture = pagina();
    expect(fixture.componentInstance.cargando()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Cargando el seguimiento');
    expect(fixture.nativeElement.textContent).not.toContain('Cumplidos / cerrados');
  });
  it('informa datos incompletos sin fabricar una identificación', () => {
    servicio.getResueltas.mockReturnValue(of([{ id: 7 }]));
    const fixture = pagina();
    expect(fixture.componentInstance.informacionIncompleta()).toBe(true);
    expect(fixture.componentInstance.items()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('no se confirma la ausencia');
    expect(servicio.listarCumplimientos).not.toHaveBeenCalled();
  });
  it('rechaza una respuesta con documentos o datos vinculados a otro expediente', () => {
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, expedienteTtaipId: 92 }]));
    const c = pagina().componentInstance;
    expect(c.items()).toEqual([]);
    expect(c.estadoConsulta()).toBe('error');
  });
  it('no deriva fechas ni completa una SAIP para apelaciones externas', () => {
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, fechaLimiteCumplimiento: null }]));
    const c = pagina().componentInstance;
    expect(c.items()[0].fechaLimite).toBeNull();
    expect(c.items()[0].fechaResolucion).toBeUndefined();
    expect(c.items()[0].expedienteSAIP).toBeUndefined();
  });
  it('muestra el cumplimiento parcial distinto del cumplimiento total', () => {
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, estadoCumplimiento: 'CUMPLIDO_PARCIAL' }]));
    const c = pagina().componentInstance;
    expect(c.items()[0].estado).toBe('cumplido_parcial');
    expect(c.resumen().cumplidos).toBe(0);
  });
  it('solo confirma observar tras recuperar el registro con el mismo recurso y resultado', () => {
    const c = pagina().componentInstance;
    const respuesta = new Subject();
    const recuperacion = new Subject();
    servicio.observarCumplimiento.mockReturnValue(respuesta);
    servicio.listarCumplimientos.mockReturnValue(recuperacion);
    c.observacionesInput.set('Observación real');
    c.actualizarEstado('observado');
    respuesta.next({ ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'Observación real' });
    expect(c.toastMensaje()).toBeNull();
    expect(c.items()[0].estado).toBe('cumplido');
    recuperacion.next([{ ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'Observación real', trazabilidad: 'Actuación persistida' }]);
    expect(c.items()[0].estado).toBe('observado');
    expect(c.items()[0].registro.trazabilidad).toBe('Actuación persistida');
    expect(c.toastMensaje()).toContain('recuperada del servidor');
    expect(c.observacionesInput()).toBe('');
  });
  it('cerrar ejecuta su comando específico y el resultado sobrevive a recargar', () => {
    const c = pagina().componentInstance;
    const cerrado = { ...registro, estadoCumplimiento: 'CERRADO', observacion: 'Cierre sustentado' };
    servicio.cerrarCumplimiento.mockReturnValue(of(cerrado));
    servicio.listarCumplimientos.mockReturnValue(of([cerrado]));
    c.observacionesInput.set('Cierre sustentado');
    c.actualizarEstado('cerrado');
    expect(servicio.cerrarCumplimiento).toHaveBeenCalledWith(91, 45, { observacion: 'Cierre sustentado' });
    expect(c.toastMensaje()).toBeTruthy();
    c.cargarSeguimientos();
    expect(c.items()[0].estado).toBe('cerrado');
  });
  it.each([400, 401, 403, 404, 500, 0])('un rechazo o fallo %s no confirma ni borra el formulario', status => {
    const c = pagina().componentInstance;
    servicio.observarCumplimiento.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    c.observacionesInput.set('Conservar este fundamento');
    c.actualizarEstado('observado');
    expect(c.toastMensaje()).toBeNull();
    expect(c.items()[0].estado).toBe('cumplido');
    expect(c.observacionesInput()).toBe('Conservar este fundamento');
    expect(c.mensajeAccion()).toBeTruthy();
    expect(c.enviando()).toBe(false);
  });
  it('la pérdida de la recuperación no confirma y exige consultar antes de otro comando', () => {
    const c = pagina().componentInstance;
    servicio.listarCumplimientos.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    c.observacionesInput.set('No se pudo verificar');
    c.actualizarEstado('observado');
    expect(c.toastMensaje()).toBeNull();
    expect(c.requiereVerificacion()).toBe(true);
    c.actualizarEstado('observado');
    expect(servicio.observarCumplimiento).toHaveBeenCalledTimes(1);
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, estadoCumplimiento: 'OBSERVADO' }]));
    c.cargarSeguimientos();
    expect(c.items()[0].estado).toBe('observado');
    expect(c.requiereVerificacion()).toBe(false);
  });
  it('un GET discordante con el comando no acredita una actuación', () => {
    const c = pagina().componentInstance;
    c.observacionesInput.set('Revisión');
    c.actualizarEstado('observado');
    expect(c.toastMensaje()).toBeNull();
    expect(c.requiereVerificacion()).toBe(true);
  });
  it('no envía comandos inexistentes o reservados a la entidad', () => {
    const c = pagina().componentInstance;
    c.actualizarEstado('cumplido'); c.actualizarEstado('reiterado');
    expect(c.motivoNoDisponible('cumplido')).toContain('entidad');
    expect(c.motivoNoDisponible('reiterado')).toContain('No hay un comando');
    expect(servicio.observarCumplimiento).not.toHaveBeenCalled();
    expect(servicio.cerrarCumplimiento).not.toHaveBeenCalled();
    expect(c.toastMensaje()).toBeNull();
  });
  it('valida observaciones y conserva el cierre como estado terminal', () => {
    const c = pagina().componentInstance;
    c.actualizarEstado('observado');
    expect(servicio.observarCumplimiento).not.toHaveBeenCalled();
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, estadoCumplimiento: 'CERRADO' }]));
    c.cargarSeguimientos();
    c.actualizarEstado('observado'); c.actualizarEstado('cerrado');
    expect(servicio.cerrarCumplimiento).not.toHaveBeenCalled();
  });
  it('una consulta tardía no repuebla datos tras cambiar de sesión', () => {
    const fixture = pagina(); const c = fixture.componentInstance;
    const anterior = new Subject();
    servicio.getResueltas.mockReturnValue(anterior);
    c.cargarSeguimientos();
    token = 'sesion-b';
    servicio.getResueltas.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    cambiosSesion.update(v => v + 1); fixture.detectChanges();
    anterior.next([apelacion]);
    expect(c.items()).toEqual([]);
    expect(c.estadoConsulta()).toBe('autorizacion');
  });
  it('un logout elimina los datos y descarta la respuesta de una actuación anterior', () => {
    const fixture = pagina(); const c = fixture.componentInstance;
    const respuesta = new Subject(); servicio.observarCumplimiento.mockReturnValue(respuesta);
    c.observacionesInput.set('Actuación de la sesión anterior'); c.actualizarEstado('observado');
    token = ''; cambiosSesion.update(v => v + 1); fixture.detectChanges();
    respuesta.next({ ...registro, estadoCumplimiento: 'OBSERVADO' });
    expect(c.items()).toEqual([]);
    expect(c.estadoConsulta()).toBe('autenticacion');
    expect(c.toastMensaje()).toBeNull();
    expect(c.observacionesInput()).toBe('');
  });
  it('no reenvía la escritura mientras espera respuesta', () => {
    const c = pagina().componentInstance;
    servicio.observarCumplimiento.mockReturnValue(new Subject());
    c.observacionesInput.set('Una sola petición');
    c.actualizarEstado('observado'); c.actualizarEstado('observado');
    expect(servicio.observarCumplimiento).toHaveBeenCalledTimes(1);
  });
  it('un timeout conserva el texto y pide recuperar antes de repetir', async () => {
    vi.useFakeTimers();
    try {
      const c = pagina().componentInstance;
      servicio.observarCumplimiento.mockReturnValue(new Subject());
      c.observacionesInput.set('Conservar ante timeout'); c.actualizarEstado('observado');
      await vi.advanceTimersByTimeAsync(15_001);
      expect(c.requiereVerificacion()).toBe(true);
      expect(c.toastMensaje()).toBeNull();
      expect(c.observacionesInput()).toBe('Conservar ante timeout');
    } finally { vi.useRealTimers(); }
  });
  it('seleccionar otro expediente no mezcla formulario ni confirmaciones tardías', () => {
    servicio.getResueltas.mockReturnValue(of([apelacion, { ...apelacion, id: 8, expedienteTtaip: { id: 92 } }]));
    servicio.listarCumplimientos.mockImplementation(id => of(id === 91 ? [registro] :
      [{ ...registro, id: 46, expedienteTtaipId: 92, apelacionId: 8, resolucionId: 33 }]));
    const c = pagina().componentInstance;
    const respuesta = new Subject(); servicio.observarCumplimiento.mockReturnValue(respuesta);
    c.observacionesInput.set('Solo corresponde al primero'); c.actualizarEstado('observado');
    c.seleccionarItem('46');
    respuesta.next({ ...registro, estadoCumplimiento: 'OBSERVADO' });
    expect(c.sel()?.id).toBe('46');
    expect(c.sel()?.estado).toBe('cumplido');
    expect(c.observacionesInput()).toBe('');
    expect(c.toastMensaje()).toBeNull();
    expect(c.requiereVerificacion()).toBe(true);
  });
  it('nueva consulta que falla limpia el expediente seleccionado anteriormente', () => {
    const c = pagina().componentInstance;
    servicio.getResueltas.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    c.cargarSeguimientos();
    expect(c.sel()).toBeNull();
    expect(c.items()).toEqual([]);
  });
});
