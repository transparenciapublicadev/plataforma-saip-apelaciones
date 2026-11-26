import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ComplianceTrackingComponent } from './compliance-tracking.component';
import { TtaipService } from '../../services/ttaip.service';
import { AuthService } from '../../services/auth.service';

describe('Cumplimiento TTAIP: datos y actuaciones del servidor', () => {
  const apelacion = { id: 7, entidadId: 3, expediente: '00007-2026-JUS/TTAIP', expedienteTtaip: { id: 91 },
    resolucion: { decision: 'FUNDADO' } };
  const registro = { id: 45, entidadId: 3, expedienteTtaipId: 91, apelacionId: 7, resolucionId: 32,
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
      observarCumplimiento: vi.fn((_exp: number, _id: number, data: { observacion: string }) => of({ ...registro, estadoCumplimiento: 'OBSERVADO', observacion: data.observacion })),
      cerrarCumplimiento: vi.fn((_exp: number, _id: number, data: { observacion: string | null }) => of({ ...registro, estadoCumplimiento: 'CERRADO', observacion: data.observacion })) };
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
    respuesta.next({ ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'Observación real', trazabilidad: 'Actuación persistida' });
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
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'No se pudo verificar' }]));
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
  it('una consulta parcial conserva seguimientos válidos de otros expedientes sin declarar un total completo', () => {
    servicio.getResueltas.mockReturnValue(of([apelacion, { ...apelacion, id: 8, expediente: 'OTRO', expedienteTtaip: { id: 92 } }]));
    servicio.listarCumplimientos.mockImplementation(id => id === 91 ? of([registro]) : throwError(() => new HttpErrorResponse({ status: 500 })));
    const c = pagina().componentInstance;
    expect(c.items().map(i => i.id)).toEqual(['45']); expect(c.informacionIncompleta()).toBe(true);
    expect(c.estadoConsulta()).not.toBe('vacio');
  });
  it('no presenta un seguimiento cuyo código contradice el de la apelación consultada', () => {
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, numeroExpediente: 'AJENO' }]));
    expect(pagina().componentInstance.items()).toEqual([]);
  });
  it('no presenta un seguimiento asociado explícitamente a otra entidad', () => {
    servicio.getResueltas.mockReturnValue(of([{ ...apelacion, entidadId: 3 }]));
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, entidadId: 4 }]));
    expect(pagina().componentInstance.items()).toEqual([]);
  });
  it('un PATCH y GET coincidentes en una observación antigua no confirman la observación enviada', () => {
    const c = pagina().componentInstance; const viejo = { ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'Texto anterior' };
    servicio.observarCumplimiento.mockReturnValue(of(viejo)); servicio.listarCumplimientos.mockReturnValue(of([viejo]));
    c.observacionesInput.set('Texto solicitado'); c.actualizarEstado('observado');
    expect(c.toastMensaje()).toBeNull(); expect(c.requiereVerificacion()).toBe(true); expect(c.observacionesInput()).toBe('Texto solicitado');
  });
  it('una recarga discordante conserva el fundamento y el bloqueo del resultado incierto', () => {
    const c = pagina().componentInstance; servicio.observarCumplimiento.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    c.observacionesInput.set('Fundamento pendiente'); c.actualizarEstado('observado'); c.cargarSeguimientos();
    expect(c.observacionesInput()).toBe('Fundamento pendiente'); expect(c.requiereVerificacion()).toBe(true);
    c.actualizarEstado('observado'); expect(servicio.observarCumplimiento).toHaveBeenCalledTimes(1);
  });
  it('los IDs duplicados no se presentan como seguimientos distintos', () => {
    servicio.listarCumplimientos.mockReturnValue(of([registro, { ...registro, estadoCumplimiento: 'CERRADO' }]));
    expect(pagina().componentInstance.items()).toEqual([]);
  });
  it('una selección ajena no sustituye el recurso consultado', () => {
    const c = pagina().componentInstance; c.seleccionarItem('999'); expect(c.sel()?.id).toBe('45');
  });
  it('destruir impide iniciar consultas y actuaciones tardías', () => {
    const f = pagina(), c = f.componentInstance; f.destroy(); servicio.getResueltas.mockClear();
    c.cargarSeguimientos(); expect(servicio.getResueltas).not.toHaveBeenCalled();
  });
  it('conserva cada seguimiento parcial y cerrado de la misma apelación por su ID propio', () => {
    servicio.listarCumplimientos.mockReturnValue(of([registro, { ...registro, id: 46, estadoCumplimiento: 'CUMPLIDO_PARCIAL' }, { ...registro, id: 47, estadoCumplimiento: 'CERRADO' }]));
    const f = pagina(), c = f.componentInstance;
    expect(c.items().map(i => [i.id, i.estado])).toEqual([['45', 'cumplido'], ['46', 'cumplido_parcial'], ['47', 'cerrado']]);
    expect(c.resumen().cumplidos).toBe(2); c.seleccionarItem('46'); f.detectChanges();
    expect(c.sel()?.registro.id).toBe(46); expect(f.nativeElement.querySelector('button[aria-pressed="true"]').textContent).not.toContain('ID 46');
  });
  it('un resultado parcial explica el alcance recuperado y no muestra indicadores como totales completos', () => {
    servicio.getResueltas.mockReturnValue(of([apelacion, { ...apelacion, id: 8, expediente: 'OTRO', expedienteTtaip: { id: 92 } }]));
    servicio.listarCumplimientos.mockImplementation(id => id === 91 ? of([registro]) : throwError(() => new HttpErrorResponse({ status: 403 })));
    const f = pagina(); expect(f.nativeElement.textContent).toContain('1 de 2 expedientes');
    expect(f.nativeElement.textContent).not.toContain('Cumplidos / cerrados'); expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain('No tiene permiso');
  });
  it('el deadline existente conserva las consultas ya completadas y no acredita ausencia en la pendiente', async () => {
    vi.useFakeTimers(); try {
      servicio.getResueltas.mockReturnValue(of([apelacion, { ...apelacion, id: 8, expediente: 'OTRO', expedienteTtaip: { id: 92 } }]));
      servicio.listarCumplimientos.mockImplementation(id => id === 91 ? of([registro]) : new Subject());
      const c = pagina().componentInstance; await vi.advanceTimersByTimeAsync(15_001);
      expect(c.items().map(i => i.id)).toEqual(['45']); expect(c.expedientesRecuperados()).toBe(1); expect(c.informacionIncompleta()).toBe(true); expect(c.cargando()).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('no escoge una apelación por posición cuando dos IDs contradicen un mismo agregado', () => {
    servicio.getResueltas.mockReturnValue(of([apelacion, { ...apelacion, id: 8 }]));
    const c = pagina().componentInstance; expect(c.items()).toEqual([]); expect(c.informacionIncompleta()).toBe(true); expect(c.estadoConsulta()).not.toBe('vacio'); expect(servicio.listarCumplimientos).not.toHaveBeenCalled();
  });
  it('la falta de entidad identificada se informa y bloquea actuaciones, sin suplirla por el nombre', () => {
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, entidadId: undefined }]));
    const c = pagina().componentInstance; c.observacionesInput.set('Fundamento'); c.actualizarEstado('observado');
    expect(c.informacionIncompleta()).toBe(true); expect(servicio.observarCumplimiento).not.toHaveBeenCalled();
  });
  it('una lista secundaria omitida no es un vacío confirmado', () => {
    servicio.listarCumplimientos.mockReturnValue(of(null)); const c = pagina().componentInstance;
    expect(c.estadoConsulta()).toBe('error'); expect(c.items()).toEqual([]);
  });
  it.each(['apelacionId', 'expedienteTtaipId', 'resolucionId', 'entidadId', 'numeroExpediente'])('la recuperación discordante en %s no confirma la actuación', key => {
    const c = pagina().componentInstance; const r = { ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'Motivo' };
    servicio.observarCumplimiento.mockReturnValue(of(r)); servicio.listarCumplimientos.mockReturnValue(of([{ ...r, [key]: key === 'numeroExpediente' ? 'AJENO' : 999 }]));
    c.observacionesInput.set('Motivo'); c.actualizarEstado('observado');
    expect(c.toastMensaje()).toBeNull(); expect(c.requiereVerificacion()).toBe(true); expect(c.observacionesInput()).toBe('Motivo');
  });
  it('dos resultados con el mismo ID en recuperación no acreditan el registro', () => {
    const c = pagina().componentInstance; const r = { ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'Motivo' };
    servicio.observarCumplimiento.mockReturnValue(of(r)); servicio.listarCumplimientos.mockReturnValue(of([r, r]));
    c.observacionesInput.set('Motivo'); c.actualizarEstado('observado'); expect(c.toastMensaje()).toBeNull(); expect(c.requiereVerificacion()).toBe(true);
  });
  it('sin respuesta del comando recupera el estado, pero no atribuye el registro ni repite PATCH', () => {
    const c = pagina().componentInstance; servicio.observarCumplimiento.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    c.observacionesInput.set('Motivo'); c.actualizarEstado('observado');
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'Motivo' }])); c.recuperarActuacion();
    expect(c.requiereVerificacion()).toBe(false); expect(c.sel()?.estado).toBe('observado'); expect(c.toastMensaje()).toBeNull(); expect(c.mensajeAccion()).toContain('no se atribuye'); expect(servicio.observarCumplimiento).toHaveBeenCalledTimes(1);
  });
  it('recupera un ID conocido después de un fallo de GET sin repetir el comando', () => {
    const c = pagina().componentInstance; const r = { ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'Motivo', trazabilidad: 'Actuación real' };
    servicio.observarCumplimiento.mockReturnValue(of(r)); servicio.listarCumplimientos.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    c.observacionesInput.set('Motivo'); c.actualizarEstado('observado'); expect(c.observacionesInput()).toBe('Motivo');
    servicio.listarCumplimientos.mockReturnValue(of([r])); c.recuperarActuacion(); expect(c.toastMensaje()).toContain('recuperada del servidor'); expect(servicio.observarCumplimiento).toHaveBeenCalledTimes(1);
  });
  it('cambiar de seguimiento conserva el contexto incierto sin copiar su texto ni sus avisos al nuevo', () => {
    servicio.listarCumplimientos.mockReturnValue(of([registro, { ...registro, id: 46, estadoCumplimiento: 'CERRADO' }]));
    const c = pagina().componentInstance; const pending = new Subject(); servicio.observarCumplimiento.mockReturnValue(pending);
    c.observacionesInput.set('Solo el 45'); c.actualizarEstado('observado'); c.seleccionarItem('46');
    const r = { ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'Solo el 45' }; servicio.listarCumplimientos.mockReturnValue(of([r])); c.recuperarActuacion();
    expect(c.sel()?.id).toBe('46'); expect(c.sel()?.estado).toBe('cerrado'); expect(c.observacionesInput()).toBe(''); expect(c.toastMensaje()).toBeNull(); expect(c.mensajeAccion()).toBe('');
  });
  it('un cambio de sesión antes del render impide una consulta secundaria tardía', () => {
    const root = new Subject(); servicio.getResueltas.mockReturnValue(root); pagina(); token = 'otra-sesion'; root.next([apelacion]);
    expect(servicio.listarCumplimientos).not.toHaveBeenCalled();
  });
  it('un cambio de sesión antes del render impide recuperar un comando anterior', () => {
    const c = pagina().componentInstance; const response = new Subject(); servicio.observarCumplimiento.mockReturnValue(response);
    c.observacionesInput.set('Motivo'); c.actualizarEstado('observado'); servicio.listarCumplimientos.mockClear(); token = 'otra-sesion';
    response.next({ ...registro, estadoCumplimiento: 'OBSERVADO', observacion: 'Motivo' }); expect(servicio.listarCumplimientos).not.toHaveBeenCalled(); expect(c.toastMensaje()).toBeNull();
  });
  it('una sesión ilegible no deja consultar ni construir una página rota', () => {
    vi.spyOn(TestBed.inject(AuthService), 'getToken').mockImplementation(() => { throw new SyntaxError('synthetic'); });
    const f = pagina(); expect(f.componentInstance.items()).toEqual([]); expect(servicio.getResueltas).not.toHaveBeenCalled();
  });
  it('la referencia documental registrada no se convierte en descarga, preview o notificación acreditada', () => {
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, referenciaDocumento: 'nombre-sintetico.pdf', evidenciaCumplimiento: 'https://example.invalid/referencia' }]));
    const f = pagina(); expect(f.nativeElement.textContent).toContain('nombre-sintetico.pdf'); expect(f.nativeElement.querySelector('[download],iframe,a[href="https://example.invalid/referencia"]')).toBeNull();
    expect(f.nativeElement.textContent).toContain('no representan archivos descargables');
  });
  it('el estado y la fecha límite registrados no se recalculan por una fecha pasada', () => {
    servicio.listarCumplimientos.mockReturnValue(of([{ ...registro, estadoCumplimiento: 'PENDIENTE', fechaLimiteCumplimiento: '2000-01-01' }]));
    const c = pagina().componentInstance; expect(c.sel()?.estado).toBe('pendiente'); expect(c.sel()?.fechaLimite).toBe('2000-01-01');
  });
  it('navega solo al expediente del seguimiento seleccionado y conserva el contexto de teclado', () => {
    servicio.listarCumplimientos.mockReturnValue(of([registro, { ...registro, id: 46 }])); const f = pagina();
    const buttons = f.nativeElement.querySelectorAll('button[aria-controls="compliance-detail"]') as NodeListOf<HTMLButtonElement>;
    buttons[1].focus(); buttons[1].click(); f.detectChanges(); expect(document.activeElement).toBe(buttons[1]); expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    const router = TestBed.inject(Router), navigate = vi.spyOn(router, 'navigate'); f.componentInstance.verResolucion('AJENO'); expect(navigate).not.toHaveBeenCalled();
    f.componentInstance.verResolucion(registro.numeroExpediente); expect(navigate).toHaveBeenCalledWith(['/ttaip/resolucion', registro.numeroExpediente]);
    expect(f.nativeElement.querySelector('label[for="observacion-cumplimiento"]')).not.toBeNull();
  });
});

