import { test } from '@playwright/test';
import { compareDualTrack } from './helpers/setup';

test.describe('Portal Ciudadano — Visual Parity Suite (V08 - V14)', () => {
  test('V08 — Dashboard / Mis Solicitudes', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V08-ciudadano-dashboard',
      referencePath: '/?view=dashboard&user=ciudadano&no-splash=1',
      candidatePath: '/ciudadano',
      role: 'CIUDADANO',
    });
  });

  test('V09 — Nueva Solicitud SAIP (Wizard)', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V09-ciudadano-nueva-saip',
      referencePath: '/?view=saip-form&user=ciudadano&no-splash=1',
      candidatePath: '/ciudadano/nueva-saip',
      role: 'CIUDADANO',
    });
  });

  test('V10 — Modal Éxito Radicación SAIP', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V10-ciudadano-modal-exito',
      referencePath: '/?view=saip-form&user=ciudadano&no-splash=1',
      candidatePath: '/ciudadano/nueva-saip',
      role: 'CIUDADANO',
      maxDiffPixelRatio: 0.20,
      prepareReference: async (p) => {
        // Step 1: Entidad, Asunto, Descripcion
        await p.locator('button[aria-labelledby="saip-entidad-label"]').click();
        await p.locator('[role="option"]:has-text("OSINERGMIN")').click();
        await p.locator('#saip-asunto').fill('Copia de contratos de concesión eléctrica 2024-2025');
        await p.locator('#saip-descripcion').fill('Solicito copia en formato digital de los contratos y adendas suscritos con empresas distribuidoras.');
        await p.locator('button:has-text("Continuar")').click();

        // Step 2: Entrega y notificacion
        await p.locator('div[role="group"][aria-label="Modalidad de entrega"] label:has-text("Correo electrónico")').click();
        await p.locator('div[role="radiogroup"][aria-label="Medio de notificación"] button:has-text("Correo electrónico")').click();
        await p.locator('input[type="checkbox"]').last().check({ force: true });
        await p.locator('button:has-text("Continuar")').click();

        // Step 3: Archivos
        await p.locator('button:has-text("Continuar")').click();

        // Step 4: Revision & envio
        await p.locator('button:has-text("Presentar solicitud")').click();
        await p.waitForSelector('[role="dialog"]', { state: 'visible' });
        await p.locator('[role="dialog"] button:has-text("Confirmar y enviar")').click();
        await p.waitForSelector('[role="dialog"]:has-text("Ir a mi panel")', { state: 'visible', timeout: 10000 });
        await p.waitForTimeout(300);
      },
      prepareCandidate: async (p) => {
        // Step 1
        await p.locator('select#saip-entidad').selectOption({ index: 1 });
        await p.locator('#saip-asunto').fill('Copia de contratos de concesión eléctrica 2024-2025');
        await p.locator('#saip-descripcion').fill('Solicito copia en formato digital de los contratos y adendas suscritos con empresas distribuidoras.');
        await p.locator('button:has-text("Continuar")').click();

        // Step 2
        await p.locator('label.saip-option:has-text("Formato digital")').click();
        await p.locator('label.saip-option:has-text("Al correo registrado de la cuenta")').click();
        await p.locator('input[name="aceptaCorreo"]').check({ force: true });
        await p.locator('button:has-text("Continuar")').click();

        // Step 3
        await p.locator('button:has-text("Continuar")').click();

        // Step 4
        await p.locator('label:has-text("Acepto expresamente")').click();
        await p.locator('label:has-text("Declaro que la información")').click();
        await p.locator('button:has-text("Presentar solicitud")').click();
        await p.waitForSelector('[role="dialog"]', { state: 'visible' });
        await p.locator('[role="dialog"] button:has-text("Confirmar y enviar")').click();
        await p.waitForSelector('[role="dialog"]:has-text("Ir a mi panel")', { state: 'visible', timeout: 10000 });
        await p.waitForTimeout(300);
      },
    });
  });

  test('V11 — Detalle de Solicitud', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V11-ciudadano-solicitud-detalle',
      referencePath: '/?view=detalle&user=ciudadano&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/ciudadano/solicitud/EXP-2026-0001',
      role: 'CIUDADANO',
    });
  });

  test('V12 — Formulario Nueva Apelación', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V12-ciudadano-nueva-apelacion',
      referencePath: '/?view=appeal-form&user=ciudadano&no-splash=1',
      candidatePath: '/ciudadano/nueva-apelacion',
      role: 'CIUDADANO',
    });
  });

  test('V13 — Formulario Subsanación', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V13-ciudadano-subsanacion',
      referencePath: '/?view=subsanation-form&user=ciudadano&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/ciudadano/subsanacion/EXP-2026-0001',
      role: 'CIUDADANO',
    });
  });

  test('V14 — Formulario Aclaración/Precisión', async ({ page }) => {
    await compareDualTrack(page, {
      viewId: 'V14-ciudadano-precision',
      referencePath: '/?view=precision-form&user=ciudadano&exp=EXP-2026-0001&no-splash=1',
      candidatePath: '/ciudadano/precision/EXP-2026-0001',
      role: 'CIUDADANO',
    });
  });
});
