export const PANEL_SCALE_OPTIONS = [85, 100, 115, 130, 150] as const;

export type PanelScalePercent = (typeof PANEL_SCALE_OPTIONS)[number];

export function normalizePanelScale(value: number): PanelScalePercent {
  if (!Number.isFinite(value)) {
    return 100;
  }

  if (value > 85 && value < 100) {
    return 100;
  }

  let closest: PanelScalePercent = PANEL_SCALE_OPTIONS[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const option of PANEL_SCALE_OPTIONS) {
    const distance = Math.abs(option - value);
    if (distance < closestDistance) {
      closest = option;
      closestDistance = distance;
    }
  }

  return closest;
}

export function getPanelScaleFactor(scale: number): number {
  return normalizePanelScale(scale) / 100;
}

export function scalePanelDimension(size: number, scale: number): number {
  return Math.round(size * getPanelScaleFactor(scale));
}

export function getPanelScaleSliderIndex(scale: number): number {
  const normalizedScale = normalizePanelScale(scale);
  return PANEL_SCALE_OPTIONS.indexOf(normalizedScale);
}

export function getPanelScaleFromSliderIndex(index: number): PanelScalePercent {
  const safeIndex = Math.min(
    PANEL_SCALE_OPTIONS.length - 1,
    Math.max(0, Math.round(index)),
  );

  return PANEL_SCALE_OPTIONS[safeIndex];
}
