import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AreaResponsablePanelComponent } from './area-responsable-panel.component';
describe('Área de atención: capacidad acreditada', () => {
  afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); vi.restoreAllMocks(); });
  it('no presenta asignaciones locales anteriores ni ofrece guardado ficticio', () => {
    localStorage.setItem('saip_area_responsable', JSON.stringify({ EXP: { area: 'Área anterior', responsable: 'Persona anterior' } }));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const f = TestBed.createComponent(AreaResponsablePanelComponent);
    f.componentRef.setInput('expediente', 'EXP'); f.componentRef.setInput('entidad', 'Entidad autorizada'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Entidad autorizada');
    expect(f.nativeElement.querySelector('[role=status]').textContent).toContain('no proporciona una asignación');
    expect(f.nativeElement.textContent).not.toContain('Área anterior');
    expect(f.nativeElement.querySelector('form,button,input,select')).toBeNull();
    expect(write).not.toHaveBeenCalled();
    f.componentRef.setInput('expediente', 'OTRO'); f.componentRef.setInput('entidad', null); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Entidad autorizada');
  });
});
