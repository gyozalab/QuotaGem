import { scalePanelDimension } from "../shared/panel-scale";

const EXPANDED_BASE_SIZE = { width: 376, height: 500 };
const COMPACT_BASE_SIZE = { width: 416, height: 176 };

export function getPanelSize({
  mode,
  panelScale,
  expandedWindowHeight,
}: {
  mode: "expanded" | "compact";
  panelScale: number;
  expandedWindowHeight: number;
}): { width: number; height: number } {
  if (mode === "compact") {
    return {
      width: scalePanelDimension(COMPACT_BASE_SIZE.width, panelScale),
      height: scalePanelDimension(COMPACT_BASE_SIZE.height, panelScale),
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
  return { ...COMPACT_BASE_SIZE };
}
