import { test } from '@playwright/test';
import { compareDualTrack } from './helpers/setup';

test.describe('Portal Administración — Visual Parity Suite (V27 - V28)', () => {
  test('V27 — Login Administrador', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V27-admin-login',
      referencePath: '/?view=access-admin&no-splash=1',
      candidatePath: '/acceso-admin',
    });
  });

  test('V28 — Dashboard Admin (Plazos y Calendario)', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V28-admin-dashboard-plazos',
      referencePath: '/?view=admin-dashboard&user=admin&no-splash=1',
      candidatePath: '/admin',
      role: 'ADMINISTRADOR',
    });
  });
});
