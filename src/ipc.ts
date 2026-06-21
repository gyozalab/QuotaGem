import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UsageDashboardState } from "./shared/dashboard";

const ipcAdapter = {
  fetchUsageState: async (): Promise<UsageDashboardState> => {
    return invoke<UsageDashboardState>("fetch_usage_state");
  },
  syncExpandedLayout: async (layout: {
    contentHeight: number;
    settingsOpen: boolean;
  }): Promise<void> => {
    return invoke<void>("sync_expanded_layout", { layout });
  },
  openExpandedPanel: async (): Promise<void> => {
    return invoke<void>("open_expanded_panel");
  },
  openCompactPanel: async (): Promise<void> => {
    return invoke<void>("open_compact_panel");
  },
  closePanels: async (): Promise<void> => {
    return invoke<void>("close_panels");
  },
  connectClaude: async (): Promise<UsageDashboardState> => {
    return invoke<UsageDashboardState>("connect_claude");
  },
  saveSettings: async (
    preferences: UsageDashboardState["preferences"],
  ): Promise<UsageDashboardState> => {
    return invoke<UsageDashboardState>("save_settings", { preferences });
  },
  onRefreshRequested: (callback: () => void) => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      unlistenFn = await listen<void>("usage:refreshRequested", () => {
        callback();
      });
    };

    setupListener();

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  },
};

// 掛載到 global window
(window as any).trayUsageWidget = ipcAdapter;
