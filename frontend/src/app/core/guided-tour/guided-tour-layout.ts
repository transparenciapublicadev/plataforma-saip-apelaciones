export interface TourBox { top: number; left: number; width: number; height: number; }
export type TourSide = 'above' | 'below' | 'right' | 'left' | 'center';

// GuidedTour.tsx: padding around the target, target/card gap and viewport margin.
const PAD = 8, GAP = 20, EDGE = 16;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Placement only: synthetic rectangles test this algorithm, not rendered parity. */
export function tourLayout(rect: TourBox | null, vp: { w: number; h: number }, cardHeight: number, headerBottom: number) {
  const edge = Math.min(EDGE, Math.max(0, vp.w / 2), Math.max(0, vp.h / 2));
  const width = Math.min(340, Math.max(0, vp.w - edge * 2));
  const maxHeight = Math.max(0, vp.h - edge * 2);
  const height = Math.min(Math.max(0, cardHeight), maxHeight);
  const maxLeft = Math.max(edge, vp.w - width - edge);
  const maxTop = Math.max(edge, vp.h - height - edge);
  // Keep the header clear when space permits; a short viewport must still expose actions.
  const minTop = clamp(headerBottom, edge, maxTop);
  let spot: TourBox | null = null;
  const visibleTop = clamp(headerBottom, edge, Math.max(edge, vp.h - edge));
  if (rect && rect.width > 0 && rect.height > 0) {
    const top = clamp(rect.top - PAD, visibleTop, vp.h - edge);
    const bottom = clamp(rect.top + rect.height + PAD, visibleTop, vp.h - edge);
    const left = clamp(rect.left - PAD, edge, vp.w - edge);
    const right = clamp(rect.left + rect.width + PAD, edge, vp.w - edge);
    if (bottom > top && right > left) spot = { top, left, width: right - left, height: bottom - top };
  }
  let top = clamp((vp.h - height) / 2, minTop, maxTop);
  let left = clamp((vp.w - width) / 2, edge, maxLeft);
  let side: TourSide = 'center';
  if (spot) {
    const centeredLeft = clamp(spot.left + (spot.width - width) / 2, edge, maxLeft);
    const centeredTop = clamp(spot.top + (spot.height - height) / 2, minTop, maxTop);
    if (vp.h - spot.top - spot.height >= height + GAP + edge) {
      top = spot.top + spot.height + GAP; left = centeredLeft; side = 'below';
    } else if (spot.top - Math.max(edge, headerBottom) >= height + GAP) {
      top = spot.top - height - GAP; left = centeredLeft; side = 'above';
    } else if (vp.w - spot.left - spot.width >= width + GAP + edge) {
      top = centeredTop; left = spot.left + spot.width + GAP; side = 'right';
    } else if (spot.left >= width + GAP + edge) {
      top = centeredTop; left = spot.left - width - GAP; side = 'left';
    } else {
      top = maxTop; // Reference fallback: bottom, horizontally centered, without a misleading arrow.
    }
  }
  return { spot, placement: { top: clamp(top, minTop, maxTop), left: clamp(left, edge, maxLeft) }, side, width, maxHeight };
}

/** Reserve room for both the highlighted target and the measured card, unless the group is taller. */
export function tourScrollTop(rect: TourBox, scrollY: number, viewportHeight: number, headerBottom: number, cardHeight: number, align?: 'center' | 'start') {
  const usable = Math.max(0, viewportHeight - headerBottom - EDGE);
  const groupHeight = rect.height + PAD * 2 + GAP + cardHeight;
  const offset = align === 'start' || groupHeight > usable
    ? headerBottom + EDGE : headerBottom + Math.max(EDGE, (usable - groupHeight) / 2) + PAD;
  return Math.max(0, scrollY + rect.top - offset);
}
