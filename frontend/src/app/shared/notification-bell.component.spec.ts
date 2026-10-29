import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { EMPTY, Subject, finalize, of, throwError } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBellComponent } from './notification-bell.component';
import { AuthService } from '../services/auth.service';
import { SolicitudService } from '../services/solicitud.service';
import { ApelacionService } from '../services/apelacion.service';
import { routes } from '../app.routes';
import { environment } from '../../environments/environment';

describe('Campana: regresiones V3', () => {
  let session: any;
  let revision: ReturnType<typeof signal<number>>;
  let solicitudes: ReturnType<typeof vi.fn>;
  let apelaciones: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    session = { usuarioId: 41, tipoUsuario: 'CIUDADANO', token: 'synthetic-session' };
    revision = signal(0);
    solicitudes = vi.fn(() => of({ total: 0 }));
    apelaciones = vi.fn(() => of({ total: 0 }));
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { cambiosSesion: revision, obtenerSesion: () => session } },
      { provide: SolicitudService, useValue: { getEstadisticas: solicitudes } },
      { provide: ApelacionService, useValue: { getEstadisticas: apelaciones } },
    ] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });
  function open(role: string) {
    const f = TestBed.createComponent(NotificationBellComponent);
    f.componentRef.setInput('userType', role); f.detectChanges();
    f.nativeElement.querySelector('button').click(); f.detectChanges();
    return f;
  }
  it.each(['CIUDADANO', 'FUNCIONARIO', 'TTAIP'])('no inventa actividad para %s', role => {
    session.tipoUsuario = role;
    const f = open(role);
    expect(f.nativeElement.textContent).not.toMatch(/SAIP-2026-|00124-2026|SUSALUD|Muni Lima|Ministerio de Educación/);
    expect(f.nativeElement.textContent).toContain('no disponible');
  });
  it('error administrativo no conserva alertas operativas prefijadas', () => {
    session.tipoUsuario = 'ADMINISTRADOR';
    solicitudes.mockReturnValue(throwError(() => ({ status: 500 })));
    const f = open('ADMINISTRADOR');
    expect(f.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Requieren atención prioritaria');
    expect(f.nativeElement.textContent).not.toContain('Hoy');
  });
  it('dos totales cero no generan avisos administrativos de demostración', () => {
    session.tipoUsuario = 'ADMINISTRADOR';
    const f = open('ADMINISTRADOR');
    expect(f.nativeElement.textContent).toContain('Sin registros en estos indicadores');
    expect(f.nativeElement.textContent).not.toContain('Sin notificaciones pendientes');
  });
  it('no consulta recursos privados sin una sesión aunque reciba un rol administrativo', () => {
    session = null;
    const f = open('ADMINISTRADOR');
    expect(solicitudes).not.toHaveBeenCalled();
    expect(apelaciones).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).not.toContain('Sin notificaciones pendientes');
  });
  it('no construye una nueva-apelacion con expediente como segmento inexistente', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = open('CIUDADANO');
    const message = Array.from(f.nativeElement.querySelectorAll('div.cursor-pointer'))
      .find((el: any) => el.textContent.includes('Plazo para apelar disponible')) as HTMLElement | undefined;
    message?.click();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('no consulta estadísticas al montar las dos campanas desktop/mobile', () => {
    session.tipoUsuario = 'ADMINISTRADOR';
    for (let i = 0; i < 2; i++) {
      const f = TestBed.createComponent(NotificationBellComponent);
      f.componentRef.setInput('userType', 'ADMINISTRADOR'); f.detectChanges();
    }
    expect(solicitudes).not.toHaveBeenCalled(); expect(apelaciones).not.toHaveBeenCalled();
  });

  it('consulta una vez por apertura y distingue carga de cero y de indisponibilidad', () => {
    session.tipoUsuario = 'ADMINISTRADOR';
    const saip = new Subject<unknown>(), ttaip = new Subject<unknown>();
    solicitudes.mockReturnValue(saip); apelaciones.mockReturnValue(ttaip);
    const f = open('ADMINISTRADOR');
    expect(solicitudes).toHaveBeenCalledTimes(1); expect(apelaciones).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.consultaActual().estado).toBe('cargando');
    expect(f.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('dd')).toBeNull();
    saip.next({ total: 0 }); saip.complete(); f.detectChanges();
    expect(f.componentInstance.consultaActual().estado).toBe('cargando');
    ttaip.next({ total: 0 }); ttaip.complete(); f.detectChanges();
    expect(f.componentInstance.consultaActual().estado).toBe('vacio');
    expect(f.nativeElement.textContent).toContain('no confirma ausencia de notificaciones');
    expect(Array.from(f.nativeElement.querySelectorAll('dd')).map((d: any) => d.textContent.trim())).toEqual(['0', '0']);
  });

  it('muestra solo totales recibidos con procedencia y sin inferir entrega, plazos o lecturas', () => {
    session.tipoUsuario = 'ADMINISTRADOR';
    solicitudes.mockReturnValue(of({ total: 17, vencidas: 6, pendientes: 12 }));
    apelaciones.mockReturnValue(of({ total: 3, resueltas: 2 }));
    const f = open('ADMINISTRADOR');
    expect(f.componentInstance.consultaActual().datos).toEqual({ solicitudes: 17, apelaciones: 3 });
    expect(f.nativeElement.textContent).toContain('totales globales de registros');
    expect(f.nativeElement.textContent).toContain('estadísticas administrativas');
    expect(f.nativeElement.textContent).not.toMatch(/Hoy|Ayer|Plazo en curso|entregado|abrir proceso/);
    expect(f.nativeElement.querySelector('time')).toBeNull();
    expect(f.nativeElement.querySelectorAll('dd').length).toBe(2);
  });

  it.each([null, {}, [], { total: '2' }, { total: -1 }, { total: 1.5 }, { total: NaN }, { total: Infinity }, { total: Number.MAX_SAFE_INTEGER + 1 }])(
    'respuesta incompleta o total inválido %j no se convierte en cero', value => {
      session.tipoUsuario = 'ADMINISTRADOR'; solicitudes.mockReturnValue(of(value));
      const f = open('ADMINISTRADOR');
      expect(f.componentInstance.consultaActual().estado).toBe('incompleto');
      expect(f.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
      expect(f.nativeElement.querySelector('dd')).toBeNull();
      expect(f.nativeElement.textContent).not.toContain('Sin registros en estos indicadores');
    });

  it('una fuente vacía sin emisión tampoco confirma cero registros', () => {
    session.tipoUsuario = 'ADMINISTRADOR'; solicitudes.mockReturnValue(EMPTY);
    const f = open('ADMINISTRADOR');
    expect(f.componentInstance.consultaActual().estado).toBe('incompleto');
    expect(f.nativeElement.querySelector('dd')).toBeNull();
  });

  it('un solo total recibido no basta si el otro está ausente', () => {
    session.tipoUsuario = 'ADMINISTRADOR';
    solicitudes.mockReturnValue(of({ total: 19 })); apelaciones.mockReturnValue(of({ resueltas: 4 }));
    const f = open('ADMINISTRADOR');
    expect(f.componentInstance.consultaActual().estado).toBe('incompleto');
    expect(f.componentInstance.consultaActual().datos).toBeUndefined();
  });

  it('error tras datos correctos elimina los anteriores; reintento recupera solo la respuesta nueva', () => {
    session.tipoUsuario = 'ADMINISTRADOR'; solicitudes.mockReturnValue(of({ total: 19 }));
    const f = open('ADMINISTRADOR');
    const pending = new Subject<unknown>(); solicitudes.mockReturnValue(pending);
    f.componentInstance.consultar(); f.detectChanges();
    expect(f.nativeElement.querySelector('dd')).toBeNull();
    pending.error({ status: 503 }); f.detectChanges();
    expect(f.componentInstance.consultaActual().estado).toBe('error');
    expect(f.componentInstance.consultaActual().datos).toBeUndefined();
    solicitudes.mockReturnValue(of({ total: 2 }));
    const retry = Array.from(f.nativeElement.querySelectorAll('button')).find((b: any) => b.textContent.includes('Reintentar indicadores')) as HTMLButtonElement;
    retry.click(); f.detectChanges();
    expect(f.componentInstance.consultaActual().datos?.solicitudes).toBe(2);
    expect(solicitudes).toHaveBeenCalledTimes(3);
  });

  it.each(['CIUDADANO', 'FUNCIONARIO', 'TTAIP'])('sin fuente integrada de %s muestra indisponibilidad, no vacío, y no consulta globales', role => {
    session.tipoUsuario = role; const f = open(role);
    expect(f.componentInstance.consultaActual().estado).toBe('no-disponible');
    expect(f.nativeElement.textContent).not.toContain('Sin registros');
    expect(solicitudes).not.toHaveBeenCalled(); expect(apelaciones).not.toHaveBeenCalled();
  });

  it.each([
    null, { usuarioId: 0, token: 'synthetic', tipoUsuario: 'ADMINISTRADOR' },
    { usuarioId: 41, tipoUsuario: 'ADMINISTRADOR' },
    { usuarioId: 41, token: 'synthetic', tipoUsuario: 'FUNCIONARIO' },
    { usuarioId: 41, token: 'synthetic', tipoUsuario: 'ADMIN' },
  ])('rol visible administrativo no suplanta una sesión inválida o distinta %j', value => {
    session = value; const f = open('ADMINISTRADOR');
    expect(solicitudes).not.toHaveBeenCalled(); expect(apelaciones).not.toHaveBeenCalled();
    expect(f.nativeElement.querySelector('a')).toBeNull();
  });

  it.each(['usuario', 'token', 'entidad', 'rol', 'logout'])('cambio de %s cancela fuentes y descarta respuestas anteriores', change => {
    session.tipoUsuario = 'ADMINISTRADOR';
    const oldSaip = new Subject<unknown>(), oldTtaip = new Subject<unknown>();
    const cancelled = vi.fn();
    solicitudes.mockReturnValue(oldSaip.pipe(finalize(cancelled))); apelaciones.mockReturnValue(oldTtaip.pipe(finalize(cancelled)));
    const f = open('ADMINISTRADOR');
    if (change === 'usuario') session = { ...session, usuarioId: 42 };
    if (change === 'token') session = { ...session, token: 'synthetic-new-session' };
    if (change === 'entidad') session = { ...session, entidadId: 15 };
    if (change === 'rol') session = { ...session, tipoUsuario: 'FUNCIONARIO' };
    if (change === 'logout') session = null;
    revision.update(n => n + 1);
    // Even before the effect/render flush, the old view is not the current context.
    expect(f.componentInstance.panelAbierto()).toBe(false);
    expect(f.componentInstance.consultaActual().datos).toBeUndefined();
    f.detectChanges(); expect(cancelled).toHaveBeenCalledTimes(2);
    oldSaip.next({ total: 991 }); oldSaip.complete(); oldTtaip.next({ total: 992 }); oldTtaip.complete(); f.detectChanges();
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(f.componentInstance.consultaActual().datos).toBeUndefined();
    expect(solicitudes).toHaveBeenCalledTimes(1);
  });

  it('cambio del input de rol invalida un contexto aunque la sesión anterior no se haya actualizado', () => {
    session.tipoUsuario = 'ADMINISTRADOR';
    const stream = new Subject<unknown>(), cancelled = vi.fn(); solicitudes.mockReturnValue(stream.pipe(finalize(cancelled)));
    const f = open('ADMINISTRADOR'); f.componentRef.setInput('userType', 'CIUDADANO'); f.detectChanges();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(f.componentInstance.panelAbierto()).toBe(false);
    expect(f.componentInstance.rutaPanel()).toBeNull();
  });

  it('un resultado del usuario previo no reemplaza la consulta de otro administrador', () => {
    session.tipoUsuario = 'ADMINISTRADOR'; const old = new Subject<unknown>(); solicitudes.mockReturnValue(old);
    const f = open('ADMINISTRADOR');
    session = { ...session, usuarioId: 52, token: 'synthetic-other-admin' }; revision.update(n => n + 1); f.detectChanges();
    solicitudes.mockReturnValue(of({ total: 5 })); apelaciones.mockReturnValue(of({ total: 7 }));
    f.nativeElement.querySelector('button').click(); f.detectChanges();
    old.next({ total: 991 }); old.complete(); f.detectChanges();
    expect(f.componentInstance.consultaActual().datos).toEqual({ solicitudes: 5, apelaciones: 7 });
  });

  it('cerrar y destruir cancelan consultas; reabrir no recupera un snapshot abandonado', () => {
    session.tipoUsuario = 'ADMINISTRADOR'; const pending = new Subject<unknown>(); const cancelled = vi.fn();
    solicitudes.mockReturnValue(pending.pipe(finalize(cancelled))); const f = open('ADMINISTRADOR');
    f.componentInstance.cerrar(); f.detectChanges(); expect(cancelled).toHaveBeenCalledOnce();
    pending.next({ total: 900 }); pending.complete();
    solicitudes.mockReturnValue(of({ total: 4 })); f.componentInstance.toggleOpen(); f.detectChanges();
    expect(f.componentInstance.consultaActual().datos?.solicitudes).toBe(4);
    const last = new Subject<unknown>(); solicitudes.mockReturnValue(last.pipe(finalize(cancelled))); f.componentInstance.consultar();
    f.destroy(); expect(cancelled).toHaveBeenCalledTimes(2);
  });

  it('no lee ni escribe estados de lectura en localStorage ni ofrece acciones persistidas inexistentes', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem'); const write = vi.spyOn(Storage.prototype, 'setItem');
    const f = open('CIUDADANO');
    expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).not.toMatch(/Marcar|Eliminar|nuevas|pendientes/);
    expect(f.nativeElement.querySelectorAll('button').length).toBe(2);
    f.componentInstance.cerrar(); expect(write).not.toHaveBeenCalled();
  });

  it.each([
    ['CIUDADANO', '/ciudadano'], ['FUNCIONARIO', '/funcionario'], ['TTAIP', '/ttaip'], ['ADMINISTRADOR', '/admin'],
  ])('destino %s es panel existente, sin expediente ni enlace especulativo', (role, path) => {
    session.tipoUsuario = role; const f = open(role);
    const link = f.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(path);
    expect(routes.some(r => r.path === path.slice(1))).toBe(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    link.click(); expect(navigate).toHaveBeenCalledExactlyOnceWith([path]);
    expect(f.componentInstance.panelAbierto()).toBe(false);
  });

  it('un enlace del DOM anterior no navega después de cerrar la sesión', () => {
    const f = open('CIUDADANO'), link = f.nativeElement.querySelector('a') as HTMLAnchorElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    session = null; revision.update(n => n + 1); link.click();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('apertura enfoca el diálogo y Escape devuelve foco a su campana', async () => {
    const f = open('CIUDADANO'); await f.whenStable(); f.detectChanges();
    const trigger = f.nativeElement.querySelector('button') as HTMLButtonElement;
    const panel = f.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(panel.getAttribute('aria-modal')).toBe('false');
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges();
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
  });

  it('salir por teclado a un control externo cierra el popover no modal sin atrapar foco', async () => {
    const outside = document.createElement('button'); document.body.append(outside);
    const f = open('CIUDADANO'); await f.whenStable();
    outside.focus(); f.detectChanges();
    expect(f.componentInstance.panelAbierto()).toBe(false); expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('cerrar con el botón restaura foco y un click exterior no lo roba', async () => {
    const f = open('CIUDADANO'); await f.whenStable();
    const close = f.nativeElement.querySelector('[aria-label="Cerrar avisos e indicadores"]') as HTMLButtonElement;
    close.click(); f.detectChanges(); expect(document.activeElement).toBe(f.nativeElement.querySelector('button'));
    f.componentInstance.toggleOpen(); f.detectChanges(); await f.whenStable();
    const outside = document.createElement('button'); document.body.append(outside); outside.focus(); outside.click(); f.detectChanges();
    expect(f.componentInstance.panelAbierto()).toBe(false); expect(document.activeElement).toBe(outside); outside.remove();
  });

  it('cada campana tiene controles accesibles con identificadores distintos', () => {
    const a = open('CIUDADANO'), b = open('CIUDADANO');
    expect(a.componentInstance.panelId).not.toBe(b.componentInstance.panelId);
  });
});

describe('Campana: servicios Angular reales con transporte HTTP simulado', () => {
  let http: HttpTestingController;
  let session: any;
  let revision: ReturnType<typeof signal<number>>;
  beforeEach(() => {
    session = { usuarioId: 41, tipoUsuario: 'ADMINISTRADOR', token: 'synthetic-admin' }; revision = signal(0);
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { cambiosSesion: revision, obtenerSesion: () => session } },
    ] }); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); });
  function open() {
    const f = TestBed.createComponent(NotificationBellComponent); f.componentRef.setInput('userType', 'ADMINISTRADOR'); f.detectChanges();
    http.expectNone(() => true);
    f.nativeElement.querySelector('button').click(); f.detectChanges(); return f;
  }
  it('usa solo GET estadísticas existentes, sin consulta de expedientes ni comandos de leído', () => {
    const f = open();
    const saip = http.expectOne(`${environment.apiUrl}/solicitudes/estadisticas`);
    const ttaip = http.expectOne(`${environment.apiUrl}/apelaciones/estadisticas`);
    expect(saip.request.method).toBe('GET'); expect(ttaip.request.method).toBe('GET');
    expect(saip.request.params.keys()).toEqual([]);
    saip.flush({ total: 8 }); ttaip.flush({ total: 4 }); f.detectChanges();
    expect(f.componentInstance.consultaActual().datos).toEqual({ solicitudes: 8, apelaciones: 4 });
    f.componentInstance.cerrar(); http.expectNone(() => true);
  });
  it.each([401, 403, 404, 500, 503, 0])('fallo HTTP/red %i no produce fallback ni éxito', status => {
    const f = open(); const saip = http.expectOne(`${environment.apiUrl}/solicitudes/estadisticas`);
    const ttaip = http.expectOne(`${environment.apiUrl}/apelaciones/estadisticas`);
    saip.flush({ total: 9 });
    if (status) ttaip.flush({ detail: 'Synthetic server error' }, { status, statusText: 'Synthetic failure' });
    else ttaip.error(new ProgressEvent('error'));
    f.detectChanges(); expect(f.componentInstance.consultaActual().estado).toBe('error');
    expect(f.nativeElement.querySelector('dd')).toBeNull(); expect(f.nativeElement.textContent).not.toContain('Synthetic');
    http.expectNone(() => true);
  });
  it('logout cancela las dos solicitudes HTTP en curso y no consulta para otro rol', () => {
    const f = open(); const requests = http.match(() => true); expect(requests.length).toBe(2);
    session = null; revision.update(n => n + 1); f.detectChanges();
    expect(requests.every(r => r.cancelled)).toBe(true);
    f.componentInstance.toggleOpen(); f.detectChanges(); http.expectNone(() => true);
  });
});
