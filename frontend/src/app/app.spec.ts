import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from './services/auth.service';
import { ReportesInstitucionalesService } from './services/reportes-institucionales.service';
import { PortalPublicoService } from './services/portal-publico.service';
import { routes } from './app.routes';
import { App } from './app';
import { Component, input } from '@angular/core';
import { NotificationBellComponent } from './shared/notification-bell.component';

@Component({ selector: 'app-notification-bell', template: '' })
class NotificationBellStub { readonly userType = input(''); }

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.setItem('saip_splash_shown', 'true');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).overrideComponent(App, { remove: { imports: [NotificationBellComponent] }, add: { imports: [NotificationBellStub] } }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
  });

  it('the shared logout handler sends the captured session, navigates once, and ignores a late result', async () => {
    const auth = TestBed.inject(AuthService);
    auth.guardarSesion({ success: true, token: 'closing-session' });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const app = TestBed.createComponent(App).componentInstance;
    app.menuAbierto.set(true);
    app.mobileMenuAbierto.set(true);
    app.logout();
    expect(auth.getToken()).toBeNull();
    expect(app.menuAbierto()).toBe(false);
    expect(app.mobileMenuAbierto()).toBe(false);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/']);
    const req = TestBed.inject(HttpTestingController).expectOne('http://localhost:8080/api/auth/logout');
    expect(req.request.headers.get('Authorization')).toBe('Bearer closing-session');
    auth.guardarSesion({ success: true, token: 'new-session' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await Promise.resolve();
    expect(auth.getToken()).toBe('new-session');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('opens a real own-profile query from the citizen menu without changing session data', () => {
    const auth = TestBed.inject(AuthService);
    auth.guardarSesion({ success: true, token: 'synthetic', usuarioId: 7, tipoUsuario: 'CIUDADANO' });
    const f = TestBed.createComponent(App); f.componentInstance.menuAbierto.set(true); f.detectChanges();
    const button = f.nativeElement.querySelector('[data-profile-open="desktop"]') as HTMLButtonElement;
    expect(button).toBeTruthy(); button.click(); f.detectChanges();
    expect(f.nativeElement.querySelector('[role="dialog"][aria-labelledby="profile-title"]')).toBeTruthy();
    const req = TestBed.inject(HttpTestingController).expectOne('http://localhost:8080/api/auth/me/7');
    expect(req.request.method).toBe('GET'); req.flush(null, { status: 403, statusText: 'Forbidden' });
    f.detectChanges(); expect(f.nativeElement.querySelector('[role="dialog"]').textContent).toContain('No tiene permiso');
    expect(auth.getToken()).toBe('synthetic');
  });

  it.each(['FUNCIONARIO', 'TTAIP', 'ADMINISTRADOR'])('does not offer citizen profile editing to %s', tipoUsuario => {
    TestBed.inject(AuthService).guardarSesion({ success: true, token: 'synthetic', usuarioId: 7, tipoUsuario });
    const f = TestBed.createComponent(App); f.componentInstance.menuAbierto.set(true); f.componentInstance.mobileMenuAbierto.set(true); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-profile-open]')).toBeNull();
  });

  it('opens from the mobile menu and destroys the dialog on close', () => {
    TestBed.inject(AuthService).guardarSesion({ success: true, token: 'synthetic', usuarioId: 7, tipoUsuario: 'CIUDADANO' });
    const f = TestBed.createComponent(App); f.componentInstance.mobileMenuAbierto.set(true); f.detectChanges();
    f.nativeElement.querySelector('[data-profile-open="mobile"]').click(); f.detectChanges();
    const req = TestBed.inject(HttpTestingController).expectOne('http://localhost:8080/api/auth/me/7');
    f.nativeElement.querySelector('[aria-label="Cerrar perfil"]').click(); f.detectChanges();
    expect(req.cancelled).toBe(true); expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(f.componentInstance.mobileMenuAbierto()).toBe(true);
  });

  it('should render header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')).toBeTruthy();
  });

  it('renders Reportes ANTAIP link for FUNCIONARIO in desktop nav, user menu, and mobile nav', () => {
    TestBed.inject(AuthService).guardarSesion({
      success: true,
      token: 'synthetic-funcionario',
      usuarioId: 10,
      tipoUsuario: 'FUNCIONARIO',
      funcionarioId: 10,
      entidadId: 1,
      entidadNombre: 'MINJUS'
    });
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.menuAbierto.set(true);
    fixture.componentInstance.mobileMenuAbierto.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Desktop nav link
    const desktopNavLinks = Array.from(compiled.querySelectorAll('nav a[routerLink]'));
    const desktopReportes = desktopNavLinks.find(a => a.getAttribute('routerLink') === '/funcionario/reportes');
    expect(desktopReportes).toBeTruthy();
    expect(desktopReportes?.textContent).toContain('Reportes ANTAIP');

    // Desktop user dropdown link
    const userMenuLinks = Array.from(compiled.querySelectorAll('#desktop-user-menu a[routerLink]'));
    const userMenuReportes = userMenuLinks.find(a => a.getAttribute('routerLink') === '/funcionario/reportes');
    expect(userMenuReportes).toBeTruthy();
    expect(userMenuReportes?.textContent).toContain('Reportes ANTAIP');

    // Mobile nav link
    const mobileLinks = Array.from(compiled.querySelectorAll('#mobile-navigation-panel a[routerLink]'));
    const mobileReportes = mobileLinks.find(a => a.getAttribute('routerLink') === '/funcionario/reportes');
    expect(mobileReportes).toBeTruthy();
    expect(mobileReportes?.textContent).toContain('Reportes ANTAIP');
  });

  it('renders Reportes ANTAIP link for TTAIP in desktop nav, user menu, and mobile nav', () => {
    TestBed.inject(AuthService).guardarSesion({
      success: true,
      token: 'synthetic-ttaip',
      usuarioId: 20,
      tipoUsuario: 'TTAIP'
    });
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.menuAbierto.set(true);
    fixture.componentInstance.mobileMenuAbierto.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Desktop nav link
    const desktopNavLinks = Array.from(compiled.querySelectorAll('nav a[routerLink]'));
    const desktopReportes = desktopNavLinks.find(a => a.getAttribute('routerLink') === '/ttaip/reportes');
    expect(desktopReportes).toBeTruthy();
    expect(desktopReportes?.textContent).toContain('Reportes ANTAIP');

    // Desktop user dropdown link
    const userMenuLinks = Array.from(compiled.querySelectorAll('#desktop-user-menu a[routerLink]'));
    const userMenuReportes = userMenuLinks.find(a => a.getAttribute('routerLink') === '/ttaip/reportes');
    expect(userMenuReportes).toBeTruthy();
    expect(userMenuReportes?.textContent).toContain('Reportes ANTAIP');

    // Mobile nav link
    const mobileLinks = Array.from(compiled.querySelectorAll('#mobile-navigation-panel a[routerLink]'));
    const mobileReportes = mobileLinks.find(a => a.getAttribute('routerLink') === '/ttaip/reportes');
    expect(mobileReportes).toBeTruthy();
    expect(mobileReportes?.textContent).toContain('Reportes ANTAIP');
  });

  it.each([
    ['CIUDADANO', '/ciudadano/tribunal'],
    ['FUNCIONARIO', '/funcionario/tribunal']
  ] as const)('renders Actuaciones for %s in desktop nav, user menu, and mobile nav', (tipoUsuario, ruta) => {
    TestBed.inject(AuthService).guardarSesion({
      success: true,
      token: 'synthetic-tribunal',
      usuarioId: 11,
      tipoUsuario,
      funcionarioId: tipoUsuario === 'FUNCIONARIO' ? 11 : undefined,
      entidadId: tipoUsuario === 'FUNCIONARIO' ? 1 : undefined,
      entidadNombre: tipoUsuario === 'FUNCIONARIO' ? 'MINJUS' : undefined
    });
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.menuAbierto.set(true);
    fixture.componentInstance.mobileMenuAbierto.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const desktop = Array.from(compiled.querySelectorAll('nav a[routerLink]'))
      .find(a => a.getAttribute('routerLink') === ruta);
    const menu = Array.from(compiled.querySelectorAll('#desktop-user-menu a[routerLink]'))
      .find(a => a.getAttribute('routerLink') === ruta);
    const mobile = Array.from(compiled.querySelectorAll('#mobile-navigation-panel a[routerLink]'))
      .find(a => a.getAttribute('routerLink') === ruta);

    expect(desktop?.textContent).toContain('Actuaciones');
    expect(menu?.textContent).toContain('Actuaciones');
    expect(mobile?.textContent).toContain('Actuaciones');
  });

  it.each(['TTAIP', 'ADMINISTRADOR'])('does not render Actuaciones for %s', tipoUsuario => {
    TestBed.inject(AuthService).guardarSesion({
      success: true,
      token: 'synthetic-other-tribunal',
      usuarioId: 12,
      tipoUsuario
    });
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.menuAbierto.set(true);
    fixture.componentInstance.mobileMenuAbierto.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('a[routerLink]'));
    expect(links.some(a => (a.textContent ?? '').includes('Actuaciones'))).toBe(false);
  });

  it.each(['CIUDADANO', 'ADMINISTRADOR'])('does not render Reportes ANTAIP link for %s', tipoUsuario => {
    TestBed.inject(AuthService).guardarSesion({
      success: true,
      token: 'synthetic-other',
      usuarioId: 30,
      tipoUsuario
    });
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.menuAbierto.set(true);
    fixture.componentInstance.mobileMenuAbierto.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const allLinks = Array.from(compiled.querySelectorAll('a[routerLink]'));
    expect(allLinks.some(a => a.getAttribute('routerLink')?.includes('reportes'))).toBe(false);
  });

  it('renders Ayuda y guía de uso in authenticated mobile drawer menu', () => {
    TestBed.inject(AuthService).guardarSesion({
      success: true,
      token: 'synthetic-user',
      usuarioId: 40,
      tipoUsuario: 'FUNCIONARIO'
    });
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.mobileMenuAbierto.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const mobileAyuda = compiled.querySelector('#mobile-navigation-panel a[routerLink="/ayuda"]');
    expect(mobileAyuda).toBeTruthy();
    expect(mobileAyuda?.textContent).toContain('Ayuda y guía de uso');
  });
});

