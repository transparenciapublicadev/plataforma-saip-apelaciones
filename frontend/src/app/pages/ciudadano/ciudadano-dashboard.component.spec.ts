import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CiudadanoDashboardComponent } from './ciudadano-dashboard.component';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { Solicitud } from '../../models/solicitud.model';

describe('Panel ciudadano — inicio acreditado de subsanación TTAIP', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [CiudadanoDashboardComponent], providers: [provideRouter([]),
    { provide: SolicitudService, useValue: {} }, { provide: ApelacionService, useValue: {} },
    { provide: AuthService, useValue: { obtenerSesion: () => null } },
    { provide: GuidedTourService, useValue: { isOpen: () => false, isFirstVisit: () => false } }] }));

  function solicitud(plazo?: NonNullable<Solicitud['apelacion']>['plazoSubsanacion']): Solicitud {
    return { id: 1, expediente: 'SAIP-2026-00001', estado: 'DENEGADA', entidadNombre: 'Entidad sintética',
      asunto: 'Solicitud sintética', fechaRecepcion: '2026-09-01', documentos: [], observaciones: [],
      apelacion: { expediente: '00001-2026-JUS/TTAIP', estado: 'EN_SUBSANACION',
        fechaSubsanacion: '2000-01-01', diasSubsanacion: 2, plazoSubsanacion: plazo } } as unknown as Solicitud;
  }

  it('muestra inicio pendiente y permite consultar subsanación sin inventar vencimiento histórico', () => {
    const f = TestBed.createComponent(CiudadanoDashboardComponent); const c = f.componentInstance;
    const s = solicitud({ requerimientoId: 71, estado: 'PENDIENTE_INICIO', diasHabiles: 2 });
    c.todasSolicitudes.set([s]); c.loading.set(false); f.detectChanges();
    expect(c.esSubsanacionVencida(s)).toBe(false);
    expect(c.subsanacionPrincipal()?.dias).toBeNull();
    expect(c.accionPrincipal()?.metricValue).toBe('Pendiente');
    expect(f.nativeElement.textContent).toContain('Plazo pendiente de inicio');
    expect(f.nativeElement.textContent).not.toContain('PLAZO DE SUBSANACIÓN VENCIDO');
  });

  it('mantiene habilitado el último día y respeta el vencimiento expresado por el servidor', () => {
    const c = TestBed.createComponent(CiudadanoDashboardComponent).componentInstance;
    c.todasSolicitudes.set([solicitud({ requerimientoId: 71, estado: 'EN_CURSO', diasHabiles: 2, diasHabilesRestantes: 0 })]);
    expect(c.accionPrincipal()?.ctaLabel).toBe('Completar subsanación');
    expect(c.subsanacionPrincipal()?.vencido).toBe(false);
    const vencida = solicitud({ requerimientoId: 71, estado: 'VENCIDO', diasHabiles: 2, diasHabilesRestantes: -1 });
    c.todasSolicitudes.set([vencida]);
    expect(c.subsanacionPrincipal()?.vencido).toBe(true); expect(c.accionPrincipal()).toBeNull();
    expect(c.filaUrgencia(vencida)?.value).toBe('Vencido');
  });
});
