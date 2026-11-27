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

  it('distinguishes unavailable defaults, failed reads and a complete server configuration', () => {
    expect(service.loadState()).toBe('unavailable');
    service.cargarDesdeBackend();
    httpTesting.expectOne('http://localhost:8080/api/configuracion').flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    expect(service.loadState()).toBe('error');
    service.cargarDesdeBackend();
    httpTesting.expectOne('http://localhost:8080/api/configuracion').flush({ plazos: {} });
    expect(service.loadState()).toBe('unavailable');
    service.cargarDesdeBackend();
    httpTesting.expectOne('http://localhost:8080/api/configuracion').flush(DEFAULT_CONFIG);
    expect(service.loadState()).toBe('ready');
  });

  it('does not confirm an empty save response or a failed save', async () => {
    service.updateTarifas('costoPorCopia', 0.25);
    const empty = firstValueFrom(service.save());
    httpTesting.expectOne('http://localhost:8080/api/configuracion').flush(null);
    expect(await empty).toBe(false);
    expect(service.isDirty()).toBe(true);
    const failed = firstValueFrom(service.save());
    httpTesting.expectOne('http://localhost:8080/api/configuracion').flush('Unavailable', { status: 500, statusText: 'Unavailable' });
    expect(await failed).toBe(false);
    expect(service.isDirty()).toBe(true);
  });

  it('preserves a newer draft while confirming the configuration that was actually saved', async () => {
    service.updateNotif('umbralProximo', 3);
    const submitted = structuredClone(service.config());
    const saving = firstValueFrom(service.save());
    service.updateNotif('umbralProximo', 4);
    httpTesting.expectOne('http://localhost:8080/api/configuracion').flush(submitted);
    expect(await saving).toBe(true);
    expect(service.savedConfig().notif.umbralProximo).toBe(3);
    expect(service.config().notif.umbralProximo).toBe(4);
    expect(service.isDirty()).toBe(true);
  });
});
