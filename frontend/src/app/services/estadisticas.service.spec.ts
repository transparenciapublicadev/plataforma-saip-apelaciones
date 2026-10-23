import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EstadisticasService } from './estadisticas.service';
import { environment } from '../../environments/environment';

describe('EstadisticasService', () => {
  let service: EstadisticasService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EstadisticasService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(EstadisticasService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get general statistics', () => {
    const mockGeneral = {
      totalSolicitudes: 10,
      solicitudesPendientes: 3,
      solicitudesRespondidas: 5,
      solicitudesDenegadas: 1,
      solicitudesVencidas: 1,
      totalApelaciones: 4,
      apelacionesPendientes: 2,
      apelacionesResueltas: 2,
      totalEntidades: 6,
      totalCiudadanos: 8,
      totalFuncionarios: 5,
    };

    service.getGeneral().subscribe((data) => {
      expect(data).toEqual(mockGeneral);
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/estadisticas/general`);
    expect(req.request.method).toBe('GET');
    req.flush(mockGeneral);
  });

  it('should get ranking entidades', () => {
    const mockRanking = [
      { entidadId: 1, entidadNombre: 'MINJUS', acronimo: 'MINJUS', totalSolicitudes: 5, respondidas: 3, pendientes: 2 }
    ];

    service.getRankingEntidades(5).subscribe((data) => {
      expect(data).toEqual(mockRanking);
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/estadisticas/ranking/entidades?limite=5`);
    expect(req.request.method).toBe('GET');
    req.flush(mockRanking);
  });

  it('should get distribucion de estados', () => {
    const mockDistribucion = {
      RECEPCIONADA: 2,
      RESPONDIDA: 5,
      VENCIDA: 1,
    };

    service.getDistribucionEstados().subscribe((data) => {
      expect(data).toEqual(mockDistribucion);
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/estadisticas/distribucion/estados`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDistribucion);
  });

  it('should get actividad reciente', () => {
    const mockActividad = [
      { dot: 'var(--info)', label: 'Solicitud SAIP registrada', detail: 'SAIP-001 · MINJUS · 2026-03-01', ts: 12345 }
    ];

    service.getActividadReciente().subscribe((data) => {
      expect(data).toEqual(mockActividad);
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/estadisticas/actividad-reciente?limite=10`);
    expect(req.request.method).toBe('GET');
    req.flush(mockActividad);
  });
});
