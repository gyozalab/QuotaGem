import { scalePanelDimension } from "../shared/panel-scale";

const EXPANDED_BASE_SIZE = { width: 376, height: 500 };
const COMPACT_BASE_SIZES = {
  1: { width: 132, height: 150 },
  2: { width: 212, height: 150 },
  3: { width: 296, height: 150 },
} as const;

export function getPanelSize({
  mode,
  panelScale,
  expandedWindowHeight,
  compactProviderCount = 2,
}: {
  mode: "expanded" | "compact";
  panelScale: number;
  expandedWindowHeight: number;
  compactProviderCount?: number;
}): { width: number; height: number } {
  if (mode === "compact") {
    const count = Math.min(Math.max(Math.round(compactProviderCount), 1), 3) as
      | 1
      | 2
      | 3;
    const baseSize = COMPACT_BASE_SIZES[count];
    return {
      width: scalePanelDimension(baseSize.width, panelScale),
      height: scalePanelDimension(baseSize.height, panelScale),
    };
  }

  return {
    width: scalePanelDimension(EXPANDED_BASE_SIZE.width, panelScale),
    height: scalePanelDimension(expandedWindowHeight, panelScale),
  };
}

export function getExpandedBaseSize(): { width: number; height: number } {
  return { ...EXPANDED_BASE_SIZE };
}

export function getCompactBaseSize(): { width: number; height: number } {
  return { ...COMPACT_BASE_SIZES[2] };
}
