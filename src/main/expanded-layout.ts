const EXPANDED_PANEL_MAX_HEIGHT = 680;
const EXPANDED_PANEL_MIN_HEIGHT = 220;

export function getExpandedWindowHeight({
  contentHeight,
  settingsOpen,
}: {
  contentHeight: number;
  settingsOpen: boolean;
}): number {
  if (settingsOpen) {
    return EXPANDED_PANEL_MAX_HEIGHT;
  }

  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    return EXPANDED_PANEL_MAX_HEIGHT;
  }

  return Math.min(
    EXPANDED_PANEL_MAX_HEIGHT,
    Math.max(EXPANDED_PANEL_MIN_HEIGHT, Math.round(contentHeight)),
  );
}
