import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { AdminPlazosCalendarioComponent } from './admin-plazos-calendario.component';
import { EntidadService } from '../../services/entidad.service';
import { environment } from '../../../environments/environment';
import { of } from 'rxjs';

describe('AdminPlazosCalendarioComponent — Gestión Oficial de Plazos y Calendario (F17)', () => {
  let component: AdminPlazosCalendarioComponent;
  let fixture: ComponentFixture<AdminPlazosCalendarioComponent>;
  let httpTesting: HttpTestingController;
  let entidadServiceMock: any;

  beforeEach(async () => {
    localStorage.clear();
    entidadServiceMock = {
      findActivas: vi.fn().mockReturnValue(of([{ id: 1, nombre: 'Ministerio de Justicia', acronimo: 'MINJUS', activa: true }])),
      findAll: vi.fn().mockReturnValue(of([{ id: 1, nombre: 'Ministerio de Justicia', acronimo: 'MINJUS', activa: true }]))
    };

    await TestBed.configureTestingModule({
      imports: [AdminPlazosCalendarioComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EntidadService, useValue: entidadServiceMock }
      ]
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminPlazosCalendarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${environment.apiUrl}/calendario`);
    req.flush(component.cal());
  });

  afterEach(() => {
    try {
      httpTesting.verify();
    } finally {
      TestBed.resetTestingModule();
      localStorage.clear();
      vi.restoreAllMocks();
    }
  });

  it('se inicializa con la configuración de calendario oficial y 12 meses', () => {
    expect(component).toBeTruthy();
    expect(component.mesesNombres).toHaveLength(12);
    expect(component.cal().feriados.length).toBeGreaterThan(0);
    expect(component.sucio()).toBe(false);
  });

  it('permite cambiar el año seleccionado y actualiza la cuadrícula', () => {
    const anioActual = component.anio();
    component.anio.set(anioActual + 1);
    expect(component.anio()).toBe(anioActual + 1);
  });

  it('seleccionar una fecha en la cuadrícula llena el formulario de alta', () => {
    component.seleccionarFechaEnGrid('2026-01-01');
    expect(component.formFecha()).toBe('2026-01-01');
    expect(component.formNombre()).toBe('Año Nuevo');
  });

  it('permite agregar un nuevo día inhábil y marca cambios pendientes (sucio)', () => {
    component.formNombre.set('Feriado Cívico Local');
    component.formFecha.set('2026-09-23');
    component.formTipo.set('no_laborable');
    component.formBaseLegal.set('D.S. 001-2026-PCM');

    component.agregar();

    const feriados = component.cal().feriados;
    const nuevo = feriados.find(f => f.nombre === 'Feriado Cívico Local');
    expect(nuevo).toBeDefined();
    expect(nuevo?.fecha).toBe('2026-09-23');
    expect(component.sucio()).toBe(true);
  });

  it('permite alternar el estado activo de un feriado y eliminarlo', () => {
    const feriado = component.cal().feriados[0];
    const id = feriado.id;
    const estadoInicial = feriado.activo;

    component.alternarFeriado(id);
    expect(component.cal().feriados.find(f => f.id === id)?.activo).toBe(!estadoInicial);

    component.quitarFeriado(id);
    expect(component.cal().feriados.find(f => f.id === id)).toBeUndefined();
    expect(component.sucio()).toBe(true);
  });

  it('respeta los límites mínimo y máximo legales al modificar plazos', () => {
    const meta = component.plazosMeta.find(m => m.clave === 'SAIP_ATENCION')!;
    // Intentar fijar por debajo del mínimo legal (ej. 0 días cuando min es 5 o 10)
    component.setPlazo('SAIP_ATENCION', String(meta.min - 5));
    expect(component.cal().plazos['SAIP_ATENCION']).toBe(meta.min);

    // Intentar fijar por encima del máximo legal
    component.setPlazo('SAIP_ATENCION', String(meta.max + 10));
    expect(component.cal().plazos['SAIP_ATENCION']).toBe(meta.max);
  });

  it('el simulador de cómputo calcula la fecha de vencimiento', () => {
    component.simInicio.set('2026-05-04'); // Lunes
    component.simClave.set('SAIP_ATENCION'); // 10 días hábiles

    const vencimiento = component.simVence();
    expect(vencimiento).toBeTruthy();
    expect(vencimiento).toBeDefined();
  });

  it('exige norma legal para guardar cambios legales y actualiza el historial', () => {
    // Modificar un plazo legal
    component.setPlazo('SAIP_ATENCION', '12');
    expect(component.cambiosLegales().length).toBeGreaterThan(0);

    // Intentar guardar sin norma
    component.norma.set('');
    component.guardar();
    expect(component.mensajeError()).toContain('norma');

    // Guardar con norma válida
    component.norma.set('D.S. 025-2026-PCM');
    component.guardar();

    const req = httpTesting.expectOne(`${environment.apiUrl}/calendario`);
    expect(req.request.method).toBe('PUT');
    req.flush(req.request.body);

    expect(component.mensajeExito()).toContain('actualizados');
    expect(component.guardado().historial.length).toBeGreaterThan(0);
    expect(component.guardado().historial[0].norma).toBe('D.S. 025-2026-PCM');
    expect(component.sucio()).toBe(false);
  });

  it('un fallo del servidor no marca el calendario como guardado', () => {
    component.setPlazo('SAIP_ATENCION', '12');
    component.norma.set('D.S. 025-2026-PCM');
    component.guardar();

    const req = httpTesting.expectOne(`${environment.apiUrl}/calendario`);
    req.flush({ title: 'No disponible' }, { status: 503, statusText: 'Unavailable' });

    expect(component.mensajeExito()).toBeNull();
    expect(component.mensajeError()).toContain('no se guardó');
    expect(component.sucio()).toBe(true);
    expect(component.norma()).toBe('D.S. 025-2026-PCM');
  });

  it('descartar restaura el estado previo al último guardado', () => {
    const cantidadOriginal = component.cal().feriados.length;
    component.formNombre.set('Feriado Descartable');
    component.formFecha.set('2026-11-15');
    component.agregar();
    expect(component.cal().feriados.length).toBe(cantidadOriginal + 1);

    component.descartar();
    expect(component.cal().feriados.length).toBe(cantidadOriginal);
    expect(component.sucio()).toBe(false);
  });
});
