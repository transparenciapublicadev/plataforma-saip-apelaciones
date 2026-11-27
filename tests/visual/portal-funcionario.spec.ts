import { test } from '@playwright/test';
import { compareDualTrack } from './helpers/setup';

test.describe('Portal Funcionario de Entidad — Visual Parity Suite (V15 - V20)', () => {
  test('V15 — Login Funcionario', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V15-funcionario-login',
      referencePath: '/?view=access-funcionario&no-splash=1',
      candidatePath: '/acceso-funcionario',
    });
  });

  test('V16 — Bandeja Principal (KPIs & Tabs)', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V16-funcionario-bandeja-kpis',
      referencePath: '/?view=entity-dashboard&user=funcionario&no-splash=1',
      candidatePath: '/funcionario',
      role: 'FUNCIONARIO',
    });
  });

  test('V17 — Detalle Solicitud Funcionario', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V17-funcionario-solicitud-detalle',
      referencePath: '/?view=entity-detalle&user=funcionario&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/funcionario/solicitud/EXP-2026-0001',
      role: 'FUNCIONARIO',
    });
  });

  test('V18 — Modal Solicitar Prórroga', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V18-funcionario-modal-prorroga',
      referencePath: '/?view=entity-response&user=funcionario&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/funcionario/responder/EXP-2026-0001',
      role: 'FUNCIONARIO',
      maxDiffPixelRatio: 0.20,
      prepareReference: async (p) => {
        await p.locator('button:has-text("Ampliar el plazo")').click();
        await p.waitForSelector('textarea#entity-campo-13, textarea[placeholder*="Justifique"]', { state: 'visible' });
        await p.locator('textarea#entity-campo-13, textarea[placeholder*="Justifique"]').fill('Búsqueda exhaustiva de información en archivo central desconcentrado.');
        await p.locator('button:has-text("Comunicar ampliación")').click();
        await p.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
        await p.waitForTimeout(300);
      },
      prepareCandidate: async (p) => {
        await p.locator('button:has-text("Ampliar el plazo")').click();
        await p.waitForSelector('textarea[placeholder*="Justifique"]', { state: 'visible' });
        await p.locator('textarea[placeholder*="Justifique"]').fill('Búsqueda exhaustiva de información en archivo central desconcentrado.');
        await p.locator('button:has-text("Comunicar ampliación")').click();
        await p.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
        await p.waitForTimeout(300);
      },
    });
  });

  test('V19 — Responder Solicitud (Form)', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V19-funcionario-responder-form',
      referencePath: '/?view=entity-response&user=funcionario&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/funcionario/responder/EXP-2026-0001',
      role: 'FUNCIONARIO',
    });
  });

  test('V20 — Reportes Institucionales ANTAIP', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V20-funcionario-reportes',
      referencePath: '/?view=entity-reportes&user=funcionario&no-splash=1',
      candidatePath: '/funcionario/reportes',
      role: 'FUNCIONARIO',
    });
  });
});
