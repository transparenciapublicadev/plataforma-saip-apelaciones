import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, BehaviorSubject } from 'rxjs';
import { signal } from '@angular/core';

// Modelos y Componentes a poner a prueba
import { TtaipDashboardComponent } from './ttaip-dashboard.component';
import { habilesEntreFechas } from './ttaip-dashboard.model';
import { PanelQueryService } from '../../services/panel-query.service';
import { AuthService } from '../../services/auth.service';
import { Apelacion } from '../../models/apelacion.model';

import { TtaipInformeOralComponent } from './ttaip-informe-oral.component';
import {
  AudienciaInformeOral,
  puedeTransicionarInformeOral,
  validarProgramacionAudiencia,
  programarAudiencia,
  reprogramarAudiencia,
  registrarRealizacionAudiencia
} from './ttaip-informe-oral.model';
import { SuspensionPlazoTtaip } from '../../models/resolucion.model';

import { TtaipSegundaCalificacionComponent } from './ttaip-segunda-calificacion.component';
import { environment } from '../../../environments/environment';

function createMockApelacion(id: number, estado: string): Apelacion {
  return {
    id,
    expediente: `000${id}-2026-JUS/TTAIP`,
    estado: estado as any,
    resultado: estado.startsWith('RESUELTO') ? 'FUNDADO' : undefined,
    fundamentos: 'Test adversarial fundamentos',
    fechaApelacion: '2026-10-01T00:00:00',
    solicitudId: id,
    solicitudExpediente: `SAIP-00${id}`,
    solicitudAsunto: 'Solicitud para prueba adversarial',
    ciudadanoId: 10,
    ciudadanoNombre: 'Administrado Adversarial',
    entidadId: 20,
    entidadNombre: 'Ministerio de Justicia y Derechos Humanos',
    tipoOrigen: 'SAIP_INTERNA',
    resoluciones: [],
    documentos: [],
    documentosMetadata: []
  } as any;
}

