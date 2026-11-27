import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { UxMotionService } from './services/ux-motion.service';
import { AuthService } from './services/auth.service';
import { routes } from './app.routes';

@Component({template:'<h1>Destino sintético</h1>'})
class DestinationComponent {}

function flushBandeja(): void {
  const http = TestBed.inject(HttpTestingController);
  const pending = () => http.match(r => /\/panel\/(?:solicitudes|apelaciones)(?:\?|$)|\/configuracion(?:\?|$)/.test(r.url)).filter(req => !req.cancelled);
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const reqs = pending();
    if (!reqs.length) return;
    for (const req of reqs) {
      req.flush(req.request.url.includes('/configuracion')
        ? { notif: { vencidas: false, proximos: false, umbralProximo: 2 } }
        : { contenido: [], pagina: 0, tamano: 100, totalElementos: 0, totalPaginas: 0 });
    }
  }
}

describe('V2: pie compartido Yaiku', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.setItem('saip_splash_shown', 'true');
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: UxMotionService, useValue: { animateShell: vi.fn(), animateRoute: vi.fn(), dispose: vi.fn() } }] });
  });
  afterEach(() => {
    try { flushBandeja(); TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }); }
    finally { TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); }
  });
  function page(url: string) {
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue(url);
    const f = TestBed.createComponent(App); f.detectChanges(); flushBandeja(); return f;
  }
  it('la consulta pública reutiliza el pie Yaiku sin contactos o enlaces de demostración', () => {
    const f = page('/consultar'), footer = f.nativeElement.querySelector('footer');
    expect(footer.getAttribute('aria-label')).toBe('Pie de Yaiku');
    expect(footer.querySelector('a[href="#"]')).toBeNull();
    expect(footer.textContent).not.toMatch(/saip-tesis\.edu|000-0000|Universidad|2025 SAIP/);
  });
  it('FAQ y documentación conservan destinos y fragmentos reales fuera de la portada', () => {
    const f = page('/ttaip'), footer = f.nativeElement.querySelector('footer');
    expect(footer.querySelector('a[href="/ayuda#faq"]')).not.toBeNull();
    expect(footer.querySelector('a[href="/documentacion#guia"]')).not.toBeNull();
  });
  it.each(['/', '/documentacion', '/acerca', '/consultar', '/ayuda', '/ciudadano', '/funcionario', '/ttaip', '/admin',
    '/ciudadano/solicitud/SYNTHETIC', '/ttaip/apelacion/SYNTHETIC', '/funcionario/solicitud/31',
    '/login', '/registro', '/acceso-funcionario', '/acceso-ttaip', '/acceso-admin'])(
    '%s compone un solo pie institucional con datos y enlaces legales oficiales, sin nueva consulta', url => {
      const f=page(url), footer=f.nativeElement.querySelector('footer');
      expect(f.nativeElement.querySelectorAll('footer')).toHaveLength(1);
      expect(footer.getAttribute('aria-label')).toBe('Pie de Yaiku');
      expect(footer.querySelector('[role="img"][aria-label="Yaiku"]')).not.toBeNull();
      expect(footer.querySelector('a[href="#"],a[href^="mailto:"],a[href^="tel:"]')).toBeNull();
      expect(footer.textContent).not.toMatch(/saip-tesis\.edu|000-0000|Universidad|2025 SAIP|Kelly|Daniel|tesis|proyecto académico/i);
      expect(footer.textContent).toContain('consultas@yaiku.gob.pe');
      expect(footer.textContent).toContain('(01) 630-2000');
      expect(footer.textContent).toContain('Lima, Perú');
      expect(footer.textContent).toContain('© 2026 Yaiku. Todos los derechos reservados.');
      expect(footer.textContent).toContain('Privacidad');
      expect(footer.textContent).toContain('Términos');
      expect(footer.textContent).toContain('Accesibilidad WCAG 2.2');
      TestBed.inject(HttpTestingController).expectNone(() => true);
    });
  it.each([
    ['CIUDADANO','/ciudadano'], ['FUNCIONARIO','/funcionario'], ['TTAIP','/ttaip'], ['ADMINISTRADOR','/admin'],
  ])('el panel %s conserva enlaces propios y no convierte el pie en una consulta institucional', (tipoUsuario,url) => {
    TestBed.inject(AuthService).guardarSesion({success:true,token:'synthetic-shell',usuarioId:7,tipoUsuario});
    const f=page(url), header=f.nativeElement.querySelector('header');
    expect(header.querySelector(`a[href="${url}"]`)).not.toBeNull();
    expect(header.querySelector('app-notification-bell')).not.toBeNull();
    expect(f.nativeElement.querySelectorAll('app-landing-footer')).toHaveLength(1);
    flushBandeja();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
  it('todos los destinos internos del pie corresponden a operaciones o páginas existentes, sin fallback legal', () => {
    const f=page('/ayuda'), footer=f.nativeElement.querySelector('footer');
    const links=Array.from(footer.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    for(const link of links) {
      const href=link.getAttribute('href')!;
      if(href.startsWith('https://')) { expect(new URL(href).hostname).toContain('leyes.congreso.gob.pe'); expect(link.rel).toContain('noopener'); continue; }
      expect(routes.some(r => '/' + r.path === href.split('#')[0])).toBe(true);
      expect(href).not.toMatch(/^\/(privacidad|terminos|accesibilidad)/);
    }
    expect(links.some(l => l.getAttribute('href') === '/#estadisticas')).toBe(true);
    expect(links.some(l => l.getAttribute('href') === '/acerca')).toBe(true);
  });
  it('navegar entre grupos de rutas reutiliza la misma instancia del pie', async () => {
    TestBed.configureTestingModule({providers:[provideRouter([{path:'',component:DestinationComponent},{path:'ayuda',component:DestinationComponent},{path:'documentacion',component:DestinationComponent}])]});
    const f=TestBed.createComponent(App); f.detectChanges(); const footer=f.nativeElement.querySelector('footer');
    const router=TestBed.inject(Router); vi.spyOn(window,'scrollTo').mockImplementation(() => {});
    await router.navigateByUrl('/ayuda'); f.detectChanges(); expect(f.nativeElement.querySelector('footer')).toBe(footer);
    await router.navigateByUrl('/documentacion#guia'); f.detectChanges(); expect(f.nativeElement.querySelector('footer')).toBe(footer);
    expect(router.url).toBe('/documentacion#guia'); TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
