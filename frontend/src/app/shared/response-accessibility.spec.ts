import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { MultiFileUploadZoneComponent } from './multi-file-upload-zone.component';

describe('Adjuntos de respuesta: acceso por teclado opt-in', () => {
  it('abre la selección con Enter y espacio sin subir ni generar archivos', () => {
    const f = TestBed.createComponent(MultiFileUploadZoneComponent);
    f.componentRef.setInput('keyboardAccessible', true); f.componentRef.setInput('label', 'Documentos'); f.detectChanges();
    const input = f.nativeElement.querySelector('input[type="file"]'); const open = vi.spyOn(input, 'click');
    const zone = f.nativeElement.querySelector('[role="button"]');
    expect(zone.getAttribute('tabindex')).toBe('0'); expect(zone.getAttribute('aria-label')).toContain('Documentos');
    for (const key of ['Enter', ' ']) zone.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    expect(open).toHaveBeenCalledTimes(2); expect(f.componentInstance.files()).toEqual([]);
  });
  it('conserva el comportamiento de otros consumidores que no activan la opción', () => {
    const f = TestBed.createComponent(MultiFileUploadZoneComponent); f.detectChanges();
    expect(f.nativeElement.querySelector('[role="button"]')).toBeNull();
  });
  it('muestra y previsualiza los archivos elegidos juntos antes de enviarlos', () => {
    const fixture = TestBed.createComponent(MultiFileUploadZoneComponent);
    fixture.componentRef.setInput('batch', true);
    fixture.componentRef.setInput('allowText', true);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    const pdf = new File(['%PDF-1.4'], 'resolucion.pdf', { type: 'application/pdf' });
    const texto = new File(['nota'], 'nota.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [pdf, texto] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(input.multiple).toBe(true);
    expect(fixture.componentInstance.files()).toEqual([pdf, texto]);
    const preview = [...root.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Previsualizar');
    expect(preview).toBeDefined();
    preview!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.previewSlot()?.file).toBe(pdf);
    expect(root.ownerDocument.querySelector('iframe[title="resolucion.pdf"]')).not.toBeNull();
  });
});
