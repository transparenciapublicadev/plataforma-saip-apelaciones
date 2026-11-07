import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { UxMotionService } from './services/ux-motion.service';
import { Subject } from 'rxjs';
import { NavigationEnd } from '@angular/router';

describe('V1: identidad del shell Yaiku', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.setItem('saip_splash_shown', 'true');
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: UxMotionService, useValue: { animateShell: vi.fn(), animateRoute: vi.fn(), dispose: vi.fn() } }] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }); TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  function page(url = '/consultar', beforeRender?: () => void) {
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue(url);
    const f = TestBed.createComponent(App); beforeRender?.(); f.detectChanges(); return f;
  }
  it('la marca compartida lleva al inicio Yaiku sin atribución estatal', () => {
    const f = page(), header = f.nativeElement.querySelector('header');
    expect(header.querySelector('a[aria-label="Yaiku, ir al inicio"]')?.getAttribute('href')).toBe('/');
    expect(header.textContent).not.toContain('República del Perú');
    expect(header.querySelector('[role="img"][aria-label="Yaiku"]')).not.toBeNull();
  });
  it('el splash utiliza el sello existente y el eslogan Yaiku', () => {
    const f = page('/'); f.componentInstance.showSplash.set(true); f.detectChanges();
    const splash = f.nativeElement.querySelector('[aria-label="Presentación de Yaiku"]');
    expect(splash).not.toBeNull(); expect(splash.querySelector('[role="img"][aria-label="Yaiku"]')).not.toBeNull();
    expect(splash.textContent).toContain('Pide, sigue y apela.'); expect(splash.textContent).not.toContain('República del Perú');
  });
  it('muestra únicamente la entidad del funcionario identificado por la sesión actual', () => {
    TestBed.inject(AuthService).guardarSesion({ success: true, token: 'synthetic', usuarioId: 7, funcionarioId: 7,
      tipoUsuario: 'FUNCIONARIO', entidadId: 3, entidadNombre: 'Entidad sintética con nombre extenso' });
    const f = page(); expect(f.nativeElement.querySelector('header').textContent).toContain('Entidad sintética con nombre extenso');
  });
  it('Escape cierra el menú y devuelve el foco a su control', async () => {
    TestBed.inject(AuthService).guardarSesion({ success: true, token: 'synthetic', usuarioId: 7, tipoUsuario: 'CIUDADANO' });
    const f = page(), trigger = f.nativeElement.querySelector('[aria-controls="desktop-user-menu"]') as HTMLButtonElement;
    trigger.click(); f.detectChanges(); await f.whenStable();
    const first = f.nativeElement.querySelector('#desktop-user-menu [role="menuitem"]') as HTMLElement;
    first.focus(); first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges();
    expect(f.componentInstance.menuAbierto()).toBe(false); expect(document.activeElement).toBe(trigger);
  });
  it.each(['/login', '/registro', '/acceso-funcionario', '/acceso-ttaip', '/acceso-admin'])('comparte la cabecera de referencia sin unificar accesos en %s', url => {
    const f = page(url); expect(f.componentInstance.isAuthRoute()).toBe(true);
    expect(getComputedStyle(f.nativeElement.querySelector('.yaiku-main-nav')).height).toBe('72px');
    expect(f.nativeElement.querySelector('main')?.style.paddingTop).toBe('');
    expect(f.nativeElement.querySelector('header a[href="/login"]')).not.toBeNull();
  });
  it.each(['/consultar', '/ciudadano', '/funcionario', '/ttaip', '/admin'])('el shell de %s utiliza la altura de referencia sin rellenar el contenido', url => {
    const f = page(url); expect(f.componentInstance.isAuthRoute()).toBe(false);
    expect(getComputedStyle(f.nativeElement.querySelector('.yaiku-main-nav')).height).toBe('72px');
    expect(f.nativeElement.querySelector('main#main-content')).not.toBeNull();
  });
  it.each([
    { usuarioId: 8, funcionarioId: 7 }, { entidadId: 0 }, { entidadNombre: '' }, { entidadNombre: undefined },
    { tipoUsuario: 'CIUDADANO' }, { tipoUsuario: 'TTAIP' }, { tipoUsuario: 'ADMINISTRADOR' }, { token: undefined },
  ])('no completa contexto institucional ausente o cruzado: %j', patch => {
    TestBed.inject(AuthService).guardarSesion({ success: true, token: 'synthetic', usuarioId: 7, funcionarioId: 7,
      tipoUsuario: 'FUNCIONARIO', entidadId: 3, entidadNombre: 'CONTEXTO-NO-AUTORIZADO', ...patch });
    const f = page(); expect(f.componentInstance.entidadEtiqueta()).toBe('');
    expect(f.nativeElement.querySelector('header').textContent).not.toContain('CONTEXTO-NO-AUTORIZADO');
  });
  it.each(['sesion', 'rol', 'entidad', 'logout'])('cambio de %s no conserva el contexto ni menús anteriores', change => {
    const auth = TestBed.inject(AuthService), session = { success: true, token: 'synthetic', usuarioId: 7, funcionarioId: 7,
      tipoUsuario: 'FUNCIONARIO', entidadId: 3, entidadNombre: 'ENTIDAD-ANTERIOR' };
    auth.guardarSesion(session); const f = page(); f.componentInstance.menuAbierto.set(true); f.detectChanges();
    if(change === 'logout') { localStorage.removeItem('usuario'); window.dispatchEvent(new StorageEvent('storage', { key: 'usuario' })); }
    else auth.guardarSesion({ ...session, ...(change === 'sesion' ? { token: 'new-synthetic', usuarioId: 8, funcionarioId: 8, entidadNombre: undefined }
      : change === 'rol' ? { tipoUsuario: 'CIUDADANO' } : { entidadId: 4, entidadNombre: 'ENTIDAD-ACTUAL' }) });
    expect(f.componentInstance.entidadEtiqueta()).not.toBe('ENTIDAD-ANTERIOR'); f.detectChanges();
    expect(f.nativeElement.querySelector('header').textContent).not.toContain('ENTIDAD-ANTERIOR');
    expect(f.componentInstance.menuAbierto()).toBe(false); TestBed.inject(HttpTestingController).expectNone(() => true);
  });
  it('sesión ilegible no muestra identidad anterior ni consulta recursos privados', () => {
    localStorage.setItem('usuario', '{'); const f=page(); expect(f.componentInstance.isLoggedIn()).toBe(false);
    expect(f.componentInstance.entidadEtiqueta()).toBe(''); TestBed.inject(HttpTestingController).expectNone(() => true);
  });
  it('teclado recorre el menú, Tab permite salir y no hay escrituras', async () => {
    TestBed.inject(AuthService).guardarSesion({ success:true, token:'synthetic', usuarioId:7, tipoUsuario:'CIUDADANO' });
    const f=page(), trigger=f.nativeElement.querySelector('#desktop-user-trigger') as HTMLButtonElement;
    trigger.click(); f.detectChanges(); await f.whenStable();
    const items=Array.from(f.nativeElement.querySelectorAll('#desktop-user-menu [role="menuitem"]')) as HTMLElement[];
    expect(document.activeElement).toBe(items[0]);
    items[0].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})); expect(document.activeElement).toBe(items.at(-1));
    items.at(-1)!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); expect(document.activeElement).toBe(items[0]);
    items[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); expect(document.activeElement).toBe(items[1]);
    items[1].dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true})); expect(document.activeElement).toBe(items[0]);
    const tab=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}); items[0].dispatchEvent(tab); expect(tab.defaultPrevented).toBe(false);
    f.nativeElement.querySelector('main').focus(); f.detectChanges(); expect(f.componentInstance.menuAbierto()).toBe(false);
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
  it('menú móvil enfoca enlaces y Escape restaura el control sin afectar la navegación', async () => {
    const f=page(), trigger=f.nativeElement.querySelector('#mobile-menu-trigger') as HTMLButtonElement;
    trigger.click(); f.detectChanges(); await f.whenStable();
    const panel=f.nativeElement.querySelector('#mobile-navigation-panel'); expect(panel.getAttribute('role')).toBe('navigation');
    expect(panel.contains(document.activeElement)).toBe(true);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); f.detectChanges();
    expect(f.componentInstance.mobileMenuAbierto()).toBe(false); expect(document.activeElement).toBe(trigger);
  });
  it('movimiento reducido no muestra splash ni programa una espera', () => {
    sessionStorage.removeItem('saip_splash_shown'); vi.stubGlobal('matchMedia', vi.fn(() => ({matches:true})));
    const f=page('/'); expect(f.componentInstance.showSplash()).toBe(false);
    expect(f.nativeElement.querySelector('[aria-label="Presentación de Yaiku"]')).toBeNull();
  });
  it('splash se retira tras el primer pintado sin esperar timers, HTTP o animaciones', () => {
    sessionStorage.removeItem('saip_splash_shown'); vi.stubGlobal('matchMedia', vi.fn(() => ({matches:false})));
    // Capture after fixture creation: Angular's own render scheduler also uses rAF.
    const frames: FrameRequestCallback[]=[];
    const f=page('/', () => {vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback => {frames.push(callback); return frames.length;});});
    expect(f.componentInstance.showSplash()).toBe(true); expect(frames).toHaveLength(1);
    frames.shift()!(0); expect(frames).toHaveLength(1); frames.shift()!(0);
    expect(f.componentInstance.showSplash()).toBe(false); expect(sessionStorage.getItem('saip_splash_shown')).toBe('true');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
  it('almacenamiento del splash bloqueado no retiene el contenido', () => {
    const session=window.sessionStorage, get=Storage.prototype.getItem;
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this: Storage,key: string) {
      if(this === session) throw new Error('Unavailable'); return get.call(this,key);
    });
    const f=page('/'); expect(f.componentInstance.showSplash()).toBe(false);
  });
  it('destruir cancela el frame de presentación pendiente', () => {
    sessionStorage.removeItem('saip_splash_shown'); vi.stubGlobal('matchMedia', vi.fn(() => ({matches:false})));
    vi.spyOn(window,'requestAnimationFrame').mockReturnValue(91); const cancel=vi.spyOn(window,'cancelAnimationFrame');
    const f=page('/'); f.destroy(); expect(cancel).toHaveBeenCalledWith(91);
  });
  it('navegar cancela el splash pendiente sin esperar ni alterar la ruta', () => {
    const events=new Subject<NavigationEnd>(); vi.spyOn(TestBed.inject(Router),'events','get').mockReturnValue(events);
    sessionStorage.removeItem('saip_splash_shown'); vi.stubGlobal('matchMedia',vi.fn(() => ({matches:false})));
    vi.spyOn(window,'requestAnimationFrame').mockReturnValue(92); const cancel=vi.spyOn(window,'cancelAnimationFrame');
    vi.spyOn(window,'scrollTo').mockImplementation(() => {}); const f=page('/');
    events.next(new NavigationEnd(1,'/ayuda','/ayuda')); expect(f.componentInstance.showSplash()).toBe(false);
    expect(cancel).toHaveBeenCalledWith(92);
  });
  it('fragmentos respetan altura real de cabecera, foco y movimiento reducido', () => {
    vi.stubGlobal('matchMedia',vi.fn(() => ({matches:true}))); const scroll=vi.spyOn(window,'scrollTo').mockImplementation(() => {});
    const f=page('/'), section=document.createElement('section'); section.id='proceso'; f.nativeElement.querySelector('main').append(section);
    vi.spyOn(section,'getBoundingClientRect').mockReturnValue({top:500} as DOMRect);
    vi.spyOn(f.nativeElement.querySelector('[data-main-nav]'),'getBoundingClientRect').mockReturnValue({bottom:101} as DOMRect);
    f.componentInstance.scrollToSection('proceso'); expect(scroll).toHaveBeenLastCalledWith({top:391,behavior:'instant'});
    expect(document.activeElement).toBe(section);
  });
});
