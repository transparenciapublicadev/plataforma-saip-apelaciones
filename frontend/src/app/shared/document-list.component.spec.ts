import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DocumentoService } from '../services/documento.service';
import { DocumentListComponent } from './document-list.component';

describe('DocumentListComponent', () => {
  let fixture: ComponentFixture<DocumentListComponent>;
  const documentoService = {
    download: vi.fn(),
    delete: vi.fn(),
    listByRelation: vi.fn()
  };

  beforeEach(async () => {
    documentoService.download.mockReset();
    documentoService.delete.mockReset();
    documentoService.listByRelation.mockReset();
    documentoService.download.mockReturnValue(of({
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      filename: 'solicitud.pdf'
    }));
    documentoService.listByRelation.mockReturnValue(of([]));

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

  it('loads and renders safe metadata for a typed relation', () => {
    documentoService.listByRelation.mockReturnValue(of([{
      id: 10,
      respuestaId: 4,
      nombreOriginal: 'respuesta.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      fechaCreacion: '2026-06-12T10:00:00'
    }]));

    fixture.componentRef.setInput('relation', { respuestaId: 4 });
    fixture.detectChanges();

    expect(documentoService.listByRelation).toHaveBeenCalledWith({ respuestaId: 4 });
    expect(fixture.nativeElement.textContent).toContain('respuesta.pdf');
    expect(fixture.nativeElement.textContent).toContain('application/pdf');
  });

  it('opens preview modal when clicking the preview button', () => {
    const previewButton = fixture.nativeElement.querySelector(
      'button[aria-label="Ver documento"]'
    ) as HTMLButtonElement;
    expect(previewButton).toBeTruthy();

    previewButton.click();
    expect(documentoService.download).toHaveBeenCalledWith(9, 'solicitud.pdf');
    expect(fixture.componentInstance.isPreviewOpen()).toBe(true);
    expect(fixture.componentInstance.previewTarget()?.nombre).toBe('solicitud.pdf');
  });
});

// Opt-in used by the TTAIP detail, with real HttpClient and synthetic HTTP responses.
describe('DocumentList — contexto institucional verificado', () => {
  let http: HttpTestingController;
  const api = environment.apiUrl;
  const metadata = { id: 51, apelacionId: 21, nombreOriginal: 'Registrado.pdf', contentType: 'application/pdf', estado: 'ACTIVO' };
  beforeEach(() => { TestBed.configureTestingModule({ imports: [DocumentListComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); vi.restoreAllMocks(); } });
  function page() { const f = TestBed.createComponent(DocumentListComponent); f.componentRef.setInput('verifiedContext', 1); f.componentRef.setInput('relation', { apelacionId: 21 }); f.componentRef.setInput('documents', [metadata]); f.detectChanges(); return f; }
  it.each([401, 403, 404, 500])('un fallo %i no reactiva metadatos prefijados ni afirma vacío', status => {
    const f = page(); http.expectOne(r => r.url === api + '/documentos').flush(null, { status, statusText: 'Synthetic failure' }); f.detectChanges();
    expect(f.componentInstance.displayedDocuments()).toEqual([]); expect(f.nativeElement.textContent).not.toContain('Registrado.pdf'); expect(f.nativeElement.textContent).not.toContain('No hay documentos adjuntos'); expect(f.componentInstance.error()).not.toBe('');
  });
  it('una relación contradictoria no habilita descarga y permite reintentar', () => {
    const f = page(); http.expectOne(r => r.url === api + '/documentos').flush([{ ...metadata, apelacionId: 999 }]); expect(f.componentInstance.displayedDocuments()).toEqual([]);
    f.componentInstance.retry(); http.expectOne(r => r.url === api + '/documentos').flush([metadata]); expect(f.componentInstance.displayedDocuments()).toEqual([metadata]);
  });
  it('cambiar contexto cancela una descarga y limpia metadatos, búsquedas y preview', () => {
    const f = page(); http.expectOne(r => r.url === api + '/documentos').flush([metadata]); const c = f.componentInstance; c.download(c.displayedDocuments()[0]); const old = http.expectOne(api + '/documentos/51/download');
    c.search.set('Anterior'); f.componentRef.setInput('verifiedContext', 2); f.componentRef.setInput('relation', { apelacionId: 22 }); f.detectChanges(); const next = http.expectOne(r => r.url === api + '/documentos'); expect(next.request.params.get('apelacionId')).toBe('22'); next.flush([]);
    expect(old.cancelled).toBe(true); expect(c.displayedDocuments()).toEqual([]); expect(c.search()).toBe(''); expect(c.previewTarget()).toBeNull();
  });
  it('no consulta otra vez por recrear el mismo objeto de relación', () => {
    const f = page(); http.expectOne(r => r.url === api + '/documentos').flush([metadata]); f.componentRef.setInput('relation', { apelacionId: 21 }); f.detectChanges(); expect(http.match(r => r.url === api + '/documentos')).toHaveLength(0);
  });
  it('preview utiliza el ID autorizado y un error no descarga un PDF alternativo', () => {
    const f = page(); http.expectOne(r => r.url === api + '/documentos').flush([metadata]); const c = f.componentInstance; c.preview(c.displayedDocuments()[0]); f.detectChanges();
    http.expectOne(api + '/documentos/51/download').flush(null, { status: 404, statusText: 'Not Found' }); f.detectChanges(); expect(c.previewTarget()?.id).toBe(51); expect(http.match(() => true)).toHaveLength(0);
  });
  it('el filtro es local y diferencia coincidencias vacías de lista vacía', () => {
    const f = page(); http.expectOne(r => r.url === api + '/documentos').flush([metadata, ...[52, 53, 54].map(id => ({ ...metadata, id, nombreOriginal: 'Anexo ' + id }))]); f.componentInstance.search.set('ausente'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Ningún documento coincide'); expect(f.componentInstance.displayedDocuments()).toHaveLength(4); expect(http.match(() => true)).toHaveLength(0);
  });
  it('descarta una descarga si los inputs cambiaron antes del siguiente render', () => {
    const f = page(); http.expectOne(r => r.url === api + '/documentos').flush([metadata]); const c = f.componentInstance;
    const create = vi.spyOn(URL, 'createObjectURL'); c.download(c.displayedDocuments()[0]); const req = http.expectOne(api + '/documentos/51/download');
    f.componentRef.setInput('verifiedContext', 2); f.componentRef.setInput('relation', { apelacionId: 22 }); req.flush(new Blob(['PDF sintético'], { type: 'application/pdf' }));
    expect(create).not.toHaveBeenCalled(); f.detectChanges(); http.expectOne(r => r.url === api + '/documentos').flush([]);
  });
});
