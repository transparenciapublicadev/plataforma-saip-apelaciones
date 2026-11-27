import { describe, it, expect } from 'vitest';
import {
  EstadoInformeOral,
  TRANSICIONES_INFORME_ORAL,
  puedeTransicionarInformeOral,
  esEstadoTerminalInformeOral,
  validarProgramacionAudiencia,
  validarReprogramacionAudiencia,
  validarActaAudiencia,
  validarDesistirPrescindir,
  validarSolicitudInformeOral,
  programarAudiencia,
  reprogramarAudiencia,
  registrarRealizacionAudiencia,
  registrarInasistenciaAudiencia,
  desistirInformeOral,
  prescindirInformeOral,
  AudienciaInformeOral,
  extraerAudienciaDeSuspensiones,
  DOMINIOS_AUDIENCIA_REGEX
} from './ttaip-informe-oral.model';
import { SuspensionPlazoTtaip } from '../../models/resolucion.model';

describe('Modelo de Dominio — Informe Oral y Audiencias TTAIP (F-02)', () => {
  const baseAudiencia: AudienciaInformeOral = {
    id: 10,
    expedienteTtaipId: 41,
    numeroExpediente: '00051-2026-JUS/TTAIP',
    estado: 'SOLICITADA',
    solicitante: 'CIUDADANO',
    motivoSolicitud: 'Sustento oral de los agravios formulados',
    fechaSolicitud: '2026-10-05',
    diasSuspendidos: 3,
    responsable: 'Secretaría Técnica'
  };

  describe('1. Matriz de Transiciones de los 8 Estados Canónicos', () => {
    it('NO_SOLICITADA únicamente permite transicionar a SOLICITADA', () => {
      expect(puedeTransicionarInformeOral('NO_SOLICITADA', 'SOLICITADA')).toBe(true);
      expect(puedeTransicionarInformeOral('NO_SOLICITADA', 'CONCEDIDA_PROGRAMADA')).toBe(false);
      expect(puedeTransicionarInformeOral('NO_SOLICITADA', 'REALIZADA')).toBe(false);
    });

    it('SOLICITADA permite programar, desistir o prescindir', () => {
      expect(puedeTransicionarInformeOral('SOLICITADA', 'CONCEDIDA_PROGRAMADA')).toBe(true);
      expect(puedeTransicionarInformeOral('SOLICITADA', 'DESISTIDA')).toBe(true);
      expect(puedeTransicionarInformeOral('SOLICITADA', 'PRESCINDIDA_DENEGADA')).toBe(true);
      expect(puedeTransicionarInformeOral('SOLICITADA', 'REALIZADA')).toBe(false);
    });

    it('CONCEDIDA_PROGRAMADA permite realizar, declarar inasistencia, reprogramar o desistir', () => {
      expect(puedeTransicionarInformeOral('CONCEDIDA_PROGRAMADA', 'REALIZADA')).toBe(true);
      expect(puedeTransicionarInformeOral('CONCEDIDA_PROGRAMADA', 'NO_REALIZADA')).toBe(true);
      expect(puedeTransicionarInformeOral('CONCEDIDA_PROGRAMADA', 'REPROGRAMADA')).toBe(true);
      expect(puedeTransicionarInformeOral('CONCEDIDA_PROGRAMADA', 'DESISTIDA')).toBe(true);
      expect(puedeTransicionarInformeOral('CONCEDIDA_PROGRAMADA', 'SOLICITADA')).toBe(false);
    });

    it('REPROGRAMADA permite realizar, inasistencia, nueva reprogramación o desistir', () => {
      expect(puedeTransicionarInformeOral('REPROGRAMADA', 'REALIZADA')).toBe(true);
      expect(puedeTransicionarInformeOral('REPROGRAMADA', 'NO_REALIZADA')).toBe(true);
      expect(puedeTransicionarInformeOral('REPROGRAMADA', 'REPROGRAMADA')).toBe(true);
      expect(puedeTransicionarInformeOral('REPROGRAMADA', 'DESISTIDA')).toBe(true);
    });

    it('REALIZADA, NO_REALIZADA, DESISTIDA y PRESCINDIDA_DENEGADA son terminales sin transiciones de salida', () => {
      const terminales: EstadoInformeOral[] = ['REALIZADA', 'NO_REALIZADA', 'DESISTIDA', 'PRESCINDIDA_DENEGADA'];
      for (const t of terminales) {
        expect(esEstadoTerminalInformeOral(t)).toBe(true);
        expect(TRANSICIONES_INFORME_ORAL[t]).toHaveLength(0);
        expect(puedeTransicionarInformeOral(t, 'SOLICITADA')).toBe(false);
      }
    });
  });

  describe('2. Validaciones de Payloads y Reglas de Negocio', () => {
    it('valida solicitud con solicitante admitido y motivo sustancial', () => {
      expect(validarSolicitudInformeOral('CIUDADANO', 'Expresar agravios sobre reserva legal', 'Operador').valido).toBe(true);
      expect(validarSolicitudInformeOral('EXTERNO_INVALIDO', 'Motivo corto', '').valido).toBe(false);
    });

    it('valida programación de audiencia exigiendo fecha válida, horas coherentes y enlace HTTPS', () => {
      const ok = validarProgramacionAudiencia({
        fechaAudiencia: '2026-10-15',
        horaInicio: '10:00',
        horaFin: '10:30',
        plataforma: 'TEAMS',
        enlaceVirtual: 'https://teams.microsoft.com/l/meetup-join/12345',
        responsable: 'Relator TTAIP'
      });
      expect(ok.valido).toBe(true);

      const invertida = validarProgramacionAudiencia({
        fechaAudiencia: '2026-10-15',
        horaInicio: '11:00',
        horaFin: '10:00',
        plataforma: 'TEAMS',
        enlaceVirtual: 'http://inseguro.com',
        responsable: ''
      });
      expect(invertida.valido).toBe(false);
      expect(invertida.errores).toContain('La hora de fin debe ser posterior a la hora de inicio.');
      expect(invertida.errores.some(e => e.includes('https://'))).toBe(true);
    });

    it('rechaza enlaces virtuales no autorizados (HTTP o dominios externos/maliciosos)', () => {
      const baseValido = {
        fechaAudiencia: '2026-10-15',
        horaInicio: '10:00',
        horaFin: '10:30',
        plataforma: 'TEAMS' as const,
        responsable: 'Relator TTAIP'
      };

      const urlsNoAutorizadas = [
        'http://teams.microsoft.com/l/meetup-join/123',
        'https://sitio-inseguro.com/audiencia',
        'https://phishing.org/meet',
        'https://malicious-teams.com',
        'https://evil-phishing-site.attacker.com/steal-credentials',
        'https://not-meet.google.com.attacker.com/room'
      ];

      for (const url of urlsNoAutorizadas) {
        // En programación
        const resProg = validarProgramacionAudiencia({
          ...baseValido,
          enlaceVirtual: url
        });
        expect(resProg.valido).toBe(false);
        expect(resProg.errores).toContain(
          'El enlace virtual debe pertenecer a un dominio institucional autorizado (Teams o Google Meet) y comenzar con https://.'
        );

        // En reprogramación
        const resReprog = validarReprogramacionAudiencia({
          motivo: 'Motivo formal de reprogramación justificado',
          nuevaFechaAudiencia: '2026-10-22',
          nuevaHoraInicio: '10:00',
          nuevaHoraFin: '10:30',
          nuevoEnlaceVirtual: url,
          responsable: 'Relator TTAIP'
        });
        expect(resReprog.valido).toBe(false);
        expect(resReprog.errores).toContain(
          'El enlace virtual debe pertenecer a un dominio institucional autorizado (Teams o Google Meet) y comenzar con https://.'
        );
      }
    });

    it('acepta enlaces virtuales válidos de Microsoft Teams y Google Meet con HTTPS', () => {
      const urlsAutorizadas = [
        'https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz...',
        'https://teams.live.com/meet/987654321',
        'https://meet.google.com/abc-defg-hij',
        'https://subdominio.teams.microsoft.com/reunion'
      ];

      for (const url of urlsAutorizadas) {
        const resProg = validarProgramacionAudiencia({
          fechaAudiencia: '2026-10-15',
          horaInicio: '10:00',
          horaFin: '10:30',
          plataforma: 'TEAMS',
          enlaceVirtual: url,
          responsable: 'Relator TTAIP'
        });
        expect(resProg.valido).toBe(true);

        const resReprog = validarReprogramacionAudiencia({
          motivo: 'Reprogramación por motivos de fuerza mayor justificados',
          nuevaFechaAudiencia: '2026-10-22',
          nuevaHoraInicio: '10:00',
          nuevaHoraFin: '10:30',
          nuevoEnlaceVirtual: url,
          responsable: 'Relator TTAIP'
        });
        expect(resReprog.valido).toBe(true);
      }
    });

    it('DOMINIOS_AUDIENCIA_REGEX valida patrones de dominios autorizados de forma aislada', () => {
      expect(DOMINIOS_AUDIENCIA_REGEX.test('https://teams.microsoft.com/l/meetup-join/123')).toBe(true);
      expect(DOMINIOS_AUDIENCIA_REGEX.test('https://teams.live.com/meet/456')).toBe(true);
      expect(DOMINIOS_AUDIENCIA_REGEX.test('https://meet.google.com/abc-defg-hij')).toBe(true);
      expect(DOMINIOS_AUDIENCIA_REGEX.test('http://teams.microsoft.com/meet')).toBe(false);
      expect(DOMINIOS_AUDIENCIA_REGEX.test('https://sitio-inseguro.com/audiencia')).toBe(false);
      expect(DOMINIOS_AUDIENCIA_REGEX.test('https://malicious-teams.com')).toBe(false);
    });

    it('valida acta de realización exigiendo resumen de alegatos y colegiatura si concurre letrado', () => {
      const actaValida = validarActaAudiencia({
        asistioRecurrente: true,
        letradoRecurrenteNombre: 'Dr. Mario Gómez',
        colegiaturaLetrado: 'CAL 45678',
        asistioEntidad: true,
        resumenAlegatos: 'Se expusieron los agravios referidos a la inaplicabilidad de la excepción de seguridad nacional.',
        responsable: 'Secretario de Sala'
      });
      expect(actaValida.valido).toBe(true);

      const actaSinColegiatura = validarActaAudiencia({
        asistioRecurrente: true,
        letradoRecurrenteNombre: 'Dr. Mario Gómez',
        colegiaturaLetrado: '',
        asistioEntidad: true,
        resumenAlegatos: 'Breve',
        responsable: ''
      });
      expect(actaSinColegiatura.valido).toBe(false);
      expect(actaSinColegiatura.errores.some(e => e.includes('colegiatura'))).toBe(true);
      expect(actaSinColegiatura.errores.some(e => e.includes('15 caracteres'))).toBe(true);
    });
  });

  describe('3. Métodos Inmutables de Transición de Audiencia', () => {
    it('programarAudiencia actualiza estado a CONCEDIDA_PROGRAMADA y registra trazabilidad', () => {
      const prog = programarAudiencia(baseAudiencia, {
        fechaAudiencia: '2026-10-20',
        horaInicio: '09:30',
        horaFin: '10:00',
        plataforma: 'MEET',
        enlaceVirtual: 'https://meet.google.com/abc-defg-hij',
        duracionMinutosParte: 15,
        responsable: 'Operador Sala'
      });
      expect(prog.estado).toBe('CONCEDIDA_PROGRAMADA');
      expect(prog.fechaAudiencia).toBe('2026-10-20');
      expect(prog.plataforma).toBe('MEET');
      expect(prog.trazabilidad).toContain('Audiencia programada');
    });

    it('reprogramarAudiencia conserva la fecha anterior y actualiza a REPROGRAMADA', () => {
      const prog = programarAudiencia(baseAudiencia, {
        fechaAudiencia: '2026-10-20',
        horaInicio: '09:30',
        horaFin: '10:00',
        plataforma: 'MEET',
        enlaceVirtual: 'https://meet.google.com/abc-defg-hij',
        responsable: 'Operador Sala'
      });
      const reprog = reprogramarAudiencia(prog, {
        motivo: 'Incompatibilidad de agenda de los vocales del colegiado',
        nuevaFechaAudiencia: '2026-10-25',
        nuevaHoraInicio: '11:00',
        nuevaHoraFin: '11:30',
        nuevoEnlaceVirtual: 'https://meet.google.com/nuevo-link',
        responsable: 'Relator'
      });
      expect(reprog.estado).toBe('REPROGRAMADA');
      expect(reprog.fechaReprogramadaAnterior).toBe('2026-10-20');
      expect(reprog.fechaAudiencia).toBe('2026-10-25');
      expect(reprog.motivoReprogramacion).toContain('Incompatibilidad');
    });

    it('registrarRealizacionAudiencia pasa a REALIZADA y registra fecha de realización', () => {
      const prog = programarAudiencia(baseAudiencia, {
        fechaAudiencia: '2026-10-20',
        horaInicio: '09:30',
        horaFin: '10:00',
        plataforma: 'MEET',
        enlaceVirtual: 'https://meet.google.com/abc-defg-hij',
        responsable: 'Operador Sala'
      });
      const realizada = registrarRealizacionAudiencia(prog, {
        asistioRecurrente: true,
        letradoRecurrenteNombre: 'Dra. Silva',
        colegiaturaLetrado: 'CAL 8888',
        asistioEntidad: true,
        representanteEntidadNombre: 'Procurador MINJUS',
        resumenAlegatos: 'Alegatos orales de ambas partes sobre el test de proporcionalidad.',
        responsable: 'Secretario'
      });
      expect(realizada.estado).toBe('REALIZADA');
      expect(realizada.resumenAlegatos).toContain('test de proporcionalidad');
      expect(realizada.trazabilidad).toContain('al voto');
    });
  });

  describe('4. Puente con Suspensión Plazo TTAIP', () => {
    it('extrae audiencia inicial SOLICITADA a partir de suspensión cruda de backend', () => {
      const suspensiones: SuspensionPlazoTtaip[] = [{
        id: 77,
        expedienteTtaipId: 41,
        numeroExpediente: '00051-2026-JUS/TTAIP',
        motivoSuspension: 'INFORME_ORAL',
        solicitante: 'CIUDADANO',
        motivoDetalle: 'Informe oral solicitado para exponer doctrina',
        fechaSolicitud: '2026-10-02',
        fechaInicioSuspension: '2026-10-02',
        diasSuspendidos: 3,
        estadoSuspension: 'ACTIVA',
        responsable: 'Secretaría'
      }];
      const aud = extraerAudienciaDeSuspensiones(suspensiones, 41, '00051-2026-JUS/TTAIP');
      expect(aud).not.toBeNull();
      expect(aud?.estado).toBe('SOLICITADA');
      expect(aud?.solicitante).toBe('CIUDADANO');
      expect(aud?.suspensionId).toBe(77);
    });

    it('devuelve null si no existe suspensión de tipo INFORME_ORAL', () => {
      const suspensiones: SuspensionPlazoTtaip[] = [{
        id: 78,
        motivoSuspension: 'INFORMACION_COMPLEMENTARIA',
        estadoSuspension: 'ACTIVA'
      }];
      expect(extraerAudienciaDeSuspensiones(suspensiones, 41, '00051-2026-JUS/TTAIP')).toBeNull();
    });
  });
});
