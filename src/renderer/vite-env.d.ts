/// <reference types="vite/client" />

import type { SystemState, UsageDashboardState } from "../shared/dashboard";

declare global {
  interface Window {
    trayUsageWidget: {
      fetchUsageState: () => Promise<UsageDashboardState>;
      fetchSystemState: () => Promise<SystemState>;
      syncExpandedLayout: (layout: {
        contentHeight: number;
        settingsOpen: boolean;
      }) => Promise<void>;
      openExpandedPanel: () => Promise<void>;
      openCompactPanel: () => Promise<void>;
      closePanels: () => Promise<void>;
      refreshUsage: () => Promise<void>;
      connectClaude: (
        preferences: UsageDashboardState["preferences"],
      ) => Promise<UsageDashboardState>;
      saveSettings: (
        preferences: UsageDashboardState["preferences"],
      ) => Promise<UsageDashboardState>;
      onRefreshRequested: (callback: () => void) => () => void;
      onSettingsRequested: (callback: () => void) => () => void;
    };
  }
}
