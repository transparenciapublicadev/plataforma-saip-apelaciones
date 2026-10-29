import { describe, expect, it } from 'vitest';
import { TourBox, tourLayout, tourScrollTop } from './guided-tour-layout';

describe('V6: colocación determinista (rectángulos simulados, no apariencia)', () => {
  it.each([
    [{ top: 365, left: 500, width: 150, height: 100 }, 'below'],
    [{ top: 600, left: 500, width: 150, height: 40 }, 'above'],
    [{ top: 100, left: 20, width: 100, height: 600 }, 'right'],
    [{ top: 100, left: 1150, width: 100, height: 600 }, 'left'],
    [{ top: 0, left: 0, width: 1280, height: 720 }, 'center'],
  ] as const)('elige un lado con espacio para %j', (rect, side) => {
    const result = tourLayout(rect, { w: 1280, h: 720 }, 210, 100);
    expect(result.side).toBe(side);
    expect(result.placement.top).toBeGreaterThanOrEqual(100);
    expect(result.placement.top + 210).toBeLessThanOrEqual(720);
    if (side === 'below') expect(result.placement.top).toBeGreaterThan(result.spot!.top + result.spot!.height);
  });
  for (const vp of [{ w: 1280, h: 720 }, { w: 390, h: 720 }, { w: 320, h: 160 }]) {
    it.each([70, 210, 900])(`mantiene acciones alcanzables en ${vp.w}×${vp.h}, tarjeta %s`, height => {
      const positions: (TourBox | null)[] = [null, { top: 110, left: 0, width: 100, height: 50 },
        { top: 650, left: vp.w - 80, width: 80, height: 70 }, { top: -200, left: -30, width: vp.w + 100, height: 1500 }];
      for (const rect of positions) {
        const result = tourLayout(rect, vp, height, 100);
        expect(result.placement.left).toBeGreaterThanOrEqual(0);
        expect(result.placement.left + result.width).toBeLessThanOrEqual(vp.w);
        expect(result.placement.top).toBeGreaterThanOrEqual(0);
        expect(result.placement.top + Math.min(height, result.maxHeight)).toBeLessThanOrEqual(vp.h);
      }
    });
  }
  it.each([{ top: -300, left: 0, width: 40, height: 50 }, { top: 900, left: 10, width: 100, height: 50 },
    { top: 200, left: 1400, width: 100, height: 50 }, { top: 100, left: 20, width: 0, height: 0 }])(
    'no crea un foco ficticio si %j no intersecta la zona visible', rect => {
      expect(tourLayout(rect, { w: 1280, h: 720 }, 210, 100).spot).toBeNull();
    });
  it('centra el grupo cuando cabe y respeta start para un bloque alto sin reglas por selector', () => {
    const rect = { top: 400, left: 30, width: 200, height: 80 };
    const center = tourScrollTop(rect, 800, 720, 100, 210);
    const start = tourScrollTop(rect, 800, 720, 100, 210, 'start');
    expect(center).toBeLessThan(start);
    const relativeTop = 800 + rect.top - center;
    expect(relativeTop).toBeGreaterThanOrEqual(100);
    expect(relativeTop + rect.height + 210).toBeLessThan(720);
    expect(tourScrollTop({ ...rect, height: 900 }, 800, 720, 100, 210)).toBe(start);
  });
});
