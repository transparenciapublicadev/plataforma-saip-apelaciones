import { describe, it, expect } from 'vitest';
import {
  recipientsForResolution,
  resultadoLabel,
  cedulaVariantForStage,
  numeroEnLetras,
  buildCtx,
  buildDocWord,
  buildResolucionBlob,
  resolucionArticulos,
} from './official-docs.util';

describe('official-docs.util', () => {
  describe('recipientsForResolution (DISC-11)', () => {
    it('debería suprimir la cédula de la entidad en INADMISIBLE (primera calificación)', () => {
      const recipients = recipientsForResolution('primera', 'inadmisible');
      expect(recipients).toEqual(['recurrente']);
      expect(recipients).not.toContain('entidad');
    });

    it('debería incluir ambas partes en ADMISIBLE (primera calificación)', () => {
      const recipients = recipientsForResolution('primera', 'admisible');
      expect(recipients).toEqual(['recurrente', 'entidad']);
    });

    it('debería incluir ambas partes en resolución FINAL (fundado)', () => {
      const recipients = recipientsForResolution('final', 'fundado');
      expect(recipients).toEqual(['recurrente', 'entidad']);
    });

    it('debería incluir ambas partes en IMPROCEDENTE', () => {
      const recipients = recipientsForResolution('primera', 'improcedente');
      expect(recipients).toEqual(['recurrente', 'entidad']);
    });
  });

  describe('resultadoLabel', () => {
    it('debería retornar ADMITIDO A TRÁMITE en primera calificación admisible', () => {
      expect(resultadoLabel('primera', 'admisible')).toBe('ADMITIDO A TRÁMITE');
    });

    it('debería retornar INADMISIBLE en primera calificación', () => {
      expect(resultadoLabel('primera', 'inadmisible')).toBe('INADMISIBLE');
    });

    it('debería retornar TENER POR NO PRESENTADO en segunda calificación cuando no subsanó (DISC-10)', () => {
      expect(resultadoLabel('segunda', 'no_presentado')).toBe('TENER POR NO PRESENTADO');
    });

    it('debería retornar NULIDAD DEL ACTO en resolución final (DISC-08)', () => {
      expect(resultadoLabel('final', 'nulidad_del_acto')).toBe('NULIDAD DEL ACTO');
    });

    it('debería retornar FUNDADO EN PARTE', () => {
      expect(resultadoLabel('final', 'fundado_en_parte')).toBe('FUNDADO EN PARTE');
    });
  });

  describe('cedulaVariantForStage', () => {
    it('debería ser admision para primera calificación admisible', () => {
      expect(cedulaVariantForStage('primera', 'admisible')).toBe('admision');
    });

    it('debería ser fundado para resolución final fundada', () => {
      expect(cedulaVariantForStage('final', 'fundado')).toBe('fundado');
    });

    it('debería ser otro para inadmisible o improcedente', () => {
      expect(cedulaVariantForStage('primera', 'inadmisible')).toBe('otro');
    });
  });

  describe('numeroEnLetras', () => {
    it('debería convertir números jurídicos correctamente', () => {
      expect(numeroEnLetras(1)).toBe('un');
      expect(numeroEnLetras(2)).toBe('dos');
      expect(numeroEnLetras(12)).toBe('doce');
      expect(numeroEnLetras(25)).toBe('veinticinco');
    });
  });

  describe('buildDocWord', () => {
    it('debería generar archivo Word válido (.doc con MIME msword) para resolución', () => {
      const { blob, filename } = buildDocWord('resolucion', 'primera', 'admisible', {
        expediente: '00024-2026-JUS/TTAIP',
        recurrente: 'JUAN PÉREZ',
        entidad: 'MUNICIPALIDAD DE LIMA'
      });
      expect(blob.type).toBe('application/msword');
      expect(filename).toMatch(/^Borrador_Resolucion_.*\.doc$/);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('debería generar archivo Word válido para cédula de administrado', () => {
      const { blob, filename } = buildDocWord('cedula', 'primera', 'admisible', {
        expediente: '00024-2026-JUS/TTAIP',
        recurrente: 'JUAN PÉREZ'
      }, 'recurrente');
      expect(blob.type).toBe('application/msword');
      expect(filename).toContain('Recurrente');
    });
  });

  describe('buildResolucionBlob', () => {
    it('debería generar un blob PDF válido con el nombre adecuado', () => {
      const { blob, filename } = buildResolucionBlob('final', 'fundado', {
        expediente: '00024-2026-JUS/TTAIP',
        recurrente: 'MARÍA LÓPEZ',
        entidad: 'MINSA'
      });
      expect(blob.type).toBe('application/pdf');
      expect(filename).toMatch(/^Borrador_Resolucion_.*\.pdf$/);
      expect(blob.size).toBeGreaterThan(100);
    });
  });

  describe('resolucionArticulos', () => {
    it('debería incluir apercibimiento de tener por no presentado en INADMISIBLE', () => {
      const ctx = buildCtx({ recurrente: 'JUAN PÉREZ' }, 'primera');
      const articulos = resolucionArticulos('primera', 'inadmisible', ctx);
      expect(articulos.some(a => a.includes('dos (2) días hábiles') && a.includes('no presentado'))).toBe(true);
    });

    it('debería requerir descargos en siete días hábiles en ADMISIBLE', () => {
      const ctx = buildCtx({ recurrente: 'JUAN PÉREZ', entidad: 'MINEDU' }, 'primera');
      const articulos = resolucionArticulos('primera', 'admisible', ctx);
      expect(articulos.some(a => a.includes('siete (7) días hábiles') && a.includes('descargos'))).toBe(true);
    });
  });
});
