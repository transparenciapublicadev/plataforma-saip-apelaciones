import { test } from '@playwright/test';
import { compareDualTrack } from './helpers/setup';

test.describe('Portal Público — Visual Parity Suite (V01 - V07)', () => {
  test('V01 — Landing Page Hero & Stats', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V01-landing-hero',
      referencePath: '/?view=landing&no-splash=1',
      candidatePath: '/',
      prepareReference: async (p) => {
        await p.waitForSelector('h1:has-text("Toda la información del Estado")', { state: 'visible', timeout: 15000 });
        await p.waitForSelector('.eyebrow', { state: 'visible', timeout: 10000 });
        await p.waitForTimeout(600);
      },
      prepareCandidate: async (p) => {
        await p.waitForSelector('h1', { state: 'visible', timeout: 15000 });
        await p.waitForTimeout(600);
      },
    });
  });

  test('V02 — Consultar Estado (Initial Search Form)', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V02-consultar-initial',
      referencePath: '/?view=consultar&no-splash=1',
      candidatePath: '/consultar',
    });
  });

  test('V03 — Consultar Estado (Resultados & Milestones)', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V03-consultar-resultados',
      referencePath: '/?view=consultar&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/consultar?expediente=EXP-2026-0001',
    });
  });

  test('V04 — Login Público / Ciudadano', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V04-login-publico',
      referencePath: '/?view=login&no-splash=1',
      candidatePath: '/login',
    });
  });

  test('V05 — Registro de Administrado', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V05-registro-administrado',
      referencePath: '/?view=register&no-splash=1',
      candidatePath: '/registro',
    });
  });

  test('V06 — Centro de Ayuda & FAQ', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V06-centro-ayuda-faq',
      referencePath: '/?view=ayuda&no-splash=1',
      candidatePath: '/ayuda',
    });
  });

  test('V07 — Documentación & Info Pages', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V07-documentacion-info',
      referencePath: '/?view=documentacion&no-splash=1',
      candidatePath: '/documentacion',
    });
  });
});
