import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DocumentPreviewModalComponent } from './document-preview-modal.component';

describe('DocumentPreviewModalComponent', () => {
  let component: DocumentPreviewModalComponent;
  let fixture: ComponentFixture<DocumentPreviewModalComponent>;
  let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-doc-url');
    revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [DocumentPreviewModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentPreviewModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load canonical official PDF document when opened', () => {
    fixture.componentRef.setInput('doc', {
      nombre: 'Resolucion-TTAIP-001079.pdf',
      tipo: 'application/pdf',
      expediente: '00024-2026-JUS/TTAIP',
    });
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(component.isPdf()).toBe(true);
    expect(component.rawUrl()).toBe('/assets/docs/RESOLUCION_001079-2026_JUS-TTAIP-SEGUNDA SALA.pdf');
    expect(component.safeUrl()).toBeTruthy();
  });

  it('should load user File or Blob when provided', () => {
    const mockFile = new File(['dummy content'], 'mi-archivo.pdf', { type: 'application/pdf' });
    fixture.componentRef.setInput('doc', {
      nombre: 'mi-archivo.pdf',
      file: mockFile,
      tipo: 'application/pdf'
    });
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(component.isPdf()).toBe(true);
    expect(component.rawUrl()).toBe('blob:mock-doc-url');
    expect(component.safeUrl()).toBeTruthy();
  });

  it('should emit close event when onClose is called', () => {
    const closeSpy = vi.spyOn(component.close, 'emit');
    component.onClose();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should handle Escape key press to close modal', () => {
    const closeSpy = vi.spyOn(component.close, 'emit');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    component.onEscape();
    expect(closeSpy).toHaveBeenCalled();
  });
});
