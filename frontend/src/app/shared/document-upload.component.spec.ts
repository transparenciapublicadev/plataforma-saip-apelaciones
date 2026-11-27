import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
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

// Opt-in: validates the response and reads its ID before reporting a completed upload.
describe('DocumentUpload — contexto institucional verificado', () => {
  let http: HttpTestingController; const api = environment.apiUrl;
  const metadata = { id: 51, apelacionId: 21, tipoDocumento: 'APELACION', nombreOriginal: 'anexo.txt', contentType: 'text/plain', estado: 'ACTIVO' };
  beforeEach(() => { TestBed.configureTestingModule({ imports: [DocumentUploadComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); vi.restoreAllMocks(); } });
  function page() { const f = TestBed.createComponent(DocumentUploadComponent); f.componentRef.setInput('verifiedContext', 1); f.componentRef.setInput('relation', { apelacionId: 21 }); f.componentRef.setInput('tipoDocumento', 'APELACION'); f.detectChanges();
    f.componentInstance.onFileSelected({ target: { files: [new File(['Texto sintético'], 'anexo.txt', { type: 'text/plain' })], value: '' } } as unknown as Event); return f; }
  it('el multipart contiene el File y la relación, pero el éxito espera al GET del mismo ID', () => {
    const f = page(), c = f.componentInstance; const event = vi.fn(); c.uploaded.subscribe(event); c.upload(); const req = http.expectOne(api + '/documentos/upload');
    expect(req.request.body.get('apelacionId')).toBe('21'); expect(req.request.body.get('file').name).toBe('anexo.txt'); req.flush(metadata); expect(c.success()).toBe(''); expect(event).not.toHaveBeenCalled();
    http.expectOne(api + '/documentos/51/metadata').flush(metadata); expect(event).toHaveBeenCalledWith(metadata); expect(c.selectedFile()).toBeNull();
  });
  it('cambiar contexto cancela la subida y no emite éxito en el recurso nuevo', () => {
    const f = page(), c = f.componentInstance; const event = vi.fn(); c.uploaded.subscribe(event); c.upload(); const req = http.expectOne(api + '/documentos/upload');
    f.componentRef.setInput('verifiedContext', 2); f.componentRef.setInput('relation', { apelacionId: 22 }); f.detectChanges(); expect(req.cancelled).toBe(true); expect(c.selectedFile()).toBeNull(); expect(event).not.toHaveBeenCalled();
  });
  it('red sin ID conserva la selección y bloquea un reenvío a ciegas', () => {
    const c = page().componentInstance; c.upload(); http.expectOne(api + '/documentos/upload').error(new ProgressEvent('error')); c.upload(); expect(c.uncertain()).toBe(true); expect(c.selectedFile()).not.toBeNull(); expect(http.match(() => true)).toHaveLength(0);
  });
  it('fallo de recuperación con ID se comprueba por GET, sin otra subida', () => {
    const c = page().componentInstance; c.upload(); http.expectOne(api + '/documentos/upload').flush(metadata); http.expectOne(api + '/documentos/51/metadata').flush(null, { status: 500, statusText: 'Unavailable' });
    expect(c.uncertain()).toBe(true); c.recover(); http.expectOne(api + '/documentos/51/metadata').flush(metadata); expect(c.uncertain()).toBe(false); expect(c.success()).not.toBe(''); expect(http.match(r => r.method === 'POST')).toHaveLength(0);
  });
  it('metadatos de otro recurso no confirman ni consultan el documento ajeno', () => {
    const c = page().componentInstance; c.upload(); http.expectOne(api + '/documentos/upload').flush({ ...metadata, apelacionId: 999 }); expect(c.uncertain()).toBe(true); expect(c.success()).toBe(''); expect(http.match(() => true)).toHaveLength(0);
  });
  it('descarta la respuesta si la relación cambió antes del siguiente render', () => {
    const f = page(), c = f.componentInstance; const event = vi.fn(); c.uploaded.subscribe(event); c.upload(); const req = http.expectOne(api + '/documentos/upload');
    f.componentRef.setInput('verifiedContext', 2); f.componentRef.setInput('relation', { apelacionId: 22 }); req.flush(metadata); expect(event).not.toHaveBeenCalled(); expect(http.match(() => true)).toHaveLength(0);
    f.detectChanges(); expect(c.selectedFile()).toBeNull();
  });
});
