import { getExpandedBaseSize } from "./panel-layout";

const EXPANDED_PANEL_MAX_HEIGHT = 850;
const EXPANDED_PANEL_MIN_HEIGHT = getExpandedBaseSize().height;

export function getExpandedWindowHeight({
  contentHeight,
  settingsOpen: _settingsOpen,
}: {
  contentHeight: number;
  settingsOpen: boolean;
}): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    return EXPANDED_PANEL_MAX_HEIGHT;
  }

  return Math.min(
    EXPANDED_PANEL_MAX_HEIGHT,
    Math.max(EXPANDED_PANEL_MIN_HEIGHT, Math.round(contentHeight)),
  );
}
