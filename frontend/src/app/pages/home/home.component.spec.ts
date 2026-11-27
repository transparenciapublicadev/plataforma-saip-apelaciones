import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeComponent } from './home.component';
import { environment } from '../../../environments/environment';

describe('Landing — datos públicos y capacidades verificables', () => {
  const url = `${environment.apiUrl}/public/portal`;
  const portal = { metricas: { saipPresentadas: 33, respondidas: 17, apelaciones: 12,
    entidades: 6, personasApelantes: 4, tasaResolucion: 51.5 },
    ejemplosSolicitud: [{ icono: 'coins', texto: 'Presupuesto sintético orientativo' }],
    preguntasFrecuentes: [{ pregunta: 'Promesa no validada', respuesta: 'FIRMA_Y_SOPORTE_NO_VERIFICADOS' }],
    apelacionesPorEntidad: [{ etiqueta: 'Entidad sintética', valor: 12 }],
    tendenciaMensual: [{ mes: 1, etiqueta: 'ene', solicitudes: 33, apelaciones: 12 }], miembrosTTAIP: [] };
  let http: HttpTestingController;
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
    TestBed.configureTestingModule({ imports: [HomeComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); vi.unstubAllGlobals(); vi.restoreAllMocks(); } });
  function page() { const f = TestBed.createComponent(HomeComponent); f.detectChanges(); return f; }
  it('no presenta cero como un indicador ya recibido durante la carga', () => {
    const f = page();
    expect(f.nativeElement.querySelector('.stat-card-value')?.textContent.trim()).toBe('—');
    http.expectOne(url).flush(portal);
  });
  it('una consulta fallida no se transforma en métricas de cero ni en una actualización confirmada', () => {
    const f = page(); http.expectOne(url).flush(null, { status: 503, statusText: 'Unavailable' }); f.detectChanges();
    expect(f.nativeElement.querySelector('.stat-card-value')?.textContent.trim()).toBe('—');
    expect(f.nativeElement.textContent).toContain('No se pudieron consultar los indicadores');
    expect(f.nativeElement.textContent).not.toContain('Actualizado');
  });
  it('etiqueta el porcentaje como estados de respuesta SAIP y no como apelaciones resueltas', () => {
    const f = page(); http.expectOne(url).flush(portal); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('SAIP en estados de respuesta');
    expect(f.nativeElement.textContent).not.toContain('Estadísticas del TTAIP');
    expect(f.nativeElement.querySelector('[aria-label="Gráfico de apelaciones por departamento"]')).toBeNull();
  });
  it('no anuncia oficialidad, teléfono de demostración ni soporte no configurado', () => {
    const f = page(); http.expectOne(url).flush(portal); f.detectChanges();
    expect(f.nativeElement.textContent).not.toMatch(/Plataforma oficial|0800-12345|8 am a 6 pm/);
    expect(f.nativeElement.textContent).toContain('Yaiku');
  });
  it('no publica promesas editoriales no revisadas solo porque llegan desde la API', () => {
    const f = page(); http.expectOne(url).flush(portal); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('FIRMA_Y_SOPORTE_NO_VERIFICADOS');
  });
  it('destruir la página cancela la consulta pública pendiente', () => {
    const f = page(), request = http.expectOne(url); f.destroy(); expect(request.cancelled).toBe(true);
  });
  it('no fabrica un identificador de miembro a partir de su nombre', () => {
    const f = page(); http.expectOne(url).flush({ ...portal, miembrosTTAIP: [{ nombre: 'Sin identidad persistida', cargo: 'Cargo sintético' }] }); f.detectChanges();
    expect(f.componentInstance.miembros).toHaveLength(0);
    expect(f.nativeElement.textContent).not.toContain('Sin identidad persistida');
  });
  it('presenta los valores recibidos y los datos de gráficos con su alcance público', () => {
    const f = page(); http.expectOne(url).flush(portal); f.detectChanges();
    expect(f.componentInstance.indicadores.saipPresentadas).toBe(33);
    expect(f.nativeElement.querySelector('.stat-card-value').textContent.trim()).toBe('33');
    expect(f.nativeElement.querySelector('[aria-label="Datos de apelaciones por entidad"]').textContent).toContain('Entidad sintética: 12');
    expect(f.nativeElement.querySelector('[aria-label="Datos de la serie mensual"]').textContent).toContain('33 solicitudes');
    expect(f.nativeElement.textContent).toContain('No mide apelaciones resueltas ni entrega efectiva');
  });
  it('cero recibido es un dato válido, con porcentaje sin base y listas vacías confirmadas', () => {
    const f = page(); http.expectOne(url).flush({ ...portal, metricas: { saipPresentadas: 0, respondidas: 0,
      apelaciones: 0, entidades: 0, personasApelantes: 0, tasaResolucion: 0 }, ejemplosSolicitud: [],
      apelacionesPorEntidad: [], tendenciaMensual: [] }); f.detectChanges();
    expect(f.componentInstance.estadoPortal()).toBe('disponible');
    expect(f.componentInstance.indicadores.saipPresentadas).toBe(0);
    expect(f.componentInstance.indicadores.tasaResolucion).toBeNull();
    expect(f.nativeElement.textContent).toContain('Sin apelaciones en la distribución recibida');
    expect(f.nativeElement.querySelector('[aria-label="Gráfico de apelaciones por entidad"]')).toBeNull();
  });
  it.each([null, {}, { metricas: null }, { metricas: { saipPresentadas: 3 } }])('tolera información incompleta sin fabricar cifras: %j', payload => {
    const f = page(); http.expectOne(url).flush(payload); f.detectChanges();
    expect(f.componentInstance.estadoPortal()).toBe('incompleto');
    expect(f.nativeElement.textContent).toContain('información incompleta');
    expect(f.nativeElement.textContent).not.toContain('No hay integrantes registrados en la respuesta recibida');
  });
  it.each([-1, '33', null, 2.5])('rechaza un contador inválido sin convertirlo en cero: %j', invalid => {
    const f = page(); http.expectOne(url).flush({ ...portal, metricas: { ...portal.metricas, saipPresentadas: invalid } }); f.detectChanges();
    expect(f.componentInstance.indicadores.saipPresentadas).toBeNull();
    expect(f.componentInstance.indicadores.tasaResolucion).toBeNull();
    expect(f.componentInstance.estadoPortal()).toBe('incompleto');
  });
  it.each([-1, 101, null])('no muestra un porcentaje inválido: %j', rate => {
    const f = page(); http.expectOne(url).flush({ ...portal, metricas: { ...portal.metricas, tasaResolucion: rate } });
    expect(f.componentInstance.indicadores.tasaResolucion).toBeNull();
  });
  it.each([401, 403, 404, 500])('un error HTTP %s deja indicadores no disponibles', status => {
    const f = page(); http.expectOne(url).flush(null, { status, statusText: 'Rejected' }); f.detectChanges();
    expect(f.componentInstance.estadoPortal()).toBe('error'); expect(f.componentInstance.indicadores.apelaciones).toBeNull();
    expect(f.nativeElement.textContent).toContain('falló la consulta pública');
    expect(f.nativeElement.textContent).not.toContain('Sin apelaciones en la distribución recibida');
  });
  it('un fallo de red permite reintentar sin ocultar el error con datos demo', () => {
    const f = page(); http.expectOne(url).error(new ProgressEvent('error')); f.detectChanges();
    const retry = Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Reintentar consulta pública'))!;
    retry.click(); f.detectChanges(); const second = http.expectOne(url); f.componentInstance.recargarPortal(); http.expectNone(url);
    expect(f.componentInstance.estadoPortal()).toBe('cargando');
    second.flush(portal); f.detectChanges(); expect(f.componentInstance.estadoPortal()).toBe('disponible');
    expect(f.componentInstance.indicadores.saipPresentadas).toBe(33);
  });
  it('una recarga fallida limpia gráficos, miembros y datos de la consulta previa', () => {
    const f = page(); http.expectOne(url).flush({ ...portal, miembrosTTAIP: [{ id: 71, nombre: 'Integrante sintético', sala: 'PRIMERA SALA' }] });
    f.componentInstance.recargarPortal(); expect(f.componentInstance.miembros).toEqual([]);
    http.expectOne(url).flush(null, { status: 503, statusText: 'Unavailable' }); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Integrante sintético');
    expect(f.nativeElement.querySelector('[aria-label="Gráfico de apelaciones por entidad"]')).toBeNull();
  });
  it('solo conserva datos de filas válidas y señala su carácter incompleto', () => {
    const f = page(); http.expectOne(url).flush({ ...portal, apelacionesPorEntidad: [{ etiqueta: 'Entidad válida', valor: 4 }, { etiqueta: '', valor: -1 }],
      tendenciaMensual: null }); f.detectChanges();
    expect(f.componentInstance.apelacionesPorDepartamento).toEqual([{ d: 'Entidad válida', v: 4 }]);
    expect(f.componentInstance.estadoPortal()).toBe('incompleto'); expect(f.componentInstance.tendenciaMensual).toEqual([]);
  });
  it('selecciona miembros por ID sin inventar sala, periodo, correo o fotografía', () => {
    const f = page(); http.expectOne(url).flush({ ...portal, miembrosTTAIP: [
      { id: 71, nombre: 'Registro sintético uno', cargo: 'Operador 2020', email: 'no-usar@example.invalid', foto: 'https://invalid.example/foto' },
      { id: 72, nombre: 'Registro sintético dos', sala: 'SEGUNDA SALA' }
    ] }); f.detectChanges(); const c = f.componentInstance;
    expect(c.getMembersByArea('sin-asignar').map(m => m.id)).toEqual(['71']);
    expect(c.miembros[0].contacto).toBeUndefined(); expect(c.miembros[0].foto).toBeUndefined();
    expect(f.nativeElement.textContent).not.toContain('vigente');
    expect(f.nativeElement.querySelector('img')).toBeNull(); c.selectMember('72'); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-member-detail]').getAttribute('data-member-id')).toBe('72');
    c.selectMember('inexistente'); expect(c.selectedMemberId).toBe('72');
  });
  it('los nombres largos o marcados del servidor se interpolan sin convertirse en enlaces o HTML', () => {
    const f = page(), name = 'Entidad sintética '.repeat(15) + '<script>no-ejecutar</script>';
    http.expectOne(url).flush({ ...portal, apelacionesPorEntidad: [{ etiqueta: name, valor: 1 }] }); f.detectChanges();
    expect(f.nativeElement.textContent).toContain(name); expect(f.nativeElement.querySelector('script')).toBeNull();
  });
  it('el acordeón tiene controles asociados y puede abrirse y cerrarse sin simular una actuación', () => {
    const f = page(); http.expectOne(url).flush(portal); f.detectChanges();
    const button = f.nativeElement.querySelector('#landing-question-publica') as HTMLButtonElement;
    expect(button.type).toBe('button'); button.click(); f.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const answer = f.nativeElement.querySelector('#landing-answer-publica');
    expect(answer.getAttribute('aria-labelledby')).toBe(button.id);
    button.click(); f.detectChanges(); expect(answer.getAttribute('aria-hidden')).toBe('true'); http.expectNone(() => true);
  });
  it('el desplazamiento da foco a una sección existente y respeta movimiento reducido', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true })); const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const f = page(); document.body.appendChild(f.nativeElement);
    try {
      http.expectOne(url).flush(portal); const section = f.nativeElement.querySelector('#estadisticas');
      f.componentInstance.scrollToSection('estadisticas'); expect(document.activeElement).toBe(section);
      expect(scroll).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'instant' }));
      scroll.mockClear(); f.componentInstance.scrollToSection('no-existe'); expect(scroll).not.toHaveBeenCalled();
    } finally { f.nativeElement.remove(); }
  });
});