describe('App Routes — Reportes ANTAIP Guard Redirections', () => {
  const mockReportesService = {
    resumen: vi.fn().mockReturnValue(of({
      modo: 'entidad',
      ambito: 'entidad',
      entidadId: 1,
      entidad: 'MINJUS',
      desde: '2026-01-01',
      hasta: '2026-12-31',
      consultado: '2026-11-08T00:00:00Z',
      total: 0,
      conActuacion: 0,
      estados: [],
      porMes: [],
      resultados: [],
      alcance: 'institucional'
    })),
    borrador: vi.fn().mockReturnValue(of(null)),
    detalle: vi.fn().mockReturnValue(of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 15 })),
    historial: vi.fn().mockReturnValue(of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 15 })),
    guardar: vi.fn().mockReturnValue(of(null))
  };

  const mockPortalPublicoService = {
    getPortal: vi.fn().mockReturnValue(of({
      metricas: {
        saipPresentadas: 0,
        respondidas: 0,
        apelaciones: 0,
        entidades: 0,
        personasApelantes: 0,
        tasaResolucion: 0
      },
      ejemplosSolicitud: [],
      preguntasFrecuentes: [],
      apelacionesPorEntidad: [],
      tendenciaMensual: [],
      miembrosTTAIP: []
    })),
    portal: vi.fn().mockReturnValue(of({
      metricas: {
        saipPresentadas: 0,
        respondidas: 0,
        apelaciones: 0,
        entidades: 0,
        personasApelantes: 0,
        tasaResolucion: 0
      },
      ejemplosSolicitud: [],
      preguntasFrecuentes: [],
      apelacionesPorEntidad: [],
      tendenciaMensual: [],
      miembrosTTAIP: []
    }))
  };

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('saip_splash_shown', 'true');

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ReportesInstitucionalesService, useValue: mockReportesService },
        { provide: PortalPublicoService, useValue: mockPortalPublicoService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('configures /funcionario/reportes route with tipoUsuarioGuard for FUNCIONARIO', () => {
    const route = routes.find(r => r.path === 'funcionario/reportes');
    expect(route).toBeDefined();
    expect(route?.canActivate).toBeDefined();
    expect(route?.data?.['tipos']).toEqual(['FUNCIONARIO']);
    expect(route?.data?.['reportMode']).toBe('entidad');
  });

  it('configures /ttaip/reportes route with tipoUsuarioGuard for TTAIP', () => {
    const route = routes.find(r => r.path === 'ttaip/reportes');
    expect(route).toBeDefined();
    expect(route?.canActivate).toBeDefined();
    expect(route?.data?.['tipos']).toEqual(['TTAIP']);
    expect(route?.data?.['reportMode']).toBe('ttaip');
  });

  it('redirects unauthenticated user from /funcionario/reportes to /acceso-funcionario', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/funcionario/reportes');

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/acceso-funcionario');
  });

  it('redirects unauthenticated user from /compliance to /acceso-ttaip', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/compliance');

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/acceso-ttaip');
  });

  it('redirects authenticated CIUDADANO from /compliance to /', async () => {
    const auth = TestBed.inject(AuthService);
    auth.guardarSesion({
      success: true,
      token: 'synthetic-jwt-ciudadano',
      usuarioId: 30,
      tipoUsuario: 'CIUDADANO'
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/compliance');

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/');
  });

  it('redirects unauthenticated user from /ttaip/reportes to /acceso-ttaip', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ttaip/reportes');

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/acceso-ttaip');
  });

  it('allows authenticated FUNCIONARIO to access /funcionario/reportes', async () => {
    const auth = TestBed.inject(AuthService);
    auth.guardarSesion({
      success: true,
      token: 'synthetic-jwt-funcionario',
      usuarioId: 10,
      tipoUsuario: 'FUNCIONARIO',
      funcionarioId: 10,
      entidadId: 1,
      entidadNombre: 'MINJUS'
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/funcionario/reportes');

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/funcionario/reportes');
  });

  it('allows authenticated TTAIP to access /ttaip/reportes', async () => {
    const auth = TestBed.inject(AuthService);
    auth.guardarSesion({
      success: true,
      token: 'synthetic-jwt-ttaip',
      usuarioId: 20,
      tipoUsuario: 'TTAIP'
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ttaip/reportes');

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/ttaip/reportes');
  });

  it('redirects authenticated CIUDADANO attempting to access /funcionario/reportes to /', async () => {
    const auth = TestBed.inject(AuthService);
    auth.guardarSesion({
      success: true,
      token: 'synthetic-jwt-ciudadano',
      usuarioId: 30,
      tipoUsuario: 'CIUDADANO'
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/funcionario/reportes');

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/');
  });

  it('redirects authenticated FUNCIONARIO attempting to access /ttaip/reportes to /', async () => {
    const auth = TestBed.inject(AuthService);
    auth.guardarSesion({
      success: true,
      token: 'synthetic-jwt-funcionario',
      usuarioId: 10,
      tipoUsuario: 'FUNCIONARIO',
      funcionarioId: 10,
      entidadId: 1,
      entidadNombre: 'MINJUS'
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ttaip/reportes');

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/');
  });
});
