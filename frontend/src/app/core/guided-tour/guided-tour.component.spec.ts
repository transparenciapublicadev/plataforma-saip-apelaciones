import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidedTourComponent } from './guided-tour.component';
import { GuidedTourService } from './guided-tour.service';
import { ReferenceConfirmModalComponent } from '../../shared/reference-confirm-modal.component';
import { Component, signal } from '@angular/core';

@Component({ imports: [GuidedTourComponent], template: '@if (shown()) { <app-guided-tour /> }' })
class TourHost { readonly shown = signal(true); }

describe('V6: tutorial manual y accesible', () => {
  afterEach(() => {
    TestBed.resetTestingModule(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    document.body.innerHTML = ''; localStorage.removeItem('saip_tour_done'); document.documentElement.classList.remove('dark');
  });
  const steps = [{ selector: '[data-tour="synthetic"]', title: 'Registro sintético', body: 'Consulte el registro; el tutorial no presenta actuaciones.' }];

  it('cerrar inmediatamente no permite una apertura tardía', () => {
    vi.useFakeTimers(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const tour = TestBed.inject(GuidedTourService);
    tour.startTour('saip_tour_done', steps); tour.endTour(); vi.advanceTimersByTime(500);
    expect(tour.isOpen()).toBe(false);
  });

  it('abrir y cerrar manualmente no escribe marcas de primera visita', () => {
    vi.useFakeTimers(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    localStorage.removeItem('saip_tour_done');
    const tour = TestBed.inject(GuidedTourService);
    tour.startTour('saip_tour_done', steps); tour.endTour();
    expect(localStorage.getItem('saip_tour_done')).toBeNull();
  });

  it('abre un diálogo con nombre y foco dentro de sus controles', async () => {
    vi.useFakeTimers(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const f = TestBed.createComponent(GuidedTourComponent); f.detectChanges();
    f.componentInstance.tourService.startTour('saip_tour_done', steps);
    vi.advanceTimersByTime(350); f.detectChanges(); await Promise.resolve();
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    expect(dialog).not.toBeNull(); expect(dialog!.contains(document.activeElement)).toBe(true);
    expect(dialog!.querySelector('h3')?.textContent).toContain('Registro sintético');
  });

  it('un objetivo ausente se explica sin resaltar el fondo como si fuera ese objetivo', () => {
    vi.useFakeTimers(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const f = TestBed.createComponent(GuidedTourComponent); f.detectChanges();
    f.componentInstance.tourService.startTour('saip_tour_done', steps);
    vi.advanceTimersByTime(350); f.detectChanges(); vi.advanceTimersByTime(1700); f.detectChanges();
    expect(document.querySelector('[role="status"]')?.textContent).toContain('no está visible');
    expect(f.componentInstance.rect()).toBeNull();
  });

  it('coloca la tarjeta dentro de una ventana baja en vez de imponer un offset imposible', () => {
    const f = TestBed.createComponent(GuidedTourComponent);
    f.componentInstance.vp.set({ w: 390, h: 120 });
    f.componentInstance.tipSize.set({ w: 340, h: 60 });
    const p = f.componentInstance.placementGeometry();
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.top + 60).toBeLessThanOrEqual(120);
  });

  function target(name = 'synthetic', rect = new DOMRect(80, 250, 200, 60)) {
    const element = document.createElement('button'); element.dataset['tour'] = name;
    document.body.append(element); vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);
    return element;
  }
  async function page(customSteps = steps) {
    vi.useFakeTimers(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const f = TestBed.createComponent(GuidedTourComponent); f.detectChanges();
    f.componentInstance.tourService.startTour('saip_tour_done', customSteps);
    f.detectChanges(); await Promise.resolve();
    return { f, trigger, tour: f.componentInstance.tourService };
  }
  function key(value: string, shiftKey = false) {
    const event = new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event); return event;
  }

  it('no abre automáticamente ni por una primera visita; ignora pasos vacíos', () => {
    vi.useFakeTimers(); const tour = TestBed.inject(GuidedTourService);
    tour.checkAutoStart('saip_tour_done', steps); vi.advanceTimersByTime(3000);
    expect(tour.isOpen()).toBe(false); expect(tour.isFirstVisit('saip_tour_done')).toBe(false);
    tour.startTour('saip_tour_done', []); vi.advanceTimersByTime(1000); expect(tour.isOpen()).toBe(false);
  });

  it('abrir con otro diálogo visible no lo cierra ni crea un tutorial incompatible', () => {
    const modal = document.createElement('section'); modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    document.body.append(modal); const tour = TestBed.inject(GuidedTourService);
    expect(tour.startTour('saip_tour_done', steps)).toBe(false); expect(tour.isOpen()).toBe(false); expect(modal.isConnected).toBe(true);
  });

  it('no resalta un objetivo oculto; puede continuar, retroceder y finalizar sin activarlo', async () => {
    const hidden = target(); hidden.hidden = true; const click = vi.fn(); hidden.addEventListener('click', click);
    const visible = target('second');
    const { f, tour, trigger } = await page([...steps, { selector: '[data-tour="second"]', title: 'Segundo paso', body: 'Consulta' }]);
    vi.advanceTimersByTime(1800); f.detectChanges(); expect(f.componentInstance.rect()).toBeNull();
    expect(document.querySelector('[role="status"]')!.textContent).toContain('no está visible');
    key('ArrowRight'); f.detectChanges(); expect(tour.activeStepIndex()).toBe(1);
    expect(f.componentInstance.rect()?.width).toBe(visible.getBoundingClientRect().width);
    key('ArrowLeft'); f.detectChanges(); expect(tour.activeStepIndex()).toBe(0); expect(f.componentInstance.rect()).toBeNull();
    tour.nextStep(); f.detectChanges(); tour.nextStep(); f.detectChanges(); expect(tour.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger); expect(click).not.toHaveBeenCalled();
  });

  it('Tab/Shift+Tab y Escape contienen y restauran el foco sin bloquear scroll del documento', async () => {
    target(); const original = document.body.style.overflow; const { f, trigger } = await page();
    const buttons = document.querySelector('[role="dialog"]')!.querySelectorAll<HTMLButtonElement>('button');
    buttons[0].focus(); key('Tab', true); expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    key('Tab'); expect(document.activeElement).toBe(buttons[0]);
    key('Escape'); f.detectChanges(); expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger); expect(document.body.style.overflow).toBe(original);
    expect(key('Tab').defaultPrevented).toBe(false); expect(key('Escape').defaultPrevented).toBe(false);
  });

  it('retroceder desde el botón que desaparece no deja foco en el fondo', async () => {
    target(); target('second'); const { f } = await page([...steps, { selector: '[data-tour="second"]', title: 'Segundo', body: 'Consulta' }]);
    key('ArrowRight'); f.detectChanges();
    const previous = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(b => b.textContent?.includes('Anterior'))!;
    previous.focus(); previous.click(); f.detectChanges(); await Promise.resolve();
    expect(document.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
  });

  it('un objetivo que desaparece elimina el resaltado y uno posterior se puede recuperar', async () => {
    const el = target(); const { f } = await page(); expect(f.componentInstance.rect()).not.toBeNull();
    el.remove(); await Promise.resolve(); vi.advanceTimersByTime(32); f.detectChanges(); expect(f.componentInstance.rect()).toBeNull();
    vi.advanceTimersByTime(1800); f.detectChanges();
    // Re-appearance is observed; no unbounded polling or another server operation is required.
    target(); await Promise.resolve(); vi.advanceTimersByTime(32); f.detectChanges();
    expect(f.componentInstance.targetState()).toBe('ready'); expect(f.componentInstance.rect()).not.toBeNull();
  });

  it('cambiar de paso antes de localizar un objetivo no recupera el anterior tardíamente', async () => {
    target('second', new DOMRect(90, 320, 180, 55));
    const { f, tour } = await page([...steps, { selector: '[data-tour="second"]', title: 'Segundo', body: 'Consulta' }]);
    tour.nextStep(); f.detectChanges(); target('synthetic', new DOMRect(20, 10, 50, 20));
    await Promise.resolve(); vi.advanceTimersByTime(1900); f.detectChanges();
    expect(tour.activeStepIndex()).toBe(1); expect(f.componentInstance.rect()?.top).toBe(320);
  });

  it('cerrar o destruir durante la búsqueda cancela frames y no repuebla contenido', async () => {
    const { f, tour, trigger } = await page(); tour.endTour(); f.detectChanges();
    target(); await Promise.resolve(); vi.advanceTimersByTime(3000); f.detectChanges();
    expect(tour.isOpen()).toBe(false); expect(f.componentInstance.rect()).toBeNull(); expect(document.activeElement).toBe(trigger);
    f.destroy();
    // Destroy the component through its Angular owner, as a routed panel would.
    const host = TestBed.createComponent(TourHost); host.detectChanges();
    tour.startTour('saip_tour_done', steps); host.detectChanges();
    host.componentInstance.shown.set(false); host.detectChanges();
    vi.advanceTimersByTime(3000); window.dispatchEvent(new Event('resize'));
    expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(tour.isOpen()).toBe(false);
    expect(key('Escape').defaultPrevented).toBe(false);
  });

  it('un diálogo nuevo toma el foco; el tutorial se retira sin cerrarlo ni robarlo', async () => {
    target(); const { f, tour } = await page();
    const child = TestBed.createComponent(ReferenceConfirmModalComponent);
    Object.assign(child.componentInstance, { open: true, manageFocus: true }); const close = vi.fn(); child.componentInstance.close.subscribe(close);
    child.detectChanges(); await Promise.resolve(); vi.advanceTimersByTime(32); f.detectChanges();
    expect(tour.isOpen()).toBe(false); expect(close).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
    key('Escape'); expect(close).toHaveBeenCalledOnce();
  });

  it('scroll/resize siguen el objetivo y limitan la tarjeta al viewport actualizado', async () => {
    const el = target(); const { f } = await page();
    vi.mocked(el.getBoundingClientRect).mockReturnValue(new DOMRect(20, 600, 200, 60));
    vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 720);
    window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(32); f.detectChanges();
    expect(f.componentInstance.rect()?.top).toBe(600); expect(f.componentInstance.vp()).toEqual({ w: 390, h: 720 });
    expect(f.componentInstance.placementGeometry().left + f.componentInstance.tipWidth()).toBeLessThanOrEqual(390);
    vi.unstubAllGlobals();
  });

  it('movimiento reducido evita el scroll suave y el cambio de tema actualiza el resaltado', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    target(); const { f } = await page();
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }));
    document.documentElement.classList.add('dark'); await Promise.resolve(); vi.advanceTimersByTime(32); f.detectChanges();
    expect(f.componentInstance.isDark()).toBe(true); expect(f.componentInstance.reducedMotion()).toBe(true);
    document.documentElement.classList.remove('dark'); vi.unstubAllGlobals();
  });

  it('el cierre por contexto solo afecta al tutorial del panel correspondiente', () => {
    const tour = TestBed.inject(GuidedTourService); tour.startTour('saip_tour_ttaip', steps);
    tour.endTourFor('saip_tour_done'); expect(tour.isOpen()).toBe(true);
    tour.endTourFor('saip_tour_ttaip'); expect(tour.isOpen()).toBe(false); expect(tour.steps()).toEqual([]);
  });
});
