import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { ReferenceComboboxComponent, ReferenceComboboxOption } from './reference-combobox.component';

@Component({
  standalone: true,
  imports: [ReferenceComboboxComponent],
  template: `
    <app-reference-combobox
      [options]="testOptions"
      [(value)]="selectedVal"
      placeholder="Seleccione entidad"
      [searchable]="true"
      [required]="false"
    ></app-reference-combobox>
  `
})
class TestHostComponent {
  testOptions: ReferenceComboboxOption[] = [
    { id: 1, label: 'Ministerio de Educación', sublabel: 'MINEDU' },
    { id: 2, label: 'Ministerio de Justicia', sublabel: 'MINJUS' },
    { id: 3, label: 'Presidencia del Consejo de Ministros', sublabel: 'PCM' }
  ];
  selectedVal: any = null;
}

describe('ReferenceComboboxComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, ReferenceComboboxComponent]
    }).compileComponents();
  });

  it('debería mostrar el placeholder cuando no hay nada seleccionado', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('button');
    expect(trigger.textContent).toContain('Seleccione entidad');
  });

  it('debería abrir el dropdown al hacer clic en el trigger', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('button');
    trigger.click();
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('[role="listbox"]');
    expect(popover).toBeTruthy();
    const options = fixture.nativeElement.querySelectorAll('[role="option"]');
    expect(options.length).toBe(3);
  });

  it('debería seleccionar una opción, mostrar su etiqueta y subetiqueta en el botón y cerrar el popover', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    // Abrir dropdown
    const trigger = fixture.nativeElement.querySelector('button');
    trigger.click();
    fixture.detectChanges();

    // Seleccionar la opción 1 (MINEDU)
    const options = fixture.nativeElement.querySelectorAll('[role="option"]');
    options[0].click();
    fixture.detectChanges();

    // Verificar que el popover se cerró
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();

    // Verificar que el botón trigger muestra la opción seleccionada
    expect(trigger.textContent).toContain('Ministerio de Educación');
    expect(trigger.textContent).toContain('(MINEDU)');

    // Verificar two-way data binding con el host
    expect(fixture.componentInstance.selectedVal).toBe(1);
  });

  it('debería reflejar una selección inicial provista desde el host', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.selectedVal = 2;
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('button');
    expect(trigger.textContent).toContain('Ministerio de Justicia');
    expect(trigger.textContent).toContain('(MINJUS)');
  });

  it('debería filtrar opciones en el buscador integrado por nombre o sigla', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    // Abrir dropdown
    const trigger = fixture.nativeElement.querySelector('button');
    trigger.click();
    fixture.detectChanges();

    // Escribir en el buscador
    const searchInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="text"]');
    expect(searchInput).toBeTruthy();
    searchInput.value = 'pcm';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('PCM');
  });

  it('debería limpiar la selección al hacer clic en el botón de limpieza (x)', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.selectedVal = 3;
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('button');
    expect(trigger.textContent).toContain('PCM');

    // Botón de limpiar selección
    const clearBtn: HTMLElement = fixture.nativeElement.querySelector('span[title="Limpiar selección"]');
    expect(clearBtn).toBeTruthy();
    clearBtn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedVal).toBeNull();
    expect(trigger.textContent).toContain('Seleccione entidad');
  });
});