// Actual Angular services and HTTP testing transport; no Spring/JWT/storage run.
describe('ComplianceTracking — contrato HTTP del consumidor', () => {
  const api = environment.apiUrl + '/ttaip';
  const ap = { id: 7, entidadId: 3, expediente: '00007-2026-JUS/TTAIP', expedienteTtaip: { id: 91 } };
  const record = { id: 45, entidadId: 3, expedienteTtaipId: 91, apelacionId: 7, resolucionId: 32,
    numeroExpediente: ap.expediente, entidadNombre: 'Entidad sintética', decisionResolucion: 'FUNDADO_EN_PARTE',
    estadoCumplimiento: 'PENDIENTE', fechaLimiteCumplimiento: '2026-10-29', trazabilidad: 'Traza de prueba' };
  let http: HttpTestingController;
  beforeEach(() => {
    const cambiosSesion = signal(0);
    TestBed.configureTestingModule({ imports: [ComplianceTrackingComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { obtenerSesion: () => ({ usuarioId: 4, tipoUsuario: 'TTAIP' }), getToken: () => 'synthetic-session', getTipoUsuario: () => 'TTAIP', cambiosSesion } }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); } });
  function page() {
    const f = TestBed.createComponent(ComplianceTrackingComponent); f.detectChanges();
    const root = http.expectOne(api + '/resueltas'); expect(root.request.method).toBe('GET'); root.flush([ap]);
    http.expectOne(api + '/expedientes/91/cumplimientos').flush([record]); f.detectChanges(); return f;
  }
  it('consulta seguimientos por agregado y solo confirma observar tras PATCH y GET compatibles', () => {
    const c = page().componentInstance; c.observacionesInput.set('Motivo explícito'); c.actualizarEstado('observado');
    const post = http.expectOne(api + '/expedientes/91/cumplimientos/45/observar');
    expect(post.request.method).toBe('PATCH'); expect(post.request.body).toEqual({ observacion: 'Motivo explícito' });
    const r = { ...record, estadoCumplimiento: 'OBSERVADO', observacion: 'Motivo explícito', trazabilidad: 'Traza persistida' }; post.flush(r);
    expect(c.toastMensaje()).toBeNull(); expect(c.sel()?.estado).toBe('pendiente');
    http.expectOne(api + '/expedientes/91/cumplimientos').flush([r]); expect(c.toastMensaje()).toContain('recuperada del servidor'); expect(c.sel()?.registro.trazabilidad).toBe('Traza persistida');
  });
  it('cerrar sin observación conserva el contrato nullable y el significado operativo', () => {
    const c = page().componentInstance; c.actualizarEstado('cerrado');
    const req = http.expectOne(api + '/expedientes/91/cumplimientos/45/cerrar'); expect(req.request.method).toBe('PATCH'); expect(req.request.body).toEqual({ observacion: null });
    const r = { ...record, estadoCumplimiento: 'CERRADO', observacion: null }; req.flush(r); http.expectOne(api + '/expedientes/91/cumplimientos').flush([r]);
    expect(c.sel()?.estado).toBe('cerrado'); expect(c.toastMensaje()).not.toContain('entrega total');
  });
  it('403 conserva el texto sin éxito ni consulta posterior de confirmación', () => {
    const c = page().componentInstance; c.observacionesInput.set('Conservar'); c.actualizarEstado('observado');
    http.expectOne(api + '/expedientes/91/cumplimientos/45/observar').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(c.toastMensaje()).toBeNull(); expect(c.observacionesInput()).toBe('Conservar'); expect(c.requiereVerificacion()).toBe(false); expect(http.match(() => true)).toHaveLength(0);
  });
  it('la pérdida de confirmación solo permite recuperación GET sin repetir PATCH', () => {
    const c = page().componentInstance; c.observacionesInput.set('Conservar'); c.actualizarEstado('observado');
    http.expectOne(api + '/expedientes/91/cumplimientos/45/observar').error(new ProgressEvent('error')); c.actualizarEstado('cerrado');
    expect(http.match(() => true)).toHaveLength(0); c.recuperarActuacion();
    http.expectOne(api + '/expedientes/91/cumplimientos').flush([{ ...record, estadoCumplimiento: 'OBSERVADO', observacion: 'Conservar' }]);
    expect(c.requiereVerificacion()).toBe(false); expect(c.toastMensaje()).toBeNull(); expect(c.mensajeAccion()).toContain('no se atribuye');
  });
  it('un GET discordante en otro campo devuelto no confirma una copia distinta del registro', () => {
    const c = page().componentInstance; c.observacionesInput.set('Motivo'); c.actualizarEstado('observado');
    const r = { ...record, estadoCumplimiento: 'OBSERVADO', observacion: 'Motivo', numeroResolucion: 'NUMERO-REGISTRADO-1' };
    http.expectOne(api + '/expedientes/91/cumplimientos/45/observar').flush(r);
    http.expectOne(api + '/expedientes/91/cumplimientos').flush([{ ...r, numeroResolucion: 'NUMERO-DISTINTO-2' }]);
    expect(c.toastMensaje()).toBeNull(); expect(c.requiereVerificacion()).toBe(true); expect(c.observacionesInput()).toBe('Motivo');
  });
  it('destruir cancela el transporte pendiente sin afirmar rollback del servidor', () => {
    const f = page(), c = f.componentInstance; c.observacionesInput.set('Motivo'); c.actualizarEstado('observado');
    const req = http.expectOne(api + '/expedientes/91/cumplimientos/45/observar'); f.destroy();
    expect(req.cancelled).toBe(true); c.recuperarActuacion(); expect(http.match(() => true)).toHaveLength(0); expect(c.toastMensaje()).toBeNull();
  });
});
