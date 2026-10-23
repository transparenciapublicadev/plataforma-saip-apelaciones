import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { SystemConfigService, DEFAULT_CONFIG, SETTINGS_KEY } from './system-config.service';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem(SETTINGS_KEY);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SystemConfigService,
      ],
    });
    service = TestBed.inject(SystemConfigService);
    httpTesting = TestBed.inject(HttpTestingController);

    const initReqs = httpTesting.match('http://localhost:8080/api/configuracion');
    if (initReqs.length > 0) {
      initReqs[0].flush(null);
    }
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.removeItem(SETTINGS_KEY);
  });

  it('should be created with default config', () => {
    expect(service).toBeTruthy();
    const cfg = service.config();
    expect(cfg.plazos.saipRespuesta).toBe(10);
    expect(cfg.plazos.ttaipResolucion).toBe(10);
    expect(cfg.tarifas.costoPorCopia).toBe(0.10);
    expect(service.isDirty()).toBe(false);
  });

  it('should update plazo and detect dirty state', () => {
    service.updatePlazo('saipRespuesta', 15);
    expect(service.config().plazos.saipRespuesta).toBe(15);
    expect(service.isDirty()).toBe(true);

    service.cancel();
    expect(service.config().plazos.saipRespuesta).toBe(10);
    expect(service.isDirty()).toBe(false);
  });

  it('should save config to localStorage and clear dirty state', async () => {
    service.updatePlazo('saipProrroga', 9);
    service.toggleNotif('registros');
    expect(service.isDirty()).toBe(true);

    const savePromise = firstValueFrom(service.save());
    const putReq = httpTesting.expectOne('http://localhost:8080/api/configuracion');
    expect(putReq.request.method).toBe('PUT');
    putReq.flush(service.config());

    const ok = await savePromise;
    expect(ok).toBe(true);
    expect(service.isDirty()).toBe(false);
    expect(service.savedConfig().plazos.saipProrroga).toBe(9);
    expect(service.savedConfig().notif.registros).toBe(true);
  });

  it('should update tarifas and notif thresholds', () => {
    service.updateTarifas('costoPorCopia', 0.25);
    expect(service.config().tarifas.costoPorCopia).toBe(0.25);

    service.updateNotif('umbralProximo', 3);
    expect(service.config().notif.umbralProximo).toBe(3);
  });
});
