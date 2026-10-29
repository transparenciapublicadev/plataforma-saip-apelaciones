import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReferenceConfirmModalComponent } from './reference-confirm-modal.component';
import { ReferenceSuccessModalComponent } from './reference-success-modal.component';
import { OfficialPreviewComponent } from '../pages/ttaip/shared/official-preview.component';
import { ModalFocusDirective } from './modal-focus.directive';
import { BodyPortalDirective } from './body-portal.directive';

@Component({
  imports: [OfficialPreviewComponent, ModalFocusDirective, BodyPortalDirective],
  template: `
    <button id="open-review" (click)="open.set(true)">Abrir revisión</button>
    @if (open()) {
      <ng-container *appBodyPortal>
        <section role="dialog" aria-modal="true" aria-label="Revisión sintética" tabindex="-1"
          [appModalFocus]="true" (modalEscape)="open.set(false)">
          <button (click)="open.set(false)">Cerrar revisión</button>
          <app-official-preview stage="primera" decision="admisible" [ctx]="ctx" />
          <button>Continuar revisión</button>
        </section>
      </ng-container>
    }
  `,
})
class ReviewHost {
  open = signal(false);
  ctx = { expediente: '00031-2026-JUS/TTAIP', recurrente: 'Persona sintética' };
}

describe('V5: marca y ampliación accesible del borrador', () => {
  afterEach(() => { TestBed.resetTestingModule(); document.body.innerHTML = ''; vi.restoreAllMocks(); });
  for (const component of [ReferenceConfirmModalComponent, ReferenceSuccessModalComponent]) {
    it(`${component.name}: default utiliza la marca compartida Yaiku`, () => {
      const f = TestBed.createComponent<any>(component); f.componentRef.setInput('open', true); f.detectChanges();
      expect(document.querySelector('[role="dialog"] app-dialog-brand')).not.toBeNull();
      expect(document.querySelector('[role="dialog"]')!.textContent).not.toContain('TTAIP · República del Perú');
    });
  }
  it('ampliar crea un diálogo identificado como borrador y enfoca su cierre', async () => {
    const f = TestBed.createComponent(OfficialPreviewComponent); f.detectChanges();
    (f.nativeElement.querySelector('button[title="Pantalla completa"]') as HTMLButtonElement).click(); f.detectChanges(); await Promise.resolve();
    const dialog = document.querySelector('[role="dialog"][aria-label*="Borrador"]');
    expect(dialog).not.toBeNull(); expect(dialog!.contains(document.activeElement)).toBe(true);
  });
  it('Escape en la ampliación no cierra el overlay padre', async () => {
    const f = TestBed.createComponent(ReviewHost); f.detectChanges();
    const trigger = f.nativeElement.querySelector('#open-review') as HTMLButtonElement; trigger.focus(); trigger.click(); f.detectChanges(); await Promise.resolve();
    (document.querySelector('button[title="Pantalla completa"]') as HTMLButtonElement).click(); f.detectChanges(); await Promise.resolve();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); f.detectChanges();
    expect(f.componentInstance.open()).toBe(true);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  function key(value: string, shiftKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event); return event;
  }
  async function openZoom(f: ComponentFixture<unknown>): Promise<HTMLButtonElement> {
    const trigger = document.querySelector('[data-draft-zoom-open]') as HTMLButtonElement;
    trigger.click(); f.detectChanges(); await Promise.resolve(); return trigger;
  }
  function zoom(): HTMLElement | null { return document.querySelector('[role="dialog"][aria-label^="Borrador ampliado"]'); }

  for (const presentation of ['default', 'saip-response'] as const) {
    it(`confirmación ${presentation}: conserva datos largos, callbacks y bloqueo de envío`, async () => {
      const f = TestBed.createComponent(ReferenceConfirmModalComponent);
      const detail = 'El registro no acredita notificación eficaz. '.repeat(12);
      Object.assign(f.componentInstance, {
        open: true, presentation, manageFocus: true, title: 'Revisar actuación',
        titleLead: 'Revisar', titleEmphasis: 'actuación', confirmLabel: 'Registrar actuación',
        summary: [{ label: 'Requerimiento', value: 'REQ-31 · ' + 'Nombre extenso '.repeat(20) }], warning: { label: 'Registro', detail }
      });
      const confirm = vi.fn(), close = vi.fn(); f.componentInstance.confirm.subscribe(confirm); f.componentInstance.close.subscribe(close);
      f.detectChanges(); await Promise.resolve();
      const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(panel.getAttribute('aria-label')).toBe('Revisar actuación'); expect(panel.textContent).toContain(detail);
      expect(panel.querySelector('dd')!.textContent).toContain('REQ-31'); expect(confirm).not.toHaveBeenCalled();
      const button = Array.from(panel.querySelectorAll('button')).find(b => b.textContent!.includes('Registrar actuación'))!;
      button.click(); expect(confirm).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled();
      f.componentRef.setInput('submitting', true); f.detectChanges();
      document.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.click()); key('Escape'); key('Tab');
      expect(document.activeElement).toBe(panel); expect(close).not.toHaveBeenCalled(); expect(confirm).toHaveBeenCalledOnce();
      f.componentRef.setInput('submitting', false); f.detectChanges(); key('Escape'); expect(close).toHaveBeenCalledOnce();
    });
    it(`resultado ${presentation}: conserva IDs y advertencias sin emitir callbacks automáticamente`, () => {
      const f = TestBed.createComponent(ReferenceSuccessModalComponent);
      Object.assign(f.componentInstance, {
        open: true, presentation, variant: 'calificacion-2da', title: 'Calificación registrada',
        expediente: '00031-2026-JUS/TTAIP', description: 'El registro no acredita firma ni emisión formal.',
        metadata: [{ label: 'Actuación', value: '92 · ' + 'Documento extenso '.repeat(20) }], primaryLabel: 'Volver al panel', secondaryLabel: 'Consultar expediente'
      });
      const primary = vi.fn(), secondary = vi.fn(), close = vi.fn();
      f.componentInstance.primary.subscribe(primary); f.componentInstance.secondary.subscribe(secondary); f.componentInstance.close.subscribe(close); f.detectChanges();
      const panel = document.querySelector('[role="dialog"]')!;
      expect(panel.getAttribute('aria-label')).toBe('Calificación registrada'); expect(panel.textContent).toContain('00031-2026-JUS/TTAIP');
      expect(panel.textContent).toContain('El registro no acredita firma ni emisión formal.'); expect(panel.textContent).toContain('92 · Documento extenso');
      expect(primary).not.toHaveBeenCalled(); expect(secondary).not.toHaveBeenCalled();
      const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button'));
      buttons.find(b => b.textContent?.trim() === 'Consultar expediente')!.click(); expect(secondary).toHaveBeenCalledOnce(); expect(primary).not.toHaveBeenCalled();
      buttons.find(b => b.textContent?.trim() === 'Volver al panel')!.click(); expect(primary).toHaveBeenCalledOnce();
      buttons.find(b => b.getAttribute('aria-label') === 'Cerrar')!.click(); expect(close).toHaveBeenCalledOnce();
    });
    it(`diálogo ${presentation} anidado: solo el superior gestiona Tab/Escape y devuelve foco al padre`, async () => {
      const f = TestBed.createComponent(ReviewHost); f.detectChanges();
      (f.nativeElement.querySelector('#open-review') as HTMLButtonElement).click(); f.detectChanges(); await Promise.resolve();
      const parentButton = document.querySelector<HTMLButtonElement>('[aria-label="Revisión sintética"] button')!; parentButton.focus();
      const child = TestBed.createComponent(ReferenceConfirmModalComponent);
      Object.assign(child.componentInstance, { open: true, presentation, manageFocus: true }); const close = vi.fn(); child.componentInstance.close.subscribe(close);
      child.detectChanges(); await Promise.resolve(); const panel = document.querySelector('.reference-confirm-panel')!;
      const buttons = panel.querySelectorAll<HTMLButtonElement>('button'); buttons[0].focus(); key('Tab', true);
      expect(document.activeElement).toBe(buttons[buttons.length - 1]); key('Tab'); expect(document.activeElement).toBe(buttons[0]);
      key('Escape'); expect(close).toHaveBeenCalledOnce(); expect(f.componentInstance.open()).toBe(true);
      child.destroy(); expect(document.activeElement).toBe(parentButton);
    });
  }

  it('Tab/Shift+Tab, Escape, cierre y reapertura conservan el borrador y devuelven el foco', async () => {
    const f = TestBed.createComponent(OfficialPreviewComponent); f.detectChanges(); const trigger = await openZoom(f);
    expect(zoom()!.getAttribute('aria-modal')).toBe('true'); expect(zoom()!.querySelector('h2')!.textContent).toContain('Borrador');
    expect(zoom()!.querySelector('[role="note"]')!.textContent).toContain('BORRADOR');
    expect(zoom()!.textContent).toContain('Sin verificación de firma digital'); expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const close = zoom()!.querySelector('button')!;
    expect(key('Tab').defaultPrevented).toBe(true); expect(document.activeElement).toBe(close);
    expect(key('Tab', true).defaultPrevented).toBe(true); expect(document.activeElement).toBe(close);
    key('Escape'); f.detectChanges(); expect(zoom()).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false'); await openZoom(f); expect(zoom()!.contains(document.activeElement)).toBe(true);
    zoom()!.querySelector('button')!.click(); f.detectChanges(); expect(document.activeElement).toBe(trigger);
  });
  it('click dentro conserva la ampliación; el fondo la cierra', async () => {
    const f = TestBed.createComponent(OfficialPreviewComponent); f.detectChanges(); const trigger = await openZoom(f);
    zoom()!.querySelector('h2')!.click(); f.detectChanges(); expect(zoom()).not.toBeNull();
    zoom()!.parentElement!.click(); f.detectChanges(); expect(zoom()).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
  it.each(['ctx', 'stage', 'decision', 'cedulaVariant', 'vistos', 'considerando', 'seResuelve'])(
    'cambiar %s cierra la ampliación, limpia el portal y restaura foco', async input => {
      const f = TestBed.createComponent(OfficialPreviewComponent); f.detectChanges(); const trigger = await openZoom(f);
      const values: Record<string, unknown> = {
        ctx: { expediente: 'OTRO-32' }, stage: 'segunda', decision: 'improcedente',
        cedulaVariant: 'otro', vistos: 'Otros antecedentes', considerando: 'Otro fundamento', seResuelve: 'Otro artículo'
      };
      // SetInput must change the input, including the default cedula variant.
      if (input === 'cedulaVariant') values[input] = 'admision';
      f.componentRef.setInput(input, values[input]); f.detectChanges();
      expect(zoom()).toBeNull(); expect(document.activeElement).toBe(trigger); expect(document.body.style.overflow).not.toBe('hidden');
    });
  it('pestaña nueva cierra zoom; contexto nuevo vuelve a resolución y no conserva el expediente anterior', async () => {
    const f = TestBed.createComponent(OfficialPreviewComponent); f.componentRef.setInput('ctx', { expediente: 'ANTERIOR-31' }); f.detectChanges();
    await openZoom(f); f.componentInstance.activeDoc.set('cedula-recurrente'); f.detectChanges(); expect(zoom()).toBeNull();
    await openZoom(f); expect(zoom()!.getAttribute('aria-label')).toContain('Cédula · Administrado');
    f.componentRef.setInput('ctx', { expediente: 'NUEVO-32' }); f.detectChanges(); expect(zoom()).toBeNull(); expect(f.componentInstance.activeDoc()).toBe('resolucion');
    await openZoom(f); expect(zoom()!.textContent).toContain('NUEVO-32'); expect(zoom()!.textContent).not.toContain('ANTERIOR-31');
  });
  it('cerrar ampliación anidada restaura foco dentro del padre y conserva su bloqueo de scroll', async () => {
    const f = TestBed.createComponent(ReviewHost); f.detectChanges(); const trigger = f.nativeElement.querySelector('#open-review') as HTMLButtonElement;
    trigger.focus(); trigger.click(); f.detectChanges(); await Promise.resolve(); const zoomTrigger = await openZoom(f);
    const close = zoom()!.querySelector('button')!; key('Tab', true); expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges();
    expect(f.componentInstance.open()).toBe(true); expect(document.activeElement).toBe(zoomTrigger); expect(document.body.style.overflow).toBe('hidden');
    key('Escape'); f.detectChanges(); expect(f.componentInstance.open()).toBe(false); expect(document.activeElement).toBe(trigger); expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('destruir padre con zoom abierto libera teclado/scroll y retorna al disparador exterior', async () => {
    const f = TestBed.createComponent(ReviewHost); f.detectChanges(); const trigger = f.nativeElement.querySelector('#open-review') as HTMLButtonElement;
    trigger.focus(); trigger.click(); f.detectChanges(); await Promise.resolve(); await openZoom(f);
    f.componentInstance.open.set(false); f.detectChanges(); await Promise.resolve();
    expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe('hidden'); expect(key('Tab').defaultPrevented).toBe(false); expect(key('Escape').defaultPrevented).toBe(false);
  });
  it('destruir antes del foco diferido no roba foco ni deja listeners', async () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const f = TestBed.createComponent(OfficialPreviewComponent); f.detectChanges();
    (f.nativeElement.querySelector('[data-draft-zoom-open]') as HTMLButtonElement).click(); f.detectChanges(); f.destroy(); trigger.focus(); await Promise.resolve();
    expect(document.activeElement).toBe(trigger); expect(zoom()).toBeNull(); expect(key('Tab').defaultPrevented).toBe(false); expect(key('Escape').defaultPrevented).toBe(false);
  });
});
