import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DocumentoService } from '../services/documento.service';
import { DocumentListComponent } from './document-list.component';

describe('DocumentListComponent', () => {
  let fixture: ComponentFixture<DocumentListComponent>;
  const documentoService = {
    download: vi.fn(),
    delete: vi.fn()
  };

  beforeEach(async () => {
    documentoService.download.mockReset();
    documentoService.delete.mockReset();
    documentoService.download.mockReturnValue(of({
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      filename: 'solicitud.pdf'
    }));

    await TestBed.configureTestingModule({
      imports: [DocumentListComponent],
      providers: [{ provide: DocumentoService, useValue: documentoService }]
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentListComponent);
    fixture.componentRef.setInput('documents', [{
      id: 9,
      nombreArchivo: 'solicitud.pdf',
      tipoArchivo: 'application/pdf',
      tamanio: 1024,
      fechaSubida: '2026-06-11'
    }]);
    fixture.detectChanges();
  });

  it('calls the download endpoint from the document button', () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const downloadButton = fixture.nativeElement.querySelector(
      'button[aria-label="Descargar documento"]'
    ) as HTMLButtonElement;
    downloadButton.click();

    expect(documentoService.download).toHaveBeenCalledWith(9, 'solicitud.pdf');
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
    anchorClick.mockRestore();
  });

  it('does not render delete actions for roles without permission', () => {
    const deleteButton = fixture.nativeElement.querySelector(
      'button[aria-label="Eliminar documento"]'
    );

    expect(deleteButton).toBeNull();
  });
});
