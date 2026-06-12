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

    expect(documentoService.upload).toHaveBeenCalledWith(
      file,
      'DOCUMENTO_ADJUNTO',
      { solicitudId: 7 }
    );
    expect(component.selectedFile()).toBeNull();
    expect(component.success()).toContain('correctamente');
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
});
