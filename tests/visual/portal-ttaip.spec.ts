import { test } from '@playwright/test';
import { compareDualTrack } from './helpers/setup';

test.describe('Portal Tribunal TTAIP — Visual Parity Suite (V21 - V26)', () => {
  test('V21 — Login Tribunal TTAIP', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V21-ttaip-login',
      referencePath: '/?view=access-ttaip&no-splash=1',
      candidatePath: '/acceso-ttaip',
    });
  });

  test('V22 — Bandeja de Apelaciones', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V22-ttaip-bandeja-apelaciones',
      referencePath: '/?view=ttaip-dashboard&user=ttaip&no-splash=1',
      candidatePath: '/ttaip',
      role: 'TTAIP',
    });
  });

  test('V23 — Calificación de Admisibilidad (1ra)', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V23-ttaip-calificar-primera',
      referencePath: '/?view=resolution&user=ttaip&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/ttaip/calificar/EXP-2026-0001',
      role: 'TTAIP',
    });
  });

  test('V24 — Segunda Calificación', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V24-ttaip-segunda-calificacion',
      referencePath: '/?view=second-qualification&user=ttaip&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/ttaip/segunda-calificacion/EXP-2026-0001',
      role: 'TTAIP',
    });
  });

  test('V25 — Votación & Resolución Final', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V25-ttaip-votacion-resolucion',
      referencePath: '/?view=final-resolution&user=ttaip&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/ttaip/resolver/EXP-2026-0001',
      role: 'TTAIP',
    });
  });

  test('V26 — Detalle Expediente & Resoluciones', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V26-ttaip-detalle-expediente',
      referencePath: '/?view=resolution-detail&user=ttaip&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/ttaip/apelacion/EXP-2026-0001',
      role: 'TTAIP',
    });
  });
});
