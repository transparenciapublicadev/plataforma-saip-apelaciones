import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReferenceConfirmModalComponent } from './reference-confirm-modal.component';
import { ReferenceSuccessModalComponent } from './reference-success-modal.component';

describe('Presentación de diálogos de respuesta SAIP', () => {
  afterEach(() => { TestBed.resetTestingModule(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

  for (const component of [ReferenceConfirmModalComponent, ReferenceSuccessModalComponent]) {
    it(`${component.name}: incorpora Yaiku también en la presentación predeterminada`, () => {
      const f = TestBed.createComponent<any>(component);
      f.componentInstance.open = true; f.detectChanges();
      expect(document.body.textContent).not.toContain('TTAIP · República del Perú');
      expect(document.body.textContent).toContain('Pide, sigue y apela. Todo en un solo lugar.');
    });

    it(`${component.name}: conserva la identidad y el nombre de la presentación SAIP`, () => {
      const f = TestBed.createComponent<any>(component);
      Object.assign(f.componentInstance, { open: true, presentation: 'saip-response', title: 'Registro SAIP' });
      f.detectChanges();
      expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Registro SAIP');
      expect(document.body.textContent).toContain('Yaiku');
      expect(document.body.textContent).toContain('Pide, sigue y apela. Todo en un solo lugar.');
      expect(document.body.textContent).not.toContain('TTAIP · República del Perú');
    });
  }

  it('confirma un registro solo por su acción y bloquea cierre/confirmación durante el envío', () => {
    const f = TestBed.createComponent(ReferenceConfirmModalComponent);
    Object.assign(f.componentInstance, { open: true, presentation: 'saip-response', manageFocus: true,
      title: 'Confirme la respuesta', titleLead: 'Confirme', titleEmphasis: 'la respuesta',
      confirmLabel: 'Registrar respuesta', summary: [{ label: 'Expediente', value: 'SAIP-2026-00041' }],
      description: 'Registrar no acredita entrega ni notificación eficaz.' });
    const confirm = vi.fn(), close = vi.fn();
    f.componentInstance.confirm.subscribe(confirm); f.componentInstance.close.subscribe(close); f.detectChanges();
    expect(confirm).not.toHaveBeenCalled();
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find(b => b.textContent?.includes('Registrar respuesta'))!;
    button.click(); expect(confirm).toHaveBeenCalledOnce();
    f.componentRef.setInput('submitting', true); f.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    button.click();
    expect(confirm).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled();
    expect(Array.from(document.querySelectorAll('button')).every(b => b.disabled)).toBe(true);
    expect(document.body.textContent).toContain('SAIP-2026-00041');
  });

  it('expone metadatos de la recepción como términos y valores sin crear identificadores', () => {
    const f = TestBed.createComponent(ReferenceSuccessModalComponent);
    Object.assign(f.componentInstance, { open: true, presentation: 'saip-response', variant: 'respuesta-entidad',
      title: 'Respuesta registrada en el expediente', expediente: 'SAIP-2026-00041',
      description: 'Se recuperó la respuesta registrada. Esto no acredita por sí solo entrega ni notificación eficaz.',
      metadata: [{ label: 'Recepción', value: '15 · respuesta 41' },
        { label: 'Documentos recibidos', value: 'informe-real.pdf, anexo-real.txt' }],
      primaryLabel: 'Ir a mi panel', secondaryLabel: 'Ver expediente' });
    const primary = vi.fn(), secondary = vi.fn();
    f.componentInstance.primary.subscribe(primary); f.componentInstance.secondary.subscribe(secondary); f.detectChanges();
    const terms = Array.from(document.querySelectorAll('dl dt')).map(e => e.textContent?.trim());
    const values = Array.from(document.querySelectorAll('dl dd')).map(e => e.textContent?.trim());
    expect(terms).toEqual(['Recepción', 'Documentos recibidos']);
    expect(values).toEqual(['15 · respuesta 41', 'informe-real.pdf, anexo-real.txt']);
    expect(document.body.textContent).toContain('no acredita por sí solo entrega ni notificación eficaz');
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    buttons.find(b => b.textContent?.trim() === 'Ver expediente')!.click();
    expect(secondary).toHaveBeenCalledOnce(); expect(primary).not.toHaveBeenCalled();
    buttons.find(b => b.textContent?.trim() === 'Ir a mi panel')!.click(); expect(primary).toHaveBeenCalledOnce();
  });
});
