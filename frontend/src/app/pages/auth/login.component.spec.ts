import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { YaikuLogoComponent } from '../../shared/yaiku-logo.component';

describe('LoginComponent — Identidad visual, accesibilidad y acceso rápido', () => {
  let queryParamsSubject: BehaviorSubject<Record<string, any>>;
  let mockRoute: any;
  let mockAuthService: any;

  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.sessionStorage?.clear?.();
    queryParamsSubject = new BehaviorSubject<Record<string, any>>({});

    mockRoute = {
      snapshot: {
        data: {},
        queryParams: {}
      },
      queryParams: queryParamsSubject.asObservable()
    };

    mockAuthService = {
      estaLogueado: vi.fn().mockReturnValue(false),
      login: vi.fn(),
      guardarSesion: vi.fn(),
      obtenerSesion: vi.fn().mockReturnValue(null),
      cerrarSesion: vi.fn()
    };
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    globalThis.localStorage?.clear?.();
    globalThis.sessionStorage?.clear?.();
  });

  async function createComponent(customRoute?: any) {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: customRoute || mockRoute },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  describe('Identidad visual y slogan oficial', () => {
    it('muestra el componente app-yaiku-logo con tono dark en el panel institucional', async () => {
      const fixture = await createComponent();
      const logoEl = fixture.nativeElement.querySelector('app-yaiku-logo');
      expect(logoEl).not.toBeNull();

      const logoDebugEl = fixture.debugElement.query(By.directive(YaikuLogoComponent));
      expect(logoDebugEl).not.toBeNull();
      const logoComponent = logoDebugEl.componentInstance as YaikuLogoComponent;
      expect(logoComponent).toBeDefined();
      expect(logoComponent.tone()).toBe('dark');
      expect(logoComponent.height()).toBe(40);
      expect(logoComponent.gradientId()).toBe('login-yaiku-seal');

      const linearGrad = fixture.nativeElement.querySelector('#login-yaiku-seal');
      expect(linearGrad).not.toBeNull();
      expect(linearGrad.tagName.toLowerCase()).toBe('lineargradient');

      const brandSpan = fixture.nativeElement.querySelector('.yaiku-brand');
      expect(brandSpan).not.toBeNull();
      expect(brandSpan.getAttribute('role')).toBe('img');
      expect(brandSpan.getAttribute('aria-label')).toBe('Yaiku');
    });

    it('muestra el lema oficial de producto exactamente debajo del logo', async () => {
      const fixture = await createComponent();
      const textContent = fixture.nativeElement.textContent;
      expect(textContent).toContain('Pide, sigue y apela. Todo en un solo lugar.');

      const sloganEl = fixture.nativeElement.querySelector('.font-display.italic');
      expect(sloganEl).not.toBeNull();
      expect(sloganEl.textContent.trim()).toBe('Pide, sigue y apela. Todo en un solo lugar.');
    });

    it('no contiene el SVG de balanza genérico anterior', async () => {
      const fixture = await createComponent();
      expect(fixture.nativeElement.querySelector('svg[lucideScale]')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('TTAIP · República del Perú');
    });

    it('el logo y slogan enlazan con la ruta raíz /', async () => {
      const fixture = await createComponent();
      const brandLink = fixture.nativeElement.querySelector('a[routerLink="/"]');
      expect(brandLink).not.toBeNull();
      expect(brandLink.contains(fixture.nativeElement.querySelector('app-yaiku-logo'))).toBe(true);
    });
  });

  describe('Distintivos de confianza y accesibilidad', () => {
    it('muestra el distintivo oficial WCAG 2.2 AA alineado con design-reference', async () => {
      const fixture = await createComponent();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('WCAG 2.2 AA');
      expect(text).not.toContain('WCAG 2.1 AA');
    });

    it('muestra los distintivos de conexión segura y datos encriptados', async () => {
      const fixture = await createComponent();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Conexión SSL');
      expect(text).toContain('Datos encriptados');
    });
  });

  describe('Condicionamiento de credenciales demo (showQuickAccess)', () => {
    it('oculta el bloque de acceso rápido demo por defecto cuando no hay query param', async () => {
      const fixture = await createComponent();
      expect(fixture.componentInstance.showQuickAccess()).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('Acceso rápido demo');
      expect(fixture.nativeElement.querySelector('button[type="button"]')?.textContent).not.toContain('Ciudadano (DNI');
    });

    it('muestra el bloque de acceso rápido demo cuando el query param acceso-rapido está presente', async () => {
      mockRoute.snapshot.queryParams = { 'acceso-rapido': '' };
      queryParamsSubject.next({ 'acceso-rapido': '' });

      const fixture = await createComponent();
      expect(fixture.componentInstance.showQuickAccess()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Acceso rápido demo');
      expect(fixture.nativeElement.textContent).toContain('Ciudadano (DNI 70000001)');
    });

    it('muestra el bloque de acceso rápido demo con acceso-rapido=true', async () => {
      mockRoute.snapshot.queryParams = { 'acceso-rapido': 'true' };
      queryParamsSubject.next({ 'acceso-rapido': 'true' });

      const fixture = await createComponent();
      expect(fixture.componentInstance.showQuickAccess()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Acceso rápido demo');
    });

    it('mantiene oculto el bloque de acceso rápido cuando acceso-rapido es false', async () => {
      mockRoute.snapshot.queryParams = { 'acceso-rapido': 'false' };
      queryParamsSubject.next({ 'acceso-rapido': 'false' });

      const fixture = await createComponent();
      expect(fixture.componentInstance.showQuickAccess()).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('Acceso rápido demo');
    });

    it('permite rellenar credenciales demo cuando el bloque está activo', async () => {
      mockRoute.snapshot.queryParams = { 'acceso-rapido': '' };
      queryParamsSubject.next({ 'acceso-rapido': '' });

      const fixture = await createComponent();
      fixture.detectChanges();

      const demoBtn = Array.from(fixture.nativeElement.querySelectorAll('button') as HTMLButtonElement[])
        .find(b => b.textContent?.includes('70000001'));
      expect(demoBtn).toBeDefined();

      demoBtn!.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.email).toBe('70000001');
      expect(fixture.componentInstance.password).toBe('Saip2026*');
    });

    it('oculta el bloque de acceso rápido cuando hay parámetros irrelevantes (?tab=ciudadano&returnUrl=%2F)', async () => {
      mockRoute.snapshot.queryParams = { tab: 'ciudadano', returnUrl: '%2F' };
      queryParamsSubject.next({ tab: 'ciudadano', returnUrl: '%2F' });

      const fixture = await createComponent();
      expect(fixture.componentInstance.showQuickAccess()).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('Acceso rápido demo');
    });

    it('respeta la distinción de mayúsculas/minúsculas y no activa con parámetros distintos (?ACCESO-RAPIDO=true)', async () => {
      mockRoute.snapshot.queryParams = { 'ACCESO-RAPIDO': 'true' };
      queryParamsSubject.next({ 'ACCESO-RAPIDO': 'true' });

      const fixture = await createComponent();
      expect(fixture.componentInstance.showQuickAccess()).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('Acceso rápido demo');
    });

    it('maneja de forma segura rutas con snapshot o queryParams nulo o indefinido', async () => {
      const nullRoute = {
        snapshot: null,
        queryParams: of({})
      };
      const fixture = await createComponent(nullRoute);
      expect(fixture.componentInstance.showQuickAccess()).toBe(false);
    });

    it('actualiza dinámicamente el estado al cambiar los queryParams durante la navegación reactiva', async () => {
      const fixture = await createComponent();
      expect(fixture.componentInstance.showQuickAccess()).toBe(false);

      queryParamsSubject.next({ 'acceso-rapido': '' });
      fixture.detectChanges();
      expect(fixture.componentInstance.showQuickAccess()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Acceso rápido demo');

      queryParamsSubject.next({});
      fixture.detectChanges();
      expect(fixture.componentInstance.showQuickAccess()).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('Acceso rápido demo');
    });
  });

  describe('Preservación funcional de portales y autenticación', () => {
    it('configura el portal del administrado en modo público citizen por defecto', async () => {
      const fixture = await createComponent();
      expect(fixture.componentInstance.isCitizenPortal()).toBe(true);
      expect(fixture.componentInstance.portalTitle()).toBe('Acceso para Administrados');
      expect(fixture.nativeElement.textContent).toContain('Crear cuenta (Ciudadano / Empresa)');
      expect(fixture.nativeElement.textContent).toContain('Portal del administrado');
    });

    it('configura el portal institucional cuando accessMode es internal con rol asignado', async () => {
      const internalRoute = {
        snapshot: {
          data: { accessMode: 'internal', requiredRole: 'FUNCIONARIO' },
          queryParams: { 'acceso-rapido': '' }
        },
        queryParams: of({ 'acceso-rapido': '' })
      };

      const fixture = await createComponent(internalRoute);
      expect(fixture.componentInstance.isCitizenPortal()).toBe(false);
      expect(fixture.componentInstance.portalTitle()).toBe('Acceso Funcionario');
      expect(fixture.nativeElement.textContent).toContain('Portal institucional');
      expect(fixture.nativeElement.textContent).toContain('Funcionario MINEDU');
    });

    it('valida campos obligatorios antes de llamar al servicio de autenticación', async () => {
      const fixture = await createComponent();
      const comp = fixture.componentInstance;

      comp.email = '';
      comp.password = '';
      comp.login();

      expect(comp.error()).toBe('Por favor complete todos los campos');
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('realiza login contra AuthService y gestiona respuesta exitosa', async () => {
      const fixture = await createComponent();
      const comp = fixture.componentInstance;
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      mockAuthService.login.mockReturnValue(of({
        success: true,
        tipoUsuario: 'CIUDADANO',
        token: 'token-jwt-real'
      }));
      mockAuthService.obtenerSesion.mockReturnValue({
        redirectUrl: '/ciudadano/dashboard'
      });

      comp.email = '70000001';
      comp.password = 'Saip2026*';
      comp.login();

      expect(mockAuthService.login).toHaveBeenCalledWith({
        identificador: '70000001',
        password: 'Saip2026*'
      });
      expect(mockAuthService.guardarSesion).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/ciudadano']);
    });
  });
});
