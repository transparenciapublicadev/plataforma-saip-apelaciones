import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './services/auth.service';
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
});
