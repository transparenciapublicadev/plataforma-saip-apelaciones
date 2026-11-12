import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FuncionarioDashboardComponent } from './funcionario-dashboard.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { environment } from '../../../environments/environment';
import { PanelPage, PanelSolicitud } from '../../models/panel-query.model';
import { queueItem } from './funcionario-dashboard.model';

describe('EntityDashboard — consulta institucional y estados reales', () => {
  const api = environment.apiUrl;
  const session = {
    success: true,
    token: 'sesion-sintetica-entidad',
    usuarioId: 7,
    funcionarioId: 7,
    tipoUsuario: 'FUNCIONARIO',
    entidadId: 3,
    entidadNombre: 'Entidad sintética',
    nombre: 'Operador sintético'
  };
  const row: PanelSolicitud = {
    id: 101,
    expediente: 'SAIP-2026-00101',
    ciudadanoId: 1,
    entidadId: 3,
    entidadNombre: 'Entidad sintética',
    ciudadanoNombre: 'Persona sintética',
    ciudadanoDni: '12345678',
    asunto: 'Asunto sintético',
    estado: 'EN_REVISION',
    diasRestantes: 3,
    fechaPresentacion: '2026-10-01T10:00:00',
    fechaLimite: '2026-11-01',
    respuesta: null,
    observaciones: [],
    prioridad: 'MEDIA',
    tipoInformacion: 'Información general'
  };

  let http: HttpTestingController;

  function mockPanelPage(items: PanelSolicitud[] = [], override: Partial<PanelPage<PanelSolicitud>> = {}): PanelPage<PanelSolicitud> {
    const size = override.tamano ?? 4;
    const page = override.pagina ?? 0;
    const total = override.totalElementos ?? items.length;
    const totalPaginas = Math.max(1, Math.ceil(total / size));
    const porEstado: Record<string, number> = {
      RECEPCIONADA: 0, EN_REVISION: 0, PENDIENTE_INFORMACION: 0,
      RESPONDIDA: 0, DENEGADA: 0, CONCLUIDA: 0, VENCIDA: 0
    };
    const porEtapa: Record<string, number> = {
      san: 0, hoy: 0, semana: 0, plazo: 0, respondidas: 0
    };
    for (const it of items) {
      if (it.estado) porEstado[it.estado] = (porEstado[it.estado] || 0) + 1;
      const q = queueItem(it);
      porEtapa[q.bucket] = (porEtapa[q.bucket] || 0) + 1;
    }
    return {
      contenido: items,
      pagina: page,
      tamano: size,
      totalElementos: total,
      totalPaginas,
      ultima: page >= totalPaginas - 1,
      resumen: {
        total,
        porEstado,
        porEtapa,
        porTipoInformacion: { 'Información general': items.length },
        porDiasRestantes: { '3': items.length }
      },
      entidades: [{ id: 3, nombre: 'Entidad sintética', total }],
      alcance: 'ENTIDAD',
      ...override
    };
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [FuncionarioDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: GuidedTourService,
          useValue: {
            checkAutoStart() {},
            endTourFor() {},
            isFirstVisit: () => false,
            startTour() {}
          }
        }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).guardarSesion(session);
  });

  afterEach(() => {
    try {
      http.verify({ ignoreCancelled: true });
    } finally {
      TestBed.resetTestingModule();
      localStorage.clear();
      sessionStorage.clear();
    }
  });

  function page() {
    const f = TestBed.createComponent(FuncionarioDashboardComponent);
    f.detectChanges();
    for (const req of http.match(`${api}/funcionarios/7`)) {
      req.flush({
        id: 7,
        entidadId: 3,
        entidadNombre: 'Entidad sintética',
        nombreCompleto: 'Operador sintético',
        activo: true
      });
    }
    return f;
  }

  it('consulta la página paginada del panel y presenta solicitudes y métricas', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    expect(req.request.params.get('pagina')).toBe('0');
    expect(req.request.params.get('tamano')).toBe('4');
    req.flush(mockPanelPage([row]));
    f.detectChanges();

    expect(f.componentInstance.solicitudes().length).toBe(1);
    expect(f.componentInstance.solicitudes()[0].expediente).toBe(row.expediente);
    expect(f.nativeElement.textContent).toContain(row.expediente);
  });

  it('deshabilita las bandejas con conteo 0 e incluye su aria-label correspondiente', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    req.flush(mockPanelPage([row]));
    f.detectChanges();

    const buttons = f.nativeElement.querySelectorAll('[data-tour="e-buckets"] button');
    expect(buttons.length).toBe(6);

    const sanBtn = [...buttons].find((b: any) => b.textContent.includes('Vencidas')) as HTMLButtonElement;
    expect(sanBtn).toBeTruthy();
    expect(sanBtn.disabled).toBe(true);
    expect(sanBtn.getAttribute('aria-label')).toContain('sin solicitudes');

    const semanaBtn = [...buttons].find((b: any) => b.textContent.includes('Esta semana')) as HTMLButtonElement;
    expect(semanaBtn).toBeTruthy();
    expect(semanaBtn.disabled).toBe(false);
  });

  it('no cambia a una bandeja vacía al intentar hacer clic en ella', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    req.flush(mockPanelPage([row]));
    f.detectChanges();

    f.componentInstance.selectBucket('san');
    expect(f.componentInstance.selectedBucket()).toBe('todas');
    http.expectNone(r => r.url === `${api}/panel/solicitudes`);
  });

  it('calcula y renderiza el indicador Donut de cumplimiento legal', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    const pageData = mockPanelPage([row], {
      resumen: {
        total: 10,
        porEstado: { RESPONDIDA: 3, VENCIDA: 1, EN_REVISION: 6 },
        porEtapa: { san: 1, hoy: 0, semana: 6, plazo: 0, respondidas: 3 },
        porTipoInformacion: {},
        porDiasRestantes: {}
      }
    });
    req.flush(pageData);
    f.detectChanges();

    expect(f.componentInstance.respondidas()).toBe(3);
    expect(f.componentInstance.cerradas()).toBe(4);
    expect(f.componentInstance.cumplimiento()).toBe(75);
    expect(f.nativeElement.querySelector('[data-tour="e-cumplimiento"]')?.textContent).toContain('75%');
  });

  it('no presenta 100% cuando no hay expedientes cerrados', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    req.flush(mockPanelPage([row], {
      resumen: {
        total: 2,
        porEstado: { EN_REVISION: 2 },
        porEtapa: { san: 0, hoy: 0, semana: 2, plazo: 0, respondidas: 0 },
        porTipoInformacion: {},
        porDiasRestantes: {}
      }
    }));
    f.detectChanges();

    expect(f.componentInstance.cumplimiento()).toBeNull();
    expect(f.nativeElement.querySelector('[data-tour="e-cumplimiento"]')?.textContent).not.toContain('100%');
  });

  it('muestra el banner de advertencia SAN con el texto legal exacto', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    const pageData = mockPanelPage([row], {
      resumen: {
        total: 5,
        porEstado: { VENCIDA: 2 },
        porEtapa: { san: 2, hoy: 0, semana: 3, plazo: 0, respondidas: 0 },
        porTipoInformacion: {},
        porDiasRestantes: {}
      }
    });
    req.flush(pageData);
    f.detectChanges();

    const banner = f.nativeElement.querySelector('[role="alert"]');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('El plazo legal venció. Cada día sin respuesta puede originar sanción para la entidad y derecho de apelación del ciudadano.');
  });

  it('muestra el chip de Área Responsable en cada solicitud del listado', () => {
    localStorage.setItem('saip_area_responsable', JSON.stringify({
      [row.expediente]: { area: 'Gerencia de Informática', responsable: 'Ing. Rojas', fecha: '2026-10-20' }
    }));
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    req.flush(mockPanelPage([row]));
    f.detectChanges();

    expect(f.componentInstance.getAreaLabel(row.expediente)).toBe('Gerencia de Informática');
    const chip = f.nativeElement.querySelector('[role="listitem"]');
    expect(chip?.textContent).toContain('Gerencia de Informática');
  });

  it('reacciona a eventos de actualización de área responsable', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    req.flush(mockPanelPage([row]));
    f.detectChanges();

    expect(f.componentInstance.getAreaLabel(row.expediente)).toBe('Sin asignar');

    localStorage.setItem('saip_area_responsable', JSON.stringify({
      [row.expediente]: { area: 'Secretaría General', fecha: '2026-10-21' }
    }));
    window.dispatchEvent(new CustomEvent('saip-area-responsable'));
    f.detectChanges();

    expect(f.componentInstance.getAreaLabel(row.expediente)).toBe('Secretaría General');
  });

  it('incluye enlace en la barra lateral hacia /funcionario/reportes', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    req.flush(mockPanelPage([row]));
    f.detectChanges();

    const link = f.nativeElement.querySelector('a[href="/funcionario/reportes"]');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Reportes de la entidad');
  });

  it('permite limpiar la búsqueda con escape o botón de limpiar', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    req.flush(mockPanelPage([row]));
    f.detectChanges();

    f.componentInstance.busqueda.set('termino prueba');
    expect(f.componentInstance.busqueda()).toBe('termino prueba');

    f.componentInstance.limpiarBusqueda();
    expect(f.componentInstance.busqueda()).toBe('');
    http.expectOne(r => r.url === `${api}/panel/solicitudes`);
  });

  it('una recarga fallida limpia solicitudes y cifras de la consulta anterior', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    req.flush(mockPanelPage([row]));
    f.detectChanges();
    expect(f.componentInstance.solicitudes().length).toBe(1);

    f.componentInstance.cargarSolicitudes();
    for (const r of http.match(`${api}/funcionarios/7`)) {
      r.flush({ id: 7, entidadId: 3, activo: true });
    }
    http.expectOne(r => r.url === `${api}/panel/solicitudes`).flush(null, { status: 503, statusText: 'Unavailable' });
    f.detectChanges();

    expect(f.componentInstance.solicitudes()).toEqual([]);
    expect(f.componentInstance.errorTipo()).toBe('servidor');
  });

  it('destruir el panel cancela la consulta pendiente', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    f.destroy();
    expect(req.cancelled).toBe(true);
  });

  it('una sesión incompleta no provoca consulta al servidor', () => {
    TestBed.inject(AuthService).guardarSesion({ ...session, funcionarioId: undefined });
    const f = page();
    expect(f.componentInstance.errorTipo()).toBe('sesion');
    http.expectNone(r => r.url.startsWith(api));
  });

  it.each([
    { id: 8, entidadId: 3, activo: true },
    { id: 7, entidadId: null, activo: true },
    { id: 7, entidadId: 3, activo: false },
  ])('una ficha incoherente o inactiva impide consultar solicitudes: %j', profile => {
    const f = TestBed.createComponent(FuncionarioDashboardComponent);
    f.detectChanges();
    http.expectOne(`${api}/funcionarios/7`).flush(profile);
    f.detectChanges();
    expect(f.componentInstance.errorTipo()).toBe('incompleta');
    http.expectNone(r => r.url.includes('/panel/solicitudes'));
  });

  it('navega con el expediente y ofrece responder según precondiciones', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    req.flush(mockPanelPage([row]));
    f.detectChanges();

    expect(f.nativeElement.querySelector(`a[href='/funcionario/solicitud/${row.expediente}']`)).not.toBeNull();
    expect(f.nativeElement.querySelector(`a[href='/funcionario/responder/${row.expediente}']`)).not.toBeNull();
    expect(f.componentInstance.canResponder(f.componentInstance.solicitudes()[0])).toBe(true);
  });

  it('el tutorial institucional inicia con los pasos definidos', () => {
    const f = page();
    const req = http.expectOne(r => r.url === `${api}/panel/solicitudes`);
    req.flush(mockPanelPage([row]));
    f.detectChanges();

    const tour = TestBed.inject(GuidedTourService);
    const start = vi.spyOn(tour, 'startTour');
    f.componentInstance.startTour();
    expect(start).toHaveBeenCalledWith('saip_tour_funcionario', f.componentInstance.tourSteps);
  });
});
