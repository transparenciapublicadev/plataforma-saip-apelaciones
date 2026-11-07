import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';

type Role = 'CIUDADANO' | 'FUNCIONARIO' | 'TTAIP' | 'ADMINISTRADOR';
const entries = [
  { role: 'CIUDADANO', route: '/login' },
  { role: 'FUNCIONARIO', route: '/acceso-funcionario' },
  { role: 'TTAIP', route: '/acceso-ttaip' },
  { role: 'ADMINISTRADOR', route: '/acceso-admin' }
] as const;

describe('Login: separate portals, manual credentials and reference presentation', () => {
  let auth: { estaLogueado: ReturnType<typeof vi.fn>; login: ReturnType<typeof vi.fn>; guardarSesion: ReturnType<typeof vi.fn>; obtenerSesion: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { estaLogueado: vi.fn(() => false), login: vi.fn(), guardarSesion: vi.fn(), obtenerSesion: vi.fn(() => null) };
  });
  afterEach(() => TestBed.resetTestingModule());

  async function create(role: Role = 'CIUDADANO', params: Record<string, unknown> = {}): Promise<ComponentFixture<LoginComponent>> {
    await TestBed.configureTestingModule({ imports: [LoginComponent], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: {
        snapshot: { data: role === 'CIUDADANO' ? { accessMode: 'citizen' } : { accessMode: 'internal', requiredRole: role }, queryParams: params }, queryParams: of(params)
      } }
    ] }).compileComponents();
    const fixture = TestBed.createComponent(LoginComponent); fixture.detectChanges(); return fixture;
  }

  describe('Security: manual credentials only', () => {
    it.each(entries)('does not expose demo access on $role even with the URL activator', async entry => {
      const fixture = await create(entry.role, { 'acceso-rapido': 'true' });
      expect(fixture.nativeElement.textContent).not.toMatch(/Acceso rápido|MINEDU|\bdemo\b/i);
      expect(fixture.componentInstance.email).toBe('');
      expect(fixture.componentInstance.password).toBe('');
      expect(auth.login).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelectorAll('input[autocomplete="current-password"]')).toHaveLength(1);
    });
  });

  it.each(entries)('uses $route as a real separate entry with $role fixed by route data', async entry => {
    const fixture = await create(entry.role); const host = fixture.nativeElement as HTMLElement;
    const links = [...host.querySelectorAll<HTMLAnchorElement>('nav a')];
    expect(links.map(a => a.getAttribute('href'))).toEqual(entries.map(e => e.route));
    expect(links.filter(a => a.getAttribute('aria-current') === 'page').map(a => a.getAttribute('href'))).toEqual([entry.route]);
    expect(host.querySelector('[role="radiogroup"]')).toBeNull();
    expect(fixture.componentInstance.isCitizenPortal()).toBe(entry.role === 'CIUDADANO');
    expect(host.querySelector('a[href="/registro"]') !== null).toBe(entry.role === 'CIUDADANO');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('retains an accessible brand/home link, headings and honest capability labels', async () => {
    const fixture = await create(); const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('a[aria-label="Yaiku, volver al inicio"] app-yaiku-logo')).not.toBeNull();
    expect(host.querySelector('#login-title')?.textContent).toContain('Bienvenido de vuelta');
    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(host.textContent).toContain('Pide, sigue y apela.');
    expect(host.textContent).toContain('Todo en un solo lugar.');
    expect(host.textContent).not.toMatch(/WCAG|Datos encriptados|Plataforma oficial|mesa de ayuda institucional/i);
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true);
    expect(host.querySelector('#login-unavailable')?.textContent).toContain('no están disponibles');
  });

  it('labels both inputs and toggles the password with an accessible pressed state', async () => {
    const fixture = await create(); const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('label[for="login-email"]')).not.toBeNull();
    expect(host.querySelector('label[for="login-password"]')).not.toBeNull();
    const password = host.querySelector<HTMLInputElement>('#login-password')!;
    const toggle = host.querySelector<HTMLButtonElement>('button[aria-label="Mostrar contraseña"]')!;
    expect(password.type).toBe('password'); toggle.click(); fixture.detectChanges();
    expect(password.type).toBe('text'); expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar contraseña');
    toggle.click(); fixture.detectChanges(); expect(password.type).toBe('password');
  });

  it('validates required fields without a request and links the announced error', async () => {
    const fixture = await create(); fixture.componentInstance.login(); fixture.detectChanges();
    expect(auth.login).not.toHaveBeenCalled();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#login-error[role="alert"]')?.textContent).toContain('complete todos los campos');
    expect(host.querySelector('#login-email')?.getAttribute('aria-describedby')).toContain('login-error');
    expect(host.querySelector('#login-password')?.getAttribute('aria-invalid')).toBe('true');
  });

  it.each(entries)('saves only a successful $role response and navigates to its existing module', async entry => {
    const redirects = { CIUDADANO: ['/ciudadano/dashboard', '/ciudadano'], FUNCIONARIO: ['/entidad/dashboard', '/funcionario'], TTAIP: ['/ttaip/dashboard', '/ttaip'], ADMINISTRADOR: ['/admin/dashboard', '/admin'] };
    const fixture = await create(entry.role); const comp = fixture.componentInstance;
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const response = { success: true, tipoUsuario: entry.role, token: 'synthetic-mocked-token' };
    auth.login.mockReturnValue(of(response)); auth.obtenerSesion.mockReturnValue({ redirectUrl: redirects[entry.role][0] });
    comp.email = '  synthetic@example.invalid  '; comp.password = 'manual-test-input'; comp.login();
    expect(auth.login).toHaveBeenCalledWith({ identificador: 'synthetic@example.invalid', password: 'manual-test-input' });
    expect(auth.guardarSesion).toHaveBeenCalledWith(response);
    expect(nav).toHaveBeenCalledWith([redirects[entry.role][1]]);
  });

  it.each(entries)('rejects credentials of a different role at $route without saving a session', async entry => {
    const fixture = await create(entry.role); const comp = fixture.componentInstance;
    auth.login.mockReturnValue(of({ success: true, tipoUsuario: entry.role === 'CIUDADANO' ? 'ADMINISTRADOR' : 'CIUDADANO', token: 'synthetic-mocked-token' }));
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    comp.email = 'synthetic@example.invalid'; comp.password = 'manual-test-input'; comp.login(); fixture.detectChanges();
    expect(auth.guardarSesion).not.toHaveBeenCalled(); expect(nav).not.toHaveBeenCalled(); expect(comp.error()).not.toBe('');
  });

  it.each([401, 403, 500, 0])('keeps manual input after HTTP %s without reporting success', async status => {
    const fixture = await create(); const comp = fixture.componentInstance;
    auth.login.mockReturnValue(throwError(() => ({ status })));
    comp.email = 'synthetic@example.invalid'; comp.password = 'manual-test-input'; comp.login(); fixture.detectChanges();
    expect(auth.guardarSesion).not.toHaveBeenCalled(); expect(comp.loading()).toBe(false);
    expect(comp.password).toBe('manual-test-input'); expect(comp.error()).not.toBe('');
    expect(fixture.nativeElement.querySelector('#login-error[role="alert"]')).not.toBeNull();
  });

  it('shows pending status and disables submit until the real service response arrives', async () => {
    const pending = new Subject<any>(); auth.login.mockReturnValue(pending);
    const fixture = await create(); fixture.componentInstance.email = 'synthetic@example.invalid'; fixture.componentInstance.password = 'manual-test-input';
    fixture.componentInstance.login(); fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(host.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Iniciando sesión');
    expect(auth.guardarSesion).not.toHaveBeenCalled(); pending.error({ status: 0 });
  });
});
