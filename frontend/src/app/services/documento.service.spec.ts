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

  it('uploads a response document using respuestaId', () => {
    const file = new File(['respuesta'], 'respuesta.pdf', { type: 'application/pdf' });

    service.upload(file, 'RESPUESTA_ENTIDAD', { respuestaId: 31 }).subscribe();

    const request = httpMock.expectOne((req) =>
      req.url === `${apiUrl}/upload`
      && req.params.get('tipoDocumento') === 'RESPUESTA_ENTIDAD'
      && req.params.get('respuestaId') === '31'
    );
    expect(request.request.method).toBe('POST');
    request.flush({ id: 45, respuestaId: 31, nombreOriginal: 'respuesta.pdf' });
  });

  it('lists safe metadata using exactly one business relation', () => {
    service.listByRelation({ resolucionId: 9 }).subscribe((documents) => {
      expect(documents).toHaveLength(1);
      expect(documents[0].resolucionId).toBe(9);
    });

    const request = httpMock.expectOne((req) =>
      req.url === apiUrl
      && req.params.get('resolucionId') === '9'
      && req.params.keys().length === 1
    );
    expect(request.request.method).toBe('GET');
    request.flush([{
      id: 51,
      resolucionId: 9,
      nombreOriginal: 'resolucion.pdf',
      contentType: 'application/pdf'
    }]);
  });

  it('rejects missing or ambiguous relations before calling the API', () => {
    expect(() => service.listByRelation({} as never)).toThrowError(
      'Debe indicar exactamente una relación documental válida.'
    );
    expect(() => service.upload(
      new File(['x'], 'x.txt', { type: 'text/plain' }),
      'OTRO',
      { solicitudId: 1, respuestaId: 2 } as never
    )).toThrowError('Debe indicar exactamente una relación documental válida.');
  });

  it('gets safe document metadata', () => {
    service.getMetadata(44).subscribe((metadata) => {
      expect('storageKey' in metadata).toBe(false);
      expect('storageProvider' in metadata).toBe(false);
      expect(metadata.nombreOriginal).toBe('resolución.pdf');
    });

    const request = httpMock.expectOne(`${apiUrl}/44/metadata`);
    expect(request.request.method).toBe('GET');
    request.flush({
      id: 44,
      nombreOriginal: 'resolución.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      hashSha256: 'a'.repeat(64),
      estado: 'ACTIVO'
    });
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

  it.each(['sin cuerpo', 'cuerpo vacío'])('no sustituye una descarga sin bytes por un documento vacío: %s', caso => {
    const body = caso === 'sin cuerpo' ? null : new Blob();
    const next = vi.fn();
    const error = vi.fn();
    service.download(44, 'original.pdf').subscribe({ next, error });
    httpMock.expectOne(`${apiUrl}/44/download`).flush(body);
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });
});
