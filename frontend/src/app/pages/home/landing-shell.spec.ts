import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app';
import { HomeComponent } from './home.component';
import { UxMotionService } from '../../services/ux-motion.service';
import { environment } from '../../../environments/environment';

@Component({ template: '<h1>Página de prueba</h1>' })
class DestinationComponent {}

describe('Landing dentro del shell compartido', () => {
  const response = { metricas: { saipPresentadas: 0, respondidas: 0, apelaciones: 0, entidades: 0, personasApelantes: 0, tasaResolucion: 0 },
    ejemplosSolicitud: [], preguntasFrecuentes: [], apelacionesPorEntidad: [], tendenciaMensual: [], miembrosTTAIP: [] };
  beforeEach(() => {
    localStorage.clear(); sessionStorage.setItem('saip_splash_shown', 'true');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    TestBed.configureTestingModule({ imports: [App], providers: [
      provideRouter([{ path: '', component: HomeComponent }, { path: 'ayuda', component: DestinationComponent }, { path: 'login', component: DestinationComponent }]),
      provideHttpClient(), provideHttpClientTesting(),
      { provide: UxMotionService, useValue: { animateShell: vi.fn(), animateRoute: vi.fn(), dispose: vi.fn() } }
    ] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }); TestBed.resetTestingModule(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });
  async function page(path = '/') {
    const f = TestBed.createComponent(App); f.detectChanges(); await TestBed.inject(Router).navigateByUrl(path); f.detectChanges();
    for (const req of TestBed.inject(HttpTestingController).match(`${environment.apiUrl}/public/portal`)) req.flush(response);
    f.detectChanges(); return f;
  }
  it('muestra un solo pie de Yaiku en el inicio y conserva la cabecera y los accesos', async () => {
    const f = await page(); expect(f.nativeElement.querySelectorAll('footer')).toHaveLength(1);
    expect(f.nativeElement.querySelector('app-landing-footer')).not.toBeNull();
    expect(f.nativeElement.querySelector('header a[href="/login"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('header')).not.toBeNull();
  });
  it.each(['/ayuda', '/login'])('el cambio de pie no rediseña el shell de %s', async path => {
    const f = await page(path); expect(f.nativeElement.querySelector('app-landing-footer')).toBeNull();
    expect(f.nativeElement.querySelectorAll('footer')).toHaveLength(1);
    expect(f.nativeElement.querySelector('footer.saip-footer')).not.toBeNull();
  });
  it('el enlace a estadísticas mueve el foco y no queda sobrescrito por el scroll al inicio del shell', async () => {
    const f = await page(); document.body.appendChild(f.nativeElement);
    try {
      const section = f.nativeElement.querySelector('#estadisticas') as HTMLElement;
      vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({ top: 500 } as DOMRect);
      const scroll = vi.mocked(window.scrollTo); scroll.mockClear();
      (f.nativeElement.querySelector('app-landing-footer a[href="/#estadisticas"]') as HTMLAnchorElement).click();
      await f.whenStable(); f.detectChanges();
      expect(TestBed.inject(Router).url).toBe('/#estadisticas');
      expect(scroll).toHaveBeenLastCalledWith({ top: 400, behavior: 'smooth' }); expect(document.activeElement).toBe(section);
    } finally { f.nativeElement.remove(); }
  });
});
