import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentPreviewModalComponent } from './document-preview-modal.component';
import { DocumentoService } from '../services/documento.service';
import { DocumentoDescarga } from '../models/documento.model';

describe('DocumentPreviewModalComponent — archivo real', () => {
  const documentos = { download: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:real');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await TestBed.configureTestingModule({
      imports: [DocumentPreviewModalComponent],
      providers: [{ provide: DocumentoService, useValue: documentos }],
    }).compileComponents();
  });
  afterEach(() => vi.restoreAllMocks());
  function abrir(doc: { id?: number; nombre: string; url?: string; file?: File }) {
    const f = TestBed.createComponent(DocumentPreviewModalComponent);
    f.componentRef.setInput('doc', doc);
    f.componentRef.setInput('open', true);
    f.detectChanges();
    return f;
  }

  it('un error de backend no habilita la vista previa ni descarga de un sustituto', () => {
    documentos.download.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const f = TestBed.createComponent(DocumentPreviewModalComponent);
    f.componentRef.setInput('doc', { id: 88, nombre: 'Resolucion.pdf' });
    f.componentRef.setInput('open', true);
    f.detectChanges();
    expect(f.componentInstance.rawUrl()).toBeNull();
    expect(f.componentInstance.error()).toBeTruthy();
  });

  it.each([400, 401, 403, 404, 500, 0])('el error %s no habilita descarga ni utiliza URL alternativa', status => {
    documentos.download.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    const f = abrir({ id: 88, nombre: 'Resolucion.pdf', url: '/assets/docs/SAIP-OFICIAL.pdf' });
    expect(f.componentInstance.rawUrl()).toBeNull();
    expect(f.componentInstance.safeUrl()).toBeNull();
    expect(f.componentInstance.error()).toBeTruthy();
    expect(document.body.querySelector('iframe')).toBeNull();
    f.componentInstance.descargar();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('sin ID, URL explícita ni bytes no infiere un PDF por su nombre', () => {
    const f = abrir({ nombre: 'Solicitud-SAIP-2026-00023.pdf' });
    expect(f.componentInstance.rawUrl()).toBeNull();
    expect(f.componentInstance.error()).toContain('no dispone');
    expect(documentos.download).not.toHaveBeenCalled();
  });

  it('reintenta contra el ID real y libera los bytes al cerrar', () => {
    documentos.download.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const f = abrir({ id: 88, nombre: 'real.pdf' });
    const blob = new Blob(['%PDF-real'], { type: 'application/pdf' });
    documentos.download.mockReturnValue(of({ blob, filename: 'real.pdf' }));
    f.componentInstance.reintentar(); f.detectChanges();
    expect(documentos.download).toHaveBeenLastCalledWith(88, 'real.pdf');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(f.componentInstance.error()).toBeNull();
    f.componentInstance.onClose();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:real');
    expect(f.componentInstance.rawUrl()).toBeNull();
  });

  it('cambiar documento cancela la consulta anterior sin reutilizar sus bytes', () => {
    const anterior = new Subject<DocumentoDescarga>();
    documentos.download.mockReturnValue(anterior);
    const f = abrir({ id: 88, nombre: 'anterior.pdf' });
    documentos.download.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    f.componentRef.setInput('doc', { id: 89, nombre: 'nuevo.pdf' }); f.detectChanges();
    anterior.next({ blob: new Blob(['old']), filename: 'anterior.pdf' });
    expect(f.componentInstance.rawUrl()).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(f.componentInstance.error()).toContain('No se encontró');
  });

  it('conserva la plantilla oficial con nombre y URL explícitos', () => {
    const f = abrir({ nombre: 'Plantilla oficial SAIP.pdf', url: '/assets/docs/SAIP-OFICIAL.pdf' });
    expect(documentos.download).not.toHaveBeenCalled();
    expect(f.componentInstance.rawUrl()).toBe('/assets/docs/SAIP-OFICIAL.pdf');
    expect(document.body.textContent).toContain('Plantilla oficial');
  });

  it('solicita la primera página al abrir y reabrir un PDF local y conserva la URL de descarga', () => {
    const file = new File(['local'], 'adjunto-local.pdf', { type: 'application/pdf' });
    const f = abrir({ nombre: file.name, file });
    expect(documentos.download).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(document.body.querySelector('iframe')?.getAttribute('src')).toBe('blob:real#page=1&navpanes=0&view=FitH');
    expect(f.componentInstance.rawUrl()).toBe('blob:real');
    f.componentRef.setInput('open', false); f.detectChanges();
    expect(document.body.querySelector('iframe')).toBeNull();
    f.componentRef.setInput('open', true); f.detectChanges();
    expect(document.body.querySelector('iframe')?.getAttribute('src')).toBe('blob:real#page=1&navpanes=0&view=FitH');
  });

  it('contiene el foco del visor SAIP y lo devuelve al control que lo abrió', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger); trigger.focus();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const f = TestBed.createComponent(DocumentPreviewModalComponent);
    f.componentRef.setInput('manageFocus', true);
    f.componentRef.setInput('doc', { nombre: 'adjunto.pdf', file: new File(['pdf'], 'adjunto.pdf') });
    f.componentRef.setInput('open', true); f.detectChanges();
    await Promise.resolve();
    const panel = document.querySelector('[role="dialog"]')!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('aria-label')).toBe('adjunto.pdf');
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    const buttons = panel.querySelectorAll<HTMLButtonElement>('button');
    buttons.item(buttons.length - 1).focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons.item(0));
    const close = vi.fn(); f.componentInstance.close.subscribe(close);
    buttons.item(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(close).toHaveBeenCalledOnce();
    f.componentRef.setInput('open', false); f.detectChanges();
    expect(document.activeElement).toBe(trigger);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    f.destroy(); trigger.remove();
  });
});
