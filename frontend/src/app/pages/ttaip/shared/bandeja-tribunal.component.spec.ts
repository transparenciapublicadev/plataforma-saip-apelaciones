import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../services/auth.service';
import { PanelQueryService } from '../../../services/panel-query.service';
import { PanelQuery } from '../../../models/panel-query.model';
import { BandejaTribunalComponent } from './bandeja-tribunal.component';

describe('Bandeja de actuaciones', () => {
  const apelaciones = vi.fn();
  const item = {
    id: 4, expediente: '00004-2026-JUS/TTAIP', solicitudExpediente: 'SAIP-2026-10008',
    estado: 'EN_CALIFICACION_2', entidadNombre: 'Ministerio de Educacion',
  };

  beforeEach(() => {
    apelaciones.mockReset();
    apelaciones.mockImplementation((query: PanelQuery) => of({
      contenido: query.busqueda ? [] : [item],
      pagina: 0, tamano: 10, totalElementos: query.busqueda ? 0 : 1, totalPaginas: 1, ultima: true,
      resumen: { total: 1, porEstado: {}, porEtapa: {} }, entidades: [], alcance: 'FUNCIONARIO',
    }));
    TestBed.configureTestingModule({
      imports: [BandejaTribunalComponent],
      providers: [
        provideRouter([]),
        { provide: PanelQueryService, useValue: { apelaciones } },
        { provide: AuthService, useValue: { cambiosSesion: signal(0), obtenerSesion: () => ({ tipoUsuario: 'FUNCIONARIO', token: 't' }) } },
      ],
    });
  });

  it('busca sin retirar el campo y el expediente vuelve a actuaciones', () => {
    const f = TestBed.createComponent(BandejaTribunalComponent);
    f.componentRef.setInput('integrada', true);
    f.componentRef.setInput('entidad', true);
    f.detectChanges();
    const enlace = f.nativeElement.querySelector('a.btn-ghost-brand') as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toContain('desde=actuaciones');
    expect(apelaciones).toHaveBeenCalledWith({ pagina: 0, tamano: 10 });
    vi.useFakeTimers();
    const input = f.nativeElement.querySelector('#bandeja-busqueda') as HTMLInputElement;
    input.value = '00004-2026-JUS/TTAIP';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(250);
    f.detectChanges();
    expect(apelaciones).toHaveBeenLastCalledWith({ pagina: 0, tamano: 10, busqueda: '00004-2026-JUS/TTAIP' });
    expect(f.nativeElement.querySelector('#bandeja-busqueda')).not.toBeNull();
    expect(f.nativeElement.textContent).toContain('Ninguna actuación coincide con «00004-2026-JUS/TTAIP»');
    f.destroy();
    vi.useRealTimers();
  });
});
