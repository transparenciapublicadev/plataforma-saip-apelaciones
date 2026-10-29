import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { UxMotionService } from './services/ux-motion.service';
import { GuidedTourService } from './core/guided-tour/guided-tour.service';

@Component({ template: '<h1>Destino sintético</h1>' })
class Destination {}

describe('V6: contexto y menús del shell (router Angular, no backend real)', () => {
  beforeEach(() => {
    sessionStorage.setItem('saip_splash_shown', 'true'); localStorage.clear();
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([{ path: 'destino', component: Destination }]),
      provideHttpClient(), provideHttpClientTesting(),
      { provide: UxMotionService, useValue: { animateShell() {}, animateRoute() {}, dispose() {} } }] });
    TestBed.inject(AuthService).guardarSesion({ success: true, usuarioId: 7, tipoUsuario: 'CIUDADANO', token: 'synthetic-a' });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule();
    document.body.innerHTML = ''; localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks();
  });
  function page() {
    const f = TestBed.createComponent(App); f.detectChanges();
    const tour = TestBed.inject(GuidedTourService);
    return { f, tour, open: () => tour.startTour('saip_tour_done', [{ selector: '[data-missing-tour-target]', title: 'Consulta', body: 'Sin escrituras.' }]) };
  }
  it.each([
    { usuarioId: 8, tipoUsuario: 'CIUDADANO', token: 'synthetic-b' },
    { usuarioId: 7, tipoUsuario: 'FUNCIONARIO', entidadId: 3, token: 'synthetic-a' },
    { usuarioId: 7, tipoUsuario: 'TTAIP', token: 'synthetic-a' },
    { usuarioId: 7, tipoUsuario: 'ADMINISTRADOR', token: 'synthetic-a' },
  ])('cambiar actor/rol cancela el tutorial anterior: $tipoUsuario', data => {
    const { f, tour, open } = page(); open(); f.detectChanges(); expect(tour.isOpen()).toBe(true);
    TestBed.inject(AuthService).guardarSesion({ success: true, ...data }); f.detectChanges();
    expect(tour.isOpen()).toBe(false); expect(tour.steps()).toEqual([]);
    expect(document.querySelector('app-guided-tour [role="dialog"]')).toBeNull();
  });
  it('cambiar el contexto institucional también cancela sin cambiar permisos', () => {
    const auth = TestBed.inject(AuthService);
    auth.guardarSesion({ success: true, usuarioId: 7, funcionarioId: 7, tipoUsuario: 'FUNCIONARIO', entidadId: 3, token: 'synthetic-a' });
    const { f, tour } = page(); tour.startTour('saip_tour_funcionario', [{ selector: '[data-missing-tour-target]', title: 'Entidad', body: 'Consulta' }]); f.detectChanges();
    auth.guardarSesion({ success: true, usuarioId: 7, funcionarioId: 7, tipoUsuario: 'FUNCIONARIO', entidadId: 4, token: 'synthetic-a' }); f.detectChanges();
    expect(tour.isOpen()).toBe(false); expect(auth.obtenerSesion()?.entidadId).toBe(4);
  });
  it('retirar la sesión por storage cancela el tutorial sin llamar al backend', () => {
    const { f, tour, open } = page(); open(); f.detectChanges();
    localStorage.removeItem('usuario'); window.dispatchEvent(new StorageEvent('storage', { key: 'usuario' })); f.detectChanges();
    expect(tour.isOpen()).toBe(false); expect(TestBed.inject(AuthService).getToken()).toBeNull();
  });
  it('navegar cancela al comenzar la ruta y no restaura el tutorial anterior', async () => {
    const { f, tour, open } = page(); open(); f.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/destino'); f.detectChanges();
    expect(tour.isOpen()).toBe(false); expect(tour.currentStep()).toBeNull();
    expect(f.nativeElement.textContent).toContain('Destino sintético');
  });
  it('al abrir manualmente cierra los menús de cabecera y Escape solo cierra el tutorial', async () => {
    const { f, tour, open } = page(); f.componentInstance.menuAbierto.set(true); f.detectChanges();
    open(); f.detectChanges(); await Promise.resolve();
    expect(f.componentInstance.menuAbierto()).toBe(false);
    const close = document.querySelector<HTMLButtonElement>('app-guided-tour button[aria-label="Cerrar tutorial"]')!;
    close.focus(); close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); f.detectChanges();
    expect(tour.isOpen()).toBe(false); expect(f.componentInstance.menuAbierto()).toBe(false);
  });
});
