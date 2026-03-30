/// <reference types="vite/client" />

import type { UsageDashboardState } from "../shared/dashboard";

declare global {
  interface Window {
    trayUsageWidget: {
      fetchUsageState: () => Promise<UsageDashboardState>;
      syncExpandedLayout: (layout: {
        contentHeight: number;
        settingsOpen: boolean;
      }) => Promise<void>;
      openExpandedPanel: () => Promise<void>;
      openCompactPanel: () => Promise<void>;
      closePanels: () => Promise<void>;
      connectClaude: () => Promise<UsageDashboardState>;
      saveSettings: (
        preferences: UsageDashboardState["preferences"],
      ) => Promise<UsageDashboardState>;
      onRefreshRequested: (callback: () => void) => () => void;
    };
  }
}
