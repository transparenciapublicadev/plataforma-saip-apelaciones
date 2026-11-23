import { describe, expect, it } from 'vitest';
import { avisosDelActor } from './avisos-bandeja';
import { PanelApelacion, PanelSolicitud } from '../models/panel-query.model';

const solicitud = (parcial: Partial<PanelSolicitud> & Pick<PanelSolicitud, 'id' | 'estado'>): PanelSolicitud =>
  ({ expediente: 'SAIP-TEST-1', ciudadanoId: 1, entidadId: 1, ...parcial });

describe('avisos del actor', () => {
  it('prioriza la precisión del administrado y no inventa un plazo', () => {
    const avisos = avisosDelActor('CIUDADANO', [
      solicitud({ id: 1, estado: 'RECEPCIONADA', entidadNombre: 'Entidad sintética' }),
      solicitud({
        id: 2, expediente: 'SAIP-TEST-2', estado: 'PENDIENTE_INFORMACION', entidadNombre: 'Entidad sintética',
        observaciones: [{ estado: 'PENDIENTE_SUBSANACION' }], fechaLimite: '2026-11-25',
      }),
    ], []);
    expect(avisos[0]).toMatchObject({
      id: 'saip:SAIP-TEST-2:precision',
      titulo: 'Precisión pendiente',
      ruta: '/ciudadano/precision/SAIP-TEST-2',
      urgente: true,
    });
    expect(avisos[0].detalle).toContain('25/11/2026');
    expect(avisos[0].detalle).not.toMatch(/2 días|hábil/);
    expect(avisos[1].titulo).toBe('Solicitud en atención');
  });

  it('avisa al funcionario que la precisión llegó y al tribunal que debe calificar', () => {
    const funcionario = avisosDelActor('FUNCIONARIO', [
      solicitud({
        id: 3, estado: 'EN_REVISION', ciudadanoNombre: 'Persona sintética',
        observaciones: [{ estado: 'SUBSANADA' }],
      }),
    ], [{ id: 8, expediente: '00008-2026-JUS/TTAIP', estado: 'PENDIENTE_ELEVACION' }]);
    expect(funcionario.map(aviso => aviso.ruta)).toEqual([
      '/funcionario/solicitud/SAIP-TEST-1',
      '/funcionario/apelaciones/00008-2026-JUS%2FTTAIP',
    ]);

    const tribunal = avisosDelActor('TTAIP', [], [
      { id: 9, expediente: '00009-2026-JUS/TTAIP', estado: 'EN_CALIFICACION_1' } as PanelApelacion,
      { id: 11, expediente: '00011-2026-JUS/TTAIP', estado: 'NOTIFICACION_SEGUNDA_CALIFICACION' } as PanelApelacion,
      { id: 10, expediente: '', estado: 'EN_RESOLUCION' } as PanelApelacion,
    ]);
    expect(tribunal.map(aviso => aviso.segmentos[0])).toEqual(['/ttaip/calificar', '/ttaip/resolver']);
  });

  it('conserva como máximo doce avisos urgentes', () => {
    const solicitudes = Array.from({ length: 15 }, (_, indice) => solicitud({
      id: indice + 1, expediente: `SAIP-TEST-${indice + 1}`, estado: 'VENCIDA',
    }));
    expect(avisosDelActor('CIUDADANO', solicitudes, [])).toHaveLength(12);
  });

  it('no repite la misma apelación', () => {
    const apelacion = { id: 1, expediente: '00001-2026-JUS/TTAIP', estado: 'EN_SUBSANACION' as const };
    const avisos = avisosDelActor('CIUDADANO', [], [apelacion, apelacion]);
    expect(avisos.map(aviso => aviso.id)).toEqual(['apel:00001-2026-JUS/TTAIP:subsanar']);
  });
});