describe('Adversarial Challenge Suite — Hito 4 TTAIP (teamwork_challenger_m4_it2_2)', { timeout: 15000 }, () => {

  // =========================================================================
  // 1. Defectos F-01 y F-05: Cómputo de tiempoPromedio y resolucionesMes
  // =========================================================================
  describe('1. Cómputo Adversarial de tiempoPromedio y resolucionesMes (F-01 / F-05)', () => {
    let mockPanelService: any;
    let mockAuthService: any;

    beforeEach(() => {
      mockPanelService = {
        apelaciones: vi.fn(() => of({
          contenido: [],
          pagina: 1,
          tamano: 10,
          totalElementos: 0,
          totalPaginas: 1,
          ultima: true,
          entidades: [],
          alcance: 'Tribunal autorizado',
          resumen: { total: 0, porEstado: {}, porEtapa: {} }
        }))
      };
      mockAuthService = {
        cambiosSesion: signal(0),
        obtenerSesion: vi.fn().mockReturnValue({
          nombre: 'Operador Challenger',
          usuarioId: 99,
          token: 'token-challenger',
          tipoUsuario: 'TTAIP'
        })
      };
    });

    it('F01-EDGE-01: retorna "—" cuando hay 0 apelaciones resueltas', () => {
      TestBed.configureTestingModule({
        imports: [TtaipDashboardComponent],
        providers: [
          provideRouter([]),
          { provide: PanelQueryService, useValue: mockPanelService },
          { provide: AuthService, useValue: mockAuthService }
        ]
      });

      const fixture = TestBed.createComponent(TtaipDashboardComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      // Lista vacía
      comp.apelaciones.set([]);
      expect(comp.tiempoPromedio()).toBe('—');

      // Lista solo con apelaciones no resueltas
      const apPendiente = createMockApelacion(1, 'EN_CALIFICACION_1');
      comp.apelaciones.set([apPendiente]);
      expect(comp.tiempoPromedio()).toBe('—');
    });

    it('F01-EDGE-02: calcula con precisión días hábiles excluyendo sábados y domingos', () => {
      // Viernes 2026-11-06 a Lunes 2026-11-09: Solo cuenta lunes (1 día hábil)
      const diasViernesALunes = habilesEntreFechas('2026-11-06', '2026-11-09');
      expect(diasViernesALunes).toBe(1);

      // Sábado 2026-11-07 a Domingo 2026-11-08: 0 días hábiles
      const diasFinDeSemana = habilesEntreFechas('2026-11-07', '2026-11-08');
      expect(diasFinDeSemana).toBe(0);

      // Viernes 2026-11-06 a Viernes 2026-11-13: 5 días hábiles (lunes a viernes siguiente)
      const diasSemanaCompleta = habilesEntreFechas('2026-11-06', '2026-11-13');
      expect(diasSemanaCompleta).toBe(5);
    });

    it('F01-EDGE-03: orden cronológico inverso (resolución anterior a ingreso) se ignora y no corrompe el promedio con valores negativos', () => {
      TestBed.configureTestingModule({
        imports: [TtaipDashboardComponent],
        providers: [
          provideRouter([]),
          { provide: PanelQueryService, useValue: mockPanelService },
          { provide: AuthService, useValue: mockAuthService }
        ]
      });

      const fixture = TestBed.createComponent(TtaipDashboardComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      // Apelación con fecha de resolución ANTERIOR a la fecha de ingreso
      const apInversa = createMockApelacion(5, 'RESUELTO_FUNDADO');
      apInversa.fechaApelacion = '2026-11-20';
      apInversa.resolucion = {
        id: 501,
        tipoResolucion: 'RESOLUCION_FINAL',
        decision: 'FUNDADO',
        fechaResolucion: '2026-11-05' // Inversa
      } as any;

      comp.apelaciones.set([apInversa]);
      // Debido a `fin >= ini`, el registro debe ser descartado limpiamente y dar '—'
      expect(comp.tiempoPromedio()).toBe('—');

      // Si se combina con un registro válido (2 días hábiles), el promedio no se distorsiona
      const apValida = createMockApelacion(6, 'RESUELTO_FUNDADO');
      apValida.fechaApelacion = '2026-11-02'; // Lunes
      apValida.resolucion = {
        id: 502,
        tipoResolucion: 'RESOLUCION_FINAL',
        decision: 'FUNDADO',
        fechaResolucion: '2026-11-04' // Miércoles: 2 días hábiles
      } as any;

      comp.apelaciones.set([apInversa, apValida]);
      expect(comp.tiempoPromedio()).toBe('2.0d');
    });

    it('F01-EDGE-04: resolución en el mismo día arroja 0 días hábiles y promedio coherente', () => {
      TestBed.configureTestingModule({
        imports: [TtaipDashboardComponent],
        providers: [
          provideRouter([]),
          { provide: PanelQueryService, useValue: mockPanelService },
          { provide: AuthService, useValue: mockAuthService }
        ]
      });

      const fixture = TestBed.createComponent(TtaipDashboardComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      const apMismoDia = createMockApelacion(7, 'RESUELTO_FUNDADO');
      apMismoDia.fechaApelacion = '2026-11-04';
      apMismoDia.resolucion = {
        id: 503,
        tipoResolucion: 'RESOLUCION_FINAL',
        decision: 'FUNDADO',
        fechaResolucion: '2026-11-04'
      } as any;

      comp.apelaciones.set([apMismoDia]);
      expect(comp.tiempoPromedio()).toBe('0.0d');
    });

    it('F05-EDGE-01: resolucionesMes no cuenta resoluciones de meses anteriores ni futuros', () => {
      TestBed.configureTestingModule({
        imports: [TtaipDashboardComponent],
        providers: [
          provideRouter([]),
          { provide: PanelQueryService, useValue: mockPanelService },
          { provide: AuthService, useValue: mockAuthService }
        ]
      });

      const fixture = TestBed.createComponent(TtaipDashboardComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      const mesActual = new Date().toISOString().slice(0, 7);

      // 1. Mes anterior
      const apMesAnterior = createMockApelacion(11, 'RESUELTO_FUNDADO');
      apMesAnterior.resolucion = { id: 601, fechaResolucion: '2026-01-15' } as any;

      // 2. Mes futuro
      const apMesFuturo = createMockApelacion(12, 'RESUELTO_INFUNDADO');
      apMesFuturo.resolucion = { id: 602, fechaResolucion: '2027-12-20' } as any;

      // 3. Mes actual (2 apelaciones)
      const apMesActual1 = createMockApelacion(13, 'RESUELTO_FUNDADO');
      apMesActual1.resolucion = { id: 603, fechaResolucion: `${mesActual}-03` } as any;

      const apMesActual2 = createMockApelacion(14, 'RESUELTO_IMPROCEDENTE');
      apMesActual2.resolucion = { id: 604, fechaResolucion: `${mesActual}-05` } as any;

      // 4. Apelación sin fecha de resolución
      const apSinFecha = createMockApelacion(15, 'RESUELTO_FUNDADO');
      apSinFecha.resolucion = { id: 605 } as any;

      comp.apelaciones.set([apMesAnterior, apMesFuturo, apMesActual1, apMesActual2, apSinFecha]);

      // Solo las 2 del mes actual deben ser contabilizadas
      expect(comp.resolucionesMes()).toBe(2);
    });
  });

  // =========================================================================
  // 2. Defecto F-02: Máquina de Estados de Informe Oral, URLs y Modales
  // =========================================================================
  describe('2. Informe Oral — Máquina de Estados, Seguridad de URLs y Modales (F-02)', () => {
    const baseAud: AudienciaInformeOral = {
      id: 88,
      expedienteTtaipId: 42,
      numeroExpediente: '00042-2026-JUS/TTAIP',
      estado: 'SOLICITADA',
      solicitante: 'CIUDADANO',
      motivoSolicitud: 'Sustento oral de agravios en apelación',
      fechaSolicitud: '2026-10-10',
      diasSuspendidos: 3,
      responsable: 'Relator TTAIP'
    };

    it('F02-STATE-01: bloquea rígidamente transiciones ilegales entre estados', () => {
      // DESISTIDA es terminal: no puede pasar a REALIZADA ni a SOLICITADA
      expect(puedeTransicionarInformeOral('DESISTIDA', 'REALIZADA')).toBe(false);
      expect(puedeTransicionarInformeOral('DESISTIDA', 'SOLICITADA')).toBe(false);
      expect(puedeTransicionarInformeOral('DESISTIDA', 'CONCEDIDA_PROGRAMADA')).toBe(false);

      // REALIZADA es terminal: no puede pasar a CONCEDIDA_PROGRAMADA ni a REPROGRAMADA
      expect(puedeTransicionarInformeOral('REALIZADA', 'CONCEDIDA_PROGRAMADA')).toBe(false);
      expect(puedeTransicionarInformeOral('REALIZADA', 'REPROGRAMADA')).toBe(false);
      expect(puedeTransicionarInformeOral('REALIZADA', 'SOLICITADA')).toBe(false);

      // NO_SOLICITADA solo puede pasar a SOLICITADA
      expect(puedeTransicionarInformeOral('NO_SOLICITADA', 'REALIZADA')).toBe(false);
      expect(puedeTransicionarInformeOral('NO_SOLICITADA', 'CONCEDIDA_PROGRAMADA')).toBe(false);
      expect(puedeTransicionarInformeOral('NO_SOLICITADA', 'REPROGRAMADA')).toBe(false);

      // PRESCINDIDA_DENEGADA es terminal
      expect(puedeTransicionarInformeOral('PRESCINDIDA_DENEGADA', 'SOLICITADA')).toBe(false);
      expect(puedeTransicionarInformeOral('PRESCINDIDA_DENEGADA', 'REALIZADA')).toBe(false);

      // NO_REALIZADA es terminal
      expect(puedeTransicionarInformeOral('NO_REALIZADA', 'REPROGRAMADA')).toBe(false);
      expect(puedeTransicionarInformeOral('NO_REALIZADA', 'REALIZADA')).toBe(false);
    });

    it('F02-STATE-02: métodos de mutación arrojan excepción ante estados incompatibles', () => {
      const audDesistida: AudienciaInformeOral = { ...baseAud, estado: 'DESISTIDA' };
      const audRealizada: AudienciaInformeOral = { ...baseAud, estado: 'REALIZADA' };

      // Intentar realizar una audiencia desistida
      expect(() => registrarRealizacionAudiencia(audDesistida, {
        asistioRecurrente: true,
        asistioEntidad: true,
        resumenAlegatos: 'Alegatos orales de prueba suficiente',
        responsable: 'Operador'
      })).toThrowError(/No se puede marcar como realizada/);

      // Intentar programar una audiencia ya realizada
      expect(() => programarAudiencia(audRealizada, {
        fechaAudiencia: '2026-11-20',
        horaInicio: '10:00',
        horaFin: '10:30',
        plataforma: 'TEAMS',
        enlaceVirtual: 'https://teams.microsoft.com/l/meetup/123',
        responsable: 'Operador'
      })).toThrowError(/No se puede programar/);

      // Intentar reprogramar una audiencia desistida
      expect(() => reprogramarAudiencia(audDesistida, {
        motivo: 'Motivo de prueba con más de 10 caracteres',
        nuevaFechaAudiencia: '2026-11-25',
        nuevaHoraInicio: '10:00',
        nuevaHoraFin: '10:30',
        nuevoEnlaceVirtual: 'https://meet.google.com/abc-defg-hij',
        responsable: 'Operador'
      })).toThrowError(/No se puede reprogramar/);
    });

    it('F02-URL-01: validación de URL rechaza esquemas inseguros http://, cadenas vacías y javascript:', () => {
      const basePayload = {
        fechaAudiencia: '2026-11-20',
        horaInicio: '09:00',
        horaFin: '09:30',
        plataforma: 'TEAMS' as const,
        responsable: 'Relator'
      };

      // 1. http:// rechazo
      const resHttp = validarProgramacionAudiencia({ ...basePayload, enlaceVirtual: 'http://teams.microsoft.com/meet' });
      expect(resHttp.valido).toBe(false);
      expect(resHttp.errores.some(e => e.includes('https://'))).toBe(true);

      // 2. javascript: rechazo
      const resJs = validarProgramacionAudiencia({ ...basePayload, enlaceVirtual: 'javascript:alert(1)' });
      expect(resJs.valido).toBe(false);

      // 3. Cadena vacía o espacios
      const resVacio = validarProgramacionAudiencia({ ...basePayload, enlaceVirtual: '   ' });
      expect(resVacio.valido).toBe(false);

      // 4. URL https:// válida de Teams y Google Meet son aceptadas
      const resTeams = validarProgramacionAudiencia({ ...basePayload, enlaceVirtual: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting' });
      expect(resTeams.valido).toBe(true);

      const resMeet = validarProgramacionAudiencia({ ...basePayload, plataforma: 'MEET', enlaceVirtual: 'https://meet.google.com/xyz-uvwx-rst' });
      expect(resMeet.valido).toBe(true);
    });

    it('F02-URL-02 [AUDITORÍA ADVERSARIAL]: comprueba si la validación restringe dominio específico o solo protocolo HTTPS', () => {
      const basePayload = {
        fechaAudiencia: '2026-11-20',
        horaInicio: '09:00',
        horaFin: '09:30',
        plataforma: 'TEAMS' as const,
        responsable: 'Relator',
        enlaceVirtual: 'https://evil-phishing-site.attacker.com/steal-credentials'
      };

      const res = validarProgramacionAudiencia(basePayload);
      expect(res.valido).toBe(false);
      expect(res.errores.some((e: string) => e.includes('dominio institucional autorizado'))).toBe(true);
    });

    it('F02-MODAL-01: ciclo de vida completo del modal de Acta con validación de letrado y alegatos', () => {
      TestBed.configureTestingModule({
        imports: [TtaipInformeOralComponent]
      });

      const fixture = TestBed.createComponent(TtaipInformeOralComponent);
      const comp = fixture.componentInstance;

      const suspensiones: SuspensionPlazoTtaip[] = [{
        id: 101,
        expedienteTtaipId: 42,
        numeroExpediente: '00042-2026-JUS/TTAIP',
        motivoSuspension: 'INFORME_ORAL',
        solicitante: 'CIUDADANO',
        motivoDetalle: 'Informe oral programado',
        estadoSuspension: 'ACTIVA',
        observacion: JSON.stringify({
          __tipo: 'AUDIENCIA_INFORME_ORAL_V1',
          audiencia: { ...baseAud, estado: 'CONCEDIDA_PROGRAMADA', fechaAudiencia: '2026-11-15' }
        })
      }];

      fixture.componentRef.setInput('suspensiones', suspensiones);
      fixture.componentRef.setInput('puedeGestionar', true);
      fixture.detectChanges();

      expect(comp.estadoActual()).toBe('CONCEDIDA_PROGRAMADA');

      // 1. Abrir modal ACTA
      comp.abrirModal('ACTA');
      expect(comp.modalActivo()).toBe('ACTA');

      // 2. Validación de colegiatura cuando asiste recurrente con letrado
      comp.actaAsistioRecurrente = true;
      comp.actaLetradoNombre = 'Dr. Pérez';
      comp.actaColegiatura = ''; // Colegiatura vacía
      comp.actaResumenAlegatos = 'Alegatos orales de prueba extensos';
      comp.actaResponsable = 'Relator TTAIP';

      comp.ejecutarActa();
      expect(comp.modalError()).toContain('colegiatura');
      expect(comp.modalActivo()).toBe('ACTA'); // No se cerró por error

      // 3. Validación de resumen de alegatos corto (< 15 chars)
      comp.actaColegiatura = 'CAL 9999';
      comp.actaResumenAlegatos = 'Muy corto';
      comp.ejecutarActa();
      expect(comp.modalError()).toContain('15 caracteres');

      // 4. Formulario completo válido -> transición a REALIZADA y cierre
      let emitida: AudienciaInformeOral | undefined;
      comp.audienciaCambio.subscribe(a => { emitida = a; });

      comp.actaResumenAlegatos = 'Se sustentaron los agravios por indebida reserva legal de la información solicitada.';
      comp.ejecutarActa();

      expect(comp.modalError()).toBe('');
      expect(comp.modalActivo()).toBeNull();
      expect(comp.estadoActual()).toBe('REALIZADA');
      expect(emitida?.estado).toBe('REALIZADA');
      expect(emitida?.resumenAlegatos).toContain('indebida reserva legal');
    });

    it('F02-MODAL-02: modal de Inasistencia transiciona inmutablemente a NO_REALIZADA', () => {
      TestBed.configureTestingModule({ imports: [TtaipInformeOralComponent] });
      const fixture = TestBed.createComponent(TtaipInformeOralComponent);
      const comp = fixture.componentInstance;

      const suspensiones: SuspensionPlazoTtaip[] = [{
        id: 102,
        expedienteTtaipId: 42,
        numeroExpediente: '00042-2026-JUS/TTAIP',
        motivoSuspension: 'INFORME_ORAL',
        solicitante: 'CIUDADANO',
        motivoDetalle: 'Audiencia programada para inasistencia',
        estadoSuspension: 'ACTIVA',
        observacion: JSON.stringify({
          __tipo: 'AUDIENCIA_INFORME_ORAL_V1',
          audiencia: { ...baseAud, estado: 'CONCEDIDA_PROGRAMADA' }
        })
      }];

      fixture.componentRef.setInput('suspensiones', suspensiones);
      fixture.componentRef.setInput('puedeGestionar', true);
      fixture.detectChanges();

      comp.abrirModal('INASISTENCIA');
      comp.desistirPrescindirMotivo = 'Inasistencia injustificada de ambas partes convocadas';
      comp.desistirPrescindirResponsable = 'Relator TTAIP';
      comp.ejecutarInasistencia();

      expect(comp.estadoActual()).toBe('NO_REALIZADA');
      expect(comp.modalActivo()).toBeNull();
    });

    it('F02-MODAL-03: modal de Desistimiento valida motivo y cancela suspensión activa', () => {
      TestBed.configureTestingModule({ imports: [TtaipInformeOralComponent] });
      const fixture = TestBed.createComponent(TtaipInformeOralComponent);
      const comp = fixture.componentInstance;

      const suspensiones: SuspensionPlazoTtaip[] = [{
        id: 103,
        expedienteTtaipId: 42,
        numeroExpediente: '00042-2026-JUS/TTAIP',
        motivoSuspension: 'INFORME_ORAL',
        solicitante: 'CIUDADANO',
        motivoDetalle: 'Audiencia para desistir',
        estadoSuspension: 'ACTIVA',
        observacion: JSON.stringify({
          __tipo: 'AUDIENCIA_INFORME_ORAL_V1',
          audiencia: { ...baseAud, estado: 'SOLICITADA' }
        })
      }];

      fixture.componentRef.setInput('suspensiones', suspensiones);
      fixture.componentRef.setInput('puedeGestionar', true);
      fixture.detectChanges();

      // Motivo menor a 10 caracteres debe fallar
      comp.abrirModal('DESISTIR');
      comp.desistirPrescindirMotivo = 'Corto';
      comp.desistirPrescindirResponsable = 'Relator TTAIP';
      comp.ejecutarDesistimiento();
      expect(comp.modalError()).toContain('mínimo 10 caracteres');

      // Motivo válido transiciona y emite cancelación
      let cancelId: number | undefined;
      comp.cancelarSuspension.subscribe(id => { cancelId = id; });

      comp.desistirPrescindirMotivo = 'Desistimiento formal presentado por el ciudadano recurrente';
      comp.ejecutarDesistimiento();

      expect(comp.estadoActual()).toBe('DESISTIDA');
      expect(comp.modalActivo()).toBeNull();
      expect(cancelId).toBe(103);
    });

    it('F02-MODAL-04: modal de Prescindencia transiciona a PRESCINDIDA_DENEGADA', () => {
      TestBed.configureTestingModule({ imports: [TtaipInformeOralComponent] });
      const fixture = TestBed.createComponent(TtaipInformeOralComponent);
      const comp = fixture.componentInstance;

      const suspensiones: SuspensionPlazoTtaip[] = [{
        id: 104,
        expedienteTtaipId: 42,
        numeroExpediente: '00042-2026-JUS/TTAIP',
        motivoSuspension: 'INFORME_ORAL',
        solicitante: 'ENTIDAD_PUBLICA',
        motivoDetalle: 'Audiencia para prescindir',
        estadoSuspension: 'ACTIVA',
        observacion: JSON.stringify({
          __tipo: 'AUDIENCIA_INFORME_ORAL_V1',
          audiencia: { ...baseAud, estado: 'SOLICITADA', solicitante: 'ENTIDAD_PUBLICA' }
        })
      }];

      fixture.componentRef.setInput('suspensiones', suspensiones);
      fixture.componentRef.setInput('puedeGestionar', true);
      fixture.detectChanges();

      comp.abrirModal('PRESCINDIR');
      comp.desistirPrescindirMotivo = 'Tribunal cuenta con mérito documental suficiente';
      comp.desistirPrescindirResponsable = 'Presidente de Sala';
      comp.ejecutarPrescindencia();

      expect(comp.estadoActual()).toBe('PRESCINDIDA_DENEGADA');
      expect(comp.modalActivo()).toBeNull();
    });
  });

  // =========================================================================
  // 3. Defecto F-04: Límites y Apercibimiento Legal en Segunda Calificación
  // =========================================================================
  describe('3. Apercibimiento Legal de no_presentado en Segunda Calificación (F-04)', () => {
    let http: HttpTestingController;
    const api = environment.apiUrl;
    const expediente = '00021-2026-JUS/TTAIP';
    const aggregate = { id: 41, numeroExpediente: expediente };
    const session = { success: true, token: 'token-tribunal', usuarioId: 7, miembroId: 7, tipoUsuario: 'TTAIP' };
    const first = { id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'INADMISIBLE', observaciones: 'Requerimiento de subsanación', fechaResolucion: '2026-10-01' };
    const receiptUrl = api + '/ttaip/expedientes/41/requerimientos/71/subsanacion/recepcion';
    let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

    function createAppealWithSubsanacion(overrides: Record<string, unknown> = {}): Apelacion {
      return {
        id: 21,
        expediente,
        estado: 'EN_CALIFICACION_2',
        fechaApelacion: '2026-10-01',
        solicitudId: null,
        ciudadanoId: 10,
        ciudadanoNombre: 'Ciudadano Subsanante',
        entidadId: 20,
        entidadNombre: 'Entidad Requerida',
        tipoOrigen: 'EXTERNA',
        expedienteTtaip: aggregate,
        calificacionPrimera: 'INADMISIBLE',
        resolucionPrimeraCalificacion: first,
        calificacionSegunda: null,
        resolucionSegundaCalificacion: null,
        resoluciones: [first],
        documentos: [],
        documentosMetadata: [],
        plazoSubsanacion: {
          requerimientoId: 71,
          estado: 'VENCIDO',
          diasHabiles: 2,
          diasHabilesRestantes: -1,
          notificacionId: 61,
          fechaEficacia: '2026-10-22',
          fechaLimite: '2026-10-26'
        },
        ...overrides
      } as any;
    }

    beforeEach(() => {
      params = new BehaviorSubject(convertToParamMap({ expediente }));
      TestBed.configureTestingModule({
        imports: [TtaipSegundaCalificacionComponent],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: params.value }, paramMap: params.asObservable() } },
          {
            provide: AuthService,
            useValue: {
              cambiosSesion: signal(0),
              obtenerSesion: vi.fn().mockReturnValue(session)
            }
          }
        ]
      });
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      try {
        http.verify({ ignoreCancelled: true });
      } finally {
        TestBed.resetTestingModule();
      }
    });

    it('F04-APERCIBIMIENTO-01: cuando plazo está VENCIDO y recepción AUSENTE, habilita no_presentado e inhabilita admitido e improcedente', () => {
      const fixture = TestBed.createComponent(TtaipSegundaCalificacionComponent);
      fixture.detectChanges(); // Ejecuta ngOnInit() y genera la petición GET

      const reqAp = http.expectOne(api + '/apelaciones/expediente/' + expediente);
      reqAp.flush(createAppealWithSubsanacion({
        estado: 'EN_SUBSANACION',
        plazoSubsanacion: {
          requerimientoId: 71,
          estado: 'VENCIDO',
          diasHabiles: 2,
          diasHabilesRestantes: -1,
          notificacionId: 61,
          fechaEficacia: '2026-10-22',
          fechaLimite: '2026-10-26'
        }
      }));

      // Recepción ausente
      const reqRec = http.expectOne(receiptUrl);
      reqRec.flush({
        apelacionId: 21,
        expedienteTtaipId: 41,
        requerimientoId: 71,
        expediente,
        estado: 'AUSENTE',
        recepcionId: null,
        fechaRecepcion: null,
        fundamentosAdicionales: null,
        documentos: []
      });

      fixture.detectChanges();
      http.expectOne(api + '/ttaip/expedientes/41/documentos-oficiales/SEGUNDA_CALIFICACION').flush([]);
      const comp = fixture.componentInstance;

      // Verificación de apercibimiento
      expect(comp.esApercibimiento()).toBe(true);

      // 'no_presentado' DEBE estar habilitado
      expect(comp.isOptionDisabled('no_presentado')).toBe(false);

      // 'admitido' e 'improcedente' DEBEN estar deshabilitados por ministerio de ley
      expect(comp.isOptionDisabled('admitido')).toBe(true);
      expect(comp.isOptionDisabled('improcedente')).toBe(true);

      // Motivos legales explicados con precisión
      expect(comp.getOptionDisabledReason('admitido')).toContain('apercibimiento');
      expect(comp.getOptionDisabledReason('improcedente')).toContain('apercibimiento');

      // Seleccionar no_presentado permite canSubmit()
      comp.seleccionarDecision('no_presentado');
      comp.fundamentos = 'Operó el apercibimiento legal por no subsanar oportunamente los defectos advertidos.';
      expect(comp.canSubmit()).toBe(true);
    });

    it('F04-APERCIBIMIENTO-02: cuando existe subsanación RECIBIDA, inhabilita no_presentado y habilita admitido/improcedente', () => {
      const fixture = TestBed.createComponent(TtaipSegundaCalificacionComponent);
      fixture.detectChanges(); // Ejecuta ngOnInit()

      const reqAp = http.expectOne(api + '/apelaciones/expediente/' + expediente);
      reqAp.flush(createAppealWithSubsanacion({
        estado: 'EN_CALIFICACION_2',
        plazoSubsanacion: {
          requerimientoId: 71,
          estado: 'EN_CURSO',
          diasHabiles: 2,
          diasHabilesRestantes: 1,
          notificacionId: 61,
          fechaEficacia: '2026-10-22',
          fechaLimite: '2026-10-26'
        }
      }));

      // Recepción DISPONIBLE / RECIBIDA
      const reqRec = http.expectOne(receiptUrl);
      reqRec.flush({
        apelacionId: 21,
        expedienteTtaipId: 41,
        requerimientoId: 71,
        expediente,
        estado: 'RECIBIDA',
        recepcionId: 888,
        fechaRecepcion: '2026-10-23T10:00:00',
        fundamentosAdicionales: 'Subsanación debidamente ingresada con los descargos requeridos.',
        documentos: [{ id: 991, apelacionId: 21, tipoDocumento: 'SUBSANACION', nombreOriginal: 'subsanacion.pdf', estado: 'ACTIVO' }]
      });

      fixture.detectChanges();
      http.expectOne(api + '/ttaip/expedientes/41/documentos-oficiales/SEGUNDA_CALIFICACION').flush([]);
      const comp = fixture.componentInstance;

      // No es apercibimiento porque sí se recibió subsanación
      expect(comp.esApercibimiento()).toBe(false);

      // 'no_presentado' DEBE estar deshabilitado
      expect(comp.isOptionDisabled('no_presentado')).toBe(true);
      expect(comp.getOptionDisabledReason('no_presentado')).toContain('vencimiento acreditado');

      // 'admitido' e 'improcedente' DEBEN estar habilitados
      expect(comp.isOptionDisabled('admitido')).toBe(false);
      expect(comp.isOptionDisabled('improcedente')).toBe(false);

      // Seleccionar admitido
      comp.seleccionarDecision('admitido');
      comp.fundamentos = 'Se verifica la subsanación oportuna de los requisitos de admisibilidad.';
      expect(comp.canSubmit()).toBe(true);
    });
  });
});
