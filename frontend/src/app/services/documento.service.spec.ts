import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentoService } from './documento.service';

describe('DocumentoService', () => {
  let service: DocumentoService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/documentos';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(DocumentoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('uploads multipart content with its business relation', () => {
    const file = new File(['contenido'], 'solicitud.pdf', { type: 'application/pdf' });

    service.upload(file, 'SOLICITUD_ORIGINAL', { solicitudId: 12 }).subscribe((metadata) => {
      expect(metadata.id).toBe(44);
    });

    const request = httpMock.expectOne((req) =>
      req.url === `${apiUrl}/upload`
      && req.params.get('tipoDocumento') === 'SOLICITUD_ORIGINAL'
      && req.params.get('solicitudId') === '12'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    const uploadedFile = (request.request.body as FormData).get('file') as File;
    expect(uploadedFile.name).toBe(file.name);
    expect(uploadedFile.type).toBe(file.type);
    expect(uploadedFile.size).toBe(file.size);
    request.flush({ id: 44, nombreOriginal: 'solicitud.pdf' });
  });

  it('gets safe document metadata', () => {
    service.getMetadata(44).subscribe((metadata) => {
      expect(metadata.storageProvider).toBe('S3_COMPATIBLE');
      expect('storageKey' in metadata).toBe(false);
    });

    const request = httpMock.expectOne(`${apiUrl}/44/metadata`);
    expect(request.request.method).toBe('GET');
    request.flush({ id: 44, storageProvider: 'S3_COMPATIBLE' });
  });

  it('downloads a blob and reads the UTF-8 filename', () => {
    service.download(44, 'fallback.pdf').subscribe((download) => {
      expect(download.blob.type).toBe('application/pdf');
      expect(download.filename).toBe('resolución.pdf');
    });

    const request = httpMock.expectOne(`${apiUrl}/44/download`);
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['pdf'], { type: 'application/pdf' }), {
      headers: {
        'Content-Disposition': "attachment; filename*=UTF-8''resoluci%C3%B3n.pdf"
      }
    });
  });

  it('deletes a document through the protected endpoint', () => {
    service.delete(44).subscribe();

    const request = httpMock.expectOne(`${apiUrl}/44`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});
