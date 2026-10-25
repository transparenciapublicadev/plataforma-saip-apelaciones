import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReferenceConfirmModalComponent } from './reference-confirm-modal.component';
import { ReferenceSuccessModalComponent } from './reference-success-modal.component';

describe('Diálogos de respuesta: foco opt-in', () => {
  afterEach(() => { TestBed.resetTestingModule(); document.body.innerHTML = ''; });
  for (const component of [ReferenceConfirmModalComponent, ReferenceSuccessModalComponent]) {
    it.each(['default', 'saip-response'])(`${component.name}: contiene Tab/Escape y restaura foco (%s)`, async presentation => {
      const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
      const f = TestBed.createComponent<any>(component); f.componentInstance.open = true;
      (f.componentInstance as any).manageFocus = true;
      (f.componentInstance as any).presentation = presentation;
      const close = vi.fn(); f.componentInstance.close.subscribe(close); f.detectChanges();
      await Promise.resolve();
      const panel = document.querySelector('[role="dialog"]')!;
      expect(panel.contains(document.activeElement)).toBe(true);
      const buttons = panel.querySelectorAll<HTMLButtonElement>('button'); buttons.item(buttons.length - 1).focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(buttons.item(0));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(close).toHaveBeenCalledOnce(); f.destroy(); expect(document.activeElement).toBe(trigger);
    });
  }
  it('no cambia el foco de los consumidores que no activan la opción', () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const f = TestBed.createComponent(ReferenceConfirmModalComponent); f.componentInstance.open = true; f.detectChanges();
    expect(document.activeElement).toBe(trigger);
  });
});
