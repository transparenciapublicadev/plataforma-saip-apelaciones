import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReportesInstitucionalesService } from './reportes-institucionales.service';
import { environment } from '../../environments/environment';

describe('ReportesInstitucionalesService', () => {
  let service: ReportesInstitucionalesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReportesInstitucionalesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('pide el detalle de a 10 expedientes', () => {
    service.detalle('entidad', '2026-11-01', '2026-12-03', 1, 'SAIP', 'EN_REVISION').subscribe();
    const req = http.expectOne(r => r.url === `${environment.apiUrl}/reportes-institucionales/entidad/detalle`);
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('query')).toBe('SAIP');
    expect(req.request.params.get('estado')).toBe('EN_REVISION');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 1, size: 10 });
  });

  it('pide el historial guardado en el servidor de a 10', () => {
    service.historial('entidad', 0).subscribe();
    const req = http.expectOne(r => r.url === `${environment.apiUrl}/reportes-institucionales/entidad/historial`);
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 });
  });
});
