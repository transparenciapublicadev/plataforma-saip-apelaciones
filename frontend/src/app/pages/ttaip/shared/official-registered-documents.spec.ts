import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from '../../../interceptors/auth.interceptor';
import { DocumentListComponent } from '../../../shared/document-list.component';
import { DocumentoMetadata } from '../../../models/documento.model';

// HTTP simulado; DocumentoService/interceptor y componentes reales. No prueba PostgreSQL/almacenamiento.
describe('R2: archivos registrados, separados de la composición de borradores', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.setItem('usuario', JSON.stringify({ token: 'token-sintetico-de-prueba' }));
    TestBed.configureTestingModule({ imports: [DocumentListComponent], providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:registrado');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { http.verify(); localStorage.removeItem('usuario'); vi.restoreAllMocks(); });

  function listado() {
    const f = TestBed.createComponent(DocumentListComponent);
    f.componentRef.setInput('relation', { resolucionId: 91 }); f.detectChanges();
    const req = http.expectOne(r => r.url.endsWith('/documentos') && r.params.get('resolucionId') === '91');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-sintetico-de-prueba');
    const doc = { id: 123, resolucionId: 91, nombreOriginal: 'archivo-registrado.pdf', contentType: 'application/pdf', sizeBytes: 20 } as DocumentoMetadata;
    req.flush([doc]); f.detectChanges();
    return { f, doc };
  }
  it('consulta por ID de resolución y descarga los bytes del ID del servidor sin regenerarlos', () => {
    const { f, doc } = listado();
    f.componentInstance.download(doc);
    const req = http.expectOne(r => r.url.endsWith('/documentos/123/download'));
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-sintetico-de-prueba');
    const bytes = new Blob(['%PDF-archivo-persistido'], { type: 'application/pdf' });
    req.flush(bytes, { headers: { 'Content-Disposition': 'attachment; filename="archivo-registrado.pdf"' } });
    expect(URL.createObjectURL).toHaveBeenCalledWith(bytes);
    expect(f.nativeElement.textContent).toContain('archivo-registrado.pdf');
    expect(f.nativeElement.textContent).not.toMatch(/EMITIDO|copia auténtica|firmado digitalmente/i);
  });
  it.each([401, 403, 404, 500])('el error %s no produce otro PDF ni confirma emisión', status => {
    const { f, doc } = listado();
    f.componentInstance.download(doc);
    http.expectOne(r => r.url.endsWith('/documentos/123/download')).flush(new Blob(['Error']), { status, statusText: 'Error' });
    f.detectChanges();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(f.componentInstance.error()).toBeTruthy();
    expect(f.nativeElement.textContent).not.toMatch(/EMITIDO|copia auténtica|firmado digitalmente/i);
  });
});
