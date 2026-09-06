import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DocumentoService } from '../services/documento.service';
import { DocumentUploadComponent } from './document-upload.component';

describe('DocumentUploadComponent', () => {
  let fixture: ComponentFixture<DocumentUploadComponent>;
  let component: DocumentUploadComponent;
  const documentoService = {
    upload: vi.fn()
  };

  beforeEach(async () => {
    documentoService.upload.mockReset();
    await TestBed.configureTestingModule({
      imports: [DocumentUploadComponent],
      providers: [{ provide: DocumentoService, useValue: documentoService }]
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentUploadComponent);
    fixture.componentRef.setInput('relation', { solicitudId: 7 });
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('rejects unsupported files before calling the API', () => {
    const file = new File(['contenido'], 'payload.exe', { type: 'application/octet-stream' });

    component.onFileSelected({ target: { files: [file], value: 'payload.exe' } } as unknown as Event);

    expect(component.error()).toContain('Formato no permitido');
    expect(documentoService.upload).not.toHaveBeenCalled();
  });

  it('uploads a valid file and clears the selected input', () => {
    const file = new File(['contenido'], 'solicitud.pdf', { type: 'application/pdf' });
    documentoService.upload.mockReturnValue(of({ id: 8, nombreOriginal: file.name }));

    component.onFileSelected({ target: { files: [file], value: file.name } } as unknown as Event);
    component.upload();

    expect(documentoService.upload).toHaveBeenCalled();
    const sentFormData = documentoService.upload.mock.calls[0][0] as FormData;
    expect(sentFormData).toBeInstanceOf(FormData);
    expect(sentFormData.get('file')).toEqual(file);
    expect(sentFormData.get('tipoDocumento')).toBe('DOCUMENTO_ADJUNTO');
    expect(sentFormData.get('solicitudId')).toBe('7');

    expect(component.selectedFile()).toBeNull();
    expect(component.success()).toContain('correctamente');
  });

  it('uploads documents using the explicit response relation', () => {
    const file = new File(['contenido'], 'respuesta.pdf', { type: 'application/pdf' });
    fixture.componentRef.setInput('relation', { respuestaId: 22 });
    fixture.componentRef.setInput('tipoDocumento', 'RESPUESTA_ENTIDAD');
    fixture.detectChanges();
    documentoService.upload.mockReturnValue(of({ id: 9, nombreOriginal: file.name }));

    component.onFileSelected({ target: { files: [file], value: file.name } } as unknown as Event);
    component.upload();

    expect(documentoService.upload).toHaveBeenCalled();
    const sentFormData = documentoService.upload.mock.calls[0][0] as FormData;
    expect(sentFormData).toBeInstanceOf(FormData);
    expect(sentFormData.get('file')).toEqual(file);
    expect(sentFormData.get('tipoDocumento')).toBe('RESPUESTA_ENTIDAD');
    expect(sentFormData.get('respuestaId')).toBe('22');
  });

  it('shows RFC 9457 detail when upload fails', () => {
    const file = new File(['contenido'], 'solicitud.pdf', { type: 'application/pdf' });
    documentoService.upload.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 422,
      error: { title: 'Archivo inválido', detail: 'El archivo contiene una extensión no permitida.' }
    })));

    component.onFileSelected({ target: { files: [file], value: file.name } } as unknown as Event);
    component.upload();

    expect(component.error()).toBe('El archivo contiene una extensión no permitida.');
  });

  it('opens preview modal when clicking preview on selected file', () => {
    const file = new File(['contenido'], 'solicitud.pdf', { type: 'application/pdf' });
    component.onFileSelected({ target: { files: [file], value: file.name } } as unknown as Event);
    fixture.detectChanges();

    const previewButton = fixture.nativeElement.querySelector(
      'button[aria-label="Previsualizar archivo"]'
    ) as HTMLButtonElement;
    expect(previewButton).toBeTruthy();

    previewButton.click();
    expect(component.isPreviewOpen()).toBe(true);
    expect(component.previewTarget()?.nombre).toBe('solicitud.pdf');
  });
});
