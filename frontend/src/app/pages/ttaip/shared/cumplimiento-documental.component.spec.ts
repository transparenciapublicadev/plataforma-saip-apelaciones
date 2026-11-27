import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { type FaseCumplimientoTtaip, TtaipActuacionesService } from '../../../services/ttaip-actuaciones.service';
import { CumplimientoDocumentalComponent } from './cumplimiento-documental.component';

const fase: FaseCumplimientoTtaip = {
  id: 12, numeroExpediente: '12345-2026-JUS/TTAIP', numeroResolucion: 'Resolución de prueba',
  entidad: 'Entidad de prueba', estado: 'PENDIENTE', fechaNotificacionEntidad: '2026-11-17', fechaLimite: '2026-11-26',
  fechaEntrega: '2026-11-18T09:30:00', fechaEficaciaEntrega: '2026-11-18', fechaRemision: null,
  numeroOficio: null, fundamento: null, operacionEntrega: null, operacionValidacion: null, operacionRemision: null,
  puedeEntregar: false, puedeValidar: false, puedeRemitir: true, expedienteResuelto: false, documentos: [],
};

describe('Cumplimiento documental de la resolución final', () => {
  const revision = signal(1);
  const consultar = vi.fn();
  const registrar = vi.fn();

  function crear(ciudadano = false) {
    const fixture = TestBed.createComponent(CumplimientoDocumentalComponent);
    fixture.componentRef.setInput('expedienteId', 3);
    fixture.componentRef.setInput('ciudadano', ciudadano);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    revision.set(1);
    consultar.mockReset().mockReturnValue(of({ cumplimiento: fase }));
    registrar.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { cambiosSesion: revision } },
        { provide: TtaipActuacionesService, useValue: {
          cumplimientoDocumental: consultar,
          registrarCumplimientoDocumental: registrar,
        } },
      ],
    }).overrideComponent(CumplimientoDocumentalComponent, {
      set: { template: '', imports: [] },
    });
  });

  it('espera la recuperación antes de confirmar la remisión', () => {
    const fixture = crear();
    const c = fixture.componentInstance;
    const recibido = new Subject<{ cumplimiento: FaseCumplimientoTtaip }>();
    consultar.mockReturnValueOnce(recibido);
    registrar.mockReturnValueOnce(of({ ...fase, estado: 'CUMPLIDO' }));
    const cerrar = vi.fn();
    c.cerrado.subscribe(cerrar);
    c.abrir('remision');
    c.campos.controls.numeroOficio.setValue('OF-100');
    c.campos.controls.fundamento.setValue('Entrega atendida');
    c.seleccionar('oficio', [new File(['oficio'], 'oficio.pdf', { type: 'application/pdf' })]);
    c.anexos.set([new File(['anexo'], 'anexo.txt', { type: 'text/plain' })]);
    c.enviar();

    const [expediente, paso, datos] = registrar.mock.calls[0];
    expect([expediente, paso, datos.get('numeroOficio')]).toEqual([3, 'remision', 'OF-100']);
    expect(datos.get('oficio').name).toBe('oficio.pdf');
    expect(datos.getAll('anexos')[0].name).toBe('anexo.txt');
    expect(c.mensaje()).toBe('');
    expect(cerrar).not.toHaveBeenCalled();
    recibido.next({ cumplimiento: { ...fase, estado: 'CUMPLIDO', puedeRemitir: false, expedienteResuelto: true,
      numeroOficio: 'OF-100', fechaRemision: '2026-11-19', operacionRemision: datos.get('operacion') } });
    expect(c.detalleRemision()).toContainEqual({ label: 'Número de oficio', value: 'OF-100', mono: true });
    expect(c.mensaje()).toContain('listo para archivo y publicación');
    expect(cerrar).not.toHaveBeenCalled();
    c.cerrarConfirmacion();
    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('consulta un resultado incierto sin reenviar automáticamente y permite repetir con el mismo UUID', () => {
    const c = crear().componentInstance;
    consultar.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    registrar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    c.abrir('remision');
    c.campos.controls.numeroOficio.setValue('OF-101');
    c.campos.controls.fundamento.setValue('Sustento');
    c.seleccionar('oficio', [new File(['oficio'], 'oficio.pdf', { type: 'application/pdf' })]);
    c.enviar();
    c.reintentar();
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(c.error()).toContain('No se pudo comprobar');
    c.consultar();
    expect(c.reintentoPermitido()).toBe(true);
    c.reintentar();
    expect(registrar).toHaveBeenCalledTimes(2);
    expect(registrar.mock.calls[1][2].get('operacion')).toBe(registrar.mock.calls[0][2].get('operacion'));
  });

  it('exige cargo y acuse antes de validar la entrega', () => {
    consultar.mockReturnValueOnce(of({ cumplimiento: { ...fase, puedeValidar: true } }));
    const c = crear().componentInstance;
    c.abrir('validacion-entrega');
    c.seleccionar('cargo', [new File(['cargo'], 'cargo.pdf', { type: 'application/pdf' })]);
    c.enviar();
    expect(registrar).not.toHaveBeenCalled();
    expect(c.error()).toContain('Acuse de notificación');
  });

  it('descarta una consulta de la sesión anterior cuando cambia el usuario', () => {
    const anterior = new Subject<{ cumplimiento: FaseCumplimientoTtaip }>();
    consultar.mockReturnValueOnce(anterior).mockReturnValue(of({ cumplimiento: null }));
    const fixture = crear(true);
    revision.set(2);
    fixture.detectChanges();
    anterior.next({ cumplimiento: fase });
    expect(fixture.componentInstance.fase()).toBeNull();
  });
});
