import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReportesService } from './reportes.service';
import { environment } from '../../environments/environment';

describe('ReportesService', () => {
  let service: ReportesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportesService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ReportesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch solicitudes report with filters', () => {
    const mockResponse = {
      fechaGeneracion: '2026-03-01T10:00:00',
      totalRegistros: 1,
      datos: [
        { id: 1, expediente: 'SAIP-001', asunto: 'Test', estado: 'RESPONDIDA', fechaSolicitud: '2026-03-01', entidad: 'MINJUS', ciudadano: 'Juan', tieneRespuesta: true }
      ]
    };

    service.getReporteSolicitudes({ estado: 'RESPONDIDA', entidadId: 2 }).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/reportes/solicitudes?estado=RESPONDIDA&entidadId=2`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should fetch resumen ejecutivo', () => {
    const mockResumen = {
      fechaGeneracion: '2026-03-01T10:00:00',
      solicitudes: { total: 10, pendientes: 2, respondidas: 7, denegadas: 1, vencidas: 0 },
      apelaciones: { total: 3, pendientes: 1, enProceso: 1, resueltas: 1 },
      entidadesMasActivas: [{ nombre: 'MINJUS', solicitudes: 5 }],
      usuarios: { ciudadanos: 10, funcionarios: 4, entidades: 2 }
    };

    service.getResumenEjecutivo().subscribe(res => {
      expect(res).toEqual(mockResumen);
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/reportes/resumen-ejecutivo`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResumen);
  });
});
