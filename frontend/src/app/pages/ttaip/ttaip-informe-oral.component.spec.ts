import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TtaipInformeOralComponent } from './ttaip-informe-oral.component';
import { SuspensionPlazoTtaip } from '../../models/resolucion.model';
import { AudienciaInformeOral } from './ttaip-informe-oral.model';

describe('TtaipInformeOralComponent (F-02)', { timeout: 15000 }, () => {
  let fixture: ComponentFixture<TtaipInformeOralComponent>;
  let component: TtaipInformeOralComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TtaipInformeOralComponent]
    });
    fixture = TestBed.createComponent(TtaipInformeOralComponent);
    component = fixture.componentInstance;
  });

  it('muestra estado NO_SOLICITADA cuando no hay suspensiones de informe oral', () => {
    fixture.componentRef.setInput('suspensiones', []);
    fixture.componentRef.setInput('puedeSolicitar', true);
    fixture.detectChanges();

    expect(component.estadoActual()).toBe('NO_SOLICITADA');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Sin solicitud de informe oral');
    expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
  });

  it('muestra estado SOLICITADA y datos de parte cuando existe suspensión activa', () => {
    const suspensiones: SuspensionPlazoTtaip[] = [{
      id: 99,
      expedienteTtaipId: 41,
      numeroExpediente: '00051-2026-JUS/TTAIP',
      motivoSuspension: 'INFORME_ORAL',
      solicitante: 'CIUDADANO',
      motivoDetalle: 'Sustento de agravios de la apelación',
      fechaSolicitud: '2026-10-04',
      diasSuspendidos: 3,
      estadoSuspension: 'ACTIVA'
    }];
    fixture.componentRef.setInput('suspensiones', suspensiones);
    fixture.componentRef.setInput('puedeGestionar', true);
    fixture.detectChanges();

    expect(component.estadoActual()).toBe('SOLICITADA');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Informe oral solicitado');
    expect(text).toContain('Sustento del pedido');
    expect(text).toContain('Programar audiencia');
  });

  it('abre modal de programación y emite audiencia CONCEDIDA_PROGRAMADA al validar formulario', () => {
    const suspensiones: SuspensionPlazoTtaip[] = [{
      id: 99,
      expedienteTtaipId: 41,
      numeroExpediente: '00051-2026-JUS/TTAIP',
      motivoSuspension: 'INFORME_ORAL',
      solicitante: 'CIUDADANO',
      motivoDetalle: 'Sustento oral',
      estadoSuspension: 'ACTIVA'
    }];
    fixture.componentRef.setInput('suspensiones', suspensiones);
    fixture.componentRef.setInput('puedeGestionar', true);
    fixture.detectChanges();

    let emitida: AudienciaInformeOral | undefined;
    component.audienciaCambio.subscribe(a => { emitida = a; });

    component.abrirModal('PROGRAMAR');
    component.progFecha = '2026-11-15';
    component.progHoraInicio = '10:00';
    component.progHoraFin = '10:30';
    component.progPlataforma = 'TEAMS';
    component.progEnlace = 'https://teams.microsoft.com/l/meetup/test';
    component.progResponsable = 'Relator TTAIP';

    component.ejecutarProgramacion();
    fixture.detectChanges();

    expect(emitida).toBeDefined();
    expect(emitida?.estado).toBe('CONCEDIDA_PROGRAMADA');
    expect(emitida?.fechaAudiencia).toBe('2026-11-15');
    expect(component.modalActivo()).toBeNull();
  });

  it('no expone botones de gestión si puedeGestionar() es false', () => {
    const suspensiones: SuspensionPlazoTtaip[] = [{
      id: 99,
      motivoSuspension: 'INFORME_ORAL',
      solicitante: 'CIUDADANO',
      motivoDetalle: 'Sustento oral',
      estadoSuspension: 'ACTIVA'
    }];
    fixture.componentRef.setInput('suspensiones', suspensiones);
    fixture.componentRef.setInput('puedeGestionar', false);
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const programarBtn = buttons.find(b => b.textContent?.includes('Programar audiencia'));
    expect(programarBtn).toBeUndefined();
  });
});
