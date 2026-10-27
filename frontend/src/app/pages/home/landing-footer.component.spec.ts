import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LandingFooterComponent } from './landing-footer.component';
import { routes } from '../../app.routes';
import { AuthService } from '../../services/auth.service';

@Component({ template: '<p>Destino de navegación</p>' })
class DestinationComponent {}

describe('Pie exclusivo de Landing', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [LandingFooterComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); });
  function page() { const f = TestBed.createComponent(LandingFooterComponent); f.detectChanges(); return f; }
  it('identifica Yaiku como proyecto y no usa logos institucionales como aval', () => {
    const f = page(); expect(f.nativeElement.querySelector('[role="img"]').getAttribute('aria-label')).toBe('Yaiku');
    expect(f.nativeElement.textContent).toContain('Proyecto académico'); expect(f.nativeElement.querySelector('img')).toBeNull();
    expect(f.nativeElement.textContent).toContain('no acredita respaldo');
  });
  it('los enlaces internos apuntan a rutas reales y los fragmentos tienen su propósito explícito', () => {
    const f = page(); const links = Array.from(f.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>)
      .filter(a => !a.getAttribute('href')?.startsWith('https://'));
    for (const link of links) {
      const path = link.getAttribute('href')!.split('#')[0]; expect(routes.some(r => '/' + r.path === path)).toBe(true);
    }
    expect(links.some(a => a.getAttribute('href') === '/ayuda#faq')).toBe(true);
    expect(links.some(a => a.getAttribute('href') === '/#estadisticas')).toBe(true);
    expect(links.some(a => a.getAttribute('href') === '#')).toBe(false);
  });
  it('privacidad, términos, accesibilidad y documentación ausentes se indican sin enlaces falsos', () => {
    const f = page(); const anchors = Array.from(f.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>);
    expect(anchors.some(a => /Privacidad|Términos|Accesibilidad|Documentación|Acerca/.test(a.textContent ?? ''))).toBe(false);
    expect(f.nativeElement.textContent).toContain('Privacidad — no disponible');
    expect(f.nativeElement.textContent).not.toMatch(/WCAG 2\.[12]/);
  });
  it('no ofrece canales de soporte de demostración', () => {
    const f = page(); expect(f.nativeElement.textContent).not.toMatch(/saip-tesis\.edu|yaiku\.gob\.pe|630-2000|000-0000|Universidad/);
    expect(f.nativeElement.textContent).toContain('canal de soporte verificado');
    expect(f.nativeElement.querySelector('a[href^="tel:"],a[href^="mailto:"]')).toBeNull();
  });
  it('el único destino externo es la ficha oficial verificada y anuncia la pestaña nueva', () => {
    const f = page(); const anchors = f.nativeElement.querySelectorAll('a[target="_blank"]') as NodeListOf<HTMLAnchorElement>;
    expect(anchors).toHaveLength(1); const link = anchors[0];
    expect(new URL(link.href).hostname).toBe('leyes.congreso.gob.pe');
    expect(link.rel).toContain('noopener'); expect(link.rel).toContain('noreferrer');
    expect(link.textContent).toContain('pestaña nueva');
  });
  it.each([null, 'CIUDADANO', 'FUNCIONARIO'])('presentar conserva el guard actual para %s', async role => {
    TestBed.configureTestingModule({ providers: [provideRouter([
      { path: 'ciudadano/nueva-saip', component: DestinationComponent, canActivate: routes.find(r => r.path === 'ciudadano/nueva-saip')!.canActivate },
      { path: 'login', component: DestinationComponent }, { path: '', component: DestinationComponent }
    ])] });
    if (role) TestBed.inject(AuthService).guardarSesion({ success: true, token: 'sesion-sintetica-footer', usuarioId: 901, ciudadanoId: 901, tipoUsuario: role });
    const f = page(); (f.nativeElement.querySelector('a[href="/ciudadano/nueva-saip"]') as HTMLAnchorElement).click(); await f.whenStable();
    expect(TestBed.inject(Router).url).toBe(role === 'CIUDADANO' ? '/ciudadano/nueva-saip' : role ? '/' : '/login');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
