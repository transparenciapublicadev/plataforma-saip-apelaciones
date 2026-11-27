import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AreaResponsablePanelComponent } from './area-responsable-panel.component';
import { SolicitudService } from '../services/solicitud.service';

describe('Área responsable de la atención', () => {
  let fixture: ComponentFixture<AreaResponsablePanelComponent> | undefined;
  const asignarArea = vi.fn();

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    TestBed.resetTestingModule();
    asignarArea.mockReset();
  });

  function panel(inputs: Record<string, unknown> = {}): ComponentFixture<AreaResponsablePanelComponent> {
    TestBed.configureTestingModule({
      imports: [AreaResponsablePanelComponent],
      providers: [{ provide: SolicitudService, useValue: { asignarArea } }],
    });
    const creado = TestBed.createComponent(AreaResponsablePanelComponent);
    creado.componentRef.setInput('expediente', 'SAIP-2026-10006');
    creado.componentRef.setInput('entidad', 'Ministerio de Educacion');
    creado.componentRef.setInput('solicitudId', 6);
    for (const [key, value] of Object.entries(inputs)) creado.componentRef.setInput(key, value);
    creado.detectChanges();
    fixture = creado;
    return creado;
  }

  it('guarda el área en el servidor y la muestra en el mismo expediente', () => {
    asignarArea.mockReturnValue(of({
      id: 6,
      areaResponsable: 'Oficina de Planeamiento y Presupuesto',
      encargadoArea: 'Ana Ruiz',
      fechaAsignacionArea: '2026-11-12',
    }));
    const actual = panel();

    const select = actual.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.textContent).toContain('Dirección General de Educación Básica Regular');
    actual.componentInstance.area = 'Oficina de Planeamiento y Presupuesto';
    actual.componentInstance.responsable = 'Ana Ruiz';
    actual.componentInstance.guardar(new Event('submit'));
    actual.detectChanges();

    expect(asignarArea).toHaveBeenCalledWith(6, {
      area: 'Oficina de Planeamiento y Presupuesto',
      encargado: 'Ana Ruiz',
    });
    expect(actual.nativeElement.textContent).toContain('Oficina de Planeamiento y Presupuesto');
    expect(actual.nativeElement.textContent).toContain('Ana Ruiz');
    expect(actual.nativeElement.textContent).toContain('12/11/2026');
    expect(actual.nativeElement.querySelector('form')).toBeNull();
  });

  it('exige un área antes de llamar al servidor', () => {
    const actual = panel();
    (actual.nativeElement.querySelector('form') as HTMLFormElement).requestSubmit();
    actual.detectChanges();
    expect(actual.nativeElement.textContent).toContain('Elija el área que tiene la información.');
    expect(asignarArea).not.toHaveBeenCalled();
  });

  it('muestra la referencia del administrado sin tratarla como el área asignada', () => {
    const actual = panel({ oficinaIndicada: 'Oficina General de Administración' });
    expect(actual.nativeElement.textContent).toContain('El administrado indicó: Oficina General de Administración');
    expect(actual.nativeElement.textContent).not.toContain('Encargado:');
    expect(actual.nativeElement.querySelector('form')).not.toBeNull();
  });

  it('en solo lectura muestra el área persistida y no ofrece el formulario', () => {
    const actual = panel({
      readOnly: true,
      areaGuardada: 'Secretaría General',
      fechaGuardada: '2026-11-12',
      oficinaIndicada: 'Mesa de partes',
    });
    expect(actual.nativeElement.textContent).toContain('Secretaría General');
    expect(actual.nativeElement.textContent).toContain('El administrado indicó: Mesa de partes');
    expect(actual.nativeElement.querySelector('form,button,input,select')).toBeNull();
  });

  it('conserva el formulario si el servidor rechaza el registro', () => {
    asignarArea.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { detail: 'La solicitud ya fue atendida. El área responsable queda como se registró.' },
    })));
    const actual = panel();
    actual.componentInstance.area = 'Secretaría General';
    actual.componentInstance.guardar(new Event('submit'));
    actual.detectChanges();
    expect(actual.nativeElement.textContent).toContain('La solicitud ya fue atendida');
    expect(actual.nativeElement.querySelector('form')).not.toBeNull();
  });
});
